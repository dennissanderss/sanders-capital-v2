// ─── Telegram Bot Webhook ─────────────────────────────────────
// Verwerkt inkomende berichten en stuurt interactief dashboard
// Registreer met: POST /api/telegram?action=register-webhook
// ──────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID // Admin chat ID
const APPROVED_CHATS_KEY = 'telegram_approved_chats' // Supabase key

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function nlTime(): string {
  return new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
}

function nlDate(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long' })
}

async function sendReply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

// ─── Approved users management ─────────────────────────────
// Stores approved chat IDs in Supabase tool_settings table

async function getApprovedChats(): Promise<string[]> {
  try {
    const { data } = await getSupabase()
      .from('tool_settings')
      .select('value')
      .eq('key', APPROVED_CHATS_KEY)
      .single()
    if (data?.value) return JSON.parse(data.value)
  } catch { /* ignore */ }
  return []
}

async function addApprovedChat(chatId: string, name: string): Promise<void> {
  const approved = await getApprovedChats()
  if (approved.includes(chatId)) return
  approved.push(chatId)
  await getSupabase()
    .from('tool_settings')
    .upsert({ key: APPROVED_CHATS_KEY, value: JSON.stringify(approved) }, { onConflict: 'key' })
}

async function removeApprovedChat(chatId: string): Promise<void> {
  const approved = await getApprovedChats()
  const filtered = approved.filter(id => id !== chatId)
  await getSupabase()
    .from('tool_settings')
    .upsert({ key: APPROVED_CHATS_KEY, value: JSON.stringify(filtered) }, { onConflict: 'key' })
}

async function isApproved(chatId: string): Promise<boolean> {
  if (CHAT_ID && chatId === CHAT_ID) return true // Admin altijd goedgekeurd
  const approved = await getApprovedChats()
  return approved.includes(chatId)
}

// ─── Pending access requests (in-memory, resets on cold start) ──
const pendingRequests = new Map<string, { name: string; requestedAt: string }>()

// ─── Command handlers ───────────────────────────────────────

async function handleStart(chatId: number) {
  await sendReply(chatId, [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊  <b>SANDERS CAPITAL BOT</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Deze bot is een geautomatiseerde`,
    `koppeling met <b>sanderscapital.nl</b>.`,
    ``,
    `Elke werkdag analyseert het systeem`,
    `21 valutaparen op fundamentele data,`,
    `intermarket confirmatie en nieuws-`,
    `sentiment. Het levert per dag een`,
    `marktregime en een handvol concrete`,
    `calls met:`,
    ``,
    `  · Kwaliteitsscore (1-10)`,
    `  · Richting (long/short)`,
    `  · Onderbouwing per call`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>Dagelijkse routine:</b>`,
    `  ☀️  08:30 — Verse ochtend-briefing`,
    `  🌍  12:00 — Middag update`,
    `  🇺🇸  14:00 — New York sessie`,
    `  🌙  21:00 — Afsluiting`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `<b>Commando's:</b>`,
    `/status    — Markt + concrete calls`,
    `/schema    — Data update tijden`,
    `/help      — Dit menu`,
    ``,
    `🔗 sanderscapital.nl`,
  ].join('\n'))
}

