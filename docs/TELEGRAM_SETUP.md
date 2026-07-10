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
https://project-name.vercel.app
```

7. In BotFather open:

```text
/mybots -> select bot -> Bot Settings -> Menu Button / Configure Mini App
```

8. Set the Mini App URL to the Vercel URL.
9. Set backend env to the same frontend origin:

```env
TELEGRAM_WEBAPP_URL=https://project-name.vercel.app
CORS_ORIGINS=https://project-name.vercel.app
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
CORS_ORIGINS=https://project-name.vercel.app
COOKIE_SECURE=true
TELEGRAM_BOT_TOKEN=<token-from-BotFather>
TELEGRAM_WEBAPP_URL=https://project-name.vercel.app
ALLOW_DEV_AUTH=false
```

Local development may use dev auth only with both flags:

```env
NODE_ENV=development
TELEGRAM_WEBAPP_URL=http://localhost:5173
ALLOW_DEV_AUTH=true
```

## Backend Auth Endpoint

`POST /api/auth/telegram`

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

For staging, BotFather's Menu Button / Configure Mini App is enough to open the app. A custom `/start` handler can later reply with an inline button pointing to `TELEGRAM_WEBAPP_URL`, but it is not required for the first Telegram WebView validation.
