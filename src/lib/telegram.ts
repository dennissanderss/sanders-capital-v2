// ─── Telegram Notification System ────────────────────────────
// 4x per werkdag meldingen, afgestemd op trading sessies
//
// Melding types:
//   🔔 Nieuwe trades — per model met WR/SL/TP
//   📊 Geen trades — waarom niet + markt status
//   📋 Resultaten — win/loss per trade (alleen EOD)
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
function nlDate(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short' })
}
function dir(d: string): string { return d.includes('bullish') ? '▲ LONG' : '▼ SHORT' }

export interface Session { name: string; emoji: string; isEndOfDay: boolean }

const MODELS = {
  selective:  { name: 'Selective',  emoji: '🎯', momRange: '30–120p', sl: 40, tp: 120, wr: 62.4 },
  balanced:   { name: 'Balanced',   emoji: '⚖️', momRange: '20–150p', sl: 40, tp: 120, wr: 61.7 },
  aggressive: { name: 'Aggressive', emoji: '⚡', momRange: 'alle',    sl: 40, tp: 120, wr: 58.0 },
}

// Quality score (zelfde formule als Engine page)
function quality(score: number, mom: number, im: number): number {
  const f = Math.min(4, Math.abs(score) * 1.2)
  const c = Math.abs(mom) >= 30 && Math.abs(mom) <= 120 ? 2.5 : 1.5
  const i = (im / 100) * 2
  return Math.min(10, Math.round((f + c + i + 1) * 10) / 10)
}

// ─── Header (elk bericht begint hiermee) ────────────────────

function header(session: Session): string[] {
  return [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji}  <b>SANDERS CAPITAL</b>`,
    `${session.name} · ${nlDate()} · ${nlTime()}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
  ]
}

function marketBlock(regime: string, im: number): string[] {
  const icon = regime === 'Risk-On' ? '🟢' : regime === 'Risk-Off' ? '🔴' : '⚪️'
  return [
    ``,
    `${icon} <b>${regime}</b>  ·  IM ${im}%${im > 50 ? ' ✓' : ' ✗'}`,
  ]
}

// ─── 🔔 Nieuwe trades ──────────────────────────────────────

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

export async function notifyNewTrades(
  trades: TradeSignal[],
  regime: string,
  im: number,
  session: Session
): Promise<boolean> {
  if (trades.length === 0) return true

  const lines = [
    ...header(session),
    ...marketBlock(regime, im),
    ``,
    `🔔  <b>${trades.length} TRADE${trades.length > 1 ? 'S' : ''}</b>`,
  ]

  // Group by model
  const groups: [string, typeof MODELS.selective, TradeSignal[]][] = [
    ['selective',  MODELS.selective,  trades.filter(t => t.selectiveZone)],
    ['balanced',   MODELS.balanced,   trades.filter(t => t.balancedZone && !t.selectiveZone)],
    ['aggressive', MODELS.aggressive, trades.filter(t => !t.balancedZone && !t.selectiveZone)],
  ]

  for (const [, m, group] of groups) {
    if (group.length === 0) continue
    lines.push(
      ``,
      `${m.emoji} <b>${m.name}</b>`,
      `   ${m.wr}% winrate · SL ${m.sl}p · TP ${m.tp}p`,
    )
    for (const t of group) {
      const q = t.qualityScore ?? quality(t.score, t.momentum5d, im)
      lines.push(`   ${dir(t.direction)}  <b>${t.pair}</b>  ·  ${q.toFixed(1)}/10  ·  ${Math.abs(t.momentum5d)}p dip`)
    }
  }

  lines.push(
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `<i>Wat nu?</i>`,
    `<i>1. Open 1H chart van het pair</i>`,
    `<i>2. Wacht op reversal candle</i>`,
    `<i>3. Entry met SL ${MODELS.selective.sl}p / TP ${MODELS.selective.tp}p</i>`,
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── 📋 Resultaten (resolved trades) ───────────────────────

interface ResolvedTrade {
  pair: string
  direction: string
  result: 'correct' | 'incorrect'
  pips: number
}

export async function notifyResolvedTrades(trades: ResolvedTrade[]): Promise<boolean> {
  if (trades.length === 0) return true

  const wins = trades.filter(t => t.result === 'correct')
  const losses = trades.filter(t => t.result === 'incorrect')
  const wr = Math.round((wins.length / trades.length) * 100)
  const totalPips = trades.reduce((sum, t) => sum + t.pips, 0)

  const lines = [
    ...header({ name: 'Einde Handelsdag', emoji: '🌙', isEndOfDay: true }),
    ``,
    `📋  <b>RESULTATEN GISTEREN</b>`,
    ``,
  ]

  // Winst/verlies samenvatting
  lines.push(
    `   ${wins.length} gewonnen  ·  ${losses.length} verloren`,
    `   <b>${wr}% winrate</b>  ·  <b>${totalPips > 0 ? '+' : ''}${totalPips} pips</b>`,
    ``,
  )

  // Per trade
  for (const t of trades) {
    const icon = t.result === 'correct' ? '✅' : '❌'
    const pips = t.pips > 0 ? `+${t.pips}p` : `${t.pips}p`
    lines.push(`   ${icon} <b>${t.pair}</b>  ${dir(t.direction)}  →  ${pips}`)
  }

  lines.push(
    ``,
    `🔗 sanderscapital.nl/tools/execution`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── 📊 Geen trades (session update) ───────────────────────

export async function notifySessionUpdate(
  session: Session,
  regime: string,
  im: number,
  existingTrades: number,
  totalPairs: number
): Promise<boolean> {
  const lines = [
    ...header(session),
    ...marketBlock(regime, im),
    ``,
  ]

  if (existingTrades > 0) {
    lines.push(
      `📊  <b>Geen nieuwe trades</b>`,
      `   ${existingTrades} trade${existingTrades > 1 ? 's' : ''} lopen al vandaag.`,
      `   Geen nieuwe paren passeren alle filters.`,
    )
  } else if (im <= 50) {
    lines.push(
      `📊  <b>Geen trades vandaag</b>`,
      `   IM alignment te laag (${im}%).`,
      `   Minimaal 50% nodig voor concrete trades.`,
    )
  } else {
    lines.push(
      `📊  <b>Geen trades vandaag</b>`,
      `   ${totalPairs} paren geanalyseerd.`,
      `   Geen enkel pair passeert alle 4 filters.`,
    )
  }

  lines.push(
    ``,
    `<i>Volgende scan: ${session.isEndOfDay ? 'morgen 08:30' : 'volgende sessie'}</i>`,
  )

  return sendTelegramMessage(lines.join('\n'))
}

// ─── Legacy wrapper ─────────────────────────────────────────

export async function notifyNoTrades(regime: string, im: number, reason: string): Promise<boolean> {
  return notifySessionUpdate({ name: 'Update', emoji: '📊', isEndOfDay: false }, regime, im, 0, 0)
}
