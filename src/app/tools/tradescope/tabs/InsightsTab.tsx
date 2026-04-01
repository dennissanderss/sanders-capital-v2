'use client'

import { useMemo } from 'react'
import type { TsTrade, TsStrategy } from '../types'

interface Props {
  trades: TsTrade[]
  strategies: TsStrategy[]
}

interface Insight {
  type: 'strength' | 'weakness' | 'pattern' | 'warning' | 'tip' | 'achievement'
  title: string
  description: string
  metric?: string
  priority: number
}

export default function InsightsTab({ trades, strategies }: Props) {
  const closed = useMemo(() => trades.filter(t => t.status === 'closed' && t.profit_loss !== null), [trades])

  const insights = useMemo(() => generateInsights(closed, strategies), [closed, strategies])

  // Weekly scorecard
  const weeklyCard = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekTrades = closed.filter(t => new Date(t.open_date) >= weekAgo)
    return generateScorecard(weekTrades, 'Week')
  }, [closed])

  // Monthly scorecard
  const monthlyCard = useMemo(() => {
    const now = new Date()
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const monthTrades = closed.filter(t => new Date(t.open_date) >= monthAgo)
    return generateScorecard(monthTrades, 'Maand')
  }, [closed])

  if (closed.length < 5) {
    return (
      <div className="text-center py-24">
        <p className="text-text-muted mb-2">Minimaal 5 trades nodig voor inzichten</p>
        <p className="text-sm text-text-dim">Voeg meer trades toe om AI-gegenereerde inzichten te ontvangen.</p>
      </div>
    )
  }

  // Group insights by type
  const strengths = insights.filter(i => i.type === 'strength')
  const weaknesses = insights.filter(i => i.type === 'weakness')
  const patterns = insights.filter(i => i.type === 'pattern')
  const warnings = insights.filter(i => i.type === 'warning')
  const tips = insights.filter(i => i.type === 'tip')
  const achievements = insights.filter(i => i.type === 'achievement')

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-display font-semibold text-heading mb-1">Smart Insights</h2>
        <p className="text-xs text-text-dim">Automatisch gegenereerde coaching op basis van jouw data. Wordt bijgewerkt bij iedere trade.</p>
      </div>

      {/* Scorecards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ScorecardDisplay card={weeklyCard} />
        <ScorecardDisplay card={monthlyCard} />
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <InsightSection title="Prestaties" icon="🏆" insights={achievements} color="gold" />
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <InsightSection title="Sterke punten" icon="↑" insights={strengths} color="green" />
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <InsightSection title="Patronen ontdekt" icon="◉" insights={patterns} color="accent" />
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <InsightSection title="Waarschuwingen" icon="⚠" insights={warnings} color="amber" />
      )}

      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <InsightSection title="Verbeterpunten" icon="↓" insights={weaknesses} color="red" />
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <InsightSection title="Suggesties" icon="→" insights={tips} color="accent" />
      )}
    </div>
  )
}

// ─── Scorecard ─────────────────────────────────────────────
interface Scorecard {
  period: string
  trades: number
  pnl: number
  winRate: number
  avgR: number
  disciplineScore: number
  executionScore: number
  grade: string
  gradeColor: string
  highlights: string[]
}

function generateScorecard(trades: TsTrade[], period: string): Scorecard {
  const wins = trades.filter(t => (t.profit_loss || 0) > 0).length
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0
  const pnl = trades.reduce((s, t) => s + (t.profit_loss || 0), 0)
  const withR = trades.filter(t => t.result_r !== null)
  const avgR = withR.length > 0 ? withR.reduce((s, t) => s + (t.result_r || 0), 0) / withR.length : 0

  // Discipline: % trades where rules were followed
  const withRules = trades.filter(t => t.rules_followed !== null)
  const disciplineScore = withRules.length > 0 ? (withRules.filter(t => t.rules_followed).length / withRules.length) * 100 : -1

  // Execution: avg execution quality
  const withExec = trades.filter(t => t.execution_quality !== null)
  const executionScore = withExec.length > 0 ? (withExec.reduce((s, t) => s + (t.execution_quality || 0), 0) / withExec.length) * 20 : -1

  // Grade
  let grade = 'C'
  let gradeColor = 'text-text-dim'
  const score = (winRate * 0.3) + (Math.max(0, pnl > 0 ? 30 : 0)) + (Math.min(disciplineScore >= 0 ? disciplineScore * 0.2 : 10, 20)) + (Math.min(executionScore >= 0 ? executionScore * 0.2 : 10, 20))
  if (score >= 80) { grade = 'A+'; gradeColor = 'text-green-400' }
  else if (score >= 70) { grade = 'A'; gradeColor = 'text-green-400' }
  else if (score >= 60) { grade = 'B+'; gradeColor = 'text-accent-light' }
  else if (score >= 50) { grade = 'B'; gradeColor = 'text-accent-light' }
  else if (score >= 40) { grade = 'C+'; gradeColor = 'text-amber-400' }
  else if (score >= 30) { grade = 'C'; gradeColor = 'text-amber-400' }
  else { grade = 'D'; gradeColor = 'text-red-400' }

  // Highlights
  const highlights: string[] = []
  if (trades.length === 0) highlights.push('Geen trades deze periode')
  else {
    if (pnl > 0) highlights.push(`Winstgevende ${period.toLowerCase()}: +$${pnl.toFixed(2)}`)
    else highlights.push(`Verliesgevende ${period.toLowerCase()}: $${pnl.toFixed(2)}`)
    const impulsive = trades.filter(t => t.was_impulsive).length
    if (impulsive > 0) highlights.push(`${impulsive} impulsieve trade${impulsive > 1 ? 's' : ''}`)
    const revenge = trades.filter(t => t.was_revenge).length
    if (revenge > 0) highlights.push(`${revenge} revenge trade${revenge > 1 ? 's' : ''}`)
    if (disciplineScore >= 80) highlights.push('Sterke discipline')
    if (winRate >= 60) highlights.push(`Hoge win rate: ${winRate.toFixed(0)}%`)
  }

  return { period, trades: trades.length, pnl, winRate, avgR, disciplineScore, executionScore, grade, gradeColor, highlights }
}

function ScorecardDisplay({ card }: { card: Scorecard }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-heading">{card.period} Scorecard</h3>
          <p className="text-xs text-text-dim">{card.trades} trades</p>
        </div>
        <div className={`text-3xl font-display font-bold ${card.gradeColor}`}>{card.grade}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-text-dim">P&L</p>
          <p className={`text-sm font-semibold ${card.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {card.pnl >= 0 ? '+' : ''}${card.pnl.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-dim">Win Rate</p>
          <p className="text-sm font-semibold text-heading">{card.winRate.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-text-dim">Gem. R</p>
          <p className={`text-sm font-semibold ${card.avgR >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {card.avgR >= 0 ? '+' : ''}{card.avgR.toFixed(2)}R
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-dim">Discipline</p>
          <p className="text-sm font-semibold text-heading">
            {card.disciplineScore >= 0 ? `${card.disciplineScore.toFixed(0)}%` : '—'}
          </p>
        </div>
      </div>

      {card.highlights.length > 0 && (
        <div className="space-y-1 pt-3 border-t border-white/[0.06]">
          {card.highlights.map((h, i) => (
            <p key={i} className="text-xs text-text-muted">• {h}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Insight generation engine ─────────────────────────────
function generateInsights(trades: TsTrade[], strategies: TsStrategy[]): Insight[] {
  const insights: Insight[] = []
  if (trades.length < 5) return insights

  const wins = trades.filter(t => (t.profit_loss || 0) > 0)
  const losses = trades.filter(t => (t.profit_loss || 0) < 0)
  const totalPnl = trades.reduce((s, t) => s + (t.profit_loss || 0), 0)
  const winRate = (wins.length / trades.length) * 100
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.profit_loss || 0), 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.profit_loss || 0), 0) / losses.length) : 0

  // ─── Overtrading detection ────────────────────────────
  const dateMap = new Map<string, number>()
  trades.forEach(t => {
    const key = new Date(t.open_date).toISOString().slice(0, 10)
    dateMap.set(key, (dateMap.get(key) || 0) + 1)
  })
  const avgPerDay = trades.length / dateMap.size
  const overtradeDays = Array.from(dateMap.entries()).filter(([, count]) => count > avgPerDay * 2)
  if (overtradeDays.length > 0) {
    const overtradePnl = overtradeDays.reduce((sum, [date]) => {
      return sum + trades.filter(t => new Date(t.open_date).toISOString().slice(0, 10) === date).reduce((s, t) => s + (t.profit_loss || 0), 0)
    }, 0)
    insights.push({
      type: 'warning',
      title: 'Overtrading gedetecteerd',
      description: `${overtradeDays.length} dagen met meer dan ${Math.ceil(avgPerDay * 2)} trades. Deze dagen leveren gemiddeld ${overtradePnl >= 0 ? 'winst' : 'verlies'} op: $${overtradePnl.toFixed(2)}.`,
      metric: `${overtradeDays.length} dagen`,
      priority: 9,
    })
  }

  // ─── Recurring mistakes ──────────────────────────────
  const impulsiveTrades = trades.filter(t => t.was_impulsive)
  if (impulsiveTrades.length >= 3) {
    const impPnl = impulsiveTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
    const impWR = impulsiveTrades.filter(t => (t.profit_loss || 0) > 0).length / impulsiveTrades.length * 100
    insights.push({
      type: impPnl < 0 ? 'weakness' : 'pattern',
      title: 'Impulsieve trades',
      description: `${impulsiveTrades.length} trades gemarkeerd als impulsief. Win rate: ${impWR.toFixed(0)}%, totaal P&L: $${impPnl.toFixed(2)}.${impPnl < 0 ? ' Elimineer deze trades voor betere resultaten.' : ''}`,
      metric: `$${impPnl.toFixed(2)}`,
      priority: 8,
    })
  }

  const revengeTrades = trades.filter(t => t.was_revenge)
  if (revengeTrades.length >= 2) {
    const revPnl = revengeTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
    insights.push({
      type: 'weakness',
      title: 'Revenge trading patroon',
      description: `${revengeTrades.length} revenge trades gevonden met totaal $${revPnl.toFixed(2)} P&L. Revenge trading is bijna altijd verliesgevend — pauzeer na een verlies.`,
      metric: `${revengeTrades.length}x`,
      priority: 9,
    })
  }

  // ─── Rules broken impact ─────────────────────────────
  const rulesBroken = trades.filter(t => t.rules_followed === false)
  const rulesFollowed = trades.filter(t => t.rules_followed === true)
  if (rulesBroken.length >= 3 && rulesFollowed.length >= 3) {
    const brokenWR = rulesBroken.filter(t => (t.profit_loss || 0) > 0).length / rulesBroken.length * 100
    const followedWR = rulesFollowed.filter(t => (t.profit_loss || 0) > 0).length / rulesFollowed.length * 100
    const brokenPnl = rulesBroken.reduce((s, t) => s + (t.profit_loss || 0), 0)
    if (followedWR > brokenWR) {
      insights.push({
        type: 'weakness',
        title: 'Regel-breking kost geld',
        description: `Trades waar regels gevolgd zijn: ${followedWR.toFixed(0)}% win rate. Waar gebroken: ${brokenWR.toFixed(0)}% win rate. Verschil: ${(followedWR - brokenWR).toFixed(1)}%. Kosten: $${Math.abs(brokenPnl).toFixed(2)}.`,
        metric: `-${(followedWR - brokenWR).toFixed(1)}% WR`,
        priority: 10,
      })
    }
  }

  // ─── Best conditions finder ──────────────────────────
  const sessions = ['London', 'New York', 'Asia', 'Overlap']
  sessions.forEach(session => {
    const sessionTrades = trades.filter(t => t.session === session)
    if (sessionTrades.length >= 5) {
      const wr = sessionTrades.filter(t => (t.profit_loss || 0) > 0).length / sessionTrades.length * 100
      const pnl = sessionTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
      if (wr > winRate + 10) {
        insights.push({
          type: 'strength',
          title: `${session} sessie is je sterkste`,
          description: `Win rate in ${session}: ${wr.toFixed(0)}% vs overall ${winRate.toFixed(0)}%. P&L: +$${pnl.toFixed(2)} over ${sessionTrades.length} trades.`,
          metric: `${wr.toFixed(0)}% WR`,
          priority: 7,
        })
      }
      if (wr < winRate - 10 && pnl < 0) {
        insights.push({
          type: 'weakness',
          title: `${session} sessie presteert slecht`,
          description: `Win rate in ${session}: ${wr.toFixed(0)}% vs overall ${winRate.toFixed(0)}%. Verlies: $${pnl.toFixed(2)}. Overweeg deze sessie te vermijden.`,
          metric: `${wr.toFixed(0)}% WR`,
          priority: 7,
        })
      }
    }
  })

  // ─── Strategy insights ───────────────────────────────
  const stratMap = new Map<string, TsTrade[]>()
  trades.forEach(t => {
    const name = strategies.find(s => s.id === t.strategy_id)?.name || 'Geen strategie'
    if (!stratMap.has(name)) stratMap.set(name, [])
    stratMap.get(name)!.push(t)
  })
  stratMap.forEach((stratTrades, name) => {
    if (stratTrades.length >= 5 && name !== 'Geen strategie') {
      const wr = stratTrades.filter(t => (t.profit_loss || 0) > 0).length / stratTrades.length * 100
      const pnl = stratTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
      const exp = pnl / stratTrades.length
      if (exp > 0 && wr >= 50) {
        insights.push({
          type: 'strength',
          title: `"${name}" strategie werkt`,
          description: `${wr.toFixed(0)}% win rate, $${exp.toFixed(2)} expectancy over ${stratTrades.length} trades. Totaal P&L: +$${pnl.toFixed(2)}.`,
          priority: 6,
        })
      }
      if (exp < 0 && stratTrades.length >= 10) {
        insights.push({
          type: 'weakness',
          title: `"${name}" strategie verliesgevend`,
          description: `Negatieve expectancy: $${exp.toFixed(2)} per trade over ${stratTrades.length} trades. Herzie of stop deze strategie.`,
          priority: 8,
        })
      }
    }
  })

  // ─── Win/loss ratio ──────────────────────────────────
  if (avgWin > 0 && avgLoss > 0) {
    const ratio = avgWin / avgLoss
    if (ratio >= 2) {
      insights.push({
        type: 'strength',
        title: 'Uitstekende win/loss ratio',
        description: `Gemiddelde win ($${avgWin.toFixed(2)}) is ${ratio.toFixed(1)}x je gemiddelde loss ($${avgLoss.toFixed(2)}). Dit geeft je edge, zelfs bij lagere win rate.`,
        metric: `${ratio.toFixed(1)}:1`,
        priority: 6,
      })
    }
    if (ratio < 1) {
      insights.push({
        type: 'weakness',
        title: 'Win/loss ratio onder 1:1',
        description: `Gemiddelde win ($${avgWin.toFixed(2)}) is kleiner dan gemiddelde loss ($${avgLoss.toFixed(2)}). Laat winnaars langer lopen of verklein je stop loss.`,
        metric: `${ratio.toFixed(2)}:1`,
        priority: 8,
      })
    }
  }

  // ─── Losing streaks ──────────────────────────────────
  let maxStreak = 0, currentStreak = 0
  trades.forEach(t => {
    if ((t.profit_loss || 0) < 0) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak) }
    else currentStreak = 0
  })
  if (maxStreak >= 5) {
    insights.push({
      type: 'warning',
      title: `${maxStreak} opeenvolgende verliezen`,
      description: `Je langste verliesreeks is ${maxStreak} trades. Dit kan emotioneel zwaar zijn. Gebruik een dagelijks verlies-limiet om dit te beperken.`,
      metric: `${maxStreak} streak`,
      priority: 7,
    })
  }

  // ─── Achievements ────────────────────────────────────
  if (trades.length >= 100) insights.push({ type: 'achievement', title: '100+ trades gelogd', description: 'Je hebt meer dan 100 trades vastgelegd. Consistentie in journaling is de sleutel tot verbetering.', priority: 3 })
  if (trades.length >= 50 && !insights.some(i => i.type === 'achievement')) insights.push({ type: 'achievement', title: '50+ trades bereikt', description: 'Goed begin! Je dataset groeit en inzichten worden betrouwbaarder.', priority: 3 })
  if (totalPnl > 0 && winRate >= 55) insights.push({ type: 'achievement', title: 'Consistent winstgevend', description: `Totaal P&L: +$${totalPnl.toFixed(2)} met ${winRate.toFixed(0)}% win rate. Blijf je plan volgen.`, priority: 4 })

  // ─── Hidden strengths ────────────────────────────────
  const longTrades = trades.filter(t => t.action === 'buy')
  const shortTrades = trades.filter(t => t.action === 'sell')
  if (longTrades.length >= 5 && shortTrades.length >= 5) {
    const longWR = longTrades.filter(t => (t.profit_loss || 0) > 0).length / longTrades.length * 100
    const shortWR = shortTrades.filter(t => (t.profit_loss || 0) > 0).length / shortTrades.length * 100
    if (Math.abs(longWR - shortWR) >= 15) {
      const better = longWR > shortWR ? 'Long' : 'Short'
      const worse = longWR > shortWR ? 'Short' : 'Long'
      insights.push({
        type: 'tip',
        title: `Focus meer op ${better} trades`,
        description: `${better} win rate: ${Math.max(longWR, shortWR).toFixed(0)}% vs ${worse}: ${Math.min(longWR, shortWR).toFixed(0)}%. Overweeg meer ${better.toLowerCase()} setups te zoeken.`,
        priority: 5,
      })
    }
  }

  return insights.sort((a, b) => b.priority - a.priority)
}

// ─── Insight section component ─────────────────────────────
function InsightSection({ title, icon, insights, color }: { title: string; icon: string; insights: Insight[]; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'border-green-500/20 bg-green-500/5',
    red: 'border-red-500/20 bg-red-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
    accent: 'border-accent/20 bg-accent/5',
    gold: 'border-amber-400/30 bg-amber-400/5',
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.accent}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-heading mb-1">{insight.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{insight.description}</p>
              </div>
              {insight.metric && (
                <span className="text-xs font-mono font-semibold text-heading whitespace-nowrap px-2 py-1 rounded bg-white/5">
                  {insight.metric}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
