from openai import AsyncOpenAI

from app.config import settings

# Map common mobile audio mimetypes to file extensions
_EXT_MAP = {
    "audio/m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
}


async def transcribe_audio(audio_bytes: bytes, mimetype: str = "audio/wav") -> str:
    """Transcribe audio bytes using OpenAI Whisper."""
    ext = _EXT_MAP.get(mimetype, ".m4a")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(f"audio{ext}", audio_bytes, mimetype),
        language="en",
    )

    return response.text.strip()
