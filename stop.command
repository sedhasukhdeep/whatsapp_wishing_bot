#!/usr/bin/env bash
cd "$(dirname "$0")"

echo "Stopping Wishing Bot..."
docker compose stop 2>/dev/null || docker-compose stop

echo "All services stopped."
read -r -p "Press Enter to close..."
