import type { ParsedTrade } from './csvParser'

export interface TradeMetrics {
  totalTrades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  expectancy: number
  totalPnL: number
  avgPnL: number
  maxDrawdown: number
  maxDrawdownPercent: number
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
  sharpeRatio: number
  avgRR: number
  avgHoldingTime: number
  bestTrade: number
  worstTrade: number
  longWinRate: number
  shortWinRate: number
  totalLongs: number
  totalShorts: number
  longsProfit: number
  shortsProfit: number
  avgPips: number
  totalPips: number
  // Per session
  sessionStats: Record<string, { trades: number; winRate: number; pnl: number }>
  // Per day
  dayStats: Record<string, { trades: number; winRate: number; pnl: number }>
  // Per pair
  pairStats: Record<string, { trades: number; winRate: number; pnl: number; avgPips: number }>
  // Equity curve
  equityCurve: { date: Date; equity: number; trade: number }[]
  // Drawdown curve
  drawdownCurve: { date: Date; drawdown: number }[]
  // Monthly returns
  monthlyReturns: Record<string, number>
  // Daily PnL for calendar
  dailyPnL: Record<string, number>
}

export function calculateMetrics(trades: ParsedTrade[], startingBalance: number = 10000): TradeMetrics {
  if (trades.length === 0) {
    return getEmptyMetrics()
  }

  const wins = trades.filter((t) => t.profitLoss > 0)
  const losses = trades.filter((t) => t.profitLoss < 0)
  const breakeven = trades.filter((t) => t.profitLoss === 0)

  const totalWinAmount = wins.reduce((s, t) => s + t.profitLoss, 0)
  const totalLossAmount = Math.abs(losses.reduce((s, t) => s + t.profitLoss, 0))
  const totalPnL = trades.reduce((s, t) => s + t.profitLoss, 0)
  const totalPips = trades.reduce((s, t) => s + t.pips, 0)

  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0

  const winRate = (wins.length / trades.length) * 100
  const expectancy = trades.reduce((s, t) => s + t.profitLoss, 0) / trades.length

  // Long/Short
  const longs = trades.filter((t) => t.action === 'buy')
  const shorts = trades.filter((t) => t.action === 'sell')
  const longWins = longs.filter((t) => t.isWin).length
  const shortWins = shorts.filter((t) => t.isWin).length

  // Equity curve + drawdown
  let equity = startingBalance
  let peak = equity
  let maxDD = 0
  let maxDDPercent = 0
  const equityCurve: { date: Date; equity: number; trade: number }[] = [
    { date: trades[0].openDate, equity: startingBalance, trade: 0 },
  ]
  const drawdownCurve: { date: Date; drawdown: number }[] = []

  trades.forEach((t, i) => {
    equity += t.profitLoss
    equityCurve.push({ date: t.closeDate, equity, trade: i + 1 })
    if (equity > peak) peak = equity
    const dd = peak - equity
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
    if (ddPct > maxDDPercent) maxDDPercent = ddPct
    drawdownCurve.push({ date: t.closeDate, drawdown: -ddPct })
  })

  // Consecutive wins/losses
  let maxConsW = 0
  let maxConsL = 0
  let curW = 0
  let curL = 0
  trades.forEach((t) => {
    if (t.isWin) {
      curW++
      curL = 0
      if (curW > maxConsW) maxConsW = curW
    } else {
      curL++
      curW = 0
      if (curL > maxConsL) maxConsL = curL
    }
  })

  // Sharpe Ratio (annualized, using daily returns approximation)
  const returns = trades.map((t) => t.profitLoss)
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length
  const stdDev = Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length)
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0

  // Average RR
  const rrTrades = trades.filter((t) => t.riskReward !== null)
  const avgRR = rrTrades.length > 0 ? rrTrades.reduce((s, t) => s + (t.riskReward || 0), 0) / rrTrades.length : 0

  // Session stats
  const sessionStats: Record<string, { trades: number; winRate: number; pnl: number }> = {}
  for (const session of ['London', 'New York', 'Asia', 'Overlap']) {
    const st = trades.filter((t) => t.session === session)
    sessionStats[session] = {
      trades: st.length,
      winRate: st.length > 0 ? (st.filter((t) => t.isWin).length / st.length) * 100 : 0,
      pnl: st.reduce((s, t) => s + t.profitLoss, 0),
    }
  }

  // Day stats
  const dayStats: Record<string, { trades: number; winRate: number; pnl: number }> = {}
  const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
  for (const day of days) {
    const dt = trades.filter((t) => t.dayOfWeek === day)
    dayStats[day] = {
      trades: dt.length,
      winRate: dt.length > 0 ? (dt.filter((t) => t.isWin).length / dt.length) * 100 : 0,
      pnl: dt.reduce((s, t) => s + t.profitLoss, 0),
    }
  }

  // Pair stats
  const pairStats: Record<string, { trades: number; winRate: number; pnl: number; avgPips: number }> = {}
  const pairs = [...new Set(trades.map((t) => t.symbol))]
  for (const pair of pairs) {
    const pt = trades.filter((t) => t.symbol === pair)
    pairStats[pair] = {
      trades: pt.length,
      winRate: pt.length > 0 ? (pt.filter((t) => t.isWin).length / pt.length) * 100 : 0,
      pnl: pt.reduce((s, t) => s + t.profitLoss, 0),
      avgPips: pt.length > 0 ? pt.reduce((s, t) => s + t.pips, 0) / pt.length : 0,
    }
  }

  // Monthly returns
  const monthlyReturns: Record<string, number> = {}
  trades.forEach((t) => {
    const key = `${t.closeDate.getFullYear()}-${String(t.closeDate.getMonth() + 1).padStart(2, '0')}`
    monthlyReturns[key] = (monthlyReturns[key] || 0) + t.profitLoss
  })

  // Daily PnL
  const dailyPnL: Record<string, number> = {}
  trades.forEach((t) => {
    const key = t.closeDate.toISOString().split('T')[0]
    dailyPnL[key] = (dailyPnL[key] || 0) + t.profitLoss
  })

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    totalPnL,
    avgPnL: totalPnL / trades.length,
    maxDrawdown: maxDD,
    maxDrawdownPercent: maxDDPercent,
    maxConsecutiveWins: maxConsW,
    maxConsecutiveLosses: maxConsL,
    sharpeRatio: sharpe,
    avgRR,
    avgHoldingTime: trades.reduce((s, t) => s + t.holdingTimeMinutes, 0) / trades.length,
    bestTrade: Math.max(...trades.map((t) => t.profitLoss)),
    worstTrade: Math.min(...trades.map((t) => t.profitLoss)),
    longWinRate: longs.length > 0 ? (longWins / longs.length) * 100 : 0,
    shortWinRate: shorts.length > 0 ? (shortWins / shorts.length) * 100 : 0,
    totalLongs: longs.length,
    totalShorts: shorts.length,
    longsProfit: longs.reduce((s, t) => s + t.profitLoss, 0),
    shortsProfit: shorts.reduce((s, t) => s + t.profitLoss, 0),
    avgPips: totalPips / trades.length,
    totalPips,
    sessionStats,
    dayStats,
    pairStats,
    equityCurve,
    drawdownCurve,
    monthlyReturns,
    dailyPnL,
  }
}

