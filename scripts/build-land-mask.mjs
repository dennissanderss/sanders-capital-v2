/**
 * build-land-mask.mjs
 *
 * Haalt Natural Earth 110m land + lakes op en rasteriseert die naar een
 * compacte land/zee-bitmask (0.5° per cel). De mask wordt RLE + base64
 * gecodeerd weggeschreven naar src/components/home-2026/land-mask.ts,
 * zodat de globe echte continentcontouren tekent zonder runtime-fetch.
 *
 * Draaien:  node scripts/build-land-mask.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/physical'
const W = 720 // 0.5° in lengte
const H = 360 // 0.5° in breedte

async function geo(name) {
  const res = await fetch(`${BASE}/${name}.json`)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.json()
}

/** Alle ringen (outer + holes) van een FeatureCollection als platte lijst. */
function rings(fc) {
  const out = []
  const push = (ring) => { if (ring.length > 2) out.push(ring) }
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') g.coordinates.forEach(push)
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(push))
  }
  return out
}

/**
 * Scanline-rasterisatie met even-odd regel. Polygonen van Natural Earth
 * overlappen niet, dus even-odd over alle ringen tegelijk verwerkt de
 * gaten (binnenzeeën) correct.
 */
function rasterize(ringList) {
  const mask = new Uint8Array(W * H)
  // edges voorbereiden: [y1, x1, y2, x2]
  const edges = []
  for (const ring of ringList) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % n]
      if (a[1] === b[1]) continue // horizontale randen snijden nooit
      edges.push([a[1], a[0], b[1], b[0]])
    }
  }

  const xs = []
  for (let row = 0; row < H; row++) {
    const lat = 90 - (row + 0.5) * (180 / H)
    xs.length = 0
    for (let e = 0; e < edges.length; e++) {
      const [y1, x1, y2, x2] = edges[e]
      if ((y1 > lat) === (y2 > lat)) continue
      xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1))
    }
    if (xs.length < 2) continue
    xs.sort((p, q) => p - q)
    const base = row * W
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // celindex van lon -> kolom (celmidden ligt op -180 + (col+0.5)*step)
      let c0 = Math.ceil(((xs[i] + 180) / 360) * W - 0.5)
      let c1 = Math.floor(((xs[i + 1] + 180) / 360) * W - 0.5)
      if (c1 < 0 || c0 > W - 1) continue
      if (c0 < 0) c0 = 0
      if (c1 > W - 1) c1 = W - 1
      for (let c = c0; c <= c1; c++) mask[base + c] = 1
    }
  }
  return mask
}

/** Run-length + varint + base64. Begint altijd met een zee-run (kan 0 zijn). */
function encode(mask) {
  const bytes = []
  const varint = (n) => {
    while (n >= 0x80) { bytes.push((n & 0x7f) | 0x80); n >>>= 7 }
    bytes.push(n)
  }
  let cur = 0
  let run = 0
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]
    if (v === cur) { run++; continue }
    varint(run)
    cur = v
    run = 1
  }
  varint(run)
  return Buffer.from(bytes).toString('base64')
}

const land = await geo('ne_110m_land')
let lakesFc = null
try { lakesFc = await geo('ne_110m_lakes') } catch { /* lakes optioneel */ }

const landMask = rasterize(rings(land))
if (lakesFc) {
  const lakeMask = rasterize(rings(lakesFc))
  for (let i = 0; i < landMask.length; i++) if (lakeMask[i]) landMask[i] = 0
}

const b64 = encode(landMask)
let landCells = 0
for (let i = 0; i < landMask.length; i++) landCells += landMask[i]

const ts = `/**
 * Land/zee-mask op ${180 / H}° resolutie, gegenereerd uit Natural Earth 110m
 * (land minus meren) door scripts/build-land-mask.mjs. Niet met de hand
 * bewerken — draai het script opnieuw.
 *
 * Opslag: run-length encoding (varint, start op zee) in base64.
 */
export const LAND_W = ${W}
export const LAND_H = ${H}
const RLE = '${b64}'

let cache: Uint8Array | null = null

/** Decodeert de mask één keer en cachet het resultaat (alleen client-side). */
export function landMask(): Uint8Array {
  if (cache) return cache
  const bin = atob(RLE)
  const out = new Uint8Array(LAND_W * LAND_H)
  let i = 0
  let p = 0
  let value = 0
  while (p < bin.length && i < out.length) {
    let run = 0
    let shift = 0
    for (;;) {
      const b = bin.charCodeAt(p++)
      run |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) break
      shift += 7
    }
    if (value) out.fill(1, i, Math.min(i + run, out.length))
    i += run
    value ^= 1
  }
  cache = out
  return out
}

/** True als (lat, lon) in graden op land ligt. */
export function isLand(mask: Uint8Array, lat: number, lon: number): boolean {
  let col = Math.floor(((lon + 180) / 360) * LAND_W)
  col = ((col % LAND_W) + LAND_W) % LAND_W
  let row = Math.floor(((90 - lat) / 180) * LAND_H)
  if (row < 0) row = 0
  else if (row >= LAND_H) row = LAND_H - 1
  return mask[row * LAND_W + col] === 1
}
`

const outPath = resolve(__dirname, '..', 'src', 'components', 'home-2026', 'land-mask.ts')
writeFileSync(outPath, ts, 'utf8')

console.log(`cellen: ${W}x${H} = ${W * H}`)
console.log(`land:   ${landCells} (${((landCells / (W * H)) * 100).toFixed(1)}%)`)
console.log(`base64: ${(b64.length / 1024).toFixed(1)} KB`)
console.log(`→ ${outPath}`)
