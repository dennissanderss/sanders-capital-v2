'use client'

import type { FbCall } from '@/lib/fundamental/types'
import { winStats, profitFactor, outcomeAt, closeToClosePips, fmtDate, fmtPrice, dirLabel, HZ_LABEL } from './helpers'
import { Tip, HowToRead } from './ui'

function verdictOf(c: FbCall, h: number): 'win' | 'loss' | 'pending' {
  const o = outcomeAt(c, h)
  return !o || !o.resolved || o.correct == null ? 'pending' : o.correct ? 'win' : 'loss'
}

export function Trackrecord({ calls, hoofdhorizon, secondaryHorizons, lensLabel }: {
  calls: FbCall[]; hoofdhorizon: number; secondaryHorizons: number[]; lensLabel: string
}) {
  const overall = winStats(calls, hoofdhorizon)
  const pf = profitFactor(calls, hoofdhorizon)
  const list = [...calls].sort((a, b) => (a.callDate < b.callDate ? 1 : a.callDate > b.callDate ? -1 : b.conviction - a.conviction)).slice(0, 100)

  return (
    <div>
      <HowToRead>
        <p>Het rapport voor de <b>{lensLabel}</b>-lens: van alle voorspellingen, hoe vaak zat de richting goed op <b>{HZ_LABEL[hoofdhorizon]}</b>?</p>
        <ol>
          <li><b>Trefkans</b> = % voorspellingen dat de goede kant op eindigde. 50% = muntje.</li>
          <li><b>Profit factor</b> = som winst-pips ÷ som verlies-pips. Boven 1 = de winners waren samen groter dan de losers.</li>
          <li>In de lijst zie je elke losse voorspelling met <b>referentiekoers → eindkoers</b> en het oordeel — na te checken in TradingView.</li>
        </ol>
      </HowToRead>

      <div className="fb-data-banner">
        <b>{calls.length}</b> voorspellingen · <b>{overall.n}</b> al beoordeeld op {HZ_LABEL[hoofdhorizon]} · <b>{overall.pending}</b> nog wachten.
        {overall.n < 30 && <span className="fb-warn"> Nog te weinig data voor harde conclusies — het rapport bouwt vooruit op.</span>}
      </div>

      {overall.n === 0 ? (
        <div className="fb-empty">Nog geen voorspellingen waarvan de {HZ_LABEL[hoofdhorizon]} voorbij is. Zodra de eerste vensters sluiten, verschijnt hier de trefkans en de lijst.</div>
      ) : (
        <>
          <div className="fb-kpis">
            <div className="fb-kpi"><div className="l">Trefkans · {HZ_LABEL[hoofdhorizon]} <Tip text="Van alle beoordeelde voorspellingen op deze termijn: hoeveel % zat goed. 50% = muntje." /></div><div className="v accent num">{overall.winrate}%</div></div>
            <div className="fb-kpi"><div className="l">Profit factor <Tip text="Som winst-pips ÷ som verlies-pips. Boven 1 = winst." /></div><div className="v num">{pf == null ? '—' : pf === Infinity ? '∞' : pf}</div></div>
            <div className="fb-kpi"><div className="l">Juist</div><div className="v win num">{overall.wins}</div></div>
            <div className="fb-kpi"><div className="l">Onjuist</div><div className="v loss num">{overall.losses}</div></div>
            <div className="fb-kpi"><div className="l">Nog wachten</div><div className="v num">{overall.pending}</div></div>
          </div>

          <p className="fb-note" style={{ margin: '0 0 12px' }}><b>Let op:</b> dit meet of de richting klopte, niet of je de trade onderweg had kunnen uithouden. Puur slotkoers, geen take profit of stop loss.</p>

          <div className="fb-tr-list">
            <div className="fb-bd-title" style={{ marginBottom: 4 }}>Alle voorspellingen — oordeel na {HZ_LABEL[hoofdhorizon]}</div>
            <div className="fb-tr2-head">
              <span>Datum</span><span>Paar</span><span>Referentie</span><span>Eindkoers</span><span>Na {HZ_LABEL[hoofdhorizon]}</span>
              <span className="fb-tr2-sec">{secondaryHorizons.map((h) => HZ_LABEL[h].replace(' dag', 'd').replace('en', '')).join(' / ')}</span>
            </div>
            {list.map((c) => {
              const o = outcomeAt(c, hoofdhorizon)
              const v = verdictOf(c, hoofdhorizon)
              const long = c.direction === 'bullish'
              const pips = closeToClosePips(c, o)
              return (
                <div className="fb-tr2-row" key={c.id}>
                  <span className="num">{fmtDate(c.callDate)}</span>
                  <span><b>{c.pair}</b> <span className={`fb-chip ${long ? 'long' : 'short'}`}>{dirLabel(c.direction)}</span></span>
                  <span className="num">{fmtPrice(c.pair, c.entryPrice)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(c.entryDate)}</span></span>
                  <span className="num">{o?.exitPrice != null ? <>{fmtPrice(c.pair, o.exitPrice)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtDate(o.exitDate)}</span></> : '—'}</span>
                  <span>
                    {v === 'pending'
                      ? <span className="fb-tr-verdict pending">wacht</span>
                      : <span className={`fb-tr-verdict ${v}`}>{v === 'win' ? 'JUIST' : 'ONJUIST'}{pips != null ? <span className="num" style={{ fontWeight: 400, marginLeft: 4 }}>{pips > 0 ? '+' : ''}{pips}p</span> : null}</span>}
                  </span>
                  <span className="fb-tr2-sec">
                    {secondaryHorizons.map((h) => {
                      const sv = verdictOf(c, h)
                      return <span key={h} className={`fb-mini ${sv}`} title={`${HZ_LABEL[h]}: ${sv === 'win' ? 'juist' : sv === 'loss' ? 'onjuist' : 'wacht'}`}>{sv === 'win' ? 'J' : sv === 'loss' ? 'O' : '·'}</span>
                    })}
                  </span>
                </div>
              )
            })}
            {calls.length > 100 && <p className="fb-note">Eerste 100 van {calls.length} getoond.</p>}
          </div>
        </>
      )}
    </div>
  )
}
