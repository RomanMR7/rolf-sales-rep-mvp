# Staging Checklist

Use this checklist before showing the MVP through Telegram.

## Frontend

- Vercel deploy successful.
- `VITE_API_URL` points to the public HTTPS backend.
- Webapp opens by HTTPS.
- Login screen renders.
- Production frontend has no localhost backend fallback.
- Telegram WebApp detection works inside Telegram.
- `window.Telegram.WebApp` exists inside Telegram WebView.
- `initData` is present inside Telegram WebView.

## Backend

- Backend is deployed to a public HTTPS URL.
- Backend public URL opens.
- `GET /` returns 200.
- `GET /health` returns 200.
- `GET /openapi.json` returns 200.
- `POST /api/auth/login` works for seeded demo users if email/password demo auth is enabled for staging.
- `POST /api/auth/telegram` works with real Telegram `initData`.
- `CORS_ORIGINS` includes the exact Vercel URL.
- `COOKIE_SECURE=true`.
- `ALLOW_DEV_AUTH=false`.
- `TELEGRAM_BOT_TOKEN` is configured in secret/env storage.
- `TELEGRAM_WEBAPP_URL` matches the Vercel Mini App URL.
- Database migrations are applied.
- Seed data is loaded if using demo staging.

Backend deploy settings checked:

- Root Directory: repository root.
- Runtime: Docker.
- Dockerfile: `backend/Dockerfile`.
- Docker Context: repository root `.`.
- Start Command: Dockerfile `CMD ["bun", "run", "start"]`.
- Health Check Path: `/health`.
- Backend binds to `0.0.0.0` and reads provider `PORT`.

Database setup checked:

- Managed PostgreSQL created.
- `DATABASE_URL` copied into backend env.
- Migrations applied with `bun run --cwd backend prisma:deploy`.
- Demo seed loaded with `bun run seed` when using demo staging.

## Telegram

- Bot opens the Mini App.
- BotFather Mini App URL is the Vercel URL.
- `initData` exists in the frontend.
- Backend validates `initData`.
- User is created or found by `telegramId`.
- Sales rep dashboard opens.
- Demo flow can be shown from Telegram WebView:
  - scoped clients;
  - create/start/complete visit;
  - create order;
  - submit order;
  - manager approve/reject;
  - rep sees updated status.

## Production Safety

- No secrets are committed.
- `.env` files are not committed.
- `CORS_ORIGINS` is not `*`.
- `CORS_ORIGINS` uses HTTPS origins only when `COOKIE_SECURE=true`.
- Dev auth is disabled outside local development.
- Real Telegram auth fails closed if `TELEGRAM_BOT_TOKEN` is missing.

## Manual Links To Fill

- Vercel URL: `https://rolf-sales-rep-mvp-webapp.vercel.app`
- Backend URL: `https://your-public-backend-url`
- Current Vercel URL: `https://rolf-sales-rep-mvp-webapp.vercel.app`
- BotFather bot: `@your_bot_username`
- Managed PostgreSQL provider: `Neon / Supabase / Render Postgres / Railway Postgres / other`
