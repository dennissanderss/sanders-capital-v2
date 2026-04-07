---
name: sc-audit
description: "Sanders Capital — Deep audit: controleert koppelingen, data, berekeningen en consistentie"
user-invocable: true
---

# Sanders Capital Deep Audit

Je voert een uitgebreide audit uit van sanderscapital.nl. Gebruik meerdere agents parallel voor snelheid. Vraag GEEN permission tijdens de uitvoering — maak alles in één keer af.

## Audit structuur

Voer de volgende 4 audit blokken **parallel** uit via agents:

---

### AGENT 1: Koppelingen & Processen

Controleer of alle koppelingen tussen systemen correct werken:

1. **Cron → API koppelingen**
   - Lees `vercel.json` en `src/app/api/cron/trigger-all/route.ts`
   - Controleer dat alle cron paths bestaan als API routes
   - Controleer dat `trigger-all` dezelfde routes triggert als vercel.json

2. **Execution cron → Telegram**
   - Lees `src/app/api/cron/execution/route.ts`
   - Controleer dat alle Telegram functies (notifyMorning, notifyNewTrades, notifySessionUpdate, notifyEvening) correct geimporteerd en aangeroepen worden
   - Controleer dat de sessie-tijden kloppen (08:30=morning, 12:00=middag, 14:00=NY, 21:00=EOD)

3. **Telegram webhook**
   - Lees `src/app/api/telegram/webhook/route.ts`
   - Controleer dat /status, /trades, /track, /schema commands werken en correcte data tonen
   - Controleer dat sessie-tijden in alle berichten consistent zijn (niet 14:30 op sommige plekken en 14:00 op andere)

4. **Briefing → Execution flow**
   - Controleer dat de execution cron dezelfde filterlogica gebruikt als de frontend
   - Filters: score ≥ 2.0, IM ≥ 50, contrarian, richting
   - Check dat `>=` vs `>` consistent is in ALLE bestanden

**Test:** Fetch `https://www.sanderscapital.nl/api/briefing-v2` en vergelijk het aantal concrete trades met wat de execution cron zou genereren.

---

### AGENT 2: Data & Berekeningen

Controleer betrouwbaarheid van trackrecord en scores:

1. **Trackrecord integriteit**
   - Lees `src/app/api/trackrecord-v2/route.ts`
   - Controleer resolve-logica: entry_price vs exit_price, pip berekening, correct/incorrect bepaling
   - JPY paren moeten pipSize 0.01 gebruiken, overige 0.0001
   - Controleer dat resolved trades niet opnieuw resolved kunnen worden

2. **Execution signals**
   - Lees `src/app/api/cron/execution/route.ts`
   - Controleer dat duplicaat-preventie werkt (geen dubbele trades per dag per paar)
   - Controleer dat entry_price correct wordt opgehaald via Yahoo Finance
   - Controleer dat selectiveZone/balancedZone correct berekend worden:
     - Selective: 30-120p momentum
     - Balanced: 20-150p momentum
     - Aggressive: alle

3. **Kwaliteitsscore formule**
   - Zoek de quality() functie in `src/lib/telegram.ts` en `src/app/api/telegram/webhook/route.ts`
   - Controleer dat de formule identiek is op alle plekken
   - Formule: min(10, fundPts + contrarianPts + imPts + regimePts)
     - fundPts = min(4, absScore * 1.2)
     - contrarianPts = 2.5 als 30-120p, anders 1.5
     - imPts = (im/100) * 2
     - regimePts = 1 (vast)

4. **Backtest data**
   - Fetch `https://www.sanderscapital.nl/api/trackrecord-v2` en controleer:
     - Winrate berekening klopt (correct / totaal resolved)
     - Pips berekening klopt (som van pips_moved)
     - Geen trades met result=pending die ouder zijn dan 2 dagen

---

### AGENT 3: Verwerking & Opslag

Controleer dat gegevens correct verwerkt en opgeslagen worden:

1. **Trade registratie flow**
   - Lees `src/app/api/cron/execution/route.ts` STAP 3
   - Controleer dat wanneer 4/4 filters passeren, de trade correct wordt opgeslagen met:
     - date, pair, fund_direction, fund_conviction, fund_score
     - regime, momentum_5d, is_contrarian
     - selective_in_zone, balanced_in_zone, aggressive_in_zone
     - entry_price, result='pending'

