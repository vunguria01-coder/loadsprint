#!/usr/bin/env bash
set -e

echo "============================================"
echo "   LoadSprint - Freight Brokerage Platform"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed."
  echo "Please install Node.js 18.18 or newer from https://nodejs.org"
  echo "Then run this script again."
  exit 1
fi

echo "[1/3] Node.js detected: $(node -v)"
echo

if [ ! -d "node_modules" ]; then
  echo "[2/3] Installing dependencies (first run only, this can take a few minutes)..."
  npm install
else
  echo "[2/3] Dependencies already installed. Skipping."
fi
echo

URL="http://localhost:3000"
echo "[3/3] Starting the dev server at $URL"
echo "Opening your browser... (press Ctrl+C to stop the server)"
echo

# open browser (mac: open, linux: xdg-open) without blocking the server
( sleep 3
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  fi
) >/dev/null 2>&1 &

npm run dev
