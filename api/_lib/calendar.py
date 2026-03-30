import requests
from datetime import datetime, date


HIGH_IMPACT_KEYWORDS = [
    "interest rate", "rate decision", "monetary policy",
    "nonfarm", "non-farm", "nfp", "employment change",
    "cpi", "consumer price", "inflation",
    "gdp", "gross domestic", "retail sales", "pmi",
]


def get_currencies_with_events():
    events = []
    today = date.today()
    try:
        url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        country_to_ccy = {
            "US": "USD", "EU": "EUR", "GB": "GBP", "JP": "JPY",
            "AU": "AUD", "NZ": "NZD", "CA": "CAD", "CH": "CHF",
            "USD": "USD", "EUR": "EUR", "GBP": "GBP", "JPY": "JPY",
            "AUD": "AUD", "NZD": "NZD", "CAD": "CAD", "CHF": "CHF",
        }

        for item in data:
            try:
                event_date = datetime.fromisoformat(
                    item.get("date", "").replace("Z", "+00:00")
                ).date()
            except (ValueError, AttributeError):
                continue

            if event_date != today:
                continue

            currency = country_to_ccy.get(item.get("country", "").upper(), "")
            if not currency:
                continue

            impact = item.get("impact", "").lower()
            title = item.get("title", "")
            is_high = impact == "high" or any(
                kw in title.lower() for kw in HIGH_IMPACT_KEYWORDS
            )

            if is_high:
                events.append({"currency": currency, "title": title})

    except Exception as e:
        print(f"Calendar fetch failed: {e}")

    result = {}
    for evt in events:
        ccy = evt["currency"]
        if ccy not in result:
            result[ccy] = []
        result[ccy].append(evt["title"])

    return result
