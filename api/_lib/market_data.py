import requests

CURRENCY_TICKERS = {
    "EUR": "EURUSD=X", "GBP": "GBPUSD=X", "AUD": "AUDUSD=X",
    "NZD": "NZDUSD=X", "CAD": "CADUSD=X", "CHF": "CHFUSD=X", "JPY": "JPYUSD=X",
}

INTERMARKET_TICKERS = {
    "us10y": "^TNX", "sp500": "^GSPC", "vix": "^VIX",
    "oil": "CL=F", "gold": "GC=F", "dxy": "DX-Y.NYB",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def _fetch_chart(ticker, period="3mo", interval="1d"):
    """Fetch closing prices from Yahoo Finance chart API."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {"range": period, "interval": interval}
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return []
        indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = indicators.get("close", [])
        return [c for c in closes if c is not None]
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return []


def fetch_currency_data(period="3mo"):
    data = {}
    for currency, ticker in CURRENCY_TICKERS.items():
        closes = _fetch_chart(ticker, period)
        if closes:
            data[currency] = closes
    return data


def fetch_intermarket_data(period="3mo"):
    data = {}
    for name, ticker in INTERMARKET_TICKERS.items():
        closes = _fetch_chart(ticker, period)
        if closes:
            data[name] = closes
    return data


def get_price_change(closes, days):
    """Calculate percentage change over N days from a list of closing prices."""
    if closes is None or len(closes) < days + 1:
        return None
    current = closes[-1]
    past = closes[-(days + 1)]
    if past == 0:
        return None
    return float((current - past) / past * 100)


def get_current_price(closes):
    if closes is None or len(closes) == 0:
        return None
    return float(closes[-1])


def get_direction(closes, days=5):
    change = get_price_change(closes, days)
    if change is None:
        return "flat"
    if change > 0.3:
        return "up"
    elif change < -0.3:
        return "down"
    return "flat"
