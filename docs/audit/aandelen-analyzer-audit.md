# Auditrapport Aandelen Analyzer

**Datum:** 21 november 2026
**Onderwerp:** `/tools/aandelen`, `src/lib/stocks/`, `src/app/api/stocks/`
**Versie getoetst:** commit `1307627` (live op sanderscapital.nl)

## Kernoordeel

De rekenkunde klopt: vier onafhankelijke reviewers rekenden alle indicatoren, de Piotroski-score, de ratio's en de backtest na op echte data en vonden geen rekenfouten. De problemen zitten ergens anders, en ze zijn serieus:

1. **Het oordeel draaide soms op de verkeerde dag.** Yahoo levert na het slot van Euronext de dagkoers uren te laat. Bij ING stond daardoor "Wachten" met een handelsplan, terwijl het echte slot onder het 200-daags gemiddelde lag en het oordeel "Niet instappen" had moeten zijn.
2. **De lange-termijnregels zijn sectorblind.** De kooplijst bestond uit vier financials, Unilever en Nvidia. Apple, Microsoft, ASML en Coca-Cola waren allemaal "prijzig".
3. **Een deel van de invoer van Yahoo is aantoonbaar fout** en liet oordelen omslaan (Adyen, Microsoft, Unilever).
4. **Het korte-termijnplan suggereert een voordeel dat niet is aangetoond.** Het trendfilter verloor in 19 van 23 geteste aandelen van kopen-en-vasthouden, en het plan met stop en doel is nergens getoetst.
5. **De API stond open voor iedereen**, terwijl de pagina premium is.

Het meeste is in deze ronde opgelost. Wat niet is opgelost staat onderaan, met de reden.

## Werkwijze

Vier reviewers kregen alleen de code en de live site, niet de ontwerpkeuzes of mijn eigen oordeel. Niemand mocht iets wijzigen.

| Blok | Wat is getoetst | Tickers |
|---|---|---|
| Data | Candledatering, tijdzones, valuta, look-ahead, caching | 13, op zes beurzen |
| Berekeningen | Elke formule nagerekend in een eigen script | 12 |
| Methodiek | Zijn regels en drempels verdedigbaar voor een beginner | 23 |
| UI, API, beveiliging | Toegang, tekst tegenover logica, foutafhandeling | 16 |

"Bewezen" betekent in dit rapport: aangetoond met Yahoo-ruwdata tegenover de live API, of rekenkundig. Niets is tegen TradingView zelf gelegd.

## Bevindingen

Status: **Opgelost** = in deze ronde aangepast. **Deels** = verzacht, niet volledig. **Open** = bewust niet gedaan, zie laatste hoofdstuk.

### A. Data

| # | Ernst | Bevinding | Bewijs | Status |
|---|---|---|---|---|
| A1 | Kritiek | Dagbar zonder slotkoers na beurssluiting wordt weggegooid; alles rekent op de dag ervoor | ASML.AS toonde slot 1.288,20 (19 nov), echt slot 20 nov was 1.168,00 (−9,3%). ING: "Wachten" in plaats van "Niet instappen" | Opgelost |
| A2 | Kritiek | Beurswaarde, K/W en dividendrendement kwamen van Yahoo en bewegen mee met de lopende koers | ASML.AS beurswaarde = aandelen × 1.168, niet × het getoonde slot | Opgelost |
| A3 | Hoog | Wisselkoers afgerond op 4 decimalen | IDR/USD 0,0001 in plaats van 0,00005507 (+82%); Telkom Indonesia kreeg kasstroomrendement 29,7% in plaats van 16,4% | Opgelost |
| A4 | Hoog | Slotveiling (17:30–17:40) kon als voltooide dag worden gezien | Vermoeden, sterk onderbouwd: laatste doorlopende koers 1.176,2, veiling 1.168 | Opgelost |
| A5 | Hoog | Een onvolledig antwoord (Yahoo-storing) werd net zo lang gecachet als een goed antwoord | Uit de code | Opgelost |
| A6 | Middel | "52 weken" en "12 maanden" waren 252 koersdagen, geen kalenderjaar | ASML.AS 52-weeks laag 841,60 in plaats van 822,20 | Opgelost |
| A7 | Middel | Operationele kasstroom van ASML kwam live leeg terug | Alle vier de jaren `null`; lokaal wel gevuld. Oorzaak onbekend | Deels (afgeleid uit vrije kasstroom en investeringen) |
| A8 | Middel | Yahoo's hoogste en laagste dagkoers voor Londen bevat uitschieters | Shell: 17 dagbars met een uitslag van meer dan 7% buiten open en slot | Open |
| A9 | Laag | Aantal analisten en aantal adviezen komen uit twee bronnen | ASML.AS: "33 analisten" naast 41 adviezen | Opgelost |
| A10 | Laag | Nieuws werd gezocht op ticker; bij `.AS` en `.L` kwam er nooit iets | Alle Europese tickers: 0 berichten | Opgelost |

