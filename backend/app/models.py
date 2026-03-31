from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel


class ResponseType(str, Enum):
    OPTIONS = "options"
    CONFIRMATION = "confirmation"
    FREEFORM = "freeform"


class SessionState(str, Enum):
    IDLE = "idle"
    AWAITING_RESPONSE = "awaiting_response"
    CONFIRMED = "confirmed"


class MobileMode(str, Enum):
    DIFF_ONLY = "diff_only"          # Show diff, user copies manually (default)
    DIFF_WITH_ACCEPT = "diff_with_accept"  # Show diff, "accept" applies it to disk
    PURE_VIBE = "pure_vibe"          # Voice summary only, no diff shown, auto-apply on confirm


class CommandType(str, Enum):
    NUMERIC = "numeric"
    DISCUSS = "discuss"
    SEND = "send"
    ABORT = "abort"
    READ_BACK = "read_back"
    UNDO = "undo"
    FREEFORM = "freeform"


class StartSessionRequest(BaseModel):
    project_path: str  # Path to local clone relative to PROJECTS_DIR


class StartSessionResponse(BaseModel):
    session_id: str
    project_name: str
    branch: str = ""
    files: List[str]
    recent_commits: List[str]


class PromptResponse(BaseModel):
    session_id: str
    transcript: str
    response_text: str
    response_type: ResponseType
    options: Optional[List[str]] = None
    pending_diff: Optional[str] = None
    audio_url: Optional[str] = None
    state: SessionState
    timing: Optional[Dict[str, float]] = None  # e.g. {"claude": 12.3, "tts": 1.5}
    context_tokens: int = 0
    edited_files: List[str] = []


class RespondRequest(BaseModel):
    session_id: str
    # Audio file sent as form data, not here


class ErrorResponse(BaseModel):
    detail: str
