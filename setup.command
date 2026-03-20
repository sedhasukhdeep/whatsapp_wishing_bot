#!/usr/bin/env bash
cd "$(dirname "$0")"

if ! command -v python3 &>/dev/null; then
  echo "Python 3 is required but not found."
  echo "Download it from https://www.python.org/downloads/"
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ -f ".env" ]; then
  echo ".env already exists — skipping setup. Starting app..."
  if [ -f "start.command" ]; then
    bash start.command
  fi
  exit 0
fi

python3 scripts/setup-wizard.py
read -r -p "Press Enter to close..."
