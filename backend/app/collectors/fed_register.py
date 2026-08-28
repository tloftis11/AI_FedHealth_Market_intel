"""Federal Register API — notices, rules, RFIs (no API key required)."""
import requests

_URL = "https://www.federalregister.gov/api/v1/documents.json"
_TIMEOUT = 30
_PER_PAGE = 20


def fetch(keywords: list[str], start_date: str, end_date: str, agency_slugs: list[str]) -> list[dict]:
    results = []

    for keyword in keywords[:5]:
        try:
            params = {
                "conditions[term]": keyword,
                "conditions[type][]": ["NOTICE", "RULE", "PROPOSED_RULE", "PRESDOCU"],
                "conditions[publication_date][gte]": start_date,
                "conditions[publication_date][lte]": end_date,
                "per_page": _PER_PAGE,
                "order": "newest",
                "fields[]": ["title", "abstract", "publication_date", "agency_names",
                              "document_number", "html_url", "type"],
            }
            for slug in agency_slugs:
                params.setdefault("conditions[agencies][]", []).append(slug)

            resp = requests.get(_URL, params=params, timeout=_TIMEOUT)
            resp.raise_for_status()

            for doc in resp.json().get("results", []):
                agencies = doc.get("agency_names") or []
                results.append({
                    "type": "regulation",
                    "title": doc.get("title", ""),
                    "abstract": (doc.get("abstract") or "")[:600],
                    "agency": ", ".join(agencies) if agencies else "",
                    "date": doc.get("publication_date", ""),
                    "doc_number": doc.get("document_number", ""),
                    "url": doc.get("html_url", ""),
                    "doc_type": doc.get("type", ""),
                })
        except Exception as e:
            print(f"  [fed_register] warning: {keyword!r} — {e}")

    seen: set[str] = set()
    unique = []
    for r in results:
        key = r.get("doc_number") or r.get("title")
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique
