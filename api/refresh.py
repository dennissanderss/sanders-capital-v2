import json
from http.server import BaseHTTPRequestHandler
from datetime import datetime


def _run_analysis():
    from _lib.market_data import fetch_currency_data, fetch_intermarket_data
    from _lib.calendar import get_currencies_with_events
    from _lib.currency_strength import calculate_all_currency_scores
    from _lib.intermarket import analyze_intermarket
    from _lib.pair_scorer import score_all_pairs
    from _lib.supabase_client import save_snapshot, load_yesterday_scores

    currency_data = fetch_currency_data()
    intermarket_data = fetch_intermarket_data()
    events = get_currencies_with_events()
    dxy_data = intermarket_data.get("dxy")
    currency_scores = calculate_all_currency_scores(currency_data, dxy_data)
    intermarket = analyze_intermarket(intermarket_data)
    yesterday = load_yesterday_scores()

    pairs = score_all_pairs(
        currency_scores=currency_scores,
        intermarket=intermarket,
        events=events,
        regime=intermarket.get("regime", "range"),
    )

    try:
        save_snapshot(currency_scores, intermarket, pairs)
    except Exception as e:
        print(f"Snapshot save failed: {e}")

    adjustments = intermarket.get("adjustments", {})
    currencies = []
    for ccy, data in currency_scores.items():
        adj = adjustments.get(ccy, 0)
        currencies.append({
            "currency": ccy, "bias": data["bias"], "adj": round(adj, 1),
            "effective": round(data["bias"] + adj, 1),
            "mom5": round(data.get("momentum_5d", 0), 2),
            "mom20": round(data.get("momentum_20d", 0), 2),
        })
    currencies.sort(key=lambda x: x["effective"], reverse=True)

    signals = {}
    for name in ["us10y", "sp500", "vix", "oil", "gold"]:
        sig = intermarket.get(name, {})
        signals[name] = {
            "direction": sig.get("direction", "flat"),
            "change": round(sig.get("change_5d", 0), 1),
            "current": round(sig.get("current", 0), 2) if sig.get("current") else None,
        }

    trade_pairs = [p for p in pairs if p["classification"] == "TRADE"]
    watch_pairs = [p for p in pairs if p["classification"] == "WATCH"]
    avoid_pairs = [p for p in pairs if p["classification"] == "AVOID" and p["finalScore"] > 0][:5]

    changes = []
    if yesterday:
        for ccy in currency_scores:
            curr = currency_scores[ccy]["bias"]
            prev = yesterday.get(ccy, {}).get("bias", 0)
            if curr != prev:
                changes.append({"currency": ccy, "old": prev, "new": curr})

    verdict = []
    n = len(trade_pairs)
    if n == 0:
        verdict.append("Vandaag geen duidelijke kansen. Beter om niet te traden of kleiner te handelen.")
    elif n == 1:
        p = trade_pairs[0]
        verdict.append(f"1 kans vandaag: {p['pair']} {'kopen' if p['direction'] == 'LONG' else 'verkopen'}.")
    else:
        verdict.append(f"{n} kansen vandaag: {', '.join(p['pair'] for p in trade_pairs)}.")

    regime = intermarket.get("regime", "range")
    risk = intermarket.get("risk_sentiment", "neutral")
    regime_txt = {
        "trend": "De markt heeft een duidelijke richting.",
        "range": "De markt beweegt zijwaarts.",
        "transition": "De markt is aan het veranderen — onzeker.",
    }
    risk_txt = {
        "risk-on": "Beleggers zijn optimistisch.",
        "risk-off": "Beleggers zijn bang en zoeken veiligheid.",
        "neutral": "Marktsentiment is gemengd.",
    }
    verdict.append(regime_txt.get(regime, ""))
    verdict.append(risk_txt.get(risk, ""))
    if events:
        verdict.append(f"Let op: belangrijk nieuws voor {', '.join(events.keys())}.")
    if currencies:
        verdict.append(
            f"Sterkste: {currencies[0]['currency']} ({currencies[0]['effective']:+.1f}). "
            f"Zwakste: {currencies[-1]['currency']} ({currencies[-1]['effective']:+.1f})."
        )

    return {
        "lastUpdated": datetime.now().isoformat(),
        "regime": regime, "riskSentiment": risk, "verdict": verdict,
        "currencies": currencies, "signals": signals, "events": events,
        "tradePairs": trade_pairs, "watchPairs": watch_pairs,
        "avoidPairs": avoid_pairs, "changes": changes,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        result = _run_analysis()
        body = json.dumps(result, default=str)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())
