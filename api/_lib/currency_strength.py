from api._lib.market_data import get_price_change


def calculate_momentum_score(closes):
    change_5d = get_price_change(closes, 5)
    change_20d = get_price_change(closes, 20)
    if change_5d is None or change_20d is None:
        return 0.0

    short_score = _normalize(change_5d, 1.5, 0.3)
    medium_score = _normalize(change_20d, 3.0, 0.8)
    raw = (short_score * 0.6) + (medium_score * 0.4)

    if _same_dir(change_5d, change_20d) and abs(change_5d) > abs(change_20d / 4):
        raw *= 1.15
    if not _same_dir(change_5d, change_20d) and abs(change_5d) > 0.3:
        raw *= 0.7

    return max(-2.0, min(2.0, round(raw * 2) / 2))


def _normalize(change, strong, weak):
    if abs(change) < weak:
        return 0.0
    magnitude = min(abs(change), strong)
    scaled = (magnitude - weak) / (strong - weak)
    return scaled if change > 0 else -scaled


def _same_dir(a, b):
    return (a > 0 and b > 0) or (a < 0 and b < 0)


def calculate_all_currency_scores(currency_data, dxy_data=None):
    scores = {}

    if dxy_data and len(dxy_data) > 0:
        scores["USD"] = {
            "bias": calculate_momentum_score(dxy_data),
            "momentum_5d": get_price_change(dxy_data, 5) or 0,
            "momentum_20d": get_price_change(dxy_data, 20) or 0,
        }
    else:
        scores["USD"] = {"bias": 0.0, "momentum_5d": 0, "momentum_20d": 0}

    for currency, closes in currency_data.items():
        if currency == "USD":
            continue
        scores[currency] = {
            "bias": calculate_momentum_score(closes),
            "momentum_5d": get_price_change(closes, 5) or 0,
            "momentum_20d": get_price_change(closes, 20) or 0,
        }

    for ccy in ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]:
        if ccy not in scores:
            scores[ccy] = {"bias": 0.0, "momentum_5d": 0, "momentum_20d": 0}

    return scores
