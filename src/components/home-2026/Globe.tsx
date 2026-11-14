'use client'

import { useEffect, useRef } from 'react'
import { isLand, landMask } from './land-mask'

/**
 * Sanders Capital — hero globe.
 *
 * Orthografische aarde op canvas: echte kustlijnen (Natural Earth 110m via
 * land-mask.ts), gerichte belichting met dag/nacht-terminator, meridianen,
 * handelsroutes tussen financiële centra en terminal-labels. Geen externe
 * assets, geen WebGL. Met de muis te slepen; staat stil bij reduced motion.
 */

type Centre = { code: string; tag: string; lat: number; lon: number }

const CENTRES: Record<string, Centre> = {
  ny: { code: 'NY', tag: 'EUR/USD', lat: 40.71, lon: -74.01 },
  sao: { code: 'SAO', tag: 'USD/BRL', lat: -23.55, lon: -46.63 },
  ldn: { code: 'LDN', tag: 'GBP/USD', lat: 51.51, lon: -0.13 },
  fra: { code: 'FRA', tag: 'EUR/GBP', lat: 50.11, lon: 8.68 },
  dxb: { code: 'DXB', tag: 'XAU/USD', lat: 25.2, lon: 55.27 },
  sgp: { code: 'SGP', tag: 'USD/SGD', lat: 1.35, lon: 103.82 },
  hk: { code: 'HK', tag: 'USD/CNH', lat: 22.32, lon: 114.17 },
  tyo: { code: 'TYO', tag: 'USD/JPY', lat: 35.68, lon: 139.69 },
  syd: { code: 'SYD', tag: 'AUD/USD', lat: -33.87, lon: 151.21 },
}
const KEYS = Object.keys(CENTRES)

const ROUTES: [string, string][] = [
  ['ny', 'ldn'], ['ldn', 'fra'], ['fra', 'dxb'], ['dxb', 'hk'], ['hk', 'tyo'],
  ['tyo', 'syd'], ['hk', 'sgp'], ['ny', 'sao'], ['ldn', 'hk'],
]

/** Landpunten van nachtzijde (donker) naar dagzijde (helder). */
const DOT_COLORS = [
  'rgba(42,82,146,0.34)',
  'rgba(50,100,176,0.48)',
  'rgba(60,121,205,0.60)',
  'rgba(74,145,232,0.72)',
  'rgba(103,170,246,0.82)',
  'rgba(146,199,252,0.89)',
  'rgba(201,227,255,0.96)',
]

