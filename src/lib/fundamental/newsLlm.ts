// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: nieuws-sentiment per valuta (v2)
//
// Probleem met de keyword-methode (v1): één sentiment-score per artikel,
// toegekend aan ÁLLE affected_currencies. "Fed hawkish surprise" met
// [USD, EUR] maakte zo USD én EUR bullish — voor EUR is het juist bearish.
//
// v2: één Groq-call per generate labelt elk artikel met een richting PER
// valuta (-2..+2). Faalt de LLM (geen key, timeout, rommel-JSON), dan
// vallen we terug op de oude keyword-methode — de tool blijft altijd werken.
// ─────────────────────────────────────────────────────────────
import { MAJORS } from './constants'
import { analyzeNewsSentiment, type NewsRow, type NewsSentiment } from './scoring'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `Je bent een FX-macro-analist. Je krijgt genummerde nieuwsartikelen (titel + samenvatting). Beoordeel per artikel de impact op de WAARDE van elke geraakte G8-valuta (USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD).

Schaal per valuta: -2 (sterk bearish) .. +2 (sterk bullish). 0 of weglaten = geen materiële impact.
Denk in beleidsrichting en kapitaalstromen: hawkish verrassing = bullish voor die valuta; zwakke data = bearish; risk-off = bullish JPY/CHF en bearish AUD/NZD; olie omhoog = bullish CAD.
Belangrijk: een artikel kan per valuta een ANDERE richting hebben (bijv. "Fed hawkish" = USD +2 en kan EUR licht negatief raken via EUR/USD-druk: EUR -0.5).
Wees conservatief: alleen scores geven waar het artikel echt over gaat. Kleine/vage artikelen: leeg object.

Antwoord UITSLUITEND met JSON van de vorm: {"impacts": {"<artikelnummer>": {"USD": 1.5, "EUR": -0.5}, ...}} — nummers zoals in de input (eerste artikel = 1).`

interface LlmImpacts { [index: string]: Partial<Record<string, number>> }

async function callGroq(articles: NewsRow[]): Promise<LlmImpacts | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  // 1-based nummering: LLM's tellen van nature vanaf 1 — 0-based bleek in de
  // praktijk een off-by-one op te leveren (alle labels één artikel verschoven).
  const lines = articles.map((a, i) => {
    const summary = (a.summary || '').replace(/\s+/g, ' ').slice(0, 220)
    return `${i + 1}. [${a.source || '?'}] ${a.title}${summary ? ` — ${summary}` : ''}`
  })

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: lines.join('\n') },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    const impacts = parsed?.impacts
    if (!impacts || typeof impacts !== 'object') return null
    return impacts as LlmImpacts
  } catch {
    return null
  }
}

// Zelfde gewichten als v1 waar mogelijk: relevantie (min(score/5, 1.5)) ×
// recentheid (1.5/1.2/1.0/0.7). De LLM-richting (-2..+2) vervangt alleen de
// keyword-telling; de rest van de weging blijft identiek en na te rekenen.
export async function analyzeNewsPerCurrency(
  articles: NewsRow[], nowMs: number,
): Promise<{ sentiment: Record<string, NewsSentiment>; source: 'llm' | 'keywords' }> {
  if (articles.length === 0) {
    return { sentiment: analyzeNewsSentiment(articles), source: 'keywords' }
  }

  const impacts = await callGroq(articles)
  if (!impacts) {
    return { sentiment: analyzeNewsSentiment(articles), source: 'keywords' }
  }

  const s: Record<string, { score: number; headlines: string[]; detail: NewsSentiment['detail'] }> = {}
  for (const c of MAJORS) s[c] = { score: 0, headlines: [], detail: [] }

  articles.forEach((a, i) => {
    const perCcy = impacts[String(i + 1)]
    if (!perCcy) return
    const relWeight = Math.min((a.relevance_score ?? 0) / 5, 1.5)
    const hoursAgo = (nowMs - new Date(a.published_at).getTime()) / 3600000
    const recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7
    const effWeight = +(relWeight * recency).toFixed(2)

    for (const [ccy, rawImpact] of Object.entries(perCcy)) {
      if (!s[ccy] || typeof rawImpact !== 'number') continue
      const impact = Math.max(-2, Math.min(2, rawImpact))
      if (impact === 0) continue
      // impact/2 → -1..+1, × gewichten × 0.75 → schaal vergelijkbaar met v1.
      s[ccy].score += (impact / 2) * relWeight * recency * 0.75
      if (s[ccy].headlines.length < 3) s[ccy].headlines.push(a.title_nl || a.title)
      s[ccy].detail.push({
        title: a.title_nl || a.title, source: a.source || 'onbekend',
        date: a.published_at, weight: effWeight, impact,
      })
    }
  })

  const out: Record<string, NewsSentiment> = {}
  for (const c of MAJORS) {
    const score = Math.round(s[c].score * 10) / 10
    let sentiment = 'neutraal'
    if (score >= 1.0) sentiment = 'sterk positief'
    else if (score >= 0.3) sentiment = 'positief'
    else if (score <= -1.0) sentiment = 'sterk negatief'
    else if (score <= -0.3) sentiment = 'negatief'
    // Sterkste bijdragen eerst in het detail.
    s[c].detail.sort((a, b) => Math.abs((b.impact ?? 0) * b.weight) - Math.abs((a.impact ?? 0) * a.weight))
    out[c] = { score, headlines: s[c].headlines, sentiment, detail: s[c].detail.slice(0, 8) }
  }
  return { sentiment: out, source: 'llm' }
}
