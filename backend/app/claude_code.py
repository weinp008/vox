"""Integration with Claude Code CLI as the backend engine."""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field

from app.models import MobileMode, ResponseType


@dataclass
class ClaudeCodeSettings:
    """Settings passed through to the Claude Code CLI."""
    model: str = "sonnet"  # sonnet, opus, haiku
    effort: str = "low"  # low, medium, high, max
    allowed_tools: list[str] = field(default_factory=lambda: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"])
    plan_mode: bool = False
    mobile_mode: MobileMode = MobileMode.DIFF_ONLY


# Global settings — updated via /settings endpoint
current_settings = ClaudeCodeSettings()

# Live activity tracking per session
_activity: dict[str, list[str]] = {}


def get_activity(sonar_session_id: str) -> list[str]:
    return _activity.get(sonar_session_id, [])


def _add_activity(sid: str, line: str):
    if sid not in _activity:
        _activity[sid] = []
    _activity[sid].append(line)
    if len(_activity[sid]) > 30:
        _activity[sid] = _activity[sid][-30:]


def run_claude_code(
    prompt: str,
    cwd: str,
    session_id: str | None = None,
    settings: ClaudeCodeSettings | None = None,
    sonar_session_id: str | None = None,
) -> tuple[str, str | None, int]:
    """Run a prompt through Claude Code CLI with live activity tracking."""
    s = settings or current_settings
    sid = sonar_session_id or "unknown"
    _activity[sid] = ["Starting Claude Code..."]

    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--model", s.model,
        "--effort", s.effort,
        "--permission-mode", "plan" if s.plan_mode else "default",
    ]

    if s.allowed_tools:
        cmd.extend(["--allowedTools", ",".join(s.allowed_tools)])

    if session_id:
        cmd.extend(["--resume", session_id])

    timeout = 180 if s.effort in ("high", "max") else 90

    proc = subprocess.Popen(
        cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

    result_text = ""
    cc_session_id = session_id
    input_tokens = 0

    try:
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                etype = event.get("type", "")

                if etype == "assistant" and "message" in event:
                    msg = event["message"]
                    for block in msg.get("content", []):
                        if block.get("type") == "tool_use":
                            tool = block.get("name", "?")
                            inp = block.get("input", {})
                            if tool == "Read":
                                _add_activity(sid, f"Reading {inp.get('file_path', '?').split('/')[-1]}")
                            elif tool == "Edit":
                                _add_activity(sid, f"Editing {inp.get('file_path', '?').split('/')[-1]}")
                            elif tool == "Write":
                                _add_activity(sid, f"Writing {inp.get('file_path', '?').split('/')[-1]}")
                            elif tool == "Bash":
                                _add_activity(sid, f"$ {inp.get('command', '?')[:50]}")
                            elif tool == "Grep":
                                _add_activity(sid, f"Searching: {inp.get('pattern', '?')}")
                            elif tool == "Glob":
                                _add_activity(sid, f"Finding: {inp.get('pattern', '?')}")
                            else:
                                _add_activity(sid, f"Using {tool}")
                        elif block.get("type") == "thinking":
                            _add_activity(sid, "Thinking...")

                elif etype == "result":
                    result_text = event.get("result", "")
                    cc_session_id = event.get("session_id", session_id)
                    duration = event.get("duration_ms", 0)
                    usage = event.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    _add_activity(sid, f"Done ({duration / 1000:.1f}s)")

            except json.JSONDecodeError:
                continue

        proc.wait(timeout=timeout)

    except subprocess.TimeoutExpired:
        proc.kill()
        _add_activity(sid, "Timed out")
        return "Claude Code timed out.", cc_session_id, input_tokens

    if proc.returncode != 0 and not result_text:
        stderr = proc.stderr.read() if proc.stderr else ""
        _add_activity(sid, f"Error: {(stderr.strip() or 'unknown')[:80]}")
        return stderr.strip() or "Claude Code error", cc_session_id, input_tokens

    return result_text, cc_session_id, input_tokens


def run_compact(cwd: str, cc_session_id: str) -> tuple[str, str | None]:
    """Run /compact on the current Claude Code session to summarize context."""
    text, new_sid, _ = run_claude_code(
        "/compact",
        cwd,
        session_id=cc_session_id,
        sonar_session_id="compact",
    )
    return text, new_sid


def git_stash_pop(cwd: str) -> bool:
    try:
        r = subprocess.run(["git", "stash", "pop"], cwd=cwd, capture_output=True, text=True, timeout=10)
        return r.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def git_stash_drop(cwd: str) -> bool:
    try:
        r = subprocess.run(["git", "stash", "drop"], cwd=cwd, capture_output=True, text=True, timeout=10)
        return r.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


async def get_claude_code_response(
    session,
    user_text: str,
) -> tuple[str, ResponseType, list[str] | None, str | None]:
    """Send prompt to Claude Code CLI and parse the response."""
    import asyncio

    loop = asyncio.get_event_loop()
    response_text, new_cc_session, input_tokens = await loop.run_in_executor(
        None,
        run_claude_code,
        user_text,
        session.project_path,
        session.claude_code_session_id,
        current_settings,
        session.id,
    )

    session.claude_code_session_id = new_cc_session
    if input_tokens:
        session.context_tokens = input_tokens
    session.add_user_message(user_text)
    session.add_assistant_message(response_text)

    from app.llm import _parse_response
    response_type, options, diff = _parse_response(response_text)

    return response_text, response_type, options, diff