const TAU = Math.PI * 2

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = canvas?.parentElement as HTMLDivElement | null
    if (!canvas || !stage) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mask = landMask()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    // ── belichting (view-space, links-boven-voor) ──────────────────────
    const lnorm = Math.hypot(-0.52, 0.42, 0.74)
    const LX = -0.52 / lnorm, LY = 0.42 / lnorm, LZ = 0.74 / lnorm

    // ── camera / afmetingen ────────────────────────────────────────────
    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1
    let tilt = 18 * Math.PI / 180
    let ST = Math.sin(tilt), CT = Math.cos(tilt)

    const vec = (lat: number, lon: number): [number, number, number] => {
      const p = lat * Math.PI / 180, t = lon * Math.PI / 180
      const cp = Math.cos(p)
      return [cp * Math.sin(t), Math.sin(p), cp * Math.cos(t)]
    }

    /** Smoothstep-fade die punten vlak bij de rand laat uitdoven. */
    const fade = (z: number) => {
      const t = (z - 0.012) / 0.21
      return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
    }

    // ── landpunten (Fibonacci-spiraal, alleen waar land ligt) ──────────
    let PX = new Float32Array(0), PY = new Float32Array(0), PZ = new Float32Array(0)
    let SX = new Float32Array(0), SY = new Float32Array(0)
    let SS = new Uint8Array(0), SB = new Uint8Array(0)
    let builtFor = 0

    const buildPoints = () => {
      const spacing = 4 // doel-afstand tussen punten in CSS-pixels
      const n = Math.round(4 * Math.PI * (R / spacing) * (R / spacing))
      const N = Math.max(9000, Math.min(52000, n))
      const golden = Math.PI * (3 - Math.sqrt(5))
      const tx: number[] = [], ty: number[] = [], tz: number[] = []
      for (let i = 0; i < N; i++) {
        const y = 1 - ((i + 0.5) / N) * 2
        const r = Math.sqrt(Math.max(0, 1 - y * y))
        const th = golden * i
        const lat = Math.asin(y) * 180 / Math.PI
        let lon = (th * 180 / Math.PI) % 360
        if (lon > 180) lon -= 360
        if (!isLand(mask, lat, lon)) continue
        tx.push(r * Math.sin(th)); ty.push(y); tz.push(r * Math.cos(th))
      }
      PX = Float32Array.from(tx); PY = Float32Array.from(ty); PZ = Float32Array.from(tz)
      SX = new Float32Array(PX.length); SY = new Float32Array(PX.length)
      SS = new Uint8Array(PX.length); SB = new Uint8Array(PX.length)
      builtFor = R
    }

    // ── routegeometrie (great circle + boog, rotatie-onafhankelijk) ────
    const STEPS = 56
    const routes = ROUTES.map(([a, b]) => {
      const A = vec(CENTRES[a].lat, CENTRES[a].lon)
      const B = vec(CENTRES[b].lat, CENTRES[b].lon)
      const d = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))
      const om = Math.acos(d)
      const sw = Math.sin(om) || 1e-6
      const lift = 0.04 + 0.13 * (om / Math.PI)
      const pts = new Float32Array((STEPS + 1) * 3)
      for (let s = 0; s <= STEPS; s++) {
        const f = s / STEPS
        const k1 = Math.sin((1 - f) * om) / sw, k2 = Math.sin(f * om) / sw
        let vx = A[0] * k1 + B[0] * k2, vy = A[1] * k1 + B[1] * k2, vz = A[2] * k1 + B[2] * k2
        const l = Math.hypot(vx, vy, vz) || 1
        const g = (1 + lift * Math.sin(Math.PI * f)) / l
        pts[s * 3] = vx * g; pts[s * 3 + 1] = vy * g; pts[s * 3 + 2] = vz * g
      }
      return pts
    })
    const RP = STEPS + 1
    const ax = new Float32Array(routes.length * RP)
    const ay_ = new Float32Array(routes.length * RP)
    const af = new Float32Array(routes.length * RP)

    // ── meridianen en parallellen (vooraf berekend) ────────────────────
    const grat: Float32Array[] = []
    for (let lon = -180; lon < 180; lon += 30) {
      const arr = new Float32Array(29 * 3)
      let i = 0
      for (let lat = -84; lat <= 84; lat += 6) {
        const v = vec(lat, lon); arr[i++] = v[0]; arr[i++] = v[1]; arr[i++] = v[2]
      }
      grat.push(arr)
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      const arr = new Float32Array(61 * 3)
      let i = 0
      for (let lon = -180; lon <= 180; lon += 6) {
        const v = vec(lat, lon); arr[i++] = v[0]; arr[i++] = v[1]; arr[i++] = v[2]
      }
      grat.push(arr)
    }

    const cityVec = KEYS.map((k) => vec(CENTRES[k].lat, CENTRES[k].lon))
    const mx = new Float32Array(KEYS.length)
    const my = new Float32Array(KEYS.length)
    const mz = new Float32Array(KEYS.length)

    // ── labels (DOM-overlays boven het canvas) ─────────────────────────
    const labels: HTMLDivElement[] = []
    const labelW: number[] = []
    KEYS.forEach((k) => {
      const el = document.createElement('div')
      el.className = 'glabel'
      el.innerHTML = `<span class="gc">${CENTRES[k].code}</span><span class="gp">${CENTRES[k].tag}</span>`
      el.style.opacity = '0'
      stage.appendChild(el)
      labels.push(el)
      labelW.push(96)
    })
    const measure = () => labels.forEach((el, i) => { labelW[i] = el.offsetWidth || 96 })

    // ── gebufferde lijnsegmenten (één stroke per helderheidsniveau) ────
    const BUCKETS = 5
    const segs: number[][] = Array.from({ length: BUCKETS }, () => [])
    const pushSeg = (x1: number, y1: number, x2: number, y2: number, f: number) => {
      if (f < 0.07) return
      let b = Math.ceil(f * BUCKETS) - 1
      if (b < 0) b = 0; else if (b >= BUCKETS) b = BUCKETS - 1
      segs[b].push(x1, y1, x2, y2)
    }
    const flushSegs = (rgb: string, maxA: number, width: number) => {
      ctx.lineWidth = width
      for (let b = 0; b < BUCKETS; b++) {
        const arr = segs[b]
        if (!arr.length) continue
        ctx.strokeStyle = `rgba(${rgb},${(maxA * ((b + 1) / BUCKETS)).toFixed(3)})`
        ctx.beginPath()
        for (let i = 0; i < arr.length; i += 4) {
          ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3])
        }
        ctx.stroke()
        arr.length = 0
      }
    }

    // ── statische lagen (achtergrond + randlicht) ──────────────────────
    const bgCanvas = document.createElement('canvas')
    const rimCanvas = document.createElement('canvas')

    const paintStatic = () => {
      const prep = (c: HTMLCanvasElement) => {
        c.width = Math.max(1, Math.round(W * dpr))
        c.height = Math.max(1, Math.round(H * dpr))
        const g = c.getContext('2d')!
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, W, H)
        return g
      }

      // achtergrond: atmosfeergloed, instrumentring, planeetlichaam
      const bg = prep(bgCanvas)
      const halo = bg.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.62)
      halo.addColorStop(0, 'rgba(59,130,246,0.26)')
      halo.addColorStop(0.22, 'rgba(59,130,246,0.125)')
      halo.addColorStop(0.55, 'rgba(45,105,215,0.045)')
      halo.addColorStop(1, 'rgba(20,50,110,0)')
      bg.fillStyle = halo
      bg.beginPath(); bg.arc(cx, cy, R * 1.62, 0, TAU); bg.fill()

      const Rb = R * 1.085
      bg.save(); bg.translate(cx, cy)
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU
        const card = i % 30 === 0, major = i % 10 === 0
        const len = card ? 9 : major ? 5.5 : 3
        bg.strokeStyle = card ? 'rgba(147,197,253,0.24)' : major ? 'rgba(147,197,253,0.14)' : 'rgba(147,197,253,0.075)'
        bg.lineWidth = card ? 1.2 : 1
        bg.beginPath()
        bg.moveTo(Math.cos(a) * Rb, Math.sin(a) * Rb)
        bg.lineTo(Math.cos(a) * (Rb + len), Math.sin(a) * (Rb + len))
        bg.stroke()
      }
      bg.restore()
      bg.strokeStyle = 'rgba(147,197,253,0.05)'; bg.lineWidth = 1
      bg.beginPath(); bg.arc(cx, cy, Rb, 0, TAU); bg.stroke()

      const body = bg.createRadialGradient(cx + LX * R * 0.62, cy - LY * R * 0.62, R * 0.04, cx, cy, R * 1.06)
      body.addColorStop(0, '#1b3f79')
      body.addColorStop(0.32, '#122b58')
      body.addColorStop(0.62, '#0b1c3c')
      body.addColorStop(0.86, '#071226')
      body.addColorStop(1, '#050d1c')
      bg.fillStyle = body
      bg.beginPath(); bg.arc(cx, cy, R, 0, TAU); bg.fill()

      // randlaag: limbverduistering, terminator, atmosfeerrand
      const rim = prep(rimCanvas)
      rim.save()
      rim.beginPath(); rim.arc(cx, cy, R, 0, TAU); rim.clip()
      const limb = rim.createRadialGradient(cx, cy, R * 0.55, cx, cy, R)
      limb.addColorStop(0, 'rgba(3,8,20,0)')
      limb.addColorStop(0.68, 'rgba(3,8,20,0.20)')
      limb.addColorStop(1, 'rgba(3,8,20,0.82)')
      rim.fillStyle = limb
      rim.fillRect(cx - R, cy - R, R * 2, R * 2)
      const term = rim.createLinearGradient(cx + LX * R, cy - LY * R, cx - LX * R, cy + LY * R)
      term.addColorStop(0, 'rgba(2,7,18,0)')
      term.addColorStop(0.5, 'rgba(2,7,18,0.07)')
      term.addColorStop(1, 'rgba(2,7,18,0.30)')
      rim.fillStyle = term
      rim.fillRect(cx - R, cy - R, R * 2, R * 2)
      rim.restore()

      const edge = rim.createLinearGradient(cx + LX * R, cy - LY * R, cx - LX * R, cy + LY * R)
      edge.addColorStop(0, 'rgba(192,222,255,0.80)')
      edge.addColorStop(0.42, 'rgba(96,165,250,0.30)')
      edge.addColorStop(1, 'rgba(59,130,246,0.05)')
      rim.strokeStyle = edge
      rim.lineWidth = 1.6
      rim.shadowColor = 'rgba(96,165,250,0.55)'
      rim.shadowBlur = 14
      rim.beginPath(); rim.arc(cx, cy, R - 0.8, 0, TAU); rim.stroke()
      rim.shadowBlur = 0
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = stage.clientWidth; H = stage.clientHeight
      if (!W || !H) return
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      R = Math.min(W, H) * 0.405
      cx = W / 2; cy = H / 2
      if (!builtFor || Math.abs(R - builtFor) / builtFor > 0.08) buildPoints()
      paintStatic()
    }

    // ── tekenroutines ──────────────────────────────────────────────────
    const drawGraticule = (sa: number, ca: number) => {
      for (const line of grat) {
        let px = 0, py = 0, pf = 0, has = false
        for (let i = 0; i < line.length; i += 3) {
          const x = line[i], y = line[i + 1], z = line[i + 2]
          const rx = x * ca + z * sa, rz = -x * sa + z * ca
          const vy = y * CT - rz * ST, vz = y * ST + rz * CT
          const f = fade(vz), sx = cx + rx * R, sy = cy - vy * R
          if (has) pushSeg(px, py, sx, sy, Math.min(f, pf))
          px = sx; py = sy; pf = f; has = true
        }
      }
      flushSegs('120,170,245', 0.10, 1)
    }

    const drawDots = (sa: number, ca: number) => {
      const n = PX.length
      if (!n) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const cxd = cx * dpr, cyd = cy * dpr, Rd = R * dpr
      let m = 0
      for (let i = 0; i < n; i++) {
        const x = PX[i], y = PY[i], z = PZ[i]
        const rx = x * ca + z * sa, rz = -x * sa + z * ca
        const vy = y * CT - rz * ST, vz = y * ST + rz * CT
        if (vz < 0.012) continue
        const f = fade(vz)
        if (f < 0.03) continue
        let lit = rx * LX + vy * LY + vz * LZ
        if (lit < 0) lit = 0
        // (0.42 + 0.58*vz) compenseert het opstapelen van punten bij de rand
        let b = ((f * (0.30 + 0.75 * lit) * (0.42 + 0.58 * vz)) * DOT_COLORS.length) | 0
        if (b < 0) b = 0; else if (b >= DOT_COLORS.length) b = DOT_COLORS.length - 1
        SX[m] = cxd + rx * Rd
        SY[m] = cyd - vy * Rd
        let s = Math.round((0.78 + 1.05 * vz) * dpr)
        if (s < 1) s = 1
        SS[m] = s
        SB[m] = b
        m++
      }
      for (let b = 0; b < DOT_COLORS.length; b++) {
        ctx.fillStyle = DOT_COLORS[b]
        for (let i = 0; i < m; i++) {
          if (SB[i] !== b) continue
          ctx.fillRect((SX[i] + 0.5) | 0, (SY[i] + 0.5) | 0, SS[i], SS[i])
        }
      }
      ctx.restore()
    }

    const CYCLE = 6400 // ms per route-cyclus
    const SPAN = 0.52  // deel van de cyclus waarin de puls loopt
    const TRAIL = 0.24 // staartlengte als fractie van de boog

    const drawRoutes = (sa: number, ca: number, now: number) => {
      // 1. projecteren en alle basislijnen in één keer tekenen
      for (let r = 0; r < routes.length; r++) {
        const pts = routes[r]
        const o = r * RP
        for (let s = 0; s <= STEPS; s++) {
          const x = pts[s * 3], y = pts[s * 3 + 1], z = pts[s * 3 + 2]
          const rx = x * ca + z * sa, rz = -x * sa + z * ca
          const vy = y * CT - rz * ST, vz = y * ST + rz * CT
          // extra dieptefactor: bogen vlak bij de rand worden sterk ingekort
          // weergegeven en zouden anders als felle veeg samenklonteren
          ax[o + s] = cx + rx * R; ay_[o + s] = cy - vy * R
          af[o + s] = fade(vz) * (0.32 + 0.68 * vz)
          if (s > 0) {
            pushSeg(ax[o + s - 1], ay_[o + s - 1], ax[o + s], ay_[o + s], Math.min(af[o + s], af[o + s - 1]))
          }
        }
      }
      flushSegs('125,180,255', 0.27, 1)
      if (reduce) return

      // 2. lichtpuls over de boog — losse segmenten met aflopende staart
      ctx.lineCap = 'round'
      for (let r = 0; r < routes.length; r++) {
        const ph = ((now / CYCLE) + r * 0.1111) % 1
        if (ph >= SPAN) continue
        const o = r * RP
        const head = ph / SPAN
        const env = Math.min(1, head / 0.1, (1 - head) / 0.14)
        let hx = 0, hy = 0, hk = 0, hf = 0
        for (let s = 1; s <= STEPS; s++) {
          const d = head - s / STEPS
          if (d < 0 || d > TRAIL) continue
          const vis = Math.min(af[o + s], af[o + s - 1])
          if (vis < 0.05) continue
          const k = Math.pow(1 - d / TRAIL, 1.4)
          ctx.lineWidth = 0.9 + 2.1 * k
          ctx.strokeStyle = `rgba(${(140 + 90 * k) | 0},${(190 + 56 * k) | 0},255,${(env * vis * (0.12 + 0.8 * k)).toFixed(3)})`
          ctx.beginPath(); ctx.moveTo(ax[o + s - 1], ay_[o + s - 1]); ctx.lineTo(ax[o + s], ay_[o + s]); ctx.stroke()
          if (k > hk) { hk = k; hx = ax[o + s]; hy = ay_[o + s]; hf = vis }
        }
        if (hk > 0.7 && hf > 0.2) {
          const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 11)
          glow.addColorStop(0, `rgba(147,197,253,${(0.34 * env * hf).toFixed(3)})`)
          glow.addColorStop(1, 'rgba(147,197,253,0)')
          ctx.fillStyle = glow
          ctx.beginPath(); ctx.arc(hx, hy, 11, 0, TAU); ctx.fill()
          ctx.fillStyle = `rgba(240,248,255,${(0.95 * env * hf).toFixed(3)})`
          ctx.beginPath(); ctx.arc(hx, hy, 2, 0, TAU); ctx.fill()
        }
      }
      ctx.lineCap = 'butt'
    }

    const drawCentres = (sa: number, ca: number, now: number) => {
      for (let i = 0; i < cityVec.length; i++) {
        const v = cityVec[i]
        const rx = v[0] * ca + v[2] * sa, rz = -v[0] * sa + v[2] * ca
        const vy = v[1] * CT - rz * ST, vz = v[1] * ST + rz * CT
        mx[i] = cx + rx * R; my[i] = cy - vy * R; mz[i] = vz
        if (vz < 0.02) continue
        const f = fade(vz)
        if (f < 0.05) continue
        const sx = mx[i], sy = my[i]

        if (!reduce) {
          const p = ((now / 5200) + i * 0.21) % 1
          if (p < 0.5) {
            const q = p / 0.5
            ctx.strokeStyle = `rgba(147,197,253,${(0.4 * (1 - q) * f).toFixed(3)})`
            ctx.lineWidth = 1.1
            ctx.beginPath(); ctx.arc(sx, sy, 3 + q * 13, 0, TAU); ctx.stroke()
          }
        }
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8)
        halo.addColorStop(0, `rgba(96,165,250,${(0.5 * f).toFixed(3)})`)
        halo.addColorStop(1, 'rgba(96,165,250,0)')
        ctx.fillStyle = halo
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, TAU); ctx.fill()
        ctx.fillStyle = `rgba(226,240,255,${(0.95 * f).toFixed(3)})`
        ctx.beginPath(); ctx.arc(sx, sy, 1.9, 0, TAU); ctx.fill()
      }
    }

    /** Maximaal drie labels tonen: de meest naar voren gedraaide centra. */
    const placeLabels = () => {
      const order = KEYS.map((_, i) => i).filter((i) => mz[i] > 0.58).sort((a, b) => mz[b] - mz[a])
      const taken: number[] = []
      const shown = new Set<number>()
      for (const i of order) {
        if (shown.size >= 3) break
        let ly = my[i] - 24
        if (ly < 16) ly = 16
        if (ly > H - 18) ly = H - 18
        if (taken.some((t) => Math.abs(t - ly) < 30)) continue

        // bij voorkeur rechts van het punt; anders links, anders overslaan
        const w = labelW[i]
        let dir = 1
        let lx = mx[i] + 34
        if (lx + w > W - 6) {
          dir = -1
          lx = mx[i] - 34 - w
          if (lx < 6) continue
        }
        // de chip zelf schakelt hard om; de CSS-transition verzorgt de fade,
        // zodat er nooit half-transparante zwevende tekst blijft staan
        const a = Math.min(1, (mz[i] - 0.58) * 16)
        const ex = dir > 0 ? lx : lx + w
        ctx.strokeStyle = `rgba(147,197,253,${(0.42 * a).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(mx[i] + 4 * dir, my[i] - 4)
        ctx.lineTo(ex - 10 * dir, ly)
        ctx.lineTo(ex, ly)
        ctx.stroke()

        const el = labels[i]
        el.style.opacity = '1'
        el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translateY(-50%)`
        taken.push(ly)
        shown.add(i)
      }
      for (let i = 0; i < labels.length; i++) if (!shown.has(i)) labels[i].style.opacity = '0'
    }

    // ── slepen met de muis ─────────────────────────────────────────────
    let spin = 0, spinVel = 0, dragging = false, lastX = 0, lastY = 0
    const onDown = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      dragging = true; spinVel = 0; lastX = e.clientX; lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      spin += dx * 0.005
      spinVel = dx * 0.005
      tilt = Math.max(-0.17, Math.min(0.78, tilt - dy * 0.004))
      ST = Math.sin(tilt); CT = Math.cos(tilt)
      kick()
    }
    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      canvas.style.cursor = 'grab'
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* al vrijgegeven */ }
    }
    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    // ── hoofdlus ───────────────────────────────────────────────────────
    const SPEED = 0.072 // rad/s
    const t0 = performance.now()
    let raf = 0
    let alive = true
    let visible = true

    const render = (now: number) => {
      if (!W || !H) return
      if (!dragging) {
        spin += spinVel
        spinVel *= 0.93
        if (Math.abs(spinVel) < 1e-5) spinVel = 0
      }
      const a = (reduce ? 0.62 : ((now - t0) / 1000) * SPEED) + spin
      const sa = Math.sin(a), ca = Math.cos(a)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(bgCanvas, 0, 0, W, H)
      drawGraticule(sa, ca)
      drawDots(sa, ca)
      ctx.drawImage(rimCanvas, 0, 0, W, H)
      drawRoutes(sa, ca, now)
      drawCentres(sa, ca, now)
      placeLabels()
    }

    const loop = (now: number) => {
      raf = 0
      if (!alive) return
      render(now)
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(loop)
    }
    function kick() {
      if (!raf && alive) raf = requestAnimationFrame(loop)
    }

    resize()
    measure()
    kick()

    let ro: ResizeObserver | null = null
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { resize(); kick() })
      ro.observe(stage)
    }
    let io: IntersectionObserver | null = null
    if (window.IntersectionObserver) {
      io = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting
        if (visible) kick()
      }, { threshold: 0 })
      io.observe(stage)
    }
    const onVis = () => { if (!document.hidden) kick() }
    document.addEventListener('visibilitychange', onVis)
    const onLoad = () => { resize(); measure(); kick() }
    window.addEventListener('load', onLoad)
    const timer = window.setTimeout(() => { resize(); measure(); kick() }, 400)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('load', onLoad)
      window.clearTimeout(timer)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      labels.forEach((el) => el.remove())
    }
  }, [])

  return (
    <div className="globe-stage" aria-hidden="true">
      <canvas className="globe" ref={canvasRef} />
    </div>
  )
}
