from __future__ import annotations

import re

from app.models import CommandType

_NUMERIC_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4",
    "1": "1", "2": "2", "3": "3", "4": "4",
    "first": "1", "second": "2", "third": "3", "fourth": "4",
}

_ALL_PHRASES = ["all of them", "all of the above", "all four", "all three", "do them all", "everything"]
_SEND_PHRASES = ["send", "send it", "execute", "commit", "go ahead", "do it", "apply", "apply it"]
_ABORT_PHRASES = ["cancel", "stop", "never mind", "nevermind", "abort"]
_READ_BACK_PHRASES = ["read the changes", "what files", "show me the diff", "read it back", "what changed"]
_DISCUSS_PHRASES = ["speak to discuss", "let me explain", "let me think"]

MAX_COMMAND_WORDS = 8


def _word_match(phrase: str, text: str) -> bool:
    return bool(re.search(r'\b' + re.escape(phrase) + r'\b', text))


def detect_command(transcript: str) -> tuple[CommandType, str | None]:
    """Detect command type. Returns (type, extra_data).

    extra_data for NUMERIC: comma-separated selections like "1,3" or "all".
    """
    text = transcript.lower().strip()
    word_count = len(text.split())

    for phrase in _DISCUSS_PHRASES:
        if _word_match(phrase, text):
            return CommandType.DISCUSS, None

    if word_count <= MAX_COMMAND_WORDS:
        for phrase in _ABORT_PHRASES:
            if _word_match(phrase, text):
                return CommandType.ABORT, None

        for phrase in _READ_BACK_PHRASES:
            if _word_match(phrase, text):
                return CommandType.READ_BACK, None

        for phrase in _SEND_PHRASES:
            if _word_match(phrase, text):
                return CommandType.SEND, None

        # "All of them"
        for phrase in _ALL_PHRASES:
            if _word_match(phrase, text):
                return CommandType.NUMERIC, "all"

        # Multi-select: "one and three", "1, 2, and 4"
        found = []
        for word in re.split(r'[\s,]+', text):
            word = word.strip()
            if word in _NUMERIC_WORDS:
                found.append(_NUMERIC_WORDS[word])
            elif word in ("and", "or", "also", "plus", "with"):
                continue
        if found:
            return CommandType.NUMERIC, ",".join(found)

    return CommandType.FREEFORM, None
