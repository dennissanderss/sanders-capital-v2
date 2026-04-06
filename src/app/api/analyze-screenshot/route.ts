// ─── Screenshot Analyse API ──────────────────────────────────
// Analyseert een trading screenshot met Groq Vision AI
// en extraheert trade gegevens (pair, richting, entry, SL, TP etc.)
// ──────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { image } = await request.json() as { image: string }

    if (!image) {
      return NextResponse.json({ error: 'Geen afbeelding meegegeven' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Stuur naar Groq Vision API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert FX trading chart analyzer. Analyseer het TradingView screenshot en extraheer trade gegevens.

BELANGRIJK — Hoe je de chart leest:
1. SYMBOOL: Lees het pair linksboven (bijv. "Euro / Canadian Dollar" = EUR/CAD, "Australian Dollar / U.S. Dollar" = AUD/USD)
2. TIMEFRAME: Lees het timeframe linksboven (1m, 5m, 15m, 30m, 1h, 2h, 4h, D, W)
3. HUIDIGE PRIJS: Lees de prijs rechts op de y-as waar de huidige candle staat (vaak met een gekleurd label)
4. RICHTING:
   - Groene zone/box op de chart = bullish richting = BUY
   - Rode zone/box op de chart = bearish richting = SELL
   - Als er zowel groen (boven) als rood (onder) is, kijk waar de prijs nu is
5. STOP LOSS:
   - Rode horizontale lijn ONDER de huidige prijs (bij buy) = SL
   - Rode horizontale lijn BOVEN de huidige prijs (bij sell) = SL
   - Labels met rode achtergrond aan de rechterkant tonen exacte prijs
   - De ONDERSTE rode lijn bij een buy trade is de SL
   - De BOVENSTE rode lijn bij een sell trade is de SL
6. TAKE PROFIT:
   - Labels met "1" of markering bovenaan de groene zone = TP bij buy
   - Labels met "1" of markering onderaan de groene zone = TP bij sell
   - Als er een "1" label staat, lees de prijs op die hoogte van de y-as
7. FIB LEVELS: Labels als "0.5", "0.618", "0.75", "0.786" zijn fibonacci retracement levels
8. ANNOTATIES: Tekst als "1e break", "Check", "Liq" zijn trade notities
9. ENTRY: De prijs waar de groene zone begint, of waar "1e break" staat

Retourneer ALLEEN deze JSON (geen andere tekst):
{
  "symbol": "EUR/CAD",
  "action": "buy",
  "open_price": 1.6070,
  "sl": 1.6021,
  "tp": 1.6146,
  "close_price": null,
  "lot_size": null,
  "pips": null,
  "risk_reward": "1:2",
  "session": "London",
  "environment": "live",
  "entry_reason": "Beschrijf de setup: structure break, fib retracement, zones etc.",
  "notes": "Beschrijf annotaties en zones die je ziet op de chart",
  "confidence": "hoog"
}

KRITISCH:
- Lees EXACTE prijzen van de y-as (rechts op de chart)
- SL en TP zijn de rode/groene horizontale lijnen of zone grenzen
- Als je een prijs label ziet (bijv. "1.60215" in rood rechts), gebruik DIE exacte prijs
- Kijk naar ALLE horizontale lijnen en hun prijzen op de y-as`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyseer dit trading screenshot en extraheer de trade gegevens als JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Groq API fout: ${response.status} ${errorText.slice(0, 200)}` }, { status: 502 })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    // Parse JSON uit de response
    try {
      // Zoek JSON in de response (kan omringd zijn door tekst)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const tradeData = JSON.parse(jsonMatch[0])
        return NextResponse.json({ success: true, trade: tradeData, raw: content })
      }
      return NextResponse.json({ success: false, error: 'Geen JSON gevonden in response', raw: content })
    } catch {
      return NextResponse.json({ success: false, error: 'Kon JSON niet parsen', raw: content })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
