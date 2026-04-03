'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface RateData {
  currency: string
  country: string
  bank: string
  rate: number | null
  target: number | null
  flag: string
  source: string
  sourceUrl: string
  lastMove: string
  nextMeeting: string
  bias: string
}

interface RatesResponse {
  rates: RateData[]
  generatedAt: string
  count: number
  source?: string
  error?: string
}

interface Snapshot {
  snapshot_date: string
  currency: string
  rate: number
  target: number | null
  bias: string
  bank: string
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────
const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

const CHART_COLORS: Record<string, string> = {
  USD: '#3d6ea5',
  EUR: '#5a8ec8',
  GBP: '#c9a466',
  JPY: '#ef4444',
  CHF: '#22c55e',
  AUD: '#f59e0b',
  CAD: '#ec4899',
  NZD: '#8b5cf6',
}

// Fallback historical snapshots (monthly, first of month)
const FALLBACK_SNAPSHOTS: Snapshot[] = [
  { snapshot_date: '2024-05-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2024-05-01', currency: 'EUR', rate: 4.00, target: 3.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2024-05-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'BoE' },
  { snapshot_date: '2024-05-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2024-05-01', currency: 'CHF', rate: 1.50, target: 1.25, bias: 'verruimend', bank: 'SNB' },
  { snapshot_date: '2024-05-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-05-01', currency: 'CAD', rate: 5.00, target: 4.75, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2024-05-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  { snapshot_date: '2024-07-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2024-07-01', currency: 'EUR', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2024-07-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'BoE' },
  { snapshot_date: '2024-07-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2024-07-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'verruimend', bank: 'SNB' },
  { snapshot_date: '2024-07-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-07-01', currency: 'CAD', rate: 4.75, target: 4.50, bias: 'verruimend', bank: 'BoC' },
  { snapshot_date: '2024-07-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  { snapshot_date: '2024-09-01', currency: 'USD', rate: 5.33, target: 4.83, bias: 'verruimend', bank: 'Fed' },
  { snapshot_date: '2024-09-01', currency: 'EUR', rate: 3.65, target: 3.50, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2024-09-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2024-09-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2024-09-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'verruimend', bank: 'SNB' },
  { snapshot_date: '2024-09-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-09-01', currency: 'CAD', rate: 4.50, target: 4.25, bias: 'verruimend', bank: 'BoC' },
  { snapshot_date: '2024-09-01', currency: 'NZD', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'RBNZ' },
  { snapshot_date: '2024-11-01', currency: 'USD', rate: 4.58, target: 4.33, bias: 'verruimend', bank: 'Fed' },
  { snapshot_date: '2024-11-01', currency: 'EUR', rate: 3.25, target: 3.00, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2024-11-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2024-11-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2024-11-01', currency: 'CHF', rate: 1.00, target: 0.50, bias: 'verruimend', bank: 'SNB' },
  { snapshot_date: '2024-11-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-11-01', currency: 'CAD', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'BoC' },
  { snapshot_date: '2024-11-01', currency: 'NZD', rate: 4.75, target: 4.25, bias: 'verruimend', bank: 'RBNZ' },
  { snapshot_date: '2025-01-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2025-01-01', currency: 'EUR', rate: 3.00, target: 2.75, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2025-01-01', currency: 'GBP', rate: 4.75, target: 4.50, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2025-01-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2025-01-01', currency: 'CHF', rate: 0.50, target: 0.25, bias: 'verruimend', bank: 'SNB' },
  { snapshot_date: '2025-01-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2025-01-01', currency: 'CAD', rate: 3.25, target: 3.00, bias: 'verruimend', bank: 'BoC' },
  { snapshot_date: '2025-01-01', currency: 'NZD', rate: 4.25, target: 4.00, bias: 'verruimend', bank: 'RBNZ' },
  { snapshot_date: '2025-03-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2025-03-01', currency: 'EUR', rate: 2.50, target: 2.25, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2025-03-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2025-03-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2025-03-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-03-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'verruimend', bank: 'RBA' },
  { snapshot_date: '2025-03-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'verruimend', bank: 'BoC' },
  { snapshot_date: '2025-03-01', currency: 'NZD', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'RBNZ' },
  { snapshot_date: '2025-05-01', currency: 'USD', rate: 4.08, target: 3.83, bias: 'verruimend', bank: 'Fed' },
  { snapshot_date: '2025-05-01', currency: 'EUR', rate: 2.25, target: 2.00, bias: 'verruimend', bank: 'ECB' },
  { snapshot_date: '2025-05-01', currency: 'GBP', rate: 4.25, target: 4.00, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2025-05-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2025-05-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-05-01', currency: 'AUD', rate: 3.85, target: 3.60, bias: 'verruimend', bank: 'RBA' },
  { snapshot_date: '2025-05-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2025-05-01', currency: 'NZD', rate: 3.25, target: 3.00, bias: 'verruimend', bank: 'RBNZ' },
  { snapshot_date: '2025-07-01', currency: 'USD', rate: 3.83, target: 3.58, bias: 'verruimend', bank: 'Fed' },
  { snapshot_date: '2025-07-01', currency: 'EUR', rate: 2.25, target: 2.00, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2025-07-01', currency: 'GBP', rate: 4.00, target: 3.75, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2025-07-01', currency: 'JPY', rate: 0.75, target: 1.00, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2025-07-01', currency: 'CHF', rate: 0.00, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-07-01', currency: 'AUD', rate: 3.85, target: 3.60, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2025-07-01', currency: 'CAD', rate: 2.50, target: 2.25, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2025-07-01', currency: 'NZD', rate: 3.00, target: 2.75, bias: 'verruimend', bank: 'RBNZ' },
  { snapshot_date: '2025-10-01', currency: 'USD', rate: 3.58, target: 3.33, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2025-10-01', currency: 'EUR', rate: 1.90, target: 1.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2025-10-01', currency: 'GBP', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2025-10-01', currency: 'JPY', rate: 1.00, target: 1.25, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2025-10-01', currency: 'CHF', rate: 0.00, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-10-01', currency: 'AUD', rate: 3.60, target: 3.35, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2025-10-01', currency: 'CAD', rate: 2.25, target: 2.00, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2025-10-01', currency: 'NZD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'RBNZ' },
  { snapshot_date: '2026-01-01', currency: 'USD', rate: 3.75, target: 3.50, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2026-01-01', currency: 'EUR', rate: 1.90, target: 1.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2026-01-01', currency: 'GBP', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2026-01-01', currency: 'JPY', rate: 1.00, target: 1.25, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2026-01-01', currency: 'CHF', rate: 0.00, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2026-01-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'verruimend', bank: 'RBA' },
  { snapshot_date: '2026-01-01', currency: 'CAD', rate: 2.25, target: 2.00, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2026-01-01', currency: 'NZD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'RBNZ' },
  { snapshot_date: '2026-04-01', currency: 'USD', rate: 3.75, target: 3.50, bias: 'afwachtend', bank: 'Fed' },
  { snapshot_date: '2026-04-01', currency: 'EUR', rate: 1.90, target: 1.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2026-04-01', currency: 'GBP', rate: 3.75, target: 3.50, bias: 'verruimend', bank: 'BoE' },
  { snapshot_date: '2026-04-01', currency: 'JPY', rate: 1.00, target: 1.25, bias: 'verkrappend', bank: 'BoJ' },
  { snapshot_date: '2026-04-01', currency: 'CHF', rate: 0.00, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2026-04-01', currency: 'AUD', rate: 3.85, target: 3.60, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2026-04-01', currency: 'CAD', rate: 2.25, target: 2.00, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2026-04-01', currency: 'NZD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'RBNZ' },
]

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function flagEmoji(code: string) {
  if (!code) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

function biasLabel(bias: string): { text: string; color: string } {
  if (!bias) return { text: '—', color: 'text-text-dim' }
  const b = bias.toLowerCase()
  if (b.includes('verkrappend')) return { text: 'Verkrappend', color: 'text-red-400' }
  if (b.includes('verruimend')) return { text: 'Verruimend', color: 'text-green-400' }
  return { text: 'Afwachtend', color: 'text-amber-400' }
}

function biasIcon(bias: string) {
  const b = bias.toLowerCase()
  if (b.includes('verkrappend')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
  if (b.includes('verruimend')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
  } catch {
    return dateStr
  }
}

function wasRecentlyChanged(lastMove: string): boolean {
  if (!lastMove) return false
  const lower = lastMove.toLowerCase()
  // Check if it mentions recent months
  const recentMonths = ['maart 2026', 'februari 2026', 'januari 2026', 'march 2026', 'february 2026', 'january 2026']
  return recentMonths.some(m => lower.includes(m))
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────
function DataFreshnessBar({ generatedAt, source }: { generatedAt: string; source?: string }) {
  const time = new Date(generatedAt)
  const ago = Math.round((Date.now() - time.getTime()) / 60000)
  const fresh = ago < 10
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2 rounded-full bg-bg-card border border-border text-xs">
      <span className={`w-2 h-2 rounded-full ${fresh ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
      <span className="text-text-dim">
        {fresh ? 'Live' : `${ago} min geleden`} &middot; {time.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
      {source && source !== 'fallback' && (
        <span className="text-text-dim">&middot; via {source}</span>
      )}
      {source === 'fallback' && (
        <span className="text-amber-400">&middot; fallback data</span>
      )}
    </div>
  )
}

function RateCard({ item, onClick }: { item: RateData; onClick: () => void }) {
  const { text: biasText, color: biasColor } = biasLabel(item.bias)
  const recently = wasRecentlyChanged(item.lastMove)
  const isHold = item.lastMove?.toLowerCase().includes('ongewijzigd') || item.lastMove?.toLowerCase().includes('hold')

  return (
    <button
      onClick={onClick}
      className={`relative p-4 sm:p-5 rounded-xl bg-bg-card border text-left transition-all hover:border-accent-light/40 hover:bg-bg-hover group ${
        recently && !isHold ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border'
      }`}
    >
      {recently && !isHold && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-accent text-white text-[9px] font-bold uppercase tracking-wider">
          Recent
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{flagEmoji(item.flag)}</span>
          <div>
            <span className="text-xs font-mono text-text-muted">{item.currency}</span>
            <p className="text-[11px] text-text-dim leading-tight">{item.country}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${biasColor}`}>
          {biasIcon(item.bias)}
          <span className="text-[10px] font-medium">{biasText}</span>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-2xl font-display font-semibold text-heading">
          {item.rate !== null ? `${item.rate.toFixed(2)}%` : '—'}
        </p>
        {item.target !== null && (
          <p className="text-[11px] text-text-dim mt-0.5">
            Target: {item.target.toFixed(2)}%
            {item.rate !== null && (
              <span className={item.rate > item.target ? 'text-amber-400' : item.rate < item.target ? 'text-blue-400' : 'text-text-dim'}>
                {' '}({item.rate > item.target ? '+' : ''}{(item.rate - item.target).toFixed(2)})
              </span>
            )}
          </p>
        )}
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-text-dim">Laatste actie</span>
          <span className="text-text-muted text-right max-w-[60%] truncate">{item.lastMove || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-dim">Volgende</span>
          <span className="text-text-muted">{item.nextMeeting || '—'}</span>
        </div>
      </div>

      <p className="text-[10px] text-text-dim mt-2 truncate">{item.bank}</p>
    </button>
  )
}

function RateComparisonChart({
  snapshots,
  selectedCurrencies,
  rates,
}: {
  snapshots: Snapshot[]
  selectedCurrencies: string[]
  rates: RateData[]
}) {
  // Build chart data from snapshots
  const chartData = useMemo(() => {
    if (!selectedCurrencies.length) return null

    // Get all unique dates, sorted
    const allDates = [...new Set(snapshots.map(s => s.snapshot_date))].sort()

    const datasets = selectedCurrencies.map(ccy => {
      const ccySnapshots = snapshots.filter(s => s.currency === ccy)
      const rateMap = new Map(ccySnapshots.map(s => [s.snapshot_date, s.rate]))

      // For each date, find the rate (or carry forward)
      let lastRate: number | null = null
      const data = allDates.map(date => {
        const r = rateMap.get(date)
        if (r !== undefined) lastRate = r
        return lastRate
      })

      return {
        label: ccy,
        data,
        borderColor: CHART_COLORS[ccy] || '#888',
        backgroundColor: (CHART_COLORS[ccy] || '#888') + '20',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.2,
        fill: false,
        stepped: 'before' as const,
      }
    })

    return {
      labels: allDates.map(d => formatShortDate(d)),
      datasets,
    }
  }, [snapshots, selectedCurrencies])

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#9ea3b8',
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 },
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 18, 25, 0.95)',
        titleColor: '#e8eaf0',
        bodyColor: '#a0a8be',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#5a6178', font: { size: 10 }, maxRotation: 45, minRotation: 0 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#5a6178',
          font: { size: 10 },
          callback: (val) => `${val}%`,
        },
        title: {
          display: true,
          text: 'Beleidsrente (%)',
          color: '#5a6178',
          font: { size: 11 },
        },
      },
    },
  }), [])

  if (!chartData || !selectedCurrencies.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-dim text-sm">
        Selecteer minimaal 1 valuta om de grafiek te tonen.
      </div>
    )
  }

  return (
    <div className="h-[350px] sm:h-[400px]">
      <Line data={chartData} options={options} />
    </div>
  )
}

function RateDifferentialView({
  snapshots,
  selectedCurrencies,
}: {
  snapshots: Snapshot[]
  selectedCurrencies: string[]
}) {
  const chartData = useMemo(() => {
    if (selectedCurrencies.length < 2) return null

    const [ccyA, ccyB] = selectedCurrencies
    const allDates = [...new Set(snapshots.map(s => s.snapshot_date))].sort()

    const mapA = new Map(snapshots.filter(s => s.currency === ccyA).map(s => [s.snapshot_date, s.rate]))
    const mapB = new Map(snapshots.filter(s => s.currency === ccyB).map(s => [s.snapshot_date, s.rate]))

    let lastA: number | null = null
    let lastB: number | null = null
    const diffs = allDates.map(date => {
      const a = mapA.get(date)
      const b = mapB.get(date)
      if (a !== undefined) lastA = a
      if (b !== undefined) lastB = b
      if (lastA !== null && lastB !== null) return lastA - lastB
      return null
    })

    return {
      labels: allDates.map(d => formatShortDate(d)),
      datasets: [{
        label: `${ccyA} - ${ccyB} spread`,
        data: diffs,
        borderColor: '#c9a466',
        backgroundColor: 'rgba(201, 164, 102, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.2,
        fill: true,
        stepped: 'before' as const,
      }],
    }
  }, [snapshots, selectedCurrencies])

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 18, 25, 0.95)',
        titleColor: '#e8eaf0',
        bodyColor: '#a0a8be',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y
            return val !== null ? `Spread: ${val > 0 ? '+' : ''}${val.toFixed(2)}%` : 'N/A'
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#5a6178', font: { size: 10 }, maxRotation: 45 },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#5a6178',
          font: { size: 10 },
          callback: (val) => `${Number(val) > 0 ? '+' : ''}${val}%`,
        },
        title: {
          display: true,
          text: 'Renteverschil (%)',
          color: '#5a6178',
          font: { size: 11 },
        },
      },
    },
  }), [])

  if (!chartData || selectedCurrencies.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-text-dim text-sm">
        Selecteer minimaal 2 valuta&apos;s om het renteverschil te tonen.
      </div>
    )
  }

  const currentSpread = chartData.datasets[0].data.filter(d => d !== null).pop()

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flagEmoji(selectedCurrencies[0] === 'EUR' ? 'EU' : selectedCurrencies[0].slice(0, 2))}</span>
          <span className="text-sm font-semibold text-heading">{selectedCurrencies[0]}</span>
        </div>
        <span className="text-text-dim text-sm">vs</span>
        <div className="flex items-center gap-2">
          <span className="text-lg">{flagEmoji(selectedCurrencies[1] === 'EUR' ? 'EU' : selectedCurrencies[1].slice(0, 2))}</span>
          <span className="text-sm font-semibold text-heading">{selectedCurrencies[1]}</span>
        </div>
        {currentSpread !== null && currentSpread !== undefined && (
          <div className="ml-auto">
            <span className="text-xs text-text-dim">Huidig verschil: </span>
            <span className={`text-sm font-semibold ${Number(currentSpread) > 0 ? 'text-green-400' : Number(currentSpread) < 0 ? 'text-red-400' : 'text-text-muted'}`}>
              {Number(currentSpread) > 0 ? '+' : ''}{Number(currentSpread).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      <div className="h-[200px] sm:h-[250px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}

function HistoricalTimeline({
  snapshots,
  currency,
  rates,
}: {
  snapshots: Snapshot[]
  currency: string
  rates: RateData[]
}) {
  const ccySnapshots = useMemo(() => {
    return snapshots
      .filter(s => s.currency === currency)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  }, [snapshots, currency])

  // Detect changes: where rate differs from previous snapshot
  const changes = useMemo(() => {
    const result: { date: string; prevRate: number | null; newRate: number; change: number }[] = []
    for (let i = 0; i < ccySnapshots.length; i++) {
      const prev = i > 0 ? ccySnapshots[i - 1].rate : null
      const curr = ccySnapshots[i].rate
      if (prev !== null && curr !== prev) {
        result.push({
          date: ccySnapshots[i].snapshot_date,
          prevRate: prev,
          newRate: curr,
          change: curr - prev,
        })
      }
    }
    return result
  }, [ccySnapshots])

  const currentRate = rates.find(r => r.currency === currency)
  const nextMeeting = currentRate?.nextMeeting

  if (!changes.length) {
    return <p className="text-text-dim text-xs">Geen wijzigingen in de beschikbare historie.</p>
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {changes.map((c, i) => {
        const isLatest = i === changes.length - 1
        const isCut = c.change < 0
        return (
          <div
            key={c.date}
            className={`flex-shrink-0 p-3 rounded-lg border text-center min-w-[110px] ${
              isLatest
                ? 'bg-accent/10 border-accent/30'
                : 'bg-bg-card border-border'
            }`}
          >
            <p className="text-[10px] text-text-dim mb-1">{formatShortDate(c.date)}</p>
            <p className={`text-xs font-semibold ${isCut ? 'text-green-400' : 'text-red-400'}`}>
              {isCut ? '' : '+'}{(c.change * 100).toFixed(0)}bp
            </p>
            <p className="text-sm font-display font-semibold text-heading mt-0.5">
              {c.newRate.toFixed(2)}%
            </p>
            <p className="text-[10px] text-text-dim mt-0.5">
              van {c.prevRate?.toFixed(2)}%
            </p>
            {isLatest && (
              <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent-light font-medium">
                Laatste
              </span>
            )}
          </div>
        )
      })}
      {/* Next meeting placeholder */}
      {nextMeeting && (
        <div className="flex-shrink-0 p-3 rounded-lg border border-dashed border-border text-center min-w-[110px] opacity-60">
          <p className="text-[10px] text-text-dim mb-1">Volgende</p>
          <p className="text-xs text-text-muted">{nextMeeting}</p>
          <p className="text-sm font-display text-text-dim mt-0.5">TBD</p>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────
export default function RentePage() {
  const [data, setData] = useState<RatesResponse | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(FALLBACK_SNAPSHOTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(['USD', 'EUR'])
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'chart' | 'table'>('overview')
  const fetchedRef = useRef(false)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ratesRes, snapshotsRes] = await Promise.all([
        fetch('/api/rates'),
        fetch('/api/cb-snapshots').catch(() => null),
      ])
      const ratesJson = await ratesRes.json()
      if (!ratesRes.ok || ratesJson.error) throw new Error(ratesJson.error || `API error: ${ratesRes.status}`)
      setData(ratesJson)

      if (snapshotsRes?.ok) {
        const snapshotsJson = await snapshotsRes.json()
        if (snapshotsJson.snapshots?.length > 0) {
          setSnapshots(snapshotsJson.snapshots)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchRates()
    }
  }, [fetchRates])

  const toggleCurrency = useCallback((ccy: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(ccy)
        ? prev.filter(c => c !== ccy)
        : [...prev, ccy]
    )
  }, [])

  const majors = useMemo(() =>
    data?.rates.filter(r => MAJOR_CURRENCIES.includes(r.currency)) || []
  , [data])

  const others = useMemo(() =>
    data?.rates.filter(r => !MAJOR_CURRENCIES.includes(r.currency)) || []
  , [data])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
          Rentetarieven Centrale Banken
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-xl mx-auto mb-5">
          Overzicht van de actuele beleidsrentes, historisch verloop en renteverschillen
          van de belangrijkste centrale banken wereldwijd.
        </p>

        {/* Data freshness */}
        {data && (
          <DataFreshnessBar generatedAt={data.generatedAt} source={data.source} />
        )}
      </div>

      {/* Section tabs */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {(['overview', 'chart', 'table'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === tab
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-heading hover:bg-bg-hover'
            }`}
          >
            {tab === 'overview' ? 'Overzicht' : tab === 'chart' ? 'Vergelijken' : 'Tabel'}
          </button>
        ))}
        <button
          onClick={fetchRates}
          disabled={loading}
          className="ml-3 p-2 rounded-lg text-text-dim hover:text-heading hover:bg-bg-hover transition-colors disabled:opacity-50"
          title="Ververs data"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={loading ? 'animate-spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="text-center py-20 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Rentetarieven ophalen...</p>
        </div>
      )}

      {data && (
        <>
          {/* ═══════════ SECTION: Overview ═══════════ */}
          {activeSection === 'overview' && (
            <div className="space-y-10">
              {/* Major rate cards */}
              <div>
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                  Belangrijkste Centrale Banken
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {majors.map(item => (
                    <RateCard
                      key={item.currency}
                      item={item}
                      onClick={() => setExpandedTimeline(
                        expandedTimeline === item.currency ? null : item.currency
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Historical timeline (expanded) */}
              {expandedTimeline && (
                <div className="rounded-xl bg-bg-card border border-border p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
                      <span className="text-xl">{flagEmoji(data.rates.find(r => r.currency === expandedTimeline)?.flag || '')}</span>
                      {expandedTimeline} Rentehistorie
                    </h3>
                    <button
                      onClick={() => setExpandedTimeline(null)}
                      className="text-text-dim hover:text-heading transition-colors p-1"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <HistoricalTimeline
                    snapshots={snapshots}
                    currency={expandedTimeline}
                    rates={data.rates}
                  />
                </div>
              )}

              {/* Upcoming meetings from rate data */}
              {data.rates.some(r => r.nextMeeting) && (
                <div>
                  <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Volgende Rentebeslissingen
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {majors.filter(r => r.nextMeeting).map(r => (
                      <div key={r.currency} className="p-3 rounded-lg bg-bg-card border border-border text-center">
                        <span className="text-lg">{flagEmoji(r.flag)}</span>
                        <p className="text-xs font-semibold text-heading mt-1">{r.currency}</p>
                        <p className="text-[10px] text-text-dim mt-0.5">{r.nextMeeting}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other currencies compact */}
              {others.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Overige Landen
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {others.map(item => (
                      <a
                        key={item.currency}
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-lg bg-bg-card border border-border hover:border-border-light transition-colors flex items-center gap-3"
                      >
                        <span className="text-xl">{flagEmoji(item.flag)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-muted">{item.currency}</span>
                            <span className="text-sm font-semibold text-heading">
                              {item.rate !== null ? `${item.rate}%` : '—'}
                            </span>
                          </div>
                          <p className="text-[10px] text-text-dim truncate">{item.country}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ SECTION: Chart / Compare ═══════════ */}
          {activeSection === 'chart' && (
            <div className="space-y-6">
              {/* Currency selector */}
              <div className="rounded-xl bg-bg-card border border-border p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4">
                  Selecteer valuta&apos;s om te vergelijken
                </h2>
                <div className="flex flex-wrap gap-2">
                  {MAJOR_CURRENCIES.map(ccy => {
                    const rateInfo = data.rates.find(r => r.currency === ccy)
                    const active = selectedCurrencies.includes(ccy)
                    return (
                      <button
                        key={ccy}
                        onClick={() => toggleCurrency(ccy)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          active
                            ? 'border-accent bg-accent/15 text-heading'
                            : 'border-border bg-bg-card text-text-muted hover:border-border-light hover:text-heading'
                        }`}
                      >
                        <span className="text-base">{flagEmoji(rateInfo?.flag || '')}</span>
                        <span className="font-mono text-xs">{ccy}</span>
                        {rateInfo?.rate !== null && rateInfo?.rate !== undefined && (
                          <span className="text-[11px] text-text-dim">{rateInfo.rate.toFixed(2)}%</span>
                        )}
                        {active && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[ccy] }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rate comparison chart */}
              <div className="rounded-xl bg-bg-card border border-border p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Renteverloop
                </h2>
                <RateComparisonChart
                  snapshots={snapshots}
                  selectedCurrencies={selectedCurrencies}
                  rates={data.rates}
                />
              </div>

              {/* Rate differential */}
              <div className="rounded-xl bg-bg-card border border-border p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                  </svg>
                  Renteverschil (Spread)
                </h2>
                {selectedCurrencies.length >= 2 ? (
                  <RateDifferentialView
                    snapshots={snapshots}
                    selectedCurrencies={selectedCurrencies.slice(0, 2)}
                  />
                ) : (
                  <p className="text-text-dim text-sm py-8 text-center">
                    Selecteer minimaal 2 valuta&apos;s hierboven om het renteverschil te zien.
                    Het verschil wordt berekend tussen de eerste twee geselecteerde valuta&apos;s.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ SECTION: Table ═══════════ */}
          {activeSection === 'table' && (
            <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Land</th>
                      <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Centrale Bank</th>
                      <th className="text-right px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Rente</th>
                      <th className="text-right px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Target</th>
                      <th className="text-center px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Bias</th>
                      <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Laatste actie</th>
                      <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Volgende</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Bron</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...majors, ...others].map(item => {
                      const { text: biasText, color: biasColor } = biasLabel(item.bias)
                      return (
                        <tr key={item.currency} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                          <td className="px-3 sm:px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{flagEmoji(item.flag)}</span>
                              <div>
                                <span className="text-sm text-heading">{item.country}</span>
                                <span className="ml-2 text-xs font-mono text-text-dim">{item.currency}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-5 py-3 text-sm text-text-muted hidden md:table-cell">{item.bank}</td>
                          <td className="px-3 sm:px-5 py-3 text-right">
                            <span className="text-sm font-semibold text-heading">
                              {item.rate !== null ? `${item.rate}%` : '—'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-3 text-right hidden sm:table-cell">
                            <span className="text-sm text-text-dim">
                              {item.target !== null ? `${item.target}%` : '—'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-3 text-center hidden sm:table-cell">
                            <span className={`inline-flex items-center gap-1 text-xs ${biasColor}`}>
                              {biasIcon(item.bias)}
                              {biasText}
                            </span>
                          </td>
                          <td className="px-3 sm:px-5 py-3 text-xs text-text-dim hidden lg:table-cell">{item.lastMove || '—'}</td>
                          <td className="px-3 sm:px-5 py-3 text-xs text-text-dim hidden lg:table-cell">{item.nextMeeting || '—'}</td>
                          <td className="px-3 py-3 text-center">
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-accent-light/60 hover:text-accent-light transition-colors"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-8 p-4 rounded-xl bg-bg-card border border-border">
            <p className="text-xs text-text-dim text-center">
              Rentetarieven worden opgehaald uit onze centrale bank database en waar mogelijk aangevuld met live data.
              Raadpleeg de officiële websites van de centrale banken voor de meest actuele informatie.
              Dit is geen financieel advies.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
