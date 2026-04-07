// ─── Telegram Setup, Test & Webhook Registration ────────────
// GET: Check status + haal chat ID op
// POST: Test notificatie of webhook registratie
// POST ?action=register-webhook  — Registreer webhook + bot menu
// POST ?action=test              — Stuur test notificatie
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function GET() {
  const token = BOT_TOKEN
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

  // Check webhook status
  let webhookInfo = null
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const data = await res.json()
    webhookInfo = data.result
  } catch { /* ignore */ }

  return NextResponse.json({
    configured: true,
    chatId,
    webhook: webhookInfo?.url || 'niet geregistreerd',
    message: 'Telegram is geconfigureerd. Gebruik POST ?action=register-webhook om de bot commando\'s te activeren.',
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN niet geconfigureerd' }, { status: 400 })
  }

  // ─── Register webhook + bot menu ──────────────────────
  if (action === 'register-webhook') {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sanderscapital.nl'
    const webhookUrl = `${baseUrl}/api/telegram/webhook`

    // 1. Set webhook
    const webhookRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    const webhookData = await webhookRes.json()

    // 2. Set bot commands (menu)
    const commandsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'status', description: '📊 Huidige markt + actieve trades' },
          { command: 'trades', description: '📋 Vandaag\'s trades overzicht' },
          { command: 'track', description: '📈 Trackrecord statistieken' },
          { command: 'schema', description: '⏰ Data update tijden' },
          { command: 'help', description: '❓ Help & commando\'s' },
        ],
      }),
    })
    const commandsData = await commandsRes.json()

    // 3. Set bot description
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Sanders Capital — FX Trade Alerts & Markt Analyse. Ontvang automatisch concrete trades, trackrecord updates en marktoverzichten. 4x per dag vers.',
      }),
    })

    // 4. Set bot short description
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        short_description: 'FX Trade Alerts & Markt Analyse',
      }),
    })

    return NextResponse.json({
      webhook: { success: webhookData.ok, url: webhookUrl },
      commands: { success: commandsData.ok },
      message: webhookData.ok ? 'Webhook geregistreerd + bot menu ingesteld! Probeer /status in Telegram.' : 'Fout bij registratie',
    })
  }

  // ─── Test notificatie ─────────────────────────────────
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'TELEGRAM_CHAT_ID niet geconfigureerd.' }, { status: 400 })
  }

  const success = await sendTelegramMessage([
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `✅  <b>SANDERS CAPITAL</b>`,
    `Test Notificatie`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Je Telegram notificaties werken!`,
    ``,
    `<b>Automatische meldingen:</b>`,
    `  🇬🇧  08:30 — London Pre-Market`,
    `  🌍  12:00 — Middag Update`,
    `  🇺🇸  14:30 — New York Pre-Market`,
    `  🌙  21:00 — Einde Handelsdag`,
    ``,
    `<b>Commando's:</b>`,
    `  /status · /trades · /track · /schema`,
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  ].join('\n'))

  return NextResponse.json({ success, message: success ? 'Test notificatie verstuurd!' : 'Versturen mislukt' })
}
