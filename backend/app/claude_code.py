"""Integration with Claude Code CLI as the backend engine."""
from __future__ import annotations

import asyncio
import json
import subprocess
import time as _time
from dataclasses import dataclass, field
from typing import AsyncGenerator

from app.models import MobileMode, ResponseType


@dataclass
class ClaudeCodeSettings:
    """Settings passed through to the Claude Code CLI."""
    model: str = "sonnet"  # sonnet, opus, haiku
    effort: str = "low"  # low, medium, high, max
    allowed_tools: list[str] = field(default_factory=lambda: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"])
    plan_mode: bool = False
    mobile_mode: MobileMode = MobileMode.DIFF_WITH_ACCEPT


# Global settings — updated via /settings endpoint
current_settings = ClaudeCodeSettings()

# Live activity tracking per session
_activity: dict[str, list[str]] = {}


def get_activity(vox_session_id: str) -> list[str]:
    return _activity.get(vox_session_id, [])


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
    vox_session_id: str | None = None,
) -> tuple[str, str | None, int, list[str]]:
    """Run a prompt through Claude Code CLI with live activity tracking."""
    s = settings or current_settings
    sid = vox_session_id or "unknown"
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
    context_tokens = 0
    edited_files: list[str] = []

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
                                fp = inp.get('file_path', '?')
                                _add_activity(sid, f"Editing {fp.split('/')[-1]}")
                                if fp not in edited_files:
                                    edited_files.append(fp)
                            elif tool == "Write":
                                fp = inp.get('file_path', '?')
                                _add_activity(sid, f"Writing {fp.split('/')[-1]}")
                                if fp not in edited_files:
                                    edited_files.append(fp)
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
                    context_tokens = (
                        usage.get("input_tokens", 0)
                        + usage.get("cache_creation_input_tokens", 0)
                        + usage.get("cache_read_input_tokens", 0)
                    )
                    _add_activity(sid, f"Done ({duration / 1000:.1f}s, {context_tokens} tokens)")

            except json.JSONDecodeError:
                continue

        proc.wait(timeout=timeout)

    except subprocess.TimeoutExpired:
        proc.kill()
        _add_activity(sid, "Timed out")
        return "Claude Code timed out.", cc_session_id, context_tokens, edited_files

    if proc.returncode != 0 and not result_text:
        stderr = proc.stderr.read() if proc.stderr else ""
        _add_activity(sid, f"Error: {(stderr.strip() or 'unknown')[:80]}")
        return stderr.strip() or "Claude Code error", cc_session_id, context_tokens, edited_files

    return result_text, cc_session_id, context_tokens, edited_files


