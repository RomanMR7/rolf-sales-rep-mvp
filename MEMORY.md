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