async function handleStatus(chatId: number) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sanderscapital.nl'
    const res = await fetch(`${baseUrl}/api/briefing-v2`, { next: { revalidate: 0 } })
    const data = await res.json()

    if (data.error) {
      await sendReply(chatId, '❌ Kon briefing data niet laden.')
      return
    }

    const im = data.intermarketAlignment ?? 0
    const regime = data.regime || 'Gemengd'
    const pairs = data.pairBiases || []
    const v3Signals = data.v3?.pairSignals || []
    const regimeIcon = regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'

    // Build entry-ready calls from the briefing (score >=2, IM >=50, contrarian 5d)
    const concrete: { pair: string; direction: string; score: number; pips5d: number }[] = []
    for (const p of pairs) {
      const absScore = Math.abs(p.score)
      const isBull = p.direction?.includes('bullish')
      const isBear = p.direction?.includes('bearish')
      if (!isBull && !isBear) continue
      if (absScore < 2.0 || im < 50) continue
      const v3 = v3Signals.find((s: { pair: string }) => s.pair === p.pair)
      const pips5d = v3?.priceMomentum?.pips5d ?? 0
      const contrarianPass = (isBull && pips5d < 0) || (isBear && pips5d > 0)
      if (!contrarianPass) continue
      concrete.push({ pair: p.pair, direction: p.direction, score: p.score, pips5d })
    }

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📊  <b>MARKT STATUS</b>`,
      `${nlDate()} · ${nlTime()}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${regimeIcon}  Regime: <b>${regime}</b>`,
      `📊  IM Alignment: <b>${im}%</b>${im >= 50 ? ' ✓' : ' ✗ (te laag)'}`,
      ``,
    ]

    if (concrete.length > 0) {
      lines.push(`🔔  <b>${concrete.length} CONCRETE CALL${concrete.length > 1 ? 'S' : ''}</b>`, ``)

      // Conviction score (4-component qualityScore)
      function quality(score: number, mom: number): number {
        const f = Math.min(4, Math.abs(score) * 1.2)
        const c = Math.abs(mom) >= 30 && Math.abs(mom) <= 120 ? 2.5 : 1.5
        const i = (im / 100) * 2
        return Math.min(10, Math.round((f + c + i + 1) * 10) / 10)
      }

      for (const t of concrete.slice(0, 8)) {
        const dir = t.direction.includes('bullish') ? '▲ LONG' : '▼ SHORT'
        const q = quality(t.score, t.pips5d)
        lines.push(`   ${dir}  <b>${t.pair}</b>  ·  ${q.toFixed(1)}/10`)
      }
    } else {
      lines.push(
        `📭  <b>Geen concrete calls</b>`,
        ``,
        im < 50
          ? `IM alignment te laag (${im}%)`
          : `Geen paren passeren alle 4 filters`,
      )
    }

    lines.push(
      ``,
      `<i>Laatste update: ${nlTime()}</i>`,
      `🔗 sanderscapital.nl/tools/fx-selector/v2`,
    )

    await sendReply(chatId, lines.join('\n'))
  } catch {
    await sendReply(chatId, '❌ Fout bij het ophalen van data.')
  }
}

async function handleSchema(chatId: number) {
  await sendReply(chatId, [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `⏰  <b>DATA UPDATE SCHEMA</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Alle tools worden <b>4x per werkdag</b>`,
    `automatisch ververst:`,
    ``,
    `🇬🇧  <b>08:30 NL</b> — London Pre-Market`,
    `     Nieuws, briefing, scores, IM`,
    `     → verse analyse voor Londense sessie`,
    ``,
    `🌍  <b>12:00 NL</b> — Middag Update`,
    `     Herberekening na de ochtend`,
    `     → nieuwe calls als condities wijzigen`,
    ``,
    `🇺🇸  <b>14:00 NL</b> — New York Sessie`,
    `     Verse data voor NY sessie`,
    `     → IM en momentum veranderen vaak 's middags`,
    ``,
    `🌙  <b>21:00 NL</b> — Einde Handelsdag`,
    `     Laatste scan van de dag`,
    `     → trackrecord wordt bijgewerkt`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>Wat wordt ververst?</b>`,
    `  📰 Nieuws (RSS feeds)`,
    `  📊 Briefing (scores, IM, regime)`,
    `  📈 Trackrecord (calls)`,
    `  💹 Prijzen (Yahoo Finance)`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Je ontvangt bij <b>elke scan</b> een melding.`,
  ].join('\n'))
}

