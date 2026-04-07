// ─── Telegram Setup & Test Endpoint ──────────────────────────
// GET: Check status + haal chat ID op
// POST: Stuur test notificatie
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token) {
    return NextResponse.json({
      configured: false,
      step: 1,
      instruction: [
        '1. Open Telegram en zoek @BotFather',
        '2. Stuur /newbot en volg de stappen',
        '3. Je krijgt een bot token (bijv. 123456:ABC-DEF...)',
        '4. Zet deze als TELEGRAM_BOT_TOKEN in Vercel env vars',
        '5. Stuur /start naar je nieuwe bot in Telegram',
        '6. Bezoek deze pagina opnieuw om je chat ID te vinden',
      ],
    })
  }

  // Haal updates op om chat ID te vinden
  if (!chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
      const data = await res.json()

      const chats = (data.result || [])
        .filter((u: { message?: { chat?: { id: number } } }) => u.message?.chat?.id)
        .map((u: { message: { chat: { id: number; first_name?: string; username?: string } } }) => ({
          chatId: u.message.chat.id,
          name: u.message.chat.first_name || u.message.chat.username || 'Unknown',
        }))

      const uniqueChats = [...new Map(chats.map((c: { chatId: number; name: string }) => [c.chatId, c])).values()]

      return NextResponse.json({
        configured: false,
        step: 2,
        instruction: [
          'Bot token gevonden! Nu nog je chat ID:',
          '1. Stuur /start naar je bot in Telegram (als je dat nog niet gedaan hebt)',
          '2. Refresh deze pagina',
          '3. Kopieer je chat ID en zet als TELEGRAM_CHAT_ID in Vercel env vars',
        ],
        foundChats: uniqueChats,
      })
    } catch (e) {
      return NextResponse.json({ error: 'Kon bot updates niet ophalen: ' + String(e) }, { status: 500 })
    }
  }

  return NextResponse.json({
    configured: true,
    chatId,
    message: 'Telegram notificaties zijn geconfigureerd! POST naar dit endpoint om te testen.',
  })
}

export async function POST() {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'Telegram niet geconfigureerd. Bezoek GET /api/telegram voor setup.' }, { status: 400 })
  }

  const success = await sendTelegramMessage(
    `✅ <b>Sanders Capital — Test Notificatie</b>\n\n` +
    `Je Telegram notificaties werken!\n` +
    `Je ontvangt automatisch meldingen bij:\n\n` +
    `🔔 Nieuwe concrete trades (23:05 NL)\n` +
    `📋 Trackrecord updates (23:00 NL)\n\n` +
    `🔗 sanderscapital.nl/tools/execution`
  )

  return NextResponse.json({ success, message: success ? 'Test notificatie verstuurd!' : 'Versturen mislukt — check je bot token en chat ID' })
}
