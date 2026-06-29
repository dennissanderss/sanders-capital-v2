'use client'

import { useState } from 'react'
import type { FbCall, CurrencyFactors } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { fmtDate, fmtPrice, dirLabel, HZ_LABEL, zekerheidTier } from './helpers'
import { Tip } from './ui'

const sgn = (v: number) => `${v > 0 ? '+' : ''}${v}`
const IM_NAME: Record<string, string> = { sp500: 'S&P 500', vix: 'VIX', gold: 'Goud', us10y: 'US 10Y-rente', dxy: 'Dollar (DXY)' }
const DIR_NL: Record<string, string> = { up: 'omhoog', down: 'omlaag', flat: 'vlak' }

const TIP = {
  zekerheid: 'Hoe sterk de fundamentals deze richting steunen, van 0 tot 10. Hoger = overtuigender. Bepaalt alleen de rangschikking — niet of de voorspelling goed of fout is.',
  tegendraads: 'Of de koers de afgelopen dagen juist tégen de fundamentele richting in bewoog. Dan is de instap aantrekkelijker (koop de dip / verkoop de rally).',
  marktbreed: 'Of brede marktsignalen (aandelen, VIX, goud, dollar, rente) bij deze richting passen. 100% = alles bevestigt.',
  regime: 'Het overheersende macro-thema nu (bv. USD Dominant, Risk-Off). Past de richting daarbij?',
}

const NOT_STORED = 'Niet vastgelegd voor deze call (deze call is gemaakt vóór deze uitleg werd opgeslagen).'

