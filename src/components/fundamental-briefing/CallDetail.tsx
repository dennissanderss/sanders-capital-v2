'use client'

import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { fmtDate, fmtPrice, dirLabel } from './helpers'

const HZ_LABEL: Record<number, string> = { 1: '1 dag', 3: '3 dagen', 5: '5 dagen', 10: '10 dagen', 20: '20 dagen' }
const sgn = (v: number) => `${v > 0 ? '+' : ''}${v}`

export function CallDetail({ call }: { call: FbCall }) {
  const long = call.direction === 'bullish'
  const b = call.breakdown
  const r = call.reasoning

  return (
    <div className="fb-detail">
      <div className="fb-detail-head">
        <div>
          <div className="fb-detail-pair">{call.pair}</div>
          <div className="fb-detail-bias">
            <span className={`fb-bigdir ${long ? 'long' : 'short'}`}>{dirLabel(call.direction)}</span>
            <span className="fb-mono">{call.callType === 'weekly' ? 'Weekly' : 'Daily'} · {call.regime}</span>
          </div>
        </div>
        <div className="fb-conv-big">
          <div className="v num">{call.conviction.toFixed(1)}</div>
          <div className="l">conviction / 10</div>
        </div>
      </div>

      {/* Blok 1 — Multi-horizon voortgang */}
      <div className="fb-block">
        <h4 className="fb-block-title">Zit de richting goed? — per horizon</h4>
        <p className="fb-block-intro">
          De bias is gezet op de slotkoers van <b>{fmtDate(call.entryDate)}</b> ({fmtPrice(call.pair, call.entryPrice)}).
          Per horizon kijken we of de slotkoers de goede kant op eindigde. Pending = die handelsdagen zijn nog niet voorbij.
        </p>
        <div className="fb-hz">
          {HORIZONS.map((h) => {
            const o = call.outcomes.find((x) => x.horizon === h)
            const verdict = !o || !o.resolved || o.correct == null ? 'pending' : o.correct ? 'win' : 'loss'
            return (
              <div className="fb-hz-row" key={h}>
                <div className="fb-hz-top">
                  <span className="fb-hz-name">{HZ_LABEL[h]}</span>
                  <span className={`fb-verdict ${verdict}`}>
                    {verdict === 'win' ? 'Juist' : verdict === 'loss' ? 'Onjuist' : 'Pending'}
                  </span>
                </div>
                {o && o.resolved && o.exitPrice != null && (
                  <>
                    <div className="fb-hz-prices num">
                      {fmtPrice(call.pair, call.entryPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(call.entryDate)}</span>
                      <span className="ar">→</span>
                      {fmtPrice(call.pair, o.exitPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(o.exitDate)}</span>
                    </div>
                    {o.mfePips != null && (
                      <div className="fb-hz-fav num">
                        Grootste beweging mee: <span className="fb-pos">{sgn(o.mfePips)} pips</span>
                        {' '}({fmtPrice(call.pair, call.entryPrice)} {fmtDate(call.entryDate)} → {fmtPrice(call.pair, o.mfePrice)} {fmtDate(o.mfeDate)})
                      </div>
                    )}
                    {o.maePips != null && o.maePips < 0 && (
                      <div className="fb-hz-fav num" style={{ color: 'var(--ink-3)' }}>
                        Grootste beweging tegen: <span className="fb-neg">{o.maePips} pips</span>
                        {' '}({fmtPrice(call.pair, call.entryPrice)} {fmtDate(call.entryDate)} → {fmtPrice(call.pair, o.maePrice)} {fmtDate(o.maeDate)})
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        <p className="fb-note">Win/verlies = puur op de slotkoers (close-to-close). De &quot;beweging mee&quot; toont of er onderweg een bruikbare swing was — die telt niet mee in de winrate, maar je kunt de pips nachecken via de koersen en datums.</p>
      </div>

      {/* Blok 2 — Waarom deze score */}
      <div className="fb-block">
        <h4 className="fb-block-title">Waarom deze conviction ({call.conviction.toFixed(1)})?</h4>
        <p className="fb-block-intro">De conviction is de optelsom van vier onderdelen (max 10).</p>
        <div className="fb-subs">
          <div className="fb-sub"><span className="l">Fundamentele onbalans</span><span className="v num">{b.fundPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">5d momentum (mean-reversion)</span><span className="v num">{b.contrarianPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">Intermarket alignment ({Math.round(r.imAlignment)}%)</span><span className="v num">{b.imPts.toFixed(1)}</span></div>
          <div className="fb-sub"><span className="l">Regime alignment</span><span className="v num">{b.regimePts.toFixed(1)}</span></div>
          <div className="fb-sub-total"><span className="l">Samen</span><span className="v num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)} = {b.total.toFixed(1)}</span></div>
        </div>
        <p className="fb-formula">
          Fundamentele onbalans = min(|{call.fundScore.toFixed(1)}| ÷ 5, 1) × 4. 5d momentum {sgn(r.momentum5dPips)} pips
          ({fmtPrice(call.pair, r.momentumStart.price)} {fmtDate(r.momentumStart.date)} → {fmtPrice(call.pair, r.momentumNow.price)} {fmtDate(r.momentumNow.date)}).
        </p>
      </div>

      {/* Blok 3 — Fundamentele factoren per valuta */}
      <div className="fb-block">
        <h4 className="fb-block-title">Fundamentele factoren per valuta</h4>
        <p className="fb-block-intro">
          De onbalans = het verschil tussen beide valutascores. Per valuta: centralebankbeleid (×2) + rente vs. doel (×1,5) + nieuws.
        </p>
        <div className="fb-factors">
          {[r.base, r.quote].map((c) => (
            <div className="fb-fcol" key={c.currency}>
              <div className="fb-fcol-head">
                <span className="fb-fcol-ccy">{c.currency}</span>
                <span className="fb-fcol-total num">{sgn(+c.total.toFixed(1))}</span>
              </div>
              <div className="fb-frow"><span>CB-beleid · {c.biasLabel}</span><span className="v num">{sgn(+c.cbPts.toFixed(1))}</span></div>
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

      {/* Blok 4 — Regime-context */}
      <div className="fb-block">
        <h4 className="fb-block-title">Regime-context</h4>
        <p className="fb-block-intro">Past de richting bij het huidige marktregime ({call.regime})?</p>
        <span className={`fb-tag ${r.regimeAligned ? 'yes' : 'no'}`}>{r.regimeAligned ? 'past in regime' : 'neutraal'}</span>
        <p className="fb-note">{r.regimeText}</p>
      </div>
    </div>
  )
}
