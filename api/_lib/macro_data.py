"""
Macro-economic data for fundamental FX analysis.
Combines live calendar data with structured country profiles.
"""

import requests
from datetime import datetime, date

# ─── Central Bank Profiles ──────────────────────────────────
# Updated periodically — these reflect the current policy stance
# Last updated: 2026-03-31
CB_DATA_UPDATED = "31 maart 2026"

CENTRAL_BANKS = {
    "USD": {
        "bank": "Federal Reserve (Fed)",
        "rate": 3.75,
        "stance": "gematigd restrictief",
        "bias": "afwachtend",
        "last_move": "25bp knip (januari 2026)",
        "next_meeting": "6 mei 2026",
        "source": "https://www.federalreserve.gov/monetarypolicy.htm",
        "summary": (
            "De Fed heeft de rente geleidelijk verlaagd naar 3.75% na meerdere knips in 2025. "
            "Inflatie is dichter bij de 2% doelstelling maar kerninflatie blijft hardnekkig. "
            "De Fed houdt een pauze sinds januari en wacht op meer data voordat ze verder knippen."
        ),
    },
    "EUR": {
        "bank": "Europese Centrale Bank (ECB)",
        "rate": 1.90,
        "stance": "neutraal",
        "bias": "afwachtend",
        "last_move": "25bp knip (januari 2026)",
        "next_meeting": "16 april 2026",
        "source": "https://www.ecb.europa.eu/mopo/decisions/html/index.en.html",
        "summary": (
            "De ECB heeft de depositorente verlaagd naar 1.90% en nadert het neutrale niveau. "
            "De economie in de eurozone toont voorzichtig herstel maar de groei blijft bescheiden. "
            "De ECB houdt een pauze om het effect van eerdere knips te evalueren."
        ),
    },
    "GBP": {
        "bank": "Bank of England (BoE)",
        "rate": 3.75,
        "stance": "gematigd restrictief",
        "bias": "voorzichtig verruimend",
        "last_move": "25bp knip (februari 2026)",
        "next_meeting": "7 mei 2026",
        "source": "https://www.bankofengland.co.uk/monetary-policy",
        "summary": (
            "De BoE heeft langzamer geknipt dan de ECB maar heeft de rente nu verlaagd naar 3.75%. "
            "Looninflatie in het VK is afgenomen maar blijft boven het wenselijke niveau. "
            "De BoE signaleert verdere geleidelijke knips als de data het toelaat."
        ),
    },
    "JPY": {
        "bank": "Bank of Japan (BoJ)",
        "rate": 1.00,
        "stance": "gematigd restrictief",
        "bias": "voorzichtig verkrappend",
        "last_move": "25bp verhoging (januari 2026)",
        "next_meeting": "28 april 2026",
        "source": "https://www.boj.or.jp/en/mopo/index.htm",
        "summary": (
            "De BoJ heeft het normalisatietraject voortgezet en de rente verhoogd naar 1.00%. "
            "De Japanse inflatie blijft boven de 2% doelstelling en loongroei is solide. "
            "De BoJ overweegt verdere verhogingen maar is voorzichtig vanwege de sterke yen."
        ),
    },
    "AUD": {
        "bank": "Reserve Bank of Australia (RBA)",
        "rate": 3.35,
        "stance": "gematigd restrictief",
        "bias": "voorzichtig verruimend",
        "last_move": "25bp knip (februari 2026)",
        "next_meeting": "5 mei 2026",
        "source": "https://www.rba.gov.au/monetary-policy/",
        "summary": (
            "De RBA heeft de rente geleidelijk verlaagd naar 3.35% na meerdere knips. "
            "De Australische economie vertraagt door zwakkere Chinese groei en lagere grondstofprijzen. "
            "Inflatie is aanzienlijk gedaald en de RBA staat open voor verdere verruiming."
        ),
    },
    "NZD": {
        "bank": "Reserve Bank of New Zealand (RBNZ)",
        "rate": 2.75,
        "stance": "neutraal",
        "bias": "afwachtend",
        "last_move": "25bp knip (februari 2026)",
        "next_meeting": "13 mei 2026",
        "source": "https://www.rbnz.govt.nz/monetary-policy",
        "summary": (
            "De RBNZ heeft agressief geknipt en de rente verlaagd naar 2.75%. "
            "De economie van Nieuw-Zeeland herstelt langzaam na een periode van zwakke groei. "
            "De RBNZ nadert het neutrale niveau en vertraagt het tempo van knips."
        ),
    },
    "CAD": {
        "bank": "Bank of Canada (BoC)",
        "rate": 2.25,
        "stance": "neutraal",
        "bias": "afwachtend",
        "last_move": "25bp knip (december 2025)",
        "next_meeting": "15 april 2026",
        "source": "https://www.bankofcanada.ca/core-functions/monetary-policy/",
        "summary": (
            "De BoC heeft de rente verlaagd naar 2.25% en bevindt zich rond het neutrale niveau. "
            "De Canadese economie wordt beïnvloed door lagere olieprijzen en onzekerheid over handelsbeleid met de VS. "
            "De BoC houdt een pauze en evalueert de impact van eerdere verruiming."
        ),
    },
    "CHF": {
        "bank": "Zwitserse Nationale Bank (SNB)",
        "rate": 0.00,
        "stance": "neutraal",
        "bias": "afwachtend",
        "last_move": "25bp knip (juni 2025)",
        "next_meeting": "18 juni 2026",
        "source": "https://www.snb.ch/en/iabout/monpol",
        "summary": (
            "De SNB heeft de rente teruggebracht naar 0.00% en zit op de ondergrens. "
            "Zwitserland kampt met zeer lage inflatie en een sterke frank die de export remt. "
            "De SNB houdt de rente stabiel en intervenieert indien nodig op de valutamarkt."
        ),
    },
}

