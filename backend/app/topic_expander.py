"""Expand a free-text topic description into structured search terms via Claude Haiku."""
import json
import os
import anthropic

_PROMPT = """You are a federal health market intelligence specialist.

Given a research topic, generate precise search terms for federal data sources
(USASpending.gov, Federal Register, NIH Reporter, Google News, ClinicalTrials.gov).

Topic: {topic}

Return ONLY a valid JSON object — no markdown fences, no commentary:
{{
  "label": "Professional 4-7 word topic label for report headers",
  "short": "2-3 word abbreviated label",
  "color": "teal",
  "keywords": ["term1", "term2", "term3", "term4", "term5", "term6"],
  "news_queries": ["query1", "query2", "query3"],
  "nih_terms": ["term1", "term2", "term3"]
}}

Guidelines:
- keywords: 6-10 specific terms for contract/grant/trial searches (mix broad and specific)
- news_queries: 3-5 Google News queries focused on federal health angles
- nih_terms: 3-5 NIH Reporter search terms (academic/grant language)
- Focus on federal procurement, policy, and clinical research"""


def expand_topic(description: str) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": _PROMPT.format(topic=description)}],
    )
    text = msg.content[0].text.strip()
    if "```" in text:
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else parts[0]
        if text.startswith("json"):
            text = text[4:].strip()
    return json.loads(text)
