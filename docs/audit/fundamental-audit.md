# Audit Fundamental Engine — Daily Macro Briefing

**Datum:** 14 november 2026 · **Scope:** `src/lib/fx-engine/`, `src/app/api/briefing-v2/`, `src/app/api/trackrecord-v2/`, tabel `trade_focus_records` · **Status:** alleen-lezen audit, fase 0–5. Er is niets aan engine, API, UI of productiedata gewijzigd.

Elk getal in dit rapport komt uit een herdraaibaar script in `scripts/audit/` (zie §Reproduceerbaarheid). Bij n < 30 staat het erbij. Wat niet vast te stellen was, heet "onbekend".

---

## Samenvatting (één pagina)

**Wat klopt er niet — in volgorde van belang:**

1. **De centrale-bankinputs zijn bevroren.** Alle 8 bias-labels en rentes zijn voor het laatst bijgewerkt op 23 juni 2026; vijf van de zeven maanden live-trackrecord draaien op die momentopname. Het bevroren "EUR: verkrappend"-label genereerde 47% van alle calls sindsdien — die haalden 33,9% trefkans op 20 dagen (−62,6 pips gemiddeld). Het snapshot-vangnet is bovendien sinds april 2026 stilletjes kapot.
2. **Het getoonde trackrecord is op vier manieren onbetrouwbaar.** (a) ±10% van de uitkomsten is afgerekend op verouderde/gecachete Yahoo-quotes — 42 exits liggen aantoonbaar buiten de koersrange van de afrekendag; 99 calls met exact 0 pips zijn als verlies geboekt. (b) 28% van de uitkomsten wisselt van winst naar verlies (of andersom) bij een schone close-to-close meting. (c) De UI toont bij 408 van de 419 winnende calls "TP gehit: ja" voor een TP van 120 pips die nooit bestaan heeft. (d) Een verweesde, nergens gelinkte oude dashboardpagina (`/tools/fx-selector/tool`) vuurt bij elk bezoek POST's af die calls aanmaakt (ook in weekenden) en dubbel afrekent; het geschiedenis-herschrijvende backfill-endpoint is publiek bereikbaar.
3. **De formule is afgesteld op gesimuleerde data.** Alle parameters ("v3.1-optimizer") zijn gekozen op een backfill met gesimuleerd nieuws en look-ahead (claim: 57,4% winrate, PF 4,05, n=94). De schone live-meting: 46,1% op 5 dagen, +0,7 pips per call.
4. **De fundamentele factor meet een niveau dat al is ingeprijsd.** Het score-niveau correleert *negatief* met de beweging erna op 1–10 dagen (Spearman −0,13 op 1d). De 399 backfill-calls in de database zijn geen echte voorspellingen en moeten buiten elke statistiek blijven.

**Wat zegt de data (954 echte live calls, herberekend op voltooide dagcandles):**
De tool haalt 43,2% (1d) tot 50,4% (20d) richtingstrefkans — nergens beter dan muntworp. Het enige ingrediënt mét waarde is het generieke contrarian-effect (tegen de 5-daagse beweging in, álle paren): 54,4% op 5 dagen — maar de tool voert het uit met de nog-vormende dagcandle, waardoor 19% van de calls de verkeerde kant op staat, en de fundamentele selectie maakt het verder slechter in plaats van beter. Scorehoogte, intermarket-filter en regime onderscheiden niets. Kanttekening bij alles: 954 calls zijn effectief maar 157 onafhankelijke waarnemingen, en 20 maanden is ongeveer één macroklimaat.

