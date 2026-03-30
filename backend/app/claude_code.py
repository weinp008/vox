"""Integration with Claude Code CLI as the backend engine."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field

from app.models import ResponseType


@dataclass
class ClaudeCodeSettings:
    """Settings passed through to the Claude Code CLI."""
    model: str = "sonnet"  # sonnet, opus, haiku
    effort: str = "low"  # low, medium, high, max
    max_turns: int = 3  # Limit tool-use turns for speed
    allowed_tools: list[str] = field(default_factory=lambda: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"])


# Global settings — updated via /settings endpoint
current_settings = ClaudeCodeSettings()


def run_claude_code(
    prompt: str,
    cwd: str,
    session_id: str | None = None,
    settings: ClaudeCodeSettings | None = None,
) -> tuple[str, str | None]:
    """Run a prompt through Claude Code CLI.

    Returns (response_text, claude_session_id).
    """
    s = settings or current_settings

    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "json",
        "--model", s.model,
        "--effort", s.effort,
        "--permission-mode", "default",
    ]

    if s.allowed_tools:
        cmd.extend(["--allowedTools", ",".join(s.allowed_tools)])

    if session_id:
        cmd.extend(["--resume", session_id])

    timeout = 180 if s.effort in ("high", "max") else 90

    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    if result.returncode != 0:
        error = result.stderr.strip() or "Claude Code returned an error"
        return error, session_id

    try:
        data = json.loads(result.stdout)
        response_text = data.get("result", result.stdout)
        new_session_id = data.get("session_id", session_id)
        return response_text, new_session_id
    except json.JSONDecodeError:
        return result.stdout.strip(), session_id


async def get_claude_code_response(
    session,
    user_text: str,
) -> tuple[str, ResponseType, list[str] | None, str | None]:
    """Send prompt to Claude Code CLI and parse the response."""
    import asyncio

    loop = asyncio.get_event_loop()
    response_text, new_cc_session = await loop.run_in_executor(
        None,
        run_claude_code,
        user_text,
        session.project_path,
        session.claude_code_session_id,
        current_settings,
    )

    session.claude_code_session_id = new_cc_session
    session.add_user_message(user_text)
    session.add_assistant_message(response_text)

    from app.llm import _parse_response
    response_type, options, diff = _parse_response(response_text)

    return response_text, response_type, options, diff
