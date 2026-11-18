#!/usr/bin/env bash
# Start M2 in development mode.
# Server: http://localhost:5001
# Client: http://localhost:3001
set -e

cd "$(dirname "$0")/.."

if ! command -v mongod &>/dev/null && ! pgrep mongod &>/dev/null; then
  echo "Warning: MongoDB does not appear to be running."
  echo "Start it with: mongod --dbpath /data/db"
fi

npm run dev
