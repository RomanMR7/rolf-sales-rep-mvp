# MVP Scope

## Included

- Telegram Mini App-oriented sales representative interface.
- Dubai-focused demo dashboard with visits, route clients, catalog, and orders.
- Web admin dashboard concept for manager/admin review.
- Role-aware API for clients, product categories, products, visits, orders, and dashboard.
- Clickable demo flow for sales rep login, scoped clients, visit start/complete, order draft, submit, and manager approve/reject.
- Demo email login for seeded roles in local browser testing.
- Seed data for admin, manager, sales reps, Dubai/UAE client points, demo catalog, visits, and orders.
- Text branding: ROLF Sales App / ROLF Oils Demo.
- Yandex Cloud deployment direction documented separately.

## Deferred

- Native Expo mobile application.
- Real ROLF logo assets.
- Official ROLF product catalog and client price list.
- 1C/ERP/CRM integrations.
- Warehouse stock, receivables, offline mode, and photo reports.
- Production Telegram bot deployment.
- Full manual Telegram WebView validation with a real bot and public HTTPS URL.
- Deep admin CRUD for users, permissions, and catalog maintenance.

## Latest Demo Readiness Check

- Backend/API smoke passed against local PostgreSQL.
- `rep1` sees 7 assigned clients.
- Admin sees 20 seeded clients.
- Visit flow checked: `PLANNED -> IN_PROGRESS -> COMPLETED`.
- Order flow checked: `DRAFT -> SUBMITTED -> APPROVED`.
- Order total checked with product quantity, item discount, and order discount: `AED 246 - AED 15 = AED 231`.
- Frontend dev server served `http://127.0.0.1:5173/`.
- Full `test:webapp` still has an unrelated typography policy/Babel generated-file failure; targeted API/auth/env webapp tests pass.

## Demo Data Note

All catalog, customer, and order data is demo data for MVP presentation. Replace it with the client's real Dubai/OAE customer base and price list before production use.

Демо-номенклатура, заменить на реальный прайс клиента.