**Wat stel ik voor:**
1. **Meting repareren** (vaste dagelijkse lock op voltooide candles, multi-horizon close-to-close, geen bezoeker-triggers, inputs per dag vastleggen, TP/SL-fictie weg) — randvoorwaarde voor alles.
2. **Kern = contrarian op voltooide candles** (ontwikkel 54,0% / toets 53,9% op 5d), **gefilterd door 2-jaars rente-momentum** (combi: ontwikkel 54,8% / toets 57,5%) — de enige combinatie die de chronologische 70/30-toets overleefde. CB-niveaufactor, grondstoffactor, risk-off-factor én CoT-extremen (zie correctie in fase 4) zakten voor de toets; verrassingsdata en CoT worden gelogd en zijn over 12 maanden te herbeoordelen.
3. **Vereenvoudigen:** de dubbele engine (v3-weergave-engine, 2.804 regels), het dode oude dashboard (2.754 regels), v1-trackrecord, nooit-vurende filters en verzonnen UI-velden kunnen weg; elke call moet in drie zinnen uitlegbaar zijn.
4. **Eerlijke verwachting:** het best geteste pakket belooft 54–58% richtingstrefkans met dunne marges — een bias-hulpmiddel, geen signaaldienst. De oude claims (57%+ winrate, PF 4) draagt de data aantoonbaar niet.

---

## Reproduceerbaarheid

| Script (`scripts/audit/`) | Wat het doet | Output (`scripts/audit/data/`, lokaal) |
|---|---|---|
| `fase0-inventaris.mjs` | Telt tabellen, exporteert `trade_focus_records` e.a. | `fase0-inventaris.json`, tabel-dumps |
| `fase0b-verdieping.mjs` | Scheidt backfill van live (via `created_at`), gaten, dubbelen, snapshots | `fase0b-verdieping.json`, `calls-classificatie.json` |
| `fase1-boekhouding.mjs` | Aanmaaktijden, afrekenduur, pips/JPY-consistentie, TP-badge, clustering | `fase1-boekhouding.json` |
| `fase1-herberekening.mjs` | Haalt dagcandles (Yahoo, gecorrigeerde sessie-datering) en herberekent alle uitkomsten op 1/3/5/10/20 dagen | `candles.json`, `audit-outcomes.json`, samenvatting |
| `fase2-export-nieuws.mjs` | Exporteert nieuwsartikelen voor de replay | `news_articles.json` |
| `fase2-baselines.mjs` | Muntworp/contrarian/momentum/fundamentals-proxy/tool op dezelfde cellen | `fase2-baselines.json` |
| `fase2-analyse.mjs` | Score-bins, factoren, doorsnedes, nieuwsbonus-replay | `fase2-analyse.json` |
| `fase2-factorsplit.mjs` | Robuuste splitsing score-niveau vs dag-afwijking | `fase2-factorsplit.json` |
| `fase3-checks.mjs` | Label-veroudering, vóór/ná-bevriezing, optimizer-claims | `fase3-checks.json` |
| `fase4-bronnen.mjs` | Verifieert/downloadt externe bronnen (rentes, CoT, VIX, grondstoffen, verrassingen) | `fase4-*.json` |
| `fase4-toets.mjs` | 70/30-toets van de verbeterrichtingen | `fase4-toets.json` |

CoT-bestanden eerst ophalen: `curl -sL -o cot20XX.zip https://www.cftc.gov/files/dea/history/deacot20XX.zip` + uitpakken naar `scripts/audit/data/cot20XX.txt`.

**Meetdefinitie auditdataset** (overal gelijk): referentie = slotkoers van de call-dag (eerste voltooide candle ná publicatie — geen enkele signaal-input overlapt de meetperiode); horizon n = n voltooide handelsdagen later; "klopt" = beweging in callrichting ≥ 30 pips (majors/crosses) of ≥ 50 pips (JPY-paren), "klopt niet" = ≤ −drempel, ertussen "te klein". Betrouwbaarheidsintervallen: Wilson, berekend op het effectieve aantal onafhankelijke clusters (zelfde paar + richting op aaneengesloten dagen = 1 waarneming).

---

## Fase 0 — Inventarisatie

