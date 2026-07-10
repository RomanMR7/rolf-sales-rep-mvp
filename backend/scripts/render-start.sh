#!/bin/sh
set -eu

PRISMA_CLI="node_modules/prisma/build/index.js"
PRISMA_CONFIG="backend/prisma.config.ts"
PRISMA_SCHEMA="backend/prisma/schema.prisma"

echo "Checking DATABASE_URL..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required. Set it in Render environment variables." >&2
  exit 1
fi

echo "Running startup diagnostics..."
echo "Current directory from shell: $(pwd)"
echo "bun --version: $(bun --version)"
if command -v node >/dev/null 2>&1; then
  echo "node --version: $(node --version)"
else
  echo "node --version: not found"
fi
if [ -f "$PRISMA_CLI" ]; then
  echo "Prisma CLI entrypoint exists: $PRISMA_CLI"
else
  echo "Prisma CLI entrypoint is missing: $PRISMA_CLI" >&2
  exit 1
fi
if [ -f "$PRISMA_SCHEMA" ]; then
  echo "Prisma schema exists: $PRISMA_SCHEMA"
else
  echo "Prisma schema is missing: $PRISMA_SCHEMA" >&2
  exit 1
fi
if [ -f "$PRISMA_CONFIG" ]; then
  echo "Prisma config exists: $PRISMA_CONFIG"
else
  echo "Prisma config is missing: $PRISMA_CONFIG" >&2
  exit 1
fi
echo "Prisma CLI version:"
node "$PRISMA_CLI" --version 2>&1
bun backend/scripts/startup-diagnostics.ts
echo "Startup diagnostics completed."

echo "Running Prisma migrations..."
set +e
node "$PRISMA_CLI" migrate deploy --config "$PRISMA_CONFIG" --schema "$PRISMA_SCHEMA" 2>&1
MIGRATION_EXIT_CODE=$?
set -e
echo "Prisma migrate deploy exit code: $MIGRATION_EXIT_CODE"
if [ "$MIGRATION_EXIT_CODE" -ne 0 ]; then
  echo "Prisma migration failed."
  exit "$MIGRATION_EXIT_CODE"
fi
echo "Prisma migrations completed."

echo "Running seed..."
bun run --cwd backend seed
echo "Seed completed."

echo "Starting backend..."
exec bun run --cwd backend start:api
