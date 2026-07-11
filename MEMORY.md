# MEMORY.md

## Project Context

Здесь будет храниться постоянный контекст проекта.

## Current Goal

Подготовить локальное окружение проекта, чтобы Codex мог стабильно работать с Bun, зависимостями и памятью.

## Environment Notes

* Bun должен быть установлен и доступен через PATH.
* Если memory CLI недоступен, использовать этот файл как основной источник памяти.
* Все важные решения по проекту записывать сюда.

## Setup Status

* Bun: installed and available through PATH
* Dependencies: installed with `bun install`
* Memory CLI: checked; `memanto`/`memento` unavailable, fallback file is active
* Fallback memory file: created
* Validation: `bun run` lists scripts; `bun run test:contracts` passes

## Environment Fix Status

* Bun: installed and working
* Package manager: Bun
* Dependencies: install works through Bun
* Contracts test: `bun run test:contracts` passed, 5 pass, 0 fail
* memanto/memento CLI: unavailable as external CLI
* Memory fallback: `MEMORY.md`
* Decision: do not block project work on unavailable memanto/memento CLI

## Agent Memory Rule

Before starting work:

* Read `MEMORY.md`.

During work:

* Use `MEMORY.md` as the source of persistent project memory.
* Do not require `memanto` or `memento` unless they become available later.

After important changes:

* Update `MEMORY.md` with decisions, commands, fixes, and unresolved problems.

## Decisions

* Use Bun for this monorepo because root `package.json` uses Bun scripts, workspaces, and `bun.lock`.
* Use `MEMORY.md` as the project memory fallback while `memanto`/`memento` CLI is unavailable.

## Next Steps

* При необходимости запустить `docker compose up -d postgres`, затем `bun run dev:backend` и `bun run dev:webapp`.
* Обновлять этот файл после важных изменений.

## MVP State Check - 2026-07-10

Backend:

* Backend command: `bun run dev:backend`.
* Backend listens on `http://localhost:3000/`.
* Working root endpoint: `GET /` returns backend name and `status: ok`.
* Working health endpoint: `GET /health` returns `status: ok`.
* Working OpenAPI endpoint: `GET /openapi.json`.
* Not present: `/api/health`, `/docs`, `/openapi`.

Current API endpoints from OpenAPI:

* `POST /api/auth/register`
* `POST /api/auth/login`
* `POST /api/auth/refresh`
* `GET /api/auth/me`
* `POST /api/auth/logout`

Database and Prisma:

* Prisma schema currently has `User` and `AuthSession` models only.
* One migration exists: `20260516170057_init`.
* Local migration status check showed the init migration is not yet applied to local PostgreSQL.
* Safe command to apply local dev migration: `bun run --cwd backend prisma:migrate`.
* Do not reset or delete database data without explicit confirmation.

Frontend:

* Frontend app is `webapp`.
* Frontend command: `bun run dev:webapp`.
* Vite successfully served the frontend on `http://127.0.0.1:5174/` during verification; default project URL is `http://localhost:5173/`.
* `bun run --cwd webapp typecheck` passed.

Telegram Mini App:

* UI is Telegram Mini App-oriented, but no code-level Telegram WebApp SDK/initData integration exists yet.
* Backend `.env.example` contains Telegram variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `ALLOW_DEV_AUTH`.
* Next MVP step: add real Telegram WebApp frontend initialization plus backend `initData` auth validation endpoint, then wire dev auth only for `NODE_ENV=development` with `ALLOW_DEV_AUTH=true`.

Remaining problems:

* Product/customer/order/visit/admin/sales-rep API endpoints are not implemented yet.
* Prisma models for roles, client points, products, orders, and visits are not implemented yet.
* Browser-level Telegram auth should be tested manually through Telegram WebView when a real bot and public URL are available.

## Telegram Auth Foundation - 2026-07-10

Migrations:

* Applied initial migration `20260516170057_init` safely with `bun run --cwd backend prisma:migrate`.
* Added and applied migration `20260710023000_add_telegram_auth_fields`.
* Current Prisma status: 2 migrations found, database schema is up to date.
* Prisma Client regenerated with `bun run --cwd backend prisma:generate`.

Schema/auth changes:

* `User` now has `role`, `telegramId`, `telegramUsername`, `telegramFirstName`, and `telegramLastName`.
* Added `UserRole` enum: `ADMIN`, `MANAGER`, `SALES_REP`.
* Existing email/password auth remains active.
* Telegram-created users receive role `SALES_REP`, a synthetic local email, and a random password hash.

Backend endpoint:

* Added `POST /api/auth/telegram`.
* OpenAPI current-code check contains `/api/auth/telegram`.
* Production path validates raw Telegram WebApp `initData` on backend with HMAC-SHA256 and 24-hour `auth_date` TTL.
* Dev fallback accepts `devUser` only when `NODE_ENV=development` and `ALLOW_DEV_AUTH=true`.
* Verified dev fallback returned `200` with user `100001`, role `SALES_REP`, and access token.
* Verified production with `devUser` returned `403 FORBIDDEN`.

Frontend:

* Added `window.Telegram.WebApp` TypeScript declaration.
* Webapp calls `ready()`, calls `expand()` when available, reads `initData`, and displays `initDataUnsafe.user` only as untrusted UI/debug data.
* Webapp sends `initData` to `POST /api/auth/telegram`.
* Webapp shows local "Dev login" in Vite dev mode; backend still enforces the real dev fallback gate.

