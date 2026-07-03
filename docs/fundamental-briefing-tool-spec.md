# Fundamental Briefing — volledige tool-specificatie

> Zelfstandige spec van de Fundamental Briefing tool, bedoeld om de tool op een
> **aparte website** te kunnen aanbieden of opnieuw te laten bouwen. Beschrijft
> de methodiek, het datamodel, de API's, de frontend en de datastromen — plus
> eerlijke kanttekeningen. Stand: juli 2026 (methodiek v2).

## Changelog — methodiek v2 (live sinds 2026-07-03)

Calls van vóór 3 juli 2026 zijn met **v1** gemeten (herkenbaar aan
`breakdown` zonder `v: 2`); de Analyse-tab kan v1/v2 apart filteren.
Wat v2 verandert:

1. **Zekerheid gesplitst in BIAS en TIMING.** Bias (0–10) = hoe sterk de
   fundamentals de richting steunen. Timing (0–10) = hoe gunstig het
   instapmoment is. Zekerheid = 0,6 × bias + 0,4 × timing. Reden: het forward-
   record liet zien dat de richting (bias) vaker goed zat dan het moment.
2. **Nieuws per valuta gelabeld (LLM).** Eén Groq-call per generate geeft per
   artikel een richting pér valuta (-2..+2). v1 gaf hetzelfde sentiment aan
   álle `affected_currencies` — "Fed hawkish" maakte USD én EUR bullish.
   Keyword-methode blijft als fallback (`reasoning.newsSource`).
3. **Macro-verrassingen** (±2 per valuta): actual vs. forecast uit de
   TradingView economische kalender, impact-gewogen, wegzakkend over 5 dagen.
4. **Inflatie-gap** (±1): recentste CPI j/j t.o.v. het doel van de CB.
5. **Grondstoffen-terms-of-trade** (±1): 5d-verandering olie→CAD, koper→AUD,
   landbouw-index→NZD.
6. **Event-risico in timing**: high-impact events (CPI/NFP/rentebesluit)
   binnen ±2 dagen kosten timing-punten + expliciete waarschuwing in de call.
7. **ATR-normalisatie**: de contrarian 30–120-pips-band is vervangen door
   stretch in eenheden van de 14d-ATR; per call wordt `atrPips` vastgelegd.
8. **Eerlijker meten**: profit factor op **%-rendement** i.p.v. pips-optelling
   over paren; beweging < 0,15 × ATR telt als **"vlak"** (geen win/verlies,
   alleen weergave — de DB blijft binair).
9. **Gelockte header**: de bias-strip/regime wordt bij de ochtend-generate
   vastgezet in `fb_daily_context` (zelfde lock-principe als de calls).

---

## 1. Wat de tool doet

Een **fundamenteel-gedreven valuta-bias-tool**. Per valutapaar bepaalt hij elke
ochtend een richting (LONG = omhoog, SHORT = omlaag) op basis van de fundamentals,
met een **zekerheid van 0–10**. Vervolgens houdt hij **eerlijk en zonder
look-ahead** bij of die richting klopte, gemeten op meerdere horizons (1/3/5/10/20
handelsdagen).

Kernprincipes:
- **Eén keer per ochtend gelockt**, vast voor de dag (geen intraday-geflapper).
- **Vers, vooruit opgebouwd trackrecord** — geen backfill, dus geen look-ahead.
- **Puur directioneel** (close-to-close), géén take profit / stop loss.
- Twee stijlen ("lenzen"): **Daytrade** (1 dag) en **Swing** (5 dagen, experimenteel).

Doelgroep: retail FX-traders die een fundamentele bias willen met een transparant,
eerlijk getoetst trackrecord. **Educatief — geen financieel advies.**

---

## 2. Methodiek (de scoreberekening, v2)

> Acht valutascores → regime → paar-onbalans → richting → bias + timing →
> zekerheid (0–10). Alle getallen/weging zijn exact zoals geïmplementeerd.
> Verander deze niet zonder te backtesten.

### 2.1 Valutascore per valuta (8 majors: USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD)

```
valutascore = CB-bias × 2  +  rente-vs-doel × 1,5  +  nieuws (gecapt ±1,5)
            + verrassingen (gecapt ±2)  +  inflatie-gap (gecapt ±1)
            + grondstoffen (gecapt ±1; alleen AUD/CAD/NZD)
```

