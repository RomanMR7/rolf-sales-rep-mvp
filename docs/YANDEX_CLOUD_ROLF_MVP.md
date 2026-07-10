# Yandex Cloud Deployment For ROLF Sales Rep MVP

Do not deploy without real cloud credentials and production domains.

## Target Services

- Frontend for first staging: Vercel static Vite deployment.
- Backend/API: Yandex Serverless Containers or Compute VM.
- Database: Yandex Managed Service for PostgreSQL.
- Alternative static webapp: Yandex Object Storage static website hosting.
- Public static/media: Yandex Object Storage plus Cloud CDN when needed.
- Secrets: environment variables or Yandex Lockbox.

Recommended first staging topology:

```text
Telegram bot -> Vercel frontend -> Yandex HTTPS backend -> Yandex Managed PostgreSQL
```

Vercel must set:

```env
VITE_API_URL=https://your-yandex-backend.example.com
```

## Manual Prerequisites

- Yandex Cloud account with billing enabled.
- `yc` CLI installed and initialized.
- Docker available for backend image build.
- Production domains and DNS access.
- Managed PostgreSQL cluster created or approved for creation.

## Backend Outline

```bash
yc container registry create --name rolf-sales-rep-mvp-registry
yc container registry configure-docker
docker build -f backend/Dockerfile -t cr.yandex/<registry-id>/rolf-sales-rep-mvp-backend:<tag> .
docker push cr.yandex/<registry-id>/rolf-sales-rep-mvp-backend:<tag>
yc serverless container create --name rolf-sales-rep-mvp-api
```

Deploy revisions with full runtime env:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=<random-secret>
CORS_ORIGINS=https://rolf-sales-rep-mvp.vercel.app
COOKIE_SECURE=true
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp.vercel.app
ALLOW_DEV_AUTH=false
```

Production safety:

- `ALLOW_DEV_AUTH=false` for staging and production.
- `COOKIE_SECURE=true` for HTTPS browser auth.
- `CORS_ORIGINS` must be the exact Vercel origin, not `*` and not a URL with a path.
- `TELEGRAM_WEBAPP_URL` must match the Vercel URL configured in BotFather.
- `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, and `JWT_SECRET` must stay in Yandex env/secret storage.

## Static Webapp

```bash
bun run build:webapp
aws --endpoint-url=https://storage.yandexcloud.net/ s3 cp --recursive webapp/dist/ s3://<webapp-bucket>/
```

Configure Object Storage static website hosting with `index.html` as both index and fallback document for SPA refreshes.

## Release Update

1. Run local typecheck/tests/build.
2. Apply Prisma migrations from a protected operator environment.
3. Build and push a new backend image.
4. Deploy a new Serverless Container revision.
5. Upload the new `webapp/dist`.
6. Verify `/health`, webapp route refresh, CORS, and Telegram Mini App opening.
