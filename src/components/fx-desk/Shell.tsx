'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import './styles.css'
import { Icons } from './icons'
import { TOOL_CONFIG, type ShellHowTo, type ShellMethodBlock, type ShellToolConfig } from './shell-config'

// ─── HowTo popover ────────────────────────────────────────────
function HowTo({ info }: { info: ShellHowTo }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.howto-wrap')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="howto-wrap">
      <button className="howto-btn" onClick={() => setOpen((o) => !o)}>
        <Icons.Help size={15} />
        Hoe werkt dit?
      </button>
      {open && (
        <div className="howto-pop">
          <h4>{info.title}</h4>
          <p>{info.body}</p>
          <ol>
            {info.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Methodology accordion (bottom shell) ─────────────────────
function Methodology({ blocks }: { blocks: ShellMethodBlock[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`accordion${open ? ' open' : ''}`}>
      <button className="accordion-head" onClick={() => setOpen((o) => !o)}>
        <span className="left">
          <Icons.Layers size={17} style={{ color: 'var(--gold)' }} />
          <span className="ttl">Onderbouwing en methodiek</span>
          <span className="hint">Hoe deze cijfers tot stand komen</span>
        </span>
        <Icons.Chevron size={18} className="chev" />
      </button>
      {open && (
        <div className="accordion-body">
          <div className="cols">
            {blocks.map((b, i) => (
              <div className="method" key={i}>
                <h5>{b.h}</h5>
                {b.type === 'p' ? (
                  <p>{b.text}</p>
                ) : (
                  <ul>
                    {(b.items || []).map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Top brand bar + tool switcher ────────────────────────────
// TODO(nav-consolidation): de bestaande tools-sub-nav in
// src/app/tools/layout.tsx en deze Shell-switcher leven nu naast
// elkaar (twee niveaus navigatie). Bij de definitieve cleanup-ronde
// samenvoegen: óf de Shell-switcher vervalt en de tools-sub-nav neemt
// het over, óf andersom. Niet in deze frontend-rebuild-ronde.
function BrandBar({ activeTool }: { activeTool: 'briefing' | 'execution' }) {
  return (
    <div className="brandbar">
      <div className="brand">
        <span className="brand-mark">
          <Icons.Pulse size={15} />
        </span>
        <span className="brand-name">Sanders Capital</span>
        <span className="brand-sub">FX Desk</span>
      </div>
      <div className="toolswitch">
        {(Object.values(TOOL_CONFIG) as ShellToolConfig[]).map((t) => {
          const I = t.key === 'briefing' ? Icons.Briefing : Icons.Engine
          return (
            <Link key={t.key} href={t.href} className={activeTool === t.key ? 'active' : ''}>
              <I size={15} />
              {t.key === 'briefing' ? 'Briefing' : 'Execution Engine'}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Footnote ─────────────────────────────────────────────────
function FootNote({ date }: { date?: string }) {
  return (
    <div className="foot">
      <span className="l">Sanders Capital · FX Desk{date ? ` · ${date}` : ''}</span>
      <span className="r">
        <Icons.Dot size={9} style={{ color: 'var(--gold)' }} />
        Visuele weergave · geen handelsadvies
      </span>
    </div>
  )
}

// ─── Main shell wrapper ───────────────────────────────────────
export type ShellProps = {
  tool: 'briefing' | 'execution'
  activeTab: string
  onTabChange: (tabId: string) => void
  date?: string
  hideMethodology?: boolean
  children: ReactNode
}

export function Shell({ tool, activeTab, onTabChange, date, hideMethodology, children }: ShellProps) {
  const cfg = TOOL_CONFIG[tool]

  return (
    <div className="fx-desk">
      <div className="app">
        <BrandBar activeTool={tool} />

        <div className="shell-head">
          <div>
            <h1 className="shell-title">{cfg.title}</h1>
            <p className="shell-oneline">{cfg.oneline}</p>
          </div>
          <HowTo info={cfg.howto} />
        </div>

        <div className="tabs">
          {cfg.tabs.map((t) => (
            <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => onTabChange(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div key={tool + activeTab}>{children}</div>

        {!hideMethodology && <Methodology blocks={cfg.method} />}

        <FootNote date={date} />
      </div>
    </div>
  )
}
