#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${GREEN}[start]${NC} $*"; }
warn() { echo -e "${YELLOW}[start]${NC} $*"; }
die()  { echo -e "${RED}[start]${NC} $*"; exit 1; }

# ── cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# ── checks ────────────────────────────────────────────────────────────────────
[[ -f "$ROOT/backend/.env" ]] || die "backend/.env not found. Copy backend/.env.example and fill in ANTHROPIC_API_KEY."
[[ -f "$ROOT/backend/.venv/bin/activate" ]] || die "Python venv missing. Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
[[ -d "$ROOT/whatsapp-bridge/node_modules" ]] || die "Bridge deps missing. Run: cd whatsapp-bridge && npm install"
[[ -d "$ROOT/frontend/node_modules" ]] || die "Frontend deps missing. Run: cd frontend && npm install"

# Auto-create frontend/.env if missing (needed for VITE_API_URL in dev)
if [[ ! -f "$ROOT/frontend/.env" ]]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
  warn "Created frontend/.env from .env.example (VITE_API_URL=http://localhost:8000)"
fi

# ── backend ───────────────────────────────────────────────────────────────────
log "Starting backend (port 8000)..."
source "$ROOT/backend/.venv/bin/activate"
cd "$ROOT/backend"
log "Running database migrations..."
alembic upgrade head
uvicorn app.main:app --reload --reload-dir app --port 8000 &
PIDS+=($!)

# wait for backend to be ready
for i in {1..15}; do
  sleep 1
  curl -sf http://localhost:8000/health > /dev/null 2>&1 && break
  [[ $i -eq 15 ]] && die "Backend failed to start. Check logs above."
done
log "Backend ready."

# ── whatsapp bridge ───────────────────────────────────────────────────────────
log "Starting WhatsApp bridge (port 3001)..."
cd "$ROOT/whatsapp-bridge"
node src/index.js &
PIDS+=($!)
sleep 2
log "WhatsApp bridge started."

# ── frontend ──────────────────────────────────────────────────────────────────
log "Starting frontend (port 5173)..."
cd "$ROOT/frontend"
npm run dev &
PIDS+=($!)
sleep 2

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Wishing Bot is running!${NC}"
echo -e "${GREEN}  Open: http://localhost:5173${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
warn "Tip: Go to WhatsApp Targets and scan the QR code if not yet connected."
echo ""
log "Press Ctrl+C to stop all services."

# keep script alive
wait
