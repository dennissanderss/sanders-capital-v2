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
            content: `Je bent een trading screenshot analyzer. Analyseer het TradingView screenshot en extraheer de volgende trade gegevens in JSON format:

{
  "symbol": "EUR/USD",
  "action": "buy" of "sell",
  "open_price": 1.0850,
  "close_price": null,
  "sl": 1.0810,
  "tp": 1.0930,
  "lot_size": null,
  "pips": null,
  "risk_reward": "1:2",
  "session": "London" of "New York" of "Asia" of "Overlap",
  "environment": "live",
  "entry_reason": "Korte beschrijving van de setup die je ziet",
  "notes": "Eventuele observaties over de chart",
  "confidence": "hoog" of "gemiddeld" of "laag"
}

Regels:
- Kijk naar het symbool linksboven in de chart
- Bepaal buy/sell op basis van pijlen, kleuren, annotaties of marktstructuur
- Zoek naar horizontale lijnen voor SL en TP levels
- Zoek naar fib levels (0.5, 0.618, 0.786 etc.)
- Identificeer de sessie op basis van het tijdstip
- Geef ALLEEN de JSON terug, geen andere tekst
- Als je iets niet kunt bepalen, gebruik null
- Prijzen moeten exact zijn zoals weergegeven op de chart`
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
