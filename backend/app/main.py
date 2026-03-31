from __future__ import annotations

import base64
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from app.commands import detect_command
from app.config import settings
from app.claude_code import ClaudeCodeSettings, current_settings, get_activity, get_claude_code_response
from app.llm import get_claude_response
from app.models import (
    CommandType,
    MobileMode,
    PromptResponse,
    ResponseType,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
)
from app.session import create_session, get_session, list_sessions
from app.transcription import transcribe_audio
from app.tts import generate_speech

app = FastAPI(title="Sonar", description="Navigate code by voice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionSummary(BaseModel):
    session_id: str
    project_name: str
    branch: str = ""
    message_count: int
    last_message: str
    updated_at: float
    starred: bool = False


class ResumeSessionResponse(BaseModel):
    session_id: str
    project_name: str
    files: list[str]
    recent_commits: list[str]
    conversation: list[dict]


@app.get("/sessions", response_model=list[SessionSummary])
async def get_sessions():
    """List all saved sessions, most recent first."""
    return [SessionSummary(**s) for s in list_sessions()]


@app.post("/session/start", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest):
    """Initialize a new project session."""
    project_path = os.path.join(settings.projects_dir, req.project_path)

    if not os.path.isdir(project_path):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {req.project_path}")

    session = create_session(project_path)
    return StartSessionResponse(
        session_id=session.id,
        project_name=session.project_name,
        files=session.files[:50],
        recent_commits=session.recent_commits,
    )


@app.get("/session/{session_id}/resume", response_model=ResumeSessionResponse)
async def resume_session(session_id: str):
    """Resume an existing session with full conversation history."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return ResumeSessionResponse(
        session_id=session.id,
        project_name=session.project_name,
        files=session.files[:50],
        recent_commits=session.recent_commits,
        conversation=session.conversation,
    )


class RenameSessionRequest(BaseModel):
    name: str


@app.post("/session/{session_id}/rename")
async def rename_session(session_id: str, req: RenameSessionRequest):
    """Rename a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.project_name = req.name
    session._save()
    return {"ok": True, "name": req.name}


@app.post("/session/{session_id}/star")
async def star_session(session_id: str):
    """Toggle the starred state of a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.starred = not session.starred
    session._save()
    return {"ok": True, "starred": session.starred}


class SettingsResponse(BaseModel):
    model: str
    effort: str
    allowed_tools: list[str]
    use_claude_code: bool
    plan_mode: bool = False
    mobile_mode: MobileMode = MobileMode.DIFF_WITH_ACCEPT


class UpdateSettingsRequest(BaseModel):
    model: str | None = None
    effort: str | None = None
    allowed_tools: list[str] | None = None
    plan_mode: bool | None = None
    mobile_mode: MobileMode | None = None


@app.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Get current Claude Code settings."""
    import app.claude_code as cc
    return SettingsResponse(
        model=cc.current_settings.model,
        effort=cc.current_settings.effort,
        allowed_tools=cc.current_settings.allowed_tools,
        use_claude_code=settings.use_claude_code,
        plan_mode=cc.current_settings.plan_mode,
        mobile_mode=cc.current_settings.mobile_mode,
    )


@app.post("/settings", response_model=SettingsResponse)
async def update_settings(req: UpdateSettingsRequest):
    """Update Claude Code settings."""
    import app.claude_code as cc
    if req.model is not None:
        cc.current_settings.model = req.model
    if req.effort is not None:
        cc.current_settings.effort = req.effort
    if req.allowed_tools is not None:
        cc.current_settings.allowed_tools = req.allowed_tools
    if req.plan_mode is not None:
        cc.current_settings.plan_mode = req.plan_mode
    if req.mobile_mode is not None:
        cc.current_settings.mobile_mode = req.mobile_mode
    return SettingsResponse(
        model=cc.current_settings.model,
        effort=cc.current_settings.effort,
        allowed_tools=cc.current_settings.allowed_tools,
        use_claude_code=settings.use_claude_code,
        plan_mode=cc.current_settings.plan_mode,
        mobile_mode=cc.current_settings.mobile_mode,
    )


@app.post("/session/{session_id}/compact")
async def compact_session(session_id: str):
    """Run /compact on the Claude Code session to summarize and reduce context."""
    import asyncio
    from app.claude_code import run_compact
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.claude_code_session_id:
        return {"ok": False, "message": "No active Claude Code session to compact"}

    loop = asyncio.get_event_loop()
    result_text, new_cc_session = await loop.run_in_executor(
        None, run_compact, session.project_path, session.claude_code_session_id
    )
    if new_cc_session:
        session.claude_code_session_id = new_cc_session
    session.context_tokens = 0  # Reset — we don't know new size until next turn
    session._save()
    return {"ok": True, "message": result_text[:200]}


@app.post("/session/{session_id}/clear")
async def clear_context(session_id: str):
    """Clear the Claude Code session context (start fresh)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.claude_code_session_id = None
    session.context_tokens = 0
    session._save()
    return {"ok": True}


@app.get("/projects")
async def list_projects():
    """List available project directories in PROJECTS_DIR."""
    base = settings.projects_dir
    if not os.path.isdir(base):
        return {"projects": []}
    projects = sorted(
        d for d in os.listdir(base)
        if os.path.isdir(os.path.join(base, d)) and not d.startswith(".")
    )
    return {"projects": projects}


@app.get("/session/{session_id}/activity")
async def session_activity(session_id: str):
    """Get live activity log for a session (poll during processing)."""
    return {"activity": get_activity(session_id)}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its persisted file."""
    import os as _os
    from app.session import SESSIONS_DIR, _sessions
    path = _os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if _os.path.exists(path):
        _os.remove(path)
    _sessions.pop(session_id, None)
    return {"ok": True}


class TranscribeResponse(BaseModel):
    transcript: str


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
):
    """Transcribe audio only — fast, returns transcript for live display."""
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    transcript = await transcribe_audio(audio_bytes, content_type)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")
    return TranscribeResponse(transcript=transcript)


