import re

from elevenlabs import AsyncElevenLabs

from app.config import settings


def _clean_for_tts(text: str) -> str:
    """Remove format markers and code blocks for cleaner TTS."""
    # Remove our format markers
    text = re.sub(r"(OPTIONS_START|OPTIONS_END|CONFIRM_START|CONFIRM_END)", "", text)
    # Remove markdown code blocks (keep the description, drop the code)
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


async def generate_speech(text: str) -> bytes:
    """Generate TTS audio bytes from text using ElevenLabs."""
    clean_text = _clean_for_tts(text)

    client = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)

    audio_generator = await client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=clean_text,
        model_id="eleven_turbo_v2_5",
    )

    # Collect all chunks into bytes
    chunks = []
    async for chunk in audio_generator:
        chunks.append(chunk)
    return b"".join(chunks)
