# Telegram Setup

This document describes the staging path:

```text
Telegram bot -> Vercel frontend -> public HTTPS backend -> PostgreSQL
```

Do not commit bot tokens, database URLs, JWT secrets, or `.env` files.

## BotFather And Vercel Flow

1. Open `@BotFather` in Telegram.
2. Create a bot with `/newbot`.
3. Copy the bot token and store it only in backend secret/env storage.
4. Set backend env:

```env
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
```

5. Deploy the frontend webapp to Vercel.
6. Copy the Vercel URL:

```text
https://rolf-sales-rep-mvp-webapp.vercel.app
```

7. In BotFather open:

```text
/mybots -> select bot -> Bot Settings -> Menu Button / Configure Mini App
```

8. Set the Mini App URL to the Vercel URL.
9. In BotFather configure both production entry points when available:

```text
Main Mini App URL: https://rolf-sales-rep-mvp-webapp.vercel.app
Menu Button URL: https://rolf-sales-rep-mvp-webapp.vercel.app
/start command: Opens the ROLF Sales App Mini App
Direct link: https://t.me/<botusername>?startapp
```

The backend exposes launch metadata at:

```text
GET /telegram/config
GET /api/telegram/config
```

It returns the configured bot username, webapp URL, menu URL, `/start` command, and direct `startapp` link when `TELEGRAM_BOT_USERNAME` is set.

9. Set backend env to the same frontend origin:

```env
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
CORS_ORIGINS=https://rolf-sales-rep-mvp-webapp.vercel.app
```

10. Deploy or restart the backend with the updated env.
11. Open the bot in Telegram.
12. Press the Mini App menu button.
13. Confirm the frontend detects Telegram:

```text
window.Telegram.WebApp
initData present
```

14. Confirm the backend accepts:

```text
POST /api/auth/telegram
```

15. Confirm the user is created or found by Telegram identity and lands on the sales rep dashboard.

Short BotFather staging checklist:

```text
1. Open @BotFather
2. /mybots
3. Select bot
4. Bot Settings
5. Menu Button / Configure Mini App
6. Set Mini App URL to Vercel URL
7. Backend TELEGRAM_WEBAPP_URL must equal the same Vercel URL
8. Backend CORS_ORIGINS must include the same Vercel URL
```

## Vercel Settings

Use Vercel for the Vite frontend only:

```text
Root Directory: webapp
Framework Preset: Vite
Install Command: bun install
Build Command: bun run build
Output Directory: dist
Environment Variable: VITE_API_URL=https://your-backend-url.example.com
```

`VITE_API_URL` must point to the public HTTPS backend. The frontend does not use a production localhost fallback.

## Backend Environment

Staging/prod backend env:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random-32-plus-character-secret>
CORS_ORIGINS=https://rolf-sales-rep-mvp-webapp.vercel.app
COOKIE_SECURE=true
BOT_TOKEN=<token-from-BotFather>
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
TELEGRAM_BOT_USERNAME=<botusername>
WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
BACKEND_PUBLIC_URL=https://rolf-sales-rep-mvp-backend.onrender.com
ADMIN_TELEGRAM_IDS=123456789,987654321
ALLOW_DEV_AUTH=false
```

`BOT_TOKEN`/`WEBAPP_URL` are accepted aliases for `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBAPP_URL`. Prefer setting the explicit `TELEGRAM_*` names in Render, and keep aliases only when a provider or bot integration already uses them.

`ADMIN_TELEGRAM_IDS` bootstraps the first owner accounts. A Telegram user whose signed `initData` has an ID in that comma-separated list becomes `OWNER` with `ACTIVE` status. Unknown Telegram users become `VIEWER` with `INVITED` status until an owner/admin promotes or activates them.

Local development may use dev auth only with both flags:

```env
NODE_ENV=development
TELEGRAM_WEBAPP_URL=http://localhost:5173
ALLOW_DEV_AUTH=true
```

## Backend Auth Endpoint

`POST /api/auth/telegram`

Compatibility aliases:

```text
POST /auth/telegram
GET /me
```

Telegram payload:

```json
{
  "initData": "raw Telegram WebApp initData string"
}
```

Local-only dev payload:

```json
{
  "devUser": {
    "telegramId": "100001",
    "username": "demo_sales_rep",
    "firstName": "Demo",
    "lastName": "Rep"
  }
}
```

## Production Safety

- `ALLOW_DEV_AUTH=false` for staging and production.
- Dev login must not be used for staging or production demos.
- Backend accepts `devUser` only when `NODE_ENV=development` and `ALLOW_DEV_AUTH=true`.
- If `TELEGRAM_BOT_TOKEN` is missing, real Telegram auth returns a backend configuration error.
- `COOKIE_SECURE=true` for HTTPS.
- `CORS_ORIGINS` must include the exact Vercel origin and must not be `*`.
- `TELEGRAM_WEBAPP_URL` should match the Vercel Mini App URL configured in BotFather.
- Secrets stay in provider env/secret storage, not in git.

## Minimal Bot Behavior

For staging, BotFather's Menu Button / Configure Mini App is enough to open the app. The backend now includes a minimal dependency-free bot helper in `backend/src/telegram/bot.ts` and webhook route for `/start`, `/help`, and `/settings`. It builds an inline keyboard button with `web_app.url = TELEGRAM_WEBAPP_URL`.

Production webhook endpoint:

```text
POST https://rolf-sales-rep-mvp-backend.onrender.com/telegram/webhook
```

Set it once through the Telegram Bot API after Render deploys the backend:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://rolf-sales-rep-mvp-backend.onrender.com/telegram/webhook"
```

After that, `/start`, `/help`, and `/settings` return a message with an `Open ROLF Sales App` Mini App button.

Render env vars for that bot layer:

```env
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
TELEGRAM_BOT_USERNAME=<botusername>
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
BACKEND_PUBLIC_URL=https://rolf-sales-rep-mvp-backend.onrender.com
```