- **`trade_focus_records`**: 1.353 rijen, allemaal `source=v2`, `version=v3.1-optimizer`. Daarvan **399 backfill** (in één batch geschreven op 4 apr 2026 over call-datums 15 apr 2025–27 mrt 2026, `newsSimulated=true` — gereconstrueerd, geen echte voorspellingen) en **954 live** (3 apr–13 nov 2026). De CREATE TABLE staat nergens in het repo.
- Live calls per maand: apr 133 … okt 168, nov (t/m 13) 55. Resultaat live: 419 correct / 531 incorrect / 4 open (44%); backfill: 223/176 (56%).
- **Geen werkdag zonder calls** in de live periode (cron-uitval niet aantoonbaar; "geen signaal" en "cron kapot" zijn in de data overigens niet te onderscheiden — er is geen logtabel).
- **Versiegeschiedenis**: formule sinds 2 apr 2026 ("Model B": CB-bias ×2 + rente-vs-doel ×1,5 + nieuwsbonus; alleen contrarian; IM-filter; 1 dag vasthouden); gedragswijzigende fixes t/m 7 apr; daarna ongewijzigd. De dataset is dus drielaags: backfill (onbruikbaar), 15 calls van 3–7 apr (wisselende logica), 939 calls sinds 8 apr (homogeen).
- **Eerder herontwerp**: drill-down gebouwd (22 jun); bias-accuracy-kolommen + drempels 30/50 pips gebouwd maar éénmalig gevuld (calls t/m 19 jun; 638 nieuwere calls leeg) en nergens getoond; performance-dashboard niet gebouwd.
- **Inputs niet vastgelegd**: `central_bank_rates` wordt in-place overschreven; `cb_rate_snapshots` bevat 12 vooraf ingevulde maandsnapshots (mei 2024–apr 2025) + één echte (1 apr 2026) — daarna niets meer: de maandcron levert sindsdien stilletjes niets op. Per call is alleen het eindresultaat bewaard (score, conviction, regime, imAlignment, momentum5d); geen per-valuta-opbouw. Geen enkele historische score is exact na te rekenen.
- Overig: `execution_signals` (296 rijen, tool verwijderd — dood), `news_articles` 9.846 stuks (oudste datum 2014 — sommige feeds dragen foute datums), nieuwe tool (`fb_calls` 1.205 / `fb_outcomes` 6.025 / `fb_daily_context` 95 dagen) staat los hiervan.

## Fase 1 — Boekhouding van de calls

