from .market_data import get_price_change, get_direction, get_current_price


def analyze_intermarket(data):
    result = {}
    for name in ["us10y", "oil", "gold", "sp500", "vix", "dxy"]:
        df = data.get(name)
        if df is not None and not df.empty:
            result[name] = {
                "direction": get_direction(df, 5),
                "change_5d": get_price_change(df, 5) or 0,
                "current": get_current_price(df),
            }
        else:
            result[name] = {"direction": "flat", "change_5d": 0, "current": None}

    vix_dir = result["vix"]["direction"]
    sp_dir = result["sp500"]["direction"]
    vix_level = result["vix"]["current"]

    if vix_level and vix_level > 25:
        risk = "risk-off"
    elif vix_dir == "down" and sp_dir == "up":
        risk = "risk-on"
    elif vix_dir == "up" and sp_dir == "down":
        risk = "risk-off"
    elif sp_dir == "up":
        risk = "risk-on"
    elif sp_dir == "down":
        risk = "risk-off"
    else:
        risk = "neutral"
    result["risk_sentiment"] = risk

    vix_change = result["vix"]["change_5d"]
    dxy_20d = get_price_change(data.get("dxy"), 20) if data.get("dxy") is not None else None

    if abs(vix_change) > 15:
        regime = "transition"
    elif dxy_20d and abs(dxy_20d) > 1.5:
        regime = "trend"
    else:
        regime = "range"
    result["regime"] = regime

    adj = {}
    us10y_dir = result["us10y"]["direction"]
    oil_dir = result["oil"]["direction"]
    gold_dir = result["gold"]["direction"]

    if us10y_dir == "up":
        adj["USD"] = adj.get("USD", 0) + 0.5
    elif us10y_dir == "down":
        adj["USD"] = adj.get("USD", 0) - 0.5

    if risk == "risk-on":
        for c in ["AUD", "NZD", "GBP"]:
            adj[c] = adj.get(c, 0) + 0.5
        for c in ["JPY", "CHF"]:
            adj[c] = adj.get(c, 0) - 0.5
    elif risk == "risk-off":
        for c in ["JPY", "CHF"]:
            adj[c] = adj.get(c, 0) + 0.5
        for c in ["AUD", "NZD", "GBP"]:
            adj[c] = adj.get(c, 0) - 0.5

    if oil_dir == "up":
        adj["CAD"] = adj.get("CAD", 0) + 0.5
    elif oil_dir == "down":
        adj["CAD"] = adj.get("CAD", 0) - 0.5

    if gold_dir == "up":
        adj["JPY"] = adj.get("JPY", 0) + 0.25
        adj["CHF"] = adj.get("CHF", 0) + 0.25

    result["adjustments"] = adj
    return result
