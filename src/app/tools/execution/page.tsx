'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TRADE_MODELS, DEFAULT_MODEL } from '@/lib/execution-types'

// ─── Types ───────────────────────────────────────────────────
interface PairBias {
  pair: string; base: string; quote: string; direction: string; conviction: string
  score: number; scoreWithoutNews: number; newsInfluence: number
  baseBias: string; quoteBias: string; rateDiff: number | null
  tradeFocusTier?: string; regimeAligned?: boolean
}
interface V3Signal {
  pair: string; signal: string; score: number
  priceMomentum: { direction: string; pips1d: number; pips5d: number; atr20d: number; extensionRatio: number }
}
interface TradeCandidate {
  pair: string; base: string; quote: string; direction: string; conviction: string
  score: number; baseBias: string; quoteBias: string; rateDiff: number | null
  momentum5d: number; atr: number
  scorePass: boolean; imPass: boolean; contrarianPass: boolean; directionPass: boolean
  filterCount: number; isConcreTrade: boolean
  inMomentumZone: boolean; momentumStatus: string; entryReady: boolean
  qualityScore: number
}

// ─── Tooltip ─────────────────────────────────────────────────
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip cursor-help inline">
      <span className="border-b border-dotted border-text-dim/40">{label}</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:block z-30 w-64 px-3 py-2.5 rounded-lg bg-[#0d1016] border border-white/10 shadow-2xl text-[9px] text-text-muted text-left pointer-events-none leading-relaxed">
        {children}
      </span>
    </span>
  )
}

