# Docker Run — Manual container commands

Alternative to `docker-compose up` if you prefer running containers individually.

## 1. Create shared network and volumes

```bash
docker network create wishing-net
docker volume create wishing-db
docker volume create wishing-wa-session
```

## 2. WhatsApp Bridge

```bash
docker build -t wishing-bridge ./whatsapp-bridge

docker run -d \
  --name wishing-bridge \
  --network wishing-net \
  --restart unless-stopped \
  -v wishing-wa-session:/app/session \
  wishing-bridge
```

## 3. Backend

```bash
docker build -t wishing-backend ./backend

# Set AI_PROVIDER to the provider you want and fill in the corresponding API key.
docker run -d \
  --name wishing-backend \
  --network wishing-net \
  --restart unless-stopped \
  -v wishing-db:/app/data \
  -e AI_PROVIDER="claude" \
  -e ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE" \
  -e OPENAI_API_KEY="" \
  -e OPENAI_MODEL="gpt-4o-mini" \
  -e GEMINI_API_KEY="" \
  -e GEMINI_MODEL="gemini-2.0-flash" \
  -e LOCAL_AI_URL="http://localhost:1234/v1" \
  -e LOCAL_AI_MODEL="" \
  -e DB_URL="sqlite:////app/data/wishing_bot.db" \
  -e WA_BRIDGE_URL="http://wishing-bridge:3001" \
  -e FRONTEND_ORIGIN="http://localhost" \
  -e SCHEDULER_TIMEZONE="Australia/Sydney" \
  -e SCHEDULER_HOUR="8" \
  -e SCHEDULER_MINUTE="0" \
  wishing-backend
```

## 4. Frontend

```bash
docker build -t wishing-frontend ./frontend

docker run -d \
  --name wishing-frontend \
  --network wishing-net \
  --restart unless-stopped \
  -p 80:80 \
  wishing-frontend
```

## 5. Run Alembic migrations (first time only)

```bash
docker exec wishing-backend alembic upgrade head
```

## Access

Open http://localhost — go to **WhatsApp** in the sidebar and scan the QR code.

## Useful commands

```bash
# View logs
docker logs -f wishing-backend
docker logs -f wishing-bridge

# Stop all
docker stop wishing-frontend wishing-backend wishing-bridge

# Remove all
docker rm wishing-frontend wishing-backend wishing-bridge

# Update after code changes
docker build -t wishing-backend ./backend && docker restart wishing-backend
```
