"""Integration with Claude Code CLI as the backend engine.

Instead of calling the Anthropic API directly, we shell out to `claude`
which gives us full Claude Code capabilities: file editing, bash, git, etc.
"""
from __future__ import annotations

import json
import subprocess

from app.models import ResponseType


def run_claude_code(
    prompt: str,
    cwd: str,
    session_id: str | None = None,
) -> tuple[str, str | None]:
    """Run a prompt through Claude Code CLI.

    Returns (response_text, claude_session_id).
    claude_session_id can be used with --resume for follow-ups.
    """
    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "json",
        "--permission-mode", "default",
    ]

    if session_id:
        cmd.extend(["--resume", session_id])

    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        error = result.stderr.strip() or "Claude Code returned an error"
        return error, session_id

    # Parse JSON output
    try:
        data = json.loads(result.stdout)
        response_text = data.get("result", result.stdout)
        new_session_id = data.get("session_id", session_id)
        return response_text, new_session_id
    except json.JSONDecodeError:
        # Fallback to raw text
        return result.stdout.strip(), session_id


async def get_claude_code_response(
    session,
    user_text: str,
) -> tuple[str, ResponseType, list[str] | None, str | None]:
    """Send prompt to Claude Code CLI and parse the response.

    Returns (response_text, response_type, options_list, pending_diff).
    """
    import asyncio

    # Run in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    response_text, new_cc_session = await loop.run_in_executor(
        None,
        run_claude_code,
        user_text,
        session.project_path,
        session.claude_code_session_id,
    )

    # Store the Claude Code session ID for resume
    session.claude_code_session_id = new_cc_session

    # Track in our conversation history too
    session.add_user_message(user_text)
    session.add_assistant_message(response_text)

    # Parse for our format markers (Claude Code won't use them naturally,
    # but we keep parsing in case the system prompt asks for them)
    from app.llm import _parse_response
    response_type, options, diff = _parse_response(response_text)

    return response_text, response_type, options, diff
