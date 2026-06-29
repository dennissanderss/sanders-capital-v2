'use client'

import { useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { winStats, groupWinrate, convictionBand, outcomeAt, fmtDate, fmtPrice, dirLabel } from './helpers'
import { Tip, HowToRead } from './ui'

const REGIME_ORDER = ['USD Dominant', 'USD Zwak', 'Risk-Off', 'Risk-On', 'Gemengd']
const CONV_ORDER = ['8.0+', '7.0–8.0', '6.0–7.0', '< 6.0']
const HZ_LABEL: Record<number, string> = { 1: '1 dag', 3: '3 dagen', 5: '5 dagen', 10: '10 dagen', 20: '20 dagen' }

const TIP = {
  dagen: 'Op hoeveel handelsdagen ná de voorspelling we kijken of de richting klopte. Klik een knop — alle cijfers rekenen mee.',
  trefkans: 'Van alle voorspellingen die op deze termijn al beoordeeld zijn: hoeveel % zat goed. 50% = muntje.',
  zekerheid: 'Hoe sterk de fundamentals de richting steunden (0-10). Zo zie je of "zekerder" ook vaker goed betekent.',
}

function BdCard({ title, tip, rows }: { title: string; tip?: string; rows: { label: string; stats: ReturnType<typeof winStats> }[] }) {
  const shown = rows.filter((r) => r.stats.n > 0)
  return (
    <div className="fb-bd-card">
      <div className="fb-bd-title">{title}{tip && <Tip text={tip} />}</div>
      {shown.length === 0
        ? <div className="fb-note" style={{ marginTop: 0 }}>Nog geen beoordeelde voorspellingen op deze termijn.</div>
        : shown.map((r) => (
          <div className="fb-bd-row" key={r.label}>
            <span>{r.label}</span>
            <span className="fb-bd-rate num">{r.stats.winrate}%</span>
            <span className="fb-bd-n num">{r.stats.wins}/{r.stats.n} goed</span>
          </div>
        ))}
    </div>
  )
}

export function Trackrecord({ trackrecord }: { trackrecord: FbCall[] }) {
  const [hz, setHz] = useState<number>(5)
  const [type, setType] = useState<'all' | 'daily' | 'weekly'>('all')

  const calls = trackrecord.filter((c) => type === 'all' || c.callType === type)
  const overall = winStats(calls, hz)
  const byConv = groupWinrate(calls, hz, convictionBand, CONV_ORDER)
  const byRegime = groupWinrate(calls, hz, (c) => c.regime, REGIME_ORDER)
  const byPair = groupWinrate(calls, hz, (c) => c.pair).sort((a, b) => b.stats.n - a.stats.n).slice(0, 8)
  const resolvedAny = trackrecord.some((c) => c.outcomes.some((o) => o.resolved))

  // Lijst van losse voorspellingen, nieuwste eerst.
  const list = [...calls].sort((a, b) => (a.callDate < b.callDate ? 1 : a.callDate > b.callDate ? -1 : b.conviction - a.conviction)).slice(0, 80)

  return (
    <div>
      <HowToRead>
        <p>Dit is het rapport: <b>van alle voorspellingen die de tool heeft gedaan, hoe vaak zat de richting goed?</b></p>
        <ol>
          <li>Kies bovenaan <b>na hoeveel dagen</b> je wilt meten (1, 3, 5, 10 of 20). Alle cijfers rekenen mee.</li>
          <li><b>Trefkans</b> = % voorspellingen dat op die termijn de goede kant op eindigde. 50% = muntje.</li>
          <li>Onderaan staat de <b>volledige lijst</b>: welke dag, welk paar, dagcall of weekcall, en of die ene voorspelling op de gekozen termijn <b>juist</b> of <b>onjuist</b> was (of nog wacht).</li>
        </ol>
        <div className="fb-howto-ex">Voorbeeld: zet je op <b>1 dag</b> en staat bij NZD/JPY <span style={{ color: 'var(--win)', fontWeight: 700 }}>JUIST</span>, dan eindigde die koers één dag na de voorspelling de juiste kant op.</div>
      </HowToRead>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div>
          <span className="fb-mono" style={{ display: 'block', marginBottom: 6 }}>Na hoeveel dagen meten? <Tip text={TIP.dagen} /></span>
          <div className="fb-hz-toggle">
            {HORIZONS.map((h) => (
              <button key={h} className={`fb-hz-btn${hz === h ? ' active' : ''}`} onClick={() => setHz(h)}>{HZ_LABEL[h]}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="fb-mono" style={{ display: 'block', marginBottom: 6 }}>Soort call</span>
          <div className="fb-hz-toggle">
            {(['all', 'daily', 'weekly'] as const).map((t) => (
              <button key={t} className={`fb-hz-btn${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
                {t === 'all' ? 'Alle' : t === 'daily' ? 'Dagcalls' : 'Weekcalls'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!resolvedAny ? (
        <div className="fb-empty">
          Het rapport bouwt zich <b>vooruit</b> op — er zijn nog geen voorspellingen waarvan de termijn voorbij is.<br />
          Zodra de eerste calls hun venster hebben voltooid, verschijnt hier de trefkans en de lijst.
        </div>
      ) : (
        <>
          <div className="fb-kpis">
            <div className="fb-kpi"><div className="l">Trefkans · na {HZ_LABEL[hz]} <Tip text={TIP.trefkans} /></div><div className="v accent num">{overall.winrate}%</div></div>
            <div className="fb-kpi"><div className="l">Juist</div><div className="v win num">{overall.wins}</div></div>
            <div className="fb-kpi"><div className="l">Onjuist</div><div className="v loss num">{overall.losses}</div></div>
            <div className="fb-kpi"><div className="l">Beoordeeld</div><div className="v num">{overall.n}</div></div>
            <div className="fb-kpi"><div className="l">Nog wachten</div><div className="v num">{overall.pending}</div></div>
          </div>

          <div className="fb-bd">
            <BdCard title="Per zekerheid" tip={TIP.zekerheid} rows={byConv} />
            <BdCard title="Per marktregime" rows={byRegime} />
          </div>

          {/* Volledige lijst van losse voorspellingen */}
          <div className="fb-tr-list">
            <div className="fb-bd-title" style={{ marginBottom: 4 }}>Alle voorspellingen — oordeel na {HZ_LABEL[hz]}</div>
            <div className="fb-tr-head">
              <span>Datum</span>
              <span className="fb-tr-c-type">Soort</span>
              <span>Paar</span>
              <span style={{ textAlign: 'right' }}>Na {HZ_LABEL[hz]}</span>
            </div>
            {list.map((c) => {
              const o = outcomeAt(c, hz)
              const v = !o || !o.resolved || o.correct == null ? 'pending' : o.correct ? 'win' : 'loss'
              const long = c.direction === 'bullish'
              return (
                <div className="fb-tr-row" key={c.id}>
                  <span className="num">{fmtDate(c.callDate)}</span>
                  <span className="fb-tr-c-type"><span className="fb-tr-type">{c.callType === 'weekly' ? 'Week' : 'Dag'}</span></span>
                  <span>
                    <span className="fb-tr-pair">{c.pair}</span>{' '}
                    <span className={`fb-chip ${long ? 'long' : 'short'}`}>{dirLabel(c.direction)}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {v === 'pending'
                      ? <span className="fb-tr-verdict pending">nog wachten</span>
                      : (
                        <span title={o && o.exitPrice != null ? `instap ${fmtPrice(c.pair, c.entryPrice)} (${fmtDate(c.entryDate)}) → slot ${fmtPrice(c.pair, o.exitPrice)} (${fmtDate(o.exitDate)})` : ''}>
                          <span className={`fb-tr-verdict ${v}`}>{v === 'win' ? 'JUIST' : 'ONJUIST'}</span>
                        </span>
                      )}
                  </span>
                </div>
              )
            })}
            {calls.length > 80 && <p className="fb-note">Eerste 80 van {calls.length} getoond.</p>}
          </div>

          <div className="fb-bd" style={{ marginTop: 18 }}>
            <BdCard title="Per paar (meest voorspeld)" rows={byPair} />
            <div className="fb-bd-card">
              <div className="fb-bd-title">Kort samengevat</div>
              <p className="fb-note" style={{ marginTop: 0 }}>
                Klik een termijn (1/3/5/10/20 dagen) om te zien op welke termijn de tool het best voorspelt. Boven de 50% =
                de fundamentele richting was vaker juist dan een muntje. In de lijst hierboven zie je elke losse voorspelling met datum, paar, soort en het oordeel.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
