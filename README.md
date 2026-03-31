# Sonar

Voice interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Talk to your codebase from your phone, browser, or anywhere.

## What it does

Sonar wraps Claude Code CLI with a voice and text interface. You speak (or type), it transcribes, sends to Claude Code running on your machine, and streams the response back. Claude Code does the actual work — reading files, editing code, running commands.

**Web client** works in any browser. **Mobile app** (React Native/Expo) for iOS/Android.

## Quick start

```bash
git clone https://github.com/weinp008/sonar.git
cd sonar/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
OPENAI_API_KEY=your_key    # for Whisper transcription + TTS
PROJECTS_DIR=/path/to/your/projects
```

Start the server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` in your browser.

## Requirements

- Python 3.10+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and authenticated
- OpenAI API key (for Whisper STT + TTS)

## How it works

```
Phone/Browser → Sonar backend → Claude Code CLI → your codebase
```

1. You speak or type a prompt
2. Audio is transcribed via OpenAI Whisper
3. Text is sent to Claude Code CLI running in your project directory
4. Claude Code reads files, edits code, runs commands
5. Response streams back to your device in real-time
6. Optional TTS reads the response aloud

## Features

- **Voice or text input** — hold to record, or type
- **Streaming responses** — see Claude's output as it generates
- **Live activity feed** — shows what Claude Code is doing (reading files, editing, running commands)
- **Session persistence** — pick up where you left off
- **Configurable** — model (haiku/sonnet/opus), effort level, plan mode, TTS on/off
- **Context tracking** — see token usage, compact or clear when needed
- **Remote access** — works over Tailscale or any network
- **Web + mobile** — browser client included, React Native app for iOS/Android

## Remote access

Install [Tailscale](https://tailscale.com) on your computer and phone. Your computer gets a stable IP (e.g. `100.x.y.z`). Access Sonar from anywhere at `http://100.x.y.z:8000/app`.

## Project structure

```
backend/
  app/
    main.py           # FastAPI server + endpoints
    claude_code.py    # Claude Code CLI integration
    transcription.py  # OpenAI Whisper STT
    tts.py            # OpenAI TTS
    session.py        # Session persistence
    commands.py       # Voice command detection
    llm.py            # Direct API fallback
    config.py         # Settings
  static/
    index.html        # Web client
    landing.html      # Landing page
mobile/               # React Native (Expo) app
```

## Configuration

Settings can be changed from the web client (gear icon) or via API:

| Setting | Options | Default |
|---------|---------|---------|
| Model | haiku, sonnet, opus | sonnet |
| Effort | low, medium, high, max | low |
| TTS | on/off | on |
| Plan mode | on/off | off |

Set `USE_CLAUDE_CODE=false` in `.env` to use the Anthropic API directly instead of Claude Code CLI.

## License

MIT
