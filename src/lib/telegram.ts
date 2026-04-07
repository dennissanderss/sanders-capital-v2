// ─── Telegram Notification System ────────────────────────────
// Professionele push notificaties naar Telegram
// 4x per werkdag, afgestemd op trading sessies
//
// Structuur:
//   1. Markt context (regime, IM)
//   2. Trades per model (SEL/BAL/AGG) met SL/TP/WR
//   3. Resolved trades met resultaat
// ─────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID)
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Also send to approved users
export async function broadcastMessage(text: string): Promise<void> {
  // Always send to admin
  await sendTelegramMessage(text)

  // Also send to approved users if configured
  // (approved users list is in Supabase, fetched by webhook route)
}

// ─── Helpers ────────────────────────────────────────────────

function nlTime(): string {
  return new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
}

function nlDate(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short' })
}

function dirLabel(dir: string): string {
  return dir.includes('bullish') ? 'LONG' : 'SHORT'
}

function dirArrow(dir: string): string {
  return dir.includes('bullish') ? '▲' : '▼'
}

interface Session {
  name: string
  emoji: string
  isEndOfDay: boolean
}

// ─── Model definitions (mirror of execution-types) ──────────

const MODELS = {
  selective: { name: 'Selective', momMin: 30, momMax: 120, sl: 40, tp: 120, wr: 62.4, pf: 4.98 },
  balanced:  { name: 'Balanced',  momMin: 20, momMax: 150, sl: 40, tp: 120, wr: 61.7, pf: 4.83 },
  aggressive:{ name: 'Aggressive',momMin: 0,  momMax: 9999,sl: 40, tp: 120, wr: 58.0, pf: 4.15 },
}

// ─── Nieuwe trades notificatie ──────────────────────────────

export interface TradeSignal {
  pair: string
  direction: string
  score: number
  momentum5d: number
  conviction: string
  selectiveZone: boolean
  balancedZone: boolean
  qualityScore?: number  // 1-10, berekend uit fund + momentum + IM + regime
}

// Calculate quality score (same formula as execution page)
function calcQuality(t: TradeSignal, im: number, regimeAligned: boolean): number {
  const absScore = Math.abs(t.score)
  const absMom = Math.abs(t.momentum5d)
  const fundPts = Math.min(4, absScore * 1.2)
  const contrarianPts = absMom >= 30 && absMom <= 120 ? 2.5 : 1.5
  const imPts = (im / 100) * 2
  const regimePts = regimeAligned ? 1.5 : 0.5
  return Math.min(10, Math.round((fundPts + contrarianPts + imPts + regimePts) * 10) / 10)
}