**CB-bias** (centralebankbeleid → ruwe score, daarna ×2):
| Bias | Ruw |
|---|---|
| hawkish / verkrappend | +2 |
| voorzichtig verkrappend | +1,5 |
| afwachtend / neutraal | 0 |
| voorzichtig verruimend | −1 |
| dovish / verruimend | −2 |

**Rente-vs-doel** (rente t.o.v. het **eigen doel** van de centrale bank, daarna ×1,5):
```
diff = rente − doel
diff >  0,5  → +1
diff >  0    → +0,5
diff > −0,5  → −0,5
anders       → −1
```
> Let op: dit is **niet** het rente-niveau en **niet** het renteverschil tussen
> twee valuta (carry). Carry is bewust weggelaten — zie §11.

**Nieuws-sentiment** (per valuta, gecapt op ±1,5 in de score) — v2:
- Eén Groq-LLM-call per generate (`llama-3.3-70b-versatile`, JSON-mode,
  temperature 0) labelt elk artikel met een **richting pér valuta** (-2..+2).
  1-based artikelnummering (0-based gaf in de praktijk een off-by-one).
- `relevantie-gewicht = min(relevance_score / 5, 1,5)`
- `recentheid = <12u →1,5 · <24u →1,2 · <48u →1,0 · anders →0,7`
- `bijdrage per valuta = (llm-richting / 2) × relevantie-gewicht × recentheid × 0,75`
- **Fallback** (geen GROQ_API_KEY / timeout / kapotte JSON): de oude
  keyword-methode van v1 (frasen ×1,5, woorden ×0,5, negatie-detectie,
  `netto = (bull − bear) × relevantie × recentheid × 0,25`, toegekend aan alle
  `affected_currencies`). `reasoning.newsSource` legt vast welke methode gold.

**Macro-verrassingen** (gecapt ±2) — nieuw in v2. Bron: TradingView
economische kalender (actual + forecast + importance per event):
- Per event met actual én forecast, max 5 dagen oud:
  `teken = sign(actual − forecast)`, omgekeerd voor werkloosheid/claims e.d.
  (INVERSE-lijst). Voorraden/veilingen (olie, gas, bonds) zijn uitgesloten.
- `impact-gewicht = high 1,0 · medium 0,5 · low 0,2`
- `grootte = clamp(|actual − forecast| / max(|forecast − previous|, 10% van
  het niveau), 0,25..1,5)` — een verrassing zo groot als de verwachte
  verandering zelf = 1,0.
- `recentheid = <24u 1,0 · <48u 0,8 · <72u 0,6 · <96u 0,45 · anders 0,3`
- Som per valuta, gecapt ±2. Top-6 bijdragen opgeslagen in
  `reasoning.base/quote.surpriseDetail` (uitkomst vs. verwacht, na te checken).

**Inflatie-gap** (gecapt ±1) — nieuw in v2: recentste headline-CPI j/j uit de
kalender t.o.v. het CB-doel (2%; CHF 1%; AUD 2,5%).
`pts = clamp((cpi − doel) / 2, ±1)`. Boven doel = hawkish druk = positief.

**Grondstoffen** (gecapt ±1) — nieuw in v2, alleen commodity-valuta:
5d-verandering van CL=F (olie→CAD), HG=F (koper→AUD), DBA (landbouw→NZD);
`pts = clamp(5d% / 3, ±1)`.

### 2.2 Marktregime (puur uit de valutascores)
```
jpy > 1 en HY < 0   → Risk-Off
HY  > 1 en jpy < 0  → Risk-On
usd > 2             → USD Dominant
usd < −2            → USD Zwak
anders              → Gemengd
```
`HY` = gemiddelde van AUD/NZD/CAD-scores. `usd`, `jpy` = die valutascores.

### 2.3 Paar-bias (richting + ruwe onbalans)
```
fund_score = score(base) − score(quote)
fund_score >  0,5  → bullish (LONG)
fund_score < −0,5  → bearish (SHORT)
anders             → neutraal (geen call)
```
Alleen paren met `|fund_score| ≥ 2,0` (FUND_GATE) tellen als call. Per dag worden
de **top 8** op zekerheid opgeslagen (MAX_CALLS_PER_DAY).

21 paren: EUR/USD, GBP/USD, USD/JPY, AUD/USD, NZD/USD, USD/CAD, USD/CHF, EUR/GBP,
EUR/JPY, GBP/JPY, AUD/JPY, NZD/JPY, CAD/JPY, EUR/AUD, GBP/AUD, AUD/NZD, EUR/CHF,
GBP/CHF, EUR/CAD, GBP/NZD, AUD/CAD.

