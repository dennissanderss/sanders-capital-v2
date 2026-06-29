'use client'

import { useState, type ReactNode } from 'react'

// Mini-tooltip met een (?) dat bij hover/focus een korte uitleg toont.
export function Tip({ text }: { text: string }) {
  return (
    <span className="fb-tip" tabIndex={0} role="button" aria-label={text}>
      <span className="fb-tip-q">?</span>
      <span className="fb-tip-pop">{text}</span>
    </span>
  )
}

// Inklapbaar "Hoe lees ik dit?"-paneel. Onthoudt open/dicht per tab niet —
// bewust simpel; standaard dicht zodat het niet in de weg zit.
export function HowToRead({ title = 'Hoe lees ik dit?', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`fb-howto${open ? ' open' : ''}`}>
      <button className="fb-howto-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="fb-howto-i">i</span>
        {title}
        <span className="fb-howto-chev">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="fb-howto-body">{children}</div>}
    </div>
  )
}
