# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal web app to send AI-generated birthday/anniversary/occasion greetings on WhatsApp. Daily scheduler generates Claude-powered drafts, user reviews/edits in a browser dashboard, then sends with one click.

**Three services that must all run:**
1. `backend/` — Python FastAPI (port 8000)
2. `whatsapp-bridge/` — Node.js Express (port 3001, localhost-only)
3. `frontend/` — React + Vite dev server (port 5173)

## Commands

### First-time setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in ANTHROPIC_API_KEY
alembic upgrade head        # creates wishing_bot.db

# WhatsApp bridge
cd whatsapp-bridge
npm install

# Frontend
cd frontend
npm install
cp .env.example .env        # sets VITE_API_URL=http://localhost:8000 (auto-created by start.sh)
```

### Running the app (local dev)

```bash
# One command — starts backend, bridge, and frontend
./start.sh
# start.sh checks for backend/.env, auto-creates frontend/.env if missing, runs migrations, then starts all three services
```

Or manually:
```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --reload-dir app --port 8000

# Terminal 2 — WhatsApp bridge
cd whatsapp-bridge && npm start

# Terminal 3 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173. Go to **WhatsApp** in the sidebar and scan the QR code.

### Running with Docker

```bash
# 1. Create root .env from template
cp .env.example .env     # fill in ANTHROPIC_API_KEY (also has SCHEDULER_TIMEZONE, SCHEDULER_HOUR, SCHEDULER_MINUTE, AI_PROVIDER)

# 2. Build and start all containers
docker-compose up --build

# 3. Run migrations (first time only)
docker-compose exec backend alembic upgrade head
```

Open http://localhost. See `docker-run.md` for individual `docker run` commands.

### Useful commands

```bash
# Manually trigger today's draft generation (no need to wait for 8am cron)
curl -X POST http://localhost:8000/api/dashboard/generate

# Run Alembic migration after model changes
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head

# API docs
open http://localhost:8000/docs
```

## Architecture

### Backend (`backend/app/`)

- `main.py` — FastAPI entrypoint; registers routers; starts APScheduler in `lifespan`
- `config.py` — All env vars via pydantic-settings (loaded from `backend/.env`)
- `database.py` — SQLAlchemy engine + `get_db` dependency
- `scheduler.py` — `daily_occasion_check()` runs at 8am; also called by `POST /api/dashboard/generate`
- `models/` — SQLAlchemy ORM: `Contact`, `Occasion`, `MessageDraft`, `WhatsAppTarget`
- `schemas/` — Pydantic request/response schemas matching models
- `routers/` — One file per resource group: `contacts`, `occasions`, `drafts`, `whatsapp_targets`, `dashboard`
- `services/claude_service.py` — Builds prompt from contact+occasion fields, calls `claude-sonnet-4-6`
- `services/occasion_service.py` — Age/years calculation, occasion display strings
- `services/whatsapp_service.py` — HTTP client to Node bridge; raises `HTTPException` on failure

### Message draft lifecycle

`pending` → `approved` (user approves, optionally with edits) → `sent`
or `pending` → `skipped`

The `PATCH /api/drafts/{id}/approve` endpoint accepts an optional `edited_text`; send resolves `edited_text ?? generated_text` as the final message.

### WhatsApp bridge (`whatsapp-bridge/`)

Node.js + whatsapp-web.js singleton in `src/client.js`. Uses `LocalAuth` — session persists to `session/` so QR is only needed once. Exposes two endpoints:
- `GET /status` → `{ ready, qr_image }`
- `POST /send` → `{ chat_id, message }` → sends via WhatsApp Web

Bridge listens on `127.0.0.1:3001` locally (via `HOST` env var; `0.0.0.0` in Docker for inter-container communication). Never exposed on a public port.

### Frontend (`frontend/src/`)

- `api/client.ts` — All Axios calls; returns typed data matching `types/index.ts`
- `pages/DashboardPage.tsx` — Today's occasions + upcoming 7 days
- `pages/ContactFormPage.tsx` — Add/edit contact with embedded occasion management
- `pages/ContactsPage.tsx` — Searchable, filterable contact list
- `pages/TargetsPage.tsx` — WhatsApp target CRUD + QR code display
- `components/dashboard/TodayCard.tsx` — Per-occasion card with approve/skip/regenerate/send

### Database

SQLite at `backend/wishing_bot.db`. Key constraint: `(occasion_id, occasion_date)` unique on `message_drafts` prevents duplicate drafts. Alembic migrations in `backend/alembic/versions/`.

### Environment variables (backend/.env)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `WA_BRIDGE_URL` | URL of Node bridge (default: `http://localhost:3001`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin (default: `http://localhost:5173`; set to `http://localhost` in Docker) |
| `SCHEDULER_TIMEZONE` | Cron timezone (default: `Asia/Kolkata`) |
| `SCHEDULER_HOUR` | Hour for daily draft generation (default: `8`) |
| `SCHEDULER_MINUTE` | Minute for daily draft generation (default: `0`) |
| `DB_URL` | SQLAlchemy DB URL (default: SQLite at `./wishing_bot.db`; Docker uses `/app/data/wishing_bot.db`) |
| `AI_PROVIDER` | `auto` / `claude` / `local` (default: `auto` locally, `claude` in Docker) |
| `LOCAL_AI_URL` | LM Studio / Ollama base URL (default: `http://localhost:1234/v1`) |
| `LOCAL_AI_MODEL` | Specific local model name (optional; auto-detects first available if blank) |

### Frontend env (frontend/.env — dev only, gitignored)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL — set to `http://localhost:8000` for dev; empty in Docker (nginx proxies) |
| `VITE_GIPHY_API_KEY` | Giphy API key for GIF picker (optional; get a free key at developers.giphy.com) |

### Docker networking

In Docker Compose, nginx proxies all `/api/*` requests to the `backend` container — no CORS issues and no hardcoded port in the frontend. The WA bridge is internal-only (no published port).
