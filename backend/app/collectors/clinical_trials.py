"""ClinicalTrials.gov API v2 — trial registrations and status (no API key required)."""
import requests

_URL = "https://clinicaltrials.gov/api/v2/studies"
_TIMEOUT = 30
_PAGE_SIZE = 20


def fetch(keywords: list[str], start_date: str, end_date: str, **kwargs) -> list[dict]:
    results = []

    for keyword in keywords[:4]:
        try:
            params = {
                "query.term": keyword,
                "filter.advanced": f"AREA[StartDate]RANGE[{start_date}, MAX]",
                "fields": "NCTId,BriefTitle,BriefSummary,LeadSponsorName,StartDate,OverallStatus,Phase,StudyType",
                "pageSize": _PAGE_SIZE,
                "sort": "@relevance",
                "format": "json",
            }
            resp = requests.get(_URL, params=params, timeout=_TIMEOUT)
            resp.raise_for_status()

            for study in resp.json().get("studies", []):
                ps = study.get("protocolSection", {})
                id_mod = ps.get("identificationModule", {})
                desc_mod = ps.get("descriptionModule", {})
                status_mod = ps.get("statusModule", {})
                sponsor_mod = ps.get("sponsorCollaboratorsModule", {})
                design_mod = ps.get("designModule", {})
                results.append({
                    "type": "clinical_trial",
                    "nct_id": id_mod.get("nctId", ""),
                    "title": id_mod.get("briefTitle", ""),
                    "summary": (desc_mod.get("briefSummary") or "")[:500],
                    "sponsor": sponsor_mod.get("leadSponsor", {}).get("name", ""),
                    "start_date": status_mod.get("startDateStruct", {}).get("date", ""),
                    "status": status_mod.get("overallStatus", ""),
                    "phase": ", ".join(design_mod.get("phases", [])),
                    "study_type": design_mod.get("studyType", ""),
                })
        except Exception as e:
            print(f"  [clinical_trials] warning: {keyword!r} — {e}")

    seen: set[str] = set()
    unique = []
    for r in results:
        key = r.get("nct_id") or r.get("title")
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique
