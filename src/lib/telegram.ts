// ─── Telegram Messaging ──────────────────────────────────────
// Generieke berichten-primitives voor de Sanders Capital bot.
// De execution trade-alert notificaties (notifyMorning/NewTrades/
// SessionUpdate/Evening, SL/TP-modellen) zijn verwijderd samen met
// de execution engine.
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
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    return res.ok
  } catch { return false }
}

export async function broadcastMessage(text: string): Promise<void> {
  await sendTelegramMessage(text)
}
