#!/usr/bin/env bash
set -euo pipefail

# ── colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'
BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[wishing-bot]${NC} $*"; }
info() { echo -e "${BLUE}[wishing-bot]${NC} $*"; }
warn() { echo -e "${YELLOW}[wishing-bot]${NC} $*"; }
die()  { echo -e "${RED}[wishing-bot]${NC} $*" >&2; exit 1; }

REPO_URL="https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git"
INSTALL_DIR="${WISHING_BOT_DIR:-$HOME/wishing-bot}"
APP_URL="http://localhost:8080"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Wishing Bot — installer${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. prerequisites ──────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  die "git is required but not found. Install it and re-run."
fi

if ! command -v docker &>/dev/null; then
  echo -e "${RED}Docker is not installed.${NC}"
  echo ""
  echo "Install Docker Desktop for your platform:"
  echo "  Mac (Apple Silicon): https://desktop.docker.com/mac/main/arm64/Docker.dmg"
  echo "  Mac (Intel):         https://desktop.docker.com/mac/main/amd64/Docker.dmg"
  echo "  Linux:               https://docs.docker.com/engine/install/"
  echo ""
  die "Re-run this script after Docker is installed and running."
fi

if ! docker info &>/dev/null 2>&1; then
  die "Docker is installed but not running. Start Docker Desktop and try again."
fi

log "Docker is running."

# ── 2. clone or update ────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Existing install found at $INSTALL_DIR — pulling latest..."
  git -C "$INSTALL_DIR" pull --ff-only
  log "Updated to $(git -C "$INSTALL_DIR" log --oneline -1)."
else
  log "Cloning to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── 3. configure .env ─────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  warn ".env already exists — skipping configuration."
  warn "Delete .env and re-run to reconfigure."
else
  echo ""
  echo -e "${BOLD}Configuration${NC}"
  echo ""

  echo "Which AI provider do you want to use?"
  echo "  1) Claude (Anthropic)  — recommended"
  echo "  2) OpenAI (GPT-4o)"
  echo "  3) Google Gemini"
  echo "  4) Local AI (LM Studio / Ollama)"
  echo ""
  read -r -p "Choice [1]: " _choice
  _choice="${_choice:-1}"

  ANTHROPIC_API_KEY="" OPENAI_API_KEY="" GEMINI_API_KEY="" AI_PROVIDER=""

  case "$_choice" in
    1|"")
      AI_PROVIDER="claude"
      read -r -p "Anthropic API key (sk-ant-...): " ANTHROPIC_API_KEY
      [ -z "$ANTHROPIC_API_KEY" ] && die "API key is required."
      ;;
    2)
      AI_PROVIDER="openai"
      read -r -p "OpenAI API key (sk-...): " OPENAI_API_KEY
      [ -z "$OPENAI_API_KEY" ] && die "API key is required."
      ;;
    3)
      AI_PROVIDER="gemini"
      read -r -p "Google Gemini API key: " GEMINI_API_KEY
      [ -z "$GEMINI_API_KEY" ] && die "API key is required."
      ;;
    4)
      AI_PROVIDER="local"
      warn "Make sure LM Studio or Ollama is running on this machine."
      ;;
    *)
      die "Invalid choice."
      ;;
  esac

  echo ""
  read -r -p "Your timezone [Australia/Sydney]: " SCHEDULER_TIMEZONE
  SCHEDULER_TIMEZONE="${SCHEDULER_TIMEZONE:-Australia/Sydney}"

  cat > .env <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OPENAI_API_KEY=${OPENAI_API_KEY}
GEMINI_API_KEY=${GEMINI_API_KEY}
AI_PROVIDER=${AI_PROVIDER}
SCHEDULER_TIMEZONE=${SCHEDULER_TIMEZONE}
SCHEDULER_HOUR=8
SCHEDULER_MINUTE=0
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash
LOCAL_AI_URL=http://localhost:1234/v1
LOCAL_AI_MODEL=
EOF

  log ".env saved."
fi

# ── 4. build & start ──────────────────────────────────────────────────────────
echo ""
log "Building Docker image (a few minutes the first time)..."
docker build -t wishing-bot:latest -f Dockerfile.single .

echo ""
log "Starting Wishing Bot..."
docker compose -f docker-compose.single.yml up -d

# ── 5. done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Wishing Bot is running!  →  ${APP_URL}${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Stop:   docker compose -f \"$INSTALL_DIR/docker-compose.single.yml\" down"
echo "  Start:  docker compose -f \"$INSTALL_DIR/docker-compose.single.yml\" up -d"
echo "  Update: re-run the install command"
echo ""

# open browser
if command -v open &>/dev/null; then
  sleep 2 && open "$APP_URL" &
elif command -v xdg-open &>/dev/null; then
  sleep 2 && xdg-open "$APP_URL" &
fi
