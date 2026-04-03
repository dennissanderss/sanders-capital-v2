'use client'

import { useMemo, useState, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import { darkThemeDefaults } from './ChartSetup'
import { createClient } from '@/lib/supabase'
import type { TsTrade, TsRoutine } from '../types'

interface Props {
  trades: TsTrade[]
}

export default function PsychologyTab({ trades }: Props) {
  const [routines, setRoutines] = useState<TsRoutine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const sb = createClient()
      const { data } = await sb.from('ts_routines').select('*').order('date', { ascending: false }).limit(365)
      setRoutines((data || []) as TsRoutine[])
      setLoading(false)
    }
    fetch()
  }, [])

  const closed = useMemo(() => trades.filter(t => t.status === 'closed' && t.profit_loss !== null), [trades])

  // ─── Emotion → Performance correlation ────────────────
  const emotionStats = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; pnl: number }>()
    closed.forEach(t => {
      const emotion = t.emotion_before || 'Niet ingevuld'
      if (!map.has(emotion)) map.set(emotion, { wins: 0, losses: 0, pnl: 0 })
      const entry = map.get(emotion)!
      if ((t.profit_loss || 0) > 0) entry.wins++
      else entry.losses++
      entry.pnl += t.profit_loss || 0
    })
    return Array.from(map.entries())
      .map(([label, data]) => ({ label, ...data, total: data.wins + data.losses, winRate: data.wins / (data.wins + data.losses) * 100 }))
      .sort((a, b) => b.total - a.total)
  }, [closed])

  // ─── Discipline → Performance ─────────────────────────
  const disciplineCorrelation = useMemo(() => {
    const rulesFollowed = closed.filter(t => t.rules_followed === true)
    const rulesBroken = closed.filter(t => t.rules_followed === false)
    const impulsive = closed.filter(t => t.was_impulsive)
    const notImpulsive = closed.filter(t => !t.was_impulsive)
    const revenge = closed.filter(t => t.was_revenge)
    const htfYes = closed.filter(t => t.htf_bias_respected === true)
    const htfNo = closed.filter(t => t.htf_bias_respected === false)
    const calcStats = (arr: TsTrade[]) => ({
      count: arr.length,
      winRate: arr.length > 0 ? (arr.filter(t => (t.profit_loss || 0) > 0).length / arr.length * 100) : 0,
      avgPnl: arr.length > 0 ? arr.reduce((s, t) => s + (t.profit_loss || 0), 0) / arr.length : 0,
      totalPnl: arr.reduce((s, t) => s + (t.profit_loss || 0), 0),
    })

    return [
      { label: 'Regels gevolgd', positive: calcStats(rulesFollowed), negative: calcStats(rulesBroken), posLabel: 'Ja', negLabel: 'Nee' },
      { label: 'Impulsief', positive: calcStats(notImpulsive), negative: calcStats(impulsive), posLabel: 'Nee', negLabel: 'Ja' },
      { label: 'Revenge trading', positive: calcStats(closed.filter(t => !t.was_revenge)), negative: calcStats(revenge), posLabel: 'Nee', negLabel: 'Ja' },
      { label: 'HTF bias gevolgd', positive: calcStats(htfYes), negative: calcStats(htfNo), posLabel: 'Ja', negLabel: 'Nee' },
    ]
  }, [closed])

  // ─── Quality score → Performance ──────────────────────
  const qualityCorrelation = useMemo(() => {
    const scores = [1, 2, 3, 4, 5]
    return scores.map(score => {
      const matching = closed.filter(t => t.trade_quality === score)
      const wins = matching.filter(t => (t.profit_loss || 0) > 0).length
      return {
        score,
        count: matching.length,
        winRate: matching.length > 0 ? (wins / matching.length) * 100 : 0,
        avgPnl: matching.length > 0 ? matching.reduce((s, t) => s + (t.profit_loss || 0), 0) / matching.length : 0,
      }
    })
  }, [closed])

  // ─── Routine → Trade performance (same day) ───────────
  const routineCorrelation = useMemo(() => {
    if (routines.length === 0 || closed.length === 0) return null

    const routineMap = new Map<string, TsRoutine>()
    routines.forEach(r => routineMap.set(r.date, r))

    const withRoutine: { trade: TsTrade; routine: TsRoutine }[] = []
    closed.forEach(t => {
      const dateKey = new Date(t.open_date).toISOString().slice(0, 10)
      const routine = routineMap.get(dateKey)
      if (routine) withRoutine.push({ trade: t, routine })
    })

    if (withRoutine.length < 5) return null

    // Discipline score buckets
    const lowDisc = withRoutine.filter(w => w.routine.discipline_score !== null && w.routine.discipline_score <= 4)
    const midDisc = withRoutine.filter(w => w.routine.discipline_score !== null && w.routine.discipline_score >= 5 && w.routine.discipline_score <= 7)
    const highDisc = withRoutine.filter(w => w.routine.discipline_score !== null && w.routine.discipline_score >= 8)

    const calcGroup = (arr: typeof withRoutine) => ({
      count: arr.length,
      winRate: arr.length > 0 ? (arr.filter(w => (w.trade.profit_loss || 0) > 0).length / arr.length * 100) : 0,
      avgPnl: arr.length > 0 ? arr.reduce((s, w) => s + (w.trade.profit_loss || 0), 0) / arr.length : 0,
    })

    // Pre-session habits
    const prepared = withRoutine.filter(w => w.routine.prepared_properly)
    const notPrepared = withRoutine.filter(w => !w.routine.prepared_properly)
    const exercised = withRoutine.filter(w => w.routine.exercised)
    const notExercised = withRoutine.filter(w => !w.routine.exercised)
    const goodSleep = withRoutine.filter(w => w.routine.sleep_quality !== null && w.routine.sleep_quality >= 4)
    const badSleep = withRoutine.filter(w => w.routine.sleep_quality !== null && w.routine.sleep_quality <= 2)

    return {
      totalMatched: withRoutine.length,
      disciplineScores: [
        { label: 'Laag (1-4)', ...calcGroup(lowDisc) },
        { label: 'Midden (5-7)', ...calcGroup(midDisc) },
        { label: 'Hoog (8-10)', ...calcGroup(highDisc) },
      ],
      habits: [
        { label: 'Goed voorbereid', pos: calcGroup(prepared), neg: calcGroup(notPrepared) },
        { label: 'Gesport', pos: calcGroup(exercised), neg: calcGroup(notExercised) },
        { label: 'Goed geslapen', pos: calcGroup(goodSleep), neg: calcGroup(badSleep) },
      ],
    }
  }, [closed, routines])

  // ─── Bias Accuracy Analysis (fundamental + TA separate) ────
  const biasAnalysis = useMemo(() => {
    const avgPnl = (arr: TsTrade[]) => arr.length > 0 ? arr.reduce((s, t) => s + (t.profit_loss || 0), 0) / arr.length : 0

    const buildAnalysis = (field: 'tool_bias_correct' | 'ta_correct') => {
      const rated = closed.filter(t => t[field] !== null && t[field] !== undefined)
      if (rated.length === 0) return null

      const correct = rated.filter(t => t[field] === true)
      const incorrect = rated.filter(t => t[field] === false)
      const correctWin = correct.filter(t => (t.profit_loss || 0) > 0)
      const correctLoss = correct.filter(t => (t.profit_loss || 0) <= 0)
      const incorrectWin = incorrect.filter(t => (t.profit_loss || 0) > 0)
      const incorrectLoss = incorrect.filter(t => (t.profit_loss || 0) <= 0)

      return {
        total: rated.length,
        correctCount: correct.length,
        incorrectCount: incorrect.length,
        accuracy: (correct.length / rated.length) * 100,
        quadrants: {
          correctWin: { count: correctWin.length, avgPnl: avgPnl(correctWin) },
          correctLoss: { count: correctLoss.length, avgPnl: avgPnl(correctLoss) },
          incorrectWin: { count: incorrectWin.length, avgPnl: avgPnl(incorrectWin) },
          incorrectLoss: { count: incorrectLoss.length, avgPnl: avgPnl(incorrectLoss) },
        },
        correctWinRate: correct.length > 0 ? (correctWin.length / correct.length) * 100 : 0,
        incorrectWinRate: incorrect.length > 0 ? (incorrectWin.length / incorrect.length) * 100 : 0,
      }
    }

    const fundamental = buildAnalysis('tool_bias_correct')
    const technical = buildAnalysis('ta_correct')

    // Cross analysis: both rated
    const bothRated = closed.filter(t => t.tool_bias_correct !== null && t.ta_correct !== null)
    const crossAnalysis = bothRated.length >= 3 ? {
      total: bothRated.length,
      bothCorrect: { count: bothRated.filter(t => t.tool_bias_correct && t.ta_correct).length, winRate: (() => { const arr = bothRated.filter(t => t.tool_bias_correct && t.ta_correct); return arr.length > 0 ? (arr.filter(t => (t.profit_loss || 0) > 0).length / arr.length) * 100 : 0 })(), avgPnl: avgPnl(bothRated.filter(t => t.tool_bias_correct && t.ta_correct)) },
      fundOnlyCorrect: { count: bothRated.filter(t => t.tool_bias_correct && !t.ta_correct).length, winRate: (() => { const arr = bothRated.filter(t => t.tool_bias_correct && !t.ta_correct); return arr.length > 0 ? (arr.filter(t => (t.profit_loss || 0) > 0).length / arr.length) * 100 : 0 })(), avgPnl: avgPnl(bothRated.filter(t => t.tool_bias_correct && !t.ta_correct)) },
      taOnlyCorrect: { count: bothRated.filter(t => !t.tool_bias_correct && t.ta_correct).length, winRate: (() => { const arr = bothRated.filter(t => !t.tool_bias_correct && t.ta_correct); return arr.length > 0 ? (arr.filter(t => (t.profit_loss || 0) > 0).length / arr.length) * 100 : 0 })(), avgPnl: avgPnl(bothRated.filter(t => !t.tool_bias_correct && t.ta_correct)) },
      bothWrong: { count: bothRated.filter(t => !t.tool_bias_correct && !t.ta_correct).length, winRate: (() => { const arr = bothRated.filter(t => !t.tool_bias_correct && !t.ta_correct); return arr.length > 0 ? (arr.filter(t => (t.profit_loss || 0) > 0).length / arr.length) * 100 : 0 })(), avgPnl: avgPnl(bothRated.filter(t => !t.tool_bias_correct && !t.ta_correct)) },
    } : null

    return { fundamental, technical, crossAnalysis }
  }, [closed])

  // ─── Confidence → Accuracy ────────────────────────────
  const confidenceAccuracy = useMemo(() => {
    return [1, 2, 3, 4, 5].map(level => {
      const matching = closed.filter(t => t.confidence_score === level)
      const wins = matching.filter(t => (t.profit_loss || 0) > 0).length
      return {
        level,
        count: matching.length,
        winRate: matching.length > 0 ? (wins / matching.length * 100) : 0,
        avgPnl: matching.length > 0 ? matching.reduce((s, t) => s + (t.profit_loss || 0), 0) / matching.length : 0,
      }
    })
  }, [closed])

  if (closed.length === 0) {
    return <div className="text-center py-24"><p className="text-text-muted">Geen trades met psychologie data gevonden.</p></div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-display font-semibold text-heading mb-1">Psychologie & Performance</h2>
        <p className="text-xs text-text-dim">Correlaties tussen gedrag, emoties, discipline en resultaten.</p>
      </div>

      {/* Discipline impact */}
      <section>
        <h3 className="text-sm font-semibold text-heading mb-3">Discipline Impact</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {disciplineCorrelation.map((item, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <p className="text-xs font-semibold text-heading mb-3">{item.label}</p>
              <div className="grid grid-cols-2 gap-3">
                <ComparisonBox label={item.posLabel} data={item.positive} isPositive />
                <ComparisonBox label={item.negLabel} data={item.negative} isPositive={false} />
              </div>
              {item.positive.count >= 3 && item.negative.count >= 3 && (
                <DeltaInsight
                  label={item.label}
                  positiveWR={item.positive.winRate}
                  negativeWR={item.negative.winRate}
                  positivePnl={item.positive.avgPnl}
                  negativePnl={item.negative.avgPnl}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bias Accuracy Analysis */}
      {(biasAnalysis.fundamental || biasAnalysis.technical) && (
        <section>
          <h3 className="text-sm font-semibold text-heading mb-1">Analyse Nauwkeurigheid</h3>
          <p className="text-xs text-text-dim mb-3">Meet apart of je fundamental tool en technische analyse de juiste richting gaven — los van entry/SL.</p>

          {/* Side-by-side accuracy stats */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* Fundamental */}
            {biasAnalysis.fundamental && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-heading mb-3">Fundamental Tool</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-[10px] text-text-dim uppercase mb-1">Accuracy</p>
                    <p className={`text-2xl font-bold ${biasAnalysis.fundamental.accuracy >= 60 ? 'text-green-400' : biasAnalysis.fundamental.accuracy >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {biasAnalysis.fundamental.accuracy.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-text-dim">{biasAnalysis.fundamental.correctCount}/{biasAnalysis.fundamental.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-text-dim uppercase mb-1">WR bij correct</p>
                    <p className={`text-2xl font-bold ${biasAnalysis.fundamental.correctWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {biasAnalysis.fundamental.correctWinRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-text-dim">{biasAnalysis.fundamental.correctCount} trades</p>
                  </div>
                </div>
                {/* Mini quadrant */}
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-[9px] text-green-400 font-semibold">Correct + Win</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.fundamental.quadrants.correctWin.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] text-amber-400 font-semibold">Correct + Loss</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.fundamental.quadrants.correctLoss.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] text-amber-400 font-semibold">Incorrect + Win</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.fundamental.quadrants.incorrectWin.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-[9px] text-red-400 font-semibold">Incorrect + Loss</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.fundamental.quadrants.incorrectLoss.count}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Technical */}
            {biasAnalysis.technical && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-heading mb-3">Technische Analyse</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-[10px] text-text-dim uppercase mb-1">Accuracy</p>
                    <p className={`text-2xl font-bold ${biasAnalysis.technical.accuracy >= 60 ? 'text-green-400' : biasAnalysis.technical.accuracy >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {biasAnalysis.technical.accuracy.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-text-dim">{biasAnalysis.technical.correctCount}/{biasAnalysis.technical.total}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-text-dim uppercase mb-1">WR bij correct</p>
                    <p className={`text-2xl font-bold ${biasAnalysis.technical.correctWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {biasAnalysis.technical.correctWinRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-text-dim">{biasAnalysis.technical.correctCount} trades</p>
                  </div>
                </div>
                {/* Mini quadrant */}
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-[9px] text-green-400 font-semibold">Correct + Win</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.technical.quadrants.correctWin.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] text-amber-400 font-semibold">Correct + Loss</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.technical.quadrants.correctLoss.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-[9px] text-amber-400 font-semibold">Incorrect + Win</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.technical.quadrants.incorrectWin.count}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-[9px] text-red-400 font-semibold">Incorrect + Loss</p>
                    <p className="text-sm font-bold text-heading">{biasAnalysis.technical.quadrants.incorrectLoss.count}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cross analysis: Fund × TA */}
          {biasAnalysis.crossAnalysis && (
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-semibold text-heading mb-2">Fundamental × Technisch (kruisanalyse)</p>
              <p className="text-[10px] text-text-dim mb-3">Wat gebeurt er als beide kloppen, of slechts één?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
                  <p className="text-[9px] text-green-400 font-semibold uppercase mb-1">Beide correct</p>
                  <p className="text-lg font-bold text-heading">{biasAnalysis.crossAnalysis.bothCorrect.count}</p>
                  {biasAnalysis.crossAnalysis.bothCorrect.count > 0 && <>
                    <p className={`text-[10px] font-medium ${biasAnalysis.crossAnalysis.bothCorrect.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{biasAnalysis.crossAnalysis.bothCorrect.winRate.toFixed(0)}% WR</p>
                    <p className={`text-[10px] ${biasAnalysis.crossAnalysis.bothCorrect.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${biasAnalysis.crossAnalysis.bothCorrect.avgPnl.toFixed(2)}</p>
                  </>}
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] text-blue-400 font-semibold uppercase mb-1">Alleen fund</p>
                  <p className="text-lg font-bold text-heading">{biasAnalysis.crossAnalysis.fundOnlyCorrect.count}</p>
                  {biasAnalysis.crossAnalysis.fundOnlyCorrect.count > 0 && <>
                    <p className={`text-[10px] font-medium ${biasAnalysis.crossAnalysis.fundOnlyCorrect.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{biasAnalysis.crossAnalysis.fundOnlyCorrect.winRate.toFixed(0)}% WR</p>
                    <p className={`text-[10px] ${biasAnalysis.crossAnalysis.fundOnlyCorrect.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${biasAnalysis.crossAnalysis.fundOnlyCorrect.avgPnl.toFixed(2)}</p>
                  </>}
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center">
                  <p className="text-[9px] text-purple-400 font-semibold uppercase mb-1">Alleen TA</p>
                  <p className="text-lg font-bold text-heading">{biasAnalysis.crossAnalysis.taOnlyCorrect.count}</p>
                  {biasAnalysis.crossAnalysis.taOnlyCorrect.count > 0 && <>
                    <p className={`text-[10px] font-medium ${biasAnalysis.crossAnalysis.taOnlyCorrect.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{biasAnalysis.crossAnalysis.taOnlyCorrect.winRate.toFixed(0)}% WR</p>
                    <p className={`text-[10px] ${biasAnalysis.crossAnalysis.taOnlyCorrect.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${biasAnalysis.crossAnalysis.taOnlyCorrect.avgPnl.toFixed(2)}</p>
                  </>}
                </div>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                  <p className="text-[9px] text-red-400 font-semibold uppercase mb-1">Beide fout</p>
                  <p className="text-lg font-bold text-heading">{biasAnalysis.crossAnalysis.bothWrong.count}</p>
                  {biasAnalysis.crossAnalysis.bothWrong.count > 0 && <>
                    <p className={`text-[10px] font-medium ${biasAnalysis.crossAnalysis.bothWrong.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{biasAnalysis.crossAnalysis.bothWrong.winRate.toFixed(0)}% WR</p>
                    <p className={`text-[10px] ${biasAnalysis.crossAnalysis.bothWrong.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${biasAnalysis.crossAnalysis.bothWrong.avgPnl.toFixed(2)}</p>
                  </>}
                </div>
              </div>

              {/* Insights */}
              {biasAnalysis.crossAnalysis.bothCorrect.count >= 3 && (
                <div className="mt-3 space-y-1.5">
                  {biasAnalysis.crossAnalysis.bothCorrect.winRate > 65 && (
                    <p className="text-[11px] px-3 py-2 rounded-lg bg-green-500/10 text-green-400">
                      Als beide analyses kloppen win je {biasAnalysis.crossAnalysis.bothCorrect.winRate.toFixed(0)}% — blijf alleen traden als fund + TA aligned zijn.
                    </p>
                  )}
                  {biasAnalysis.fundamental && biasAnalysis.technical && biasAnalysis.fundamental.accuracy > biasAnalysis.technical.accuracy + 10 && (
                    <p className="text-[11px] px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400">
                      Je fundamental tool ({biasAnalysis.fundamental.accuracy.toFixed(0)}%) is nauwkeuriger dan je TA ({biasAnalysis.technical.accuracy.toFixed(0)}%) — werk aan je technische analyse.
                    </p>
                  )}
                  {biasAnalysis.fundamental && biasAnalysis.technical && biasAnalysis.technical.accuracy > biasAnalysis.fundamental.accuracy + 10 && (
                    <p className="text-[11px] px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400">
                      Je TA ({biasAnalysis.technical.accuracy.toFixed(0)}%) is nauwkeuriger dan je fundamental tool ({biasAnalysis.fundamental.accuracy.toFixed(0)}%).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Emotion analysis */}
      {emotionStats.some(e => e.label !== 'Niet ingevuld') && (
        <section>
          <h3 className="text-sm font-semibold text-heading mb-3">Emotie voor Trade → Resultaat</h3>
          <div className="glass rounded-xl p-4">
            <div style={{ height: Math.max(200, emotionStats.length * 40) }}>
              <Bar
                data={{
                  labels: emotionStats.map(e => e.label),
                  datasets: [
                    { label: 'Win Rate %', data: emotionStats.map(e => e.winRate), backgroundColor: 'rgba(61, 110, 165, 0.6)', borderRadius: 4 },
                  ],
                }}
                options={{ ...darkThemeDefaults, indexAxis: 'y' as const, scales: { x: { ...darkThemeDefaults.scales?.x, max: 100 } }, plugins: { ...darkThemeDefaults.plugins, legend: { display: false } } }}
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="px-2 py-1.5 text-left text-text-dim">Emotie</th>
                  <th className="px-2 py-1.5 text-right text-text-dim">Trades</th>
                  <th className="px-2 py-1.5 text-right text-text-dim">Win Rate</th>
                  <th className="px-2 py-1.5 text-right text-text-dim">Gem P&L</th>
                  <th className="px-2 py-1.5 text-right text-text-dim">Totaal P&L</th>
                </tr></thead>
                <tbody>
                  {emotionStats.map((e, i) => (
                    <tr key={i} className="border-b border-white/[0.03]">
                      <td className="px-2 py-1.5 text-heading">{e.label}</td>
                      <td className="px-2 py-1.5 text-right text-text-muted">{e.total}</td>
                      <td className={`px-2 py-1.5 text-right ${e.winRate >= 55 ? 'text-green-400' : e.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{e.winRate.toFixed(1)}%</td>
                      <td className={`px-2 py-1.5 text-right ${e.pnl / e.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>${(e.pnl / e.total).toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${e.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${e.pnl.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Trade quality → Performance */}
      {qualityCorrelation.some(q => q.count > 0) && (
        <section>
          <h3 className="text-sm font-semibold text-heading mb-3">Trade Kwaliteit Score → Resultaat</h3>
          <div className="glass rounded-xl p-4">
            <div className="grid grid-cols-5 gap-2">
              {qualityCorrelation.map(q => (
                <div key={q.score} className={`text-center p-3 rounded-lg ${q.count > 0 ? 'bg-white/[0.03]' : ''}`}>
                  <p className="text-lg font-bold text-heading">{q.score}</p>
                  <p className="text-[10px] text-text-dim mb-2">{q.count} trades</p>
                  {q.count > 0 && (
                    <>
                      <p className={`text-xs font-medium ${q.winRate >= 55 ? 'text-green-400' : q.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                        {q.winRate.toFixed(0)}%
                      </p>
                      <p className={`text-[10px] ${q.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${q.avgPnl.toFixed(2)}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Confidence → Accuracy */}
      {confidenceAccuracy.some(c => c.count > 0) && (
        <section>
          <h3 className="text-sm font-semibold text-heading mb-3">Confidence Score → Accuraatheid</h3>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-text-dim mb-3">Komt je gevoel overeen met het resultaat? Hoge confidence zou hogere win rate moeten geven.</p>
            <div className="grid grid-cols-5 gap-2">
              {confidenceAccuracy.map(c => (
                <div key={c.level} className="text-center p-3 rounded-lg bg-white/[0.03]">
                  <p className="text-xs text-text-dim mb-1">Conf. {c.level}</p>
                  <p className="text-sm font-semibold text-heading">{c.count > 0 ? `${c.winRate.toFixed(0)}%` : '—'}</p>
                  <p className="text-[10px] text-text-dim">{c.count} trades</p>
                </div>
              ))}
            </div>
            {confidenceAccuracy.filter(c => c.count >= 3).length >= 2 && (() => {
              const high = confidenceAccuracy.filter(c => c.level >= 4 && c.count >= 2)
              const low = confidenceAccuracy.filter(c => c.level <= 2 && c.count >= 2)
              const highAvgWR = high.length > 0 ? high.reduce((s, c) => s + c.winRate * c.count, 0) / high.reduce((s, c) => s + c.count, 0) : 0
              const lowAvgWR = low.length > 0 ? low.reduce((s, c) => s + c.winRate * c.count, 0) / low.reduce((s, c) => s + c.count, 0) : 0
              if (high.length > 0 && low.length > 0) {
                const calibrated = highAvgWR > lowAvgWR
                return (
                  <p className={`text-xs mt-3 px-3 py-2 rounded-lg ${calibrated ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {calibrated
                      ? `✓ Goed gekalibreerd: hoge confidence (${highAvgWR.toFixed(0)}% WR) presteert beter dan lage confidence (${lowAvgWR.toFixed(0)}% WR)`
                      : `⚠ Slechte kalibratie: hoge confidence (${highAvgWR.toFixed(0)}% WR) presteert niet beter dan lage confidence (${lowAvgWR.toFixed(0)}% WR). Werk aan je trade selectie.`
                    }
                  </p>
                )
              }
              return null
            })()}
          </div>
        </section>
      )}

      {/* Routine → Performance */}
      {routineCorrelation && (
        <section>
          <h3 className="text-sm font-semibold text-heading mb-3">Routine → Trade Performance</h3>
          <p className="text-xs text-text-dim mb-3">{routineCorrelation.totalMatched} trades gekoppeld aan routine data</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Discipline score buckets */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-semibold text-heading mb-3">Discipline Score → Resultaat</p>
              {routineCorrelation.disciplineScores.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-xs text-text-muted">{d.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-text-dim">{d.count} trades</span>
                    <span className={`text-xs font-medium ${d.winRate >= 55 ? 'text-green-400' : d.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {d.winRate.toFixed(0)}% WR
                    </span>
                    <span className={`text-xs font-medium ${d.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${d.avgPnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Habits impact */}
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-semibold text-heading mb-3">Gewoonten → Resultaat</p>
              {routineCorrelation.habits.map((h, i) => (
                <div key={i} className="py-2 border-b border-white/[0.04] last:border-0">
                  <p className="text-xs text-text-muted mb-1">{h.label}</p>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="text-green-400">Ja: {h.pos.winRate.toFixed(0)}% WR ({h.pos.count})</span>
                    <span className="text-red-400">Nee: {h.neg.winRate.toFixed(0)}% WR ({h.neg.count})</span>
                    {h.pos.count >= 3 && h.neg.count >= 3 && (
                      <span className={h.pos.winRate > h.neg.winRate ? 'text-green-400' : 'text-amber-400'}>
                        Δ{(h.pos.winRate - h.neg.winRate).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ComparisonBox({ label, data, isPositive }: { label: string; data: { count: number; winRate: number; avgPnl: number; totalPnl: number }; isPositive: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${isPositive ? 'bg-green-500/5 border border-green-500/10' : 'bg-red-500/5 border border-red-500/10'}`}>
      <p className={`text-[10px] font-semibold uppercase ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{label}</p>
      <p className="text-xs text-text-dim mt-1">{data.count} trades</p>
      <p className={`text-sm font-semibold ${data.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{data.winRate.toFixed(1)}% WR</p>
      <p className={`text-xs ${data.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${data.avgPnl.toFixed(2)} avg</p>
    </div>
  )
}

function DeltaInsight({ label, positiveWR, negativeWR, positivePnl, negativePnl }: {
  label: string; positiveWR: number; negativeWR: number; positivePnl: number; negativePnl: number
}) {
  const wrDelta = positiveWR - negativeWR
  const pnlDelta = positivePnl - negativePnl
  const significant = Math.abs(wrDelta) >= 5

  if (!significant) return null

  return (
    <p className={`text-[11px] mt-2 px-2 py-1 rounded ${wrDelta > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
      {wrDelta > 0
        ? `↑ ${label} discipline geeft +${wrDelta.toFixed(1)}% win rate en +$${pnlDelta.toFixed(2)} per trade`
        : `↓ ${label} kost je ${Math.abs(wrDelta).toFixed(1)}% win rate en $${Math.abs(pnlDelta).toFixed(2)} per trade`
      }
    </p>
  )
}
