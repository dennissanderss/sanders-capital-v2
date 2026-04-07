// ─── Telegram Notification System ────────────────────────────
// Stuurt push notificaties naar Telegram bij nieuwe trades
// Setup:
// 1. Maak bot via @BotFather in Telegram → krijg TELEGRAM_BOT_TOKEN
// 2. Stuur /start naar je bot, haal chat ID op via /api/telegram/setup
// 3. Zet TELEGRAM_BOT_TOKEN en TELEGRAM_CHAT_ID in Vercel env vars
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

// ─── Formatted messages ─────────────────────────────────────

interface TradeSignal {
  pair: string
  direction: string
  score: number
  momentum5d: number
  conviction: string
  selectiveZone: boolean
  balancedZone: boolean
}

export async function notifyNewTrades(trades: TradeSignal[], regime: string, im: number): Promise<boolean> {
  if (trades.length === 0) return true

  const lines = [
    `🔔 <b>Sanders Capital — ${trades.length} nieuwe trade${trades.length > 1 ? 's' : ''}</b>`,
    ``,
    `📊 Regime: <b>${regime}</b> · IM: <b>${im}%</b>`,
    `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`,
    ``,
  ]

  for (const t of trades) {
    const dir = t.direction.includes('bullish') ? '🟢 LONG' : '🔴 SHORT'
    const models: string[] = []
    if (t.selectiveZone) models.push('Sel')
    if (t.balancedZone) models.push('Bal')
    models.push('Agg') // altijd aggressive

    lines.push(
      `<b>${t.pair}</b> ${dir}`,
      `  Score: ${t.score > 0 ? '+' : ''}${t.score} · Mom: ${t.momentum5d}p · ${t.conviction}`,
      `  Models: ${models.join(' / ')}`,
      ``
    )
  }

  lines.push(
    `💡 Open de <b>Execution Engine</b> voor timing & entry`,
    `🔗 sanderscapital.nl/tools/execution`
  )

  return sendTelegramMessage(lines.join('\n'))
}

interface ResolvedTrade {
  pair: string
  direction: string
  result: 'correct' | 'incorrect'
  pips: number
}

export async function notifyResolvedTrades(trades: ResolvedTrade[]): Promise<boolean> {
  if (trades.length === 0) return true

  const correct = trades.filter(t => t.result === 'correct').length
  const wr = Math.round((correct / trades.length) * 100)

  const lines = [
    `📋 <b>Sanders Capital — Trackrecord Update</b>`,
    ``,
    `${correct}/${trades.length} correct (${wr}%)`,
    ``,
  ]

  for (const t of trades) {
    const icon = t.result === 'correct' ? '✅' : '❌'
    const dir = t.direction?.includes('bullish') ? 'LONG' : 'SHORT'
    lines.push(`${icon} <b>${t.pair}</b> ${dir} → ${t.pips > 0 ? '+' : ''}${t.pips}p`)
  }

  lines.push(``, `🔗 sanderscapital.nl/tools/execution`)

  return sendTelegramMessage(lines.join('\n'))
}

export async function notifyNoTrades(regime: string, im: number, reason: string): Promise<boolean> {
  return sendTelegramMessage(
    `📊 <b>Sanders Capital — Geen trades vandaag</b>\n\n` +
    `Regime: ${regime} · IM: ${im}%\n` +
    `Reden: ${reason}\n\n` +
    `Dit is normaal — niet elke dag zijn er setups.`
  )
}
