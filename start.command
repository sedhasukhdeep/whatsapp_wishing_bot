#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! docker info &>/dev/null 2>&1; then
  echo "Docker is not running. Please start Docker Desktop and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

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

read -r -p "Press Enter to close..."