Validation:

* `bun run test:contracts` passed.
* `bun run --cwd backend test:unit` passed: 27 pass, 0 fail.
* `bun run --cwd backend typecheck` passed.
* `bun run --cwd webapp typecheck` passed.
* Targeted webapp auth/API tests passed: 14 pass, 0 fail.
* Full `bun run test:webapp` still fails in typography tests because `node_modules/@babel/types/lib/validators/generated/index.js` is missing; auth/API tests are green.

Next MVP step:

* Restart backend dev server so `/openapi.json` on `localhost:3000` reflects `/api/auth/telegram`, then test the webapp dev login from `http://localhost:5173`.
* After auth foundation is verified in browser, add role-aware sales rep/admin MVP models and endpoints.

## Sales MVP Core - 2026-07-10

Prisma and seed:

* Added and applied migration `20260710055351_add_sales_mvp_core`.
* Current Prisma status: 3 migrations found, database schema is up to date.
* Added models: `ClientPoint`, `ProductCategory`, `Product`, `Visit`, `Order`, `OrderItem`.
* Added enums: `ClientPointType`, `ClientPointStatus`, `VisitStatus`, `VisitResult`, `OrderStatus`.
* Added `bun run seed` root script and `bun run --cwd backend seed`.
* Seed creates 1 admin, 1 manager, 3 sales reps, 20 client points, 5 product categories, 22 demo products, visits, and demo orders.
* Demo credentials: `admin@rolf-demo.local`, `manager@rolf-demo.local`, `rep1@rolf-demo.local`, `rep2@rolf-demo.local`, `rep3@rolf-demo.local`; password `DemoPass123!`.
* Catalog note: demo nomenclature must be replaced by the client's real price list.

Backend API:

* Added role-aware API for:
  * `GET /api/dashboard`
  * `GET|POST /api/clients`
  * `GET|PATCH|DELETE /api/clients/:id`
  * `GET|POST /api/product-categories`
  * `PATCH /api/product-categories/:id`
  * `GET|POST /api/products`
  * `GET|PATCH|DELETE /api/products/:id`
  * `GET|POST /api/visits`
  * `GET /api/visits/today`
  * `POST /api/visits/:id/start`
  * `POST /api/visits/:id/complete`
  * `POST /api/visits/:id/skip`
  * `GET|POST /api/orders`
  * `GET|PATCH /api/orders/:id`
  * `POST /api/orders/:id/submit`
  * `POST /api/orders/:id/approve`
  * `POST /api/orders/:id/reject`
  * `POST /api/orders/:id/cancel`
* Role behavior verified by smoke: `rep1` sees 7 clients; manager sees 20 clients.
* OpenAPI current-code smoke contains `/api/dashboard`, `/api/clients`, `/api/products`, `/api/product-categories`, `/api/visits`, `/api/orders`.

Frontend:

* Webapp now shows role-aware MVP screens after login: Dashboard/Today, Clients, Catalog, Orders, Visits, Admin.
* Sales reps see their scoped data from backend.
* Manager/admin can see manager/admin navigation and approve/reject submitted orders.
* UI keeps Telegram auth/dev login screen for unauthenticated users.

Validation:

* `bun run test:contracts` passed: 5 pass, 0 fail.
* `bun run --cwd backend test:unit` passed: 32 pass, 0 fail.
* `bun run --cwd backend typecheck` passed.
* `bun run --cwd webapp typecheck` passed.
* Targeted webapp auth/API/env tests passed: 14 pass, 0 fail.
* Full `bun run test:webapp` remains expected to fail on unrelated typography/Babel generated file issue noted earlier.

Next MVP step:

* Restart backend/frontend dev servers and manually click through demo flow:
  sales rep login -> dashboard -> clients -> create visit -> create order -> submit -> manager login -> approve/reject.
* Then add fuller forms and user management if the client wants deeper demo interaction.

## Demo Readiness Check - 2026-07-10

Code changes:

* Added local demo email/password login to the Telegram auth screen for seeded users.
* Cleared all TanStack Query cache on logout to avoid stale rep/manager/admin data between demo logins.
* Enabled client-to-order handoff from the Clients screen.
* Expanded Orders UI to choose client, products, quantity, item discount, order discount, comment, and show calculated subtotal/discount/total.
* Added manager approve/reject comments in the Orders UI.
* Added catalog category filtering and clearer product active/inactive display.
* Added dashboard guidance and today's visit preview.

Verified demo flow:

* API smoke passed against local PostgreSQL with real seeded users.
* `rep1@rolf-demo.local` login works and returns role `SALES_REP`.
* `rep1` sees 7 assigned clients.
* Sales rep created a visit, started it, and completed it with result `ORDER_CREATED`.
* Sales rep created an order with 2 products, quantity, item discount, and order discount.
* Total calculation checked: subtotal `AED 246`, discount `AED 15`, total `AED 231`.
* Sales rep submitted the order.
* `manager@rolf-demo.local` saw the submitted order and approved it.
* Sales rep saw the approved status after manager action.
* `admin@rolf-demo.local` saw 20 seeded clients.

Commands run:

* `docker compose up -d postgres`
* `bun run --cwd backend prisma:migrate`
* `bun run seed`
* `bun run --cwd backend prisma migrate status`
* `bun run --cwd webapp typecheck`
* `bun run --cwd backend typecheck`
* `bun run test:contracts`
* `bun run --cwd backend test:unit`
* `bun test webapp/tests/api.test.ts webapp/tests/auth-queries.test.ts webapp/tests/e2e-env.test.ts`
* `bun run test:webapp`

Validation status:

* `bun run --cwd webapp typecheck` passed.
* `bun run --cwd backend typecheck` passed.
* `bun run test:contracts` passed.
* `bun run --cwd backend test:unit` passed.
* Targeted webapp API/auth/env tests passed: 14 pass, 0 fail.
* Full `bun run test:webapp` still fails on unrelated typography policy/Babel generated-file issue: missing `node_modules/@babel/types/lib/validators/generated/index.js`, plus one typography render timeout.

Server check:

* Backend dev server log showed `Backend listening on http://localhost:3000/`.
* Frontend dev server served `http://127.0.0.1:5173/` with HTTP 200.
* After stopping the check process, `localhost:3000/health` returned 503 from a leftover local process/state; do not kill unknown user processes without confirmation.

Docs updated:

* `README.md`
* `docs/CLIENT_DEMO_SCRIPT.md`
* `docs/MVP_SCOPE.md`
* `MEMORY.md`

Remaining problems:

* Full browser click-through in an actual Telegram WebView still needs a real bot and public HTTPS URL.
* Full `test:webapp` typography policy issue remains outside the sales MVP demo flow.
* Demo catalog/client data must be replaced by real Dubai client data and price list before production.

Next MVP step:

* Fix or reinstall the webapp typography/Babel test dependency, then run a browser Playwright-style click-through for the exact client demo path.
* After that, prepare Telegram bot/public HTTPS staging and validate real Telegram `initData`.

## Staging Deploy Readiness - 2026-07-10

Scope:

* Prepared project documentation and frontend API configuration for Telegram staging through:
  `Telegram bot -> Vercel frontend -> public HTTPS backend -> PostgreSQL`.
* Did not add business features, models, roles, imports, maps, geolocation, offline mode, or integrations.

Frontend/Vercel:

* `bun run --cwd webapp build` passed.
* Webapp production API base URL now comes from `VITE_API_URL`; the production frontend code no longer has a localhost backend fallback.
* Tests use an explicit `apiBaseUrl` override for API client unit tests.
* No `localhost:3000` or `127.0.0.1:3000` matches remain in `webapp` outside README/env example/build/node_modules exclusions.
* No `webapp/vercel.json` was added because Vercel can build with project settings.

Backend hosting readiness:

* Backend staging env documented:
  `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `COOKIE_SECURE=true`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`, `ALLOW_DEV_AUTH=false`.
* CORS must include exact Vercel URL such as `https://rolf-sales-rep-mvp.vercel.app`.
* `TELEGRAM_WEBAPP_URL` must match the Vercel Mini App URL configured in BotFather.
* Backend code already rejects wildcard/path-bearing CORS origins and rejects HTTP origins when `COOKIE_SECURE=true`.
* Telegram auth already fails closed when `TELEGRAM_BOT_TOKEN` is missing.
* Telegram dev auth remains gated by `NODE_ENV=development` plus `ALLOW_DEV_AUTH=true`.

Docs updated:

* `README.md`: added Vercel deploy settings, backend HTTPS hosting options, env, and production safety notes.
* `docs/TELEGRAM_SETUP.md`: replaced short setup with BotFather + Vercel + backend env flow.
* `docs/STAGING_CHECKLIST.md`: added frontend/backend/Telegram staging smoke checklist.
* `docs/YANDEX_CLOUD_ROLF_MVP.md`: clarified Vercel frontend + Yandex backend/database option.
* `MEMORY.md`: recorded staging readiness state.

Validation:

* `bun run --cwd webapp build` passed.
* `bun run --cwd webapp typecheck` passed.
* `bun run --cwd backend typecheck` passed.
* `bun run test:contracts` passed: 5 pass, 0 fail.
* `bun run --cwd backend test:unit` passed: 32 pass, 0 fail.
* `bun test webapp/tests/api.test.ts webapp/tests/auth-queries.test.ts webapp/tests/e2e-env.test.ts` passed: 14 pass, 0 fail.

Remaining staging blockers:

* Need real public HTTPS backend URL and managed PostgreSQL.
* Need real Vercel deployment URL.
* Need production/staging `TELEGRAM_BOT_TOKEN`.
* Need BotFather Mini App menu configured to the Vercel URL.
* Need real Telegram WebView smoke with `initData`.
* Existing full `bun run test:webapp` typography/Babel generated validator issue remains unrelated to staging deploy readiness.

## GitHub Push Preparation - 2026-07-10

User provided GitHub repository URL:

* `https://github.com/RomanMR7/rolf-sales-rep-mvp.git`

Secret handling:

* User provided a Telegram bot token in chat.
* Do not store or commit the token.
* Use the token only as backend hosting environment variable `TELEGRAM_BOT_TOKEN`.
* Do not print the full token in reports.

Security checks run:

* `git check-ignore -v .env backend/.env webapp/.env`
* `git grep` for the token prefix
* `git log -S` for the token prefix
* `rg` token-prefix scan across working files excluding `.git` and `node_modules`

Status:

* Token prefix was not found in tracked files, git history, or working files.
* `.env`, `backend/.env`, `webapp/.env`, `node_modules/`, `dist/`, `.scratch/`, `.vercel/`, and `coverage/` are ignored.

## Backend Staging Deploy Readiness - 2026-07-10

Scope:

* Prepared backend staging deploy docs and helper files only.
* Did not add business features or change the sales MVP flow.

Recommended staging topology:

* Telegram bot -> Vercel frontend -> Render backend -> managed PostgreSQL.
* Alternatives remain Railway, Fly.io, Yandex Cloud, or VPS with HTTPS.

Backend deploy shape:

* Root Directory: repository root.
* Runtime: Docker.
* Dockerfile: `backend/Dockerfile`.
* Docker Context: repository root `.`.
* Start Command: Dockerfile `CMD ["bun", "run", "start"]`.
* Health Check Path: `/health`.
* Backend now explicitly binds to `0.0.0.0` and reads provider `PORT`.

Files added/updated:

* Added `render.yaml` Render Blueprint for Docker web service without secrets.
* Added `docs/BACKEND_STAGING_DEPLOY.md`.
* Updated `README.md` with backend Render settings, migration/seed commands, and doc link.
* Updated `docs/STAGING_CHECKLIST.md` with backend deploy, DB, Telegram, and demo flow checks.
* Updated `docs/TELEGRAM_SETUP.md` with short BotFather staging checklist.

Backend env required:

* `DATABASE_URL`
* `JWT_SECRET`
* `CORS_ORIGINS`
* `COOKIE_SECURE=true`
* `TELEGRAM_BOT_TOKEN`
* `TELEGRAM_WEBAPP_URL`
* `ALLOW_DEV_AUTH=false`

Staging DB commands:

* Apply existing migrations with `bun run --cwd backend prisma:deploy`.
* Load demo data with `bun run seed` or `bun run --cwd backend seed`.
* Use `bun run --cwd backend prisma:migrate` only for local/dev migration creation.

Validation:

* `bun run --cwd webapp build` passed.
* `bun run --cwd webapp typecheck` passed.
* `bun run --cwd backend typecheck` passed.
* `bun run test:contracts` passed: 5 pass, 0 fail.
* `bun run --cwd backend test:unit` passed: 32 pass, 0 fail.
* `bun test webapp/tests/api.test.ts webapp/tests/auth-queries.test.ts webapp/tests/e2e-env.test.ts` passed: 14 pass, 0 fail.
* Production webapp code still has no `localhost:3000` fallback.
* Token prefix scan across working files found no matches.
* `.env`, `backend/.env`, and `webapp/.env` remain ignored/not tracked.

Notes:

* Render Blueprint docs confirm `render.yaml` lives at repository root and supports Docker web services.
* Render web services should bind to `0.0.0.0` and read provider `PORT`; backend now does that.
* Changes are not committed unless the user explicitly asks.

## Render/Vercel Staging Follow-up - 2026-07-10

User provided Vercel frontend URL:

* `https://rolf-sales-rep-mvp-webapp.vercel.app`

Deploy readiness updates:

* Fixed `backend/Dockerfile` by removing `COPY mobile/package.json`; that file does not exist and would break Render Docker builds.
* Updated `render.yaml` with non-secret Vercel origin values:
  * `CORS_ORIGINS=https://rolf-sales-rep-mvp-webapp.vercel.app`
  * `TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app`
* `DATABASE_URL` and `TELEGRAM_BOT_TOKEN` remain `sync: false` in `render.yaml`.
* `JWT_SECRET` remains generated by Render.

Validation:

* Local Docker build passed:
  `docker build -f backend/Dockerfile -t rolf-sales-rep-mvp-backend:staging-check .`
* Local Docker run passed on test port:
  `/health` returned 200 and `/` returned 200.
* Container log showed:
  `Backend listening on http://0.0.0.0:10000/`
* Vercel URL opened with HTTP 200.
* Vercel bundle did not contain `localhost:3000`.
* Superseded later: Vercel no longer needs `VITE_API_URL` for this MVP because the frontend now has a public Render fallback.

Access limitations:

* Render CLI is not installed in this environment.
* Vercel CLI is not installed in this environment.
* Actual Render/Vercel UI deploy must be completed manually by the user unless credentials/CLI access are provided.

Manual next steps:

* In Render, create Blueprint/Web Service from GitHub repo `RomanMR7/rolf-sales-rep-mvp`, branch `main`.
* Fill Render env:
  `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`; verify generated `JWT_SECRET`; keep `ALLOW_DEV_AUTH=false`.
* Deploy backend and copy `https://...onrender.com`.
* Superseded later: migrations and seed are automatic during Render container startup.
* Superseded later: Vercel `VITE_API_URL` is optional because the frontend has a public Render fallback.
* In BotFather, set Mini App URL to `https://rolf-sales-rep-mvp-webapp.vercel.app`.

## Live Staging Check - 2026-07-10

Known public URLs:

* Vercel frontend: `https://rolf-sales-rep-mvp-webapp.vercel.app`
* Render backend: `https://rolf-sales-rep-mvp-backend.onrender.com`

Live checks:

* Render backend `/` returned 200.
* Render backend `/health` returned 200.
* Render backend `/openapi.json` returned 200.
* Vercel frontend returned 200.
* Vercel frontend bundle does not contain `localhost:3000`.
* Superseded later: the frontend bundle now contains `https://rolf-sales-rep-mvp-backend.onrender.com` as a public API fallback.
* Superseded later: backend demo login `POST /api/auth/login` for `rep1@rolf-demo.local` returned 200 in live checks.

Render/Vercel access:

* Render CLI/API token is not available in this environment.
* Vercel CLI/API token is not available in this environment.
* Render/Vercel UI actions must be completed manually unless credentials/CLI access are provided.

Additional Docker fix:

* Updated Dockerfile to end at repo root `/app` and start backend with `bun run --cwd backend start`.
* This makes Render Shell commands from docs work directly:
  `bun run --cwd backend prisma:deploy` and `bun run seed`.
* Docker build passed after the change.
* Docker run passed after the change:
  `/health` 200, `/` 200, working directory `/app`.
* Docker exec check passed:
  `bun run --cwd backend prisma:validate`.

## Render Free Startup Deploy Fix - 2026-07-10

User correction:

* Render deployment is a Blueprint-managed Free Web Service.
* Render Shell, One-Off Jobs, paid jobs, and Pre-Deploy Command are not available for this project.
* Do not propose manual Render Shell commands for Prisma migrations or seed.

Decision:

* Backend Docker container now starts through `backend/scripts/render-start.sh`.
* Container startup checks `DATABASE_URL`, runs `bun run --cwd backend prisma:deploy`, runs `bun run --cwd backend seed`, then starts backend with `bun run --cwd backend start:api`.
* If `DATABASE_URL`, migrations, or seed fail, the container exits and backend does not start.
* Startup logs include:
  `Checking DATABASE_URL...`, `Running Prisma migrations...`, `Prisma migrations completed.`, `Running seed...`, `Seed completed.`, `Starting backend...`.

Seed safety:

* Seed is safe and idempotent for repeated deploy/restart.
* Existing demo users, clients, categories, products, visits, orders, and order items are left untouched.
* Seed creates only missing demo records and does not reset users or overwrite real data.

Validation:

* `bun run test` passed.
* `bun run smoke:backend:docker` passed.
* Docker smoke builds the backend image, starts on a clean test PostgreSQL volume, verifies startup logs, checks `/health`, runs a DB-backed auth smoke, restarts the container against the same DB, verifies startup logs again, and confirms idempotent restart.
* Test runners now use free PostgreSQL test ports and reset only this repository's test compose volume to avoid stale or conflicting local volumes.
* Pinned `@babel/types` to `7.29.7` because `7.29.0` installed without `validators/generated/index.js` and broke webapp typography tests.

Docs updated:

* `README.md`
* `docs/BACKEND_STAGING_DEPLOY.md`
* `docs/STAGING_CHECKLIST.md`

## Render Prisma 7 Startup Diagnostics Fix - 2026-07-10

User reported:

* Render deploy commit `3f32adac` failed after:
  `Checking DATABASE_URL...`, `Running Prisma migrations...`, `$ prisma migrate deploy`.
* Container exited with status 1 and no visible Prisma stderr.
* Render `DATABASE_URL` existed, Render PostgreSQL 18 was Available, Internal Database URL was used, and Docker image built successfully.

Root cause found:

* `prisma@7.8.0` declares Node runtime requirement `^20.19 || ^22.12 || >=24`.
* Base image `oven/bun:1` did not contain `node`.
* Startup ran migrations through `bun run --cwd backend prisma:deploy`, which executes Prisma CLI through Bun and can hide/lose useful failure output on Render.
* `DEBUG=prisma:*` was tested and rejected because it prints the full datasource URL, including password.

Fix:

* Dockerfile now installs Debian `nodejs` 20.19.x for Prisma CLI 7.
* `backend/scripts/render-start.sh` now runs Prisma directly with:
  `node node_modules/prisma/build/index.js migrate deploy --config backend/prisma.config.ts --schema backend/prisma/schema.prisma`.
* Migration command is wrapped with `set +e`, `2>&1`, explicit `Prisma migrate deploy exit code: ...`, and failure exit.
* Added `backend/scripts/startup-diagnostics.ts`.
* Startup diagnostics print cwd, Bun version, Node version, Prisma CLI version, schema/config presence, sanitized DB hostname/port/database/schema, DNS resolution, TCP connection, and Prisma `SELECT 1`.
* Startup diagnostics never print full `DATABASE_URL`, DB username/password, or Telegram token.

Validation:

* `bun run --cwd backend typecheck` passed.
* `bun run --cwd backend test:unit` passed.
* `bun run smoke:backend:docker` passed, including clean PostgreSQL 18 startup, repeated startup, visible connection failure diagnostics, and visible migration wrapper failure diagnostics.
* `bun run test:webapp` passed after one flaky 5-second typography render timeout.
* Final `bun run test` passed.

## Production Frontend API Fallback Fix - 2026-07-10

User correction:

* Production Vercel frontend must not critically depend on manually configured `VITE_API_URL`.
* Do not suggest editing the locked/Sensitive Vercel env var as the required fix.
* Public Render backend URL is not secret and may be stored as a staging fallback:
  `https://rolf-sales-rep-mvp-backend.onrender.com`.