### 2.4 Bias, timing en zekerheid (v2)

Twee aparte scores, bewust gescheiden — een sterke bias met slechte timing
wil je zíen, maar nog niet handelen:

```
// BIAS (0,5..10): hoe sterk de fundamentals de richting steunen
fundPts    = min(|fund_score| / 6, 1) × 8,5
regimePts  = regimeAligned ? 1,5 : 0,5
biasScore  = fundPts + regimePts

// TIMING (0..10): hoe gunstig het instapmoment is
stretch    = 5d-beweging ÷ 14d-ATR, positief als TEGEN de richting in
stretchPts = clamp((stretch + 0,5) / 2, 0..1) × 4   // -0,5 ATR (chasing) → 0 ·
                                                    // 0 → 1 · +1,5 ATR → 4
             (geen ATR beschikbaar → neutrale 1)
imPts      = intermarket_alignment / 100 × 3
eventPts   = max(0, 3 − 1,5 × aantal high-impact events base/quote binnen ±2d)
timingScore = stretchPts + imPts + eventPts

zekerheid  = afronden(0,6 × biasScore + 0,4 × timingScore)
```

- **regimeAligned** = past de richting bij het regime (safe havens JPY/CHF,
  high-yield AUD/NZD/CAD, USD-regels). Verbatim regel-set, zie code.
- v1 (calls vóór 2026-07-03) gebruikte: `fundPts (0..4) + contrarianPts
  (0/1,5/2,5, vaste 30–120-pips-band) + imPts (0..2) + regimePts` als één
  optelsom. De UI herkent v1-rijen aan `breakdown` zonder `v: 2`.

### 2.5 Intermarket-alignment (0–100%)
Instrumenten: **S&P 500, VIX, goud, US 10Y-rente, DXY (dollar)**. Per regime telt
een andere set instrumenten als "bevestiging":
- Risk-Off: S&P↓, VIX↑, goud↑, US10Y↑, DXY↑ (max 5)
- Risk-On: S&P↑, VIX↓, goud↓, DXY↓ (max 4)
- USD Dominant: DXY↑, US10Y↑, S&P niet↑ (max 3)
- USD Zwak: DXY↓, US10Y↓, S&P↑ (max 3)
- **Gemengd: vaste neutrale 50%** (geen markt-thema, geen instrument telt mee)

Bijdrage per instrument (sterkte) op basis van |%-verandering|: `>1% →1,0 · >0,5
→0,75 · >0,2 →0,5 · anders →0,25`. `alignment% = score / max × 100`.

---

## 3. Win/loss-definitie (eerlijk, geen leakage)

- **Referentiekoers** = de slotkoers van de **laatst voltooide dag-candle** op het
  moment dat de call werd gelockt (de candle van vandaag is nog in beweging en
  wordt gedropt).
- Elke call wordt beoordeeld op **5 horizons: 1, 3, 5, 10, 20 handelsdagen.**
- **Juist** = de slotkoers eindigde de voorspelde kant op (LONG: hoger; SHORT:
  lager). Puur **close-to-close**, geen TP/SL.
- Een horizon wordt **pas afgerekend als die volledig verstreken is** (no-leakage).
  Tot dan: "nog wachten" — telt nergens mee.
- **Context (telt niet mee in de winrate):** grootste favorabele beweging (MFE) en
  grootste adverse beweging (MAE) binnen de horizon, in pips, mét begin/eindkoers
  en datum (na te checken in TradingView).
- **"Vlak" (v2, alleen weergave):** beweegt de close minder dan **0,15 × 14d-ATR**
  (ATR vastgelegd op call-moment in `reasoning.atrPips`), dan telt de call als
  *vlak* — geen win of verlies, apart zichtbaar. De DB-kolom `correct` blijft
  binair (bron van waarheid); v1-calls zonder ATR blijven volledig binair.
- **Profit factor** = som winst-% ÷ som verlies-% (close-to-close, v2). Op
  %-rendement omdat pips over verschillende paren optellen high-vol paren laat
  domineren. Pips blijven per rij zichtbaar als detail.

Twee soorten leakage worden uitgesloten:
1. *Selectie-leakage* — alleen vooruit genereren, met nieuws zoals op het
   call-moment bekend.
