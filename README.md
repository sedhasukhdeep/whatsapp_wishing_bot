# Wishing Bot

A personal web app that sends AI-generated birthday, anniversary, and occasion greetings via WhatsApp. A daily scheduler generates Claude-powered draft messages; you review and approve them in a browser dashboard, then send with one click — or approve/send directly from WhatsApp using bot commands.

## How it works

1. Add contacts and their occasions (birthdays, anniversaries, custom)
2. Every day at 8 AM the scheduler generates draft messages using Claude
3. Open the dashboard to review, edit, approve, or skip each draft
4. Send approved messages to individual contacts or WhatsApp groups
5. Optionally, receive daily summaries on WhatsApp and reply with commands to act on drafts without opening the browser

## Architecture

Three services run together:

| Service | Port | Purpose |
|---|---|---|
| `backend/` | 8000 | Python FastAPI — API, scheduler, AI generation |
| `whatsapp-bridge/` | 3001 | Node.js — WhatsApp Web session, send/receive messages |
| `frontend/` | 5173 (dev) / 80 (Docker) | React — dashboard UI |

---

## Local development setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (or a local LLM via LM Studio / Ollama)

### 1. Clone the repo

```bash
git clone https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git
cd whatsapp_wishing_bot
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then open .env and set ANTHROPIC_API_KEY
alembic upgrade head          # creates wishing_bot.db
```

### 3. WhatsApp bridge

```bash
cd ../whatsapp-bridge
npm install
cp .env.example .env          # sets PORT=3001 and BACKEND_URL=http://localhost:8000
```

### 4. Frontend

```bash
cd ../frontend
npm install
# frontend/.env is auto-created by start.sh — no manual step needed
```

### Run everything

```bash
cd ..
./start.sh
```

This starts all three services, runs migrations, and opens the app at **http://localhost:5173**.

Or run each service manually in separate terminals:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --reload-dir app --port 8000

# Terminal 2 — WhatsApp bridge
cd whatsapp-bridge && npm start

# Terminal 3 — frontend
cd frontend && npm run dev
```

### Connect WhatsApp

Go to **WhatsApp** in the sidebar and scan the QR code with your phone. The session is saved locally — you only need to scan once.

---

## Docker setup

```bash
# 1. Create root .env from template
cp .env.example .env          # fill in ANTHROPIC_API_KEY

# 2. Build and start all containers
docker-compose up --build

# 3. Run migrations (first time only)
docker-compose exec backend alembic upgrade head
```

Open **http://localhost**. See `docker-run.md` for individual `docker run` commands.

---

## Settings

Open **Settings** in the sidebar to configure:

### AI provider

- **Auto** — tries local LLM first, falls back to Claude
- **Claude only** — uses Anthropic API (requires `ANTHROPIC_API_KEY`)
- **Local only** — uses LM Studio or Ollama (OpenAI-compatible endpoint)

You can set the Anthropic API key, Claude model, and local AI URL/model from the UI — no need to restart after changing.

### Giphy

Set a [Giphy API key](https://developers.giphy.com/) to enable the GIF picker on draft cards. The key is stored in the database and proxied through the backend — it is never sent to the browser.

### Admin WhatsApp notifications

Designate a WhatsApp chat (your own number, a group, etc.) to receive:

- A daily summary of today's occasions and generated drafts
- An upcoming events preview for the next 7 days

After setting the admin chat, you can reply with bot commands to act on drafts directly from WhatsApp.

---

## WhatsApp bot commands

Reply to the daily summary (or message the bot any time) with:

| Command | Action |
|---|---|
| `list` | Show today's drafts with IDs and status |
| `approve <id>` | Approve draft #id |
| `send <id>` | Approve and send draft #id to the contact |
| `skip <id>` | Skip draft #id |
| `regenerate <id>` | Regenerate draft #id with AI |
| `upcoming` | Show occasions in the next 7 days |
| `help` | Show this command list |

> The bot only responds to messages from the configured admin chat. All other messages are ignored.

---

## Useful commands

```bash
# Manually trigger today's draft generation (no need to wait for 8 AM)
curl -X POST http://localhost:8000/api/dashboard/generate

# Create a new Alembic migration after model changes
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head

# API docs (Swagger UI)
open http://localhost:8000/docs
```

---

## Environment variables

### `backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `WA_BRIDGE_URL` | `http://localhost:3001` | WhatsApp bridge URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `SCHEDULER_TIMEZONE` | `Asia/Kolkata` | Timezone for daily draft generation |
| `SCHEDULER_HOUR` | `8` | Hour for daily run |
| `SCHEDULER_MINUTE` | `0` | Minute for daily run |
| `DB_URL` | `sqlite:///./wishing_bot.db` | SQLAlchemy database URL |
| `AI_PROVIDER` | `auto` | `auto` / `claude` / `local` |
| `LOCAL_AI_URL` | `http://localhost:1234/v1` | LM Studio / Ollama base URL |
| `LOCAL_AI_MODEL` | _(auto-detect)_ | Specific local model name |

### `whatsapp-bridge/.env`

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port the bridge listens on |
| `BACKEND_URL` | `http://localhost:8000` | Backend URL for incoming message webhook |

### `frontend/.env` (dev only, auto-created by `start.sh`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL — `http://localhost:8000` in dev; empty in Docker (nginx proxies) |
