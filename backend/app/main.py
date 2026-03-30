from __future__ import annotations

import base64
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.commands import detect_command
from app.config import settings
from app.llm import get_claude_response
from app.models import (
    CommandType,
    PromptResponse,
    ResponseType,
    SessionState,
    StartSessionRequest,
    StartSessionResponse,
)
from app.session import create_session, get_session
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


@app.post("/session/start", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest):
    """Initialize a project session from a local clone."""
    project_path = os.path.join(settings.projects_dir, req.project_path)

    if not os.path.isdir(project_path):
        raise HTTPException(status_code=404, detail=f"Project directory not found: {req.project_path}")

    session = create_session(project_path)
    return StartSessionResponse(
        session_id=session.id,
        project_name=session.project_name,
        files=session.files[:50],  # Cap for response size
        recent_commits=session.recent_commits,
    )


@app.post("/prompt", response_model=PromptResponse)
async def prompt(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """Process a voice prompt: transcribe → Claude → TTS."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Transcribe audio
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    transcript = await transcribe_audio(audio_bytes, content_type)

    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")

    # 2. Get Claude response
    response_text, response_type, options, diff = await get_claude_response(session, transcript)

    # 3. Store pending diff if confirmation
    if diff:
        session.pending_diff = diff
        session.state = SessionState.AWAITING_RESPONSE
    elif response_type == ResponseType.OPTIONS:
        session.state = SessionState.AWAITING_RESPONSE
    else:
        session.state = SessionState.IDLE

    # 4. Generate TTS
    audio_b64 = None
    try:
        tts_bytes = await generate_speech(response_text)
        audio_b64 = base64.b64encode(tts_bytes).decode()
    except Exception:
        pass  # TTS failure is non-fatal; client can fall back to on-device TTS

    return PromptResponse(
        session_id=session.id,
        transcript=transcript,
        response_text=response_text,
        response_type=response_type,
        options=options,
        pending_diff=diff,
        audio_url=audio_b64,  # Base64-encoded audio for now; swap for URL later
        state=session.state,
    )


@app.post("/respond", response_model=PromptResponse)
async def respond(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """Process a follow-up response (option selection, confirm, discuss, abort)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Transcribe
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    transcript = await transcribe_audio(audio_bytes, content_type)

    if not transcript:
        raise HTTPException(status_code=400, detail="Could not transcribe audio")

    # 2. Detect command
    command, extra = detect_command(transcript)

    # 3. Handle command
    if command == CommandType.ABORT:
        session.pending_diff = None
        session.state = SessionState.IDLE
        response_text = "Cancelled. What would you like to do next?"
        response_type = ResponseType.FREEFORM

    elif command == CommandType.SEND:
        if session.pending_diff:
            # In MVP, we just confirm the diff is ready — don't actually apply it
            response_text = f"Here's the diff to apply:\n\n{session.pending_diff}\n\nCopy this to your editor to apply. Session ready for next task."
            session.pending_diff = None
            session.state = SessionState.IDLE
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
        # Pass the selection to Claude as context
        selection_text = f"User selected option {extra}: {transcript}"
        response_text, response_type, options, diff = await get_claude_response(session, selection_text)
        if diff:
            session.pending_diff = diff
            session.state = SessionState.AWAITING_RESPONSE
        return await _build_response(session, transcript, response_text, response_type, options, diff)

    else:
        # DISCUSS or FREEFORM — pass through to Claude
        response_text, response_type, options, diff = await get_claude_response(session, transcript)
        if diff:
            session.pending_diff = diff
            session.state = SessionState.AWAITING_RESPONSE
        return await _build_response(session, transcript, response_text, response_type, options, diff)

    # Generate TTS for handled commands
    audio_b64 = None
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


async def _build_response(
    session,
    transcript: str,
    response_text: str,
    response_type: ResponseType,
    options: list[str] | None,
    diff: str | None,
) -> PromptResponse:
    audio_b64 = None
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
