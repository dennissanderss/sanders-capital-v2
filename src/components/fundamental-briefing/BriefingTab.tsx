'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS, TIMING_TRADEABLE } from '@/lib/fundamental/constants'
import { CallDetail } from './CallDetail'
import { dirLabel, fmtDate, zekerheidTier, verdictOf, outcomeAt, timingScoreOf, biasScoreOf, isV2Call } from './helpers'

// v1-fallback: onder deze zekerheid is een call te zwak om te handelen.
// Voor v2-calls geldt de bewezen regel uit de simulatie: timing ≥ 7.
const TRADE_MIN = 5

function isTradeable(c: FbCall): boolean {
  const timing = timingScoreOf(c)
  if (timing != null) return timing >= TIMING_TRADEABLE
  return c.conviction >= TRADE_MIN
}

function CallRow({ c, sel, onSelect }: { c: FbCall; sel: boolean; onSelect: () => void }) {
  const long = c.direction === 'bullish'
  const tier = zekerheidTier(c.conviction)
  const timing = timingScoreOf(c)
  const hasEvents = (c.reasoning.eventRisk?.length ?? 0) > 0
  return (
    <div className={`fb-row${sel ? ' sel' : ''}`} onClick={onSelect}>
      <span className={`fb-chip ${long ? 'long' : 'short'}`}>{dirLabel(c.direction)}</span>
      <div>
        <div className="fb-row-pair">{c.pair}{hasEvents && <span className="fb-ev-flag" title="High-impact cijfers binnen 2 dagen">⚠</span>}</div>
        <div className="fb-row-meta">
          <span className="fb-dots">
            {HORIZONS.map((h) => {
              const v = verdictOf(c, outcomeAt(c, h))
              const cls = v === 'win' ? ' win' : v === 'loss' ? ' loss' : v === 'flat' ? ' flat' : ''
              return <span key={h} className={`fb-hdot${cls}`} title={`${h} dagen`} />
            })}
          </span>
          {timing != null
            ? <> · bias <b className="num">{biasScoreOf(c).toFixed(1)}</b> · timing <b className={`num${timing < 4 ? ' fb-timing-low' : ''}`}>{timing.toFixed(1)}</b></>
            : <> · instap {fmtDate(c.entryDate)}</>}
        </div>
      </div>
      <div className="fb-row-conv-cell">
        <span className="fb-row-conv num" title="zekerheid (0-10)">{c.conviction.toFixed(1)}</span>
        <span className={`fb-ztag ${tier.cls}`}>{tier.label}</span>
      </div>
    </div>
  )
}

