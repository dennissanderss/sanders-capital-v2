// ─── Telegram Notification System ────────────────────────────
// Professionele push notificaties naar Telegram
// 4x per werkdag, afgestemd op trading sessies
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

// ─── Helpers ────────────────────────────────────────────────

function nlTime(): string {
  return new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
}

function nlDate(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long' })
}

function dirLabel(dir: string): string {
  return dir.includes('bullish') ? 'LONG' : 'SHORT'
}

function dirArrow(dir: string): string {
  return dir.includes('bullish') ? '▲' : '▼'
}

function modelBadges(selective: boolean, balanced: boolean): string {
  const m: string[] = []
  if (selective) m.push('SEL')
  if (balanced) m.push('BAL')
  m.push('AGG')
  return m.join(' · ')
}

interface Session {
  name: string
  emoji: string
  isEndOfDay: boolean
}

// ─── Nieuwe trades notificatie ──────────────────────────────

interface TradeSignal {
  pair: string
  direction: string
  score: number
  momentum5d: number
  conviction: string
  selectiveZone: boolean
  balancedZone: boolean
}

export async function notifyNewTrades(
  trades: TradeSignal[],
  regime: string,
  im: number,
  session: Session
): Promise<boolean> {
  if (trades.length === 0) return true

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>SANDERS CAPITAL</b>`,
    `${session.name} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🔔  <b>${trades.length} NIEUWE TRADE${trades.length > 1 ? 'S' : ''}</b>`,
    ``,
  ]

  for (const t of trades) {
    const arrow = dirArrow(t.direction)
    const dir = dirLabel(t.direction)
    const scoreSign = t.score > 0 ? '+' : ''
    const badges = modelBadges(t.selectiveZone, t.balancedZone)

    lines.push(
      `┌─ <b>${t.pair}</b>  ${arrow} ${dir}`,
      `│  Score: <b>${scoreSign}${t.score}</b>  ·  Mom: <b>${Math.abs(t.momentum5d)}p</b>`,
      `│  Overtuiging: ${t.conviction}`,
      `│  Models: ${badges}`,
      `└─────────────────────`,
      ``,
    )
  }

  lines.push(
    `┌─ <b>MARKT</b>`,
    `│  Regime: ${regime}`,
    `│  IM Alignment: ${im}%${im > 50 ? ' ✓' : ' ✗'}`,
    `└─────────────────────`,
    ``,
    `💡 <i>Open Execution Engine voor timing</i>`,
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
    `📋  <b>SANDERS CAPITAL</b>`,
    `Trackrecord Update · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `<b>${correct}W - ${incorrect}L</b>  ·  ${wr}% winrate  ·  ${totalPips > 0 ? '+' : ''}${totalPips} pips`,
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
    `🔗 sanderscapital.nl/tools/execution`,
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
    `${session.name} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
  ]

  if (existingTrades > 0) {
    lines.push(
      `📊  <b>GEEN NIEUWE TRADES</b>`,
      ``,
      `Bestaande trades vandaag: <b>${existingTrades}</b>`,
      `Geen nieuwe paren passeren de filters.`,
    )
  } else {
    const reason = im <= 50
      ? `IM alignment te laag (${im}%)`
      : `Geen van ${totalPairs} paren passeert alle 4 filters`

    lines.push(
      `📊  <b>GEEN TRADES</b>`,
      ``,
      `${reason}`,
    )
  }

  lines.push(
    ``,
    `┌─ <b>MARKT</b>`,
    `│  Regime: ${regime}`,
    `│  IM Alignment: ${im}%${im > 50 ? ' ✓' : ' ✗'}`,
    `└─────────────────────`,
    ``,
    `<i>Volgende scan: ${session.isEndOfDay ? 'morgen 08:30 NL' : 'zie schema'}</i>`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Legacy wrapper (backwards compatible) ──────────────────

export async function notifyNoTrades(regime: string, im: number, reason: string): Promise<boolean> {
  return notifySessionUpdate(
    { name: 'Update', emoji: '📊', isEndOfDay: false },
    regime, im, 0, 0
  )
}