| # | Bevinding | Bewijs | Ernst |
|---|---|---|---|
| 1 | "Prijs op call" = live Yahoo-tick op het aanmaakmoment; aanmaak 92% in het 06-uur (cron), **78 calls (8%) tussen 10:00–19:59 UTC door paginabezoekers** (oude dashboardpagina POSTte bij elk bezoek) | uurverdeling in `fase1-boekhouding.json`; `BriefingV2Dashboard.tsx:592` | matig |
| 2 | **Verouderde quotes bij afrekening**: 42 exits buiten de dagrange van de afrekendag; 99 calls (10,4%) exit==entry → per coderegel als vérlies geboekt; geclusterd in apr (49) en nov (42) | vb. `70f66ebd` (GBP/JPY 9 apr: exit 212.715, dagrange 10 apr 213.548–214.452); `af35cfab` (0 pips geboekt, werkelijk +11,2) | ernstig |
| 3 | Geen look-ahead in live calls; backfill wél (gesimuleerd nieuws + latere CB-labels) — herberekend haalt de backfill 46,4% (1d) en 33% (20d); het opgeslagen "56%" reproduceert niet | `fase1-herberekening-samenvatting.json` | ernstig (backfill) |
| 4 | "1 dag vasthouden" = in werkelijkheid **10,6–72,4 uur** (mediaan 24,0): vrijdagcalls staan 72 u open, 14 calls in het weekend afgerekend, 36 calls < 20 u | duurverdeling; vb. `2bbb119f` (vr 1 mei → zo 3 mei 19:39) | matig |
| 5 | **Geen SL/TP in de meting.** Exacte regel (`trackrecord-v2/route.ts:344-351`): tick-verschil; long+plus of short+min = correct; al het andere incl. exact 0 = incorrect; pips = \|verschil\| met resultaat-teken. "SL en TP in dezelfde candle" is dus niet van toepassing | code | — |
| 6 | **"TP gehit: ja" is verzonnen**: UI fabriceert TP = entry ± 120 pips, SL ∓ 40 (`fx-desk/lib/adapters.ts:359-371`) en toont de badge bij élke correcte call. Van 419 correcte calls haalde **11** echt ≥ 120 pips; **408 valse claims (97%)**. Bekend voorbeeld bevestigd: `0c60a3f3` (EUR/CHF 18 jun, entry 0.9204, exit 0.9230, +26 pips) | `Calls.tsx:220-221` | ernstig |
| 7 | Pip-omrekening & interne boekhouding: **0 fouten** (950/950, JPY 321/321) — de fouten zitten in de ingevoerde prijzen en definities, niet in het rekenen | `fase1-boekhouding.json` | — |
| 8 | **28% van de uitkomsten (266/950) wisselt** tussen opgeslagen tick-meting en schone close-meting; symmetrisch (135 vs 131) — meetruis, geen opzet | vb. `75adc06d` (AUD/NZD: +38 geboekt, schoon −77) | ernstig |
| 9 | 3 dubbele calls (14 sep, race cron×bezoeker), waarvan **EUR/GBP één keer "correct" en één keer "incorrect"** afgerekend (`d5189ace`/`0c44bdf9`) | `fase0b-verdieping.json` | matig |
| 10 | Nooit-sluitende calls: geen (4 open = gisteren). Spread/kosten: niet meegenomen; mediane 1d-beweging 20 pips vs spread 1–4 pips = 5–20% kosten | — | matig |
| 11 | **Samenhang**: zelfde paar gemiddeld 6,1 dagen op rij dezelfde kant op (max 30, EUR/AUD); 954 calls = **157 onafhankelijke clusters** | `fase1-boekhouding.json` | structureel |

**Oordeel**: de live call-régistraties (datum/paar/richting/score) zijn betrouwbaar en echt vooraf gedaan; de opgeslagen úitkomsten zijn als meting onbruikbaar en zijn volledig herberekend in `audit-outcomes.json`; de backfill is voor bewijsvoering onbruikbaar.

## Fase 2 — Wat zegt de data?

Herberekende live-uitkomsten (zelfde dagen/paren, pure richting, CI op effectieve n):

| Strategie | 1d | 5d | 20d | pips 5d | ATR 5d |
|---|---|---|---|---|---|
| Muntworp | 50% | 50% | 50% | 0 | 0 |
| Alleen contrarian (alle paren) | 48,5 [44,8–52,3] | **54,4 [50,5–58,1]** | 53,5 [49,6–57,5] | +12,6 | +0,151 |
| Alleen momentum | 51,4 | 45,6 | 46,4 | −12,6 | −0,151 |
| Fundamentals-proxy (zonder timing) | 48,4 [38–59] | 46,6 [36–57,4] | 50,6 [39,3–61,9] | +5,2 | +0,091 |
| **Volledige tool** | **43,2 [35,7–51,1]** | **46,1 [38,3–54]** | 50,1 [41,9–58,4] | +0,4 | +0,033 |

- De edge — voor zover aanwezig — zit in het generieke contrarian-effect; de fundamentele selectie subtraheert ~8 punten. In **176 van de 936 cellen (19%)** stond de tool aan de andere kant dan schoon contrarian doordat zijn momentum-venster de vormende candle meetelt; schoon contrarian op exact dezelfde cellen: 50,7% vs tool 46,1% (5d).
- **Score-hoogte voorspelt niets**: Spearman |score|→uitkomst −0,03 à −0,06; sterkste calls (≥3,5, n=338) gemiddeld −5,3 pips op 5d.
- **Factoren**: CB+rente-niveau Spearman −0,13 (1d) → +0,07 (20d); nieuws-afwijking ~0 à +0,08 (nieuws-tegen calls 40,4% vs mee 47,0% op 5d — zwakke aanwijzing); IM-alignment kent drie waarden (50/75/100), de dag-blokkade vuurde in 7 maanden **nul** keer, bins 42,5/44,4/47,5% — niets. Inflatie/groei/commodity/haven zitten niet in de call-engine (alleen UI) — geen trackrecord.
- **Doorsnedes**: EUR-sterker (382 calls) 43,5%, JPY-sterker (309) 44,0% — de twee grootste bets waren de slechtste. Long 20d 37,0% vs short 61,7% — niet te scheiden van jaardrift. Regime: 90% "Gemengd". Per maand: 30% (apr, okt) tot 74% (nov, n_eff 13) — geen stabiele edge. Per paar: n_eff 4–15, te weinig data, geen conclusie.
- 1d-meting: 64–67% van de bewegingen blijft onder de eigen drempel — grotendeels ruis.

