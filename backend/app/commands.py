from __future__ import annotations

import re

from app.models import CommandType

# Keyword maps for command detection
_NUMERIC_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4",
    "1": "1", "2": "2", "3": "3", "4": "4",
    "first": "1", "second": "2", "third": "3", "fourth": "4",
}

# These only trigger on short utterances (<=5 words) to avoid false positives
_SEND_PHRASES = ["send", "send it", "execute", "commit", "go ahead", "do it", "apply", "apply it"]
_ABORT_PHRASES = ["cancel", "stop", "never mind", "nevermind", "abort"]
_READ_BACK_PHRASES = ["read the changes", "what files", "show me the diff", "read it back", "what changed"]

# These can match in longer utterances
_DISCUSS_PHRASES = ["speak to discuss", "let me explain", "let me think"]

MAX_COMMAND_WORDS = 5  # Commands should be short; longer = freeform speech


def _word_match(phrase: str, text: str) -> bool:
    """Match phrase as whole words only (no substring matches)."""
    return bool(re.search(r'\b' + re.escape(phrase) + r'\b', text))


def detect_command(transcript: str) -> tuple[CommandType, str | None]:
    """Detect command type from transcript. Returns (command_type, extra_data).

    Only short utterances are matched as commands. Longer speech is treated
    as freeform to avoid false positives like "send" inside "transcend".
    """
    text = transcript.lower().strip()
    word_count = len(text.split())

    # Discuss phrases can appear in longer speech
    for phrase in _DISCUSS_PHRASES:
        if _word_match(phrase, text):
            return CommandType.DISCUSS, None

    # All other commands only trigger on short utterances
    if word_count <= MAX_COMMAND_WORDS:
        # Check abort first (highest priority safety command)
        for phrase in _ABORT_PHRASES:
            if _word_match(phrase, text):
                return CommandType.ABORT, None

        # Check read back
        for phrase in _READ_BACK_PHRASES:
            if _word_match(phrase, text):
                return CommandType.READ_BACK, None

        # Check send/execute
        for phrase in _SEND_PHRASES:
            if _word_match(phrase, text):
                return CommandType.SEND, None

        # Check numeric
        for word in text.split():
            if word in _NUMERIC_WORDS:
                return CommandType.NUMERIC, _NUMERIC_WORDS[word]

    return CommandType.FREEFORM, None