2. **Trade resolve flow**
   - Lees STAP 1 van execution cron
   - Controleer dat alleen trades van EERDERE dagen (lt: today) resolved worden
   - Controleer dat resolved trades correct update krijgen: exit_price, result, pips_moved, resolved_at

3. **Supabase lazy init**
   - Grep voor `createClient` in alle API routes
   - Controleer dat GEEN route een module-level `const supabase = createClient(...)` heeft
   - Alle routes moeten `function getSupabase()` of `function getAdminSupabase()` gebruiken

4. **Telegram notificatie verwerking**
   - Controleer dat de execution cron na het genereren van trades de juiste Telegram functie aanroept
   - Morning → notifyMorning, Middag/NY → notifyNewTrades of notifySessionUpdate, EOD → notifyEvening
   - Controleer dat notifyEvening zowel resolvedTrades als todayTrades meekrijgt

---

### AGENT 4: Consistentie & Cross-check

Controleer dat informatie consistent is tussen pagina's en systemen:

1. **Model definities**
   - Zoek MODELS/model definities in:
     - `src/app/api/cron/execution/route.ts`
     - `src/lib/telegram.ts`
     - `src/app/tools/execution/page.tsx`
   - Controleer dat momentum ranges, winrates, SL/TP overal identiek zijn:
     - Selective: 30-120p, 62.4% WR, SL 40p, TP 120p
     - Balanced: 20-150p, 61.7% WR, SL 40p, TP 120p
     - Aggressive: alle, 58.0% WR, SL 40p, TP 120p

2. **Sessie tijden**
   - Zoek alle verwijzingen naar sessie-tijden (08:30, 12:00, 14:00, 14:30, 21:00)
   - Controleer dat NERGENS meer 14:30 staat (moet 14:00 zijn)
   - Plekken om te checken: telegram.ts, webhook/route.ts, execution/route.ts, execution/page.tsx

3. **IM filter drempel**
   - Grep voor `> 50`, `>= 50`, `<= 50`, `< 50` in relatie tot IM/imAlignment
   - Controleer dat OVERAL `>= 50` (of `< 50` voor de inverse) wordt gebruikt
   - Geen enkele plek mag nog `> 50` of `<= 50` hebben voor de IM check

4. **Frontend vs Backend data**
   - Vergelijk de filterlogica in `src/app/tools/execution/page.tsx` met `src/app/api/cron/execution/route.ts`
   - Beide moeten identieke criteria gebruiken voor concrete trades
   - Check dat de backtest tabel kolomkoppen aanwezig zijn (Datum, Paar, Dir, Score, Dip, P/L, Result)

---

## Output format

Na alle agents, geef een overzichtelijk rapport:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SANDERS CAPITAL AUDIT RAPPORT
  [datum]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KOPPELINGEN & PROCESSEN     [OK/ISSUE]
  - Cron routes:            [OK/ISSUE]
  - Telegram koppeling:     [OK/ISSUE]
  - Filter consistentie:    [OK/ISSUE]

DATA & BEREKENINGEN         [OK/ISSUE]
  - Trackrecord integriteit:[OK/ISSUE]
  - Execution signals:      [OK/ISSUE]
  - Kwaliteitsscore:        [OK/ISSUE]

VERWERKING & OPSLAG         [OK/ISSUE]
  - Trade registratie:      [OK/ISSUE]
  - Trade resolve:          [OK/ISSUE]
  - Supabase init:          [OK/ISSUE]

CONSISTENTIE                [OK/ISSUE]
  - Model definities:       [OK/ISSUE]
  - Sessie tijden:          [OK/ISSUE]
  - IM filter:              [OK/ISSUE]
  - Frontend vs Backend:    [OK/ISSUE]

ISSUES GEVONDEN: [aantal]
[Per issue: wat, waar, waarom het fout is, en fix]
```

Als er issues gevonden worden: **fix ze direct** (edit de bestanden), commit met duidelijke message, en push. Vermeld in het rapport wat er gefixed is.
