import yfinance as yf

CURRENCY_TICKERS = {
    "EUR": "EURUSD=X", "GBP": "GBPUSD=X", "AUD": "AUDUSD=X",
    "NZD": "NZDUSD=X", "CAD": "CADUSD=X", "CHF": "CHFUSD=X", "JPY": "JPYUSD=X",
}

INTERMARKET_TICKERS = {
    "us10y": "^TNX", "sp500": "^GSPC", "vix": "^VIX",
    "oil": "CL=F", "gold": "GC=F", "dxy": "DX-Y.NYB",
}


def fetch_currency_data(period="3mo"):
    data = {}
    tickers = list(CURRENCY_TICKERS.values())
    try:
        raw = yf.download(tickers, period=period, progress=False, auto_adjust=True)
        if raw.empty:
            return data
        close = raw["Close"] if "Close" in raw.columns.get_level_values(0) else raw
        for currency, ticker in CURRENCY_TICKERS.items():
            if ticker in close.columns:
                df = close[[ticker]].dropna()
                df.columns = ["close"]
                data[currency] = df
    except Exception as e:
        print(f"Error fetching currency data: {e}")
    return data


def fetch_intermarket_data(period="3mo"):
    data = {}
    tickers = list(INTERMARKET_TICKERS.values())
    try:
        raw = yf.download(tickers, period=period, progress=False, auto_adjust=True)
        if raw.empty:
            return data
        close = raw["Close"] if "Close" in raw.columns.get_level_values(0) else raw
        for name, ticker in INTERMARKET_TICKERS.items():
            if ticker in close.columns:
                df = close[[ticker]].dropna()
                df.columns = ["close"]
                data[name] = df
    except Exception as e:
        print(f"Error fetching intermarket data: {e}")
    return data


def get_price_change(df, days):
    if df is None or len(df) < days + 1:
        return None
    current = df["close"].iloc[-1]
    past = df["close"].iloc[-(days + 1)]
    if past == 0:
        return None
    return float((current - past) / past * 100)


def get_current_price(df):
    if df is None or df.empty:
        return None
    return float(df["close"].iloc[-1])


def get_direction(df, days=5):
    change = get_price_change(df, days)
    if change is None:
        return "flat"
    if change > 0.3:
        return "up"
    elif change < -0.3:
        return "down"
    return "flat"