In orde bevonden: candledatering over tien jaar op zes beurzen (0 afwijkingen, ook rond zomertijd), splitsingen (Nvidia, Apple, Toyota), pence-omrekening, ADR-verhoudingen, volgorde en volledigheid van de jaarcijfers.

### B. Berekeningen

| # | Ernst | Bevinding | Bewijs | Status |
|---|---|---|---|---|
| B1 | Middel | Backtest kocht op hetzelfde slot dat het signaal gaf | Eén dag later instappen: ING +226% in plaats van +327% (vasthouden: +217%) | Opgelost |
| B2 | Middel | Backtest gebruikte een ander gemiddelde dan het oordeel (dividend-gecorrigeerd) | ING: 200-daags 27,10 tegenover 27,46 | Opgelost |
| B3 | Middel | Waarschuwing voor kwartaalcijfers verdween op de cijferdag zelf vanaf 13:00 | Rekenregel | Opgelost |
| B4 | Middel | Piotroski: 4 van 9 gaf 0 punten, terwijl de uitleg zegt "3 of lager is een waarschuwing" | Nvidia en Rivian | Opgelost |
| B5 | Laag | ATR was een gewoon gemiddelde, niet de methode van TradingView | Apple 9,36 tegenover 8,18 (+14,5%) | Opgelost |
| B6 | Laag | Rendement per jaar deelde door 252 dagen in plaats van kalendertijd | ASML.AS 23,8% tegenover 24,3% | Opgelost |
| B7 | Laag | Meer cash dan schuld gaf de volle punten, ook bij groot verlies | Rivian: "Sterk: nettoschuld" bij −2,5 mld EBITDA | Opgelost |
| B8 | Laag | Geen bescherming tegen negatief kapitaal bij rendement op kapitaal | Uit de code | Opgelost |

Correct bevonden (afwijking kleiner dan één miljoenste): alle gemiddelden, RSI, momentumvensters, stop en doel, alle negen Piotroski-criteria, de puntentelling en de oordeelregels.

### C. Methodiek