Frontend fix:

* Added centralized API base resolution in `webapp/src/lib/apiConfig.ts`.
* `VITE_API_URL` is used only when it is present and a valid `http` or `https` URL.
* Missing, empty, invalid, or failed primary API base falls back to
  `https://rolf-sales-rep-mvp-backend.onrender.com`.
* API URLs are normalized to remove trailing slashes.
* Login and all API requests retry the fallback when the first base URL fails with a browser network error such as `Failed to fetch`.
* User-facing `VITE_API_URL is not configured` error was removed.
* Dev console diagnostics show selected API base and fallback retry without printing tokens, cookies, or secrets.

Backend CORS fix:

* Backend env loading now includes a safe built-in allowlist fallback for
  `https://rolf-sales-rep-mvp-webapp.vercel.app`.
* Invalid, wildcard, path-bearing, or HTTP CORS values are filtered instead of opening CORS to `*`.
* Credentials remain enabled only for explicit origins.

Live checks:

* `GET /health` on Render returned 200 with Vercel origin CORS headers.
* `OPTIONS /api/auth/login` from the Vercel origin returned 204 with credentials CORS headers.
* Demo login `rep1@rolf-demo.local` with `DemoPass123!` returned 200 from the live backend; do not print returned tokens or cookies.

Validation:

* `bun run --cwd webapp build` passed.
* `bun run --cwd webapp typecheck` passed.
* `bun test webapp/tests/api.test.ts webapp/tests/auth-queries.test.ts webapp/tests/e2e-env.test.ts` passed.
* `bun run --cwd backend typecheck` passed.
* `bun run test:contracts` passed.
* `bun run smoke:backend:docker` passed.
* First full `bun run test` run passed all deploy, contracts, backend, integration, and API tests, then hit the existing flaky 5-second `typography-render.test.tsx` timeout.
* Stabilized `webapp/tests/typography-render.test.tsx` by giving its heavy runtime UI import/render smoke a 15-second timeout.
* Final `bun run --cwd webapp test` passed: 42 pass, 0 fail.
* Final `bun run test` passed.

## Deploy Automation Check - 2026-07-10

User correction:

* Do not ask the user to manually redeploy Vercel or Render when Codex can verify or trigger deploys.
* If provider access is unavailable, state that plainly instead of pretending to deploy.

Access check:

* `vercel` CLI unavailable.
* `render` CLI unavailable.
* `gh` CLI unavailable.
* No local `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `RENDER_API_KEY`, `RENDER_TOKEN`, `RENDER_SERVICE_ID`, `VERCEL_DEPLOY_HOOK_URL`, or `RENDER_DEPLOY_HOOK_URL` environment variables were present.
* No `.vercel/project.json` was present locally.
* Therefore Codex can push to GitHub and check public URLs/GitHub statuses, but cannot create deploy hooks or call Vercel/Render account APIs without tokens or hook URLs.

Observed deploy status:

* GitHub commit status for `a5db355` reported `Vercel success` with a Vercel deployment URL.
* Public Vercel bundle at `https://rolf-sales-rep-mvp-webapp.vercel.app` contained `https://rolf-sales-rep-mvp-backend.onrender.com`, did not contain `VITE_API_URL is not configured`, and did contain the new `Backend is unreachable. Checked:` fallback error text.
* This confirms Vercel auto deploy from GitHub worked for the frontend commit.
* No Render deployment status was visible through public GitHub statuses/check-runs. Without Render API token or deploy hook URL, Render auto deploy status cannot be confirmed directly from this environment.

CI follow-up:

* GitHub Actions `validate` failed on `a5db355` during root `bun run typecheck`.
* Reproduced locally: `packages/contracts/src/auth.test.ts` inferred `validUser.role` as `string` instead of `UserDto` role union.
* Fixed by typing `validUser` as `UserDto`.
* Root `bun run typecheck` then passed.
* Full requested validation passed again:
  `bun run --cwd webapp build`, `bun run --cwd webapp typecheck`,
  `bun test webapp/tests/api.test.ts webapp/tests/auth-queries.test.ts webapp/tests/e2e-env.test.ts`,
  `bun run --cwd backend typecheck`, `bun run test:contracts`,
  `bun run smoke:backend:docker`, and `bun run test`.
