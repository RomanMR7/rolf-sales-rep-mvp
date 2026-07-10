# Backend Staging Deploy

This project is ready to run the backend as a separate public HTTPS service from the monorepo.

Recommended MVP staging topology:

```text
Telegram bot -> Vercel frontend -> Render backend -> managed PostgreSQL
```

Other acceptable backend hosts: Railway, Fly.io, Yandex Cloud, or a VPS with HTTPS.

Do not commit real env values or secrets.

## Backend Service Shape

- Root Directory: repository root
- Runtime: Docker
- Dockerfile: `backend/Dockerfile`
- Docker Context: repository root `.`
- Start Command: Dockerfile `CMD ["bun", "run", "start"]`
- Health Check Path: `/health`
- Public protocol: HTTPS
- Port: provider `PORT` environment variable

The Dockerfile installs the monorepo dependencies, copies `packages/contracts` and `backend`, generates Prisma Client, and starts the Hono/Bun API. The server binds to `0.0.0.0` and reads the port from `PORT`.

## Render Deploy

The repository includes `render.yaml` for a Render Blueprint.

1. Open Render.
2. Create a new Blueprint from the GitHub repository.
3. Select branch `main`.
4. Confirm service `rolf-sales-rep-mvp-backend`.
5. Fill all `sync: false` environment variables.
6. Deploy the service.
7. Copy the generated public backend URL.
8. Use that URL as Vercel `VITE_API_URL`.

Render Blueprint notes:

- `runtime: docker`
- `dockerfilePath: ./backend/Dockerfile`
- `dockerContext: .`
- `healthCheckPath: /health`
- sensitive env values are not stored in git

## Backend Environment

Set these on the backend hosting provider:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random-32-plus-character-secret>
CORS_ORIGINS=https://your-vercel-url.vercel.app
COOKIE_SECURE=true
TELEGRAM_BOT_TOKEN=<bot-token-from-BotFather>
TELEGRAM_WEBAPP_URL=https://your-vercel-url.vercel.app
ALLOW_DEV_AUTH=false
```

Optional storage env can stay empty until uploads/media are needed:

```env
SPACES_REGION=
SPACES_BUCKET=
SPACES_ENDPOINT=
SPACES_CDN_BASE_URL=
SPACES_ACCESS_KEY_ID=
SPACES_SECRET_ACCESS_KEY=
```

## PostgreSQL Staging

Use a managed PostgreSQL provider, for example Neon, Supabase, Render Postgres, Railway Postgres, Yandex Managed PostgreSQL, or another managed PostgreSQL service.

1. Create a managed PostgreSQL database.
2. Copy the connection string.
3. Set it as backend env `DATABASE_URL`.
4. Apply existing migrations from an operator shell:

```bash
bun run --cwd backend prisma:deploy
```

For local development migration creation, use:

```bash
bun run --cwd backend prisma:migrate
```

5. For demo staging, load seed data:

```bash
bun run seed
```

or:

```bash
bun run --cwd backend seed
```

6. Verify the public backend:

```text
GET /
GET /health
GET /openapi.json
```

## Railway / Fly.io / VPS Notes

Use the same Docker shape:

- Build from repository root.
- Use `backend/Dockerfile`.
- Expose the provider-assigned `PORT` env to the app.
- Set the same backend env values listed above.
- Run `bun run --cwd backend prisma:deploy` before the first demo.
- Run `bun run seed` only for demo staging data.

## Vercel Connection

After backend deploy, set this in Vercel:

```env
VITE_API_URL=https://your-public-backend-url
```

Then redeploy the Vercel frontend.

## Safety

- `ALLOW_DEV_AUTH=false` on staging/prod.
- `CORS_ORIGINS` must be the exact Vercel URL, not `*`.
- `TELEGRAM_WEBAPP_URL` must equal the Vercel URL configured in BotFather.
- `COOKIE_SECURE=true` for HTTPS.
- Never commit `.env` files or provider secrets.
