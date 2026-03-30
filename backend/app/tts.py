import re

from elevenlabs import AsyncElevenLabs

from app.config import settings


def _clean_for_tts(text: str) -> str:
    """Extract only the spoken parts — strip options, code, and markers."""
    # Remove everything between OPTIONS markers (the app displays these visually)
    text = re.sub(r"OPTIONS_START[\s\S]*?OPTIONS_END", "", text)
    # Remove everything between CONFIRM markers (code diffs)
    text = re.sub(r"CONFIRM_START[\s\S]*?CONFIRM_END", "", text)
    # Remove any remaining markdown code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Remove stray markers
    text = re.sub(r"(OPTIONS_START|OPTIONS_END|CONFIRM_START|CONFIRM_END)", "", text)
    # Collapse whitespace
    text = re.sub(r"\n{2,}", ". ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


async def generate_speech(text: str) -> bytes:
    """Generate TTS audio bytes from text using ElevenLabs."""
    clean_text = _clean_for_tts(text)

    if not clean_text:
        clean_text = "Done."

    client = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)

    audio_generator = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=clean_text,
        model_id="eleven_flash_v2_5",
    )

    chunks = []
    async for chunk in audio_generator:
        chunks.append(chunk)
    return b"".join(chunks)
