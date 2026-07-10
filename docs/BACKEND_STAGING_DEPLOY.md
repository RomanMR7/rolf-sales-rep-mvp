# Backend Staging Deploy

This project is ready to run the backend as a separate public HTTPS service from the monorepo.

Recommended MVP staging topology:

```text
Telegram bot -> Vercel frontend -> Render backend -> managed PostgreSQL
```

Current Vercel frontend origin:

```text
https://rolf-sales-rep-mvp-webapp.vercel.app
```

Other acceptable backend hosts: Railway, Fly.io, Yandex Cloud, or a VPS with HTTPS.

Do not commit real env values or secrets.

## Backend Service Shape

- Root Directory: repository root
- Runtime: Docker
- Dockerfile: `backend/Dockerfile`
- Docker Context: repository root `.`
- Start Command: Dockerfile `CMD ["sh", "backend/scripts/render-start.sh"]`
- Health Check Path: `/health`
- Public protocol: HTTPS
- Port: provider `PORT` environment variable

The Dockerfile installs the monorepo dependencies, copies `packages/contracts` and `backend`, generates Prisma Client, returns to repo root `/app`, and starts `backend/scripts/render-start.sh`. That script checks `DATABASE_URL`, applies Prisma migrations, runs the safe idempotent seed, and only then starts the Hono/Bun API. The server binds to `0.0.0.0` and reads the port from `PORT`.

## Render Deploy

The repository includes `render.yaml` for a Render Blueprint.

1. Open Render.
2. Create a new Blueprint from the GitHub repository.
3. Select branch `main`.
4. Confirm service `rolf-sales-rep-mvp-backend`.
5. Fill all `sync: false` environment variables: `DATABASE_URL` and `TELEGRAM_BOT_TOKEN`.
6. Deploy the service.
7. Watch the deploy logs for:
   - `Checking DATABASE_URL...`
   - `Running Prisma migrations...`
   - `Prisma migrations completed.`
   - `Running seed...`
   - `Seed completed.`
   - `Starting backend...`
8. Copy the generated public backend URL.
9. Use that URL as Vercel `VITE_API_URL`.

Render Blueprint notes:

- `runtime: docker`
- `dockerfilePath: ./backend/Dockerfile`
- `dockerContext: .`
- `healthCheckPath: /health`
- migrations and seed run from the container startup script
- sensitive env values are not stored in git
- current Vercel origin is already wired into `CORS_ORIGINS` and `TELEGRAM_WEBAPP_URL`
- no Render Shell, One-Off Jobs, paid jobs, or Pre-Deploy Command are required

## Backend Environment

Set these on the backend hosting provider:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<random-32-plus-character-secret>
CORS_ORIGINS=https://rolf-sales-rep-mvp-webapp.vercel.app
COOKIE_SECURE=true
TELEGRAM_BOT_TOKEN=<bot-token-from-BotFather>
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
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
4. Deploy or redeploy the Render service. The container applies existing migrations automatically with `prisma migrate deploy`.

For local development migration creation only, use:

```bash
bun run --cwd backend prisma:migrate
```

5. The container runs the seed automatically after migrations. The seed creates missing demo data only and does not update existing users, products, clients, visits, orders, or order items.
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
- Let `backend/scripts/render-start.sh` run migrations and seed at container startup, or use the same command chain on the host if your provider supports only custom start commands.

## Vercel Connection

After backend deploy, set this in Vercel:

```env
VITE_API_URL=https://your-public-backend-url
```

Then redeploy the Vercel frontend.

Current Vercel deployment was reachable, but the built bundle did not contain a Render backend URL yet. After Render creates the backend URL, Vercel must be updated and redeployed.

For this project, Render backend env should use:

```env
CORS_ORIGINS=https://rolf-sales-rep-mvp-webapp.vercel.app
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app
```

BotFather Mini App URL should be:

```text
https://rolf-sales-rep-mvp-webapp.vercel.app
```

## Safety

- `ALLOW_DEV_AUTH=false` on staging/prod.
- `CORS_ORIGINS` must be the exact Vercel URL, not `*`.
- `TELEGRAM_WEBAPP_URL` must equal the Vercel URL configured in BotFather.
- `COOKIE_SECURE=true` for HTTPS.
- Never commit `.env` files or provider secrets.
- If migrations or seed fail, the container exits and the backend does not start in a partially initialized state.
