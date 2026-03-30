from __future__ import annotations

import anthropic

from app.config import settings
from app.models import ResponseType
from app.session import Session

SYSTEM_PROMPT = """\
You are Sonar, a voice-driven coding assistant. Be terse. Output is read via TTS.

Rules:
- Be direct. No pleasantries, no filler, no "I can help with that".
- Max 3 sentences for freeform responses.
- When presenting choices, use OPTIONS_START/OPTIONS_END markers with max 4 numbered items. Nothing before or after the markers except a single-line summary.
- When proposing code changes, use CONFIRM_START/CONFIRM_END markers containing the diff. Precede with a one-line description only.
- Never read code aloud. Describe what changes, not the syntax.
- Respond like a CLI tool, not a chatbot.

Example option response:
Add a health check endpoint.
OPTIONS_START
1. Simple /health returning ok
2. /health with uptime and dependency checks
3. /health with version info from git
OPTIONS_END

Example confirm response:
Adding GET /health endpoint to main.py.
CONFIRM_START
@app.get("/health")
async def health():
    return {{"status": "ok"}}
CONFIRM_END

Project: {project_name}
Files: {file_list}
Commits: {git_summary}
"""


async def get_claude_response(session: Session, user_text: str) -> tuple[str, ResponseType, list[str] | None, str | None]:
    """Send conversation to Claude and parse the response."""
    system = SYSTEM_PROMPT.format(
        project_name=session.project_name,
        file_list=", ".join(session.files[:30]) if session.files else "(none)",
        git_summary="; ".join(session.recent_commits) if session.recent_commits else "(none)",
    )

    session.add_user_message(user_text)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=system,
        messages=session.conversation,
    )

    response_text = message.content[0].text
    session.add_assistant_message(response_text)

    response_type, options, diff = _parse_response(response_text)
    return response_text, response_type, options, diff


def _parse_response(text: str) -> tuple[ResponseType, list[str] | None, str | None]:
    """Detect response type from format markers."""
    if "OPTIONS_START" in text and "OPTIONS_END" in text:
        block = text.split("OPTIONS_START")[1].split("OPTIONS_END")[0].strip()
        options = []
        for line in block.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                cleaned = line.lstrip("0123456789.-) ").strip()
                if cleaned:
                    options.append(cleaned)
        return ResponseType.OPTIONS, options, None

    if "CONFIRM_START" in text and "CONFIRM_END" in text:
        diff = text.split("CONFIRM_START")[1].split("CONFIRM_END")[0].strip()
        return ResponseType.CONFIRMATION, None, diff

    return ResponseType.FREEFORM, None, None
