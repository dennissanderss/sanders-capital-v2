# Sanders Capital — Fundamental Briefing: volledig overzicht

> Werkdocument om te bespreken. Beschrijft wat er deze sessie is onderzocht,
> besloten en gebouwd. Datum: juni 2026.

---

## 1. Waar het mee begon

De bestaande FX-tool ("Daily Macro Briefing", `/tools/fx-selector/v2`) had twee problemen:

1. **De entry-ready calls veranderden elke ~5 minuten.** Dat gaf geen consistentie en je veranderde steeds van gedachte.
2. Het was onduidelijk **waarom** een call een bepaalde score kreeg, en **wanneer** een call juist/onjuist is.

Eerst is in de oude tool een **drill-down** toegevoegd (waarom scoort een call bv. 8.6 — de 4 subscores met formules). Daarna kwam de kernvraag: hoe krijgen we **consistente, begrijpelijke, fundamenteel-gedreven calls** met een **eerlijk trackrecord**?

---

## 2. Wat het onderzoek uitwees (belangrijk!)

We hebben de echte data geanalyseerd. De belangrijkste bevindingen:

### 2a. De flikker was een bug, geen feature
De oude tool herberekende elke 5 min en gebruikte de **nog-vormende dag-candle** als "nu". Daardoor sprongen 5d-momentum en intermarket-alignment de hele dag heen en weer → calls flipten op ruis.
**Fix (in de oude tool):** alle koers-inputs verankerd op **voltooide dag-candles**. Een call verandert nu nog maar één keer per dag. (Commit `242b803`.)

### 2b. Er bestaat geen intraday-data
Het hele systeem (opgeslagen calls én de backtest-engine) werkt op **dag-closes**. "8:30 vs 14:00 vs 20:00" is dus niet te backtesten — en de edge zit ook niet in het instaptijdstip, maar in de richting + hoe lang je vasthoudt.

### 2c. Het oude trackrecord (PF 1.42) was te rooskleurig
De 730 opgeslagen calls bleken in één batch **gereconstrueerd** (backfill) met **gesimuleerd nieuws** → look-ahead. Toen we splitsten:

| Periode | Profit factor | Winrate |
|---|---|---|
| Backfill (gesimuleerd nieuws) | 1.60 | 56% |
| **Live forward (echt, geen look-ahead)** | **1.19** | **47%** |

De échte, eerlijke edge is dus **bescheiden**: PF ~1.19 op alle calls, **~1.5 als je alleen de top-1/2 hoogste-zekerheid calls per dag neemt**.

### 2d. Directionele trefkans (geen pips)
Puur "zat de richting goed?", op schone live-data:

| | 1 dag | 3 dagen | 5 dagen | 10 dagen | 20 dagen |
|---|---|---|---|---|---|
| Alle calls | 54% | 51% | 52% | 50% | 52% |
| Sterke calls (score 3.5+) | 47% | 53% | 57% | 51% | 67%* |

\* kleine steekproef (n=42). **Patroon:** sterke fundamentele calls lijken **beter op langere horizon** (een fundamentele these heeft tijd nodig) — maar nog niet hard bewezen.

### 2e. Weekly "trend meerijden" heeft géén edge
Getest: entry maandag, ~1 week vasthouden in de fundamentele richting → **verliesgevend** (PF 0.49–0.74). De edge is kortetermijn / mean-reversion, niet trend.

**Conclusie van het onderzoek:** de fundamentele richting heeft een **zwakke maar reële** edge, die het sterkst is bij **weinig, hoge-zekerheid calls** en mogelijk op **langere horizon**. Daarom: niet gokken op één tijdstip/horizon, maar **alles eerlijk meten over meerdere horizons**.

---

## 3. De nieuwe tool: Fundamental Briefing

Op basis daarvan is een **compleet nieuwe, schone tool** gebouwd, **naast** de oude (die blijft staan en updaten). URL: `/tools/fundamental-briefing`.

### 3a. Kernprincipes
- **Eén keer 's ochtends gelockt, vast voor de dag** (weekly: maandag). Geen flikker — koers-inputs op voltooide candles.
- **Vers, vooruit opgebouwd trackrecord** in eigen tabellen. **Geen backfill, geen look-ahead.** Begint leeg en wordt sterker over tijd.
- **Methodiek = zelfde scoring als de oude tool**, maar als schone module herbouwd: centralebank-bias (×2) + rente vs. doel (×1,5) + nieuws → marktregime → paar-onbalans → zekerheid (0-10).

