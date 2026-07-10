FROM oven/bun:1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock bunfig.toml ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY backend/package.json backend/package.json
COPY webapp/package.json webapp/package.json
COPY website/package.json website/package.json

RUN bun install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY backend backend

WORKDIR /app/backend

RUN DATABASE_URL="postgresql://superuser:superpassword@localhost:5432/rolf_sales_rep_mvp?schema=public" bun run prisma:generate
RUN chmod +x /app/backend/scripts/render-start.sh

WORKDIR /app

ENV NODE_ENV=production

CMD ["sh", "backend/scripts/render-start.sh"]
