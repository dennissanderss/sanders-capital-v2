'use client'

import { useMemo, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS, MODEL_V2_SINCE } from '@/lib/fundamental/constants'
import { winStats, profitFactor, pfVerdict, sampleTier, convictionBand, HZ_LABEL, wilson, isV2Call, moveStats, MOVE_THRESHOLDS } from './helpers'
import { Tip, HowToRead } from './ui'

const CONV_ORDER = ['8.0+', '7.0–8.0', '6.0–7.0', '< 6.0']

function agg(calls: FbCall[], h: number) {
  const s = winStats(calls, h)
  return { n: s.n, flats: s.flats, winrate: s.winrate, wins: s.wins, pf: profitFactor(calls, h), tier: sampleTier(s.n) }
}
function pfText(pf: number | null) { return pf == null ? '—' : pf === Infinity ? '∞' : pf.toFixed(2) }
function pfCls(pf: number | null) {
  const v = pfVerdict(pf)
  return v ? (v.cls === 'win' ? 'fb-pos' : v.cls === 'loss' ? 'fb-neg' : '') : ''
}

function Row({ label, a }: { label: string; a: ReturnType<typeof agg> }) {
  const mark = a.n === 0 ? '' : a.tier.tier === 'ruis' ? '*' : a.tier.tier === 'voorlopig' ? '†' : ''
  return (
    <div className={`fb-an-row tier-${a.tier.tier}`}>
      <span className="fb-an-label">{label}</span>
      <span className="num fb-an-wr">{a.n === 0 ? '—' : `${a.winrate}%`}</span>
      <span className={`num fb-an-pf ${pfCls(a.pf)}`}>{pfText(a.pf)}</span>
      <span className="fb-an-n num">{a.n === 0 ? '—' : `n=${a.n}${mark}`}</span>
    </div>
  )
}

function Foot() {
  return <p className="fb-an-foot"><b>*</b> te weinig data (n&lt;30) — niet als edge lezen. <b>†</b> voorlopig (n&lt;100). Grijze rijen = onbetrouwbaar. PF op %-rendement (close-to-close); &quot;vlak&quot; (&lt; 0,15 × ATR beweging) telt niet mee in de trefkans.</p>
}