# ─── Pair context descriptions ──────────────────────────────
PAIR_CONTEXT = {
    "EUR/USD": {
        "name": "Euro vs US Dollar",
        "description": (
            "Het meest verhandelde valutapaar ter wereld. EUR is de basisvaluta, USD de quote. "
            "Als EUR/USD stijgt, wordt de euro sterker t.o.v. de dollar. Als het daalt, wordt de dollar sterker."
        ),
        "drivers": (
            "Dit paar wordt gedreven door het renteverschil tussen de Fed en de ECB, "
            "economische groei in de VS vs. de eurozone, inflatie aan beide kanten, "
            "en geopolitiek (handelsoorlog, oorlog in Europa). "
            "Het is ook gevoelig voor risk sentiment: in onzekere tijden vlucht geld vaak naar de dollar."
        ),
    },
    "GBP/USD": {
        "name": "Brits Pond vs US Dollar",
        "description": (
            "GBP is de basis, USD de quote. Stijging = sterker pond. "
            "Dit paar wordt 'Cable' genoemd — een verwijzing naar de telegraafkabel onder de Atlantische Oceaan."
        ),
        "drivers": (
            "Gedreven door BoE vs Fed beleid, UK inflatie (die hardnekkiger is), "
            "en UK-specifieke risico's. Het VK is een diensteneconomie met een groot handelstekort."
        ),
    },
    "USD/JPY": {
        "name": "US Dollar vs Japanse Yen",
        "description": (
            "USD is de basis, JPY de quote. Stijging = sterkere dollar, zwakkere yen. "
            "Daling = sterkere yen. Dit paar is zeer gevoelig voor renteverschillen."
        ),
        "drivers": (
            "Het renteverschil tussen de VS en Japan is de primaire driver. "
            "Ook risk sentiment speelt een grote rol: de yen is een veilige haven. "
            "Bij angst in de markt stijgt de yen. Bij optimisme daalt de yen."
        ),
    },
    "AUD/USD": {
        "name": "Australische Dollar vs US Dollar",
        "description": (
            "AUD is de basis, USD de quote. Stijging = sterkere Aussie. "
            "Dit is een 'commodity currency' — gevoelig voor grondstoffen."
        ),
        "drivers": (
            "China's economie is de belangrijkste driver (Australia's grootste handelspartner). "
            "IJzerertsprijzen, risk sentiment, en het renteverschil RBA vs Fed zijn bepalend."
        ),
    },
    "NZD/USD": {
        "name": "Nieuw-Zeelandse Dollar vs US Dollar",
        "description": (
            "NZD is de basis, USD de quote. Stijging = sterkere Kiwi. "
            "Vergelijkbaar met AUD/USD maar voor een kleinere, meer open economie."
        ),
        "drivers": (
            "Melkprijzen (Fonterra), Chinese vraag, RBNZ beleid, en globaal risk sentiment. "
            "NZD is extra gevoelig voor veranderingen in carry trade aantrekkelijkheid."
        ),
    },
    "USD/CAD": {
        "name": "US Dollar vs Canadese Dollar",
        "description": (
            "USD is de basis, CAD de quote. Stijging = sterkere dollar, zwakkere loonie. "
            "Daling = sterkere Canadese dollar."
        ),
        "drivers": (
            "Olieprijzen zijn de dominante driver (Canada is een grote olie-exporteur). "
            "Ook het renteverschil Fed vs BoC en de handelsrelatie VS-Canada zijn belangrijk."
        ),
    },
    "USD/CHF": {
        "name": "US Dollar vs Zwitserse Frank",
        "description": (
            "USD is de basis, CHF de quote. Stijging = sterkere dollar. "
            "De Zwitserse frank is een klassieke veilige haven."
        ),
        "drivers": (
            "Risk sentiment is de primaire driver. Bij onzekerheid stijgt CHF. "
            "Het renteverschil Fed vs SNB speelt ook mee, en SNB-interventierisico."
        ),
    },
    "EUR/GBP": {
        "name": "Euro vs Brits Pond",
        "description": (
            "EUR is de basis, GBP de quote. Stijging = sterkere euro t.o.v. het pond. "
            "Dit paar vergelijkt twee Europese economieën direct."
        ),
        "drivers": (
            "ECB vs BoE beleid is de hoofddriver. UK inflatie vs eurozone inflatie, "
            "en UK-specifieke factoren (politiek, handelsdeals post-Brexit)."
        ),
    },
    "EUR/JPY": {
        "name": "Euro vs Japanse Yen",
        "description": (
            "EUR is de basis, JPY de quote. Stijging = sterkere euro, zwakkere yen. "
            "Dit is een populair carry trade paar."
        ),
        "drivers": (
            "Risk sentiment (yen als safe haven), ECB vs BoJ beleid, "
            "en het enorme renteverschil tussen Europa en Japan."
        ),
    },
    "GBP/JPY": {
        "name": "Brits Pond vs Japanse Yen",
        "description": (
            "GBP is de basis, JPY de quote. Dit paar staat bekend als zeer volatiel. "
            "Stijging = sterker pond. Bijnaam: 'The Beast' of 'The Dragon'."
        ),
        "drivers": (
            "Risk sentiment is cruciaal — dit paar reageert sterk op angst/optimisme. "
            "BoE vs BoJ beleid, en het grote renteverschil maakt het populair voor carry trades."
        ),
    },
}

