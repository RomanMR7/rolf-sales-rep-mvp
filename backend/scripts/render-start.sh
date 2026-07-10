#!/bin/sh
set -eu

echo "Checking DATABASE_URL..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required. Set it in Render environment variables." >&2
  exit 1
fi

echo "Running Prisma migrations..."
bun run --cwd backend prisma:deploy
echo "Prisma migrations completed."

echo "Running seed..."
bun run --cwd backend seed
echo "Seed completed."

echo "Starting backend..."
exec bun run --cwd backend start:api