export function Analyse({ calls }: { calls: FbCall[] }) {
  // Slimme default: de termijn met de meeste beoordeelde calls — voorkomt dat
  // de tab opent op een lege doorsnede vol streepjes.
  const defaultHz = useMemo(() => {
    let best: number = HORIZONS[0], bestN = -1
    for (const h of HORIZONS) {
      const n = winStats(calls, h).n
      if (n > bestN) { best = h; bestN = n }
    }
    return best
  }, [calls])

  const [hz, setHz] = useState<number>(defaultHz)
  const [pair, setPair] = useState<string>('alle')
  const [bucket, setBucket] = useState<string>('alle')
  const [versie, setVersie] = useState<string>('alle')
  const [moveDrempel, setMoveDrempel] = useState<number>(30)

  const hasV1 = useMemo(() => calls.some((c) => !isV2Call(c)), [calls])
  const hasV2 = useMemo(() => calls.some(isV2Call), [calls])

  const versieFiltered = calls.filter((c) => versie === 'alle' || (versie === 'v2' ? isV2Call(c) : !isV2Call(c)))
  const allPairs = useMemo(() => [...new Set(versieFiltered.map((c) => c.pair))].sort(), [versieFiltered])

  const filtered = versieFiltered.filter((c) => (pair === 'alle' || c.pair === pair) && (bucket === 'alle' || convictionBand(c) === bucket))
  const head = agg(filtered, hz)

  const anyResolved = HORIZONS.some((h) => winStats(calls, h).n + winStats(calls, h).flats > 0)

  // Alleen rijen mét beoordeelde calls — geen muren van streepjes.
  const byBucket = CONV_ORDER
    .map((b) => ({ label: b, a: agg(filtered.filter((c) => convictionBand(c) === b), hz) }))
    .filter((g) => g.a.n + g.a.flats > 0)
  const byPair = allPairs
    .map((p) => ({ label: p, a: agg(filtered.filter((c) => c.pair === p), hz) }))
    .filter((g) => g.a.n + g.a.flats > 0)
    .sort((x, y) => y.a.n - x.a.n)

  // Kalibratie: zekerheid-bucket → waargenomen trefkans met Wilson-interval.
  // AUDIT-FIX: gebruikte versieFiltered en negeerde zo stilzwijgend de
  // paar/zekerheid-filters die de rest van de tab wél toepast.
  const calib = CONV_ORDER
    .map((b) => {
      const s = winStats(filtered.filter((c) => convictionBand(c) === b), hz)
      return { label: b, ...s, ci: wilson(s.wins, s.n) }
    })
    .filter((g) => g.n > 0)

  if (!anyResolved) {
    return (
      <div className="fb-empty">
        <b>Het trackrecord bouwt zich nog op.</b><br />
        Er zijn {calls.length > 0 ? `al ${calls.length} gelockte voorspellingen` : 'nog geen voorspellingen'}, maar nog geen enkele
        horizon is volledig verstreken en beoordeeld. Zodra de eerste vensters sluiten (1 handelsdag na een call), verschijnen hier
        de trefkans, profit factor en uitsplitsingen — eerlijk en zonder terugwerkende kracht.
      </div>
    )
  }

  return (
    <div>
      <HowToRead title="Hoe lees ik de analyse?">
        <p>Hier splits je de resultaten uit om te zien <b>waar</b> de tool het goed of slecht doet. Combineer gerust een termijn, een paar en een zekerheid-bucket.</p>
        <ol>
          <li><b>Sample-guards:</b> een uitsplitsing met weinig data is onbetrouwbaar. <span className="fb-an-tag ruis">te weinig data (n&lt;30)</span> = grijs, niet als edge lezen. <span className="fb-an-tag voorlopig">voorlopig</span> = 30–100. Daarboven betrouwbaar.</li>
          <li><b>Profit factor</b> is hier op <b>%-rendement</b> (niet pips): een pip op GBP/NZD is economisch iets anders dan op EUR/USD.</li>
          <li>Calls met vrijwel geen beweging (&lt; 0,15 × ATR) tellen als <b>vlak</b> en zitten niet in de trefkans.</li>
        </ol>
      </HowToRead>

      <div className="fb-an-controls">
        <div>
          <span className="fb-mono">Termijn <Tip text="Op hoeveel handelsdagen we meten." /></span>
          <div className="fb-hz-toggle">{HORIZONS.map((h) => <button key={h} className={`fb-hz-btn${hz === h ? ' active' : ''}`} onClick={() => setHz(h)}>{HZ_LABEL[h].replace(' dag', 'd').replace('en', '')}</button>)}</div>
        </div>
        <div>
          <span className="fb-mono">Paar</span>
          <select className="fb-select" value={pair} onChange={(e) => setPair(e.target.value)}>
            <option value="alle">Alle paren</option>
            {allPairs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <span className="fb-mono">Zekerheid</span>
          <select className="fb-select" value={bucket} onChange={(e) => setBucket(e.target.value)}>
            <option value="alle">Alle</option>
            {CONV_ORDER.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {hasV1 && hasV2 && (
          <div>
            <span className="fb-mono">Methodiek <Tip text={`Op ${MODEL_V2_SINCE} is de methodiek aangescherpt (v2: bias/timing gesplitst, kalender-verrassingen, AI-nieuwslabeling). Cijfers van vóór die datum zijn met v1 gemeten — meng ze bewust.`} /></span>
            <select className="fb-select" value={versie} onChange={(e) => setVersie(e.target.value)}>
              <option value="alle">Alles</option>
              <option value="v2">v2 (vanaf {MODEL_V2_SINCE})</option>
              <option value="v1">v1 (daarvoor)</option>
            </select>
          </div>
        )}
      </div>

      {hasV1 && hasV2 && versie === 'alle' && (
        <p className="fb-note" style={{ margin: '0 0 12px' }}>
          <b>Let op:</b> op {MODEL_V2_SINCE} is de methodiek aangescherpt (v2). Deze cijfers mengen oude (v1) en nieuwe (v2) calls — filter op methodiek om ze los te zien.
        </p>
      )}

      <div className={`fb-an-headline tier-${head.tier.tier}`}>
        <div><div className="l">Trefkans · {HZ_LABEL[hz]}</div><div className="v accent num">{head.n === 0 ? '—' : `${head.winrate}%`}</div></div>
        <div>
          <div className="l">Profit factor <Tip text="Som winst-% ÷ som verlies-% (close-to-close). Boven 1 = winners samen groter dan losers." /></div>
          <div className={`v num ${pfCls(head.pf)}`}>{pfText(head.pf)}</div>
          {pfVerdict(head.pf) && head.n > 0 && <div className={`fb-pf-verdict ${pfVerdict(head.pf)!.cls}`}>{pfVerdict(head.pf)!.text}</div>}
        </div>
        <div><div className="l">Beoordeeld</div><div className="v num">n={head.n}{head.flats > 0 && <span className="fb-an-flats"> +{head.flats} vlak</span>} {head.n > 0 && head.tier.tier !== 'betrouwbaar' && <span className={`fb-an-tag ${head.tier.tier}`}>{head.tier.label}</span>}</div></div>
      </div>

      <div className="fb-bd">
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per zekerheid <Tip text="Helpt zien of 'zekerder' ook vaker goed betekent." /></div>
          {byBucket.length === 0 ? <div className="fb-note" style={{ margin: 0 }}>Nog geen beoordeelde calls voor deze filters.</div> : (
            <>
              <div className="fb-an-head"><span></span><span>winrate</span><span title="Profit factor: opgetelde winst ÷ opgeteld verlies. Boven 1 = winstgevend, onder 1 = verliesgevend.">PF</span><span></span></div>
              {byBucket.map((g) => <Row key={g.label} label={g.label} a={g.a} />)}
            </>
          )}
        </div>
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per termijn (huidige filters)</div>
          <div className="fb-an-head"><span></span><span>winrate</span><span title="Profit factor: opgetelde winst ÷ opgeteld verlies. Boven 1 = winstgevend, onder 1 = verliesgevend.">PF</span><span></span></div>
          {HORIZONS.map((h) => <Row key={h} label={HZ_LABEL[h]} a={agg(filtered, h)} />)}
        </div>
      </div>

      {byPair.length > 0 && (
        <div className="fb-bd-card" style={{ marginTop: 18 }}>
          <div className="fb-bd-title">Per paar <Tip text="Op welke paren de fundamentele richting het best/slechtst werkt. Alleen paren met beoordeelde calls." /></div>
          <div className="fb-an-head"><span></span><span>winrate</span><span title="Profit factor: opgetelde winst ÷ opgeteld verlies. Boven 1 = winstgevend, onder 1 = verliesgevend.">PF</span><span></span></div>
          {byPair.map((g) => <Row key={g.label} label={g.label} a={g.a} />)}
        </div>
      )}

      {/* Move-kwaliteit: was de beweging groot genoeg om op te handelen? */}
      <div className="fb-bd-card" style={{ marginTop: 18 }}>
        <div className="fb-bd-title">
          Beweging — was er ook echt iets te verdienen? · {HZ_LABEL[hz]}
          <Tip text="Een juiste richting is niets waard als de koers nauwelijks beweegt. Dit meet per call de grootste beweging in de voorspelde richting binnen de termijn (na te rekenen via de call-details). 'Bruikbaar' = richting juist én beweging boven de drempel." />
        </div>
        <div className="fb-an-controls" style={{ margin: '4px 0 10px' }}>
          <div>
            <span className="fb-mono">Minimale beweging</span>
            <div className="fb-hz-toggle">
              {MOVE_THRESHOLDS.map((t) => (
                <button key={t} className={`fb-hz-btn${moveDrempel === t ? ' active' : ''}`} onClick={() => setMoveDrempel(t)}>{t} pips</button>
              ))}
            </div>
          </div>
        </div>
        {(() => {
          const head = moveStats(filtered, hz, moveDrempel)
          if (head.n === 0) return <div className="fb-note" style={{ margin: 0 }}>Nog geen beoordeelde calls met bewegingsdata voor deze filters.</div>
          return (
            <>
              <div className="fb-an-headline" style={{ marginBottom: 12 }}>
                <div><div className="l">Richting juist én ≥ {moveDrempel} pips mee</div><div className="v accent num">{head.n ? Math.round((head.correctWithMove / head.n) * 100) : 0}%</div></div>
                <div><div className="l">Van de juiste calls haalde de drempel</div><div className="v num">{head.pctCorrectWithMove}%</div></div>
                <div><div className="l">Mediane meebeweging</div><div className="v num">{head.medianMfe != null ? `${head.medianMfe}p` : '—'} <span className="fb-an-flats">n={head.n}</span></div></div>
              </div>
              <div className="fb-an-head"><span></span><span>juist+move</span><span>med. mee</span><span></span></div>
              {CONV_ORDER.map((b) => {
                const rows = filtered.filter((c) => convictionBand(c) === b)
                const s = moveStats(rows, hz, moveDrempel)
                if (s.n === 0) return null
                const tier = sampleTier(s.n)
                return (
                  <div key={b} className={`fb-an-row tier-${tier.tier}`}>
                    <span className="fb-an-label">{b}</span>
                    <span className="num fb-an-wr">{Math.round((s.correctWithMove / s.n) * 100)}%</span>
                    <span className="num fb-an-pf">{s.medianMfe != null ? `${s.medianMfe}p` : '—'}</span>
                    <span className="fb-an-n num">n={s.n}{tier.tier === 'ruis' ? '*' : tier.tier === 'voorlopig' ? '†' : ''}</span>
                  </div>
                )
              })}
              <p className="fb-an-foot">
                &quot;Juist+move&quot; = de richting klopte én de koers bewoog binnen de termijn minstens {moveDrempel} pips de voorspelde kant op — de calls waar een technische trader iets aan had. Het verse trackrecord is hiervoor nog dun; het tabblad <b>Bewijs</b> heeft dezelfde meting over 3.800+ gesimuleerde trades.
              </p>
            </>
          )
        })()}
      </div>

      {/* Kalibratie: wordt de zekerheid ook waargemaakt? */}
      <div className="fb-bd-card" style={{ marginTop: 18 }}>
        <div className="fb-bd-title">
          Kalibratie — zekerheid → waargenomen trefkans · {HZ_LABEL[hz]}
          <Tip text="Dé test van de tool: zaten calls met een hogere zekerheid ook vaker goed? De balk toont het 95%-betrouwbaarheidsinterval (Wilson) — hoe minder data, hoe breder de balk. Pas als het interval boven de 50%-lijn ligt, is er bewijs van edge." />
        </div>
        {calib.length === 0 ? (
          <div className="fb-note" style={{ margin: 0 }}>Nog geen beoordeelde calls op deze termijn.</div>
        ) : (
          <div className="fb-calib">
            {calib.map((g) => (
              <div className="fb-calib-row" key={g.label}>
                <span className="fb-calib-label">{g.label}</span>
                <div className="fb-calib-track">
                  <span className="fb-calib-mid" />
                  <span className="fb-calib-ci" style={{ left: `${g.ci.lo}%`, width: `${Math.max(2, g.ci.hi - g.ci.lo)}%` }} />
                  <span className="fb-calib-dot" style={{ left: `${g.winrate}%` }} />
                </div>
                <span className="num fb-calib-val">{g.winrate}%</span>
                <span className="fb-an-n num">n={g.n}</span>
              </div>
            ))}
            <p className="fb-an-foot" style={{ marginTop: 8 }}>Stip = waargenomen trefkans · balk = 95%-interval · streep = 50% (muntje). Bij weinig data is de balk breed: nog geen conclusie trekken.</p>
          </div>
        )}
      </div>

      <Foot />
    </div>
  )
}
