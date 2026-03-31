---
name: sc-artikel
description: "Sanders Capital — Schrijf een educatief kennisbank/blog artikel"
user-invocable: true
---

# Educatief artikel schrijven

Je schrijft een educatief artikel (module/blog) voor Sanders Capital. Volg dit exacte format.

## Stijlregels
- **Taal:** Nederlands, helder en toegankelijk
- **Toon:** Educatief, gestructureerd, opbouwend van basis naar verdieping
- **Perspectief:** Directe aanspreking ("je") of "we"
- **Content format:** HTML (geen Markdown) — dit gaat direct in de Supabase `articles` tabel
- **Doelgroep:** Beginnende tot intermediate traders die forex/macro willen leren

## Schrijfprincipes
1. **Begin met het "wat"** — definieer het concept in simpele taal
2. **Leg uit "waarom het belangrijk is"** — koppel aan trading/markten
3. **Bouw op in complexiteit** — van fundament naar toepassing
4. **Gebruik concrete voorbeelden** — geen abstracte theorie zonder context
5. **Sluit af met praktische toepassing** — hoe past de lezer dit toe?

## Verplichte structuur

```html
<h2>[Hoofdconcept — bijv. "Wat is marktstructuur?"]</h2>
<p>[Introductie: definieer het onderwerp in 2-3 alinea's. Wat gaat de lezer leren? Waarom is dit relevant voor trading?]</p>

<h2>[Deelonderwerp 1]</h2>
<p>[Uitleg met voorbeelden. Gebruik bullet points waar het overzichtelijker is.]</p>
<ul>
<li><strong>[Term/concept]:</strong> [Uitleg]</li>
</ul>

<h2>[Deelonderwerp 2]</h2>
<p>[Verdere verdieping. Bouw voort op het vorige deel.]</p>

<h3>[Sub-concept indien nodig]</h3>
<p>[Meer detail over een specifiek aspect]</p>

<h2>[Deelonderwerp 3+]</h2>
<p>[Herhaal patroon: uitleg → voorbeeld → toepassing]</p>

<h2>Samenvatting</h2>
<p>[Kernpunten in 3-5 bullets:]</p>
<ul>
<li>[Kernpunt 1]</li>
<li>[Kernpunt 2]</li>
<li>[Kernpunt 3]</li>
</ul>

<blockquote>Dit artikel is puur educatief en geen financieel advies. Oefen altijd eerst op een demo-account.</blockquote>
```

## Module nummering

Artikelen in een reeks krijgen een module nummer:
- Module 1: Basis van trading
- Module 2: [Volgend onderwerp]
- Module 3: [etc.]

De tag bepaalt de module: "Module 1", "Module 2", "Module 3"

## Database velden

| Veld | Waarde |
|------|--------|
| `title` | Beschrijvende titel, bijv. "Basis van trading" of "Marktstructuur begrijpen" |
| `slug` | URL-friendly versie, bijv. "basis-van-trading" |
| `excerpt` | 1-2 zinnen die de inhoud samenvatten (wordt getoond op de blog kaart) |
| `tag` | Een van: "Module 1", "Module 2", "Module 3", "Psychologie", "Risicomanagement", "Strategie", "Data" |
| `is_premium` | `false` voor basis modules, `true` voor verdieping |
| `published` | `true` |
| `reading_time` | Schat op basis van woordenaantal (200 woorden/min), typisch 5-10 min |
| `content` | De HTML content volgens bovenstaande structuur |

## Beschikbare tags
- **Module 1, 2, 3** — voor gestructureerde cursusreeks
- **Psychologie** — trading psychologie, emoties, discipline
- **Risicomanagement** — position sizing, risk/reward, drawdown
- **Strategie** — specifieke trading strategieen en setups
- **Data** — data-analyse, backtesting, statistiek

## HTML elementen die je kunt gebruiken
- `<h2>` — hoofdsecties (max 5-7 per artikel)
- `<h3>` — subsecties binnen een h2
- `<p>` — alinea's (houd ze kort: 3-5 zinnen max)
- `<ul>/<ol>` met `<li>` — lijsten voor opsommingen
- `<strong>` — vetgedrukt voor kernbegrippen
- `<em>` — cursief voor nadruk
- `<blockquote>` — voor belangrijke quotes, tips of disclaimers
- `<img>` — afbeeldingen (optioneel, met `alt` tekst)

## Belangrijk
- Schrijf MINIMAAL 800 woorden, MAXIMAAL 2000 woorden
- Elke h2 sectie moet minstens 2 alinea's bevatten
- Gebruik geen jargon zonder het uit te leggen
- Noem geen specifieke brokers, platforms of handelssignalen
- Eindig altijd met de educatieve disclaimer blockquote
- Als het een vervolg-module is, verwijs kort naar wat in de vorige module is behandeld

## Workflow
1. Vraag de gebruiker wat het onderwerp is en welke module/tag
2. Maak een korte outline (3-5 h2 secties) en check met de gebruiker
3. Schrijf het volledige HTML artikel
4. Geef ook de metadata (title, slug, excerpt, tag, reading_time)
5. Sla op via de admin API of geef de content zodat de gebruiker het in het admin panel kan plakken
