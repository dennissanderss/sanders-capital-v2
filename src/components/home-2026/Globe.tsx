'use client'

import { useEffect, useRef } from 'react'

/**
 * Sanders Capital — Terminal Globe (canvas port of globe.js).
 * Dotted Earth (continents as light points) + glowing trade-route arcs
 * between financial centres + floating terminal price tags + wrapped brand.
 * Pure canvas, no external assets.
 */
export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const stage = canvas.parentElement
    if (!ctx || !stage) return

    const ACCENT_HEX = '#5b9dff'

    // continents as lat/lon ellipses — enough to read as Earth
    const BLOBS: number[][] = [
      [54, -100, 16, 26], [60, -95, 12, 34], [63, -150, 9, 15], [40, -95, 16, 22], [28, -100, 9, 12], // N. America
      [72, -42, 9, 16],                                                                               // Greenland
      [9, -70, 10, 10], [-5, -60, 13, 13], [-25, -63, 15, 9], [-44, -70, 9, 6],                        // S. America
      [50, 12, 11, 22], [60, 16, 7, 16], [44, 25, 8, 16],                                              // Europe
      [30, 18, 15, 20], [8, 18, 16, 20], [-12, 22, 14, 15], [-30, 24, 9, 11], [-22, 46, 6, 3],         // Africa
      [27, 44, 12, 14], [40, 55, 11, 22], [60, 90, 16, 55], [45, 85, 15, 35],                          // ME + N/C Asia
      [22, 78, 13, 11], [33, 108, 13, 15], [12, 103, 12, 15], [36, 138, 7, 4], [-2, 118, 7, 18],       // India/China/SEA/Japan/Indonesia
      [-25, 134, 12, 20],                                                                              // Australia
    ]
    const isLand = (lat: number, lon: number) => {
      for (const b of BLOBS) {
        const dlon = ((lon - b[1] + 540) % 360) - 180
        const a = (lat - b[0]) / b[2], c = dlon / b[3]
        if (a * a + c * c <= 1) return true
      }
      return false
    }

    // financial centres — placed on the dotted landmasses
    const CITY: Record<string, { lat: number; lon: number }> = {
      ny: { lat: 41, lon: -90 }, sao: { lat: -18, lon: -58 }, ldn: { lat: 52, lon: 4 },
      fra: { lat: 49, lon: 14 }, dxb: { lat: 26, lon: 46 }, hk: { lat: 30, lon: 110 },
      sgp: { lat: 6, lon: 102 }, tyo: { lat: 36, lon: 138 }, syd: { lat: -25, lon: 134 },
    }
    const ROUTES: [string, string][] = [
      ['ny', 'ldn'], ['ldn', 'fra'], ['fra', 'dxb'], ['dxb', 'hk'], ['hk', 'tyo'],
      ['tyo', 'syd'], ['hk', 'sgp'], ['ny', 'sao'], ['ldn', 'hk'], ['ny', 'tyo'],
    ]
    const TAGS: { city: string; label: string }[] = [
      { city: 'ldn', label: 'EUR/USD' }, { city: 'ny', label: 'GBP/USD' }, { city: 'tyo', label: 'USD/JPY' },
      { city: 'dxb', label: 'Inflation' }, { city: 'hk', label: 'Interest Rate' }, { city: 'fra', label: 'GDP Growth' },
      { city: 'sgp', label: 'AUD/USD' }, { city: 'sao', label: 'Bond Yields' }, { city: 'syd', label: 'Employment' },
    ]
    const ARROWS = ['fra', 'sgp', 'sao']

    const v3 = (lat: number, lon: number): [number, number, number] => {
      const p = lat * Math.PI / 180, t = lon * Math.PI / 180
      return [Math.cos(p) * Math.sin(t), Math.sin(p), Math.cos(p) * Math.cos(t)]
    }

    let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1

    // land points (Fibonacci sphere, kept where it maps to land)
    const PTS: [number, number, number][] = []
    const N = 16000
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const th = golden * i
      const lat = Math.asin(y) * 180 / Math.PI
      const lon = Math.atan2(Math.sin(th) * r, Math.cos(th) * r) * 180 / Math.PI
      if (isLand(lat, lon)) PTS.push(v3(lat, lon))
    }

    // terminal tags as DOM overlays appended to the stage
    const labels: HTMLDivElement[] = []
    TAGS.forEach((t) => {
      const el = document.createElement('div')
      el.className = 'glabel'
      el.innerHTML = `<span class="gp">${t.label}</span>`
      el.style.opacity = '0'
      stage.appendChild(el)
      labels.push(el)
    })

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = stage.clientWidth; H = stage.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      R = Math.min(W, H) * 0.43
      cx = W / 2; cy = H / 2
    }
    resize()

    const TILT = -20 * Math.PI / 180
    const st = Math.sin(TILT), ct = Math.cos(TILT)
    const project = (vec: [number, number, number], ay: number): [number, number, number] => {
      const sa = Math.sin(ay), ca = Math.cos(ay)
      const x = vec[0] * ca + vec[2] * sa
      const z = -vec[0] * sa + vec[2] * ca
      const y = vec[1]
      const y2 = y * ct - z * st
      const z2 = y * st + z * ct
      return [cx + x * R, cy - y2 * R, z2]
    }

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let raf = 0
    let killed = false

    const frame = (now: number) => {
      if (killed) return
      const ay = reduce ? 0.7 : ((now - t0) / 1000) * 0.13
      ctx.clearRect(0, 0, W, H)

      // atmosphere glow
      const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.7)
      g.addColorStop(0, 'rgba(70,140,255,0.30)')
      g.addColorStop(0.34, 'rgba(55,110,235,0.16)')
      g.addColorStop(0.7, 'rgba(40,90,200,0.05)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, 7); ctx.fill()
      // bright atmosphere rim
      ctx.lineWidth = 2.4
      ctx.strokeStyle = 'rgba(120,180,255,0.5)'
      ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, 7); ctx.stroke()

      // sphere base
      const sg = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R)
      sg.addColorStop(0, 'rgba(22,46,92,0.55)')
      sg.addColorStop(0.7, 'rgba(8,18,40,0.5)')
      sg.addColorStop(1, 'rgba(4,9,20,0.62)')
      ctx.fillStyle = sg
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill()

      // land dots (front hemisphere only)
      ctx.fillStyle = ACCENT_HEX
      for (let i = 0; i < PTS.length; i++) {
        const p = project(PTS[i], ay)
        if (p[2] < 0.02) continue
        ctx.globalAlpha = 0.2 + p[2] * 0.72
        const s = 0.7 + p[2] * 0.8
        ctx.fillRect(p[0], p[1], s, s)
      }
      ctx.globalAlpha = 1

      // trade-route arcs with firing comet-flashes
      const dur = 3000
      for (let r = 0; r < ROUTES.length; r++) {
        const A = v3(CITY[ROUTES[r][0]].lat, CITY[ROUTES[r][0]].lon)
        const B = v3(CITY[ROUTES[r][1]].lat, CITY[ROUTES[r][1]].lon)
        const dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2]
        const omega = Math.acos(Math.max(-1, Math.min(1, dot)))
        const sinw = Math.sin(omega) || 1e-6
        const steps = 42
        const pts: { x: number; y: number; z: number; f: number }[] = []
        for (let s = 0; s <= steps; s++) {
          const f = s / steps
          const k1 = Math.sin((1 - f) * omega) / sinw, k2 = Math.sin(f * omega) / sinw
          let vx = A[0] * k1 + B[0] * k2, vy = A[1] * k1 + B[1] * k2, vz = A[2] * k1 + B[2] * k2
          const ln = Math.sqrt(vx * vx + vy * vy + vz * vz)
          const lift = 1 + 0.24 * Math.sin(Math.PI * f)
          vx = vx / ln * lift; vy = vy / ln * lift; vz = vz / ln * lift
          const p = project([vx, vy, vz], ay)
          pts.push({ x: p[0], y: p[1], z: p[2], f })
        }
        // faint base line (front-facing segments only)
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(90,150,255,0.16)'
        ctx.beginPath(); let started = false
        for (const q of pts) {
          if (q.z < 0) { started = false; continue }
          if (!started) { ctx.moveTo(q.x, q.y); started = true } else ctx.lineTo(q.x, q.y)
        }
        ctx.stroke()
        if (reduce) continue
        // moving comet head + trail
        const headT = (((now / dur) + r / ROUTES.length) % 1)
        const trail = 0.26
        let headPt: { x: number; y: number } | null = null
        for (let s = 1; s < pts.length; s++) {
          const a0 = pts[s - 1], b0 = pts[s]
          if (a0.z < 0 || b0.z < 0) continue
          let d = headT - b0.f; if (d < 0) d += 1
          if (d > trail) continue
          const k = 1 - d / trail
          ctx.lineWidth = 0.8 + 2.4 * k
          ctx.strokeStyle = `rgba(${150 + (k * 80) | 0}, ${195 + (k * 45) | 0}, 255, ${(0.25 + 0.7 * k).toFixed(3)})`
          ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.stroke()
          if (k > 0.92) headPt = b0
        }
        if (headPt) {
          ctx.fillStyle = 'rgba(225,238,255,0.98)'
          ctx.beginPath(); ctx.arc(headPt.x, headPt.y, 2.3, 0, 7); ctx.fill()
          ctx.fillStyle = 'rgba(120,180,255,0.30)'
          ctx.beginPath(); ctx.arc(headPt.x, headPt.y, 7, 0, 7); ctx.fill()
        }
      }

      // city markers — pulsing rings on financial centres
      let ci = 0
      for (const k in CITY) {
        ci++
        const p = project(v3(CITY[k].lat, CITY[k].lon), ay)
        if (p[2] < 0.02) continue
        if (!reduce) {
          const ph = (((now / 1500) + ci * 0.27) % 1)
          ctx.strokeStyle = `rgba(120,180,255,${((1 - ph) * 0.55 * p[2]).toFixed(3)})`
          ctx.lineWidth = 1.2
          ctx.beginPath(); ctx.arc(p[0], p[1], 3 + ph * 9, 0, 7); ctx.stroke()
        }
        ctx.fillStyle = 'rgba(150,200,255,0.35)'
        ctx.beginPath(); ctx.arc(p[0], p[1], 5.5, 0, 7); ctx.fill()
        ctx.fillStyle = ACCENT_HEX
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, 7); ctx.fill()
        ctx.fillStyle = 'rgba(235,244,255,0.95)'
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.1, 0, 7); ctx.fill()
      }

      // brand wrapped around the globe — letters follow the surface curve
      {
        const name = 'SANDERS CAPITAL'
        const L = name.length
        const lat = 2
        const lonSpan = 150
        const lon0 = -lonSpan / 2
        const base = R * 0.10
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        for (let i = 0; i < L; i++) {
          const ch = name[i]
          if (ch === ' ') continue
          const lon = lon0 + (i / (L - 1)) * lonSpan
          const p = project(v3(lat, lon), ay)
          if (p[2] <= 0.05) continue
          const pn = project(v3(lat, lon + 2), ay)
          const ang = Math.atan2(pn[1] - p[1], pn[0] - p[0])
          let a = (p[2] - 0.05) / 0.22; a = a < 0 ? 0 : a > 1 ? 1 : a
          a = a * a * (3 - 2 * a)
          const sz = base * (0.5 + 0.62 * p[2])
          ctx.save()
          ctx.translate(p[0], p[1])
          ctx.rotate(ang)
          ctx.scale(1, 0.62 + 0.38 * p[2])
          ctx.shadowColor = 'rgba(15,35,70,0.85)'
          ctx.shadowBlur = 5; ctx.shadowOffsetY = 1
          ctx.font = `600 ${sz.toFixed(1)}px Georgia, 'Times New Roman', serif`
          ctx.fillStyle = `rgba(234,241,249,${a.toFixed(3)})`
          ctx.fillText(ch, 0, 0)
          ctx.restore()
        }
      }

      // rising momentum arrows on a few centres
      for (let ai = 0; ai < ARROWS.length; ai++) {
        const c = CITY[ARROWS[ai]]
        const p = project(v3(c.lat, c.lon), ay)
        if (p[2] < 0.12) continue
        const len = 22 * p[2] + 8
        const x2 = p[0] + len * 0.62, y2 = p[1] - len
        ctx.strokeStyle = `rgba(120,200,170,${(0.55 * p[2]).toFixed(3)})`
        ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(x2, y2); ctx.stroke()
        const ah = 5
        ctx.fillStyle = `rgba(150,225,190,${(0.7 * p[2]).toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(x2, y2)
        ctx.lineTo(x2 - ah, y2 + ah * 0.4)
        ctx.lineTo(x2 - ah * 0.3, y2 + ah * 1.1)
        ctx.closePath(); ctx.fill()
      }

      // terminal tags (DOM overlays)
      for (let i = 0; i < TAGS.length; i++) {
        const c = CITY[TAGS[i].city]
        const p = project(v3(c.lat, c.lon), ay)
        const el = labels[i]
        if (p[2] < 0.45) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; continue }
        el.style.opacity = Math.min(1, (p[2] - 0.45) * 4).toFixed(2)
        el.style.transform = `translate(${(p[0] + 12).toFixed(1)}px, ${(p[1] - 14).toFixed(1)}px)`
      }

      raf = requestAnimationFrame(frame)
    }

    let ro: ResizeObserver | null = null
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { resize() })
      ro.observe(stage)
    }
    raf = requestAnimationFrame(frame)
    const onLoad = () => resize()
    window.addEventListener('load', onLoad)
    const timer = window.setTimeout(() => resize(), 350)

    return () => {
      killed = true
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      window.removeEventListener('load', onLoad)
      window.clearTimeout(timer)
      labels.forEach((el) => el.remove())
    }
  }, [])

  return (
    <div className="globe-stage" aria-hidden="true">
      <canvas id="globe" className="globe" ref={canvasRef} />
    </div>
  )
}
