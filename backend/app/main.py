import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from app.config import (
    TOPICS, get_date_range,
    get_usa_spending_agencies, get_fed_register_agencies, get_nih_orgs,
)
from app.collectors import (
    fetch_contracts, fetch_regulations, fetch_grants, fetch_news, fetch_trials,
    fetch_opportunities,
)
from app.synthesizer import synthesize, build_chat_system_prompt
from app.html_formatter import format_briefing, wrap_briefing
from app.topic_expander import expand_topic

app = FastAPI(title="FH AI Market Intelligence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for chat context
_sessions: dict[str, dict] = {}

# Hardcoded to HHS (all divisions) + VA
_AGENCIES = ["HHS", "VA"]


# ── Request models ──────────────────────────────────────────────────────────

class CustomTopicRequest(BaseModel):
    description: str


class FilterParams(BaseModel):
    topics: list[str] = ["human_plus", "clinical_trials_ai"]
    custom_topics: list[CustomTopicRequest] = []
    lookback_days: int = 90
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    sources: list[str] = ["usa_spending", "fed_register", "nih", "news", "clinical_trials"]
    user_context: str = ""


class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    user_context: str = ""


# ── Helpers ─────────────────────────────────────────────────────────────────

def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _collect_for_topic_cfg(topic_cfg: dict, start_date: str, end_date: str, sources: list[str]) -> list[dict]:
    usa_agencies = get_usa_spending_agencies(_AGENCIES)
    fed_slugs = get_fed_register_agencies(_AGENCIES)
    nih_orgs = get_nih_orgs(_AGENCIES)

    tasks = []
    labels = []
    if "usa_spending" in sources and usa_agencies:
        tasks.append(asyncio.to_thread(fetch_contracts, topic_cfg["keywords"], start_date, end_date, usa_agencies))
        labels.append("contracts")
    if "fed_register" in sources:
        tasks.append(asyncio.to_thread(fetch_regulations, topic_cfg["keywords"], start_date, end_date, fed_slugs))
        labels.append("regulations")
    if "nih" in sources:
        tasks.append(asyncio.to_thread(fetch_grants, topic_cfg.get("nih_terms", topic_cfg["keywords"]), start_date, end_date, nih_orgs))
        labels.append("grants")
    if "news" in sources:
        tasks.append(asyncio.to_thread(fetch_news, topic_cfg["news_queries"], start_date, end_date))
        labels.append("news")
    if "clinical_trials" in sources:
        tasks.append(asyncio.to_thread(fetch_trials, topic_cfg["keywords"], start_date, end_date))
        labels.append("trials")
    if "sam_gov" in sources:
        tasks.append(asyncio.to_thread(fetch_opportunities, topic_cfg["keywords"], start_date, end_date, _AGENCIES))
        labels.append("opportunities")

    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_data = []
    for label, result in zip(labels, results):
        if isinstance(result, Exception):
            print(f"  [{topic_cfg.get('short', '?')}] {label} error: {result}")
        else:
            all_data.extend(result)
    return all_data


# ── Routes ───────────────────────────────────────────────────────────────────

@app.post("/api/generate")
async def generate(req: FilterParams):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    start_date, end_date = get_date_range(req.lookback_days, req.start_date, req.end_date)
    valid_topics = [t for t in req.topics if t in TOPICS]

    if not valid_topics and not req.custom_topics:
        raise HTTPException(status_code=400, detail="No valid topics selected")

    async def stream():
        topic_sections = []
        topics_covered = []
        briefing_topics = []  # store per-topic data for later refinement

        # Preset topics
        for topic_key in valid_topics:
            topic = TOPICS[topic_key]
            yield _sse({"type": "progress", "message": f"Collecting data for {topic['short']}..."})
            all_data = await _collect_for_topic_cfg(topic, start_date, end_date, req.sources)
            yield _sse({"type": "progress", "message": f"Collected {len(all_data)} items for {topic['short']}. Synthesizing with Claude..."})
            try:
                synthesis = await asyncio.to_thread(
                    synthesize, topic["label"], all_data, start_date, end_date, req.user_context
                )
                topic_sections.append(format_briefing(topic_key, topic, synthesis, start_date, end_date))
                topics_covered.append(topic["label"])
                briefing_topics.append({"key": topic_key, "cfg": topic, "data": all_data})
                yield _sse({"type": "progress", "message": f"{topic['short']} complete."})
            except Exception as e:
                yield _sse({"type": "error", "message": f"Synthesis failed for {topic['short']}: {e}"})
                return

        # Custom topics
        for i, ct in enumerate(req.custom_topics):
            short_desc = ct.description[:55] + "…" if len(ct.description) > 55 else ct.description
            yield _sse({"type": "progress", "message": f"Expanding topic: {short_desc}"})
            try:
                topic_cfg = await asyncio.to_thread(expand_topic, ct.description)
            except Exception as e:
                yield _sse({"type": "error", "message": f"Failed to expand custom topic: {e}"})
                return

            yield _sse({"type": "progress", "message": f"Collecting data for {topic_cfg['short']}..."})
            all_data = await _collect_for_topic_cfg(topic_cfg, start_date, end_date, req.sources)

            yield _sse({"type": "progress", "message": f"Collected {len(all_data)} items. Synthesizing {topic_cfg['short']}..."})
            try:
                synthesis = await asyncio.to_thread(
                    synthesize, topic_cfg["label"], all_data, start_date, end_date, req.user_context
                )
                topic_sections.append(format_briefing(f"custom_{i}", topic_cfg, synthesis, start_date, end_date))
                topics_covered.append(topic_cfg["label"])
                briefing_topics.append({"key": f"custom_{i}", "cfg": topic_cfg, "data": all_data})
                yield _sse({"type": "progress", "message": f"{topic_cfg['short']} complete."})
            except Exception as e:
                yield _sse({"type": "error", "message": f"Synthesis failed for {topic_cfg['short']}: {e}"})
                return

        # Store session so the briefing can be refined without re-collecting
        session_id = str(uuid.uuid4())
        _sessions[session_id] = {
            "briefing_topics": briefing_topics,
            "start_date": start_date,
            "end_date": end_date,
            "user_context": req.user_context,
            "feedback_history": [],
        }

        html = wrap_briefing(topic_sections, topics_covered, start_date, end_date)
        yield _sse({"type": "result", "html": html, "session_id": session_id})
        yield _sse({"type": "done"})

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class RefineRequest(BaseModel):
    session_id: str
    feedback: str


@app.post("/api/refine")
async def refine_briefing(req: RefineRequest):
    """Re-synthesize a briefing with new feedback — no re-collection needed."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    session = _sessions.get(req.session_id)
    if not session or "briefing_topics" not in session:
        raise HTTPException(status_code=404, detail="Session not found — regenerate the briefing first")

    start_date = session["start_date"]
    end_date = session["end_date"]

    # Build accumulated context: original + all prior feedback + new feedback
    history = session.get("feedback_history", [])
    base_context = session.get("user_context", "")
    accumulated = base_context
    if history:
        accumulated += "\n\nPREVIOUS REFINEMENTS APPLIED:\n" + "\n".join(f"- {f}" for f in history)
    accumulated += f"\n\nREFINEMENT REQUEST:\n{req.feedback}"

    async def stream():
        topic_sections = []
        topics_covered = []

        for entry in session["briefing_topics"]:
            cfg = entry["cfg"]
            short = cfg.get("short", cfg.get("label", "Topic"))
            yield _sse({"type": "progress", "message": f"Redrafting {short} with your feedback..."})
            try:
                synthesis = await asyncio.to_thread(
                    synthesize, cfg["label"], entry["data"], start_date, end_date, accumulated
                )
                topic_sections.append(format_briefing(entry["key"], cfg, synthesis, start_date, end_date))
                topics_covered.append(cfg["label"])
                yield _sse({"type": "progress", "message": f"{short} complete."})
            except Exception as e:
                yield _sse({"type": "error", "message": f"Redraft failed for {short}: {e}"})
                return

        session["feedback_history"] = history + [req.feedback]

        html = wrap_briefing(topic_sections, topics_covered, start_date, end_date)
        yield _sse({"type": "result", "html": html, "session_id": req.session_id})
        yield _sse({"type": "done"})

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/collect")
async def collect(req: FilterParams):
    """Collect data and store in session for chat use."""
    start_date, end_date = get_date_range(req.lookback_days, req.start_date, req.end_date)
    valid_topics = [t for t in req.topics if t in TOPICS]

    async def stream():
        all_data = []
        topic_labels = []
        counts: dict[str, int] = {}

        for topic_key in valid_topics:
            topic = TOPICS[topic_key]
            yield _sse({"type": "progress", "message": f"Collecting data for {topic['short']}..."})
            topic_data = await _collect_for_topic_cfg(topic, start_date, end_date, req.sources)
            all_data.extend(topic_data)
            topic_labels.append(topic["label"])
            counts[topic["short"]] = len(topic_data)

        for ct in req.custom_topics:
            short_desc = ct.description[:40] + "…" if len(ct.description) > 40 else ct.description
            yield _sse({"type": "progress", "message": f"Expanding and collecting: {short_desc}"})
            try:
                topic_cfg = await asyncio.to_thread(expand_topic, ct.description)
                topic_data = await _collect_for_topic_cfg(topic_cfg, start_date, end_date, req.sources)
                all_data.extend(topic_data)
                topic_labels.append(topic_cfg["label"])
                counts[topic_cfg["short"]] = len(topic_data)
            except Exception as e:
                print(f"Custom topic expansion error: {e}")

        session_id = str(uuid.uuid4())
        _sessions[session_id] = {
            "data": all_data,
            "topic_labels": topic_labels,
            "start_date": start_date,
            "end_date": end_date,
            "user_context": req.user_context,
            "created_at": datetime.utcnow().isoformat(),
        }

        summary = ", ".join(f"{k}: {v} items" for k, v in counts.items())
        yield _sse({
            "type": "ready",
            "session_id": session_id,
            "summary": f"Loaded {len(all_data)} total items — {summary}",
            "counts": counts,
            "start_date": start_date,
            "end_date": end_date,
        })
        yield _sse({"type": "done"})

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found — please reload market context")

    import anthropic as anthropic_sdk
    from app.config import CLAUDE_MODEL

    # Support both old sessions (topic keys) and new sessions (topic labels)
    topic_labels = session.get("topic_labels")
    if topic_labels is None:
        topic_labels = [TOPICS[t]["label"] for t in session.get("topics", []) if t in TOPICS]

    system_prompt = build_chat_system_prompt(
        session["data"], topic_labels,
        session["start_date"], session["end_date"],
        req.user_context or session.get("user_context", ""),
    )

    messages = req.messages

    async def stream():
        client = anthropic_sdk.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        async with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        ) as s:
            async for text in s.text_stream:
                yield _sse({"type": "chunk", "text": text})
        yield _sse({"type": "done"})

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/health")
async def health():
    return {"status": "ok", "api_key_set": bool(os.environ.get("ANTHROPIC_API_KEY"))}


# ── Serve React build in production ─────────────────────────────────────────

_static = Path(__file__).parent.parent.parent / "frontend" / "dist"
if _static.exists():
    app.mount("/assets", StaticFiles(directory=str(_static / "assets")), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        return FileResponse(str(_static / "index.html"))