class TextPromptRequest(BaseModel):
    session_id: str
    text: str
    tts: bool = True


@app.post("/prompt/text", response_model=PromptResponse)
async def prompt_text(req: TextPromptRequest):
    """Process a text prompt (already transcribed): Claude → TTS."""
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return await _process_prompt(session, req.text, tts=req.tts)


@app.post("/prompt", response_model=PromptResponse)
async def prompt(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """Process a voice prompt: transcribe → Claude → TTS (legacy single-call)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    transcript = await transcribe_audio(audio_bytes, content_type)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")

    return await _process_prompt(session, transcript)


@app.post("/prompt/image", response_model=PromptResponse)
async def prompt_image(
    session_id: str = Form(...),
    image: UploadFile = File(...),
    audio: UploadFile | None = File(None),
    caption: str | None = Form(None),
):
    """Process a prompt with an image attachment."""
    import tempfile

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save image to temp file
    image_bytes = await image.read()
    suffix = os.path.splitext(image.filename or "image.png")[1] or ".png"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="sonar_img_")
    tmp.write(image_bytes)
    tmp.close()

    # Get text from audio or caption
    text = caption or ""
    if audio is not None:
        audio_bytes = await audio.read()
        if audio_bytes:
            content_type = audio.content_type or "audio/wav"
            transcript = await transcribe_audio(audio_bytes, content_type)
            if transcript:
                text = transcript

    prompt = f"User uploaded an image at {tmp.name}. {text}".strip()
    return await _process_prompt(session, prompt)


async def _get_response(session, text: str):
    """Route to Claude Code CLI or direct API based on config."""
    if settings.use_claude_code:
        return await get_claude_code_response(session, text)
    return await get_claude_response(session, text)


def _extract_voice_summary(response_text: str) -> str:
    """Extract the one-line description before CONFIRM_START for pure_vibe mode."""
    if "CONFIRM_START" in response_text:
        summary = response_text.split("CONFIRM_START")[0].strip()
        return summary or "Changes ready."
    return response_text


async def _process_prompt(session, text: str, tts: bool = True) -> PromptResponse:
    """Shared logic: send text to Claude, generate TTS, return response."""
    import app.claude_code as cc
    import time as _time

    t0 = _time.time()
    response_text, response_type, options, diff = await _get_response(session, text)
    claude_time = round(_time.time() - t0, 1)

    if diff:
        session.pending_diff = diff
        session.state = SessionState.AWAITING_RESPONSE
    elif response_type == ResponseType.OPTIONS:
        session.state = SessionState.AWAITING_RESPONSE
    else:
        session.state = SessionState.IDLE

    # In pure_vibe mode: strip the diff from the response — user hears a summary only.
    # The diff is retained on the session for when they confirm.
    client_response_text = response_text
    client_diff = diff
    if cc.current_settings.mobile_mode == MobileMode.PURE_VIBE and diff:
        client_response_text = _extract_voice_summary(response_text)
        client_diff = None  # Don't expose diff to client

    audio_b64 = None
    tts_time = 0.0
    if tts:
        try:
            t1 = _time.time()
            tts_bytes = await generate_speech(client_response_text)
            tts_time = round(_time.time() - t1, 1)
            audio_b64 = base64.b64encode(tts_bytes).decode()
        except Exception:
            import traceback; traceback.print_exc()

    timing = {"claude": claude_time, "tts": tts_time}

    return PromptResponse(
        session_id=session.id,
        transcript=text,
        response_text=client_response_text,
        response_type=response_type,
        options=options,
        pending_diff=client_diff,
        audio_url=audio_b64,
        state=session.state,
        timing=timing,
        context_tokens=session.context_tokens,
    )


class TextRespondRequest(BaseModel):
    session_id: str
    text: str
    tts: bool = True


@app.post("/respond/text", response_model=PromptResponse)
async def respond_text(req: TextRespondRequest):
    """Process a text response (already transcribed)."""
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return await _process_respond(session, req.text, tts=req.tts)


@app.post("/respond", response_model=PromptResponse)
async def respond(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """Process a voice follow-up (legacy single-call)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    transcript = await transcribe_audio(audio_bytes, content_type)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")
    return await _process_respond(session, transcript)


async def _apply_changes_to_disk(session, diff: str) -> str:
    """Apply pending changes to disk using Claude Code CLI.

    Called in diff_with_accept and pure_vibe modes after user confirms.
    Requires use_claude_code=True — falls back gracefully if not available.
    """
    if not settings.use_claude_code:
        return (
            f"Cannot apply automatically — Claude Code is disabled. "
            f"Here's the diff to apply manually:\n\n{diff}"
        )

    instruction = (
        "Apply the following changes to the codebase exactly as described. "
        "Write the files. Do not ask questions.\n\n"
        f"{diff}"
    )
    result_text, _, _, _ = await get_claude_code_response(session, instruction)
    return result_text


async def _process_respond(session, transcript: str, tts: bool = True) -> PromptResponse:
    import app.claude_code as cc

    # 2. Detect command
    command, extra = detect_command(transcript)

    # 3. Handle command
    if command == CommandType.ABORT:
        if session.pending_diff:
            cc.git_stash_drop(session.project_path)
        session.pending_diff = None
        session.state = SessionState.IDLE
        response_text = "Cancelled. What would you like to do next?"
        response_type = ResponseType.FREEFORM

    elif command == CommandType.UNDO:
        import subprocess as _sp
        try:
            result = _sp.run(
                ["git", "revert", "HEAD", "--no-edit"],
                cwd=session.project_path,
                capture_output=True, text=True, timeout=15,
            )
            if result.returncode == 0:
                response_text = "Reverted last commit. Working directory is clean."
            else:
                # Fallback: try unstaged reset
                result2 = _sp.run(
                    ["git", "checkout", "--", "."],
                    cwd=session.project_path,
                    capture_output=True, text=True, timeout=10,
                )
                response_text = "Discarded uncommitted changes." if result2.returncode == 0 else f"Undo failed: {result.stderr.strip()[:100]}"
        except Exception as e:
            response_text = f"Undo failed: {str(e)[:80]}"
        session.state = SessionState.IDLE
        response_type = ResponseType.FREEFORM

    elif command == CommandType.SEND:
        if session.pending_diff:
            diff_to_apply = session.pending_diff
            session.pending_diff = None
            session.state = SessionState.IDLE
            mode = cc.current_settings.mobile_mode

            if mode == MobileMode.DIFF_WITH_ACCEPT:
                # Changes are stashed — pop to restore them to disk
                popped = cc.git_stash_pop(session.project_path)
                response_text = "Changes applied." if popped else "Applied. (Note: stash pop had an issue — changes may already be on disk.)"
            elif mode == MobileMode.PURE_VIBE:
                # pure_vibe never stashes — changes already on disk
                response_text = "Done."
            else:
                # diff_only: hand back raw diff for manual application
                response_text = (
                    f"Here's the diff to apply:\n\n{diff_to_apply}\n\n"
                    "Copy this to your editor to apply. Session ready for next task."
                )
        else:
            response_text = "No pending changes to send. What would you like to work on?"
            session.state = SessionState.IDLE
        response_type = ResponseType.FREEFORM

    elif command == CommandType.READ_BACK:
        if session.pending_diff:
            response_text = f"Here are the pending changes:\n\n{session.pending_diff}"
        else:
            response_text = "No pending changes right now."
        response_type = ResponseType.FREEFORM

    elif command == CommandType.NUMERIC and extra:
        # Handle multi-select and "all"
        if extra == "all":
            selection_text = f"User selected all options. Proceed with all of them."
        elif "," in extra:
            selection_text = f"User selected options {extra.replace(',', ', ')}. Proceed with those."
        else:
            selection_text = f"User selected option {extra}."
        response_text, response_type, options, diff = await _get_response(session, selection_text)
        if diff:
            session.pending_diff = diff
            session.state = SessionState.AWAITING_RESPONSE
        return await _build_response(session, transcript, response_text, response_type, options, diff, tts)

    else:
        # DISCUSS or FREEFORM — pass through to Claude
        response_text, response_type, options, diff = await _get_response(session, transcript)
        if diff:
            session.pending_diff = diff
            session.state = SessionState.AWAITING_RESPONSE
        return await _build_response(session, transcript, response_text, response_type, options, diff, tts)

    # Generate TTS for handled commands
    audio_b64 = None
    if tts:
        try:
            tts_bytes = await generate_speech(response_text)
            audio_b64 = base64.b64encode(tts_bytes).decode()
        except Exception:
            pass

    return PromptResponse(
        session_id=session.id,
        transcript=transcript,
        response_text=response_text,
        response_type=response_type,
        options=None,
        pending_diff=session.pending_diff,
        audio_url=audio_b64,
        state=session.state,
    )


class TTSRequest(BaseModel):
    text: str


class TTSResponse(BaseModel):
    audio_url: str  # base64-encoded audio


@app.post("/tts", response_model=TTSResponse)
async def tts(req: TTSRequest):
    """Generate TTS audio for arbitrary text (used for read-aloud feature)."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    try:
        tts_bytes = await generate_speech(req.text)
        audio_b64 = base64.b64encode(tts_bytes).decode()
        return TTSResponse(audio_url=audio_b64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")


async def _build_response(
    session,
    transcript: str,
    response_text: str,
    response_type: ResponseType,
    options: list[str] | None,
    diff: str | None,
    tts: bool = True,
) -> PromptResponse:
    audio_b64 = None
    if tts:
        try:
            tts_bytes = await generate_speech(response_text)
            audio_b64 = base64.b64encode(tts_bytes).decode()
        except Exception:
            pass

    return PromptResponse(
        session_id=session.id,
        transcript=transcript,
        response_text=response_text,
        response_type=response_type,
        options=options,
        pending_diff=diff,
        audio_url=audio_b64,
        state=session.state,
    )
