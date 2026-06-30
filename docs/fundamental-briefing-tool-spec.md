# Fundamental Briefing — volledige tool-specificatie

> Zelfstandige spec van de Fundamental Briefing tool, bedoeld om de tool op een
> **aparte website** te kunnen aanbieden of opnieuw te laten bouwen. Beschrijft
> de methodiek, het datamodel, de API's, de frontend en de datastromen — plus
> eerlijke kanttekeningen. Stand: juni 2026.

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

## 2. Methodiek (de scoreberekening)

> Vier valutascores → regime → paar-onbalans → richting → zekerheid (0–10).
> Alle getallen/weging zijn exact zoals geïmplementeerd. Verander deze niet
> zonder te backtesten.

### 2.1 Valutascore per valuta (8 majors: USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD)

```
valutascore = CB-bias × 2  +  rente-vs-doel × 1,5  +  nieuws (gecapt ±1,5)
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

**Nieuws-sentiment** (per valuta, gecapt op ±1,5 in de score):
- Per artikel: zoek bull/bear **frasen** (gewicht ×1,5) en **losse woorden**
  (×0,5), met negatie-detectie (bv. "no rate hike" → omgekeerd).
- `relevantie-gewicht = min(relevance_score / 5, 1,5)`
- `recentheid = <12u →1,5 · <24u →1,2 · <48u →1,0 · anders →0,7`
- `netto = (bull − bear) × relevantie-gewicht × recentheid × 0,25`
- Toegekend aan elke valuta in `affected_currencies` van het artikel.

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

### 2.4 Zekerheid (conviction, 0–10) — vier subscores
```
fundPts       = min(|fund_score| / 5, 1) × 4          // 0..4
contrarianPts = contrarianPass ? (|mom5d| 30..120 ? 2,5 : 1,5) : 0   // 0 / 1,5 / 2,5
imPts         = intermarket_alignment / 100 × 2       // 0..2
regimePts     = regimeAligned ? 1,5 : 0,5             // 0,5 / 1,5
zekerheid     = min(10, afronden(fundPts + contrarianPts + imPts + regimePts))
```
- **contrarianPass** = de koers bewoog de afgelopen 5 handelsdagen **tégen** de
  fundamentele richting in (mean-reversion: koop de dip / verkoop de rally).
- **regimeAligned** = past de richting bij het regime (safe havens JPY/CHF,
  high-yield AUD/NZD/CAD, USD-regels). Verbatim regel-set, zie code.

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
- **Profit factor** = som winst-pips ÷ som verlies-pips (close-to-close).

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
  "newsDetail":  { "EUR":[ { "title":"...","source":"ForexLive","date":"2026-06-29T..","weight":1.5 } ], "GBP":[...] }
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
  GC=F, ^TNX, DX-Y.NYB`.

**Env-variabelen:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (of
anon key), `CRON_SECRET` (optioneel).

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
  constants.ts   — paren, symbolen, horizons, bias-map, gates
  types.ts       — alle types (FbCall, HorizonOutcome, CallReasoning, …)
  scoring.ts     — bias/rate/news-scoring, regime, paar-bias, conviction, intermarket
  prices.ts      — Yahoo-fetch (voltooide candles), momentum, horizon-evaluatie + MFE/MAE
  service.ts     — generate / resolve / readData (de orkestratie)
src/app/api/fundamental-briefing/{generate,resolve,data}/route.ts
src/app/api/cron/{fb-generate,fb-resolve}/route.ts
src/app/tools/fundamental-briefing/page.tsx
src/components/fundamental-briefing/
  Dashboard.tsx, BriefingTab.tsx, CallDetail.tsx, Trackrecord.tsx, Analyse.tsx,
  ui.tsx (Tip, HowToRead, HowItWorks, Tour), helpers.ts, styles.css
supabase/migrations/20260625_fundamental_briefing.sql
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
