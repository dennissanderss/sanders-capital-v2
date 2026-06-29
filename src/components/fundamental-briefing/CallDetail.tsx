'use client'

import { useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { fmtDate, fmtPrice, dirLabel } from './helpers'
import { Tip } from './ui'

const HZ_LABEL: Record<number, string> = { 1: '1 dag', 3: '3 dagen', 5: '5 dagen', 10: '10 dagen', 20: '20 dagen' }
const sgn = (v: number) => `${v > 0 ? '+' : ''}${v}`

const TIP = {
  zekerheid: 'Hoe sterk de fundamentals deze richting steunen, van 0 tot 10. Hoger = overtuigender. Bepaalt alleen de rangschikking — niet of de voorspelling goed of fout is.',
  dagen: 'Op hoeveel handelsdagen ná de voorspelling we kijken of de richting klopte. Fundamentals werken traag, dus we checken op 1, 3, 5, 10 en 20 dagen.',
  tegendraads: 'Of de koers de afgelopen dagen juist tégen de fundamentele richting in bewoog. Dan is de instap aantrekkelijker (koop de dip / verkoop de rally).',
  marktbreed: 'Of brede marktsignalen (aandelen, VIX, goud, dollar, rente) bij deze richting passen. 100% = alles bevestigt, 0% = alles spreekt tegen.',
  regime: 'Het overheersende macro-thema nu (bv. USD Dominant, Risk-Off). Past de richting daarbij?',
}

export function CallDetail({ call }: { call: FbCall }) {
  const long = call.direction === 'bullish'
  const b = call.breakdown
  const r = call.reasoning

  // Standaard de verst-gevorderde beoordeelde horizon tonen, anders 1 dag.
  const lastResolved = [...HORIZONS].reverse().find((h) => call.outcomes.find((o) => o.horizon === h)?.resolved)
  const [selHz, setSelHz] = useState<number>(lastResolved ?? 1)
  const sel = call.outcomes.find((o) => o.horizon === selHz)

  return (
    <div className="fb-detail">
      <div className="fb-detail-head">
        <div>
          <div className="fb-detail-pair">{call.pair}</div>
          <div className="fb-detail-bias">
            <span className={`fb-bigdir ${long ? 'long' : 'short'}`}>{dirLabel(call.direction)}</span>
            <span className="fb-mono">{call.callType === 'weekly' ? 'Weekcall' : 'Dagcall'} · {fmtDate(call.callDate)}</span>
          </div>
        </div>
        <div className="fb-conv-big">
          <div className="v num">{call.conviction.toFixed(1)}</div>
          <div className="l">zekerheid / 10 <Tip text={TIP.zekerheid} /></div>
        </div>
      </div>

      {/* Blok 1 — tijdlijn */}
      <div className="fb-block">
        <h4 className="fb-block-title">Klopte de richting? — per moment <Tip text={TIP.dagen} /></h4>
        <p className="fb-block-intro">
          De voorspelling ({dirLabel(call.direction)}) is gezet op de slotkoers van <b>{fmtDate(call.entryDate)}</b> ({fmtPrice(call.pair, call.entryPrice)}).
          We checken op 5 momenten of de koers de goede kant op eindigde. Klik een bolletje voor de details.
        </p>

        <div className="fb-timeline">
          {HORIZONS.map((h) => {
            const o = call.outcomes.find((x) => x.horizon === h)
            const v = !o || !o.resolved || o.correct == null ? 'pending' : o.correct ? 'win' : 'loss'
            return (
              <div key={h} className={`fb-tnode${selHz === h ? ' sel' : ''}`} onClick={() => setSelHz(h)}>
                <span className={`fb-tdot ${v}`} />
                <span className="fb-tlabel">{HZ_LABEL[h]}</span>
                <span className={`fb-tverdict ${v}`}>{v === 'win' ? 'juist' : v === 'loss' ? 'fout' : 'wacht'}</span>
              </div>
            )
          })}
        </div>

        <div className="fb-tdetail">
          {!sel || !sel.resolved || sel.exitPrice == null ? (
            <p className="fb-note" style={{ margin: 0 }}>
              <b>Nog wachten.</b> De {HZ_LABEL[selHz]} na de voorspelling zijn nog niet volledig voorbij, dus er is nog geen oordeel.
              Dit verschijnt vanzelf zodra die handelsdag gesloten is.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                <span className={`fb-verdict ${sel.correct ? 'win' : 'loss'}`}>{sel.correct ? 'JUIST' : 'ONJUIST'}</span>{' '}
                <span style={{ color: 'var(--ink-2)' }}>
                  na {HZ_LABEL[selHz]}: koers ging {sel.exitPrice > call.entryPrice ? 'omhoog' : 'omlaag'}, en je voorspelde {long ? 'omhoog' : 'omlaag'}.
                </span>
              </p>
              <div className="fb-hz-prices num">
                instap {fmtPrice(call.pair, call.entryPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(call.entryDate)}</span>
                <span className="ar">→</span>
                slot {fmtPrice(call.pair, sel.exitPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(sel.exitDate)}</span>
              </div>
              {sel.mfePips != null && (
                <div className="fb-hz-fav num">
                  Grootste beweging mee: <span className="fb-pos">{sgn(sel.mfePips)} pips</span>
                  {' '}({fmtPrice(call.pair, call.entryPrice)} {fmtDate(call.entryDate)} → {fmtPrice(call.pair, sel.mfePrice)} {fmtDate(sel.mfeDate)})
                </div>
              )}
              {sel.maePips != null && sel.maePips < 0 && (
                <div className="fb-hz-fav num" style={{ color: 'var(--ink-3)' }}>
                  Grootste beweging tegen: <span className="fb-neg">{sel.maePips} pips</span>
                  {' '}({fmtPrice(call.pair, call.entryPrice)} {fmtDate(call.entryDate)} → {fmtPrice(call.pair, sel.maePrice)} {fmtDate(sel.maeDate)})
                </div>
              )}
            </>
          )}
        </div>
        <p className="fb-note">Goed/fout = alléén op de slotkoers (waar de koers eindigt). De &quot;beweging mee&quot; laat zien of er onderweg een bruikbare swing was — die telt niet mee in de score, maar je kunt de pips nachecken via de koersen en datums.</p>
      </div>

      {/* Blok 2 — waarom deze zekerheid */}
      <div className="fb-block">
        <h4 className="fb-block-title">Waarom zekerheid {call.conviction.toFixed(1)}? <Tip text={TIP.zekerheid} /></h4>
        <p className="fb-block-intro">De zekerheid is de optelsom van vier onderdelen (max 10).</p>
        <div className="fb-subs">
          <div className="fb-sub"><span className="l">Fundamentele onbalans</span><span className="v num">{b.fundPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">Recente koersbeweging (tegendraads) <Tip text={TIP.tegendraads} /></span><span className="v num">{b.contrarianPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">Marktbrede bevestiging ({Math.round(r.imAlignment)}%) <Tip text={TIP.marktbreed} /></span><span className="v num">{b.imPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">Past bij marktregime <Tip text={TIP.regime} /></span><span className="v num">{b.regimePts.toFixed(1)}</span></div>
          <div className="fb-sub-total"><span className="l">Samen</span><span className="v num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)} = {b.total.toFixed(1)}</span></div>
        </div>
        <p className="fb-formula">
          Recente koersbeweging {sgn(r.momentum5dPips)} pips
          ({fmtPrice(call.pair, r.momentumStart.price)} {fmtDate(r.momentumStart.date)} → {fmtPrice(call.pair, r.momentumNow.price)} {fmtDate(r.momentumNow.date)}).
        </p>
      </div>

      {/* Blok 3 — factoren per valuta */}
      <div className="fb-block">
        <h4 className="fb-block-title">Fundamentele factoren per valuta</h4>
        <p className="fb-block-intro">
          De onbalans = het verschil tussen beide valutascores. Per valuta: centralebankbeleid (×2) + rente vs. doel (×1,5) + nieuws.
          Een hogere score = sterkere valuta.
        </p>
        <div className="fb-factors">
          {[r.base, r.quote].map((c) => (
            <div className="fb-fcol" key={c.currency}>
              <div className="fb-fcol-head">
                <span className="fb-fcol-ccy">{c.currency}</span>
                <span className="fb-fcol-total num">{sgn(+c.total.toFixed(1))}</span>
              </div>
              <div className="fb-frow"><span>Centrale bank · {c.biasLabel}</span><span className="v num">{sgn(+c.cbPts.toFixed(1))}</span></div>
              <div className="fb-frow"><span>Rente vs. doel{c.rate != null ? ` (${c.rate}% / ${c.target}%)` : ''}</span><span className="v num">{sgn(+c.ratePts.toFixed(1))}</span></div>
              <div className="fb-frow"><span>Nieuws</span><span className="v num">{sgn(+c.newsPts.toFixed(1))}</span></div>
              {c.newsHeadlines.length > 0 && (
                <div className="fb-heads">{c.newsHeadlines.slice(0, 2).map((h, i) => <div key={i}>• {h}</div>)}</div>
              )}
            </div>
          ))}
        </div>
        <p className="fb-formula">Verschil: {r.base.currency} {sgn(+r.base.total.toFixed(1))} − {r.quote.currency} {sgn(+r.quote.total.toFixed(1))} = <b>{sgn(+call.fundScore.toFixed(1))}</b> → richting <b>{dirLabel(call.direction)}</b>.</p>
      </div>

      {/* Blok 4 — marktregime */}
      <div className="fb-block">
        <h4 className="fb-block-title">Marktregime <Tip text={TIP.regime} /></h4>
        <p className="fb-block-intro">Past de richting bij het huidige marktthema ({call.regime})?</p>
        <span className={`fb-tag ${r.regimeAligned ? 'yes' : 'no'}`}>{r.regimeAligned ? 'past in regime' : 'neutraal'}</span>
        <p className="fb-note">{r.regimeText}</p>
      </div>
    </div>
  )
}
