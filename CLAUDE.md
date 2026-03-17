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
```

### Running the app

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2 — WhatsApp bridge
cd whatsapp-bridge && npm start

# Terminal 3 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173. Go to **WhatsApp Targets** first and scan the QR code.

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

Bridge listens on `127.0.0.1:3001` only (not exposed publicly).

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
| `SCHEDULER_TIMEZONE` | Cron timezone (default: `Asia/Kolkata`) |
| `SCHEDULER_HOUR` | Hour for daily draft generation (default: `8`) |
| `DB_URL` | SQLAlchemy DB URL (default: SQLite) |