export async function notifyNewTrades(
  trades: TradeSignal[],
  regime: string,
  im: number,
  session: Session
): Promise<boolean> {
  if (trades.length === 0) return true

  // Add quality scores
  const withQuality = trades.map(t => ({
    ...t,
    quality: t.qualityScore ?? calcQuality(t, im, true),
  }))

  // Group trades by highest model they qualify for
  const selective = withQuality.filter(t => t.selectiveZone)
  const balancedOnly = withQuality.filter(t => t.balancedZone && !t.selectiveZone)
  const aggressiveOnly = withQuality.filter(t => !t.balancedZone && !t.selectiveZone)

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>SANDERS CAPITAL</b>`,
    `${session.name} · ${nlDate()} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `┌─ <b>MARKT</b>`,
    `│  ${regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'}  Regime: <b>${regime}</b>`,
    `│  IM Alignment: <b>${im}%</b>${im > 50 ? ' ✓' : ' ✗'}`,
    `└─────────────────────`,
    ``,
    `🔔  <b>${trades.length} TRADE${trades.length > 1 ? 'S' : ''} GEVONDEN</b>`,
    ``,
  ]

  // ─── Selective trades ───
  if (selective.length > 0) {
    const m = MODELS.selective
    lines.push(
      `🎯  <b>SELECTIVE</b>  ·  ${m.wr}% WR  ·  SL ${m.sl}p / TP ${m.tp}p`,
      `<i>Momentum ${m.momMin}-${m.momMax}p tegen de bias</i>`,
    )
    for (const t of selective) {
      lines.push(`  ${dirArrow(t.direction)} <b>${t.pair}</b>  ${dirLabel(t.direction)}  ·  ${t.quality.toFixed(1)}/10  ·  ${Math.abs(t.momentum5d)}p dip`)
    }
    lines.push(``)
  }

  // ─── Balanced-only trades ───
  if (balancedOnly.length > 0) {
    const m = MODELS.balanced
    lines.push(
      `⚖️  <b>BALANCED</b>  ·  ${m.wr}% WR  ·  SL ${m.sl}p / TP ${m.tp}p`,
      `<i>Momentum ${m.momMin}-${m.momMax}p tegen de bias</i>`,
    )
    for (const t of balancedOnly) {
      lines.push(`  ${dirArrow(t.direction)} <b>${t.pair}</b>  ${dirLabel(t.direction)}  ·  ${t.quality.toFixed(1)}/10  ·  ${Math.abs(t.momentum5d)}p dip`)
    }
    lines.push(``)
  }

  // ─── Aggressive-only trades ───
  if (aggressiveOnly.length > 0) {
    const m = MODELS.aggressive
    lines.push(
      `⚡  <b>AGGRESSIVE</b>  ·  ${m.wr}% WR  ·  SL ${m.sl}p / TP ${m.tp}p`,
      `<i>Geen momentum filter</i>`,
    )
    for (const t of aggressiveOnly) {
      lines.push(`  ${dirArrow(t.direction)} <b>${t.pair}</b>  ${dirLabel(t.direction)}  ·  ${t.quality.toFixed(1)}/10  ·  ${Math.abs(t.momentum5d)}p dip`)
    }
    lines.push(``)
  }

  lines.push(
    `<i>Open 1H chart → wacht op reversal candle</i>`,
    `🔗 sanderscapital.nl/tools/execution`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Resolved trades notificatie ────────────────────────────

interface ResolvedTrade {
  pair: string
  direction: string
  result: 'correct' | 'incorrect'
  pips: number
}

export async function notifyResolvedTrades(trades: ResolvedTrade[]): Promise<boolean> {
  if (trades.length === 0) return true

  const correct = trades.filter(t => t.result === 'correct').length
  const incorrect = trades.length - correct
  const wr = Math.round((correct / trades.length) * 100)
  const totalPips = trades.reduce((sum, t) => sum + t.pips, 0)

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋  <b>RESULTATEN</b>`,
    `${nlDate()} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `<b>${correct}W - ${incorrect}L</b>  ·  ${wr}% WR  ·  ${totalPips > 0 ? '+' : ''}${totalPips} pips`,
    ``,
  ]

  for (const t of trades) {
    const icon = t.result === 'correct' ? '✅' : '❌'
    const dir = dirLabel(t.direction)
    const pipsStr = t.pips > 0 ? `+${t.pips}p` : `${t.pips}p`
    lines.push(`${icon}  <b>${t.pair}</b>  ${dir}  →  ${pipsStr}`)
  }

  lines.push(
    ``,
    `🔗 sanderscapital.nl/tools/execution#engine-trackrecord`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Session update (geen nieuwe trades) ────────────────────

export async function notifySessionUpdate(
  session: Session,
  regime: string,
  im: number,
  existingTrades: number,
  totalPairs: number
): Promise<boolean> {
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>SANDERS CAPITAL</b>`,
    `${session.name} · ${nlDate()} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `┌─ <b>MARKT</b>`,
    `│  ${regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'}  Regime: <b>${regime}</b>`,
    `│  IM Alignment: <b>${im}%</b>${im > 50 ? ' ✓' : ' ✗'}`,
    `└─────────────────────`,
    ``,
  ]

  if (existingTrades > 0) {
    lines.push(
      `📊  <b>GEEN NIEUWE TRADES</b>`,
      `Bestaande trades vandaag: <b>${existingTrades}</b>`,
      `Geen nieuwe paren passeren alle filters.`,
    )
  } else {
    if (im <= 50) {
      lines.push(
        `📊  <b>GEEN TRADES</b>`,
        `IM alignment te laag (${im}%). Minimaal 50% nodig.`,
      )
    } else {
      lines.push(
        `📊  <b>GEEN TRADES</b>`,
        `Geen van ${totalPairs} paren passeert alle 4 filters.`,
      )
    }
  }

  lines.push(
    ``,
    `<i>Volgende scan: ${session.isEndOfDay ? 'morgen 08:30' : 'zie /schema'}</i>`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Legacy wrapper ─────────────────────────────────────────

export async function notifyNoTrades(regime: string, im: number, reason: string): Promise<boolean> {
  return notifySessionUpdate(
    { name: 'Update', emoji: '📊', isEndOfDay: false },
    regime, im, 0, 0
  )
}