# ─── Macro Indicator Explanations ───────────────────────────
INDICATOR_EDUCATION = {
    "cpi": {
        "name": "CPI (Consumer Price Index)",
        "what": "Meet de gemiddelde prijsverandering van een mandje consumentengoederen.",
        "why": (
            "Dit is het belangrijkste inflatiecijfer. Centrale banken sturen hun beleid op basis van inflatie. "
            "Hogere inflatie → rente langer hoog of hoger → valuta sterker. "
            "Lagere inflatie → ruimte om te knippen → valuta zwakker."
        ),
        "surprise": (
            "De markt reageert op het VERSCHIL tussen verwachting en uitkomst. "
            "CPI hoger dan verwacht = hawkish verrassing → valuta stijgt. "
            "CPI lager dan verwacht = dovish verrassing → valuta daalt."
        ),
    },
    "gdp": {
        "name": "GDP (Bruto Binnenlands Product)",
        "what": "Meet de totale economische output van een land over een kwartaal.",
        "why": (
            "GDP laat zien of de economie groeit of krimpt. Sterke groei geeft de centrale bank "
            "reden om de rente hoog te houden. Zwakke groei dwingt tot knipppen."
        ),
        "surprise": "Sterker dan verwacht = bullish voor de valuta. Zwakker = bearish.",
    },
    "nfp": {
        "name": "NFP (Non-Farm Payrolls)",
        "what": "Het maandelijkse Amerikaanse banenrapport — hoeveel banen zijn er bijgekomen?",
        "why": (
            "De Fed kijkt hier heel sterk naar. Een sterke arbeidsmarkt betekent dat de economie "
            "robuust is en dat de Fed de rente hoog kan houden. Zwakke banen = druk op de Fed om te knippen."
        ),
        "surprise": (
            "NFP is een van de meest marktbewegende releases. Een groot verschil met de verwachting "
            "kan USD 50-100+ pips bewegen in minuten."
        ),
    },
    "pmi": {
        "name": "PMI (Purchasing Managers Index)",
        "what": "Enquête onder inkoopmanagers. Boven 50 = groei, onder 50 = krimp.",
        "why": (
            "PMI is een voorlopige indicator — het geeft een vroeg signaal over economische richting "
            "voordat harde data (GDP) beschikbaar is. Zeer belangrijk voor traders."
        ),
        "surprise": "PMI boven verwachting en boven 50 = bullish. Onder verwachting en onder 50 = bearish.",
    },
    "rate_decision": {
        "name": "Rentebesluit",
        "what": "De centrale bank beslist of de rente omhoog, omlaag, of gelijk blijft.",
        "why": (
            "De rente is de belangrijkste driver van valuta's. Hogere rente trekt kapitaal aan → valuta stijgt. "
            "Lagere rente duwt kapitaal weg → valuta daalt. Het statement en de persconferentie zijn vaak "
            "belangrijker dan het besluit zelf, omdat de markt het besluit meestal al verwacht."
        ),
        "surprise": "Onverwachte knip of verhoging zorgt voor enorme bewegingen.",
    },
    "retail_sales": {
        "name": "Retail Sales (Detailhandelsverkopen)",
        "what": "Meet hoeveel consumenten uitgeven in winkels.",
        "why": (
            "Consumentenuitgaven zijn 60-70% van de economie. Sterke retail sales = sterke economie = "
            "reden voor de centrale bank om hawkish te blijven."
        ),
        "surprise": "Hoger dan verwacht = bullish. Lager = bearish.",
    },
    "employment": {
        "name": "Employment Change / Arbeidsmarktdata",
        "what": "Verandering in het aantal werkenden. Elke economie rapporteert dit anders.",
        "why": (
            "Een sterke arbeidsmarkt ondersteunt consumentenuitgaven en inflatie. "
            "Centrale banken willen 'full employment' zonder oververhitting."
        ),
        "surprise": "Meer banen dan verwacht = bullish. Minder = bearish.",
    },
}