export default function ExecutionPage() {
  const [candidates, setCandidates] = useState<TradeCandidate[]>([])
  const [regime, setRegime] = useState({ regime: '', confidence: 0, im: 0 })
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [expandedPair, setExpandedPair] = useState<string | null>(null)
  const [accountBalance, setAccountBalance] = useState(10000)
  const [showNonConcrete, setShowNonConcrete] = useState(false)
  const [showTrackRecord, setShowTrackRecord] = useState(false)
  const [trackRecord, setTrackRecord] = useState<{
    overall: { total: number; resolved: number; pending: number; correct: number; winRate: number }
    models: Record<string, { total: number; correct: number; incorrect: number; winRate: number; totalPips: number }>
    recentTrades: { date: string; pair: string; direction: string; score: number; momentum: number; result: string; pips: number; selective: boolean; balanced: boolean }[]
  } | null>(null)

  const model = TRADE_MODELS[selectedModel]

  const [backtestTrades, setBacktestTrades] = useState<{ date: string; pair: string; direction: string; score: number; momentum: number; result: string; pips: number }[]>([])

  // Fetch trackrecord (live + backtest)
  useEffect(() => {
    // Live trackrecord
    fetch('/api/cron/execution').then(r => r.json()).then(d => {
      if (!d.error) setTrackRecord(d)
    }).catch(() => {})

    // Backtest trades uit fundamenteel trackrecord
    fetch('/api/trackrecord-v2').then(r => {
      if (!r.ok) throw new Error('Status ' + r.status)
      return r.json()
    }).then(d => {
      if (d.records && Array.isArray(d.records)) {
        const resolved = d.records.filter((t: { result: string }) => t.result === 'correct' || t.result === 'incorrect')
        setBacktestTrades(resolved.map((t: { date: string; pair: string; direction: string; score: number; metadata?: { momentum5d?: number }; result: string; pips_moved: number }) => ({
          date: t.date, pair: t.pair, direction: t.direction, score: t.score,
          momentum: Math.abs(t.metadata?.momentum5d || 0), result: t.result, pips: t.pips_moved || 0,
        })))
      }
    }).catch((e) => { console.warn('Backtest fetch failed:', e) })
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/briefing-v2')
      const d = await res.json()
      if (d.error) { setError(d.error); setLoading(false); return }

      const imAlignment = d.intermarketAlignment ?? 0
      setRegime({ regime: d.regime || 'Gemengd', confidence: d.confidence || 0, im: imAlignment })
      setGeneratedAt(d.generatedAt || '')

      const v3Signals: V3Signal[] = d.v3?.pairSignals || []

      const allCandidates: TradeCandidate[] = (d.pairBiases || [])
        .filter((p: PairBias) => p.direction !== 'neutraal' && p.conviction !== 'geen')
        .map((p: PairBias) => {
          const v3 = v3Signals.find(s => s.pair === p.pair)
          const pips5d = v3?.priceMomentum?.pips5d ?? 0
          const atr = v3?.priceMomentum?.atr20d ?? 0
          const absScore = Math.abs(p.score)
          const isBullish = p.direction.includes('bullish')
          const isBearish = p.direction.includes('bearish')

          const scorePass = absScore >= 2.0
          const imPass = imAlignment > 50
          const contrarianPass = (isBullish && pips5d < 0) || (isBearish && pips5d > 0)
          const directionPass = isBullish || isBearish
          const filterCount = [scorePass, imPass, contrarianPass, directionPass].filter(Boolean).length
          const isConcreTrade = scorePass && imPass && contrarianPass && directionPass

          const absMom = Math.abs(pips5d)
          let inMomentumZone = false, momentumStatus = ''
          if (!contrarianPass) { momentumStatus = 'Niet contrarian' }
          else if (model.momMin === 0) { inMomentumZone = true; momentumStatus = 'In zone' }
          else if (absMom >= model.momMin && absMom <= model.momMax) { inMomentumZone = true; momentumStatus = `In zone (${absMom}p)` }
          else if (absMom < model.momMin) { momentumStatus = `${absMom}p — nodig: ${model.momMin}p` }
          else { momentumStatus = `${absMom}p — te ver (max ${model.momMax}p)` }

          // Quality score 1-10
          const fundPts = Math.min(absScore / 5, 1) * 4
          const contrarianPts = contrarianPass ? (absMom >= 30 && absMom <= 120 ? 2.5 : 1.5) : 0
          const imPts = (imAlignment / 100) * 2
          const regimePts = p.regimeAligned ? 1.5 : 0.5
          const qualityScore = Math.min(10, Math.round((fundPts + contrarianPts + imPts + regimePts) * 10) / 10)

          return {
            pair: p.pair, base: p.base, quote: p.quote, direction: p.direction,
            conviction: p.conviction, score: p.score, baseBias: p.baseBias,
            quoteBias: p.quoteBias, rateDiff: p.rateDiff, momentum5d: pips5d, atr,
            scorePass, imPass, contrarianPass, directionPass, filterCount, isConcreTrade,
            inMomentumZone, momentumStatus, entryReady: isConcreTrade && inMomentumZone,
            qualityScore,
          }
        })

      allCandidates.sort((a, b) => {
        if (a.entryReady !== b.entryReady) return a.entryReady ? -1 : 1
        if (a.isConcreTrade !== b.isConcreTrade) return a.isConcreTrade ? -1 : 1
        return b.filterCount - a.filterCount || Math.abs(b.score) - Math.abs(a.score)
      })

      setCandidates(allCandidates)
      setError(null)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.momMin, model.momMax])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh elke 5 minuten
  useEffect(() => {
    const interval = setInterval(() => { fetchData() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const concreteTrades = candidates.filter(c => c.isConcreTrade)
  const nearMisses = candidates.filter(c => !c.isConcreTrade && c.filterCount >= 3)
  const entryReady = candidates.filter(c => c.entryReady)
  const riskPerTrade = accountBalance * 0.01
  const riskPerPip = riskPerTrade / model.sl
  const monthlyProfit = model.expectedExp * riskPerPip * model.tradesPerMonth

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* ═══ HEADER ═══ */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-accent-light/60 mb-1">Sanders Capital</p>
        <h1 className="text-2xl font-display font-bold text-heading">Execution Engine</h1>
        <p className="text-sm text-text-dim mt-1">
          Neemt de concrete trades uit je <Link href="/tools/fx-selector" className="text-accent-light hover:underline font-semibold">Daily Macro Briefing</Link> en bepaalt het optimale instapmoment met een bewezen technisch timing model.
        </p>
        <div className="mt-3 flex items-center gap-2 text-[10px]">
          <Link href="/tools/fx-selector" className="px-2.5 py-1 rounded-lg border border-accent/20 bg-accent/5 text-accent-light hover:bg-accent/10 transition-colors">
            Briefing
          </Link>
          <span className="text-text-dim/30">&rarr;</span>
          <span className="px-2.5 py-1 rounded-lg border border-accent/40 bg-accent/10 text-accent-light font-bold">
            Execution Engine
          </span>
          <span className="text-text-dim/30">&rarr;</span>
          <a href="#engine-trackrecord" className="px-2.5 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-text-dim hover:text-accent-light hover:border-accent/20 transition-colors">
            Engine Trackrecord ↓
          </a>
        </div>
      </div>

      {/* ═══ STAP 1: FLOW ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold text-accent-light bg-accent/10 px-2 py-0.5 rounded">Stap 1</span>
          <span className="text-sm font-semibold text-heading">Van fundamentele bias naar entry</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              { n:'1', t:'Briefing Bias', d:'Je Daily Macro Briefing geeft concrete trades — paren die alle 4 fundamentele filters hebben gepasseerd (score, IM, contrarian, richting).', c:'text-accent-light', bg:'border-accent/20 bg-accent/5' },
              { n:'2', t:'Momentum Zone', d:`De engine checkt automatisch: is de prijs genoeg pips tegen die bias bewogen in 5 dagen? Dit noemen we de momentum zone — het optimale mean reversion moment.`, c:'text-amber-400', bg:'border-amber-500/20 bg-amber-500/5' },
              { n:'3', t:'1H Reversal Candle', d:'Open de 1H chart van het pair. Wacht tot je een candle ziet die omdraait in de richting van je bias. Bullish candle bij long, bearish candle bij short.', c:'text-purple-400', bg:'border-purple-500/20 bg-purple-500/5' },
              { n:'4', t:'Execute', d:`Entry op de close van die candle. Stop loss: ${model.sl} pips. Take profit: ${model.tp} pips. Risk/reward: 1:${model.rr}. Laat de trade lopen — niet aanraken.`, c:'text-green-400', bg:'border-green-500/20 bg-green-500/5' },
            ].map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.bg} relative`}>
                <div className={`text-[10px] font-bold ${s.c} mb-1`}>Stap {s.n}</div>
                <p className="text-[10px] font-semibold text-heading mb-1">{s.t}</p>
                <p className="text-[9px] text-text-dim leading-relaxed">{s.d}</p>
                {i < 3 && <div className="hidden sm:block absolute top-1/2 -right-2 text-text-dim/20 text-lg font-bold">&rsaquo;</div>}
              </div>
            ))}
          </div>

          {/* Entry uitleg */}
          <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[10px] font-semibold text-heading mb-2">De entry in detail</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[9px] text-text-dim">
              <div>
                <p className="text-text-muted font-semibold mb-1">Wat is een reversal candle?</p>
                <p>Een 1H candle die in de richting van je bias sluit. Bij een <span className="text-green-400">LONG</span> trade: een groene candle (close boven open). Bij een <span className="text-red-400">SHORT</span> trade: een rode candle (close onder open). Dit is het bewijs dat de prijs begint om te draaien.</p>
              </div>
              <div>
                <p className="text-text-muted font-semibold mb-1">Waar zet je de stop loss?</p>
                <p>Exact <strong className="text-heading">{model.sl} pips</strong> van je entry. Bij long: {model.sl}p onder je entry. Bij short: {model.sl}p boven je entry. Dit is gebaseerd op analyse van 400 trades — winnende trades bewegen gemiddeld maar 15-19 pips tegen je.</p>
              </div>
              <div>
                <p className="text-text-muted font-semibold mb-1">Waar zet je de take profit?</p>
                <p>Exact <strong className="text-heading">{model.tp} pips</strong> van je entry. Geen partials — laat de volledige positie open tot TP of SL geraakt wordt. De 1:{model.rr} RR betekent: je hoeft maar 1 op {model.rr} trades te winnen om break-even te draaien.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STAP 2: MODEL KEUZE ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Stap 2</span>
          <span className="text-sm font-semibold text-heading">Kies je model</span>
        </div>
        <div className="p-5">
          <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[10px] text-text-dim space-y-2">
            <p className="text-text-muted font-semibold">Eén strategie, één keuze</p>
            <p>De 3 modellen zijn <strong className="text-heading">dezelfde strategie</strong> — zelfde entry (1H reversal candle), zelfde SL ({model.sl}p), zelfde TP ({model.tp}p). Het enige verschil is <strong className="text-heading">hoeveel pips de prijs moet gedaald/gestegen zijn</strong> voordat je mag instappen.</p>
            <p>Stel: de briefing zegt &ldquo;AUD/CAD SHORT&rdquo;. De prijs is 45 pips gestegen in 5 dagen (tegen de bearish bias).</p>
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Selective (30-120p)</p>
                <p className="text-green-400">45p valt in de zone → <strong>entry</strong></p>
              </div>
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Balanced (20-150p)</p>
                <p className="text-green-400">45p valt in de zone → <strong>entry</strong></p>
              </div>
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Aggressive (alle)</p>
                <p className="text-green-400">Altijd entry → <strong>entry</strong></p>
              </div>
            </div>
            <p>Nu stel: de prijs is maar 15 pips gestegen:</p>
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Selective (30-120p)</p>
                <p className="text-amber-400">15p &lt; 30p → <strong>wacht</strong></p>
              </div>
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Balanced (20-150p)</p>
                <p className="text-amber-400">15p &lt; 20p → <strong>wacht</strong></p>
              </div>
              <div className="p-2 rounded bg-white/[0.03]">
                <p className="text-heading font-semibold">Aggressive (alle)</p>
                <p className="text-green-400">Altijd → <strong>entry</strong></p>
              </div>
            </div>
            <p className="text-text-dim/60">Hoe strenger je filtert, hoe minder trades maar hoe hoger je winrate. Kies het model dat bij jou past.</p>
            <p className="text-text-dim/40 mt-1">Alle stats zijn gemiddelden uit 12 maanden backtesting. In de praktijk varieert het aantal trades per week sterk — sommige weken 0, andere weken meer dan gemiddeld.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {Object.values(TRADE_MODELS).map(m => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedModel === m.id ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/20' : 'border-white/[0.06] hover:bg-white/[0.03]'
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-heading">{m.name}</span>
                  <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-dim">{m.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center mb-3">
                  <div><p className="text-xl font-mono font-bold text-heading">{m.expectedWR}%</p><p className="text-[8px] text-text-dim"><Tip label="Winrate">Percentage trades dat correct was in 12 maanden backtesting ({m.sampleSize} trades). Hoe hoger, hoe vaker je wint — maar je hebt minder kansen.</Tip></p></div>
                  <div><p className="text-xl font-mono font-bold text-heading">~{m.tradesPerWeek}</p><p className="text-[8px] text-text-dim"><Tip label="Gem. /week">Gemiddeld aantal trades per week over 12 maanden. In de praktijk varieert dit sterk — sommige weken 0, andere weken meer.</Tip></p></div>
                  <div><p className="text-xl font-mono font-bold text-heading">{m.expectedPF}</p><p className="text-[8px] text-text-dim"><Tip label="Profit Factor">Totale winst gedeeld door totaal verlies. PF &gt; 1.0 = winstgevend. PF 1.5 = voor elke €1 verlies verdien je €1.50.</Tip></p></div>
                </div>
                <div className="space-y-1 text-[9px] text-text-dim pt-2 border-t border-white/[0.06]">
                  <div className="flex justify-between">
                    <Tip label="Momentum filter">Hoeveel pips de prijs tegen de fundamentele bias moet bewogen zijn in 5 dagen. Hoe strenger het filter, hoe minder trades maar hoe hoger de winrate.</Tip>
                    <span className="text-text-muted font-mono">{m.momMin === 0 ? 'Alle (geen filter)' : m.momMin + '–' + m.momMax + ' pips'}</span>
                  </div>
                  <div className="flex justify-between">
                    <Tip label="Verwacht per trade">Gemiddelde winst per trade in pips, berekend als: (winrate × TP) - ((1-winrate) × SL). Dit is de &quot;edge&quot; per trade.</Tip>
                    <span className="text-green-400 font-mono font-bold">+{m.expectedExp} pips</span>
                  </div>
                  <div className="flex justify-between">
                    <Tip label="Bewezen op">Aantal trades waarop deze statistieken gebaseerd zijn. Meer trades = betrouwbaarder resultaat.</Tip>
                    <span className="text-text-muted">{m.sampleSize} trades (12 mnd)</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Model uitleg */}
          <details className="group mb-4">
            <summary className="text-[10px] text-accent-light/60 cursor-pointer hover:text-accent-light flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
              Wat betekent het momentum filter precies?
            </summary>
            <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[9px] text-text-dim space-y-2">
              <p>Het <strong className="text-text-muted">momentum filter</strong> meet hoeveel pips de prijs in de afgelopen 5 handelsdagen <strong className="text-text-muted">tegen</strong> je fundamentele bias bewogen is. Dit is het principe van <strong className="text-text-muted">mean reversion</strong>: als de prijs tijdelijk tegen de fundamentals ingaat, is de kans groter dat het terugdraait.</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-text-muted font-semibold">Selective (30–120p)</p>
                  <p>Alleen instappen als de prijs flink gedaald/gestegen is (30-120 pips). Minder kansen maar de dip is diep genoeg voor een sterke bounce. Hoogste winrate.</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-text-muted font-semibold">Balanced (20–150p)</p>
                  <p>Breder bereik — accepteert ook kleinere dips (20p) en diepere (150p). Meer trades per week met een goede winrate. Aanbevolen voor de meeste traders.</p>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-text-muted font-semibold">Aggressive (alle)</p>
                  <p>Geen momentum filter — elke concrete trade is een kans. Maximaal aantal trades maar de laagste winrate. Voor ervaren traders die volume willen.</p>
                </div>
              </div>
            </div>
          </details>

          {/* Rendement */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <label className="text-[8px] text-text-dim block mb-0.5">Account ($)</label>
              <input type="number" value={accountBalance} onChange={(e) => setAccountBalance(parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1.5 rounded-lg text-xs text-heading border border-white/[0.08] bg-white/[0.03] focus:border-accent/50 focus:outline-none" />
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03] text-center group/r relative">
              <p className="text-[7px] text-text-dim"><Tip label="Risico (1%)">Je riskeert 1% van je account per trade. Dit is de standaard risk management regel — bij verlies verlies je maximaal dit bedrag.</Tip></p>
              <p className="text-sm font-mono font-bold text-heading">${riskPerTrade.toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 text-center">
              <p className="text-[7px] text-text-dim"><Tip label={`Bij TP (${model.tp}p)`}>Als de prijs je Take Profit raakt ({model.tp} pips in je richting), verdien je dit bedrag. Berekend als: risico per pip × {model.tp} pips.</Tip></p>
              <p className="text-sm font-mono font-bold text-green-400">+${(model.tp * riskPerPip).toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/5 text-center">
              <p className="text-[7px] text-text-dim"><Tip label={`Bij SL (${model.sl}p)`}>Als de prijs je Stop Loss raakt ({model.sl} pips tegen je), verlies je dit bedrag. Dit is altijd maximaal 1% van je account.</Tip></p>
              <p className="text-sm font-mono font-bold text-red-400">-${(model.sl * riskPerPip).toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/[0.08] border border-green-500/15 text-center">
              <p className="text-[7px] text-text-dim"><Tip label="Per maand">Verwachte maandelijkse winst op basis van het gemiddeld aantal trades en de verwachte winst per trade. Dit is een gemiddelde — individuele maanden variëren.</Tip></p>
              <p className="text-sm font-mono font-bold text-green-400">+${monthlyProfit.toFixed(0)}</p>
              <p className="text-[7px] text-green-400/60">{(monthlyProfit / accountBalance * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BACKTEST: BEWIJS DAT HET WERKT ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Bewijs</span>
          <span className="text-sm font-semibold text-heading">Backtest: wat voegt de techniek toe?</span>
        </div>
        <div className="p-5">
          <p className="text-[10px] text-text-dim mb-4">
            Hieronder zie je wat er gebeurt als je <strong className="text-text-muted">alleen de fundamentele bias</strong> volgt versus wanneer je daar het <strong className="text-text-muted">technische timing model</strong> aan toevoegt. Alle cijfers zijn gebaseerd op dezelfde 400 trades uit het fundamentele trackrecord (apr 2025 - mar 2026).
          </p>

          {/* Vergelijkingstabel */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-text-dim">
                  <th className="text-left py-2 px-2">Methode</th>
                  <th className="text-right py-2 px-2">Trades</th>
                  <th className="text-right py-2 px-2">/week</th>
                  <th className="text-right py-2 px-2">Winrate</th>
                  <th className="text-right py-2 px-2">PF</th>
                  <th className="text-right py-2 px-2">Exp/trade</th>
                </tr>
              </thead>
              <tbody>
                {/* Baseline */}
                <tr className="border-b border-white/[0.02] bg-white/[0.01]">
                  <td className="py-2 px-2 text-text-muted">Alleen fundamenteel (geen techniek)</td>
                  <td className="py-2 px-2 text-right font-mono text-heading">400</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">9.4</td>
                  <td className="py-2 px-2 text-right font-mono text-heading">56.2%</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">—</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">—</td>
                </tr>
                <tr className="border-b border-white/[0.02] bg-white/[0.01]">
                  <td className="py-2 px-2 text-text-muted">Score 2-3 (zonder momentum)</td>
                  <td className="py-2 px-2 text-right font-mono text-heading">262</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">5.7</td>
                  <td className="py-2 px-2 text-right font-mono text-heading">58.0%</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">—</td>
                  <td className="py-2 px-2 text-right font-mono text-text-muted">—</td>
                </tr>
                {/* Divider */}
                <tr><td colSpan={6} className="py-1"><div className="border-t border-accent/20" /></td></tr>
                {/* Models met SL/TP */}
                {Object.values(TRADE_MODELS).map(m => (
                  <tr key={m.id} className={`border-b border-white/[0.02] ${selectedModel === m.id ? 'bg-accent/5' : ''}`}>
                    <td className="py-2 px-2"><span className={selectedModel === m.id ? 'text-accent-light font-bold' : 'text-text-muted'}>{m.name} + techniek</span></td>
                    <td className="py-2 px-2 text-right font-mono text-heading">{m.sampleSize}</td>
                    <td className="py-2 px-2 text-right font-mono text-heading">{m.tradesPerWeek}</td>
                    <td className="py-2 px-2 text-right font-mono text-green-400 font-bold">{m.expectedWR}%</td>
                    <td className="py-2 px-2 text-right font-mono text-green-400 font-bold">{m.expectedPF}</td>
                    <td className="py-2 px-2 text-right font-mono text-green-400">+{m.expectedExp}p</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Uitleg */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[9px] text-text-dim">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-text-muted font-semibold mb-1">Wat doet de techniek?</p>
              <p>Het momentum filter selecteert alleen trades waar de prijs eerst <strong className="text-heading">tegen</strong> de fundamentele bias bewoog (mean reversion). Dit verhoogt de winrate van 56% naar 58-62% en voegt een vaste SL (40p) en TP (120p) toe voor een 1:3 RR.</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-text-muted font-semibold mb-1">Zonder fundamentele bias?</p>
              <p>Puur op momentum filteren (zonder fundamenele score check) geeft een winrate van 56-60%. De fundamentele bias voegt <strong className="text-heading">+2-6%</strong> winrate toe. De combinatie is sterker dan elk onderdeel apart.</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-text-muted font-semibold mb-1">Verschil met Daily Briefing</p>
              <p>De Daily Briefing geeft <strong className="text-heading">de richting</strong> (welke pairs bullish/bearish zijn). De Execution Engine voegt daar <strong className="text-heading">timing</strong> aan toe: wanneer instappen, waar SL/TP zetten, en hoeveel risico nemen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STAP 3: CONCRETE TRADES ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2">
          <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">Stap 3</span>
          <span className="text-sm font-semibold text-heading">Concrete Trades — Vandaag</span>
        </div>
        <div className="p-5">
          {/* Context: verschil met briefing + amber uitleg */}
          <div className="mb-4 p-3 rounded-xl bg-accent/5 border border-accent/15 text-[9px] text-text-dim space-y-2">
            <p className="text-[10px] text-accent-light font-semibold">Hoe lees je deze lijst?</p>
            <p>Hieronder staan de <strong className="text-heading">concrete trades</strong> uit je Daily Macro Briefing — dezelfde paren die alle 4 fundamentele filters passeren. De Execution Engine voegt daar de momentum check aan toe.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                <p className="text-green-400 font-semibold">● Groen = Entry Ready</p>
                <p>De prijs is genoeg pips tegen de bias bewogen (in jouw model zone). Open de 1H chart en wacht op een reversal candle. Backtest winrate: <strong className="text-green-400">{model.expectedWR}%</strong></p>
              </div>
              <div className="p-2 rounded bg-amber-500/5 border border-amber-500/10">
                <p className="text-amber-400 font-semibold">● Amber = Wacht op Momentum</p>
                <p>Het pair is fundamenteel correct (4/4 filters) maar de prijs is nog niet genoeg tegen de bias bewogen. Je kunt de trade wel nemen maar de backtest winrate is lager: <strong className="text-amber-400">~56%</strong> (de fundamentele baseline). Wacht voor betere timing.</p>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[10px] font-semibold text-heading mb-2">Legenda — Filters &amp; Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] text-text-dim">
              <div><span className="text-accent-light font-bold">Score</span>: Fundamentele divergentie (&ge;2.0 nodig). CB beleid &times;2 + rente &times;1.5 + nieuws.</div>
              <div><span className="text-accent-light font-bold">IM</span>: Intermarket alignment (&gt;50% nodig). Bevestigen VIX, S&amp;P, Gold het regime?</div>
              <div><span className="text-accent-light font-bold">Contrarian</span>: Prijs bewoog tegen de bias in 5 dagen. Nodig voor mean reversion entry.</div>
              <div><span className="text-accent-light font-bold">Momentum</span>: Hoeveel pips tegen de bias ({model.momMin > 0 ? model.momMin + '–' + model.momMax + 'p' : 'alle'}). Hoe meer, hoe beter de mean reversion kans.</div>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/[0.04] text-[8px]">
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> <strong className="text-green-400">Entry ready</strong> — concrete trade + momentum zone bereikt = nu 1H chart openen</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> <strong className="text-amber-400">Wacht op momentum</strong> — concrete trade (4/4 filters) maar momentum zone nog niet bereikt</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-text-dim/40" /> <strong className="text-text-dim">Near miss</strong> — 3/4 filters (~53% WR, op eigen risico)</div>
              <div className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-4 rounded bg-green-500/15 text-[8px] font-mono font-bold text-green-400">7.2</span> <strong className="text-text-muted">Quality Score</strong> — eindscore 1-10, hover voor breakdown</div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-red-400">{error}</p>
              <button onClick={() => { setLoading(true); fetchData() }} className="mt-1 text-[10px] text-red-400/70">Opnieuw laden</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-text-muted">Briefing data laden...</span>
            </div>
          ) : (
            <>
              {/* Regime */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  regime.regime === 'Risk-Off' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                  regime.regime === 'Risk-On' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                  'text-text-dim bg-white/[0.04] border-white/[0.06]'
                }`} title={`Huidig marktregime: ${regime.regime}\n\n${regime.regime === 'Risk-On' ? 'Risk-On = beleggers nemen risico. Typisch bullish voor AUD, NZD, CAD. Bearish voor JPY, CHF.' : regime.regime === 'Risk-Off' ? 'Risk-Off = beleggers vluchten naar veiligheid. Typisch bullish voor JPY, CHF, USD. Bearish voor AUD, NZD.' : 'Gemengd = geen duidelijk regime. Intermarket signalen spreken elkaar tegen.'}\n\nBevestiging: ${regime.im}% (${regime.im > 50 ? 'voldoende' : 'onvoldoende'})`}>{regime.regime || 'Laden...'}</span>
                <span className={`text-[10px] font-mono ${regime.im > 50 ? 'text-green-400' : 'text-red-400'}`}>
                  <Tip label={`IM: ${regime.im}% ${regime.im > 50 ? '\u2713' : '\u2717 (<50%)'}`}>Intermarket Alignment — meten VIX, S&amp;P500, Gold, Yields en Oil hetzelfde marktregime? Boven 50% = bevestigd. Onder 50% = geen concrete trades mogelijk.</Tip>
                </span>
                <span className="text-[10px] text-text-dim"><Tip label={`${concreteTrades.length} concrete · ${nearMisses.length} near miss`}>Concrete trades passeren alle 4 filters (score ≥2, IM &gt;50%, contrarian, richting). Near misses passeren 3 van 4 — lagere winrate (~53%).</Tip></span>
                {entryReady.length > 0 && <span className="text-[10px] text-green-400 font-bold animate-pulse">{entryReady.length} entry ready!</span>}
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[8px] text-text-dim/30">{generatedAt ? new Date(generatedAt).toLocaleString('nl-NL') : ''}</span>
                  <button onClick={() => fetchData()} className="text-[9px] text-text-dim/40 hover:text-accent-light transition-colors flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                    Ververs
                  </button>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400/50 animate-pulse" title="Auto-refresh elke 5 min" />
                </span>
              </div>

              {/* Concrete trades */}
              {concreteTrades.length > 0 ? (
                <div className="space-y-2 mb-4">
                  <p className="text-[10px] text-green-400/70 font-semibold">Concrete trades (4/4 fundamentele filters gepasseerd)</p>
                  {concreteTrades.map(trade => {
                    const isBull = trade.direction.includes('bullish')
                    const isExp = expandedPair === trade.pair
                    const absMom = Math.abs(trade.momentum5d)
                    return (
                      <div key={trade.pair} className={`rounded-xl border ${trade.entryReady ? 'border-green-500/30 bg-green-500/[0.04]' : 'border-amber-500/20 bg-amber-500/[0.03]'}`}>
                        <button onClick={() => setExpandedPair(isExp ? null : trade.pair)} className="w-full px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${trade.entryReady ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                            <span className="font-mono font-bold text-sm text-heading">{trade.pair}</span>
                            <span className={`text-xs font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`}>{isBull ? '\u25B2 LONG' : '\u25BC SHORT'}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/15 font-mono" title={`Alle 4 fundamentele filters gepasseerd:\n\n✓ Score ≥ 2.0 (${trade.score > 0 ? '+' : ''}${trade.score})\n✓ IM > 50% (${regime.im}%)\n✓ Contrarian (prijs ging tegen bias)\n✓ Richting (${trade.direction})\n\nDit is een concrete trade.`}>4/4</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${trade.inMomentumZone ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}
                              title={`5-daags momentum: ${trade.momentum5d > 0 ? '+' : ''}${trade.momentum5d} pips tegen de bias.\n${trade.inMomentumZone ? `In de momentum zone (${model.momMin > 0 ? model.momMin + '-' + model.momMax + 'p' : 'alle'}) — klaar voor entry.` : trade.momentumStatus}\nDe prijs is ${Math.abs(trade.momentum5d)} pips ${trade.momentum5d > 0 ? 'gestegen' : 'gedaald'} in 5 dagen.`}>
                              {trade.inMomentumZone ? '\u2713 ' : ''}{trade.momentum5d > 0 ? '+' : ''}{trade.momentum5d}p {trade.inMomentumZone ? '' : `(nodig: ${model.momMin > 0 ? model.momMin + 'p' : ''})`}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              trade.qualityScore >= 7 ? 'bg-green-500/15 text-green-400' :
                              trade.qualityScore >= 5 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-white/[0.06] text-text-dim'
                            }`} title={`Quality Score ${trade.qualityScore.toFixed(1)}/10\n\nOpbouw:\n• Fundamenteel (max 4pt): sterkte van de score\n• Contrarian (max 2.5pt): momentum tegen de bias\n• IM alignment (max 2pt): ${regime.im}% bevestiging\n• Regime (max 1.5pt): past bij Risk-On/Off\n\n≥7 = sterk setup · ≥5 = redelijk · <5 = zwak`}>{trade.qualityScore.toFixed(1)}</span>
                            <span className="text-sm font-mono font-bold text-heading" title={`Fundamentele score: ${trade.score > 0 ? '+' : ''}${trade.score}\n\nBerekend als:\n• CB beleid verschil × 2\n• Renteverschil × 1.5\n• Nieuws bonus (max ±1.5)\n\nMinimum ≥2.0 voor een concrete trade.\nHoe hoger, hoe sterker de fundamentele divergentie.`}>{trade.score > 0 ? '+' : ''}{trade.score}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-text-dim transition-transform ${isExp ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-4 pb-4 border-t border-white/[0.04] space-y-3">
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                              <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-text-dim">Richting</p><p className={`font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`} title={`${trade.base} is ${trade.baseBias} · ${trade.quote} is ${trade.quoteBias}\n\nOvertuiging: ${trade.conviction}\n${trade.conviction === 'sterk' ? 'Score ≥ 4.0 — zeer sterk fundamenteel verschil' : trade.conviction === 'matig' ? 'Score 2.0-3.9 — redelijk fundamenteel verschil' : 'Score < 2.0 — zwak'}`}>{trade.direction} ({trade.conviction})</p></div>
                              <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-text-dim">Fund. Score</p><p className="font-mono font-bold text-heading" title={`Score: ${trade.score > 0 ? '+' : ''}${trade.score}\n\nFormule: CB bias ×2 + renteverschil ×1.5 + nieuws bonus\n\n${trade.base} bias: ${trade.baseBias}\n${trade.quote} bias: ${trade.quoteBias}\nRenteverschil: ${trade.rateDiff !== null ? trade.rateDiff + '%' : 'n/a'}`}>{trade.score > 0 ? '+' : ''}{trade.score}</p></div>
                              <div className="p-2 rounded-lg bg-white/[0.03]">
                                <p className="text-text-dim">5d Momentum</p>
                                <p className={`font-mono font-bold ${trade.inMomentumZone ? 'text-green-400' : 'text-amber-400'}`}>{trade.momentum5d > 0 ? '+' : ''}{trade.momentum5d}p</p>
                                <p className="text-[8px] text-text-dim/50">{isBull ? 'Negatief = prijs daalde (contrarian \u2713)' : 'Positief = prijs steeg (contrarian \u2713)'}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-text-dim">Status</p><p className={`font-bold ${trade.entryReady ? 'text-green-400' : 'text-amber-400'}`}>{trade.entryReady ? 'ENTRY READY' : trade.momentumStatus}</p></div>
                            </div>
                            <div className={`p-3 rounded-lg border ${trade.entryReady ? 'bg-green-500/5 border-green-500/15' : 'bg-accent/5 border-accent/15'}`}>
                              {trade.entryReady ? (
                                <><p className="text-[10px] text-green-400 font-semibold mb-1">Alle condities bereikt — open de 1H chart</p>
                                <ol className="text-[9px] text-text-dim space-y-0.5 list-decimal list-inside">
                                  <li>Open <strong className="text-heading">{trade.pair}</strong> op <strong className="text-heading">1H timeframe</strong></li>
                                  <li>Wacht op {isBull ? 'bullish (groene)' : 'bearish (rode)'} <strong className="text-heading">reversal candle</strong></li>
                                  <li>Entry op de <strong className="text-heading">close</strong> van die candle</li>
                                  <li>SL: <strong className="text-red-400">{model.sl}p</strong> {isBull ? 'onder' : 'boven'} entry · TP: <strong className="text-green-400">{model.tp}p</strong> {isBull ? 'boven' : 'onder'} entry</li>
                                </ol></>
                              ) : (
                                <><p className="text-[10px] text-accent-light font-semibold mb-1">Fundamenteel bevestigd — wacht op momentum</p>
                                <p className="text-[9px] text-text-dim">{trade.momentumStatus}. De fundamentele bias is correct maar de prijs is nog niet genoeg tegen de bias bewogen voor een optimale mean reversion entry.</p></>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center mb-4">
                  <p className="text-sm text-text-muted">Geen concrete trades vandaag</p>
                  <p className="text-[10px] text-text-dim mt-1">
                    {regime.im <= 50 ? `Intermarket alignment is ${regime.im}% (onder 50%). Geen trades tot het regime bevestigd is.` : 'Geen paren passeren vandaag alle 4 fundamentele filters.'}
                  </p>
                  {trackRecord && (() => {
                    const today = new Date().toISOString().split('T')[0]
                    const pendingToday = trackRecord.recentTrades.filter(t => t.result === 'pending' && t.date === today)
                    const pendingOther = trackRecord.recentTrades.filter(t => t.result === 'pending' && t.date !== today)
                    const allPending = [...pendingToday, ...pendingOther]
                    if (allPending.length === 0) return null
                    return (
                      <div className="mt-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-left">
                        <p className="text-[11px] text-amber-300 font-semibold mb-1">
                          {pendingToday.length > 0
                            ? `${pendingToday.length} trades eerder vandaag gegenereerd`
                            : `${allPending.length} openstaande ${allPending.length === 1 ? 'trade' : 'trades'}`}
                        </p>
                        <p className="text-[10px] text-text-dim mb-3">
                          Deze zijn gegenereerd toen de marktcondities anders waren (IM was toen &gt;50%). Ze worden morgen automatisch resolved. De live engine toont alleen trades die <strong className="text-text-muted">nu</strong> door alle filters komen.
                        </p>
                        <div className="space-y-1.5">
                          {allPending.map((t, i) => {
                            const isBull = t.direction?.includes('bullish')
                            const absMom = Math.abs(t.momentum)
                            const inSelective = absMom >= 30 && absMom <= 120
                            const inBalanced = absMom >= 20 && absMom <= 150
                            return (
                              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03]">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                  <span className="font-mono font-bold text-[11px] text-heading">{t.pair}</span>
                                  <span className={`text-[10px] font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`}>
                                    {isBull ? '\u25B2 LONG' : '\u25BC SHORT'}
                                  </span>
                                  <span className="text-[9px] font-mono text-text-dim" title={`Fundamentele score: ${t.score > 0 ? '+' : ''}${t.score}`}>
                                    {t.score > 0 ? '+' : ''}{t.score}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono text-text-dim" title={`5d momentum: ${t.momentum}p tegen de bias.\nDit bepaalt in welk model de trade valt.`}>
                                    {Math.abs(t.momentum)}p mom
                                  </span>
                                  <div className="flex gap-1">
                                    {inSelective && <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/15" title="Valt in Selective zone (30-120p)">Sel</span>}
                                    {inBalanced && <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/15" title="Valt in Balanced zone (20-150p)">Bal</span>}
                                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/15" title="Altijd in Aggressive (geen filter)">Agg</span>
                                  </div>
                                  <span className="text-[8px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10">PENDING</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-[9px] text-text-dim/40 mt-2">Uitslag wordt morgen om 23:00 NL automatisch bepaald op basis van prijsbeweging.</p>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Near misses (3/4) */}
              {nearMisses.length > 0 && (
                <div>
                  <button onClick={() => setShowNonConcrete(!showNonConcrete)} className="flex items-center gap-2 text-[10px] text-text-dim/50 hover:text-text-dim cursor-pointer mb-2">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showNonConcrete ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6" /></svg>
                    {nearMisses.length} pairs met 3/4 filters — op eigen risico
                  </button>
                  {showNonConcrete && (
                    <div className="space-y-1.5">
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 mb-2">
                        <p className="text-[10px] text-amber-400 font-semibold mb-1">Kansmodel: 3/4 filters</p>
                        <p className="text-[9px] text-text-dim">Op basis van backtesting (400 trades) is de verwachte winrate bij 3/4 filters <strong className="text-amber-400">~53%</strong> (vs. ~56% bij 4/4). De ontbrekende filter staat in rood. Trade alleen als je eigen technische analyse de richting bevestigt.</p>
                      </div>
                      {nearMisses.map(trade => {
                        const isBull = trade.direction.includes('bullish')
                        const failedFilter = !trade.scorePass ? 'Score <2' : !trade.imPass ? `IM ${regime.im}%` : !trade.contrarianPass ? `Niet contrarian (${trade.momentum5d > 0 ? '+' : ''}${trade.momentum5d}p)` : 'Geen richting'
                        return (
                          <div key={trade.pair} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-amber-500/10 bg-amber-500/[0.02]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400/50" />
                              <span className="font-mono font-bold text-[11px] text-heading">{trade.pair}</span>
                              <span className={`text-[10px] font-semibold ${isBull ? 'text-green-400' : 'text-red-400'}`}>{isBull ? '\u25B2 LONG' : '\u25BC SHORT'}</span>
                              <span className="text-[9px] font-mono text-heading">{trade.score > 0 ? '+' : ''}{trade.score}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                trade.qualityScore >= 7 ? 'bg-green-500/15 text-green-400' :
                                trade.qualityScore >= 5 ? 'bg-amber-500/15 text-amber-400' :
                                'bg-white/[0.06] text-text-dim'
                              }`} title={`Quality Score ${trade.qualityScore.toFixed(1)}/10\n\n≥7 = sterk · ≥5 = redelijk · <5 = zwak\nNear miss — ontbreekt 1 filter.`}>{trade.qualityScore.toFixed(1)}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70 font-mono border border-amber-500/15" title={`5-daags momentum: ${trade.momentum5d > 0 ? '+' : ''}${trade.momentum5d} pips\nDe prijs is ${Math.abs(trade.momentum5d)} pips ${trade.momentum5d > 0 ? 'gestegen' : 'gedaald'} in 5 handelsdagen.`}>{trade.momentum5d > 0 ? '+' : ''}{trade.momentum5d}p</span>
                              <span className="text-[8px] text-red-400/60 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10" title={`Dit pair mist 1 filter: ${failedFilter}.\n\nZonder deze filter is de verwachte winrate ~53% in plaats van ~56-62%.`}>{failedFilter}</span>
                              <span className="text-[9px] font-mono text-amber-400 font-bold" title={`3 van 4 filters gepasseerd.\n\n${trade.scorePass ? '✓' : '✗'} Score ≥ 2.0 (${trade.score > 0 ? '+' : ''}${trade.score})\n${trade.imPass ? '✓' : '✗'} IM > 50% (${regime.im}%)\n${trade.contrarianPass ? '✓' : '✗'} Contrarian\n${trade.directionPass ? '✓' : '✗'} Richting`}>3/4</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══ ENGINE TRACKRECORD ═══ */}
      <section id="engine-trackrecord" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-accent-light bg-accent/10 px-2 py-0.5 rounded">Live</span>
            <span className="text-sm font-semibold text-heading">Engine Trackrecord</span>
            {trackRecord && trackRecord.overall.resolved > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                trackRecord.overall.winRate >= 55 ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
              }`}>{trackRecord.overall.winRate}% winrate</span>
            )}
          </div>
          <Link href="/tools/fx-selector" className="text-[9px] text-text-dim hover:text-accent-light transition-colors">
            Fundamenteel trackrecord →
          </Link>
        </div>
        <div className="p-5">
          {/* Uitleg verschil */}
          <div className="mb-4 p-3 rounded-xl bg-accent/5 border border-accent/15 text-[9px] text-text-dim">
            <p className="text-[10px] text-accent-light font-semibold mb-1">Wat is het verschil?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-text-muted font-semibold">Fundamenteel trackrecord</p>
                <p>Alle paren met score &ge;2 + contrarian filter. Meet alleen of de <strong className="text-heading">richting</strong> correct was na 1 dag. Geen SL/TP, geen momentum filter.</p>
              </div>
              <div>
                <p className="text-text-muted font-semibold">Engine trackrecord (deze)</p>
                <p>Concrete trades (4/4 filters) + <strong className="text-heading">momentum zone per model</strong>. Toont in welk model de trade valt (SEL/BAL/AGG), de exacte momentum pips, en het resultaat.</p>
              </div>
            </div>
          </div>

          {(() => {
            const modelBT = backtestTrades.filter(t => {
              const s = Math.abs(t.score), m = t.momentum
              return s >= model.scoreMin && s < model.scoreMax && m >= model.momMin && m <= model.momMax
            })
            const btWins = modelBT.filter(t => t.result === 'correct').length
            const btLosses = modelBT.length - btWins
            const btWR = modelBT.length > 0 ? (btWins / modelBT.length * 100).toFixed(1) : '0'
            const btPips = btWins * model.tp - btLosses * model.sl

            return (
            <>
              {/* Overzicht stats */}
              {trackRecord && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  {[
                    { label: 'Totaal', value: trackRecord.overall.total, color: 'text-heading' },
                    { label: 'Correct', value: trackRecord.overall.correct, color: 'text-green-400' },
                    { label: 'Incorrect', value: trackRecord.overall.resolved - trackRecord.overall.correct, color: 'text-red-400' },
                    { label: 'Pending', value: trackRecord.overall.pending, color: 'text-amber-400' },
                    { label: 'Winrate', value: `${trackRecord.overall.winRate}%`, color: trackRecord.overall.winRate >= 55 ? 'text-green-400' : 'text-amber-400' },
                  ].map(stat => (
                    <div key={stat.label} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <p className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[9px] text-text-dim">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Per model stats */}
              <p className="text-[10px] text-text-muted font-semibold mb-2">Per model — live + backtest</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {Object.entries(TRADE_MODELS).map(([id, m]) => {
                  const liveStats = trackRecord?.models?.[id]
                  const isActive = selectedModel === id
                  return (
                    <div key={id} className={`p-3 rounded-xl border ${isActive ? 'border-accent/30 bg-accent/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold ${isActive ? 'text-accent-light' : 'text-heading'}`}>{m.name}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-dim">{m.momMin === 0 ? 'Alle' : m.momMin + '-' + m.momMax + 'p'}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center text-[9px] mb-2">
                        <div><p className="font-mono font-bold text-heading">{liveStats?.total || 0}</p><p className="text-text-dim">Trades</p></div>
                        <div><p className="font-mono font-bold text-green-400">{liveStats?.correct || 0}</p><p className="text-text-dim">Win</p></div>
                        <div><p className="font-mono font-bold text-red-400">{liveStats?.incorrect || 0}</p><p className="text-text-dim">Loss</p></div>
                        <div><p className={`font-mono font-bold ${(liveStats?.winRate || 0) >= 55 ? 'text-green-400' : 'text-amber-400'}`}>{liveStats?.winRate || 0}%</p><p className="text-text-dim">WR</p></div>
                      </div>
                      <div className="flex justify-between text-[8px] pt-1.5 border-t border-white/[0.06]">
                        <span className="text-text-dim">Pips: <span className={`font-mono font-bold ${(liveStats?.totalPips || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(liveStats?.totalPips || 0) > 0 ? '+' : ''}{liveStats?.totalPips || 0}</span></span>
                        <span className="text-text-dim/40">Verwacht: {m.expectedWR}% WR · PF {m.expectedPF}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Backtest vergelijking */}
              <div className="mb-4">
                <p className="text-[10px] text-text-dim/50 mb-2">Backtest referentie (apr 2025 - mar 2026)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-text-dim">
                        <th className="text-left py-1.5 px-2">Model</th>
                        <th className="text-right py-1.5 px-2">Trades</th>
                        <th className="text-right py-1.5 px-2">Winrate</th>
                        <th className="text-right py-1.5 px-2">PF</th>
                        <th className="text-right py-1.5 px-2">/week</th>
                        <th className="text-right py-1.5 px-2">Exp/trade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(TRADE_MODELS).map(m => {
                        const isSelected = m.id === selectedModel
                        return (
                          <tr key={m.id} className={`border-b border-white/[0.02] ${isSelected ? 'bg-accent/5' : ''}`}>
                            <td className="py-1.5 px-2"><span className={isSelected ? 'text-accent-light font-bold' : 'text-heading'}>{m.name}</span></td>
                            <td className="py-1.5 px-2 text-right font-mono text-heading">{m.sampleSize}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-green-400 font-bold">{m.expectedWR}%</td>
                            <td className="py-1.5 px-2 text-right font-mono text-heading">{m.expectedPF}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-text-muted">{m.tradesPerWeek}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-green-400">+{m.expectedExp}p</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[8px] text-text-dim/30 mt-1">SL={model.sl}p · TP={model.tp}p · 1:{model.rr} RR. Fundamenteel baseline = 56% WR. Met techniek = 58-62%.</p>
              </div>

              {/* Live recente trades — ALTIJD ZICHTBAAR */}
              {trackRecord && trackRecord.recentTrades.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-text-muted font-semibold mb-2">Laatste trades</p>
                  <div className="overflow-x-auto">
                    <div className="flex items-center justify-between px-3 py-1.5 text-[8px] text-text-dim/40 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <span className="w-2" />
                        <span className="w-[70px]">Datum</span>
                        <span className="w-[65px]">Pair</span>
                        <span className="w-12">Richting</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="w-10">Score</span>
                        <span className="w-12">Mom</span>
                        <span className="w-16">Models</span>
                        <span className="w-12">Pips</span>
                        <span className="w-16">Status</span>
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {trackRecord.recentTrades.map((t, i) => {
                        const isBull = t.direction?.includes('bullish')
                        const absMom = Math.abs(t.momentum || 0)
                        const models: string[] = []
                        if (t.selective) models.push('SEL')
                        if (t.balanced) models.push('BAL')
                        models.push('AGG')
                        return (
                          <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-[9px] border-b border-white/[0.02] hover:bg-white/[0.02] ${
                            t.result === 'correct' ? 'bg-green-500/[0.02]' : t.result === 'incorrect' ? 'bg-red-500/[0.02]' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${t.result === 'correct' ? 'bg-green-400' : t.result === 'incorrect' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                              <span className="text-text-dim/50 font-mono w-[70px]">{t.date}</span>
                              <span className="font-mono font-bold text-heading w-[65px]">{t.pair}</span>
                              <span className={`w-12 font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`}>{isBull ? '\u25B2 LONG' : '\u25BC SHORT'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-text-dim font-mono w-10">{t.score > 0 ? '+' : ''}{t.score}</span>
                              <span className="text-text-dim font-mono w-12">{absMom}p</span>
                              <span className="text-text-dim font-mono w-16 text-[8px]">{models.join('/')}</span>
                              <span className={`font-mono font-bold w-12 ${
                                t.result === 'correct' ? 'text-green-400' : t.result === 'incorrect' ? 'text-red-400' : 'text-text-dim'
                              }`}>
                                {t.result === 'pending' ? '—' : `${t.pips > 0 ? '+' : ''}${t.pips}p`}
                              </span>
                              <span className={`font-mono font-bold w-16 text-[8px] px-1.5 py-0.5 rounded ${
                                t.result === 'correct' ? 'bg-green-500/15 text-green-400' :
                                t.result === 'incorrect' ? 'bg-red-500/15 text-red-400' :
                                'bg-amber-500/10 text-amber-400'
                              }`}>
                                {t.result === 'correct' ? 'WIN' : t.result === 'incorrect' ? 'LOSS' : 'PENDING'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Backtest trades detail (collapsible) */}
              {modelBT.length > 0 && (
                <details className="group">
                  <summary className="text-[10px] text-text-dim/50 cursor-pointer hover:text-text-dim flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90"><polyline points="9 18 15 12 9 6" /></svg>
                    Backtest detail ({model.name}): {modelBT.length} trades, {btWR}% WR, {btPips > 0 ? '+' : ''}{btPips} pips
                  </summary>
                  <div className="mt-2 max-h-72 overflow-y-auto">
                    {modelBT.slice().sort((a, b) => b.date.localeCompare(a.date)).map((t, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1 text-[9px] border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.result === 'correct' ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="text-text-dim/50 font-mono w-[70px]">{t.date}</span>
                          <span className="font-mono font-bold text-heading w-[65px]">{t.pair}</span>
                          <span className={`w-4 ${t.direction.includes('bullish') ? 'text-green-400' : 'text-red-400'}`}>{t.direction.includes('bullish') ? '\u25B2' : '\u25BC'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-text-dim font-mono w-10">{t.score > 0 ? '+' : ''}{t.score}</span>
                          <span className="text-text-dim font-mono w-10">{t.momentum}p</span>
                          <span className="text-text-dim font-mono w-10">{t.pips > 0 ? '+' : ''}{t.pips}p</span>
                          <span className={`font-mono font-bold w-14 ${t.result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                            {t.result === 'correct' ? 'WIN' : 'LOSS'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
            )
          })()}

          {/* Methodiek uitleg */}
          <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[9px] text-text-dim">
            <p className="text-text-muted font-semibold mb-1">Hoe werkt het?</p>
            <p>Elke werkdag worden concrete trades (4/4 filters) opgeslagen met entry prijs, momentum, en in welk model ze vallen. Na 1 handelsdag wordt de exit prijs opgehaald en het resultaat bepaald. Updates: 4x per dag (08:30, 12:00, 14:30, 21:00 NL).</p>
          </div>
        </div>
      </section>

      {/* ═══ DATA SCHEMA ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <details className="group">
          <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <span className="text-xs font-semibold text-heading uppercase tracking-wider">Data Updates &amp; Schema</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim transition-transform group-open:rotate-180"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="px-5 pb-5 border-t border-white/[0.04]">
            <div className="mt-3 mb-4">
              <p className="text-[10px] text-text-muted font-semibold mb-3">Automatische data updates — 4x per werkdag</p>
              <p className="text-[9px] text-text-dim mb-3">Alle data wordt automatisch ververst voor elke belangrijke trading sessie. Je ontvangt een Telegram notificatie bij elke scan.</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {[
                  { time: '08:30', label: 'London Pre-Market', emoji: '\uD83C\uDDEC\uD83C\uDDE7', desc: 'Verse analyse voor de Londense sessie. Nieuws, scores en IM worden opnieuw berekend.', color: 'border-blue-500/20 bg-blue-500/5' },
                  { time: '12:00', label: 'Middag Update', emoji: '\uD83C\uDF0D', desc: 'Herberekening na de ochtend. Nieuwe trades als condities veranderd zijn.', color: 'border-amber-500/20 bg-amber-500/5' },
                  { time: '14:30', label: 'New York Pre-Market', emoji: '\uD83C\uDDFA\uD83C\uDDF8', desc: 'Verse data voor de NY sessie. Vaak veranderen IM en momentum in de middag.', color: 'border-green-500/20 bg-green-500/5' },
                  { time: '21:00', label: 'Einde Handelsdag', emoji: '\uD83C\uDF19', desc: 'Laatste scan + resolve van gisteren\'s trades. Resultaten worden bepaald.', color: 'border-purple-500/20 bg-purple-500/5' },
                ].map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${s.color}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">{s.emoji}</span>
                      <span className="text-[10px] font-bold text-heading">{s.time} NL</span>
                    </div>
                    <p className="text-[10px] font-semibold text-text-muted mb-1">{s.label}</p>
                    <p className="text-[9px] text-text-dim leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[9px] text-text-dim">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-text-muted font-semibold mb-1">Wat wordt er ververst?</p>
                <ul className="space-y-1">
                  <li><strong className="text-heading">Nieuws:</strong> RSS feeds van Reuters, FXStreet, ForexLive, DailyFX — impact op de nieuwsbonus in de score</li>
                  <li><strong className="text-heading">Briefing:</strong> CB beleid, renteverschillen, intermarket data (VIX, S&amp;P, Gold, Yields, Oil)</li>
                  <li><strong className="text-heading">Prijzen:</strong> Yahoo Finance — 5d momentum, entry prices</li>
                  <li><strong className="text-heading">Signals:</strong> Nieuwe concrete trades als condities veranderen</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <p className="text-text-muted font-semibold mb-1">Telegram notificaties</p>
                <ul className="space-y-1">
                  <li><strong className="text-green-400">Nieuwe trades:</strong> Pair, richting, score, momentum, welke models</li>
                  <li><strong className="text-amber-400">Geen trades:</strong> Reden (IM te laag, geen filters) + marktoverzicht</li>
                  <li><strong className="text-accent-light">Resultaten:</strong> Win/loss per trade, pips, winrate van resolved trades</li>
                  <li><strong className="text-text-dim">Elke sessie:</strong> Update zelfs als er geen nieuwe trades zijn</li>
                </ul>
                <p className="mt-2 text-[8px] text-text-dim/40">Setup: @BotFather in Telegram → /newbot → token in Vercel env vars</p>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ═══ ONDERBOUWING ═══ */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <details className="group">
          <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]">
            <span className="text-xs font-semibold text-heading uppercase tracking-wider">Onderbouwing &amp; Methodiek</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim transition-transform group-open:rotate-180"><polyline points="6 9 12 15 18 9" /></svg>
          </summary>
          <div className="px-5 pb-5 border-t border-white/[0.04]">
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[9px] text-text-dim">
              <div className="space-y-2">
                <p className="text-text-muted font-semibold">Hoe is dit model gebouwd?</p>
                <p>Analyse van <strong className="text-heading">434 fundamentele trades</strong> uit het trackrecord (apr 2025 - mar 2026). Voor elke trade is de dagkoers en intraday high/low opgehaald via Yahoo Finance. Hiermee is berekend hoe ver de prijs tegen je gaat (MAE) en hoe ver met je (MFE). De sweet spot: trades met momentum {model.momMin > 0 ? model.momMin + '-' + model.momMax : '30-120'} pips tegen de bias hebben een winrate van {model.expectedWR}% met profit factor {model.expectedPF}.</p>
              </div>
              <div className="space-y-2">
                <p className="text-text-muted font-semibold">Aansluiting fundamentele tool</p>
                <p>De Daily Macro Briefing is <strong className="text-heading">leidend en onaangepast</strong>. Deze engine leest alleen de concrete trades en voegt een timing laag toe. Geen wijzigingen aan scoring, filters of trackrecord.</p>
                <p className="text-text-muted font-semibold mt-2">Nodig</p>
                <ul className="list-disc list-inside space-y-0.5"><li>Daily Macro Briefing</li><li>1H chart (TradingView/broker)</li><li>Broker account</li></ul>
              </div>
            </div>
          </div>
        </details>
      </section>

      <div className="text-center"><p className="text-[8px] text-text-dim/30">SC Execution Engine v2.0 · {model.name} · {model.sampleSize} trades bewezen</p></div>
    </div>
  )
}
