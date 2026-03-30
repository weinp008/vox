from __future__ import annotations

import json
import os
import subprocess
import time
import uuid

from app.models import SessionState

SESSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", ".sessions")


class Session:
    def __init__(self, project_path: str, session_id: str | None = None):
        self.id = session_id or str(uuid.uuid4())
        self.project_path = project_path
        self.project_name = os.path.basename(project_path)
        self.state = SessionState.IDLE
        self.conversation: list[dict] = []
        self.pending_diff: str | None = None
        self.files: list[str] = []
        self.recent_commits: list[str] = []
        self.claude_code_session_id: str | None = None
        self.created_at: float = time.time()
        self.updated_at: float = time.time()
        self._load_project_context()

    def _load_project_context(self):
        if not os.path.isdir(self.project_path):
            return

        self.files = []
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules" and d != "__pycache__"]
            depth = root.replace(self.project_path, "").count(os.sep)
            if depth < 3:
                for f in files:
                    if not f.startswith("."):
                        rel = os.path.relpath(os.path.join(root, f), self.project_path)
                        self.files.append(rel)

        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "-5"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                self.recent_commits = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    def add_user_message(self, text: str):
        self.conversation.append({"role": "user", "content": text})
        self._save()

    def add_assistant_message(self, text: str):
        self.conversation.append({"role": "assistant", "content": text})
        self._save()

    def _save(self):
        """Persist session to disk."""
        self.updated_at = time.time()
        os.makedirs(SESSIONS_DIR, exist_ok=True)
        path = os.path.join(SESSIONS_DIR, f"{self.id}.json")
        data = {
            "id": self.id,
            "project_path": self.project_path,
            "project_name": self.project_name,
            "state": self.state.value,
            "conversation": self.conversation,
            "pending_diff": self.pending_diff,
            "claude_code_session_id": self.claude_code_session_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        with open(path, "w") as f:
            json.dump(data, f)

    @classmethod
    def load(cls, session_id: str) -> Session | None:
        """Load a session from disk."""
        path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            data = json.load(f)
        session = cls.__new__(cls)
        session.id = data["id"]
        session.project_path = data["project_path"]
        session.project_name = data["project_name"]
        session.state = SessionState(data["state"])
        session.conversation = data["conversation"]
        session.pending_diff = data.get("pending_diff")
        session.claude_code_session_id = data.get("claude_code_session_id")
        session.created_at = data.get("created_at", 0)
        session.updated_at = data.get("updated_at", 0)
        session.files = []
        session.recent_commits = []
        session._load_project_context()
        return session


# In-memory cache backed by disk
_sessions: dict[str, Session] = {}


def create_session(project_path: str) -> Session:
    session = Session(project_path)
    session._save()
    _sessions[session.id] = session
    return session


def get_session(session_id: str) -> Session | None:
    if session_id in _sessions:
        return _sessions[session_id]
    # Try loading from disk
    session = Session.load(session_id)
    if session:
        _sessions[session.id] = session
    return session


def list_sessions() -> list[dict]:
    """List all saved sessions, most recent first."""
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    sessions = []
    for fname in os.listdir(SESSIONS_DIR):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(SESSIONS_DIR, fname)
        try:
            with open(path) as f:
                data = json.load(f)
            msg_count = len(data.get("conversation", []))
            # Get last user message as preview
            last_msg = ""
            for msg in reversed(data.get("conversation", [])):
                if msg["role"] == "user":
                    last_msg = msg["content"][:80]
                    break
            sessions.append({
                "session_id": data["id"],
                "project_name": data["project_name"],
                "message_count": msg_count,
                "last_message": last_msg,
                "updated_at": data.get("updated_at", 0),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    sessions.sort(key=lambda s: s["updated_at"], reverse=True)
    return sessions