### 3b. Wanneer is een voorspelling juist/onjuist? (geen leakage)
- **Instap-referentie** = de slotkoers waarop het signaal is berekend (laatste voltooide dag-candle).
- Elke call wordt op **5 horizons** beoordeeld: **1, 3, 5, 10, 20 handelsdagen**.
- **Juist** = de slotkoers eindigde de voorspelde kant op (LONG: hoger; SHORT: lager). **Puur close-to-close**, geen TP/SL.
- Een horizon wordt **pas afgerekend als die volledig verstreken is** (no-leakage). Tot dan: "nog wachten".
- Daarnaast tonen we **"grootste favorabele beweging"** (MFE, in pips, met begin/eindkoers + datum) als *context* — telt **niet** mee in de winrate, maar laat zien of er onderweg een bruikbare swing was.
- **Regel:** overal waar pips staan, staan begin- en eindkoers + datum erbij (na te checken in TradingView).

### 3c. De drie tabs
- **Vandaag** — de gelockte dagcalls (richting + zekerheid per paar).
- **Weekly** — de weekcalls (maandag gelockt).
- **Trackrecord** — interactief rapport: kies een termijn (1/3/5/10/20 dagen) en alle cijfers + de volledige lijst van losse voorspellingen rekenen mee (datum, paar, dag/week, juist/onjuist).

### 3d. Call-detail (géén grafiek, géén TP/SL)
- Visuele **tijdlijn** (instap → 5 klikbare check-momenten, groen/rood/grijs).
- **Waarom deze zekerheid** (4 subscores met uitleg).
- **Fundamentele factoren per valuta** (centrale bank, rente, nieuws).
- **Marktregime-context.**
- Alles in **gewone taal**, met mini-tooltips (?) bij technische termen en een inklapbaar **"Hoe lees ik dit?"**-paneel.

---

## 4. Techniek (voor de volledigheid)

- **Frontend:** `src/components/fundamental-briefing/` (Dashboard, BriefingTab, CallDetail, Trackrecord, ui, styles.css).
- **Logica:** `src/lib/fundamental/` (constants, types, scoring, prices, service).
- **API:** `/api/fundamental-briefing/{generate,resolve,data}`.
- **Crons:** `fb-generate` (06:30 UTC, werkdagen; weekly op maandag) en `fb-resolve` (07:00 UTC) — rekent verstreken horizons af.
- **Database:** nieuwe tabellen `fb_calls` + `fb_outcomes` (migratie `supabase/migrations/20260625_fundamental_briefing.sql`, handmatig in Supabase gedraaid).
- De oude tool en `trade_focus_records` zijn **niet** aangeraakt.

---

## 5. Eerlijke kanttekeningen / wat je moet weten

1. **De edge is bescheiden** (~PF 1.19 alle calls; ~1.5 bij top-1/2). Geen geldmachine — een licht statistisch voordeel dat selectiviteit vereist.
2. **De trefkans is ~50-54%** op de meeste horizons. De winst zit niet in vaker winnen, maar in selectiviteit en (mogelijk) langere horizon.
3. **Het nieuwe trackrecord is nu nog (bijna) leeg** — het bouwt vooruit op. Pas na weken/maanden zijn de cijfers betrouwbaar. Dat is de prijs voor "geen leakage".
4. **De lange-horizon-belofte (5-20d beter) is nog niet bewezen** (kleine steekproef). Dit is precies wat de nieuwe tool nu eerlijk gaat meten.

---

## 6. Mogelijke gespreksonderwerpen / open vragen

- Is een edge van ~PF 1.19–1.5 genoeg om op te handelen, en met welke positiegrootte/risico?
- Moeten we **selectiever** zijn (alleen top-1/2 zekerheid per dag tonen/handelen)?
- Welke **horizon** past bij jouw handelsstijl, en moeten we dáár de "hoofd"-winrate op richten?
- Kan de **scoring beter** (andere weging van CB/rente/nieuws, of extra factoren)?
- Willen we **meldingen/alerts** als een hoge-zekerheid call binnenkomt?
- Hoe lang laten we het trackrecord **vooruit lopen** voordat we conclusies trekken?