2. *Evaluatie-leakage* — een horizon pas resolven als zijn datum volledig in het
   verleden ligt.

---

## 4. Cadans & lenzen

- **Daytrade**: dagcalls, elke werkdagochtend vers gelockt. Hoofdhorizon **1 dag**.
  Secundaire horizons 3/5/10/20 lopen mee.
- **Swing** (experimenteel): weekcalls, **maandagochtend** gelockt. Hoofdhorizon
  **5 dagen**. Secundair 3/10/20. Zelfde fundamentele analyse — alleen de horizon
  verschilt.
- Koers-inputs (momentum, intermarket, entry) zijn verankerd op **voltooide
  dag-candles** → een call verandert niet binnen de dag.

---

## 5. Datamodel (PostgreSQL / Supabase)

Twee eigen tabellen, los van al het andere. Trackrecord wordt **vooruit**
opgebouwd.

```sql
CREATE TABLE fb_calls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_date    DATE NOT NULL,                 -- handelsdag van de call
  call_type    TEXT NOT NULL,                 -- 'daily' | 'weekly'
  pair         TEXT NOT NULL,
  base         TEXT NOT NULL,
  quote        TEXT NOT NULL,
  direction    TEXT NOT NULL,                 -- 'bullish' | 'bearish'
  fund_score   NUMERIC(5,2) NOT NULL,         -- ruwe onbalans -5..+5
  conviction   NUMERIC(4,1) NOT NULL,         -- 0..10
  breakdown    JSONB NOT NULL,                -- {fundPts,contrarianPts,imPts,regimePts,total}
  regime       TEXT NOT NULL,
  entry_price  NUMERIC(14,6) NOT NULL,        -- referentiekoers (laatste voltooide slot)
  entry_date   DATE NOT NULL,
  reasoning    JSONB NOT NULL,                -- zie §6
  status       TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'complete'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (call_date, call_type, pair)
);

-- v2: gelockte dag-header (bias-strip + regime), één rij per dag.
CREATE TABLE fb_daily_context (
  ctx_date    DATE PRIMARY KEY,
  header      JSONB NOT NULL,      -- BriefingHeader-snapshot van de ochtend
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fb_outcomes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id      UUID NOT NULL REFERENCES fb_calls(id) ON DELETE CASCADE,
  horizon      INT NOT NULL,                  -- 1,3,5,10,20
  exit_date    DATE,
  exit_price   NUMERIC(14,6),
  correct      BOOLEAN,                       -- null = pending
  mfe_pips     INT, mfe_date DATE, mfe_price NUMERIC(14,6),  -- favorabele excursie
  mae_pips     INT, mae_date DATE, mae_price NUMERIC(14,6),  -- adverse excursie
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  UNIQUE (call_id, horizon)
);
```

---

## 6. `reasoning` (JSONB) — de onderbouwing

```jsonc
{
  "base":  { "currency":"EUR","total":5.25,"biasLabel":"verkrappend",
             "cbPts":4,"ratePts":0.75,"rate":2.25,"target":1.75,
             "newsPts":0.5,"newsHeadlines":["..."] },
  "quote": { ...idem voor de quote-valuta... },
  "regime":"USD Dominant", "regimeAligned":true, "regimeText":"...",
  "momentum5dPips": -144,
  "momentumStart": { "date":"2026-06-17","price":92.722 },
  "momentumNow":   { "date":"2026-06-24","price":91.285 },
  "imAlignment": 50,

  // Append-only (alleen in calls vanaf de uitbreiding; oude calls missen ze):
  "intermarket": [ { "key":"sp500","direction":"down","changePct":-0.05,"contributed":true }, ... ],
  "newsDetail":  { "EUR":[ { "title":"...","source":"ForexLive","date":"2026-06-29T..","weight":1.5,
                             "impact":1.5 } ], "GBP":[...] },   // impact = LLM-richting (v2)

  // v2 (append-only, vanaf 2026-07-03):
  "modelVersion": "v2",
  "atrPips": 72,                       // 14d-ATR op call-moment (vlak-deadband + stretch)
  "eventRisk": [ { "currency":"USD","title":"CPI YoY","date":"2026-07-14T12:30:00Z" } ],
  "newsSource": "llm"                  // of "keywords" (fallback)
  // base/quote bevatten daarnaast: surprisePts, surpriseDetail[], inflGapPts,
  // cpiYoY, cpiTarget, commodityPts, commodityName, commodityChangePct
}
```
`intermarket` en `newsDetail` zijn **optioneel** (append-only toegevoegd). Oude
rijen tonen "niet vastgelegd voor deze call".

