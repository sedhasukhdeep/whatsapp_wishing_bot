#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! docker info &>/dev/null 2>&1; then
  echo "Docker is not running. Please start Docker Desktop and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# Detect if containers are already running
RUNNING=$(docker compose ps --filter status=running --quiet 2>/dev/null | wc -l | tr -d ' ')

if [ "$RUNNING" -gt 0 ]; then
  echo "Wishing Bot is running."
  echo ""
  echo "  s  — Stop the app"
  echo "  o  — Open in browser"
  echo "  q  — Quit this window"
  echo ""
  read -r -p "Your choice: " choice
  case "$choice" in
    s|S)
      echo "Stopping Wishing Bot..."
      docker compose stop 2>/dev/null || docker-compose stop
      echo "Stopped."
      ;;
    o|O)
      open http://localhost 2>/dev/null || xdg-open http://localhost 2>/dev/null
      ;;
    *)
      ;;
  esac
else
  echo "Starting Wishing Bot..."
  docker compose up -d 2>/dev/null || docker-compose up -d

  echo "Waiting for app to be ready..."
  for i in $(seq 1 30); do
    if curl -s http://localhost/health &>/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  echo "Opening http://localhost ..."
  open http://localhost 2>/dev/null || xdg-open http://localhost 2>/dev/null
fi

read -r -p "Press Enter to close..."
