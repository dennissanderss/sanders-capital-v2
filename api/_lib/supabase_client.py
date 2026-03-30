import os
from datetime import date, datetime, timedelta
from supabase import create_client

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")


def get_client():
    return create_client(url, key)


def save_snapshot(currency_scores, intermarket, pairs):
    client = get_client()
    today = date.today().isoformat()
    trade_pairs = [p for p in pairs if p["classification"] == "TRADE"]
    watch_pairs = [p for p in pairs if p["classification"] == "WATCH"]

    data = {
        "date": today,
        "timestamp": datetime.now().isoformat(),
        "currency_scores": currency_scores,
        "regime": intermarket.get("regime"),
        "risk_sentiment": intermarket.get("risk_sentiment"),
        "trade_pairs": [
            {"pair": p["pair"], "dir": p["direction"], "score": p["finalScore"]}
            for p in trade_pairs
        ],
        "watch_pairs": [
            {"pair": p["pair"], "dir": p["direction"], "score": p["finalScore"]}
            for p in watch_pairs
        ],
    }

    client.table("fx_snapshots").upsert(data, on_conflict="date").execute()


def load_yesterday_scores():
    client = get_client()
    for days_back in range(1, 4):
        check = (date.today() - timedelta(days=days_back)).isoformat()
        result = (
            client.table("fx_snapshots")
            .select("currency_scores")
            .eq("date", check)
            .execute()
        )
        if result.data:
            return result.data[0].get("currency_scores")
    return None
