import json
from http.server import BaseHTTPRequestHandler
from datetime import datetime


# Extended central bank rates — the 8 majors come from macro_data.py,
# additional countries are maintained here
EXTRA_RATES = {
    "CNY": {"country": "China", "bank": "People's Bank of China (PBoC)", "flag": "CN", "sourceUrl": "http://www.pbc.gov.cn/en/3688006/index.html"},
    "SEK": {"country": "Zweden", "bank": "Sveriges Riksbank", "flag": "SE", "sourceUrl": "https://www.riksbank.se/en-gb/monetary-policy/"},
    "NOK": {"country": "Noorwegen", "bank": "Norges Bank", "flag": "NO", "sourceUrl": "https://www.norges-bank.no/en/topics/Monetary-policy/"},
    "MXN": {"country": "Mexico", "bank": "Banco de México", "flag": "MX", "sourceUrl": "https://www.banxico.org.mx/monetary-policy/index.html"},
    "ZAR": {"country": "Zuid-Afrika", "bank": "South African Reserve Bank", "flag": "ZA", "sourceUrl": "https://www.resbank.co.za/en/home/what-we-do/monetary-policy"},
    "TRY": {"country": "Turkije", "bank": "Central Bank of Turkey", "flag": "TR", "sourceUrl": "https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Core+Functions/Monetary+Policy/"},
    "BRL": {"country": "Brazilië", "bank": "Banco Central do Brasil", "flag": "BR", "sourceUrl": "https://www.bcb.gov.br/en/monetarypolicy"},
}

COUNTRY_NAMES = {
    "USD": "Verenigde Staten",
    "EUR": "Eurozone",
    "GBP": "Verenigd Koninkrijk",
    "JPY": "Japan",
    "CHF": "Zwitserland",
    "AUD": "Australië",
    "CAD": "Canada",
    "NZD": "Nieuw-Zeeland",
}

FLAGS = {
    "USD": "US", "EUR": "EU", "GBP": "GB", "JPY": "JP",
    "CHF": "CH", "AUD": "AU", "CAD": "CA", "NZD": "NZ",
}


def fetch_live_rates():
    """Try to fetch live rates from a public source, fall back to macro_data."""
    import requests

    rates = []

    # 1. Get the 8 major currencies from our own macro_data
    try:
        from api._lib.macro_data import CENTRAL_BANKS, CB_DATA_UPDATED
        for ccy, cb in CENTRAL_BANKS.items():
            rates.append({
                "currency": ccy,
                "country": COUNTRY_NAMES.get(ccy, ccy),
                "bank": cb["bank"],
                "rate": cb["rate"],
                "flag": FLAGS.get(ccy, ""),
                "source": "macro_data",
                "sourceUrl": cb.get("source", ""),
                "lastMove": cb.get("last_move", ""),
                "nextMeeting": cb.get("next_meeting", ""),
                "bias": cb.get("bias", ""),
            })
    except Exception as e:
        print(f"Failed to load macro_data: {e}")

    # 2. Try to fetch additional rates from a public API
    try:
        # Use the free API from api-ninjas for interest rates
        url = "https://api.api-ninjas.com/v1/interestrate?central_bank_only=true"
        resp = requests.get(url, timeout=10, headers={"X-Api-Key": "free"})
        if resp.status_code == 200:
            data = resp.json()
            # Map known currencies
            ccy_map = {
                "Federal Reserve": "USD",
                "European Central Bank": "EUR",
                "Bank of England": "GBP",
                "Bank of Japan": "JPY",
                "Swiss National Bank": "CHF",
                "Reserve Bank of Australia": "AUD",
                "Bank of Canada": "CAD",
                "Reserve Bank of New Zealand": "NZD",
                "People's Bank of China": "CNY",
                "Sveriges Riksbank": "SEK",
                "Norges Bank": "NOK",
                "Banco de México": "MXN",
                "South African Reserve Bank": "ZAR",
                "Central Bank of Turkey": "TRY",
                "Banco Central do Brasil": "BRL",
            }
            live_currencies = {r["currency"] for r in rates}
            for item in data.get("central_bank_rates", []):
                bank_name = item.get("central_bank", "")
                ccy = ccy_map.get(bank_name)
                if ccy and ccy not in live_currencies:
                    extra = EXTRA_RATES.get(ccy, {})
                    rates.append({
                        "currency": ccy,
                        "country": extra.get("country", ""),
                        "bank": bank_name,
                        "rate": item.get("rate_pct", 0),
                        "flag": extra.get("flag", ""),
                        "source": "api-ninjas",
                        "sourceUrl": extra.get("sourceUrl", ""),
                        "lastMove": "",
                        "nextMeeting": "",
                        "bias": "",
                    })
                    live_currencies.add(ccy)
    except Exception as e:
        print(f"Live rate fetch failed (non-critical): {e}")

    # 3. Fill any missing extra currencies with static fallback
    existing = {r["currency"] for r in rates}
    for ccy, info in EXTRA_RATES.items():
        if ccy not in existing:
            rates.append({
                "currency": ccy,
                "country": info["country"],
                "bank": info["bank"],
                "rate": None,
                "flag": info["flag"],
                "source": "unavailable",
                "sourceUrl": info.get("sourceUrl", ""),
                "lastMove": "",
                "nextMeeting": "",
                "bias": "",
            })

    return rates


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            rates = fetch_live_rates()

            body = json.dumps({
                "rates": rates,
                "generatedAt": datetime.now().isoformat(),
                "count": len(rates),
            }, default=str)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body.encode())
        except Exception as e:
            import traceback
            error_body = json.dumps({"error": str(e), "trace": traceback.format_exc()})
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(error_body.encode())
