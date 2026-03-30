from __future__ import annotations

import os
import subprocess
import uuid

from app.models import SessionState


class Session:
    def __init__(self, project_path: str):
        self.id = str(uuid.uuid4())
        self.project_path = project_path
        self.project_name = os.path.basename(project_path)
        self.state = SessionState.IDLE
        self.conversation: list[dict] = []
        self.pending_diff: str | None = None
        self.files: list[str] = []
        self.recent_commits: list[str] = []
        self._load_project_context()

    def _load_project_context(self):
        if not os.path.isdir(self.project_path):
            return

        # Get file list (top-level + one level deep, skip hidden/node_modules)
        self.files = []
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules" and d != "__pycache__"]
            depth = root.replace(self.project_path, "").count(os.sep)
            if depth < 3:
                for f in files:
                    if not f.startswith("."):
                        rel = os.path.relpath(os.path.join(root, f), self.project_path)
                        self.files.append(rel)

        # Get recent git commits
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

    def add_assistant_message(self, text: str):
        self.conversation.append({"role": "assistant", "content": text})


# In-memory session store (swap for DB later)
_sessions: dict[str, Session] = {}


def create_session(project_path: str) -> Session:
    session = Session(project_path)
    _sessions[session.id] = session
    return session


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)
