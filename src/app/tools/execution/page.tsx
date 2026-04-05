'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const model = TRADE_MODELS[selectedModel]

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

          return {
            pair: p.pair, base: p.base, quote: p.quote, direction: p.direction,
            conviction: p.conviction, score: p.score, baseBias: p.baseBias,
            quoteBias: p.quoteBias, rateDiff: p.rateDiff, momentum5d: pips5d, atr,
            scorePass, imPass, contrarianPass, directionPass, filterCount, isConcreTrade,
            inMomentumZone, momentumStatus, entryReady: isConcreTrade && inMomentumZone,
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
          Neemt de concrete trades uit je <strong className="text-text-muted">Daily Macro Briefing</strong> en bepaalt het optimale instapmoment met een bewezen technisch timing model.
        </p>
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
                <p>Exact <strong className="text-heading">{model.sl} pips</strong> van je entry. Bij long: {model.sl}p onder je entry. Bij short: {model.sl}p boven je entry. Dit is gebaseerd op analyse van 434 trades — winnende trades bewegen gemiddeld maar 15-19 pips tegen je.</p>
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
          <p className="text-[10px] text-text-dim mb-4">
            Alle 3 modellen gebruiken dezelfde entry methode (1H reversal candle, SL {model.sl}p, TP {model.tp}p). Het enige verschil is de <strong className="text-text-muted">momentum filter</strong>: hoe streng je filtert op hoeveel pips de prijs tegen je fundamentele bias moet bewogen zijn in de afgelopen 5 handelsdagen. Een strengere filter geeft minder trades maar een hogere winrate. Een lossere filter geeft meer trades per week.
          </p>

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
                  <div><p className="text-xl font-mono font-bold text-heading">{m.expectedWR}%</p><p className="text-[8px] text-text-dim">Winrate</p></div>
                  <div><p className="text-xl font-mono font-bold text-heading">{m.tradesPerWeek}</p><p className="text-[8px] text-text-dim">Per week</p></div>
                  <div><p className="text-xl font-mono font-bold text-heading">{m.expectedPF}</p><p className="text-[8px] text-text-dim">Profit Factor</p></div>
                </div>
                <div className="space-y-1 text-[9px] text-text-dim pt-2 border-t border-white/[0.06]">
                  <div className="flex justify-between">
                    <span>Momentum filter</span>
                    <span className="text-text-muted font-mono">{m.momMin === 0 ? 'Alle (geen filter)' : m.momMin + '–' + m.momMax + ' pips'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verwacht per trade</span>
                    <span className="text-green-400 font-mono font-bold">+{m.expectedExp} pips</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bewezen op</span>
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
            <div className="p-2 rounded-lg bg-white/[0.03] text-center">
              <p className="text-[7px] text-text-dim">Risico (1%)</p>
              <p className="text-sm font-mono font-bold text-heading">${riskPerTrade.toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 text-center">
              <p className="text-[7px] text-text-dim">Bij TP ({model.tp}p)</p>
              <p className="text-sm font-mono font-bold text-green-400">+${(model.tp * riskPerPip).toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/5 text-center">
              <p className="text-[7px] text-text-dim">Bij SL ({model.sl}p)</p>
              <p className="text-sm font-mono font-bold text-red-400">-${(model.sl * riskPerPip).toFixed(0)}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/[0.08] border border-green-500/15 text-center">
              <p className="text-[7px] text-text-dim">Per maand</p>
              <p className="text-sm font-mono font-bold text-green-400">+${monthlyProfit.toFixed(0)}</p>
              <p className="text-[7px] text-green-400/60">{(monthlyProfit / accountBalance * 100).toFixed(1)}%</p>
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
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Entry ready (4/4 + momentum zone)</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-light" /> Concrete trade (4/4 filters, wacht op momentum)</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/50" /> 3/4 filters (~53% WR, op eigen risico)</div>
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
                }`}>{regime.regime || 'Laden...'}</span>
                <span className={`text-[10px] font-mono ${regime.im > 50 ? 'text-green-400' : 'text-red-400'}`}>
                  IM: {regime.im}% {regime.im > 50 ? '\u2713' : '\u2717 (<50%)'}
                </span>
                <span className="text-[10px] text-text-dim">{concreteTrades.length} concrete · {nearMisses.length} near miss</span>
                {entryReady.length > 0 && <span className="text-[10px] text-green-400 font-bold animate-pulse">{entryReady.length} entry ready!</span>}
                <span className="ml-auto text-[8px] text-text-dim/30">{generatedAt ? new Date(generatedAt).toLocaleString('nl-NL') : ''}</span>
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
                      <div key={trade.pair} className={`rounded-xl border ${trade.entryReady ? 'border-green-500/30 bg-green-500/[0.04]' : 'border-accent/20 bg-accent/[0.03]'}`}>
                        <button onClick={() => setExpandedPair(isExp ? null : trade.pair)} className="w-full px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${trade.entryReady ? 'bg-green-400 animate-pulse' : 'bg-accent-light'}`} />
                            <span className="font-mono font-bold text-sm text-heading">{trade.pair}</span>
                            <span className={`text-xs font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`}>{isBull ? '\u25B2 LONG' : '\u25BC SHORT'}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/15 font-mono">4/4</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${trade.inMomentumZone ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}
                              title={`5-daags momentum: ${trade.momentum5d > 0 ? '+' : ''}${trade.momentum5d} pips. ${trade.inMomentumZone ? 'In de momentum zone — klaar voor entry.' : trade.momentumStatus}`}>
                              {trade.momentum5d > 0 ? '+' : ''}{trade.momentum5d}p
                            </span>
                            <span className="text-sm font-mono font-bold text-heading">{trade.score > 0 ? '+' : ''}{trade.score}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-text-dim transition-transform ${isExp ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-4 pb-4 border-t border-white/[0.04] space-y-3">
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                              <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-text-dim">Richting</p><p className={`font-bold ${isBull ? 'text-green-400' : 'text-red-400'}`}>{trade.direction} ({trade.conviction})</p></div>
                              <div className="p-2 rounded-lg bg-white/[0.03]"><p className="text-text-dim">Fund. Score</p><p className="font-mono font-bold text-heading">{trade.score > 0 ? '+' : ''}{trade.score}</p></div>
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
                        <p className="text-[9px] text-text-dim">Op basis van backtesting (434 trades) is de verwachte winrate bij 3/4 filters <strong className="text-amber-400">~53%</strong> (vs. ~56% bij 4/4). De ontbrekende filter staat in rood. Trade alleen als je eigen technische analyse de richting bevestigt.</p>
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
                              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/70 font-mono border border-amber-500/15">{trade.momentum5d > 0 ? '+' : ''}{trade.momentum5d}p</span>
                              <span className="text-[8px] text-red-400/60 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10">{failedFilter}</span>
                              <span className="text-[9px] font-mono text-amber-400 font-bold">3/4</span>
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
