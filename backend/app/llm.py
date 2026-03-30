from __future__ import annotations

import anthropic

from app.config import settings
from app.models import ResponseType
from app.session import Session

SYSTEM_PROMPT = """\
You are Sonar, an audio-first coding assistant. Your responses will be read aloud via text-to-speech, so optimize for listening.

CRITICAL RULES:
1. Present options as numbered lists (max 4 options)
2. Keep responses under 200 words for TTS readability
3. Always confirm file modifications before executing — present the diff first
4. Use these format markers on their own line:
   - OPTIONS_START / OPTIONS_END — wrap numbered option lists
   - CONFIRM_START / CONFIRM_END — wrap confirmation requests (include the diff)
   - No markers needed for freeform responses

5. When presenting code changes, describe them conversationally (don't read raw code).
   Include the actual diff inside CONFIRM markers for the system to capture.
6. End option lists with: "Say a number to choose, or speak to discuss."
7. End confirmations with: "Say send to apply, or speak to discuss."

Current project: {project_name}
Files in context: {file_list}
Recent commits: {git_summary}
"""


async def get_claude_response(session: Session, user_text: str) -> tuple[str, ResponseType, list[str] | None, str | None]:
    """Send conversation to Claude and parse the response.

    Returns (response_text, response_type, options_list, pending_diff).
    """
    system = SYSTEM_PROMPT.format(
        project_name=session.project_name,
        file_list=", ".join(session.files[:30]) if session.files else "(no files loaded)",
        git_summary="; ".join(session.recent_commits) if session.recent_commits else "(no commits)",
    )

    session.add_user_message(user_text)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system,
        messages=session.conversation,
    )

    response_text = message.content[0].text
    session.add_assistant_message(response_text)

    # Parse response type
    response_type, options, diff = _parse_response(response_text)

    return response_text, response_type, options, diff


def _parse_response(text: str) -> tuple[ResponseType, list[str] | None, str | None]:
    """Detect response type from format markers."""
    options: list[str] | None = None
    diff: str | None = None

    if "OPTIONS_START" in text and "OPTIONS_END" in text:
        block = text.split("OPTIONS_START")[1].split("OPTIONS_END")[0].strip()
        options = []
        for line in block.split("\n"):
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                # Strip leading "1. " or "1) " or "- "
                cleaned = line.lstrip("0123456789.-) ").strip()
                if cleaned:
                    options.append(cleaned)
        return ResponseType.OPTIONS, options, None

    if "CONFIRM_START" in text and "CONFIRM_END" in text:
        diff = text.split("CONFIRM_START")[1].split("CONFIRM_END")[0].strip()
        return ResponseType.CONFIRMATION, None, diff

    return ResponseType.FREEFORM, None, None
