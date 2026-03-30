from __future__ import annotations

from enum import Enum
from pydantic import BaseModel


class ResponseType(str, Enum):
    OPTIONS = "options"
    CONFIRMATION = "confirmation"
    FREEFORM = "freeform"


class SessionState(str, Enum):
    IDLE = "idle"
    AWAITING_RESPONSE = "awaiting_response"
    CONFIRMED = "confirmed"


class CommandType(str, Enum):
    NUMERIC = "numeric"
    DISCUSS = "discuss"
    SEND = "send"
    ABORT = "abort"
    READ_BACK = "read_back"
    FREEFORM = "freeform"


class StartSessionRequest(BaseModel):
    project_path: str  # Path to local clone relative to PROJECTS_DIR


class StartSessionResponse(BaseModel):
    session_id: str
    project_name: str
    files: list[str]
    recent_commits: list[str]


class PromptResponse(BaseModel):
    session_id: str
    transcript: str
    response_text: str
    response_type: ResponseType
    options: list[str] | None = None
    pending_diff: str | None = None
    audio_url: str | None = None
    state: SessionState


class RespondRequest(BaseModel):
    session_id: str
    # Audio file sent as form data, not here


class ErrorResponse(BaseModel):
    detail: str
