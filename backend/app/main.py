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
)
from app.synthesizer import synthesize, build_chat_system_prompt
from app.html_formatter import format_briefing, wrap_briefing

app = FastAPI(title="FH AI Market Intelligence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for chat context
_sessions: dict[str, dict] = {}


# ── Request models ──────────────────────────────────────────────────────────

class FilterParams(BaseModel):
    topics: list[str] = ["human_plus", "clinical_trials_ai"]
    lookback_days: int = 90
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    agencies: list[str] = ["HHS", "VA", "DoD"]
    sources: list[str] = ["usa_spending", "fed_register", "nih", "news", "clinical_trials"]
    user_context: str = ""


class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    user_context: str = ""


# ── Helpers ─────────────────────────────────────────────────────────────────

def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _collect_topic(topic_key: str, start_date: str, end_date: str, req: FilterParams) -> list[dict]:
    if topic_key not in TOPICS:
        return []
    topic = TOPICS[topic_key]
    tasks = []
    labels = []

    usa_agencies = get_usa_spending_agencies(req.agencies)
    fed_slugs = get_fed_register_agencies(req.agencies)
    nih_orgs = get_nih_orgs(req.agencies)

    if "usa_spending" in req.sources and usa_agencies:
        tasks.append(asyncio.to_thread(fetch_contracts, topic["keywords"], start_date, end_date, usa_agencies))
        labels.append("contracts")
    if "fed_register" in req.sources:
        tasks.append(asyncio.to_thread(fetch_regulations, topic["keywords"], start_date, end_date, fed_slugs))
        labels.append("regulations")
    if "nih" in req.sources:
        tasks.append(asyncio.to_thread(fetch_grants, topic["nih_terms"], start_date, end_date, nih_orgs))
        labels.append("grants")
    if "news" in req.sources:
        tasks.append(asyncio.to_thread(fetch_news, topic["news_queries"], start_date, end_date))
        labels.append("news")
    if "clinical_trials" in req.sources:
        tasks.append(asyncio.to_thread(fetch_trials, topic["keywords"], start_date, end_date))
        labels.append("trials")

    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_data = []
    for label, result in zip(labels, results):
        if isinstance(result, Exception):
            print(f"  [{topic_key}] {label} error: {result}")
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
    if not valid_topics:
        raise HTTPException(status_code=400, detail="No valid topics selected")

    async def stream():
        topic_sections = []
        topics_covered = []

        for topic_key in valid_topics:
            topic = TOPICS[topic_key]
            yield _sse({"type": "progress", "message": f"Collecting data for {topic['short']}..."})
            all_data = await _collect_topic(topic_key, start_date, end_date, req)

            yield _sse({
                "type": "progress",
                "message": f"Collected {len(all_data)} items for {topic['short']}. Synthesizing with Claude..."
            })

            try:
                synthesis = await asyncio.to_thread(
                    synthesize, topic["label"], all_data, start_date, end_date, req.user_context
                )
                section_html = format_briefing(topic_key, topic, synthesis, start_date, end_date)
                topic_sections.append(section_html)
                topics_covered.append(topic["label"])
                yield _sse({"type": "progress", "message": f"{topic['short']} complete."})
            except Exception as e:
                yield _sse({"type": "error", "message": f"Synthesis failed for {topic['short']}: {e}"})
                return

        html = wrap_briefing(topic_sections, topics_covered, start_date, end_date)
        yield _sse({"type": "result", "html": html})
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
        counts: dict[str, int] = {}

        for topic_key in valid_topics:
            topic = TOPICS[topic_key]
            yield _sse({"type": "progress", "message": f"Collecting data for {topic['short']}..."})
            topic_data = await _collect_topic(topic_key, start_date, end_date, req)
            all_data.extend(topic_data)
            counts[topic["short"]] = len(topic_data)

        session_id = str(uuid.uuid4())
        _sessions[session_id] = {
            "data": all_data,
            "topics": valid_topics,
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

    system_prompt = build_chat_system_prompt(
        session["data"], session["topics"],
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