// ─── Webhook handler ────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = body.message
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim().toLowerCase()

    const isAdmin = CHAT_ID && String(chatId) === CHAT_ID
    const chatIdStr = String(chatId)
    const userName = message.chat?.first_name || message.chat?.username || 'Onbekend'

    // ─── /start van nieuwe gebruiker: access request ──
    if (text === '/start' && !isAdmin && !(await isApproved(chatIdStr))) {
      pendingRequests.set(chatIdStr, { name: userName, requestedAt: new Date().toISOString() })
      await sendReply(chatId, [
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🔒  <b>SANDERS CAPITAL BOT</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Welkom ${userName}!`,
        ``,
        `Deze bot is privé. Je toegangsverzoek`,
        `is verstuurd naar de admin.`,
        ``,
        `Je ontvangt een melding zodra je`,
        `bent goedgekeurd.`,
      ].join('\n'))
      // Notify admin
      if (CHAT_ID) {
        await sendReply(Number(CHAT_ID), [
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `🔔  <b>NIEUW TOEGANGSVERZOEK</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `<b>Naam:</b> ${userName}`,
          `<b>Chat ID:</b> <code>${chatIdStr}</code>`,
          ``,
          `Goedkeuren:  /approve_${chatIdStr}`,
          `Weigeren:    /deny_${chatIdStr}`,
          `Alle users:  /users`,
        ].join('\n'))
      }
      return NextResponse.json({ ok: true })
    }

    // ─── Security: niet-goedgekeurde users krijgen geen toegang ──
    if (!isAdmin && !(await isApproved(chatIdStr))) {
      await sendReply(chatId, '⛔ Geen toegang. Stuur /start om toegang aan te vragen.')
      return NextResponse.json({ ok: true })
    }

    // ─── Admin-only commando's ────────────────────────
    if (isAdmin && text.startsWith('/approve_')) {
      const targetId = text.replace('/approve_', '')
      await addApprovedChat(targetId, '')
      pendingRequests.delete(targetId)
      await sendReply(chatId, `✅ Gebruiker ${targetId} is goedgekeurd.`)
      await sendReply(Number(targetId), [
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `✅  <b>TOEGANG VERLEEND</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Je hebt nu toegang tot de`,
        `Sanders Capital bot!`,
        ``,
        `Stuur /help voor alle commando's.`,
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    if (isAdmin && text.startsWith('/deny_')) {
      const targetId = text.replace('/deny_', '')
      pendingRequests.delete(targetId)
      await removeApprovedChat(targetId)
      await sendReply(chatId, `❌ Gebruiker ${targetId} is geweigerd.`)
      await sendReply(Number(targetId), '⛔ Je toegangsverzoek is geweigerd.')
      return NextResponse.json({ ok: true })
    }

    if (isAdmin && text === '/users') {
      const approved = await getApprovedChats()
      const pending = Array.from(pendingRequests.entries())
      const lines = [
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `👥  <b>GEBRUIKERSBEHEER</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>Goedgekeurd (${approved.length}):</b>`,
      ]
      if (approved.length === 0) lines.push(`  Geen`)
      for (const id of approved) {
        lines.push(`  <code>${id}</code>  /deny_${id}`)
      }
      lines.push(``, `<b>Wachtend (${pending.length}):</b>`)
      if (pending.length === 0) lines.push(`  Geen`)
      for (const [id, info] of pending) {
        lines.push(`  ${info.name} (<code>${id}</code>)  /approve_${id}`)
      }
      await sendReply(chatId, lines.join('\n'))
      return NextResponse.json({ ok: true })
    }

    if (isAdmin && text.startsWith('/kick_')) {
      const targetId = text.replace('/kick_', '')
      await removeApprovedChat(targetId)
      await sendReply(chatId, `🚫 Gebruiker ${targetId} is verwijderd.`)
      return NextResponse.json({ ok: true })
    }

    switch (text) {
      case '/start':
      case '/help':
        await handleStart(chatId)
        break
      case '/status':
        await handleStatus(chatId)
        break
      case '/schema':
      case '/tijden':
        await handleSchema(chatId)
        break
      default:
        await sendReply(chatId, [
          `Onbekend commando. Beschikbare commando's:`,
          ``,
          `/status  — Huidige markt + concrete calls`,
          `/schema  — Update tijden`,
          `/help    — Help menu`,
        ].join('\n'))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
