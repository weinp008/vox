#!/bin/bash
# Demo script — shows Vox in action from the terminal
# Run: bash demo.sh

set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║           V O X                      ║"
echo "  ║   voice interface for claude code    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check dependencies
command -v python3 >/dev/null || { echo "❌ python3 not found"; exit 1; }
command -v claude >/dev/null || { echo "❌ claude code CLI not found — install from https://docs.anthropic.com/en/docs/claude-code"; exit 1; }

cd "$(dirname "$0")/backend"

# Setup venv if needed
if [ ! -d ".venv" ]; then
  echo "→ Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install deps if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "→ Installing dependencies..."
  pip install -q -r requirements.txt
fi

# Check for .env
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠  No .env file found. Create backend/.env with:"
  echo ""
  echo "   OPENAI_API_KEY=your_key"
  echo "   PROJECTS_DIR=/path/to/your/projects"
  echo ""
  exit 1
fi

echo "→ Starting Vox server..."
echo ""

# Get local IP for display
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

uvicorn app.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
sleep 2

echo "  ✓ Server running"
echo ""
echo "  Open in your browser:"
echo "  → http://localhost:8000/app"
echo ""
echo "  From your phone (same WiFi):"
echo "  → http://${LOCAL_IP}:8000/app"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Wait for ctrl+c
trap "kill $SERVER_PID 2>/dev/null; echo ''; echo '  Stopped.'; exit 0" INT
wait $SERVER_PID