export function CallDetail({ call, hoofdhorizon }: { call: FbCall; hoofdhorizon: number }) {
  const long = call.direction === 'bullish'
  const b = call.breakdown
  const r = call.reasoning

  // Tijdlijn opent standaard op de hoofdhorizon van de lens (of de laatst beoordeelde).
  const lastResolved = [...HORIZONS].reverse().find((h) => call.outcomes.find((o) => o.horizon === h)?.resolved)
  const [selHz, setSelHz] = useState<number>(hoofdhorizon)
  const sel = call.outcomes.find((o) => o.horizon === selHz)
  const [openSub, setOpenSub] = useState<string | null>('fund')

  const subToggle = (k: string) => setOpenSub((o) => (o === k ? null : k))

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
          <div className="l"><span className={`fb-ztag ${zekerheidTier(call.conviction).cls}`}>{zekerheidTier(call.conviction).label}</span> zekerheid / 10 <Tip text={TIP.zekerheid} /></div>
        </div>
      </div>

      {/* Blok 1 — tijdlijn + win/loss helder (Feature 2) */}
      <div className="fb-block">
        <h4 className="fb-block-title">Klopte de richting? — per moment</h4>
        <p className="fb-block-intro">
          <b>Referentiekoers</b> = de slotkoers van de laatste voltooide dag-candle op het moment van de call:
          <b> {fmtPrice(call.pair, call.entryPrice)}</b> op <b>{fmtDate(call.entryDate)}</b>. We checken op 5 momenten of de
          koers de voorspelde kant op eindigde. Klik een bolletje voor de details.
        </p>

        <div className="fb-timeline">
          {HORIZONS.map((h) => {
            const o = call.outcomes.find((x) => x.horizon === h)
            const v = !o || !o.resolved || o.correct == null ? 'pending' : o.correct ? 'win' : 'loss'
            return (
              <div key={h} className={`fb-tnode${selHz === h ? ' sel' : ''}${h === hoofdhorizon ? ' hoofd' : ''}`} onClick={() => setSelHz(h)}>
                <span className={`fb-tdot ${v}`} />
                <span className="fb-tlabel">{HZ_LABEL[h]}{h === hoofdhorizon ? ' ★' : ''}</span>
                <span className={`fb-tverdict ${v}`}>{v === 'win' ? 'juist' : v === 'loss' ? 'fout' : 'wacht'}</span>
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
                <span className={`fb-verdict ${sel.correct ? 'win' : 'loss'}`}>{sel.correct ? 'JUIST' : 'ONJUIST'}</span>{' '}
                <span style={{ color: 'var(--ink-2)' }}>
                  na {HZ_LABEL[selHz]}: eindkoers ging {sel.exitPrice > call.entryPrice ? 'omhoog' : 'omlaag'}, en je voorspelde {long ? 'omhoog (LONG)' : 'omlaag (SHORT)'}.
                </span>
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

      {/* Blok 2 — waarom deze zekerheid, uitklapbaar per subscore (Feature 3) */}
      <div className="fb-block">
        <h4 className="fb-block-title">Waarom zekerheid {call.conviction.toFixed(1)}? <Tip text={TIP.zekerheid} /></h4>
        <p className="fb-block-intro">
          De zekerheid is de optelsom van vier onderdelen (max 10). <b>Laag = zwakke call</b> (richting duidelijk, maar weinig
          bevestiging); hoog = sterke call. Klik een onderdeel open voor de exacte input.
        </p>

        <div className="fb-subs">
          {/* 1. Fundamentele onbalans */}
          <SubRow k="fund" label="Fundamentele onbalans" val={b.fundPts} open={openSub === 'fund'} onClick={subToggle}>
            <p className="fb-sub-intro">Het verschil tussen beide valutascores. Per valuta: centrale bank (×2) + rente vs. doel (×1,5) + nieuws.</p>
            <div className="fb-factors">
              {[r.base, r.quote].map((c) => <FactorCol key={c.currency} c={c} newsDetail={r.newsDetail?.[c.currency]} />)}
            </div>
            <p className="fb-formula">Verschil: {r.base.currency} {sgn(+r.base.total.toFixed(1))} − {r.quote.currency} {sgn(+r.quote.total.toFixed(1))} = <b>{sgn(+call.fundScore.toFixed(1))}</b> → richting <b>{dirLabel(call.direction)}</b>.</p>
          </SubRow>

          {/* 2. Recente koersbeweging */}
          <SubRow k="mom" label="Recente koersbeweging (tegendraads)" tip={TIP.tegendraads} val={b.contrarianPts} open={openSub === 'mom'} onClick={subToggle}>
            <p className="fb-sub-intro">De koers van de afgelopen 5 handelsdagen. Tegendraads = de koers liep tégen de fundamentele richting in → aantrekkelijkere instap.</p>
            <div className="fb-sub-line"><span>Start · {fmtDate(r.momentumStart.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumStart.price)}</span></div>
            <div className="fb-sub-line"><span>Nu · {fmtDate(r.momentumNow.date)}</span><span className="num">{fmtPrice(call.pair, r.momentumNow.price)}</span></div>
            <div className="fb-sub-line"><span>Beweging</span><span className={`num ${r.momentum5dPips >= 0 ? 'fb-pos' : 'fb-neg'}`}>{sgn(r.momentum5dPips)} pips</span></div>
          </SubRow>

          {/* 3. Marktbrede bevestiging */}
          <SubRow k="im" label={`Marktbrede bevestiging (${Math.round(r.imAlignment)}%)`} tip={TIP.marktbreed} val={b.imPts} open={openSub === 'im'} onClick={subToggle}>
            <p className="fb-sub-intro">Welk deel van de brede marktsignalen deze richting bevestigde. {Math.round(r.imAlignment)}% ÷ 100 × 2 = {b.imPts.toFixed(1)} punten.</p>
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
                <p className="fb-sub-note" style={{ marginTop: 8 }}><b>—</b> = telt niet mee voor het {call.regime}-regime (elk regime kijkt naar andere instrumenten).</p>
              </>
            ) : <p className="fb-sub-note">{NOT_STORED}</p>}
          </SubRow>

          {/* 4. Past bij marktregime */}
          <SubRow k="reg" label="Past bij marktregime" tip={TIP.regime} val={b.regimePts} open={openSub === 'reg'} onClick={subToggle}>
            <p className="fb-sub-intro">Past de richting bij het huidige marktthema ({call.regime})?</p>
            <span className={`fb-tag ${r.regimeAligned ? 'yes' : 'no'}`} style={{ marginBottom: 6, display: 'inline-block' }}>{r.regimeAligned ? 'past in regime' : 'neutraal'}</span>
            <p className="fb-sub-note" style={{ margin: 0 }}>{r.regimeText}</p>
          </SubRow>

          <div className="fb-sub-total"><span className="l">Samen</span><span className="v num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)} = {b.total.toFixed(1)}</span></div>
        </div>
      </div>
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

function FactorCol({ c, newsDetail }: { c: CurrencyFactors; newsDetail?: { title: string; source: string; date: string | null; weight: number }[] }) {
  const [newsOpen, setNewsOpen] = useState(false)
  return (
    <div className="fb-fcol">
      <div className="fb-fcol-head">
        <span className="fb-fcol-ccy">{c.currency}</span>
        <span className="fb-fcol-total num">{c.total > 0 ? '+' : ''}{c.total.toFixed(1)}</span>
      </div>
      <div className="fb-frow"><span>Centrale bank · {c.biasLabel}</span><span className="v num">{c.cbPts > 0 ? '+' : ''}{c.cbPts.toFixed(1)}</span></div>
      <div className="fb-frow"><span>Rente vs. doel{c.rate != null ? ` (${c.rate}% / ${c.target}%)` : ''}</span><span className="v num">{c.ratePts > 0 ? '+' : ''}{c.ratePts.toFixed(1)}</span></div>
      <button className="fb-frow fb-news-toggle" onClick={() => setNewsOpen((o) => !o)}>
        <span>Nieuws {(newsDetail?.length || c.newsHeadlines.length) ? `(${newsDetail?.length ?? c.newsHeadlines.length}) ▾` : ''}</span>
        <span className="v num">{c.newsPts > 0 ? '+' : ''}{c.newsPts.toFixed(1)}</span>
      </button>
      {newsOpen && (
        <div className="fb-news-detail">
          {newsDetail && newsDetail.length > 0 ? (
            newsDetail.map((n, i) => (
              <div className="fb-news-item" key={i}>
                <div className="fb-news-title">• {n.title}</div>
                <div className="fb-news-meta">{n.source}{n.date ? ` · ${n.date.split('T')[0]}` : ''} · gewicht {n.weight.toFixed(2)}</div>
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
    </div>
  )
}
