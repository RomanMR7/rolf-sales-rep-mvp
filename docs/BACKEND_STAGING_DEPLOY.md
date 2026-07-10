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

The Dockerfile installs Node.js alongside Bun because Prisma CLI 7 declares a Node runtime requirement. It installs the monorepo dependencies, copies `packages/contracts` and `backend`, generates Prisma Client, returns to repo root `/app`, and starts `backend/scripts/render-start.sh`. That script checks `DATABASE_URL`, prints safe startup diagnostics, applies Prisma migrations through `node node_modules/prisma/build/index.js`, runs the safe idempotent seed, and only then starts the Hono/Bun API. The server binds to `0.0.0.0` and reads the port from `PORT`.

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
   - `Running startup diagnostics...`
   - `node --version:`
   - `Prisma CLI entrypoint exists: node_modules/prisma/build/index.js`
   - `Database hostname:`
   - `DNS resolution for database hostname:`
   - `TCP connection to database ...: ok`
   - `Prisma SELECT 1 diagnostic: ok`
   - `Startup diagnostics completed.`
   - `Running Prisma migrations...`
   - `Prisma migrate deploy exit code: 0`
   - `Prisma migrations completed.`
   - `Running seed...`
   - `Seed completed.`
   - `Starting backend...`
8. Copy the generated public backend URL.
9. Confirm it matches the frontend fallback or set it as optional Vercel `VITE_API_URL` for a future backend URL override.

Render Blueprint notes:

- `runtime: docker`
- `dockerfilePath: ./backend/Dockerfile`
- `dockerContext: .`
- `healthCheckPath: /health`
- migrations and seed run from the container startup script
- Prisma CLI runs directly through Node.js, not through `bun run --cwd backend prisma:deploy`
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

The frontend has a public production fallback for the current Render backend:

```text
https://rolf-sales-rep-mvp-backend.onrender.com
```

`VITE_API_URL` is now optional. If it is set to a valid URL, the frontend tries it first. If it is missing, empty, invalid, or the browser request fails with a network error, the frontend retries the Render fallback. This means the Vercel MVP no longer depends on changing a locked Sensitive `VITE_API_URL` variable.

Only set this in Vercel when intentionally overriding the fallback:

```env
VITE_API_URL=https://your-public-backend-url
```

Then redeploy the Vercel frontend.

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
- Startup diagnostics print only the database hostname, port, database name, and schema parameter. They never print the full `DATABASE_URL`, username, password, or Telegram token.
