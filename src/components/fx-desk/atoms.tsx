'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Icons } from './icons'

// ─── number formatter ─────────────────────────────────────────
export function fmt(v: number | null | undefined, d = 4): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(d)
}

// ─── direction tag (long/short) ───────────────────────────────
export function DirTag({ dir }: { dir: 'long' | 'short' }) {
  const A = dir === 'long' ? Icons.Arrow : Icons.ArrowDown
  return (
    <span className={`dir ${dir}`}>
      <A size={11} />
      {dir === 'long' ? 'Long' : 'Short'}
    </span>
  )
}

// ─── status pill (ready / watch) ──────────────────────────────
export function StatusPill({ status }: { status: 'ready' | 'watch' }) {
  if (status === 'ready') {
    return (
      <span className="status ready">
        <span className="sd" />
        Entry-ready
      </span>
    )
  }
  return (
    <span className="status watch">
      <span className="sd" />
      Watchlist
    </span>
  )
}

// ─── outcome chip (list view) ─────────────────────────────────
export type Outcome = 'correct' | 'incorrect' | 'pending'

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  if (outcome === 'correct') return <span className="outcome correct"><Icons.Check size={12} />Correct</span>
  if (outcome === 'incorrect') return <span className="outcome incorrect"><Icons.Cross size={12} />Incorrect</span>
  return <span className="outcome pending"><Icons.Clock size={12} />Pending</span>
}

// ─── result chip (large, for detail header) ───────────────────
export function ResultChip({ outcome }: { outcome: Outcome }) {
  if (outcome === 'correct') return <span className="outcome correct lg"><Icons.Check size={13} />Win</span>
  if (outcome === 'incorrect') return <span className="outcome incorrect lg"><Icons.Cross size={13} />Loss</span>
  return <span className="outcome pending lg"><Icons.Dot size={10} />Open</span>
}

// ─── zone label with optional live tick + info tooltip ────────
export function ZoneLabel({
  children,
  live,
  info,
}: {
  children: ReactNode
  live?: boolean
  info?: ReactNode
}) {
  return (
    <div className="zone-label">
      {live && <span className="tick" />}
      <span className="mono-label">{children}</span>
      {info || null}
      <span className="rule" />
    </div>
  )
}

// ─── info tooltip (hover + click) ─────────────────────────────
type InfoTipProps = {
  title?: string
  pos?: 'bottom' | 'top'
  align?: 'center' | 'left' | 'right'
  children: ReactNode
}

export function InfoTip({ pos = 'bottom', align = 'center', title, children }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.infotip')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <span className={`infotip ${pos} a-${align}${open ? ' open' : ''}`}>
      <button
        className="ibtn"
        aria-label="Uitleg"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <Icons.Info size={14} />
      </button>
      <span className="tip" onClick={(e) => e.stopPropagation()}>
        {title && <h6>{title}</h6>}
        {children}
      </span>
    </span>
  )
}

// ─── reusable accordion (matches bottom-shell styling) ────────
export function Accordion({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`accordion${open ? ' open' : ''}`}>
      <button className="accordion-head" onClick={() => setOpen((o) => !o)}>
        <span className="left">
          <Icons.Layers size={17} style={{ color: 'var(--gold)' }} />
          <span className="ttl">{title}</span>
          {hint && <span className="hint">{hint}</span>}
        </span>
        <Icons.Chevron size={18} className="chev" />
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}
