# ROLF Sales Rep MVP Implementation Plan

## Product Direction

The MVP is a Telegram Mini App and web admin panel for a ROLF oils sales representative working in Dubai. The demo should feel like a premium UAE business tool: clean, confident, mobile-first, AED-based, and grounded in Dubai sales routes such as Al Quoz, Deira, Downtown, and Jebel Ali.

Official ROLF logo assets are not used. Branding stays textual: "ROLF Sales App" and "ROLF Oils Demo".

## Chosen Template Branch

Default branch was used because the first release targets:

- backend/API;
- webapp;
- database;
- Telegram Mini App-oriented UI;
- web admin panel.

The `mobile` surface remains deferred. Expo can be added later from the template mobile branch when native mobile becomes part of the product scope.

## Dubai Style Rules

- Use English business copy for the Dubai/OAE demo context.
- Use AED in demo orders and price displays.
- Use Dubai districts and B2B automotive customer types in seed/mock data.
- Visual tone: graphite, off-white, warm gold accents, restrained borders, dense business layout.
- Avoid official logo usage until the client provides approved brand assets.
- Keep UI practical for Telegram WebView: large touch targets, short labels, mobile-first layout.

## Phase 1 - Demo Surface

- Replace starter auth landing with a clickable Telegram Mini App-oriented sales workspace.
- Add an admin dashboard route for managers.
- Show clients, catalog, visits, and orders with Dubai-specific demo data.
- Keep the UI demo-ready even before the backend models are complete.

## Phase 2 - Backend And Contracts

- Extend shared Zod contracts for users, customers, products, orders, visits, dashboard stats, and Telegram auth.
- Add Prisma models for roles, Telegram account fields, client points, product categories/products, orders/order items, and visits.
- Add route modules for dashboard, customers, products, orders, and visits.
- Add Telegram initData validation endpoint with `TELEGRAM_BOT_TOKEN`.
- Add `ALLOW_DEV_AUTH=true` fallback that works only in `NODE_ENV=development`.

## Phase 3 - Seed Data

- Create one admin, one manager, and three sales representatives.
- Seed Dubai customer points and routes.
- Seed 20 demo products with AED prices.
- Seed submitted, approved, delivery, and completed orders.
- Seed visits for today and tomorrow.

## Phase 4 - Documentation And Demo

- Update README for local startup and demo credentials.
- Add MVP scope, client demo script, Telegram setup, next features, and Yandex Cloud ROLF MVP deployment docs.
- Document that demo catalog data is not an official ROLF price list and must be replaced with the client's real price list.

## Validation Plan

- Run typecheck, tests, and build when Bun is available.
- Run Docker Compose PostgreSQL and Prisma migrations once Bun is installed.
- Verify that Telegram dev auth is disabled outside development.
- Verify representative creates an order and manager changes its status.
