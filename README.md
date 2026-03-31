# Vox

Talk to your codebase. Voice and text interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

```
You: "Add a health check endpoint"
Vox: Reading main.py... Editing main.py... Done (6.2s)
     Added GET /health returning {"ok": true}
```

## Quick start

```bash
git clone https://github.com/weinp008/vox.git
cd vox
```

Add your OpenAI key (for voice transcription):

```bash
echo "OPENAI_API_KEY=sk-..." > backend/.env
echo "PROJECTS_DIR=$HOME/Projects" >> backend/.env
```

Run:

```bash
bash demo.sh
```

Open **http://localhost:8000/app** — or from your phone on the same WiFi.

## Requirements

- Python 3.10+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and authenticated
- OpenAI API key (for Whisper transcription + TTS)

## How it works

```
Browser/Phone → Vox → Claude Code CLI → your codebase
```

You speak or type. Vox transcribes via Whisper, sends to Claude Code running on your machine, streams the response back. Claude Code does the work — reading files, editing code, running commands. You see it happen in real-time.

## Features

- **Voice or text** — hold mic to record, or just type
- **Streaming** — responses appear word-by-word as Claude works
- **Activity feed** — see what Claude is doing: `Reading main.py`, `$ git diff`
- **Sessions** — pick up where you left off
- **Settings** — model (haiku/sonnet/opus), effort, plan mode, TTS
- **Context tracking** — token usage bar, compact/clear when full
- **Remote** — access from anywhere via [Tailscale](https://tailscale.com)
- **No build step** — single HTML file, no npm, no webpack

## Remote access

```bash
# Install Tailscale on your computer and phone
brew install tailscale && tailscale up
# Access from anywhere:
# http://<tailscale-ip>:8000/app
```

## Configuration

Change settings from the web UI (gear icon) or `backend/.env`:

```
OPENAI_API_KEY=...              # Required — for Whisper + TTS
PROJECTS_DIR=/path/to/projects  # Where your repos live
USE_CLAUDE_CODE=true            # false = direct Anthropic API
TTS_VOICE=nova                  # alloy, echo, fable, onyx, nova, shimmer
```

## Project structure

```
backend/
  app/main.py          # FastAPI server
  app/claude_code.py   # Claude Code CLI wrapper + streaming
  app/transcription.py # OpenAI Whisper
  app/tts.py           # OpenAI TTS
  app/session.py       # Persistent sessions
  static/index.html    # Web client (single file)
mobile/                # React Native app (optional)
demo.sh                # One-command launcher
```

## License

MIT