---

## 7. API-endpoints

| Endpoint | Methode | Doel |
|---|---|---|
| `/api/fundamental-briefing/generate?type=daily\|weekly` | GET/POST | Genereer de gelockte calls voor vandaag (idempotent per dag/type). |
| `/api/fundamental-briefing/resolve` | GET/POST | Reken alle verstreken horizons af (idempotent). |
| `/api/fundamental-briefing/data` | GET | Lees header + dagcalls + weekcalls + volledig trackrecord. Genereert lui de calls van vandaag als de cron nog niet draaide. |

**Crons** (Bearer-`CRON_SECRET`):
- `/api/cron/fb-generate` — `30 6 * * 1-5` (werkdagen 06:30 UTC; weekly op maandag)
- `/api/cron/fb-resolve` — `0 7 * * 1-5` (werkdagen 07:00 UTC)

---

## 8. Datastromen / externe bronnen

- **Centralebank-rentes**: Supabase-tabel `central_bank_rates` (`currency, bank,
  rate, target, bias`). Apart te onderhouden (handmatig of via een eigen cron).
- **Nieuws**: Supabase-tabel `news_articles` (`title, title_nl, summary, source,
  affected_currencies, relevance_score, published_at`). Laatste 3 dagen,
  `relevance_score ≥ 2`, top 50.
- **Koersen + intermarket**: Yahoo Finance chart-API
  (`query1/query2.finance.yahoo.com/v8/finance/chart/<symbol>?interval=1d`), op
  voltooide dag-candles. FX-symbolen als `EURUSD=X`; intermarket `^GSPC, ^VIX,
  GC=F, ^TNX, DX-Y.NYB`; grondstoffen (v2) `CL=F, HG=F, DBA`.
- **Economische kalender (v2)**: TradingView
  (`economic-calendar.tradingview.com/events?from=..&to=..&countries=US,EU,GB,JP,CH,AU,CA,NZ`,
  met `Origin: https://www.tradingview.com`-header). Actual/forecast/previous +
  importance per event. Window: −40 dagen (verrassingen + CPI) tot +7 dagen
  (event-risico). Ongedocumenteerde bron — faalt hij, dan vallen de
  kalender-componenten stil op 0 en blijft de rest werken.
- **Nieuws-labeling (v2)**: Groq (`api.groq.com`, model
  `llama-3.3-70b-versatile`), één call per generate. Faalt → keyword-fallback.

**Env-variabelen:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (of
anon key), `GROQ_API_KEY` (v2-nieuwslabeling; optioneel maar aanbevolen),
`CRON_SECRET` (optioneel).

---

## 9. Frontend (UX-structuur)