| # | Ernst | Bevinding | Bewijs | Status |
|---|---|---|---|---|
| C1 | Kritiek | Het trendfilter verloor meestal van vasthouden, maar de pagina noemde het "het belangrijkste filter" | 19 van 23 aandelen. Heineken: "Kopen 100/100" bij −49% tegenover +9% | Deels |
| C2 | Kritiek | De backtest toetst het trendfilter, niet het plan met stop en doel | Bij puur toeval wint een plan met doel 3 en stop 2 in 40% van de gevallen: verwachting nul vóór kosten | Opgelost in de vervolgronde: plan getoetst, zie onder |
| C3 | Kritiek | Banken en verzekeraars scoorden het hoogst, op 5 van de 10 checks | JPMorgan 100, Allianz 100, ING 90 | Opgelost |
| C4 | Kritiek | Foute Yahoo-velden lieten het oordeel omslaan | Microsoft: kasstroomrendement 0,1% in plaats van 1,9%. Adyen: omzet −33% door wisseling van bruto naar netto. Unilever: rendement op kapitaal 47% in plaats van ongeveer 17% | Opgelost |
| C5 | Hoog | Vastgoedfondsen, nutsbedrijven en holdings werden met de verkeerde maat gemeten | Realty Income: K/W 37 is daar betekenisloos | Deels |
| C6 | Hoog | Piekwinst werd beloond | Nvidia "Kopen 85" met verwachte K/W 7,6 terwijl de koers in zes weken halveerde | Deels |
| C7 | Hoog | Harde grenzen bij K/W 15 en 25 | Berkshire op 24,98 "Kopen", op 25,01 "Afwachten" | Opgelost |
| C8 | Hoog | K/W op de verwachting van analisten, terwijl de pagina zegt dat analisten te optimistisch zijn | ASML.AS 20,7 (verwacht) tegenover 33,4 (gerealiseerd) | Opgelost |
| C9 | Hoog | Literatuurverwijzingen dekken de toepassing niet | Faber toetste maandelijks op beleggingscategorieën, niet dagelijks op losse aandelen | Opgelost (teksten) |
| C10 | Hoog | Korte-termijnscore telt dezelfde factor zes keer; "Kopen" bij dalende koers | Shell: "Kopen 78" na −13% in drie weken, onder het 50-daags | Opgelost |
| C11 | Hoog | Labels lezen als persoonlijk advies; "Niet instappen / verkopen" naast het langetermijnoordeel | — | Opgelost |
| C12 | Middel | Handelsplan mist positiegrootte, kosten, tijdslimiet | — | Deels |
| C13 | Middel | AI-uitleg: tegenstrijdige opdracht, foute feiten | Berkshire "voortgekomen uit verzekeringen" (het was textiel) | Deels |
| C14 | Middel | Minder dan gevraagd: geen segmenten, geschiedenis, dividendhistorie, link naar jaarverslag | — | Open |

### D. Pagina, API en beveiliging

| # | Ernst | Bevinding | Bewijs | Status |
|---|---|---|---|---|
| D1 | Hoog | `/api/stocks/*` was publiek; elke bot kon Yahoo en Groq laten draaien op jouw sleutel | `curl` zonder login gaf de volledige analyse | Opgelost |
| D2 | Hoog | Een bedrijfsnaam intikken en Enter gaf een fout | "Shell", "Apple", "Adyen", "Philips" → "geen koersdata" | Opgelost |
| D3 | Hoog | Slotkoers van een gesloten beurs stond er als "nu (lopende sessie)" zonder datum | ASML.AS op zaterdag | Opgelost |
| D4 | Middel | Visa werd behandeld als bank | Hele sector "Financial Services" | Opgelost |
| D5 | Middel | Elf plekken waar de uitleg iets anders zegt dan de regel | Onder andere drie verschillende RSI-drempels | Opgelost |
| D6 | Middel | Engelse resten: sector, land, "Mr.", "vs" | — | Deels (industrie en functietitels blijven Engels) |
| D7 | Middel | Koers in pence zonder uitleg | Shell Londen "GBp 3.574,50" | Opgelost |
| D8 | Middel | "Dividend: geen" als het onbekend is | Uitkerend indexfonds | Opgelost |
| D9 | Middel | Ruwe technische foutmeldingen | "SyntaxError: Unexpected token" | Opgelost |
| D10 | Middel | Indexfonds: vier lege kaarten | VWRL.AS | Opgelost |
| D11 | Middel | Leeftijd van de gegevens nergens zichtbaar | — | Opgelost |
| D12 | Laag | Toetsenbord en schermlezers | — | Deels |

In orde bevonden: geen onveilige HTML-weergave, invoervalidatie, licht thema, getalnotatie, begin- en eindkoers met datum bij alle rendementen.

## Wat er is veranderd

### De oordelen

- **Lange termijn rekent nu op gerealiseerde winst**, niet op de verwachting van analisten. De verwachte K/W staat er alleen ter vergelijking bij.
- **Geen harde grenzen meer** bij K/W en kasstroomrendement: de punten lopen geleidelijk (K/W 15 of lager is vol, 30 of hoger is nul).
- **Kasstroomrendement komt uit de jaarrekening**, hetzelfde getal als in het tabblad Jaarcijfers.
- **Banken en verzekeraars** worden herkend op bedrijfstak, niet op sector. Visa en Mastercard krijgen weer alle checks. Voor echte banken is het hoogste oordeel "Afwachten", met de vermelding op hoeveel checks de score rust.
- **Vastgoedfondsen** krijgen geen oordeel. **Nutsbedrijven en vermogensbeheerders** krijgen maximaal "Afwachten".
- **Koopwaardig vereist nu ook** dat de waardering bekend is, en dat een lage K/W niet samenvalt met een koers die meer dan 30% onder de jaartop staat (mogelijk piekwinst).
- **Een omzetdaling van meer dan 40% in één jaar** telt als verdachte data en niet als krimp.
- **Korte termijn: instap vereist nu ook** een koers boven het 50-daags gemiddelde en geen kwartaalcijfers binnen 14 dagen.
- **Het handelsplan verschijnt alleen nog bij een instapsignaal.**

