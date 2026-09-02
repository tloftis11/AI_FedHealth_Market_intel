"""Claude API synthesis — converts raw collected data into structured market intelligence."""
import json
import os
import re
import anthropic
from app.config import CLAUDE_MODEL, SYNTHESIS_MAX_TOKENS


def _format_items(items: list[dict], item_type: str, max_items: int = 15) -> str:
    filtered = [i for i in items if i.get("type") == item_type][:max_items]
    if not filtered:
        return "  None found in this period."
    lines = []
    for item in filtered:
        if item_type == "contract":
            amount = f"${item['amount']:,.0f}" if item.get("amount") else "amount unknown"
            lines.append(f"  - {item.get('organization', 'Unknown')} | {amount} | {item.get('agency', '')} | {item.get('date', '')} | {item.get('title', '')[:120]}")
        elif item_type == "grant":
            amount = f"${item['amount']:,.0f}" if item.get("amount") else "amount unknown"
            lines.append(f"  - {item.get('organization', '')} | {amount} | {item.get('agency', '')} | {item.get('date', '')} | {item.get('title', '')[:120]}")
        elif item_type == "regulation":
            lines.append(f"  - [{item.get('doc_type', '')}] {item.get('agency', '')} | {item.get('date', '')} | {item.get('title', '')[:150]}")
        elif item_type == "news":
            lines.append(f"  - [{item.get('source', '')}] {item.get('date', '')} | {item.get('title', '')[:150]}")
        elif item_type == "clinical_trial":
            lines.append(f"  - {item.get('nct_id', '')} | {item.get('sponsor', '')} | {item.get('status', '')} | {item.get('phase', '')} | {item.get('title', '')[:120]}")
    return "\n".join(lines)


def _build_briefing_prompt(topic_label: str, all_data: list[dict], start_date: str, end_date: str, user_context: str) -> str:
    contracts = _format_items(all_data, "contract")
    grants = _format_items(all_data, "grant")
    regulations = _format_items(all_data, "regulation")
    news = _format_items(all_data, "news")
    trials = _format_items(all_data, "clinical_trial")

    context_section = f"\nADDITIONAL ANALYST CONTEXT:\n{user_context}\n" if user_context.strip() else ""

    return f"""You are a senior federal health market intelligence analyst. Synthesize the raw data below into a tight, leadership-ready market brief section.

MARKET TOPIC: {topic_label}
REPORT PERIOD: {start_date} to {end_date}
FEDERAL AGENCIES COVERED: HHS and all operating divisions (NIH, CMS, CDC, FDA, HRSA, SAMHSA, AHRQ, IHS), Department of Veterans Affairs
AUDIENCE: Federal health practice leadership (managing directors, principals)
{context_section}
---
RAW DATA COLLECTED:

FEDERAL CONTRACTS AWARDED:
{contracts}

NIH/FEDERAL GRANTS:
{grants}

FEDERAL REGISTER NOTICES & RULES:
{regulations}

NEWS & MARKET SIGNALS:
{news}

CLINICAL TRIALS REGISTERED:
{trials}
---

INSTRUCTIONS:
- Every bullet must be exactly 1 sentence. No exceptions.
- Cite specific orgs, dollar amounts, and dates wherever data supports it.
- Do NOT repeat raw data — synthesize and interpret it.
- policy_updates must cover actual regulatory notices, proposed rules, RFIs, or official guidance documents — distinct from market signals.
- emerging_relationships must name specific companies with specific signals (dollar amounts, deal type, strategic implication).
- signal field in emerging_relationships must be exactly one of: Capital Raise, M&A, Partnership, Growth.
- Adhere strictly to the item limits below — this is a 2-page document.

Respond with ONLY a valid JSON object (no markdown fences, no commentary) in this exact structure:
{{
  "bluf": "<2-3 sentence bottom line — most important signal and strategic implication>",
  "market_signals": ["<1 sentence>", "<1 sentence>", "<1 sentence>"],
  "policy_updates": ["<1 sentence citing specific rule/notice/guidance>", "<1 sentence>", "<1 sentence>"],
  "federal_actions": [
    {{"org": "<awardee or issuing org>", "amount": "<$XX.XM or RFI or Notice>", "agency": "<agency abbrev>", "date": "<Mon YYYY>", "description": "<purpose, max 10 words>"}},
    {{"org": "...", "amount": "...", "agency": "...", "date": "...", "description": "..."}}
  ],
  "investment_activity": ["<company + amount/deal + significance, 1 sentence>", "<1 sentence>", "<1 sentence>"],
  "emerging_relationships": [
    {{"company": "<name>", "signal": "<Capital Raise|M&A|Partnership|Growth>", "detail": "<1 sentence with key facts and strategic implication>"}},
    {{"company": "...", "signal": "...", "detail": "..."}}
  ],
  "trajectory": "<2 sentences — forward look and strategic opportunity>"
}}"""


def _parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {
        "bluf": "", "market_signals": [text[:500]],
        "policy_updates": [], "federal_actions": [],
        "investment_activity": [], "emerging_relationships": [], "trajectory": "",
    }


def synthesize(topic_label: str, all_data: list[dict], start_date: str, end_date: str, user_context: str = "") -> dict:
    prompt = _build_briefing_prompt(topic_label, all_data, start_date, end_date, user_context)
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=SYNTHESIS_MAX_TOKENS,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        message = stream.get_final_message()

    text = ""
    for block in message.content:
        if block.type == "text":
            text = block.text
            break

    return _parse_json(text)


def build_chat_system_prompt(all_data: list[dict], topic_labels: list[str], start_date: str, end_date: str, user_context: str = "") -> str:
    contracts = _format_items(all_data, "contract", max_items=20)
    grants = _format_items(all_data, "grant", max_items=20)
    regulations = _format_items(all_data, "regulation", max_items=20)
    news = _format_items(all_data, "news", max_items=30)
    trials = _format_items(all_data, "clinical_trial", max_items=15)

    context_section = f"\nADDITIONAL CONTEXT PROVIDED BY ANALYST:\n{user_context}\n" if user_context.strip() else ""
    topics_str = ", ".join(topic_labels) if topic_labels else "Federal health AI"

    return f"""You are a senior federal health market intelligence analyst with deep expertise in AI adoption across federal health agencies.

You have access to freshly collected market data for the following topics: {topics_str}
Report period: {start_date} to {end_date}
Agencies covered: HHS and all operating divisions (NIH, CMS, CDC, FDA, HRSA, SAMHSA, AHRQ, IHS), VA
{context_section}
---
COLLECTED MARKET DATA:

FEDERAL CONTRACTS:
{contracts}

NIH/FEDERAL GRANTS:
{grants}

FEDERAL REGISTER NOTICES & RULES:
{regulations}

NEWS & MARKET SIGNALS:
{news}

CLINICAL TRIALS:
{trials}
---

Answer questions about this space with specific citations from the data above wherever possible. Be direct and analytical.

If asked to generate or regenerate a briefing, return it as clean markdown with the following sections:
## BLUF
## Market Signals
## Policy & Regulatory Updates
## Federal Contracting & Funding Actions
## Private Investment & Activity
## Emerging Relationships
## Trajectory & Outlook"""
