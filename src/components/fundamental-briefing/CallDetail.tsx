'use client'

import { useState } from 'react'
import type { FbCall, CurrencyFactors, ConvictionV2 } from '@/lib/fundamental/types'
import { isV2Breakdown } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { fmtDate, fmtPrice, dirLabel, HZ_LABEL, zekerheidTier, plainSummary, verdictOf } from './helpers'
import { Tip } from './ui'

const sgn = (v: number) => `${v > 0 ? '+' : ''}${v}`
const IM_NAME: Record<string, string> = { sp500: 'S&P 500', vix: 'VIX', gold: 'Goud', us10y: 'US 10Y-rente', dxy: 'Dollar (DXY)' }
const DIR_NL: Record<string, string> = { up: 'omhoog', down: 'omlaag', flat: 'vlak' }

const TIP = {
  zekerheid: 'Samenvattend cijfer (0-10): 60% bias-sterkte + 40% timing. Bepaalt alleen de rangschikking — niet of de voorspelling goed of fout is.',
  bias: 'Hoe sterk de fundamentals deze richting steunen (0-10): beleidsdivergentie tussen de twee valuta’s + past het bij het macro-regime.',
  timing: 'Hoe gunstig het instapmoment is (0-10): is de koers tegendraads gestrekt (dip/rally), bevestigt de bredere markt, en zijn er geen high-impact cijfers op komst?',
  tegendraads: 'Of de koers de afgelopen dagen tégen de fundamentele richting in bewoog, gemeten in eenheden van de gemiddelde dagbeweging (ATR). Dan is de instap aantrekkelijker (koop de dip / verkoop de rally).',
  marktbreed: 'Of brede marktsignalen (aandelen, VIX, goud, dollar, rente) bij deze richting passen. 100% = alles bevestigt.',
  regime: 'Het overheersende macro-thema nu (bv. USD Dominant, Risk-Off). Past de richting daarbij?',
  events: 'Geplande high-impact publicaties (CPI, banencijfers, rentebesluiten) voor één van beide valuta’s binnen ±2 dagen. Vlak vóór zo’n cijfer instappen = gokken op de uitkomst.',
  verrassingen: 'Macro-cijfers van de afgelopen 5 dagen versus de verwachting (consensus). Beter dan verwacht = positief voor de valuta; zwaarder bij high-impact cijfers, zakt weg naarmate het ouder wordt.',
  inflatie: 'Recentste inflatie (CPI j/j) versus het doel van de centrale bank. Boven doel = druk om te verkrappen = positief voor de valuta.',
  grondstoffen: '5-daagse beweging van de belangrijkste exportgrondstof (olie→CAD, koper→AUD, landbouw→NZD). Duurdere export = positief.',
}

const NOT_STORED = 'Niet vastgelegd voor deze call (deze call is gemaakt vóór deze uitleg werd opgeslagen).'

function fmtEventDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export function CallDetail({ call, hoofdhorizon }: { call: FbCall; hoofdhorizon: number }) {
  const long = call.direction === 'bullish'
  const b = call.breakdown
  const v2 = isV2Breakdown(b) ? b : null
  const r = call.reasoning
  // In een Gemengd regime is de alignment een neutrale 50% (geen markt-thema),
  // niet door instrumenten verdiend — dat verklaart 50% + alle "—".
  const isGemengd = call.regime === 'Gemengd'

  const [selHz, setSelHz] = useState<number>(hoofdhorizon)
  const sel = call.outcomes.find((o) => o.horizon === selHz)
  const selVerdict = verdictOf(call, sel)
  const [openSub, setOpenSub] = useState<string | null>('fund')
  const [showCalc, setShowCalc] = useState(false)

  const subToggle = (k: string) => setOpenSub((o) => (o === k ? null : k))
  const events = r.eventRisk || []

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
        {v2 ? (
          <div className="fb-scores">
            <div className="fb-score-cell">
              <div className="v num">{v2.biasScore.toFixed(1)}</div>
              <div className="l">bias <Tip text={TIP.bias} /></div>
            </div>
            <div className="fb-score-cell">
              <div className={`v num${v2.timingScore < 4 ? ' low' : ''}`}>{v2.timingScore.toFixed(1)}</div>
              <div className="l">timing <Tip text={TIP.timing} /></div>
            </div>
            <div className="fb-score-cell total">
              <div className="v num">{call.conviction.toFixed(1)}</div>
              <div className="l"><span className={`fb-ztag ${zekerheidTier(call.conviction).cls}`}>{zekerheidTier(call.conviction).label}</span> zekerheid <Tip text={TIP.zekerheid} /></div>
            </div>
          </div>
        ) : (
          <div className="fb-conv-big">
            <div className="v num">{call.conviction.toFixed(1)}</div>
            <div className="l"><span className={`fb-ztag ${zekerheidTier(call.conviction).cls}`}>{zekerheidTier(call.conviction).label}</span> zekerheid / 10 <Tip text={TIP.zekerheid} /></div>
          </div>
        )}
      </div>

      <p className="fb-plain">{plainSummary(call)}</p>

      {/* Event-risico: expliciet waarschuwen, niet alleen punten aftrekken. */}
      {events.length > 0 && (
        <div className="fb-event-warn">
          <b>⚠ Cijfers op komst</b> <Tip text={TIP.events} /> — verhoogd risico rond deze momenten:
          <ul>
            {events.map((e, i) => (
              <li key={i}><b>{e.currency}</b> · {e.title} · <span className="num">{fmtEventDate(e.date)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Blok 1 — tijdlijn + win/loss helder */}
      <div className="fb-block">
        <h4 className="fb-block-title">Klopte de richting? — per moment</h4>
        <p className="fb-block-intro">
          <b>Referentiekoers</b> = de slotkoers van de laatste voltooide dag-candle op het moment van de call:
          <b> {fmtPrice(call.pair, call.entryPrice)}</b> op <b>{fmtDate(call.entryDate)}</b>. We checken op 5 momenten of de
          koers de voorspelde kant op eindigde. Klik een bolletje voor de details.
        </p>

        <div className="fb-timeline">
          {HORIZONS.map((h) => {
            const v = verdictOf(call, call.outcomes.find((x) => x.horizon === h))
            return (
              <div key={h} className={`fb-tnode${selHz === h ? ' sel' : ''}${h === hoofdhorizon ? ' hoofd' : ''}`} onClick={() => setSelHz(h)}>
                <span className={`fb-tdot ${v}`} />
                <span className="fb-tlabel">{HZ_LABEL[h]}{h === hoofdhorizon ? ' ★' : ''}</span>
                <span className={`fb-tverdict ${v}`}>{v === 'win' ? 'juist' : v === 'loss' ? 'fout' : v === 'flat' ? 'vlak' : 'wacht'}</span>
              </div>
            )
          })}
        </div>

        <div className="fb-tdetail">
          {!sel || !sel.resolved || sel.exitPrice == null ? (
            <p className="fb-note" style={{ margin: 0 }}>
              <b>Nog wachten.</b> De {HZ_LABEL[selHz]} na de call zijn nog niet volledig voorbij, dus er is nog geen oordeel —
              deze call telt nergens mee. Verschijnt vanzelf zodra die handelsdag gesloten is.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                {selVerdict === 'flat' ? (
                  <>
                    <span className="fb-verdict pending">VLAK</span>{' '}
                    <span style={{ color: 'var(--ink-2)' }}>
                      na {HZ_LABEL[selHz]}: de koers bewoog minder dan 15% van een gemiddelde dagbeweging — te weinig om als juist of onjuist te tellen.
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`fb-verdict ${sel.correct ? 'win' : 'loss'}`}>{sel.correct ? 'JUIST' : 'ONJUIST'}</span>{' '}
                    <span style={{ color: 'var(--ink-2)' }}>
                      na {HZ_LABEL[selHz]}: eindkoers ging {sel.exitPrice > call.entryPrice ? 'omhoog' : 'omlaag'}, en je voorspelde {long ? 'omhoog (LONG)' : 'omlaag (SHORT)'}.
                    </span>
                  </>
                )}
              </p>
              <div className="fb-hz-prices num">
                referentie {fmtPrice(call.pair, call.entryPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(call.entryDate)}</span>
                <span className="ar">→</span>
                eindkoers {fmtPrice(call.pair, sel.exitPrice)} <span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(sel.exitDate)}</span>
              </div>
              {sel.mfePips != null && (
                <div className="fb-hz-fav num">
                  Grootste beweging mee: <span className="fb-pos">{sgn(sel.mfePips)} pips</span>
                  {' '}({fmtPrice(call.pair, call.entryPrice)} {fmtDate(call.entryDate)} → {fmtPrice(call.pair, sel.mfePrice)} {fmtDate(sel.mfeDate)})
                </div>
              )}
            </>
          )}
        </div>
        <p className="fb-note"><b>Let op:</b> dit meet of de <b>richting</b> klopte, niet of je de trade onderweg had kunnen uithouden. Alleen de slotkoers telt — geen take profit of stop loss.</p>
      </div>

      {/* Blok 2 — de berekening, standaard ingeklapt */}
      <button className="fb-calc-toggle" onClick={() => setShowCalc((s) => !s)}>
        {showCalc ? '▲ Verberg de berekening' : `▾ Toon de berekening — hoe ${v2 ? 'bias en timing zijn' : 'de zekerheid is'} opgebouwd`}
      </button>

      {showCalc && (v2 ? (
        <div className="fb-block">
          <h4 className="fb-block-title">Bias {v2.biasScore.toFixed(1)} · Timing {v2.timingScore.toFixed(1)} → zekerheid {call.conviction.toFixed(1)}</h4>
          <p className="fb-block-intro">
            <b>Bias</b> = hoe sterk de fundamentals de richting steunen. <b>Timing</b> = hoe gunstig dít instapmoment is.
            Die twee zijn bewust gescheiden: een sterke bias met slechte timing wil je zien — dan wacht je op een beter moment.
            Klik een onderdeel open voor de exacte input.
          </p>

          <div className="fb-group-label">{v2.kind === 'carry' ? 'Bias — de carry-these' : 'Bias — de fundamentele these'} <Tip text={TIP.bias} /></div>
          <div className="fb-subs">
            {v2.kind === 'carry' ? (
              <SubRow k="fund" label="Renteverschil (carry)" val={v2.fundPts} open={openSub === 'fund'} onClick={subToggle}>
                <p className="fb-sub-intro">
                  De positie-lens handelt het <b>rente-niveau-verschil</b>: long de valuta met de duidelijk hoogste beleidsrente.
                  Je verdient dagelijks aan de swap; historisch driftte de koers er in risicovriendelijke regimes ook licht naartoe.
                </p>
                <div className="fb-sub-line"><span>Beleidsrente {r.base.currency}</span><span className="num">{r.carryBaseRate != null ? `${r.carryBaseRate}%` : '—'}</span></div>
                <div className="fb-sub-line"><span>Beleidsrente {r.quote.currency}</span><span className="num">{r.carryQuoteRate != null ? `${r.carryQuoteRate}%` : '—'}</span></div>
                <div className="fb-sub-line"><span>Verschil</span><span className="num" style={{ fontWeight: 700 }}>{r.carryDiffPp != null ? `${r.carryDiffPp > 0 ? '+' : ''}${r.carryDiffPp}pp` : '—'}</span></div>
                {r.swapPctPer30d != null && (
                  <div className="fb-sub-line"><span>Indicatieve swap-opbrengst <Tip text="Renteverschil naar rato van de tijd: |verschil| × dagen ÷ 365. Wat je broker werkelijk geeft is lager (spread op de swap)." /></span><span className="num fb-pos">≈ +{r.swapPctPer30d}% per 30 dagen</span></div>
                )}
                <p className="fb-formula">Punten: min(|{r.carryDiffPp ?? 0}| / 4, 1) × 8,5 = <b>{v2.fundPts.toFixed(1)}</b> → richting <b>{dirLabel(call.direction)}</b> (long de hoogste rente).</p>
              </SubRow>
            ) : (
            <SubRow k="fund" label="Fundamentele onbalans" val={v2.fundPts} open={openSub === 'fund'} onClick={subToggle}>
              <p className="fb-sub-intro">
                Het verschil tussen beide valutascores. Het draait om de <b>richting van het beleid</b>, niet om het rente-niveau.
                Per valuta: centralebankbeleid (×2) + rente t.o.v. het <b>eigen doel</b> (×1,5) + nieuws (per valuta gelabeld)
                + macro-verrassingen + inflatie vs. doel + grondstoffen.
              </p>
              <div className="fb-factors">
                {[r.base, r.quote].map((c) => <FactorCol key={c.currency} c={c} newsDetail={r.newsDetail?.[c.currency]} />)}
              </div>
              <p className="fb-formula">Verschil: {r.base.currency} {sgn(+r.base.total.toFixed(1))} − {r.quote.currency} {sgn(+r.quote.total.toFixed(1))} = <b>{sgn(+call.fundScore.toFixed(1))}</b> → richting <b>{dirLabel(call.direction)}</b>. Punten: min(|{(+call.fundScore.toFixed(1))}| / 6, 1) × 8,5 = <b>{v2.fundPts.toFixed(1)}</b>.</p>
              {r.newsSource === 'keywords' && (
                <p className="fb-sub-note" style={{ marginTop: 8 }}>Nieuws is voor deze call met de reserve-methode (trefwoorden) gelabeld — de AI-labeling was niet beschikbaar.</p>
              )}
            </SubRow>
            )}

            <SubRow k="reg" label="Past bij marktregime" tip={TIP.regime} val={v2.regimePts} open={openSub === 'reg'} onClick={subToggle}>
              <p className="fb-sub-intro">Past de richting bij het huidige marktthema ({call.regime})?</p>
              <span className={`fb-tag ${r.regimeAligned ? 'yes' : 'no'}`} style={{ marginBottom: 6, display: 'inline-block' }}>{r.regimeAligned ? 'past in regime' : 'neutraal'}</span>
              <p className="fb-sub-note" style={{ margin: 0 }}>{r.regimeText}</p>
            </SubRow>
            <div className="fb-sub-total"><span className="l">Bias</span><span className="v num">{v2.fundPts.toFixed(1)} + {v2.regimePts.toFixed(1)} = {v2.biasScore.toFixed(1)}</span></div>
          </div>

          <div className="fb-group-label" style={{ marginTop: 16 }}>Timing — het instapmoment <Tip text={TIP.timing} /></div>
          <div className="fb-subs">
            <SubRow k="mom" label="Tegendraadse strekking (in ATR)" tip={TIP.tegendraads} val={v2.stretchPts} open={openSub === 'mom'} onClick={subToggle}>
              <p className="fb-sub-intro">
                De 5-daagse koersbeweging, genormaliseerd op de gemiddelde dagbeweging (14d-ATR{r.atrPips ? `: ${r.atrPips} pips` : ''}).
                Tegen de richting in gestrekt = koop de dip / verkoop de rally = meer punten; er al achteraan (chasing) = 0.
              </p>
              <div className="fb-sub-line"><span>Start · {fmtDate(r.momentumStart.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumStart.price)}</span></div>
              <div className="fb-sub-line"><span>Nu · {fmtDate(r.momentumNow.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumNow.price)}</span></div>
              <div className="fb-sub-line"><span>Beweging</span><span className={`num ${r.momentum5dPips >= 0 ? 'fb-pos' : 'fb-neg'}`}>{sgn(r.momentum5dPips)} pips{r.atrPips ? ` = ${(r.momentum5dPips / r.atrPips).toFixed(1)} × ATR` : ''}</span></div>
            </SubRow>

            <SubRow k="im" label={`Marktbrede bevestiging (${Math.round(r.imAlignment)}%)`} tip={TIP.marktbreed} val={v2.imPts} open={openSub === 'im'} onClick={subToggle}>
              <p className="fb-sub-intro">
                Welk deel van de brede marktsignalen deze richting bevestigde: {Math.round(r.imAlignment)}% ÷ 100 × 3 = {v2.imPts.toFixed(1)} punten.
              </p>
              {isGemengd && (
                <p className="fb-sub-callout">
                  <b>Let op — Gemengd regime.</b> Er is nu geen duidelijk markt-thema, dus de marktsignalen kunnen de richting
                  niet bevestigen of tegenspreken. De tool gebruikt dan een <b>neutrale 50%</b> (= 1,5 punt); élke call krijgt
                  in dit regime dezelfde waarde — het onderscheidt deze call dus niet.
                </p>
              )}
              {r.intermarket && r.intermarket.length > 0 ? (
                <>
                  <div className="fb-im-list">
                    {r.intermarket.map((ins) => (
                      <div className="fb-sub-line" key={ins.key}>
                        <span>{IM_NAME[ins.key] || ins.key} <span style={{ color: 'var(--ink-4)' }}>{DIR_NL[ins.direction]} {sgn(+ins.changePct.toFixed(2))}%</span></span>
                        <span className={ins.contributed ? 'fb-pos' : ''} style={{ fontWeight: 600 }}>{ins.contributed ? 'bevestigt' : '—'}</span>
                      </div>
                    ))}
                  </div>
                  <p className="fb-sub-note" style={{ marginTop: 8 }}>
                    {isGemengd
                      ? <><b>—</b> = in een Gemengd regime worden deze instrumenten niet gelezen; je ziet wél wat de markt deed.</>
                      : <><b>—</b> = telt niet mee voor het {call.regime}-regime (elk regime kijkt naar andere instrumenten).</>}
                  </p>
                </>
              ) : <p className="fb-sub-note">{NOT_STORED}</p>}
            </SubRow>

            <SubRow k="ev" label="Event-rust" tip={TIP.events} val={v2.eventPts} open={openSub === 'ev'} onClick={subToggle}>
              <p className="fb-sub-intro">
                Start op 3 punten; elke geplande high-impact publicatie (CPI, banencijfers, rentebesluit) voor {r.base.currency} of {r.quote.currency} binnen
                ±2 dagen kost 1,5 punt. Vlak vóór zo&apos;n cijfer instappen = gokken op de uitkomst.
              </p>
              {events.length === 0
                ? <p className="fb-sub-note" style={{ margin: 0 }}>Geen high-impact events op de kalender in het venster — rustig instapmoment.</p>
                : events.map((e, i) => (
                  <div className="fb-sub-line" key={i}>
                    <span><b>{e.currency}</b> · {e.title}</span>
                    <span className="num">{fmtEventDate(e.date)}</span>
                  </div>
                ))}
            </SubRow>
            <div className="fb-sub-total"><span className="l">Timing</span><span className="v num">{v2.stretchPts.toFixed(1)} + {v2.imPts.toFixed(1)} + {v2.eventPts.toFixed(1)} = {v2.timingScore.toFixed(1)}</span></div>
          </div>

          <div className="fb-sub-total" style={{ marginTop: 12 }}>
            {v2.kind === 'carry' ? (
              <>
                <span className="l">Zekerheid = 0,75 × bias + 0,25 × timing <Tip text="Bij weken vasthouden weegt het instapmoment minder zwaar dan bij daytrades." /></span>
                <span className="v num">0,75 × {v2.biasScore.toFixed(1)} + 0,25 × {v2.timingScore.toFixed(1)} = {call.conviction.toFixed(1)}</span>
              </>
            ) : (
              <>
                <span className="l">Zekerheid = 0,6 × bias + 0,4 × timing</span>
                <span className="v num">0,6 × {v2.biasScore.toFixed(1)} + 0,4 × {v2.timingScore.toFixed(1)} = {call.conviction.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── v1-calls (vóór 3 jul 2026): de oude 4-delige berekening ── */
        <div className="fb-block">
          <h4 className="fb-block-title">Waarom zekerheid {call.conviction.toFixed(1)}?</h4>
          <p className="fb-block-intro">
            Deze call is gemaakt met de <b>oude methodiek (v1)</b>, vóór de bias/timing-splitsing van 3 jul 2026.
            De zekerheid was toen de optelsom van vier onderdelen (max 10).
          </p>

          <div className="fb-subs">
            <SubRow k="fund" label="Fundamentele onbalans" val={'fundPts' in b ? b.fundPts : 0} open={openSub === 'fund'} onClick={subToggle}>
              <p className="fb-sub-intro">
                Het verschil tussen beide valutascores. Per valuta: centralebankbeleid (×2) + rente t.o.v. het <b>eigen doel</b> (×1,5) + nieuws.
              </p>
              <div className="fb-factors">
                {[r.base, r.quote].map((c) => <FactorCol key={c.currency} c={c} newsDetail={r.newsDetail?.[c.currency]} />)}
              </div>
              <p className="fb-formula">Verschil: {r.base.currency} {sgn(+r.base.total.toFixed(1))} − {r.quote.currency} {sgn(+r.quote.total.toFixed(1))} = <b>{sgn(+call.fundScore.toFixed(1))}</b> → richting <b>{dirLabel(call.direction)}</b>.</p>
            </SubRow>

            <SubRow k="mom" label="Recente koersbeweging (tegendraads)" tip={TIP.tegendraads} val={'contrarianPts' in b ? b.contrarianPts : 0} open={openSub === 'mom'} onClick={subToggle}>
              <p className="fb-sub-intro">De koers van de afgelopen 5 handelsdagen. Tegendraads = de koers liep tégen de fundamentele richting in → aantrekkelijkere instap.</p>
              <div className="fb-sub-line"><span>Start · {fmtDate(r.momentumStart.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumStart.price)}</span></div>
              <div className="fb-sub-line"><span>Nu · {fmtDate(r.momentumNow.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumNow.price)}</span></div>
              <div className="fb-sub-line"><span>Beweging</span><span className={`num ${r.momentum5dPips >= 0 ? 'fb-pos' : 'fb-neg'}`}>{sgn(r.momentum5dPips)} pips</span></div>
            </SubRow>

            <SubRow k="im" label={`Marktbrede bevestiging (${Math.round(r.imAlignment)}%)`} tip={TIP.marktbreed} val={'imPts' in b ? b.imPts : 0} open={openSub === 'im'} onClick={subToggle}>
              <p className="fb-sub-intro">Welk deel van de brede marktsignalen (aandelen, VIX, goud, dollar, rente) deze richting bevestigde.</p>
              {r.intermarket && r.intermarket.length > 0 ? (
                <div className="fb-im-list">
                  {r.intermarket.map((ins) => (
                    <div className="fb-sub-line" key={ins.key}>
                      <span>{IM_NAME[ins.key] || ins.key} <span style={{ color: 'var(--ink-4)' }}>{DIR_NL[ins.direction]} {sgn(+ins.changePct.toFixed(2))}%</span></span>
                      <span className={ins.contributed ? 'fb-pos' : ''} style={{ fontWeight: 600 }}>{ins.contributed ? 'bevestigt' : '—'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="fb-sub-note">{NOT_STORED}</p>}
            </SubRow>

            <SubRow k="reg" label="Past bij marktregime" tip={TIP.regime} val={'regimePts' in b ? b.regimePts : 0} open={openSub === 'reg'} onClick={subToggle}>
              <p className="fb-sub-intro">Past de richting bij het huidige marktthema ({call.regime})?</p>
              <span className={`fb-tag ${r.regimeAligned ? 'yes' : 'no'}`} style={{ marginBottom: 6, display: 'inline-block' }}>{r.regimeAligned ? 'past in regime' : 'neutraal'}</span>
              <p className="fb-sub-note" style={{ margin: 0 }}>{r.regimeText}</p>
            </SubRow>

            {'contrarianPts' in b && (
              <div className="fb-sub-total"><span className="l">Samen</span><span className="v num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)} = {b.total.toFixed(1)}</span></div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SubRow({ k, label, val, tip, open, onClick, children }: {
  k: string; label: string; val: number; tip?: string; open: boolean; onClick: (k: string) => void; children: React.ReactNode
}) {
  return (
    <div className={`fb-sub-acc${open ? ' open' : ''}`}>
      <button className="fb-sub-head" onClick={() => onClick(k)}>
        <span className="l">{label}{tip && <Tip text={tip} />}</span>
        <span className="v num">{val.toFixed(1)}</span>
        <span className="fb-sub-chev">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="fb-sub-body">{children}</div>}
    </div>
  )
}

function FactorCol({ c, newsDetail }: { c: CurrencyFactors; newsDetail?: { title: string; source: string; date: string | null; weight: number; impact?: number }[] }) {
  const [newsOpen, setNewsOpen] = useState(false)
  const [surpriseOpen, setSurpriseOpen] = useState(false)
  const fmt1 = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`
  return (
    <div className="fb-fcol">
      <div className="fb-fcol-head">
        <span className="fb-fcol-ccy">{c.currency}</span>
        <span className="fb-fcol-total num">{c.total > 0 ? '+' : ''}{c.total.toFixed(1)}</span>
      </div>
      <div className="fb-frow"><span>Centrale bank · {c.biasLabel}</span><span className="v num">{fmt1(c.cbPts)}</span></div>
      <div className="fb-frow"><span>Rente vs. eigen doel{c.rate != null ? ` (${c.rate}% / ${c.target}%)` : ''}</span><span className="v num">{fmt1(c.ratePts)}</span></div>
      <button className="fb-frow fb-news-toggle" onClick={() => setNewsOpen((o) => !o)}>
        <span>Nieuws {(newsDetail?.length || c.newsHeadlines.length) ? `(${newsDetail?.length ?? c.newsHeadlines.length}) ▾` : ''}</span>
        <span className="v num">{fmt1(c.newsPts)}</span>
      </button>
      {newsOpen && (
        <div className="fb-news-detail">
          {newsDetail && newsDetail.length > 0 ? (
            newsDetail.map((n, i) => (
              <div className="fb-news-item" key={i}>
                <div className="fb-news-title">• {n.title}</div>
                <div className="fb-news-meta">
                  {n.source}{n.date ? ` · ${n.date.split('T')[0]}` : ''} · gewicht {n.weight.toFixed(2)}
                  {n.impact != null && <> · richting {n.impact > 0 ? '+' : ''}{n.impact} voor {c.currency}</>}
                </div>
              </div>
            ))
          ) : c.newsHeadlines.length > 0 ? (
            <>
              {c.newsHeadlines.map((h, i) => <div className="fb-news-item" key={i}><div className="fb-news-title">• {h}</div></div>)}
              <div className="fb-news-meta" style={{ marginTop: 4 }}>Bron en gewicht niet vastgelegd voor deze call.</div>
            </>
          ) : <div className="fb-news-meta">Geen nieuws meegewogen.</div>}
        </div>
      )}
      {/* v2-factoren (alleen aanwezig op calls vanaf 3 jul 2026) */}
      {c.surprisePts != null && (
        <>
          <button className="fb-frow fb-news-toggle" onClick={() => setSurpriseOpen((o) => !o)}>
            <span>Macro-verrassingen {(c.surpriseDetail?.length || 0) > 0 ? `(${c.surpriseDetail?.length}) ▾` : ''}<Tip text={TIP.verrassingen} /></span>
            <span className="v num">{fmt1(c.surprisePts)}</span>
          </button>
          {surpriseOpen && (
            <div className="fb-news-detail">
              {c.surpriseDetail && c.surpriseDetail.length > 0 ? c.surpriseDetail.map((s, i) => (
                <div className="fb-news-item" key={i}>
                  <div className="fb-news-title">• {s.title}</div>
                  <div className="fb-news-meta num">
                    uitkomst {s.actual}{s.unit || ''} vs. verwacht {s.forecast}{s.unit || ''} · {s.date.split('T')[0]} · {s.pts > 0 ? '+' : ''}{s.pts}
                  </div>
                </div>
              )) : <div className="fb-news-meta">Geen cijfers met consensus in de afgelopen 5 dagen.</div>}
            </div>
          )}
        </>
      )}
      {c.inflGapPts != null && (
        <div className="fb-frow">
          <span>Inflatie vs. doel{c.cpiYoY != null ? ` (${c.cpiYoY}% / ${c.cpiTarget}%)` : ''}<Tip text={TIP.inflatie} /></span>
          <span className="v num">{fmt1(c.inflGapPts)}</span>
        </div>
      )}
      {c.commodityPts != null && c.commodityName && (
        <div className="fb-frow">
          <span>Grondstoffen · {c.commodityName}{c.commodityChangePct != null ? ` (5d ${c.commodityChangePct > 0 ? '+' : ''}${c.commodityChangePct}%)` : ''}<Tip text={TIP.grondstoffen} /></span>
          <span className="v num">{fmt1(c.commodityPts)}</span>
        </div>
      )}
    </div>
  )
}
