MAJOR_PAIRS = [
    ("EUR", "USD"), ("GBP", "USD"), ("AUD", "USD"), ("NZD", "USD"),
    ("USD", "CAD"), ("USD", "CHF"), ("USD", "JPY"),
    ("EUR", "GBP"), ("EUR", "JPY"), ("EUR", "CHF"), ("EUR", "AUD"),
    ("EUR", "NZD"), ("EUR", "CAD"),
    ("GBP", "JPY"), ("GBP", "CHF"), ("GBP", "AUD"), ("GBP", "NZD"), ("GBP", "CAD"),
    ("AUD", "JPY"), ("AUD", "NZD"), ("AUD", "CAD"), ("AUD", "CHF"),
    ("NZD", "JPY"), ("NZD", "CAD"), ("NZD", "CHF"),
    ("CAD", "JPY"), ("CAD", "CHF"), ("CHF", "JPY"),
]

CORR_GROUPS = {
    "EUR/USD": "dollar", "GBP/USD": "dollar", "AUD/USD": "dollar", "NZD/USD": "dollar",
    "USD/CAD": "dollar", "USD/CHF": "dollar", "USD/JPY": "dollar",
    "EUR/JPY": "yen", "GBP/JPY": "yen", "AUD/JPY": "yen", "NZD/JPY": "yen",
    "CAD/JPY": "yen", "CHF/JPY": "yen",
    "AUD/NZD": "commodity", "AUD/CAD": "commodity", "NZD/CAD": "commodity",
}


def score_all_pairs(currency_scores, intermarket, events,
                    regime="range", trade_threshold=3.0, watch_threshold=2.0,
                    transition_threshold=3.5, max_trade=3, max_watch=2):

    adjustments = intermarket.get("adjustments", {})
    risk = intermarket.get("risk_sentiment", "neutral")

    effective = {}
    for ccy in ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]:
        raw = currency_scores.get(ccy, {}).get("bias", 0)
        effective[ccy] = raw + adjustments.get(ccy, 0)

    scored = []
    for base, quote in MAJOR_PAIRS:
        div = effective.get(base, 0) - effective.get(quote, 0)
        direction = "LONG" if div >= 0 else "SHORT"
        abs_div = abs(div)

        ev_pen = 0
        if base in events and quote in events:
            ev_pen = 2.0
        elif base in events or quote in events:
            ev_pen = 1.0

        im_adj = 0
        risk_ccys = {"AUD", "NZD", "GBP"}
        safe_ccys = {"JPY", "CHF"}
        strong = base if direction == "LONG" else quote
        if risk == "risk-off" and strong in risk_ccys:
            im_adj = -0.5
        if risk == "risk-on" and strong in safe_ccys:
            im_adj = -0.5

        final = max(0, abs_div + im_adj - ev_pen)
        pair_name = f"{base}/{quote}"

        parts = []
        bb = currency_scores.get(base, {}).get("bias", 0)
        qb = currency_scores.get(quote, {}).get("bias", 0)
        if abs(bb) >= 1.5:
            parts.append(f"Strong {base} momentum")
        elif abs(qb) >= 1.5:
            parts.append(f"Weak {quote} momentum")
        else:
            parts.append(f"{base} vs {quote} divergence")
        if risk != "neutral":
            parts.append(risk.replace("-", " "))
        if base in events or quote in events:
            parts.append("EVENT RISK")

        scored.append({
            "pair": pair_name, "direction": direction,
            "rawDivergence": abs_div, "intermarketAdj": im_adj,
            "eventPenalty": ev_pen, "finalScore": round(final, 1),
            "classification": "", "isHighConviction": False,
            "reason": " | ".join(parts[:3]),
            "sizeHint": "", "correlationGroup": CORR_GROUPS.get(pair_name, "cross"),
        })

    scored.sort(key=lambda p: p["finalScore"], reverse=True)

    threshold = transition_threshold if regime == "transition" else trade_threshold
    trade_n, watch_n = 0, 0
    used_groups = set()

    for p in scored:
        if p["finalScore"] >= threshold and trade_n < max_trade:
            grp = p["correlationGroup"]
            if grp in used_groups and grp != "cross":
                p["classification"] = "WATCH" if watch_n < max_watch else "AVOID"
                p["reason"] = f"Correlated with higher-ranked {grp} pair. " + p["reason"]
                if p["classification"] == "WATCH":
                    watch_n += 1
            else:
                p["classification"] = "TRADE"
                used_groups.add(grp)
                trade_n += 1
                if (p["finalScore"] >= 4.0 and p["eventPenalty"] == 0
                        and regime == "trend" and p["intermarketAdj"] >= 0):
                    p["isHighConviction"] = True
                    p["sizeHint"] = "FULL SIZE"
                elif p["finalScore"] >= 3.5:
                    p["sizeHint"] = "standaard"
                else:
                    p["sizeHint"] = "reduced"
        elif p["finalScore"] >= watch_threshold and watch_n < max_watch:
            p["classification"] = "WATCH"
            watch_n += 1
        else:
            p["classification"] = "AVOID"

    return scored
