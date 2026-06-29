'use client'

import { useMemo, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { winStats, profitFactor, sampleTier, convictionBand, HZ_LABEL } from './helpers'
import { Tip, HowToRead } from './ui'

const CONV_ORDER = ['8.0+', '7.0–8.0', '6.0–7.0', '< 6.0']

function agg(calls: FbCall[], h: number) {
  const s = winStats(calls, h)
  return { n: s.n, winrate: s.winrate, pf: profitFactor(calls, h), tier: sampleTier(s.n) }
}
function pfText(pf: number | null) { return pf == null ? '—' : pf === Infinity ? '∞' : pf.toFixed(2) }

function Row({ label, a }: { label: string; a: ReturnType<typeof agg> }) {
  const mark = a.n === 0 ? '' : a.tier.tier === 'ruis' ? '*' : a.tier.tier === 'voorlopig' ? '†' : ''
  return (
    <div className={`fb-an-row tier-${a.tier.tier}`}>
      <span className="fb-an-label">{label}</span>
      <span className="num fb-an-wr">{a.n === 0 ? '—' : `${a.winrate}%`}</span>
      <span className="num fb-an-pf">{pfText(a.pf)}</span>
      <span className="fb-an-n num">{a.n === 0 ? '—' : `n=${a.n}${mark}`}</span>
    </div>
  )
}

function Foot() {
  return <p className="fb-an-foot"><b>*</b> te weinig data (n&lt;30) — niet als edge lezen. <b>†</b> voorlopig (n&lt;100). Grijze rijen = onbetrouwbaar.</p>
}

export function Analyse({ calls }: { calls: FbCall[] }) {
  const [hz, setHz] = useState<number>(5)
  const [pair, setPair] = useState<string>('alle')
  const [bucket, setBucket] = useState<string>('alle')

  const allPairs = useMemo(() => [...new Set(calls.map((c) => c.pair))].sort(), [calls])

  const filtered = calls.filter((c) => (pair === 'alle' || c.pair === pair) && (bucket === 'alle' || convictionBand(c) === bucket))
  const head = agg(filtered, hz)

  const byBucket = CONV_ORDER.map((b) => ({ label: b, calls: filtered.filter((c) => convictionBand(c) === b) }))
  const byPair = allPairs.map((p) => ({ label: p, calls: filtered.filter((c) => c.pair === p) })).filter((g) => g.calls.length > 0)
    .map((g) => ({ ...g, _n: winStats(g.calls, hz).n })).sort((a, b) => b._n - a._n)

  return (
    <div>
      <HowToRead title="Hoe lees ik de analyse?">
        <p>Hier splits je de resultaten uit om te zien <b>waar</b> de tool het goed of slecht doet. Combineer gerust een termijn, een paar en een zekerheid-bucket.</p>
        <ol>
          <li><b>Sample-guards:</b> een uitsplitsing met weinig data is onbetrouwbaar. <span className="fb-an-tag ruis">te weinig data (n&lt;30)</span> = grijs, niet als edge lezen. <span className="fb-an-tag voorlopig">voorlopig</span> = 30–100. Daarboven betrouwbaar.</li>
          <li>Toon altijd de <b>n</b> (aantal beoordeelde calls) naast elk percentage.</li>
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
      </div>

      <div className={`fb-an-headline tier-${head.tier.tier}`}>
        <div><div className="l">Trefkans · {HZ_LABEL[hz]}</div><div className="v accent num">{head.n === 0 ? '—' : `${head.winrate}%`}</div></div>
        <div><div className="l">Profit factor</div><div className="v num">{pfText(head.pf)}</div></div>
        <div><div className="l">Beoordeeld</div><div className="v num">n={head.n} {head.n > 0 && head.tier.tier !== 'betrouwbaar' && <span className={`fb-an-tag ${head.tier.tier}`}>{head.tier.label}</span>}</div></div>
      </div>

      <div className="fb-bd">
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per zekerheid <Tip text="Helpt zien of 'zekerder' ook vaker goed betekent." /></div>
          <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
          {byBucket.map((g) => <Row key={g.label} label={g.label} a={agg(g.calls, hz)} />)}
          <Foot />
        </div>
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per termijn (huidige filters)</div>
          <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
          {HORIZONS.map((h) => <Row key={h} label={HZ_LABEL[h]} a={agg(filtered, h)} />)}
          <Foot />
        </div>
      </div>

      <div className="fb-bd-card" style={{ marginTop: 18 }}>
        <div className="fb-bd-title">Per paar <Tip text="Op welke paren de fundamentele richting het best/slechtst werkt." /></div>
        <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
        {byPair.length === 0 ? <div className="fb-note">Geen data voor deze filters.</div> : byPair.map((g) => <Row key={g.label} label={g.label} a={agg(g.calls, hz)} />)}
        <Foot />
      </div>
    </div>
  )
}
