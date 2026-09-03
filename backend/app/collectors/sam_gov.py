"""SAM.gov Opportunities API — federal solicitations and award notices.

Requires SAM_GOV_API_KEY env var (free: beta.sam.gov → User Account → Public API Key).
"""
import os
import requests
from datetime import datetime

_BASE_URL = "https://api.sam.gov/opportunities/v2/search"
_TIMEOUT = 30
_LIMIT = 25

_DEPT_MAP = {
    "HHS": "HEALTH AND HUMAN SERVICES, DEPARTMENT OF",
    "VA": "VETERANS AFFAIRS, DEPARTMENT OF",
}


def _to_sam_date(iso: str) -> str:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%m/%d/%Y")
    except ValueError:
        return iso


def _search(keyword: str, start_date: str, end_date: str, dept: str, api_key: str) -> list[dict]:
    try:
        params = {
            "api_key": api_key,
            "q": keyword,
            "postedFrom": _to_sam_date(start_date),
            "postedTo": _to_sam_date(end_date),
            "deptname": dept,
            "limit": _LIMIT,
            "offset": 0,
        }
        resp = requests.get(_BASE_URL, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("opportunitiesData", [])
    except Exception as e:
        print(f"  [sam_gov] warning: {keyword!r} {dept!r} — {e}")
        return []


def fetch(keywords: list[str], start_date: str, end_date: str, agencies: list[str]) -> list[dict]:
    api_key = os.environ.get("SAM_GOV_API_KEY", "")
    if not api_key:
        return []

    dept_names = [_DEPT_MAP[a] for a in agencies if a in _DEPT_MAP]
    if not dept_names:
        return []

    results = []
    seen: set[str] = set()

    for term in keywords[:4]:
        for dept in dept_names:
            for opp in _search(term, start_date, end_date, dept, api_key):
                uid = opp.get("noticeId") or opp.get("solicitationNumber") or opp.get("title", "")[:60]
                if uid in seen:
                    continue
                seen.add(uid)

                award = opp.get("award") or {}
                award_amount = award.get("amount")
                awardee = (award.get("awardee") or {}).get("name", "")

                org_hier = opp.get("organizationHierarchy") or {}
                agency_label = org_hier.get("subTierName") or org_hier.get("departmentName") or ""

                results.append({
                    "type": "opportunity",
                    "title": opp.get("title", "Federal Opportunity"),
                    "notice_type": opp.get("type", ""),
                    "solicitation_number": opp.get("solicitationNumber", ""),
                    "agency": agency_label,
                    "posted_date": opp.get("postedDate", ""),
                    "response_deadline": opp.get("responseDeadLine") or "",
                    "award_amount": award_amount,
                    "awardee": awardee,
                })

    # Award notices (with amounts) first, then newest by posted date
    results.sort(key=lambda x: (
        0 if x.get("award_amount") else 1,
        -(int(x["posted_date"].replace("-", "")) if x.get("posted_date", "")[:4].isdigit() else 0),
    ))
    return results[:30]