# ─── Economic Calendar (Live) ───────────────────────────────

HIGH_IMPACT_KEYWORDS = [
    "interest rate", "rate decision", "monetary policy",
    "nonfarm", "non-farm", "nfp", "employment change",
    "cpi", "consumer price", "inflation",
    "gdp", "gross domestic", "retail sales", "pmi",
    "unemployment", "trade balance", "core pce",
    "wage", "average earnings", "housing",
]

COUNTRY_TO_CCY = {
    "US": "USD", "EU": "EUR", "GB": "GBP", "JP": "JPY",
    "AU": "AUD", "NZ": "NZD", "CA": "CAD", "CH": "CHF",
    "USD": "USD", "EUR": "EUR", "GBP": "GBP", "JPY": "JPY",
    "AUD": "AUD", "NZD": "NZD", "CAD": "CAD", "CHF": "CHF",
}


def get_calendar_for_currencies(ccy1, ccy2):
    """Fetch this week's high-impact events for the two currencies."""
    events = []
    try:
        url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        for item in data:
            currency = COUNTRY_TO_CCY.get(item.get("country", "").upper(), "")
            if currency not in (ccy1, ccy2):
                continue

            impact = item.get("impact", "").lower()
            title = item.get("title", "")
            is_relevant = impact in ("high", "medium") or any(
                kw in title.lower() for kw in HIGH_IMPACT_KEYWORDS
            )
            if not is_relevant:
                continue

            try:
                event_date = datetime.fromisoformat(
                    item.get("date", "").replace("Z", "+00:00")
                )
                date_str = event_date.strftime("%a %d %b %H:%M")
            except (ValueError, AttributeError):
                date_str = "Onbekend"

            events.append({
                "currency": currency,
                "title": title,
                "impact": impact,
                "date": date_str,
                "forecast": item.get("forecast", ""),
                "previous": item.get("previous", ""),
            })
    except Exception as e:
        print(f"Calendar fetch failed: {e}")

    return events