async def stream_claude_code_response(
    session,
    user_text: str,
) -> AsyncGenerator[dict, None]:
    """Async generator that streams Claude Code CLI events as they happen.

    Yields dicts with keys:
      - {"type": "activity", "text": "..."}
      - {"type": "partial", "text": "..."}
      - {"type": "done", "response_text": "...", "response_type": "...", "options": ..., "timing": {...}, "context_tokens": N, "edited_files": [...]}
    """
    s = current_settings
    sid = session.id
    _activity[sid] = ["Starting Claude Code..."]

    cmd = [
        "claude",
        "-p", user_text,
        "--output-format", "stream-json",
        "--verbose",
        "--model", s.model,
        "--effort", s.effort,
        "--permission-mode", "plan" if s.plan_mode else "default",
    ]

    if s.allowed_tools:
        cmd.extend(["--allowedTools", ",".join(s.allowed_tools)])

    if session.claude_code_session_id:
        cmd.extend(["--resume", session.claude_code_session_id])

    t0 = _time.time()

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=session.project_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    result_text = ""
    cc_session_id = session.claude_code_session_id
    context_tokens = 0
    edited_files: list[str] = []
    partial_text = ""

    try:
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                etype = event.get("type", "")

                if etype == "assistant" and "message" in event:
                    msg = event["message"]
                    for block in msg.get("content", []):
                        if block.get("type") == "text":
                            chunk = block.get("text", "")
                            if chunk:
                                partial_text += chunk
                                yield {"type": "partial", "text": partial_text}
                        elif block.get("type") == "tool_use":
                            tool = block.get("name", "?")
                            inp = block.get("input", {})
                            activity_line = ""
                            if tool == "Read":
                                activity_line = f"Reading {inp.get('file_path', '?').split('/')[-1]}"
                            elif tool == "Edit":
                                fp = inp.get('file_path', '?')
                                activity_line = f"Editing {fp.split('/')[-1]}"
                                if fp not in edited_files:
                                    edited_files.append(fp)
                            elif tool == "Write":
                                fp = inp.get('file_path', '?')
                                activity_line = f"Writing {fp.split('/')[-1]}"
                                if fp not in edited_files:
                                    edited_files.append(fp)
                            elif tool == "Bash":
                                activity_line = f"$ {inp.get('command', '?')[:50]}"
                            elif tool == "Grep":
                                activity_line = f"Searching: {inp.get('pattern', '?')}"
                            elif tool == "Glob":
                                activity_line = f"Finding: {inp.get('pattern', '?')}"
                            else:
                                activity_line = f"Using {tool}"
                            if activity_line:
                                _add_activity(sid, activity_line)
                                yield {"type": "activity", "text": activity_line}
                        elif block.get("type") == "thinking":
                            _add_activity(sid, "Thinking...")
                            yield {"type": "activity", "text": "Thinking..."}

                elif etype == "result":
                    result_text = event.get("result", "")
                    cc_session_id = event.get("session_id", session.claude_code_session_id)
                    duration = event.get("duration_ms", 0)
                    usage = event.get("usage", {})
                    context_tokens = (
                        usage.get("input_tokens", 0)
                        + usage.get("cache_creation_input_tokens", 0)
                        + usage.get("cache_read_input_tokens", 0)
                    )
                    _add_activity(sid, f"Done ({duration / 1000:.1f}s, {context_tokens} tokens)")

            except json.JSONDecodeError:
                continue

        await proc.wait()

    except Exception:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()
        yield {"type": "done", "response_text": "Claude Code error.", "response_type": "freeform", "options": None, "timing": {"claude": round(_time.time() - t0, 1)}, "context_tokens": 0, "edited_files": []}
        return

    if proc.returncode != 0 and not result_text:
        stderr = (await proc.stderr.read()).decode("utf-8", errors="replace") if proc.stderr else ""
        result_text = stderr.strip() or "Claude Code error"

    # Update session state
    session.claude_code_session_id = cc_session_id
    if context_tokens:
        session.context_tokens = context_tokens
    session.add_user_message(user_text)
    session.add_assistant_message(result_text)

    from app.llm import _parse_response
    response_type, options, diff = _parse_response(result_text)

    if diff and current_settings.mobile_mode in (MobileMode.DIFF_WITH_ACCEPT,):
        git_stash(session.project_path)

    claude_time = round(_time.time() - t0, 1)

    yield {
        "type": "done",
        "response_text": result_text,
        "response_type": response_type.value if hasattr(response_type, 'value') else str(response_type),
        "options": options,
        "timing": {"claude": claude_time, "tts": 0},
        "context_tokens": context_tokens,
        "edited_files": edited_files,
        "diff": diff,
    }


def run_compact(cwd: str, cc_session_id: str) -> tuple[str, str | None]:
    """Run /compact on the current Claude Code session to summarize context."""
    text, new_sid, _, _files = run_claude_code(
        "/compact",
        cwd,
        session_id=cc_session_id,
        vox_session_id="compact",
    )
    return text, new_sid


def git_stash(cwd: str) -> bool:
    try:
        r = subprocess.run(["git", "stash"], cwd=cwd, capture_output=True, text=True, timeout=10)
        return r.returncode == 0 and "No local changes" not in r.stdout
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


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
) -> tuple[str, ResponseType, list[str] | None, str | None, list[str]]:
    """Send prompt to Claude Code CLI and parse the response."""
    import asyncio

    loop = asyncio.get_event_loop()
    response_text, new_cc_session, context_tokens, edited_files = await loop.run_in_executor(
        None,
        run_claude_code,
        user_text,
        session.project_path,
        session.claude_code_session_id,
        current_settings,
        session.id,
    )

    session.claude_code_session_id = new_cc_session
    if context_tokens:
        session.context_tokens = context_tokens
    session.add_user_message(user_text)
    session.add_assistant_message(response_text)

    from app.llm import _parse_response
    response_type, options, diff = _parse_response(response_text)

    # In diff_with_accept mode: stash changes so the working tree is clean
    # until the user explicitly confirms. On SEND → pop, on CANCEL → drop.
    if diff and current_settings.mobile_mode in (MobileMode.DIFF_WITH_ACCEPT,):
        git_stash(session.project_path)

    return response_text, response_type, options, diff, edited_files