export function runMonteCarlo(
  trades: ParsedTrade[],
  simulations: number = 1000,
  startingBalance: number = 10000
): {
  median: number[]
  p5: number[]
  p95: number[]
  p25: number[]
  p75: number[]
  ruinProbability: number
  medianFinal: number
  avgMaxDrawdown: number
} {
  const pnls = trades.map((t) => t.profitLoss)
  const n = pnls.length
  const results: number[][] = []
  let ruinCount = 0
  const maxDDs: number[] = []

  for (let sim = 0; sim < simulations; sim++) {
    let equity = startingBalance
    let peak = equity
    let maxDD = 0
    const curve: number[] = [equity]
    let ruined = false

    for (let i = 0; i < n; i++) {
      const randomIndex = Math.floor(Math.random() * n)
      equity += pnls[randomIndex]
      curve.push(equity)
      if (equity > peak) peak = equity
      const dd = (peak - equity) / peak
      if (dd > maxDD) maxDD = dd
      if (equity <= 0) {
        ruined = true
        // Fill remaining with 0
        while (curve.length <= n) curve.push(0)
        break
      }
    }

    results.push(curve)
    if (ruined) ruinCount++
    maxDDs.push(maxDD * 100)
  }

  // Calculate percentiles for each trade step
  const tradeCount = n + 1
  const median: number[] = []
  const p5: number[] = []
  const p95: number[] = []
  const p25: number[] = []
  const p75: number[] = []

  for (let step = 0; step < tradeCount; step++) {
    const values = results.map((r) => r[step] ?? 0).sort((a, b) => a - b)
    p5.push(values[Math.floor(simulations * 0.05)])
    p25.push(values[Math.floor(simulations * 0.25)])
    median.push(values[Math.floor(simulations * 0.5)])
    p75.push(values[Math.floor(simulations * 0.75)])
    p95.push(values[Math.floor(simulations * 0.95)])
  }

  const finals = results.map((r) => r[r.length - 1]).sort((a, b) => a - b)

  return {
    median,
    p5,
    p95,
    p25,
    p75,
    ruinProbability: (ruinCount / simulations) * 100,
    medianFinal: finals[Math.floor(simulations * 0.5)],
    avgMaxDrawdown: maxDDs.reduce((s, d) => s + d, 0) / maxDDs.length,
  }
}

