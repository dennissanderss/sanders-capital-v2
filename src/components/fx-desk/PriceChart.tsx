'use client'

import { useEffect, useState } from 'react'
import type { Outcome } from './atoms'

// ─── Yahoo symbol map for FX pairs ────────────────────────────
const YAHOO_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

interface PriceChartProps {
  pair: string
  entry: number
  tp: number
  sl: number
  calledAt: string  // ISO date or "13 jun, 09:15"
  closedAt: string | null
  outcome: Outcome
  dir: 'long' | 'short'
}

interface ChartData {
  series: number[]
  entryIdx: number
  closeIdx: number | null
}

export function PriceChart(props: PriceChartProps) {
  const [data, setData] = useState<ChartData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    fetchPriceData(props.pair, props.calledAt, props.closedAt)
      .then((d) => {
        if (cancelled) return
        if (!d) {
          setError('Geen prijsdata beschikbaar')
        } else {
          setData(d)
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Fout bij laden chart')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [props.pair, props.calledAt, props.closedAt])

  if (loading) return <div className="chart-loading">Chart laden…</div>
  if (error || !data) return <div className="chart-empty">{error || 'Geen prijsdata'}</div>

  return <PriceChartSvg {...props} {...data} />
}

// ─── Render SVG once we have the data ─────────────────────────
function PriceChartSvg({
  entry,
  tp,
  sl,
  outcome,
  series,
  entryIdx,
  closeIdx,
}: PriceChartProps & ChartData) {
  const W = 560
  const H = 250
  const padX = 10
  const padT = 22
  const padB = 22
  const axisR = 70
  const plotR = W - axisR
  const n = series.length
  if (n < 2) return <div className="chart-empty">Onvoldoende prijsdata</div>

  const dec = entry > 50 ? 2 : 4
  const fmtLv = (v: number) => Number(v).toFixed(dec)

  const vals = [...series, entry, tp, sl]
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  const mg = (max - min) * 0.1 || 1
  min -= mg
  max += mg
  const range = max - min || 1
  const x = (i: number) => padX + (i / (n - 1)) * (plotR - padX * 2)
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB)

  const win = outcome === 'correct'
  const loss = outcome === 'incorrect'
  const open = outcome === 'pending'
  const C = { gold: '#c9a466', win: '#7e9b6f', loss: '#b9725f', neutral: '#8c93a6' }

  const pts = series.map((v, i) => [x(i), y(v)])
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L ${x(n - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`

  const eX = x(entryIdx)
  const cX = closeIdx != null ? x(closeIdx) : x(n - 1)
  const hitV = win ? tp : loss ? sl : null
  const hitC = win ? C.win : C.loss

  const levels = [
    { key: 'tp', v: tp, label: 'Take profit', color: C.win, active: win, entry: false },
    { key: 'entry', v: entry, label: 'Instap', color: C.gold, active: false, entry: true },
    { key: 'sl', v: sl, label: 'Stop', color: C.loss, active: loss, entry: false },
  ]

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Koersverloop met niveaus">
      <defs>
        <linearGradient id="fxd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a466" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#c9a466" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fxd-holdfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a466" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#c9a466" stopOpacity="0.015" />
        </linearGradient>
      </defs>

      <rect x={eX} y={padT} width={Math.max(0, cX - eX)} height={H - padT - padB} fill="url(#fxd-holdfill)" />

      {levels.map((l) => {
        const yy = y(l.v)
        return (
          <g key={l.key}>
            <line
              x1={padX}
              y1={yy}
              x2={plotR - padX}
              y2={yy}
              stroke={l.color}
              strokeWidth={l.active ? 1.7 : 1}
              strokeDasharray={l.entry ? 'none' : '4 4'}
              opacity={l.active ? 0.95 : l.entry ? 0.7 : 0.4}
            />
            <text
              x={plotR + 8}
              y={yy - 4}
              fill={l.color}
              fontSize="10"
              fontFamily="DM Sans"
              fontWeight="600"
              letterSpacing="0.05em"
              opacity={l.active ? 1 : 0.75}
            >
              {l.label.toUpperCase()}
              {l.active ? ' ·' : ''}
            </text>
            <text x={plotR + 8} y={yy + 10} fill={l.color} fontSize="11" fontFamily="DM Sans" opacity="0.7">
              {fmtLv(l.v)}
            </text>
          </g>
        )
      })}

      <path d={area} fill="url(#fxd-fill)" />
      <path d={line} fill="none" stroke="#c9a466" strokeWidth="1.6" strokeLinejoin="round" />

      <circle cx={eX} cy={y(entry)} r="5.5" fill="#080a0e" stroke={C.gold} strokeWidth="1.6" />
      <circle cx={eX} cy={y(entry)} r="2" fill={C.gold} />

      {!open && hitV !== null && (() => {
        const my = y(hitV)
        const ty = my < 42 ? my + 20 : my - 12
        return (
          <g>
            <line x1={cX} y1={padT} x2={cX} y2={H - padB} stroke={hitC} strokeWidth="1" strokeDasharray="2 3" opacity="0.55" />
            <circle cx={cX} cy={my} r="6" fill="#080a0e" stroke={hitC} strokeWidth="1.9" />
            <circle cx={cX} cy={my} r="2.4" fill={hitC} />
            <text x={cX} y={ty} textAnchor="middle" fill={hitC} fontSize="10" fontWeight="700" fontFamily="DM Sans" letterSpacing="0.07em">
              {win ? 'TP GERAAKT' : 'STOP GERAAKT'}
            </text>
          </g>
        )
      })()}
      {open && (
        <g>
          <circle cx={x(n - 1)} cy={y(series[n - 1])} r="5" fill="#080a0e" stroke={C.neutral} strokeWidth="1.6" />
          <text x={x(n - 1)} y={y(series[n - 1]) - 11} textAnchor="middle" fill={C.neutral} fontSize="10" fontWeight="600" fontFamily="DM Sans" letterSpacing="0.06em">
            OPEN
          </text>
        </g>
      )}
    </svg>
  )
}

// ─── Yahoo fetcher ────────────────────────────────────────────
async function fetchPriceData(pair: string, calledAt: string, closedAt: string | null): Promise<ChartData | null> {
  const symbol = YAHOO_SYMBOLS[pair]
  if (!symbol) return null

  const startMs = parseDate(calledAt)
  if (!startMs) return null
  const endMs = parseDate(closedAt) || Date.now()
  const pad = 3 * 86400000 // 3 day pad on each side
  const period1 = Math.floor((startMs - pad) / 1000)
  const period2 = Math.floor((endMs + pad) / 1000)

  // Through our own /api/yahoo-chart proxy — direct Yahoo calls regularly
  // hit CORS / rate-limit issues from the browser, the proxy is more reliable.
  const url = `/api/yahoo-chart?symbol=${encodeURIComponent(symbol)}&period1=${period1}&period2=${period2}&interval=1d`

  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Chart proxy ${r.status}`)
  const json = await r.json()
  const result = json?.chart?.result?.[0]
  if (!result) return null

  const timestamps: number[] = result.timestamp || []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || []

  const series: number[] = []
  const ts: number[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c == null) continue
    series.push(c)
    ts.push(timestamps[i] * 1000)
  }
  if (series.length < 2) return null

  const entryIdx = nearestIdx(ts, startMs)
  const closeIdx = closedAt ? nearestIdx(ts, endMs) : null

  return { series, entryIdx, closeIdx }
}

function nearestIdx(ts: number[], target: number): number {
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < ts.length; i++) {
    const d = Math.abs(ts[i] - target)
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  }
  return best
}

// "13 jun, 09:15" / ISO / "2026-06-13" → ms epoch
function parseDate(s: string | null | undefined): number | null {
  if (!s) return null
  // Try ISO first
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return t
  // Dutch short format "13 jun, 09:15"
  const m = s.match(/(\d{1,2})\s+(\w+)(?:,\s*(\d{1,2}):(\d{2}))?/i)
  if (!m) return null
  const months: Record<string, number> = {
    jan: 0, feb: 1, mrt: 2, mar: 2, apr: 3, mei: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
  }
  const day = parseInt(m[1])
  const mon = months[m[2].toLowerCase().slice(0, 3)]
  if (mon == null) return null
  const year = new Date().getFullYear()
  const hh = m[3] ? parseInt(m[3]) : 0
  const mm = m[4] ? parseInt(m[4]) : 0
  return new Date(year, mon, day, hh, mm).getTime()
}
