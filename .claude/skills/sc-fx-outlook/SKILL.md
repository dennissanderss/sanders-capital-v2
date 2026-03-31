---
name: sc-fx-outlook
description: "Sanders Capital — Schrijf een FX Outlook marktanalyse"
user-invocable: true
---

# FX Outlook artikel schrijven

Je schrijft een FX Outlook marktanalyse-artikel voor Sanders Capital. Volg dit exacte format.

## Stijlregels
- **Taal:** Nederlands, professioneel maar toegankelijk
- **Toon:** Analytisch, data-gedreven, objectief. Geen financieel advies — altijd educatief framen
- **Perspectief:** Derde persoon of "we" (niet "ik")
- **Content format:** HTML (geen Markdown) — dit gaat direct in de Supabase `articles` tabel

## Verplichte structuur

```html
<h2>Macro Overview</h2>
<p>[Beschrijf het huidige macro-klimaat in 2-3 alinea's: wat is de dominante marktdynamiek? Risk-on of risk-off? Welke thema's spelen? Denk aan: inflatie, groei, geopolitiek, central bank divergentie.]</p>

<h2>Centrale Banken</h2>
<p>[Per relevante centrale bank (Fed, ECB, BoE, BoJ, RBA, RBNZ, BoC, SNB): wat is het huidige beleid, wat verwacht de markt, en wat is de volgende vergadering? Gebruik concrete data: rentes, dot plots, forward guidance.]</p>

<h2>Valuta Analyse</h2>
<h3>[Pair 1, bijv. EUR/USD]</h3>
<p>[Fundamentele bias (bullish/bearish/neutraal) met onderbouwing. Noem: renteverschil, CB divergentie, economische data, positionering.]</p>

<h3>[Pair 2]</h3>
<p>[Zelfde structuur als hierboven]</p>

<h3>[Pair 3-5]</h3>
<p>[Herhaal voor 3-5 paren totaal]</p>

<h2>Key Events Komende Week</h2>
<ul>
<li><strong>[Dag]:</strong> [Event] — [Waarom belangrijk en verwachte impact]</li>
</ul>

<h2>Conclusie</h2>
<p>[Samenvattende visie in 1-2 alinea's. Wat zijn de belangrijkste thema's om te volgen? Welke paren hebben de sterkste fundamentele setup?]</p>

<blockquote>Disclaimer: Deze analyse is puur educatief en geen financieel advies. Doe altijd je eigen onderzoek.</blockquote>
```

## Database velden

Wanneer je het artikel opslaat via de admin API of Supabase:

| Veld | Waarde |
|------|--------|
| `title` | "FX Outlook — [Week/Maand] [Jaar]" bijv. "FX Outlook — Week 14, 2026" |
| `slug` | "fx-outlook-week-14-2026" (automatisch genereren) |
| `excerpt` | 1-2 zinnen samenvatting van de belangrijkste conclusie |
| `tag` | **"Marktanalyse"** (VERPLICHT — dit zorgt dat het op de FX Outlook pagina verschijnt) |
| `is_premium` | `false` (tenzij anders aangegeven) |
| `published` | `true` |
| `reading_time` | Schat op basis van woordenaantal (200 woorden/min) |
| `content` | De HTML content volgens bovenstaande structuur |

## Belangrijk
- Gebruik ALTIJD tag "Marktanalyse" — anders verschijnt het niet op /blog/fx-outlook
- Tags "Data" en "Strategie" mogen ook, maar "Marktanalyse" is de primaire
- Refereer naar concrete data: rentes, inflatiecijfers, PMI's, NFP
- Vermijd vage uitspraken — onderbouw elke claim met data of CB communicatie
- Noem geen exacte prijsdoelen of entry levels
- Eindig altijd met de disclaimer blockquote

## Workflow
1. Vraag de gebruiker welke week/maand en welke paren focus moeten krijgen
2. Als de gebruiker zegt "schrijf een FX Outlook", gebruik dan actuele marktdata
3. Genereer het volledige HTML artikel
4. Sla op via de admin API of geef de content zodat de gebruiker het in het admin panel kan plakken