Eén client-dashboard met:
- **Kop** + "? Rondleiding"-knop.
- **Lens-schakelaar** Daytrade / Swing (bepaalt alles eronder) + uitleg-balk.
- **Markt-header**: regime-balk + bias-strip (8 valuta's, score + balkje).
- **"Zo werkt deze tool"** — vaste visuele 3-stappen-uitleg (standaard ingeklapt).
- **Tabs**: Calls van vandaag · Trackrecord · Analyse.

**Calls-tab:** lijst (sterkste zekerheid bovenaan; zwakke < 5 apart ingeklapt
onder "niet handelen") + detailpaneel. Detail bevat:
- Gewone-taal-samenvatting (wat + waarom, automatisch uit de data).
- Tijdlijn (1/3/5/10/20d, groen/rood/grijs) met referentie→eindkoers + datums.
- "Toon de berekening" (standaard dicht): 4 uitklapbare subscores
  (fundamentele onbalans → factoren per valuta + nieuwskoppen met bron/datum/
  gewicht; recente koersbeweging; marktbrede bevestiging per instrument; regime).

**Trackrecord-tab:** per lens — trefkans, profit factor, aantal beoordeeld/wachtend
+ volledige lijst (datum, paar, richting, referentie→eindkoers, oordeel) met de
secundaire horizons als kolommen. Data-dunte-banner bovenaan.

**Analyse-tab:** winrate + profit factor uitgesplitst per zekerheid-bucket, paar en
horizon (combineerbaar), met **sample-guards** (n<30 grijs/ruis, 30–100 voorlopig,
≥100 betrouwbaar).

**Begrijpelijkheid:** gewone-taal-samenvatting, mini-tooltips (?), inklapbare
uitleg, en een rondleiding die de eerste keer door de tabbladen loopt.

Design: strak licht trading-dashboard — vaste radius-schaal, monospace tabel-
cijfers, groen/rood voor richting/uitkomst, blauw als spaarzame accent.

---

## 10. Bestandsstructuur (huidige implementatie, Next.js)

```
src/lib/fundamental/
  constants.ts   — paren, symbolen, horizons, bias-map, gates, v2-constanten
  types.ts       — alle types (FbCall, ConvictionV2, CallReasoning, …)
  scoring.ts     — valutascores (v1+v2-extras), regime, paar-bias,
                   buildConvictionV2 (bias/timing), intermarket
  calendar.ts    — TradingView-kalender: verrassingen, event-risico, inflatie-gap (v2)
  newsLlm.ts     — Groq-nieuwslabeling per valuta + keyword-fallback (v2)
  prices.ts      — Yahoo-fetch (voltooide candles), momentum, ATR14,
                   horizon-evaluatie + MFE/MAE
  service.ts     — generate / resolve / readData + gelockte header (de orkestratie)
src/app/api/fundamental-briefing/{generate,resolve,data}/route.ts
src/app/api/cron/{fb-generate,fb-resolve}/route.ts
src/app/tools/fundamental-briefing/page.tsx
src/components/fundamental-briefing/
  Dashboard.tsx, BriefingTab.tsx, CallDetail.tsx, Trackrecord.tsx, Analyse.tsx,
  ui.tsx (Tip, HowToRead, HowItWorks, Tour), helpers.ts (stats incl. vlak/PF%/
  kalibratie), styles.css
supabase/migrations/20260625_fundamental_briefing.sql
supabase/migrations/20260703_fb_daily_context.sql
```

De score-/conviction-wiskunde is gedeeld met (een kopie van) de bestaande FX-desk
conviction-logica; voor een standalone-site kan die volledig in
`src/lib/fundamental/` staan (zelfstandig).

---

## 11. Eerlijke kanttekeningen (belangrijk om te vermelden)

- **De edge is bescheiden.** Op schone, vooruit opgebouwde data: directionele
  trefkans ~50–54%; profit factor ~1,19 op alle calls, ~1,5 als je je beperkt tot
  de top-1/2 hoogste-zekerheid calls per dag. Geen geldmachine.
- **Sterkere calls lijken beter op langere horizon** (5–20 dagen) dan op 1 dag,
  maar dat staat op een kleine steekproef — nog niet hard bewezen.
- **Het trackrecord begint leeg** en wordt pas na weken/maanden betrouwbaar. Dat is
  de prijs voor "geen leakage".
- **Carry (renteverschil) is bewust weggelaten.** Het model is een
  beleids-momentum + korte-termijn mean-reversion-model, geen yield/carry-model.
  Carry is in het algemeen belangrijk maar past niet bij deze horizon/stijl; kan
  later als losse variant gebacktest worden.
- **Geen TP/SL.** De tool meet of de *richting* klopte, niet of een trade onderweg
  uit te houden was.
- **Educatief, geen financieel advies.**

---

## 12. Aandachtspunten voor een aparte website

- **Loskoppelen:** de tool heeft alleen Supabase (2 tabellen + rates/news), Yahoo
  Finance en de env-vars nodig. Geen afhankelijkheid van de rest van de site,
  behalve de gedeelde conviction-helper (kopieer die mee).
- **Rates/news voeden:** zorg dat `central_bank_rates` en `news_articles` gevuld
  blijven (eigen cron of handmatig). Zonder rates → geen scores; zonder news → de
  nieuws-component is 0.
- **Crons** instellen op de nieuwe host (Vercel cron of equivalent), met
  `CRON_SECRET`.
- **Yahoo Finance** is een ongedocumenteerde bron; overweeg een betaalde
  koersfeed voor productie-stabiliteit.
- **Auth/paywall** naar wens; de tool zelf is auth-agnostisch.
- **Merknaam/teksten** zijn Nederlands; vertaal indien nodig.

---

*Deze spec beschrijft de tool zoals live op sanderscapital.nl/tools/fundamental-
briefing (juni 2026). Wiskunde en win/loss-definitie zijn de bron van waarheid —
wijzig alleen met een backtest.*
