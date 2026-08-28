from datetime import datetime, timedelta

CLAUDE_MODEL = "claude-opus-5"
SYNTHESIS_MAX_TOKENS = 8192

TOPICS = {
    "human_plus": {
        "label": "AI Workforce Transformation (Human+)",
        "short": "Human+",
        "color": "green",
        "keywords": [
            "AI workforce",
            "artificial intelligence workforce",
            "human AI collaboration",
            "AI augmentation healthcare workforce",
            "clinical AI tools staff",
            "AI nurse physician assistant",
            "workforce automation health",
            "AI clinical decision support workforce",
            "human plus AI health",
            "AI staffing shortage health",
        ],
        "news_queries": [
            "AI workforce transformation federal health",
            "human AI collaboration healthcare 2024 2025",
            "AI clinical workforce HHS VA",
            "healthcare AI staffing automation",
            "clinical AI tools nurses physicians",
        ],
        "nih_terms": [
            "artificial intelligence workforce",
            "AI clinical decision support",
            "machine learning health workforce",
            "AI augmented care",
        ],
    },
    "clinical_trials_ai": {
        "label": "AI-Native Clinical Trial Infrastructure",
        "short": "AI Clinical Trials",
        "color": "teal",
        "keywords": [
            "AI clinical trial",
            "machine learning clinical trial",
            "artificial intelligence trial design",
            "AI patient recruitment trial",
            "digital clinical trial",
            "decentralized clinical trial AI",
            "AI trial monitoring",
            "AI biomarker trial",
            "synthetic control arm",
            "AI drug development trial",
        ],
        "news_queries": [
            "AI clinical trial infrastructure federal",
            "AI patient recruitment clinical trials 2024 2025",
            "decentralized clinical trials AI investment",
            "machine learning drug trial NIH FDA",
            "AI synthetic control arm clinical research",
        ],
        "nih_terms": [
            "artificial intelligence clinical trial",
            "machine learning clinical trial",
            "digital clinical trial",
            "decentralized trial AI",
        ],
    },
}

# Agency definitions per data source
_AGENCY_MAP = {
    "HHS": {
        "usa_spending": {"type": "awarding", "tier": "toptier", "name": "Department of Health and Human Services"},
        "federal_register": [
            "health-and-human-services-department",
            "national-institutes-of-health",
            "centers-for-medicare-medicaid-services",
            "food-and-drug-administration",
            "centers-for-disease-control-and-prevention",
            "health-resources-services-administration",
        ],
        "nih_reporter": ["NIH", "CDC", "FDA", "HRSA", "AHRQ"],
    },
    "VA": {
        "usa_spending": {"type": "awarding", "tier": "toptier", "name": "Department of Veterans Affairs"},
        "federal_register": ["veterans-affairs-department"],
        "nih_reporter": [],
    },
    "DoD": {
        "usa_spending": {"type": "awarding", "tier": "toptier", "name": "Department of Defense"},
        "federal_register": ["defense-department"],
        "nih_reporter": [],
    },
}


def get_date_range(lookback_days: int = 90, start_date: str | None = None, end_date: str | None = None) -> tuple[str, str]:
    if start_date and end_date:
        return start_date, end_date
    end = datetime.today()
    start = end - timedelta(days=lookback_days)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def get_usa_spending_agencies(selected: list[str]) -> list[dict]:
    return [_AGENCY_MAP[a]["usa_spending"] for a in selected if a in _AGENCY_MAP]


def get_fed_register_agencies(selected: list[str]) -> list[str]:
    slugs = []
    for a in selected:
        if a in _AGENCY_MAP:
            slugs.extend(_AGENCY_MAP[a]["federal_register"])
    return list(dict.fromkeys(slugs))


def get_nih_orgs(selected: list[str]) -> list[str]:
    orgs = []
    for a in selected:
        if a in _AGENCY_MAP:
            orgs.extend(_AGENCY_MAP[a]["nih_reporter"])
    return list(dict.fromkeys(orgs))
