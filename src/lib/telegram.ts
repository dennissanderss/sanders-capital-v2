// ─── Telegram Notification System ────────────────────────────
// Dagelijkse routine:
//   08:30 ☀️ Goedemorgen — welkom, uitleg, programma, eerste trades
//   12:00 🌍 Middag alert — nieuwe trades of markt update
//   14:00 🇺🇸 NY alert — nieuwe trades of markt update
//   21:00 🌙 Goedenavond — resultaten, samenvatting, afsluiting
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

// ─── Helpers ────────────────────────────────────────────────

function nlTime(): string {
  return new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
}
function nlDateLong(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long' })
}
function dir(d: string): string { return d.includes('bullish') ? '▲ LONG' : '▼ SHORT' }

export interface Session { name: string; emoji: string; isEndOfDay: boolean }

const MODELS = {
  selective:  { name: 'Selective',  emoji: '🎯', sl: 40, tp: 120, wr: 62.4 },
  balanced:   { name: 'Balanced',   emoji: '⚖️', sl: 40, tp: 120, wr: 61.7 },
  aggressive: { name: 'Aggressive', emoji: '⚡', sl: 40, tp: 120, wr: 58.0 },
}

function quality(score: number, mom: number, im: number): number {
  const f = Math.min(4, Math.abs(score) * 1.2)
  const c = Math.abs(mom) >= 30 && Math.abs(mom) <= 120 ? 2.5 : 1.5
  const i = (im / 100) * 2
  return Math.min(10, Math.round((f + c + i + 1) * 10) / 10)
}

// ─── Trade block (herbruikbaar) ─────────────────────────────

export interface TradeSignal {
  pair: string
  direction: string
  score: number
  momentum5d: number
  conviction: string
  selectiveZone: boolean
  balancedZone: boolean
  qualityScore?: number
}

function tradeBlock(trades: TradeSignal[], im: number): string[] {
  if (trades.length === 0) return []

  const lines: string[] = []
  const groups: [string, typeof MODELS.selective, TradeSignal[]][] = [
    ['selective',  MODELS.selective,  trades.filter(t => t.selectiveZone)],
    ['balanced',   MODELS.balanced,   trades.filter(t => t.balancedZone && !t.selectiveZone)],
    ['aggressive', MODELS.aggressive, trades.filter(t => !t.balancedZone && !t.selectiveZone)],
  ]

  for (const [, m, group] of groups) {
    if (group.length === 0) continue
    lines.push(
      ``,
      `${m.emoji} <b>${m.name}</b>  ·  ${m.wr}% WR`,
      `   SL ${m.sl}p · TP ${m.tp}p · 1:3 RR`,
    )
    for (const t of group) {
      const q = t.qualityScore ?? quality(t.score, t.momentum5d, im)
      lines.push(`   ${dir(t.direction)}  <b>${t.pair}</b>  ·  ${q.toFixed(1)}/10  ·  ${Math.abs(t.momentum5d)}p dip`)
    }
  }
  return lines
}

// ─── ☀️ GOEDEMORGEN (08:30) ────────────────────────────────

export async function notifyMorning(
  trades: TradeSignal[],
  regime: string,
  im: number,
  existingTrades: number,
  totalPairs: number,
): Promise<boolean> {
  const regimeIcon = regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `☀️  <b>Goedemorgen!</b>`,
    `${nlDateLong()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Welkom bij Sanders Capital.`,
    `Elke werkdag analyseren wij 21 valutaparen`,
    `op basis van fundamentele data en technische`,
    `timing om de beste trades te vinden.`,
    ``,
    `<b>Programma vandaag:</b>`,
    `   🇬🇧 08:30  Eerste scan (nu)`,
    `   🌍 12:00  Middag update`,
    `   🇺🇸 14:00  New York sessie`,
    `   🌙 21:00  Afsluiting + resultaten`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>MARKT VANDAAG</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${regimeIcon}  Regime: <b>${regime}</b>`,
    `📊  IM Alignment: <b>${im}%</b>${im > 50 ? ' ✓' : ' ✗ (te laag)'}`,
  ]

  if (trades.length > 0) {
    lines.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔔  <b>${trades.length} TRADE${trades.length > 1 ? 'S' : ''} GEVONDEN</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ...tradeBlock(trades, im),
      ``,
      `<b>Wat nu?</b>`,
      `1. Open de 1H chart`,
      `2. Wacht op een reversal candle`,
      `3. Entry met SL 40p / TP 120p`,
    )
  } else if (existingTrades > 0) {
    lines.push(
      ``,
      `📋  ${existingTrades} trade${existingTrades > 1 ? 's' : ''} lopen al.`,
      `Geen nieuwe paren passeren de filters.`,
    )
  } else if (im <= 50) {
    lines.push(
      ``,
      `📭  Geen trades — IM te laag (${im}%).`,
      `Wacht op betere marktbevestiging.`,
    )
  } else {
    lines.push(
      ``,
      `📭  Geen trades — geen van ${totalPairs} paren`,
      `passeert alle 4 filters vandaag.`,
    )
  }

  lines.push(
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── 🌍🇺🇸 SESSIE ALERT (12:00 / 14:30) ──────────────────

export async function notifyNewTrades(
  trades: TradeSignal[],
  regime: string,
  im: number,
  session: Session
): Promise<boolean> {
  if (trades.length === 0) return true

  const regimeIcon = regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>${session.name}</b>  ·  ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${regimeIcon} ${regime}  ·  IM ${im}%`,
    ``,
    `🔔  <b>${trades.length} NIEUWE TRADE${trades.length > 1 ? 'S' : ''}</b>`,
    ...tradeBlock(trades, im),
    ``,
    `<b>Wat nu?</b>`,
    `1. Open de 1H chart`,
    `2. Wacht op een reversal candle`,
    `3. Entry met SL 40p / TP 120p`,
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  ]

  return sendTelegramMessage(lines.join('\n'))
}

