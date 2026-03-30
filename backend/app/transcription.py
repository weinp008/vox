from deepgram import DeepgramClient, PrerecordedOptions

from app.config import settings


async def transcribe_audio(audio_bytes: bytes, mimetype: str = "audio/wav") -> str:
    """Transcribe audio bytes using Deepgram."""
    client = DeepgramClient(settings.deepgram_api_key)

    source = {"buffer": audio_bytes, "mimetype": mimetype}
    options = PrerecordedOptions(
        model="nova-2",
        smart_format=True,
        language="en",
    )

    response = await client.listen.asyncrest.v("1").transcribe_file(source, options)
    transcript = response.results.channels[0].alternatives[0].transcript
    return transcript.strip()
