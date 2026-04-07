// ─── Telegram Bot Webhook ─────────────────────────────────────
// Verwerkt inkomende berichten en stuurt interactief dashboard
// Registreer met: POST /api/telegram?action=register-webhook
// ──────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

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

// ─── Command handlers ───────────────────────────────────────

async function handleStart(chatId: number) {
  await sendReply(chatId, [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊  <b>SANDERS CAPITAL BOT</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Welkom! Deze bot stuurt je automatisch`,
    `trade alerts en markt updates.`,
    ``,
    `<b>Commando's:</b>`,
    ``,
    `/status    — Huidige markt + actieve trades`,
    `/trades    — Vandaag's trades overzicht`,
    `/track     — Trackrecord statistieken`,
    `/schema    — Data update tijden`,
    `/help      — Dit menu`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>Automatische meldingen:</b>`,
    `  🇬🇧  08:30 — London Pre-Market`,
    `  🌍  12:00 — Middag Update`,
    `  🇺🇸  14:30 — New York Pre-Market`,
    `  🌙  21:00 — Einde Handelsdag`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
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
    const concrete = pairs.filter((p: { score: number; direction: string }) =>
      Math.abs(p.score) >= 2.0 && p.direction !== 'neutraal' && im > 50
    )

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📊  <b>MARKT STATUS</b>`,
      `${nlDate()} · ${nlTime()}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `┌─ <b>REGIME</b>`,
      `│  ${regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'}  ${regime}`,
      `│  IM Alignment: <b>${im}%</b>${im > 50 ? ' ✓' : ' ✗ (< 50%)'}`,
      `└─────────────────────`,
      ``,
    ]

    if (concrete.length > 0 && im > 50) {
      lines.push(`🔔  <b>${concrete.length} CONCRETE TRADE${concrete.length > 1 ? 'S' : ''}</b>`, ``)
      for (const p of concrete.slice(0, 8)) {
        const dir = p.direction.includes('bullish') ? '▲ LONG' : '▼ SHORT'
        lines.push(`  <b>${p.pair}</b>  ${dir}  ·  Score: ${p.score > 0 ? '+' : ''}${p.score}`)
      }
    } else {
      lines.push(
        `📭  <b>Geen concrete trades</b>`,
        ``,
        im <= 50
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

async function handleTrades(chatId: number) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: signals } = await getSupabase()
      .from('execution_signals')
      .select('*')
      .eq('date', today)
      .order('fund_score', { ascending: false })

    if (!signals || signals.length === 0) {
      await sendReply(chatId, [
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `📋  <b>TRADES VANDAAG</b>`,
        `${nlDate()}`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Geen trades gegenereerd vandaag.`,
        ``,
        `<i>Volgende scan: zie /schema</i>`,
      ].join('\n'))
      return
    }

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📋  <b>TRADES VANDAAG</b>`,
      `${nlDate()} · ${signals.length} trades`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
    ]

    for (const s of signals) {
      const dir = s.fund_direction?.includes('bullish') ? '▲ LONG' : '▼ SHORT'
      const absMom = Math.abs(s.momentum_5d || 0)
      const models: string[] = []
      if (s.selective_in_zone) models.push('SEL')
      if (s.balanced_in_zone) models.push('BAL')
      models.push('AGG')

      const status = s.result === 'pending' ? '⏳ PENDING'
        : s.result === 'correct' ? `✅ +${s.pips_moved}p`
        : `❌ ${s.pips_moved}p`

      lines.push(
        `┌─ <b>${s.pair}</b>  ${dir}`,
        `│  Score: <b>${s.fund_score > 0 ? '+' : ''}${s.fund_score}</b>  ·  Mom: <b>${absMom}p</b>`,
        `│  Models: ${models.join(' · ')}`,
        `│  Status: ${status}`,
        `└─────────────────────`,
        ``,
      )
    }

    lines.push(`🔗 sanderscapital.nl/tools/execution`)
    await sendReply(chatId, lines.join('\n'))
  } catch {
    await sendReply(chatId, '❌ Fout bij het ophalen van trades.')
  }
}

async function handleTrackrecord(chatId: number) {
  try {
    const { data: signals } = await getSupabase()
      .from('execution_signals')
      .select('*')
      .order('date', { ascending: false })

    if (!signals || signals.length === 0) {
      await sendReply(chatId, '📊 Nog geen trackrecord data beschikbaar.')
      return
    }

    const resolved = signals.filter(s => s.result === 'correct' || s.result === 'incorrect')
    const pending = signals.filter(s => s.result === 'pending')
    const correct = resolved.filter(s => s.result === 'correct').length
    const wr = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0
    const totalPips = resolved.reduce((sum, s) => sum + (s.pips_moved || 0), 0)

    // Per model
    function ms(filter: (s: typeof signals[0]) => boolean) {
      const f = resolved.filter(filter)
      const c = f.filter(s => s.result === 'correct').length
      return { total: f.length, correct: c, wr: f.length > 0 ? Math.round((c / f.length) * 100) : 0, pips: Math.round(f.reduce((sum, s) => sum + (s.pips_moved || 0), 0)) }
    }

    const sel = ms(s => s.selective_in_zone === true)
    const bal = ms(s => s.balanced_in_zone === true)
    const agg = ms(s => s.aggressive_in_zone === true)

    // Laatste 5 resolved trades
    const recent = resolved.slice(0, 5)

    const lines = [
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📈  <b>TRACKRECORD</b>`,
      `${nlDate()}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `┌─ <b>OVERZICHT</b>`,
      `│  Totaal: <b>${signals.length}</b> trades`,
      `│  Resolved: <b>${resolved.length}</b>  ·  Pending: <b>${pending.length}</b>`,
      `│  Winrate: <b>${wr}%</b>  ·  Pips: <b>${totalPips > 0 ? '+' : ''}${totalPips}</b>`,
      `└─────────────────────`,
      ``,
      `┌─ <b>PER MODEL</b>`,
      `│  SEL: ${sel.total}t · ${sel.wr}% WR · ${sel.pips > 0 ? '+' : ''}${sel.pips}p`,
      `│  BAL: ${bal.total}t · ${bal.wr}% WR · ${bal.pips > 0 ? '+' : ''}${bal.pips}p`,
      `│  AGG: ${agg.total}t · ${agg.wr}% WR · ${agg.pips > 0 ? '+' : ''}${agg.pips}p`,
      `└─────────────────────`,
      ``,
    ]

    if (recent.length > 0) {
      lines.push(`<b>Laatste ${recent.length} trades:</b>`, ``)
      for (const t of recent) {
        const icon = t.result === 'correct' ? '✅' : '❌'
        const dir = t.fund_direction?.includes('bullish') ? 'L' : 'S'
        const pips = t.pips_moved > 0 ? `+${t.pips_moved}p` : `${t.pips_moved}p`
        lines.push(`${icon} ${t.date} · <b>${t.pair}</b> ${dir} · ${pips}`)
      }
    }

    lines.push(``, `🔗 sanderscapital.nl/tools/execution`)
    await sendReply(chatId, lines.join('\n'))
  } catch {
    await sendReply(chatId, '❌ Fout bij het ophalen van trackrecord.')
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
    `     → nieuwe trades als condities wijzigen`,
    ``,
    `🇺🇸  <b>14:30 NL</b> — New York Pre-Market`,
    `     Verse data voor NY sessie`,
    `     → IM en momentum veranderen vaak 's middags`,
    ``,
    `🌙  <b>21:00 NL</b> — Einde Handelsdag`,
    `     Laatste scan + resolve gisteren's trades`,
    `     → resultaten worden bepaald`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>Wat wordt ververst?</b>`,
    `  📰 Nieuws (RSS feeds)`,
    `  📊 Briefing (scores, IM, regime)`,
    `  📈 Trackrecord (nieuwe trades)`,
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

    // Security: alleen reageren op geautoriseerde chat ID
    if (CHAT_ID && String(chatId) !== CHAT_ID) {
      await sendReply(chatId, '⛔ Geen toegang. Deze bot is privé.')
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
      case '/trades':
        await handleTrades(chatId)
        break
      case '/track':
      case '/trackrecord':
        await handleTrackrecord(chatId)
        break
      case '/schema':
      case '/tijden':
        await handleSchema(chatId)
        break
      default:
        await sendReply(chatId, [
          `Onbekend commando. Beschikbare commando's:`,
          ``,
          `/status  — Huidige markt + trades`,
          `/trades  — Vandaag's trades`,
          `/track   — Trackrecord stats`,
          `/schema  — Update tijden`,
          `/help    — Help menu`,
        ].join('\n'))
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
