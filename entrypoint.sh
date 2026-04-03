#!/bin/bash
set -e

# Derive FRONTEND_ORIGIN from NAS_IP (passed in via docker-compose)
export FRONTEND_ORIGIN="http://${NAS_IP:-localhost}:8080"

# Internal service URLs (fixed within single container)
export WA_BRIDGE_URL="http://localhost:3001"
export BACKEND_URL="http://localhost:8000"
export DB_URL="${DB_URL:-sqlite:////app/data/wishing_bot.db}"

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf
