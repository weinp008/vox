import re

from openai import AsyncOpenAI

from app.config import settings


def _clean_for_tts(text: str) -> str:
    """Extract only the spoken parts — strip options, code, and markers."""
    text = re.sub(r"OPTIONS_START[\s\S]*?OPTIONS_END", "", text)
    text = re.sub(r"CONFIRM_START[\s\S]*?CONFIRM_END", "", text)
    text = re.sub(r"```[\s\S]*?```", "", text)
    text = re.sub(r"(OPTIONS_START|OPTIONS_END|CONFIRM_START|CONFIRM_END)", "", text)
    text = re.sub(r"\n{2,}", ". ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


async def generate_speech(text: str, speed: float = 1.15) -> bytes:
    """Generate TTS audio bytes using OpenAI TTS."""
    clean_text = _clean_for_tts(text)
    if not clean_text:
        clean_text = "Done."

    # Truncate to first 500 chars — long responses shouldn't be fully read
    clean_text = clean_text[:500]

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.audio.speech.create(
        model="tts-1",
        voice=settings.tts_voice,
        input=clean_text,
        response_format="mp3",
        speed=speed,
    )

    return response.content