export function optimizeRiskReward(
  trades: ParsedTrade[],
  startingBalance: number = 10000
): {
  currentMetrics: { riskPercent: number; expectancy: number; finalEquity: number; maxDD: number }
  optimized: { riskPercent: number; expectancy: number; finalEquity: number; maxDD: number }[]
} {
  const riskLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5]

  function simulateRisk(riskPct: number) {
    let equity = startingBalance
    let peak = equity
    let maxDD = 0

    trades.forEach((t) => {
      // Scale P&L relative to risk percentage
      const riskAmount = equity * (riskPct / 100)
      const avgRisk = trades.reduce((s, tr) => s + Math.abs(tr.profitLoss), 0) / trades.length
      const scaledPnL = avgRisk > 0 ? (t.profitLoss / avgRisk) * riskAmount : 0
      equity += scaledPnL
      if (equity > peak) peak = equity
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
      if (dd > maxDD) maxDD = dd
    })

    const avgPnL = (equity - startingBalance) / trades.length
    return {
      riskPercent: riskPct,
      expectancy: avgPnL,
      finalEquity: equity,
      maxDD,
    }
  }

  const optimized = riskLevels.map((r) => simulateRisk(r))
  const currentMetrics = simulateRisk(1) // Default 1% risk

  return { currentMetrics, optimized }
}

function getEmptyMetrics(): TradeMetrics {
  return {
    totalTrades: 0, wins: 0, losses: 0, breakeven: 0, winRate: 0,
    avgWin: 0, avgLoss: 0, profitFactor: 0, expectancy: 0,
    totalPnL: 0, avgPnL: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
    maxConsecutiveWins: 0, maxConsecutiveLosses: 0, sharpeRatio: 0,
    avgRR: 0, avgHoldingTime: 0, bestTrade: 0, worstTrade: 0,
    longWinRate: 0, shortWinRate: 0, totalLongs: 0, totalShorts: 0,
    longsProfit: 0, shortsProfit: 0, avgPips: 0, totalPips: 0,
    sessionStats: {}, dayStats: {}, pairStats: {},
    equityCurve: [], drawdownCurve: {}, monthlyReturns: {},
    dailyPnL: {},
  } as unknown as TradeMetrics
}
