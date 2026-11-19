// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: bedrijfsverhaal in gewone taal
//
// Eén Groq-call zet het (Engelse) bedrijfsprofiel om in een Nederlandse
// uitleg voor beginners: wat doet het bedrijf, hoe verdient het geld,
// marktpositie, herkomst, kansen en risico's.
//
// De LLM geeft GEEN oordeel en GEEN cijfers — die komen uit de regels in
// analysis.ts. Faalt de call (geen key, timeout, rommel-JSON), dan toont
// de pagina het originele profiel; de tool blijft altijd werken.
// ─────────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Groq haalt modellen regelmatig uit de lucht (llama-3.3-70b-versatile bestaat
// niet meer) — daarom overschrijfbaar via env zonder nieuwe deploy van code.
const GROQ_MODEL = process.env.GROQ_STOCKS_MODEL || 'openai/gpt-oss-120b'

export interface Verhaal {
  wat: string
  verdienmodel: string
  marktpositie: string
  herkomst: string
  kansen: string[]
  risicos: string[]
}

export interface VerhaalInput {
  naam: string
  symbol: string
  sector: string | null
  industrie: string | null
  land: string | null
  stad: string | null
  werknemers: number | null
  profiel: string
}

const SYSTEM_PROMPT = `Je legt in helder Nederlands aan een beginnende belegger uit wat een beursgenoteerd bedrijf is. Geen jargon; leg een vakterm kort uit als je hem toch gebruikt. Schrijf concreet en zakelijk, geen reclametaal.

Je krijgt de naam, sector, vestigingsplaats en een Engelstalig bedrijfsprofiel. Baseer je daarop en op algemeen bekende, zekere feiten over het bedrijf. Verzin niets. Noem GEEN jaartallen, oprichters of fusies tenzij ze letterlijk in het profiel staan — daar worden de meeste fouten gemaakt. Beschrijf herkomst dan in algemene termen (land, uit welke activiteit het bedrijf is gegroeid). Noem GEEN koersen, koersdoelen of financiële cijfers en geef GEEN koop- of verkoopadvies.

Antwoord UITSLUITEND met JSON:
{
  "wat": "2-3 zinnen: wat maakt of doet dit bedrijf, voor wie",
  "verdienmodel": "2-3 zinnen: waar komt de omzet vandaan, wie betaalt, eenmalig of terugkerend",
  "marktpositie": "2-4 zinnen: positie in de markt, belangrijkste concurrenten bij naam, waarin het zich onderscheidt",
  "herkomst": "2-3 zinnen: uit welk land en welke activiteit komt het bedrijf voort, en waar zit het hoofdkantoor nu (gebruik de opgegeven vestigingsplaats)",
  "kansen": ["3 korte punten: wat kan de groei aanjagen"],
  "risicos": ["3 korte punten: wat kan er misgaan voor dit specifieke bedrijf"]
}`

const cache = new Map<string, { at: number; v: Verhaal }>()
const DAG = 24 * 60 * 60 * 1000

const tekst = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const lijst = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()).slice(0, 4) : []

export async function maakVerhaal(input: VerhaalInput): Promise<Verhaal | null> {
  const hit = cache.get(input.symbol)
  if (hit && Date.now() - hit.at < DAG) return hit.v

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !input.profiel) return null

  const gebruiker = [
    `Bedrijf: ${input.naam} (${input.symbol})`,
    `Sector: ${input.sector || 'onbekend'} — ${input.industrie || 'onbekend'}`,
    `Hoofdkantoor: ${[input.stad, input.land].filter(Boolean).join(', ') || 'onbekend'}`,
    input.werknemers ? `Werknemers: ${input.werknemers}` : '',
    `Profiel: ${input.profiel.slice(0, 2500)}`,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: gebruiker },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) return null
    const p = JSON.parse(content)
    const v: Verhaal = {
      wat: tekst(p.wat), verdienmodel: tekst(p.verdienmodel),
      marktpositie: tekst(p.marktpositie), herkomst: tekst(p.herkomst),
      kansen: lijst(p.kansen), risicos: lijst(p.risicos),
    }
    if (!v.wat) return null
    cache.set(input.symbol, { at: Date.now(), v })
    return v
  } catch {
    return null
  }
}