## Fase 3 — Diagnose (verdenkingen uit de opdracht)

| Verdenking | Oordeel | Kernbewijs |
|---|---|---|
| 6. Handmatige labels verouderd | **Bevestigd — grootste impact.** Alle 8 labels laatst bijgewerkt 23 jun 2026 (`updated_at`); 47% van de calls sindsdien hangt op het bevroren "EUR verkrappend" (20d: 33,9%, −62,6 pips). Na-bevriezing presteert de tool op elke horizon lager dan ervoor (41,4 vs 48,0 op 1d; CI's overlappen) | `fase3-checks.json` |
| 7. Afgesteld op eigen data | **Bevestigd.** `scripts/model-configG-final.json`: parameters gekozen op "apr 2025–mrt 2026" = de gesimuleerde backfill, n=94; claim 57,4% WR / PF 4,05 / +51,9 pips. Live schoon: 46,1% / +0,7 pips. De SL40/TP120 hieruit werden de valse UI-badges | idem |
| 1. Niveau i.p.v. verandering | **Bevestigd.** Code meet puur niveau; data: niveau-Spearman −0,13 (1d), +0,07 (20d); zelfde these 6–30 dagen herhaald | `fase2-factorsplit.json` |
| 3. Nieuws-trefwoorden = ruis | **Grotendeels bevestigd.** Score verspringt >0,3 op 37% van de dagen (vrijwel geheel nieuws); 34% van de calls zit binnen één wiebel van de drempel → ruis kiest de trades; 33 dagen zonder één artikel; voorspellende waarde ~0 (sprankje op 10–20d) | idem |
| 5. Momentum dubbel/tegenstrijdig | **Bevestigd (v3-engine).** Momentum positief in valutascore (`scoring.ts:182-211`) + conviction +15 bij meelopend momentum (`signal.ts:126-128`), terwijl de engine mean-reversion-signalen afgeeft die per definitie tegenmomentum zijn. Empirisch: op de gekozen cellen zette de beweging dóór (Spearman +0,17 op 1d) | code + `fase2-analyse.json` |
| 4. Dubbeltellingen | **Bevestigd.** VIX/SP500 in havenfactor + paar-intermarket + regime dat de gewichten zet (3–4×); regime afgeleid uit de scores die het daarna "bevestigt"; bias-label en rente-vs-doel meten dezelfde beleidsstand | code |
| 2. Forecast vs previous | **Bevestigd, alleen weergave.** `scoring.ts:52-61/77-85` vergelijkt forecast met previous; `actual` wordt nooit gelezen. Voedt de UI, niet de calls | code |

Eigen bevindingen, gerangschikt: kapotte meetinfrastructuur (fase 1) verborg dit alles een jaar lang; het vormende-candle-venster kost ~4,6 punt; twee engines naast elkaar (uitleg ≠ calls); schijnprecisie door clustering (×6).

## Fase 4 — Verbetervoorstellen, getoetst (70/30 chronologisch)

Universum: 21 paren × 415 handelsdagen (8 apr 2025–13 nov 2026). **Ontwikkel t/m 24 mei 2026, toets 25 mei–13 nov 2026, één keer beoordeeld.** Bronnen geverifieerd door ze echt te downloaden (zie tabel in `fase4-bronnen-status.json`): 2j-rentes dagelijks via FRED (USD), ECB (EUR), MoF (JPY), BoC (CAD), RBA (AUD) — gratis, decennia historie, point-in-time (marktdata); GBP alleen 5-jaars (BoE, gelabeld); CHF/NZD geen bruikbare gratis dagreeks geverifieerd. CoT: CFTC, gratis, 1986+, publicatievertraging van 6 dagen gemodelleerd. Verrassingen: alleen `fb_daily_context` (95 dagen, point-in-time). Geen zuivelbron voor NZD.

| Voorstel | Ontwikkel (5d/20d richting) | Toets (5d/20d) | Oordeel |
|---|---|---|---|
| V2 contrarian op voltooide candles | 54,0 / 53,0 | 53,9 / 52,1 | ✅ timing-kern (consistent; zekerheid matig) |
| V3a CB/rente-NIVEAU (huidige factor) | 56,2 / 62,0 (eff 54 — schijn) | 54,7 / 50,4, **−pips** | ❌ verwijderen |
| V3b rente-momentum Δ5 standalone | 50,4 / 49,6 | 53,4 / 52,9 | ❌ alleen-in-toets telt niet |
| V3c **contrarian + rente-momentum eens** | 54,8 / 52,4 | **57,5 [51,7–63,1] / 59,2** | ✅ als filter (zekerheid matig; traindelta klein) |
| V4 CoT-extremen faden — **GECORRIGEERD 14 nov** | 48,7 / 51,9 | 53,6 / 51,9 | ❌ zakt alsnog (zie correctie hieronder) |
| V5 verrassingsverschil | geen train-data | 51,3 / 52,5 | ⏳ wordt al gelogd; beoordeel na 12 mnd |
| V6 risk-off-verandering (JPY/CHF) | 52,8 / 53,2 | 53,5 / 50,8 | ❌ te zwak |
| V7 grondstof-momentum (AUD/CAD) | 51,2 / 54,7 | 48,9 / **44,7** | ❌ keert om in de toets |

Eerlijkheid: 20 maanden ≈ anderhalf macroklimaat; "werkt in beide periodes" is noodzakelijk, niet voldoende bewijs. Het beste pakket (V2+V3c) belooft 54–58% richtingstrefkans met dunne marges.

**Correctie (14 nov 2026, vóór de bouw ontdekt):** de oorspronkelijke V4-toets las de verkeerde kolommen uit het CFTC-jaarbestand (kolom 7/8 = open interest/noncomm-long in plaats van 8/9 = noncomm long/short). Geverifieerd tegen de officiële CFTC Socrata-API (resource 6dca-aqww) en opnieuw getoetst met de juiste data: ontwikkel 48,7%/51,9% (5d/20d), toets 53,6%/51,9% — CI's ruim door de 50. **CoT-extremen faden is daarmee alsnog gezakt** en zit níet in de v4-engine; de percentielen worden wel dagelijks gelogd zodat er over 12 maanden een eerlijke herbeoordeling kan plaatsvinden. De eerder in dit rapport genoemde V4-cijfers (53,4–53,8 / 54,3–62,5) zijn ongeldig.

## Fase 5 — Eenvoud: wat eruit kan

Doel: elke call in drie zinnen. *"[Valuta X] is sterker dan [Y] omdat de 2-jaars renteverwachting van X de afgelopen week is opgelopen t.o.v. Y (+Δ bp) [en/of de positionering in Y extreem is]. De koers is de afgelopen 5 dagen juist de andere kant op bewogen (−N pips, −x ATR). Verwachting: terugkeer in de richting van X binnen ~5 handelsdagen, gemeten close-to-close met drempel 30/50 pips."*

**Weg (dood of schadelijk):**

| Onderdeel | Omvang | Reden |
|---|---|---|
| Verweesde pagina `/tools/fx-selector/tool` + `BriefingV2Dashboard.tsx` + hooks | ~2.900 regels | Nergens gelinkt, maar POSTte bij elk bezoek → bezoeker-calls, weekend-calls, dubbele afrekeningen. Verwijderen lost de halve fase 1 op |
| `/api/trackrecord-v2/backfill` + `/optimize`; POST alleen nog via cron+secret | — | Geschiedenis-herschrijvers, publiek bereikbaar vanuit de browser |
| `/api/trackrecord` (v1, 10 paren) + fallbacks in fx-desk hooks | — | Verouderde dubbelganger |
| v3-engine `src/lib/fx-engine/` + het `v3`-blok in de briefing-response | 2.804 regels | Genereert geen calls; bevat de bewezen fouten (forecast-vs-previous, momentum-dubbeltelling, 3× dubbelgetelde marktdata, nooit gevalideerde regime-gewichten). De drill-down moet de échte call-logica tonen |
| TP/SL-fictie in `fx-desk/lib/adapters.ts` + badge | — | 97% valse claims |
| Conviction-up/downgrades, cross-pair-contradictiefilter, confluence, divergences, news/IM-confidence-formules in `briefing-v2/route.ts` | honderden regels | Nooit gevalideerd, dubbel geteld of cosmetisch |
| IM-alignmentfilter + regime als scoringsinput in trackrecord | — | Vuurt nooit / discrimineert niets (fase 2); vervangen door V3c/V4-filters |
| Conviction "sterk/matig" op scorehoogte | — | Geen dosis-effect (Spearman ≤ 0) |
| Dubbele nieuws-woordenlijsten (route ≠ engine) | — | Eén implementatie, of géén (nieuws als leescontext, niet als score) |
| Constante metadata-velden (`holdingPeriod`, `lookbackDays`, `meanReversion`), ongebruikte accuracy-kolommen in responses | — | Dood gewicht |
| `execution_signals`-tabel; optimizer-artefacten (`model-*.json`) | — | Archiveren (niets verwijderen, regel 2), met leesmij dat de claims in-sample op gesimuleerde data waren |

**Blijft (verdient zijn plek):** de CB-tabel als feiten-weergave (mits geactualiseerd en gever­sioneerd), de contrarian-kern op voltooide candles, de nieuwsfeed als leescontext, de kennisbank-uitleg, en de meetdiscipline van de nieuwe FB-tool (gelockte ochtend-run, multi-horizon, no-leakage) als blauwdruk.

## Fase 6 — uitgevoerd op 14 november 2026

Na akkoord gebouwd, één wijziging per commit (zie git-historie van die dag):

1. **Backup-branch** `backup/pre-v4-herbouw` gepusht.
2. **Spoedreparaties:** de verweesde oude dashboardpagina (`/tools/fx-selector/tool`) is een permanente redirect geworden (het POST-vurende dashboard wordt nergens meer gerenderd); de backfill- en optimize-endpoints geven 410 Gone; `POST /api/trackrecord-v2` zit achter het cron-secret; de afrekening gebruikt geen gecachete quotes meer (`cache: 'no-store'`); de verzonnen TP/SL en de "TP gehit"-badge zijn uit de UI vervangen door de echte 1d-richtingsuitkomst met werkelijke sluitkoers.
3. **engine_version** staat op alle 1.353 bestaande calls (metadata-key, met backup en verificatie): `backfill-simulatie` (399), `v3.1-optimizer-vroeg` (15), `v3.1-optimizer` (939).
4. **v4-engine in schaduwmodus** (`src/lib/fx-v4/`): contrarian op voltooide candles, alleen waar het 5d-momentum van het 2-jaars renteverschil dezelfde kant op wijst (het V2+V3c-pakket). 14 paren met geverifieerde rentedekking (CHF/NZD-paren uitgesloten: geen bron). Calls worden opgeslagen als `metadata.source='v4-shadow'` in `trade_focus_records` — de site toont uitsluitend de oude engine. Uitkomsten op 1/3/5/10/20 voltooide handelsdagen close-to-close (drempel 30/50 pips) in de `accuracy`-kolom. Redenering per call in drie zinnen in `metadata.redenering`.
5. **Dagelijkse input-vastlegging:** elke run schrijft rentes (met brondatums), candle-closes, CoT-percentielen én een dump van `central_bank_rates` naar Storage-bucket `v4-inputs/<datum>.json` — elke v4-score is voortaan narekenbaar.
6. **Cron** `/api/cron/v4-shadow` (ma–vr 06:50 UTC, achter het cron-secret): eerst afrekenen, dan genereren. Geverifieerd via dry-run op 14 nov (zaterdag): alle 6 rentebronnen leveren, signaalregel draait op alle 14 paren, weekend-guard weigert correct, Storage schrijfbaar, deployed endpoint antwoordt 401 zonder secret. **Eerste echte calls: maandag 17 november 06:50.**

**Openstaande acties voor de eigenaar:**
- Dode bestanden fysiek verwijderen (verwijderen was voor de agent geblokkeerd; de pagina's zijn al onklaar): `git rm -r src/app/tools/fx-selector/v2/BriefingV2Dashboard.tsx src/app/tools/fx-selector/v2/components src/app/tools/fx-selector/v2/hooks src/app/tools/fx-selector/v2/utils.ts src/app/tools/fx-selector/v2/types.ts src/app/tools/fx-selector/v2/constants.ts`
- `supabase/migrations/20261114_v4_overstap.sql` **níet** nu draaien — pas bij de overstap (fase 7).
- De handmatige CB-labels in `central_bank_rates` zijn nog van 23 juni; de v4-engine gebruikt ze niet, maar de oude engine (die nog getoond wordt) wel — actualiseren blijft redactiewerk van de eigenaar.

## Fase 7 — vervroegde overstap (14 november 2026, dezelfde avond)

**Op uitdrukkelijk verzoek van de eigenaar is de geplande schaduwperiode van vier weken overgeslagen** en is de v4-engine dezelfde dag live gezet. Dit wijkt af van het oorspronkelijke plan ("overstap pas na akkoord op de schaduwresultaten") — het risico is expliciet benoemd en geaccepteerd: de v4-signaalregel is getoetst op 20 maanden historische data (fase 4), maar heeft nog geen dag live trackrecord. Het trackrecord begint daarom leeg en forward-only.

Uitgevoerd:
- **Engine live:** calls krijgen `metadata.source='v4'`, `engine_version='v4.0'`. De cron (`/api/cron/v4-shadow`, ma–vr 06:50 UTC) genereert en rekent af; eerste calls op maandag 17 november.
- **Oude engine uit:** de v2-generatie is uit `POST /api/trackrecord-v2` verwijderd (afbouwmodus: rekent alleen de laatste openstaande v2-calls af en maakt nooit meer nieuwe). De oude fx-desk-UI is vervangen.
- **Nieuwe tool op de site:** `/tools/fx-selector/v2` toont de v4-briefing — tab *Vandaag* (calls in drie zinnen + per paar waarom er géén call is) en tab *Trackrecord* (per-horizon winrates op besliste uitkomsten; elke uitkomst met begin-/eindkoers en datum, narekenbaar in TradingView). Data via `GET /api/v4`. De introductiepagina is herschreven; de ontkrachte claims (56% winrate, 434+ trades) zijn verwijderd.
- **Nog actief uit het oude systeem:** `GET /api/briefing-v2` draait nog omdat de Telegram-webhook hem gebruikt (alleen-lezen weergave; geen invloed op calls). Migreren of uitzetten is een losse vervolgklus.

**Migratie (eenmalig handwerk eigenaar):** open Supabase → SQL Editor → plak de inhoud van `supabase/migrations/20261114_v4_overstap.sql` → Run. Additief en idempotent: voegt de kolom `engine_version` toe (en vult die uit metadata), een index, en de tabel `v4_daily_inputs`. De site werkt ook zonder deze migratie — alles draait op metadata-velden — maar hiermee wordt het schema netjes.
