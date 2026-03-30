from __future__ import annotations

from app.models import CommandType

# Keyword maps for command detection
_NUMERIC_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4",
    "1": "1", "2": "2", "3": "3", "4": "4",
    "first": "1", "second": "2", "third": "3", "fourth": "4",
}

_DISCUSS_PHRASES = ["speak to discuss", "let me explain", "let me think", "actually"]
_SEND_PHRASES = ["send", "execute", "commit", "go ahead", "do it", "apply"]
_ABORT_PHRASES = ["cancel", "stop", "never mind", "nevermind", "abort"]
_READ_BACK_PHRASES = ["read the changes", "what files", "show me the diff", "read it back", "what changed"]


def detect_command(transcript: str) -> tuple[CommandType, str | None]:
    """Detect command type from transcript. Returns (command_type, extra_data).

    extra_data is the numeric choice for NUMERIC commands, None otherwise.
    """
    text = transcript.lower().strip()

    # Check abort first (highest priority safety command)
    for phrase in _ABORT_PHRASES:
        if phrase in text:
            return CommandType.ABORT, None

    # Check read back
    for phrase in _READ_BACK_PHRASES:
        if phrase in text:
            return CommandType.READ_BACK, None

    # Check send/execute
    for phrase in _SEND_PHRASES:
        if phrase in text:
            return CommandType.SEND, None

    # Check discuss mode
    for phrase in _DISCUSS_PHRASES:
        if phrase in text:
            return CommandType.DISCUSS, None

    # Check numeric — only if the transcript is very short (likely a selection)
    words = text.split()
    if len(words) <= 3:
        for word in words:
            if word in _NUMERIC_WORDS:
                return CommandType.NUMERIC, _NUMERIC_WORDS[word]

    return CommandType.FREEFORM, None