// ─── 📊 SESSIE UPDATE (geen nieuwe trades) ─────────────────

export async function notifySessionUpdate(
  session: Session,
  regime: string,
  im: number,
  existingTrades: number,
  totalPairs: number
): Promise<boolean> {
  const regimeIcon = regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>${session.name}</b>  ·  ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `${regimeIcon} ${regime}  ·  IM ${im}%`,
    ``,
  ]

  if (existingTrades > 0) {
    lines.push(
      `📊  Geen nieuwe trades.`,
      `${existingTrades} trade${existingTrades > 1 ? 's' : ''} lopen al vandaag.`,
    )
  } else if (im <= 50) {
    lines.push(
      `📭  Geen trades — IM te laag (${im}%).`,
    )
  } else {
    lines.push(
      `📭  Geen trades — geen paar passeert alle filters.`,
    )
  }

  lines.push(
    ``,
    `<i>Volgende: ${session.isEndOfDay ? 'morgen 08:30' : 'volgende sessie'}</i>`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── 🌙 GOEDENAVOND (21:00) ────────────────────────────────

interface ResolvedTrade {
  pair: string
  direction: string
  result: 'correct' | 'incorrect'
  pips: number
}

export async function notifyEvening(
  resolvedTrades: ResolvedTrade[],
  todayTrades: TradeSignal[],
  regime: string,
  im: number,
): Promise<boolean> {
  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🌙  <b>Goedenavond!</b>`,
    `${nlDateLong()} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
  ]

  // Resultaten van gisteren
  if (resolvedTrades.length > 0) {
    const wins = resolvedTrades.filter(t => t.result === 'correct')
    const losses = resolvedTrades.filter(t => t.result === 'incorrect')
    const wr = Math.round((wins.length / resolvedTrades.length) * 100)
    const totalPips = resolvedTrades.reduce((sum, t) => sum + t.pips, 0)

    lines.push(
      ``,
      `<b>Resultaten gisteren:</b>`,
      ``,
      `   ${wins.length} gewonnen · ${losses.length} verloren`,
      `   <b>${wr}% winrate</b> · <b>${totalPips > 0 ? '+' : ''}${totalPips} pips</b>`,
      ``,
    )

    for (const t of resolvedTrades) {
      const icon = t.result === 'correct' ? '✅' : '❌'
      const pips = t.pips > 0 ? `+${t.pips}p` : `${t.pips}p`
      lines.push(`   ${icon} <b>${t.pair}</b>  ${dir(t.direction)}  →  ${pips}`)
    }
  } else {
    lines.push(
      ``,
      `<i>Geen trades om te resolven vandaag.</i>`,
    )
  }

  // Samenvatting vandaag
  lines.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>Samenvatting vandaag:</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `   Regime: <b>${regime}</b>`,
    `   IM Alignment: <b>${im}%</b>`,
    `   Trades gegenereerd: <b>${todayTrades.length}</b>`,
  )

  if (todayTrades.length > 0) {
    for (const t of todayTrades) {
      lines.push(`   · <b>${t.pair}</b>  ${dir(t.direction)}  (pending)`)
    }
    lines.push(
      ``,
      `<i>Resultaten morgen bij de 21:00 scan.</i>`,
    )
  }

  lines.push(
    ``,
    `Morgen weer een nieuwe kans. Slaap lekker! 🌙`,
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Legacy wrappers (backwards compatible) ─────────────────

export async function notifyResolvedTrades(trades: ResolvedTrade[]): Promise<boolean> {
  // Now handled by notifyEvening, but keep for backward compat
  return notifyEvening(trades, [], 'Gemengd', 50)
}

export async function notifyNoTrades(regime: string, im: number, reason: string): Promise<boolean> {
  return notifySessionUpdate({ name: 'Update', emoji: '📊', isEndOfDay: false }, regime, im, 0, 0)
}
