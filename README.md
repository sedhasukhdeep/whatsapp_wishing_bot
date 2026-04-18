# Wishing Bot

Send AI-generated birthday, anniversary, and occasion greetings via WhatsApp — automatically. A daily scheduler drafts personalised messages; you review and approve them in a web dashboard, then send with one click. Or broadcast a single message to many people at once, personalised per recipient.

**Multi-profile support:** one installation can serve multiple independent users. Each profile has its own contacts, occasions, drafts, and WhatsApp account. Profiles can optionally be protected with a PIN.

---

## Table of Contents

- [Mac / Linux — one-line install](#mac--linux--one-line-install)
- [Mac / Linux — manual (no terminal)](#manual-setup-no-terminal)
- [Windows](#windows-setup)
- [Unraid NAS](#unraid-nas-installation)
- [Features](#features)
- [Settings](#settings)
- [Developer setup](#developer-setup)
- [Environment variables](#environment-variables)

---

## Mac / Linux — one-line install

Make sure [Docker Desktop](https://docs.docker.com/get-docker/) is installed and running, then paste this into a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/sedhasukhdeep/whatsapp_wishing_bot/master/install.sh | bash
```

The script will:
1. Clone the repo to `~/wishing-bot`
2. Ask for your AI API key and timezone
3. Build and start the app in Docker
4. Open `http://localhost:8080` in your browser automatically

**To update to a new version**, run the same command again — your data and settings are preserved.

> **Linux note:** if `docker compose` isn't found, install the [Docker Compose plugin](https://docs.docker.com/compose/install/).

---

## Manual setup (no terminal)

### Step 1 — Install Docker Desktop

| Your computer | Download |
|---|---|
| Mac — Apple Silicon (M1/M2/M3/M4) | [Docker.dmg (Apple chip)](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |
| Mac — Intel | [Docker.dmg (Intel chip)](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| Linux | [Docker Desktop for Linux](https://docs.docker.com/desktop/install/linux-install/) |

After installing, open Docker Desktop and wait until the icon says **"Docker Desktop is running"**.

---

### Step 2 — Download Wishing Bot

Click the green **Code** button at the top of this page → **Download ZIP**, then unzip it anywhere (e.g. your Desktop).

---

### Step 3 — Run the setup wizard

Open the unzipped folder and double-click:

| Platform | File to double-click |
|---|---|
| Mac / Linux | `setup.command` |

The wizard will ask for your AI API key and timezone, then build and start the app.

> **macOS tip:** If you see a security warning, right-click the file → **Open** → click **Open** again.

---

## Windows setup

1. Install [Docker Desktop for Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) and start it
2. Download the ZIP from the green **Code** button above and unzip it
3. Double-click `setup.bat` in the unzipped folder

---

### Step 4 — Select or create a profile

When the app opens you'll land on the **Profile selection** screen. A default profile is created automatically. You can:

- Click a profile to enter it (enter your PIN if one is set)
- Click **+ New Profile** to add another user

Each profile is completely independent — its own contacts, occasions, drafts, and WhatsApp connection.

---

### Step 5 — Connect WhatsApp

Go to **WhatsApp** in the sidebar. Click **Connect WhatsApp**, then scan the QR code that appears using your phone:

> WhatsApp → Settings → Linked Devices → Link a Device → point camera at QR code

You only need to do this once per profile — the session is saved automatically.

---

### Day-to-day: starting and stopping

Double-click this file every time you want to use the app:

| Platform | File |
|---|---|
| Mac / Linux | `start.command` |
| Windows | `start.bat` |

- If the app is **not running** → it starts and opens your browser
- If the app is **already running** → it asks if you want to stop it or just open the browser

---

## Unraid NAS Installation

Wishing Bot runs as a single Docker container on Unraid. The image is built locally from source (it's not on Docker Hub).

### First-time setup

**1. SSH into your Unraid server**

Open a terminal on your Mac/Windows machine and connect:
```
ssh root@YOUR-UNRAID-IP
```
Enter your Unraid root password when prompted.

**2. Copy the source files**

```bash
cd /tmp
git clone https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git wb-src
cp -r /tmp/wb-src/. /mnt/user/appdata/wishing-bot/
```

**3. Create your `.env` file**

```bash
cd /mnt/user/appdata/wishing-bot
cp .env.example .env
nano .env
```

Fill in at minimum:
```
ANTHROPIC_API_KEY=sk-ant-...      # or use OPENAI_API_KEY / GEMINI_API_KEY
SCHEDULER_TIMEZONE=Australia/Sydney  # your timezone
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

**4. Build the Docker image**

```bash
cd /mnt/user/appdata/wishing-bot
docker build -t wishing-bot:latest -f Dockerfile.single .
```

This takes a few minutes the first time (downloading dependencies). Subsequent builds are much faster.

**5. Start the container**

```bash
docker compose -f docker-compose.single.yml up -d
```

The app is now running at `http://YOUR-UNRAID-IP:8080`

---

### Add to Unraid Community Applications (optional)

The `unraid/wishing-bot.xml` file in this repo is an Unraid Docker template. To use it:

1. Copy `unraid/wishing-bot.xml` to `/boot/config/plugins/dockerMan/templates-user/` on your Unraid server
2. In the Unraid UI, go to **Docker** → **Add Container** → find **WishingBot** in the template list
3. Fill in your API keys and paths, then click **Apply**

> The template references the locally-built `wishing-bot:latest` image. You must complete the build step above before adding the container in the UI.

---

### Updating to a new version (Unraid)

Run these commands over SSH whenever you want the latest changes:

```bash
cd /tmp
rm -rf wb-src
git clone https://github.com/sedhasukhdeep/whatsapp_wishing_bot.git wb-src
cp -r /tmp/wb-src/. /mnt/user/appdata/wishing-bot/

cd /mnt/user/appdata/wishing-bot
docker build -t wishing-bot:latest -f Dockerfile.single .
docker compose -f docker-compose.single.yml down
docker compose -f docker-compose.single.yml up -d

# Optional: clean up old images to free disk space
docker image prune -f
```

Your `.env` file and all data (contacts, occasions, WhatsApp sessions) are preserved — the copy step skips existing files.

---

## Features

### Profiles

Multiple independent users can share one Wishing Bot installation. Each profile has:

- Its own contacts, occasions, drafts, and broadcast history
- Its own WhatsApp account — scan a different QR code per profile
- Its own admin chat and notification settings
- Optional PIN protection

Switch between profiles at any time via the profile name shown in the top-left corner (sidebar) → **Switch**.

---

### Contacts

Add the people you want to wish. For each contact you can set:

- **Name** and **phone number** (international format, e.g. `+919876543210`)
- **Relationship** — family, friend, colleague, acquaintance, or other
- **Alias / nickname** — e.g. "Maa", "Bhai", "Di" — used in messages instead of the full name
- **Partner / Spouse Name** — for anniversary messages. If set, the AI will address both partners by name (e.g. "Chachu ji and Chachi ji"). If left blank, the AI will try to infer the partner's name from the alias (e.g. "Chachu ji" → "Chachi ji", "Mama ji" → "Mami ji")
- **Tone preference** — warm, funny, or formal
- **Language** — English, Hindi, Punjabi, Marathi, Gujarati, Tamil, Telugu
- **Message length** — short (~30 words), medium (~60 words), long (~100 words)
- **Notes** — personal details to weave into messages (hobbies, nickname, etc.)
- **Custom instructions** — free-text guidance for the AI (e.g. "always mention cricket")
- **Auto-send** — skip the approval step and send automatically

---

### Occasions

Each contact can have multiple occasions:

- **Birthday**
- **Anniversary** — the AI automatically includes both partners in the message
- **Custom** — any event with a label (e.g. "Work Anniversary", "Graduation")

Occasions can have their own overrides for tone, language, length, and instructions — independently of the contact's defaults.

---

### Daily drafts

1. Add contacts with their occasions
2. At 8 AM every day, the scheduler generates a personalised AI draft for each upcoming occasion
3. Open the **Dashboard** to review, edit, approve, or skip each draft
4. Send approved messages directly from the dashboard — to the contact's number or any WhatsApp group

---

### Broadcast messages

Send one message to many contacts at once:

- Write a message using `{name}` as a placeholder — it's replaced with each contact's first name (or alias) at send time
- Enable **Use alias in broadcasts** on a contact to use their nickname instead of their real name
- A live preview shows how the message looks for each recipient before you send

---

### Occasion Detection

Wishing Bot can watch your incoming WhatsApp messages and automatically detect when someone mentions a birthday or anniversary.

- Go to the **Detections** page (radar icon in the sidebar)
- Click **Scan History** to scan your recent chat history for mentions of occasions
  - The scan can be cancelled at any time with the **Cancel** button
  - Progress is shown in real time (chats scanned / total)
- Each detection shows the person's name, occasion type, detected date, and the original message for context
- Review detections and click **Confirm** to add them as occasions for an existing contact
- Dismiss any false positives individually or all at once

You can also configure **ignore keywords** (messages containing them are silently skipped) and **custom occasion triggers** (map your own keywords to occasion types).

---

### Calendar

A monthly view showing all upcoming occasions for all your contacts — colour-coded by occasion type. Navigate months with the arrow buttons.

---

### History

A full log of every message that has been sent — contact name, occasion, date sent, and the final message text.

---

### WhatsApp bot commands

If you configure an admin WhatsApp chat in Settings, you'll receive a daily summary message on your phone. You can reply to it with commands:

| Command | What it does |
|---|---|
| `list` | Show today's drafts with their IDs and status |
| `approve <id>` | Approve draft #id for sending |
| `send <id>` | Approve and immediately send draft #id |
| `skip <id>` | Skip draft #id (won't be sent) |
| `regenerate <id>` | Generate a new AI draft for #id |
| `upcoming` | Show occasions in the next 7 days |
| `help` | Show this command list |

> The bot only responds to messages from the configured admin chat.

---

## Settings

Open **Settings** in the sidebar to configure:

### AI provider

| Provider | What you need | Notes |
|---|---|---|
| **Claude** | Anthropic API key | Best quality — get a key at [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | OpenAI API key | GPT-4o, GPT-4.1, o4-mini — [platform.openai.com](https://platform.openai.com) |
| **Gemini** | Google Gemini API key | Gemini 2.0/2.5 Flash & Pro — [aistudio.google.com](https://aistudio.google.com) |
| **Local** | None | LM Studio or Ollama running on the same machine |
| **Auto** | Anthropic key recommended | Tries a local LLM first, falls back to Claude |

All keys and model choices are set from the UI — no restart needed. Keys are stored in the database and never exposed in the browser.

### Giphy

Set a free [Giphy API key](https://developers.giphy.com/) to enable the GIF picker when approving drafts.

### Admin WhatsApp Notifications

Designate a WhatsApp chat to receive a daily summary and accept bot commands (your own number, a group, etc.).

This is a **per-profile** setting — configure it while the target profile is active. Each profile sends notifications to its own designated chat via its own WhatsApp connection.

---

## Developer setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An AI API key (Claude, OpenAI, Gemini) or a local LLM via LM Studio / Ollama

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
cp .env.example .env     # fill in your API key and settings
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
# Start everything (backend + bridge + frontend)
./start.sh              # opens at http://localhost:5173
./start.sh stop         # stop all services
```

Or start each service manually in three separate terminals:
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

### Single-container build (same as Unraid)

```bash
cp .env.example .env
docker build -t wishing-bot:latest -f Dockerfile.single .
docker compose -f docker-compose.single.yml up -d
```

Open **http://localhost:8080**.

### Useful commands

```bash
# Trigger draft generation now (skip waiting for 8 AM)
curl -X POST http://localhost:8000/api/dashboard/generate \
  -H "X-Profile-ID: 1"

# Create a database migration after model changes
cd backend && alembic revision --autogenerate -m "description" && alembic upgrade head

# API docs (Swagger UI)
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