def get_pair_analysis_data(pair):
    """Build complete analysis data for a currency pair."""
    parts = pair.upper().replace(" ", "").split("/")
    if len(parts) != 2:
        return {"error": f"Ongeldig paar: {pair}"}

    base, quote = parts
    if base not in CENTRAL_BANKS or quote not in CENTRAL_BANKS:
        return {"error": f"Valuta niet ondersteund: {pair}"}

    base_cb = CENTRAL_BANKS[base]
    quote_cb = CENTRAL_BANKS[quote]
    context = PAIR_CONTEXT.get(f"{base}/{quote}", {
        "name": f"{base} vs {quote}",
        "description": f"{base} is de basisvaluta, {quote} de quote. Stijging = sterkere {base}.",
        "drivers": "Renteverschil en macro-economische data van beide economieën.",
    })
    calendar = get_calendar_for_currencies(base, quote)

    # Rate differential analysis
    rate_diff = base_cb["rate"] - quote_cb["rate"]
    rate_advantage = base if rate_diff > 0 else quote if rate_diff < 0 else "geen"

    sources = {
        "calendar": {
            "name": "ForexFactory / FairEconomy",
            "url": "https://www.forexfactory.com/calendar",
            "description": "Economische kalender met high-impact events, verwachtingen en vorige waarden.",
        },
        "baseCB": {
            "name": base_cb["bank"],
            "url": base_cb.get("source", ""),
            "description": f"Officieel monetair beleid en rentebeslissingen van de {base_cb['bank']}.",
        },
        "quoteCB": {
            "name": quote_cb["bank"],
            "url": quote_cb.get("source", ""),
            "description": f"Officieel monetair beleid en rentebeslissingen van de {quote_cb['bank']}.",
        },
    }

    return {
        "pair": f"{base}/{quote}",
        "base": base,
        "quote": quote,
        "context": context,
        "baseCB": base_cb,
        "quoteCB": quote_cb,
        "rateDiff": round(rate_diff, 2),
        "rateAdvantage": rate_advantage,
        "calendar": calendar,
        "indicators": INDICATOR_EDUCATION,
        "sources": sources,
        "cbDataUpdated": CB_DATA_UPDATED,
        "generatedAt": datetime.now().isoformat(),
    }