* GitHub Actions for `de454e2` then passed typecheck/unit/backend/webapp steps but failed on stale `Webapp E2E smoke`.
* Local E2E initially failed because local proxy env (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`) returned 503 for unused localhost ports; running with `NO_PROXY=127.0.0.1,localhost` and cleared proxy env exposed the real stale spec.
* Updated `webapp/e2e/specs/auth.spec.ts` for the current Mini App demo login UI: create a unique test user via backend API, verify wrong password, login through the visible form, verify refresh-cookie restore, logout, and login again.
* Added `aria-label` values to the demo email/password inputs in `webapp/src/pages.tsx`.
* Increased the heavy runtime typography render smoke timeout to 30 seconds to avoid cold-import flakiness after long typography-policy runs.
* Final E2E passed locally with proxy disabled for localhost.
* Final requested validation passed again, including `bun run smoke:backend:docker` and `bun run test`.

## Production Telegram Mini App Admin Upgrade - 2026-07-10

* User requested upgrading `rolf-sales-rep-mvp` into a production Telegram Mini App management system with Telegram auth, RBAC, admin manager management, editable function settings, sales scripts, leads/deals, metrics, and audit logs.
* `memanto` CLI was unavailable in this environment; continued using `MEMORY.md` fallback per repository policy.
* Added Prisma models/migration for `UserStatus`, manager profiles, deals, function settings, sales scripts, activity logs, and manager daily metrics.
* Kept legacy database enum value `SALES_REP` for rollout safety so existing rows/migrations do not fail; API/public contract maps user-facing roles to `OWNER`, `ADMIN`, `SUPERVISOR`, `MANAGER`, and `VIEWER`.
* Added backend RBAC helpers `requireRole` and `requirePermission`.
* Added admin APIs under `/api/admin`, leads APIs under `/api/leads`, compatibility aliases `/auth/telegram` and `/me`, and launch metadata `GET /telegram/config`.
* Added safe Telegram owner bootstrap through `ADMIN_TELEGRAM_IDS`; signed Telegram users in that list become active owners, unknown Telegram users become invited viewers.
* Added a minimal dependency-free Telegram bot helper for `/start`, `/help`, and `/settings` Web App button payloads.
* Updated webapp into a mobile-first Mini App shell with safe browser fallback, Telegram SDK loading, bottom navigation, admin-only managers/functions/scripts/metrics screens, leads screen, and settings screen.
* Updated seed data to owner/supervisor/manager demo roles plus manager profiles, function settings, sales scripts, leads, and daily metrics.
* Updated README, Telegram setup docs, and env examples with `BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBAPP_URL`, `BACKEND_PUBLIC_URL`, and `ADMIN_TELEGRAM_IDS`.
* Validation so far: `bun run --cwd backend typecheck`, `bun run --cwd webapp typecheck`, `bun run --cwd backend test`, and `bun run --cwd webapp test` passed after fixes.

## Live Deploy E2E Follow-up - 2026-07-10

* Public Vercel status for `90bcc52` was successful, and production backend endpoints `/`, `/health`, `/telegram/config`, and `/openapi.json` returned 200.
* Live backend config showed `TELEGRAM_BOT_USERNAME=ALIRolfUae_bot` and `TELEGRAM_WEBAPP_URL=https://rolf-sales-rep-mvp-webapp.vercel.app`.
* Production DB/admin smoke confirmed `admin@rolf-demo.local` is `OWNER ACTIVE`, `rep1@rolf-demo.local` is `MANAGER`, admin APIs work, manager receives 403 on `/api/admin/users`, metrics/leads/functions/scripts work, and audit log records admin actions.
* Found Vercel browser fallback made an unnecessary `/api/auth/refresh` request outside Telegram, producing a console 401. Fixed in `webapp/src/lib/auth.tsx` by skipping bootstrap refresh outside Telegram and outside local dev.
* Found Telegram `/start` could not work end-to-end because there was helper code but no webhook endpoint. Added `POST /telegram/webhook` and `/api/telegram/webhook`; `/start`, `/help`, and `/settings` return Telegram `sendMessage` payloads with a Web App button.
* Added `backend/src/telegram/bot.test.ts` and documented Telegram `setWebhook` command in `docs/TELEGRAM_SETUP.md`.
* Validation after fixes passed: `bun run typecheck`, `bun run --cwd webapp lint`, `bun run test`, `bun run --cwd webapp build`, and `bun run smoke:backend:docker`.

## ROLF Dubai Premium UI Direction - 2026-07-10

* User requested a premium design in the style of ROLF Dubai.
* Direct public brand-guide information for "ROLF Dubai" was not found; visual direction chosen: executive Dubai auto showroom, graphite/night base, warm gold primary, teal metallic accent, glassy panels, compact Telegram-first layout.
* Updated webapp theme tokens, buttons, cards, header branding, unauthenticated Telegram fallback, workspace hero, metrics, rows, and status panels.
* Validation passed: `bun run --cwd webapp typecheck`, `bun run --cwd webapp build`, `bun run --cwd webapp lint`, and `bun run --cwd webapp test`.
* Browser check via Edge CDP confirmed mobile fallback renders, premium title appears, and mobile viewport has no horizontal overflow.

## Owner Command Center and Telegram Quick Actions - 2026-07-11

* User requested production layer: Owner Command Center, role preview, user impersonation, Telegram bot quick actions, rule-based admin parser, manual metrics entry, faster Mini App bootstrap, Russian UX, safety/audit/idempotency.
* Added session-backed owner modes in `auth_sessions`: role preview and user impersonation. Backend now exposes real/effective user, role, permissions, navigation flags, and effective session in `/api/auth/me` and `/api/app/bootstrap`.
* Added owner endpoints: `/api/owner/preview-role`, `/api/owner/impersonate`, `/api/owner/impersonation/stop`, `/api/owner/effective-session`.
* Added audit log fields for `effective_user_id`, `action_source`, and `idempotency_key`; added bot pending confirmation table.
* Added rule-based Telegram parser and role-aware bot menus for `/start`, `/help`, `/me`, `/metrics`, `/managers`, `/leads`, `/settings`, `/owner`; dangerous parsed actions create pending confirmation and idempotency key.
* Confirmed Telegram bot callbacks now execute supported actions exactly once before audit: manager role change, manager status change, function toggle, and manual metric entry; OWNER users are protected from bot role/status changes.
* Added `/api/admin/metrics/manual-entry` for partial manual metric updates with `manual_admin_entry` / `manual_bot_entry` source and audit log.
* Added webapp Owner Command Center at `/app/owner`, role preview block, user impersonation block, persistent owner-mode banner, cached `/me` shell, auth request timeout, early Telegram `ready()`/`expand()`, and Russian labels for key owner/admin screens.
* Security scan found only placeholder token values in docs and no Telegram token pattern in git history.
* Validation passed: `bun run typecheck`, `bun run test`, `bun run --cwd webapp lint`, `bun run --cwd webapp build`, `bun run smoke:backend:docker`, `bun run test:contracts`, and `bunx prisma validate --schema backend/prisma/schema.prisma --config backend/prisma.config.ts`.
* Amended and pushed final feature commit `9ca2e07` to `main`; GitHub/Vercel status reported success.
* Live Render checks after `9ca2e07`: `/health` 200, `/telegram/config` 200, `/telegram/webhook` `/start` returns Russian Mini App button, owner preview flow works, manager receives 403 on admin users, admin managers/functions/scripts/metrics/activity-log endpoints work.
* Live Telegram bot executor smoke passed: temporary admin webhook command created pending confirmation, `confirm:*` callback executed `function_toggle`, `/api/admin/functions` showed the test flag enabled, then the temporary user was disabled.
* Follow-up fix: Telegram bot confirmed callbacks now also execute lead creation, lead assignment, and lead status close/cancel actions; lead creation now requires inline confirmation.
* Validation after lead bot executor fix passed: `bun run --cwd backend typecheck`, `bun run --cwd backend test:unit`, `bun run typecheck`, `bun run test:contracts`, `bun run --cwd webapp lint`, `bun run --cwd webapp build`, `bun run test`, and a standalone `bun run smoke:backend:docker`.
* Live Render check after commit `a17f2ae` passed: Telegram webhook lead creation returned inline confirmation, `confirm:*` created a test lead, follow-up bot confirmations assigned it to a manager and changed final status to `CANCELLED`; temporary smoke admin was disabled.

## Telegram Login Render Cold Start Fix - 2026-07-11

* User reported Telegram Mini App login error: `Backend is unreachable. Checked: https://rolf-sales-rep-mvp-backend.onrender.com`.
* Observed cause: Render free backend cold start did not answer `/health` within 15 seconds and only returned 200 after a longer wait; webapp request timeout was too short for Telegram auth.
* Fixed webapp Telegram auth to allow a 90-second cold-start timeout while keeping ordinary API requests shorter.
* Replaced the client-facing English backend-unreachable auth error with a Russian message telling the user that Render is waking and to retry after 30-60 seconds if needed.
* Validation passed: `bun run --cwd webapp typecheck`, `bun run --cwd webapp lint`, `bun run --cwd webapp test`, and `bun run --cwd webapp build`.

## Telegram Bot Interactive Owner Controls - 2026-07-11

* User reported the Telegram bot had no real communication and no owner role-management flow.
* Root cause: bot inline keyboards existed, but callback handling only processed `confirm:*` and `cancel:*`; menu buttons such as managers/owner/settings/system were effectively silent.
* Added db-aware callback handlers for main menu sections, manager list, manager detail, role picker, status picker, function settings toggle, owner preview, owner impersonation, owner stop mode, and system status.
* Added confirmed execution for manager creation from bot commands.
* Owner can now change an active Mini App session into role preview or user impersonation from bot callbacks/text confirmations; role/status changes still require explicit confirm and OWNER users are protected.
* Added unit coverage to ensure owner inline menu callbacks answer instead of going silent.
* Validation passed: `bun run --cwd backend typecheck`, `bun run --cwd backend test:unit`, `bun run test`, and standalone `bun run smoke:backend:docker`.
* Live Render smoke after commit `529ef44` passed: `menu:system` callback returned system status, manager detail returned inline controls, role picker opened, `setrole:<id>:MANAGER` created a confirmation, `confirm:*` changed the temporary user's role to `MANAGER`, and temporary smoke users were disabled.
* User then reported Telegram Desktop showed no buttons after `/start`.
* Root cause: unknown users received only a `web_app` inline button, which Telegram Desktop may hide or not render like mobile Mini App buttons; also OWNER role in the bot required an existing DB user from prior Mini App login.
* Fixed bot `/start` to include a normal URL button (`Открыть на компьютере`) in addition to the Mini App `web_app` button and a `Кто я` callback button.
* Fixed bot-side owner bootstrap: if `message.from.id` / callback `from.id` is in `ADMIN_TELEGRAM_IDS`, the bot creates or upgrades that Telegram user to active `OWNER` before building the menu, so owner/admin buttons appear immediately.
* Validation passed: `bun run --cwd backend typecheck`, `bun run --cwd backend test:unit`, `bun run test`, and standalone `bun run smoke:backend:docker`.
* Live Render smoke after commit `74c7607` passed: unknown `/start` now returns `Кто я`, `Открыть Mini App` with `web_app`, and `Открыть на компьютере` with normal `url`; this fixes Telegram Desktop clients that hide Mini App-only buttons.
