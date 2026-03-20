# Wishing Bot

A personal web app that sends AI-generated birthday, anniversary, and occasion greetings via WhatsApp. A daily scheduler generates draft messages; you review and approve them in a browser dashboard, then send with one click — or act on them directly from WhatsApp using bot commands.

---

## Quick Start (no terminal needed)

### Step 1 — Install Docker Desktop

Docker Desktop runs the app in the background. Install it once and you're done.

| Your computer | Download link |
|---|---|
| Mac (Apple Silicon) | [Docker Desktop for Mac (Apple chip)](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |
| Mac (Intel) | [Docker Desktop for Mac (Intel chip)](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| Windows | [Docker Desktop for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) |
| Linux | [Docker Desktop for Linux](https://docs.docker.com/desktop/install/linux-install/) |

After installing, open Docker Desktop and wait until it says **"Docker Desktop is running"** in the taskbar/menu bar.

### Step 2 — Download Wishing Bot

Click the green **Code** button on this page → **Download ZIP**, then unzip it anywhere on your computer (e.g. your Desktop).

### Step 3 — Run the setup wizard

Open the unzipped folder and double-click the setup file for your platform:

| Platform | Double-click this file |
|---|---|
| Mac / Linux | `setup.command` |
| Windows | `setup.bat` |

The wizard will:
1. Confirm Docker is running
2. Ask for an AI API key (Claude, OpenAI, or Gemini) — or skip to use a local model
3. Pick your timezone for the 8 AM daily scheduler
4. Build and start the app automatically

> **macOS only:** If you see "cannot be opened because it is from an unidentified developer", right-click the file and choose **Open**, then click Open again.

### Step 4 — Connect WhatsApp

Once the app opens in your browser, go to **WhatsApp** in the sidebar and scan the QR code with your phone. You only need to do this once — the session is saved.

### Starting and stopping (after setup)

| Platform | Start the app | Stop the app |
|---|---|---|
| Mac / Linux | Double-click `start.command` | Double-click `stop.command` |
| Windows | Double-click `start.bat` | Double-click `stop.bat` |

---

## How it works

1. Add contacts and their occasions (birthdays, anniversaries, custom dates)
2. Every day at 8 AM the scheduler generates AI draft messages
3. Open the dashboard to review, edit, approve, or skip each draft
4. Send approved messages to individual contacts or WhatsApp groups
5. Optionally receive a daily WhatsApp summary and reply with bot commands to act on drafts without opening the browser

---

## Settings

Open **Settings** in the sidebar to configure:

### AI provider

| Provider | Description | Key required |
|---|---|---|
| **Auto** | Tries local LLM first, falls back to Claude | Anthropic key |
| **Claude** | Anthropic Claude (Haiku, Sonnet, Opus) | `ANTHROPIC_API_KEY` |
| **OpenAI** | GPT-4o, GPT-4.1, o4-mini, etc. | OpenAI API key |
| **Gemini** | Google Gemini 2.0/2.5 Flash & Pro | Gemini API key |
| **Local** | LM Studio or Ollama (OpenAI-compatible) | None |

All keys and model selections are configurable from the Settings UI — no restart needed. Keys are stored in the database and never sent to the browser.

### Giphy

Set a [Giphy API key](https://developers.giphy.com/) to enable the GIF picker on draft cards. The key is stored in the database and proxied through the backend.

### Admin WhatsApp notifications

Designate a WhatsApp chat (your own number, a group, etc.) to receive a daily summary of today's occasions and an upcoming events preview for the next 7 days.

---

## WhatsApp bot commands

Reply to the daily summary (or message the bot any time) with:

| Command | Action |
|---|---|
| `list` | Show today's drafts with IDs and status |
| `approve <id>` | Approve draft #id |
| `send <id>` | Approve and send draft #id |
| `skip <id>` | Skip draft #id |
| `regenerate <id>` | Regenerate draft #id with AI |
| `upcoming` | Show occasions in the next 7 days |
| `help` | Show this command list |

> The bot only responds to messages from the configured admin chat. All other messages are ignored.

---

## Developer setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (or a local LLM via LM Studio / Ollama)

### Clone and run

```bash
git clone https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git
cd whatsapp_wishing_bot
```

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # set ANTHROPIC_API_KEY
alembic upgrade head
```

**WhatsApp bridge**
```bash
cd whatsapp-bridge && npm install
```

**Frontend**
```bash
cd frontend && npm install
```

**Run all three services**
```bash
./start.sh        # starts backend, bridge, and frontend; opens http://localhost:5173
./start.sh stop   # stops all services
```

Or manually in three terminals:
```bash
# Terminal 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --reload-dir app --port 8000

# Terminal 2
cd whatsapp-bridge && npm start

# Terminal 3
cd frontend && npm run dev
```

### Docker (manual)

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY
docker compose up --build -d
docker compose exec -T backend alembic upgrade head
```

Open **http://localhost**.

### Useful commands

```bash
# Trigger today's draft generation immediately (no need to wait for 8 AM)
curl -X POST http://localhost:8000/api/dashboard/generate

# Create a new migration after model changes
cd backend && alembic revision --autogenerate -m "description" && alembic upgrade head

# API docs
open http://localhost:8000/docs
```

---

## Environment variables

### Root `.env` (Docker / wizard)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `AI_PROVIDER` | `auto` | `auto` / `claude` / `openai` / `gemini` / `local` |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `SCHEDULER_TIMEZONE` | `Australia/Sydney` | Timezone for daily draft generation |
| `SCHEDULER_HOUR` | `8` | Hour for daily run |
| `SCHEDULER_MINUTE` | `0` | Minute for daily run |

### `backend/.env` (local dev)

Same variables as above, plus:

| Variable | Default | Purpose |
|---|---|---|
| `WA_BRIDGE_URL` | `http://localhost:3001` | WhatsApp bridge URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `DB_URL` | `sqlite:///./wishing_bot.db` | SQLAlchemy database URL |
| `LOCAL_AI_URL` | `http://localhost:1234/v1` | LM Studio / Ollama base URL |
| `LOCAL_AI_MODEL` | _(auto-detect)_ | Specific local model name |
| `OPENAI_MODEL` | `gpt-4o-mini` | Default OpenAI model |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Default Gemini model |

### `frontend/.env` (dev only, auto-created by `start.sh`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend URL — `http://localhost:8000` in dev; empty in Docker (nginx proxies) |
