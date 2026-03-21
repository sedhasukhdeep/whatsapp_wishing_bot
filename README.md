# Wishing Bot

Send AI-generated birthday, anniversary, and occasion greetings via WhatsApp — automatically. A daily scheduler drafts personalised messages; you review and approve them in a browser dashboard, then send with one click. Or broadcast a single message to many people at once, personalised per recipient.

**Multi-profile support:** one installation can serve multiple independent users. Each profile has its own contacts, occasions, drafts, and WhatsApp account. Profiles can optionally be protected with a PIN.

---

## Quick Start (no terminal needed)

### Step 1 — Install Docker Desktop

Docker Desktop runs the app in the background. Install it once and you're done.

| Your computer | Download |
|---|---|
| Mac — Apple Silicon (M1/M2/M3/M4) | [Docker.dmg (Apple chip)](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |
| Mac — Intel | [Docker.dmg (Intel chip)](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| Windows | [Docker Desktop Installer.exe](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) |
| Linux | [Docker Desktop for Linux](https://docs.docker.com/desktop/install/linux-install/) |

After installing, open Docker Desktop and wait until the taskbar/menu bar icon says **"Docker Desktop is running"**.

### Step 2 — Download Wishing Bot

Click the green **Code** button on this page → **Download ZIP**, then unzip it anywhere (e.g. your Desktop).

### Step 3 — Run the setup wizard

Open the unzipped folder and double-click:

| Platform | File |
|---|---|
| Mac / Linux | `setup.command` |
| Windows | `setup.bat` |

The wizard checks Docker, asks for an AI key, sets your timezone, builds the containers, and opens the app — all with Next / Skip buttons. No terminal needed.

> **macOS:** If blocked by Gatekeeper, right-click the file → **Open** → click Open again.

### Step 4 — Select or create a profile

When the app opens you'll land on the **Profile selection** screen. A default profile is created automatically. You can:

- Click a profile to enter it (optionally enter a PIN if one is set)
- Click **+ New Profile** to add another user

Each profile is completely independent — its own contacts, occasions, drafts, and WhatsApp connection.

### Step 5 — Connect WhatsApp

In the app, go to **WhatsApp** in the sidebar. If no session exists for this profile, click **Connect WhatsApp** and scan the QR code that appears with your phone. You only need to do this once per profile — the session is saved.

---

### Day-to-day: start and stop

Double-click the same file every time:

| Platform | File |
|---|---|
| Mac / Linux | `start.command` |
| Windows | `start.bat` |

- **App not running** → starts it and opens your browser
- **App already running** → prompts you to stop it or open the browser

---

## Features

### Profiles

Multiple independent users can share one Wishing Bot installation. Each profile has:

- Its own contacts, occasions, drafts, and broadcast history
- Its own WhatsApp account — scan a different QR code per profile
- Its own admin chat and notification settings
- Optional PIN protection

Switch between profiles at any time via the profile name in the top-left corner → **Switch profile**.

### Occasion drafts

1. Add contacts with their birthdays, anniversaries, or custom occasions
2. At 8 AM every day the scheduler generates a personalised AI draft for each occasion
3. Open the dashboard to review, edit, approve, or skip each draft
4. Send approved messages to individual contacts or WhatsApp groups

### Broadcast messages

Send one message to many contacts at once — with per-recipient personalisation:

- Write a message using `{name}` as a placeholder — it's replaced with each contact's first name (or alias) at send time
- Set a **nickname/alias** on any contact (e.g. "Maa", "Bhai", "Di") and enable **Use alias in broadcasts** to use it instead of their first name
- A live preview shows exactly how the message will look for the first recipient before you send

### WhatsApp bot commands

Reply to the daily summary from your phone (or message the bot any time):

| Command | Action |
|---|---|
| `list` | Show today's drafts with IDs and status |
| `approve <id>` | Approve draft #id |
| `send <id>` | Approve and immediately send draft #id |
| `skip <id>` | Skip draft #id |
| `regenerate <id>` | Regenerate draft #id with AI |
| `upcoming` | Show occasions in the next 7 days |
| `help` | Show this command list |

> The bot only responds to messages from the configured admin chat.

---

## Settings

Open **Settings** in the sidebar to configure:

### AI provider

| Provider | Key required | Notes |
|---|---|---|
| **Claude** | `ANTHROPIC_API_KEY` | Best quality — Haiku, Sonnet, Opus |
| **OpenAI** | OpenAI API key | GPT-4o, GPT-4.1, o4-mini |
| **Gemini** | Gemini API key | Gemini 2.0/2.5 Flash & Pro |
| **Local** | None | LM Studio or Ollama (OpenAI-compatible) |
| **Auto** | Anthropic key | Tries local LLM first, falls back to Claude |

All keys and model selections are configurable from the UI — no restart needed. Keys are stored in the database and never sent to the browser.

### Giphy

Set a [Giphy API key](https://developers.giphy.com/) to enable the GIF picker on draft cards.

### Admin WhatsApp notifications

Designate a WhatsApp chat (your own number, a group, etc.) to receive a daily summary and upcoming events preview. This is what the bot commands reply to.

This is a **per-profile** setting — configure it under **Settings → Admin WhatsApp Notifications** while the target profile is selected. Each profile sends notifications to its own designated chat via its own WhatsApp connection.

---

## Developer setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (or a local LLM via LM Studio / Ollama)

### Install and run

```bash
git clone https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git
cd whatsapp_wishing_bot
```

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # fill in ANTHROPIC_API_KEY
alembic upgrade head
```

```bash
# WhatsApp bridge
cd whatsapp-bridge && npm install
```

```bash
# Frontend
cd frontend && npm install
```

```bash
# Start everything
./start.sh              # backend + bridge + frontend at http://localhost:5173
./start.sh stop         # stop all services
```

Manual (three terminals):
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --reload-dir app --port 8000
cd whatsapp-bridge && npm start
cd frontend && npm run dev
```

### Docker (manual)

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec -T backend alembic upgrade head
```

Open **http://localhost**.

### Useful commands

```bash
# Trigger draft generation now for profile 1 (skip waiting for 8 AM)
curl -X POST http://localhost:8000/api/dashboard/generate \
  -H "X-Profile-ID: 1"

# Create a migration after model changes
cd backend && alembic revision --autogenerate -m "description" && alembic upgrade head

# API docs (Swagger)
open http://localhost:8000/docs

# Run E2E tests (requires app running on localhost:5173)
cd frontend && npx playwright test
```

### Multi-profile notes for developers

Every API request must include an `X-Profile-ID: <id>` header. The frontend axios interceptor injects this automatically from `localStorage`. When testing with `curl` or Postman, add `-H "X-Profile-ID: 1"`.

Profile 1 is created automatically on first run (`alembic upgrade head`). Additional profiles are managed via `POST /api/profiles`.

WhatsApp sessions are stored per-profile under `whatsapp-bridge/session/session-profile_<id>/`. The bridge auto-discovers and starts all sessions on startup. An existing single-user session (`session/session/`) is automatically migrated to `session/session-profile_1/` on first start.

---

## Environment variables

### Root `.env` — used by Docker / setup wizard

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `AI_PROVIDER` | `auto` | `auto` / `claude` / `openai` / `gemini` / `local` |
| `SCHEDULER_TIMEZONE` | `Australia/Sydney` | Timezone for the 8 AM daily run |
| `SCHEDULER_HOUR` | `8` | Hour for daily draft generation |
| `SCHEDULER_MINUTE` | `0` | Minute for daily draft generation |

### `backend/.env` — local dev only (same as above, plus)

| Variable | Default | Purpose |
|---|---|---|
| `WA_BRIDGE_URL` | `http://localhost:3001` | WhatsApp bridge URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `DB_URL` | `sqlite:///./wishing_bot.db` | SQLAlchemy database URL |
| `LOCAL_AI_URL` | `http://localhost:1234/v1` | LM Studio / Ollama base URL |
| `LOCAL_AI_MODEL` | _(auto-detect)_ | Specific local model name |
| `OPENAI_MODEL` | `gpt-4o-mini` | Default OpenAI model |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Default Gemini model |

### `frontend/.env` — dev only, auto-created by `start.sh`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | `http://localhost:8000` in dev; empty in Docker (nginx proxies `/api`) |
