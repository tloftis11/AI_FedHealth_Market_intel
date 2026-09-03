from .usa_spending import fetch as fetch_contracts
from .fed_register import fetch as fetch_regulations
from .nih_reporter import fetch as fetch_grants
from .news_rss import fetch as fetch_news
from .clinical_trials import fetch as fetch_trials
from .sam_gov import fetch as fetch_opportunities

__all__ = [
    "fetch_contracts",
    "fetch_regulations",
    "fetch_grants",
    "fetch_news",
    "fetch_trials",
    "fetch_opportunities",
]