export function BriefingTab({ calls, kind, emptyText, hoofdhorizon, focusPair, today }: {
  calls: FbCall[]; kind: 'daily' | 'weekly' | 'position'; emptyText: string; hoofdhorizon: number; focusPair?: string | null; today?: string
}) {
  const isCarry = kind === 'position'
  const sorted = useMemo(() => [...calls].sort((a, b) => b.conviction - a.conviction), [calls])
  // Positie-calls zijn al voorgefilterd (≥ 2pp carry, niet in Risk-Off) —
  // daar is alles "tradeable". Day/swing: timing ≥ 7 (het bewezen filter).
  const strong = useMemo(() => sorted.filter((c) => isCarry || isTradeable(c)), [sorted, isCarry])
  const weak = useMemo(() => sorted.filter((c) => !isCarry && !isTradeable(c)), [sorted, isCarry])

  const [selId, setSelId] = useState<string | null>(null)
  const [showWeak, setShowWeak] = useState(false)

  // Doorklik vanaf "Alle paren": selecteer die call (ook als hij bij de
  // zwakke signalen staat — klap die dan open).
  useEffect(() => {
    if (!focusPair) return
    const hit = sorted.find((c) => c.pair === focusPair)
    if (hit) {
      setSelId(hit.id)
      if (!isCarry && !isTradeable(hit)) setShowWeak(true)
    }
  }, [focusPair, sorted, isCarry])

  useEffect(() => {
    const pref = strong[0]?.id ?? sorted[0]?.id ?? null
    if (!selId || !sorted.find((c) => c.id === selId)) setSelId(pref)
  }, [sorted, strong, selId])

  const anyV2 = sorted.some(isV2Call)

  // Waarom geen verse calls? Weekend (markt dicht) of de ochtend-cron is
  // nog niet geweest. Zonder deze uitleg lijkt "oude datum" op een defect.
  const latestDate = sorted[0]?.callDate
  const isStale = !!(today && latestDate && latestDate < today)
  const dowNow = new Date().getUTCDay()
  const isWeekendNow = dowNow === 0 || dowNow === 6
  const staleBanner = isStale ? (
    <div className="fb-mode-banner">
      {isWeekendNow ? (
        <>🛌 <b>Weekend — de forexmarkt is dicht.</b> Er worden geen nieuwe calls gelockt; dit zijn de calls van <b>{fmtDate(latestDate!)}</b> (de laatste handelsdag). Maandagochtend rond <b>08:30</b> (NL) verschijnen verse calls.</>
      ) : (
        <>⏳ <b>De calls van vandaag zijn nog niet gelockt.</b> Dat gebeurt elke werkdagochtend rond <b>08:30</b> (NL). Tot dan zie je de calls van <b>{fmtDate(latestDate!)}</b>.</>
      )}
    </div>
  ) : null

  const intro = isCarry ? (
    <p className="fb-calls-intro">
      <b>Positie-lens (carry).</b> Richting = de valuta met de duidelijk hoogste beleidsrente (≥ 2pp verschil), weken aanhouden.
      Je verdient aan het renteverschil (swap) én de koersdrift; in een <b>Risk-Off</b>-regime worden er géén positie-calls gegeven — daar crasht carry historisch.
      Simulatie op 20 dagen: <b>69,8% winrate · PF 4,82 incl. swap</b> (n=126, voorlopig).
    </p>
  ) : (
    <p className="fb-calls-intro">
      <b>Sterkste calls bovenaan.</b> Het getal is de zekerheid (0–10).
      {anyV2 && <> Elke call heeft ook een <b>bias</b> (hoe sterk de fundamentele these is) en een <b>timing</b> (hoe gunstig dít instapmoment is). Uit de 2-jaars simulatie (tabblad <b>Bewijs</b>): de edge zat vrijwel volledig in calls met <b>timing ≥ {TIMING_TRADEABLE}</b> — daarom staan alleen díe bij &quot;tradeable&quot;.</>}
      {!anyV2 && <> Zwakke calls (onder de {TRADE_MIN}) staan apart — die wil je niet traden.</>}
    </p>
  )

  if (sorted.length === 0) {
    return (
      <div>
        {intro}
        <div className="fb-empty">
          {isWeekendNow
            ? <>🛌 <b>Weekend — de forexmarkt is dicht.</b><br />Er worden geen calls gelockt op zaterdag en zondag. Maandagochtend rond 08:30 (NL) staan hier verse calls.</>
            : emptyText}
        </div>
      </div>
    )
  }
  const sel = sorted.find((c) => c.id === selId) || strong[0] || sorted[0]

  return (
    <div>
      {staleBanner}
      {intro}
      <div className="fb-legend">
        <span className="it"><span className="fb-hdot win" /> goed</span>
        <span className="it"><span className="fb-hdot loss" /> fout</span>
        <span className="it"><span className="fb-hdot flat" /> vlak (nauwelijks beweging)</span>
        <span className="it"><span className="fb-hdot" /> nog wachten</span>
        <span className="it">5 bolletjes = 1 / 3 / 5 / 10 / 20 dagen</span>
      </div>

      <div className="fb-layout">
        <div className="fb-list">
          <div className="fb-list-head">Tradeable calls{strong.length > 0 ? ` (${strong.length})` : ''}</div>
          {strong.length === 0
            ? <div className="fb-empty" style={{ padding: '22px 14px', fontSize: 12.5 }}>{anyV2
              ? `Geen calls met timing ≥ ${TIMING_TRADEABLE} vandaag. De fundamentele biases staan hieronder — kijken mag, instappen liever niet.`
              : 'Geen calls met genoeg bevestiging vandaag — alle signalen zijn zwak. Vandaag liever niet handelen op deze tool.'}</div>
            : strong.map((c) => <CallRow key={c.id} c={c} sel={c.id === sel.id} onSelect={() => setSelId(c.id)} />)}

          {weak.length > 0 && (
            <>
              <button className="fb-weak-toggle" onClick={() => setShowWeak((s) => !s)}>
                {showWeak ? '▲' : '▼'} {anyV2 ? `Timing te laag — bias zien, nog niet instappen (${weak.length})` : `Zwakkere signalen — niet handelen (${weak.length})`}
              </button>
              {showWeak && (
                <div className="fb-weak-list">
                  {weak.map((c) => <CallRow key={c.id} c={c} sel={c.id === sel.id} onSelect={() => setSelId(c.id)} />)}
                </div>
              )}
            </>
          )}
        </div>
        <CallDetail call={sel} hoofdhorizon={hoofdhorizon} />
      </div>
    </div>
  )
}