### De woorden

De badges heten nu "Koopwaardig volgens de regels / Afwachten / Niet koopwaardig" en "Instap mogelijk / Wachten / Geen nieuwe trade". Je vroeg om een voorkeur kopen of verkopen; die is er nog, maar de tekst zegt nu wat het is: de uitkomst van regels, geen advies. "Verkopen" is weg bij de korte termijn, met de toelichting dat dit signaal niet over je langetermijnpositie gaat.

Onder de twee oordelen staat nu een vaste regel over spreiding, 1% risico per trade en de vergelijking met een wereldwijd indexfonds.

### De eerlijkheid over bewijs

- De uitkomst van het trendfilter op dit aandeel staat nu in de oordeelkaart zelf, niet meer onderaan.
- Het filter heet een risicofilter, geen rendementsmachine.
- Bij het handelsplan staat dat het bij puur toeval 40% van de keren wint en dat niet is aangetoond dat het beter doet.
- Per literatuurbron staat wat het onderzoek wel en niet toont.

### Data en techniek

- De slotkoers van een gesloten beurs wordt aangevuld uit Yahoo's officiële slotprijs. Geen look-ahead: de sessie is dan voorbij.
- Beurswaarde, K/W en dividendrendement worden zelf berekend op het getoonde slot.
- De API vraagt login en premium. Het antwoord wordt niet meer publiek gecachet.
- Nieuw: rekenhulp voor het aantal aandelen op basis van je rekeninggrootte.

## Wat bewust níet is gedaan

| Punt | Waarom niet nu |
|---|---|
| "Instap mogelijk" verlagen als het trendfilter op dit aandeel niet werkte | Niet overgenomen. Eén aandeel over negen jaar is te weinig om op te sturen; dat is ruis najagen. De uitkomst staat nu wel prominent in de kaart |
| Marktfilter (geen instap als de index onder zijn 200-daags staat) | Zinnig, maar een nieuwe regel die eerst getoetst moet worden |
| Analyse en AI-tekst opslaan in Supabase, limiet per gebruiker | Vraagt een SQL-migratie die jij moet draaien. Nu er een login voor staat is het risico klein. Wel is er een tijdelijke cache per server |
| Drempels per sector, K/W tegenover de eigen historie | Vraagt meer jaren data dan Yahoo gratis levert (vier) |
| Segmenten, geschiedenis, grootaandeelhouders, dividendhistorie, link naar jaarverslag | Uitbreidingen; geen fouten |
| Uitschieters in Yahoo's hoogste en laagste koers (Londen) | Niet tegen TradingView gecontroleerd; eerst vaststellen welke bron gelijk heeft |
| Industrie en functietitels vertalen | Honderden waarden; via AI vertalen maakt de pagina afhankelijker van Groq |
| Trackrecord van de oordelen | Los project, vraagt een migratie en een cron |

## Controle na de aanpassingen

Getest op 21 november 2026, lokaal, met echte Yahoo-data.

