"""NIH Reporter API — grant funding (no API key required)."""
import requests

_URL = "https://api.reporter.nih.gov/v2/projects/search"
_TIMEOUT = 30
_LIMIT = 20


def fetch(keywords: list[str], start_date: str, end_date: str, orgs: list[str]) -> list[dict]:
    results = []

    for keyword in keywords[:4]:
        try:
            payload = {
                "criteria": {
                    "advanced_text_search": {
                        "operator": "and",
                        "search_field": "all",
                        "search_text": keyword,
                    },
                    "fiscal_years": [2025, 2026],
                },
                "include_fields": [
                    "project_title", "abstract_text", "organization",
                    "award_notice_date", "award_amount", "agency_ic_admin",
                    "project_num", "principal_investigators", "project_detail_url",
                ],
                "offset": 0,
                "limit": _LIMIT,
                "sort_field": "award_amount",
                "sort_order": "desc",
            }
            resp = requests.post(_URL, json=payload, timeout=_TIMEOUT)
            resp.raise_for_status()

            for project in resp.json().get("results", []):
                pis = project.get("principal_investigators") or []
                pi = ", ".join(
                    f"{p.get('first_name','')} {p.get('last_name','')}".strip()
                    for p in pis[:2]
                )
                org = project.get("organization") or {}
                agency_obj = project.get("agency_ic_admin") or {}
                results.append({
                    "type": "grant",
                    "title": project.get("project_title", ""),
                    "abstract": (project.get("abstract_text") or "")[:600],
                    "organization": org.get("org_name", ""),
                    "agency": agency_obj.get("abbreviation", "") or agency_obj.get("code", ""),
                    "amount": project.get("award_amount"),
                    "date": str(project.get("award_notice_date", ""))[:10],
                    "project_num": project.get("project_num", ""),
                    "pi": pi,
                    "url": project.get("project_detail_url", ""),
                })
        except Exception as e:
            print(f"  [nih_reporter] warning: {keyword!r} — {e}")

    seen: set[str] = set()
    unique = []
    for r in results:
        key = r.get("project_num") or r.get("title")
        if key not in seen:
            seen.add(key)
            unique.append(r)

    unique.sort(key=lambda x: (x.get("amount") or 0), reverse=True)
    return unique[:30]
