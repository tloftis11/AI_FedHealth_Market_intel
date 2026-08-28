"""USASpending.gov API — federal contract awards (no API key required)."""
import requests

_SEARCH_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
_TIMEOUT = 30
_LIMIT = 50
_FIELDS = [
    "Award ID", "Recipient Name", "Award Amount",
    "Start Date", "Description", "Awarding Agency", "Awarding Sub Agency",
]
_BROAD_AI_KEYWORDS = [
    "artificial intelligence", "machine learning", "deep learning",
    "natural language processing", "predictive analytics", "algorithmic",
]


def _search(keyword: str, start_date: str, end_date: str, agencies: list[dict]) -> list[dict]:
    try:
        payload = {
            "filters": {
                "time_period": [{"start_date": start_date, "end_date": end_date}],
                "award_type_codes": ["A", "B", "C", "D"],
                "keywords": [keyword],
                "agencies": agencies,
            },
            "fields": _FIELDS,
            "page": 1,
            "limit": _LIMIT,
            "sort": "Award Amount",
            "order": "desc",
        }
        resp = requests.post(_SEARCH_URL, json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("results", [])
    except Exception as e:
        print(f"  [usa_spending] warning: {keyword!r} — {e}")
        return []


def fetch(keywords: list[str], start_date: str, end_date: str, agencies: list[dict]) -> list[dict]:
    results = []
    seen: set[str] = set()
    topic_terms = [k for k in keywords if len(k) > 8][:3]
    search_terms = _BROAD_AI_KEYWORDS + topic_terms

    for term in search_terms:
        for award in _search(term, start_date, end_date, agencies):
            award_id = award.get("Award ID", "") or award.get("Description", "")[:40]
            if award_id in seen:
                continue
            seen.add(award_id)
            results.append({
                "type": "contract",
                "title": award.get("Description") or "Federal Contract",
                "organization": award.get("Recipient Name", ""),
                "agency": award.get("Awarding Agency", ""),
                "sub_agency": award.get("Awarding Sub Agency", ""),
                "amount": award.get("Award Amount"),
                "date": award.get("Start Date", ""),
                "award_id": award.get("Award ID", ""),
            })

    results.sort(key=lambda x: (x.get("amount") or 0), reverse=True)
    return results[:30]
