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

// Korte rondleiding die de eerste keer door de tool loopt.
export interface TourStep { title: string; text: string; tab?: string; lens?: string }
export function Tour({ steps, index, onNext, onPrev, onClose }: {
  steps: TourStep[]; index: number; onNext: () => void; onPrev: () => void; onClose: () => void
}) {
  const step = steps[index]
  const last = index === steps.length - 1
  return (
    <div className="fb-tour-overlay" role="dialog" aria-modal="true">
      <div className="fb-tour-card">
        <div className="fb-tour-step">Rondleiding · {index + 1}/{steps.length}</div>
        <div className="fb-tour-title">{step.title}</div>
        <p className="fb-tour-text">{step.text}</p>
        <div className="fb-tour-actions">
          <button className="fb-tour-skip" onClick={onClose}>Overslaan</button>
          <div className="fb-tour-nav">
            {index > 0 && <button className="fb-tour-btn ghost" onClick={onPrev}>Vorige</button>}
            <button className="fb-tour-btn" onClick={last ? onClose : onNext}>{last ? 'Klaar' : 'Volgende'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Vaste, visuele uitleg bovenaan de tool: in 3 stappen wat een call is en
// wanneer hij juist of fout is. Standaard zichtbaar (kan ingeklapt worden).
export function HowItWorks() {
  // Standaard ingeklapt — houdt de bovenkant strak (dashboard i.p.v.
  // handleiding). De rondleiding vangt de eerste kennismaking op.
  const [open, setOpen] = useState(false)
  return (
    <div className="fb-hiw">
      <div className="fb-hiw-bar">
        <span className="fb-hiw-title">Zo werkt deze tool</span>
        <button className="fb-hiw-toggle" onClick={() => setOpen((o) => !o)}>{open ? 'verbergen' : 'tonen'}</button>
      </div>
      {open && (
        <div className="fb-hiw-steps">
          <div className="fb-hiw-step">
            <span className="fb-hiw-num">1</span>
            <div className="fb-hiw-h">Een richting per paar</div>
            <p>De fundamentals (rente, centrale banken, nieuws) geven per valutapaar een <b>bias</b>:</p>
            <div className="fb-hiw-chips">
              <span className="fb-chip long">LONG</span> omhoog &nbsp; <span className="fb-chip short">SHORT</span> omlaag
            </div>
            <p className="fb-hiw-sub">Een <b>call</b> = een paar met zo&apos;n duidelijke richting.</p>
          </div>

          <div className="fb-hiw-step">
            <span className="fb-hiw-num">2</span>
            <div className="fb-hiw-h">Bias · Timing · Zekerheid</div>
            <p><b>Bias</b> (0–10) = hoe sterk de fundamentals de richting steunen. <b>Timing</b> (0–10) = hoe gunstig dít instapmoment is (dip/rally, marktbevestiging, geen cijfers op komst). <b>Zekerheid</b> = de mix; de sterkste calls staan bovenaan.</p>
            <div className="fb-hiw-scale">
              <span className="z zwak">zwak<br />0–5</span>
              <span className="z matig">matig<br />5–7</span>
              <span className="z sterk">sterk<br />7–10</span>
            </div>
            <p className="fb-hiw-sub">Sterke bias + slechte timing? Dan wil je de call <b>zien</b>, maar wachten op een beter moment.</p>
          </div>

          <div className="fb-hiw-step">
            <span className="fb-hiw-num">3</span>
            <div className="fb-hiw-h">Klopte de richting?</div>
            <p>We checken of de <b>slotkoers</b> de voorspelde kant op eindigt — op 1, 3, 5, 10 en 20 dagen.</p>
            <div className="fb-hiw-vd win">✓ JUIST — koers ging de voorspelde kant op</div>
            <div className="fb-hiw-vd loss">✗ ONJUIST — koers ging de andere kant op</div>
            <p className="fb-hiw-sub">Alleen de slotkoers telt — geen take profit of stop loss.</p>
          </div>
        </div>
      )}
    </div>
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