| Wat | Uitkomst |
|---|---|
| Slotkoers Euronext op zaterdag | ASML.AS rekent met 1.168,00 (20 nov), ING met 27,195. ING is nu "Geen nieuwe trade" in plaats van "Wachten" |
| 52-weeks laag ASML.AS | 822,20, gelijk aan Yahoo |
| Visa | Alle 10 checks, niet meer als bank behandeld |
| JPMorgan, ING | Score op 5 van 10 checks, oordeel Afwachten met uitleg |
| Realty Income | Geen oordeel (vastgoedfonds) |
| Nvidia | Afwachten: lage K/W bij een koers 48% onder de top |
| Adyen | Omzetgroei telt niet mee; kasstroomrendement 3,6% in plaats van −2,1% |
| Microsoft | Kasstroomrendement 1,9% in plaats van 0,1% |
| Shell Londen, Microsoft | "Wachten": koers onder het 50-daags gemiddelde |
| Rivian | Meer cash dan schuld levert nog de helft van de punten op |
| ATR Apple | 8,18, gelijk aan de berekening van de reviewer volgens de TradingView-methode |
| API zonder login | Antwoordt met "Log in om deze tool te gebruiken" |
| Pagina in de browser | Apple, Shell en een indexfonds: kop, oordeelkaarten, alle vier de tabbladen, rekenhulp, zoeken op naam |

Niet getest:

- **De API mét login.** Lokaal kon niet worden ingelogd. De controle volgt dezelfde regels als de pagina zelf, maar de eerste keer openen na de deploy is de echte test. Krijg je als ingelogd premium-lid een foutmelding over toegang, dan zit het daar.
- **Een handelsdag met open beurs.** Alle tests zijn op zaterdag gedaan. De afhandeling van de lopende sessie en de slotveiling is op de code beoordeeld, niet op een live sessie.
- **Vergelijking met TradingView.** Alles is vergeleken met Yahoo-ruwdata.
- **De pagina op een telefoon.**

## Vervolg: het handelsplan getoetst

In een tweede ronde is het plan zelf teruggerekend (`toetsPlan` in `src/lib/stocks/analysis.ts`), met dezelfde regels als het oordeel van vandaag.

**Zo is gerekend.** Signaal op het slot, instap op de opening van de volgende handelsdag, stop 2× en doel 3× de ATR vanaf die instap. Opent de koers voorbij stop of doel, dan geldt de openingskoers. Worden beide op één dag geraakt, dan telt de stop. Na 20 handelsdagen zonder stop of doel: uit op het slot. 0,2% kosten per trade, één trade tegelijk. De regel over kwartaalcijfers zit er niet in; oude cijferdata zijn niet beschikbaar.

**Uitkomst over 54 grote aandelen** (32 uit de VS, 22 uit Nederland en Europa, ongeveer negen jaar):

| | Trades | Met winst | Gemiddeld per trade | Aandelen met positief resultaat |
|---|---|---|---|---|
| Het plan (met instapsignaal) | 4.780 | 47,0% | +0,20% | 31 van 54 |
| Controle: zelfde stop en doel, zonder signaal | 10.746 | 46,7% | +0,30% | 38 van 54 |

**Wat dit betekent.** Het instapsignaal voegt niets toe. Wie op elk willekeurig moment instapte met dezelfde stop en hetzelfde doel, deed het per trade iets beter. De kleine plus in beide rijen komt van een beurs die in die jaren steeg en van het feit dat dit aandelen zijn die het hebben overleefd. Per aandeel loopt het sterk uiteen: van +30 keer het risico (Microsoft) tot −18 (Boeing).

Het plan begrenst dus het verlies per trade, maar het is geen aangetoonde manier om de markt te verslaan. De pagina zegt dat nu ook: bij het plan, in de oordeelkaart en in een eigen blok onderaan het tabblad Korte termijn, met de laatste trades per aandeel om na te kijken.

**Beperkingen van dit onderzoek.** Eén periode, die grotendeels een stijgende markt was. Alleen aandelen die nu nog bestaan. Koersen van Yahoo, niet gecontroleerd tegen een tweede bron. Geen dividend meegerekend. De uitkomst zegt daarom vooral wat er níet is aangetoond.

## Wat dit betekent voor het gebruik

De tool is na deze ronde betrouwbaarder in wat hij toont en eerlijker over wat hij niet weet. Hij is nog steeds geen bewezen strategie. Het lange-termijndeel is een nette checklist op openbare cijfers. Het korte-termijndeel is een trendfilter met een plan dat inmiddels is getoetst: het begrenst je verlies, maar het instapsignaal gaf in het verleden geen voorsprong. Gebruik het eerste om bedrijven te leren lezen. Gebruik het tweede hooguit als discipline voor je risico per trade, niet als reden om te verwachten dat je er geld mee verdient.
