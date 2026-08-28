"""Google News RSS — market news, investments, company activity (no API key required)."""
import feedparser
import io
import requests
import urllib.parse
from datetime import datetime, timedelta, timezone

_BASE_URL = "https://news.google.com/rss/search"
_MAX_PER_QUERY = 20
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_pub_date(entry) -> datetime | None:
    pp = entry.get("published_parsed")
    if pp:
        import time
        try:
            return datetime.fromtimestamp(time.mktime(pp), tz=timezone.utc)
        except Exception:
            pass
    return None


def _fetch_feed(query: str, cutoff: datetime) -> list[dict]:
    q = urllib.parse.quote_plus(query)
    url = f"{_BASE_URL}?q={q}&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        feed = feedparser.parse(io.BytesIO(resp.content))
    except Exception as e:
        print(f"  [news_rss] warning: {query!r} — {e}")
        return []

    items = []
    for entry in feed.entries[:_MAX_PER_QUERY]:
        pub = _parse_pub_date(entry)
        if pub and pub < cutoff:
            continue
        source = ""
        src = entry.get("source")
        if isinstance(src, dict):
            source = src.get("title", "")
        elif src:
            source = str(src)
        items.append({
            "type": "news",
            "title": entry.get("title", ""),
            "source": source,
            "date": entry.get("published", ""),
            "url": entry.get("link", ""),
            "summary": entry.get("summary", "")[:500],
        })
    return items


def fetch(queries: list[str], start_date: str, end_date: str, **kwargs) -> list[dict]:
    from datetime import datetime as dt
    cutoff = dt.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    results = []
    seen_titles: set[str] = set()

    for query in queries[:5]:
        for item in _fetch_feed(query, cutoff):
            key = item["title"].lower()[:80]
            if key not in seen_titles:
                seen_titles.add(key)
                results.append(item)

    return results
