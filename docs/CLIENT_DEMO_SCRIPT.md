# Client Demo Script

## Goal

Show a clickable Dubai sales representative MVP: route visit, catalog, order creation, and manager approval.

## Sales Rep Flow

1. Open `http://localhost:5173/`.
2. Sign in as `rep1@rolf-demo.local` with `DemoPass123!`.
3. Open dashboard and show today's visits, today's orders, AED order total, and scoped clients.
4. Open Clients and explain that a sales rep sees only assigned Dubai/UAE trading points.
5. Choose a client and click "Создать визит".
6. Open Visits, start the planned visit, then complete it.
7. Open Catalog and show demo product categories, SKU, volume, viscosity, and AED price.
8. Open Orders and choose the same client.
9. Add one or more products, quantity, item discount, and order discount.
10. Check calculated subtotal, discount, and total.
11. Save the order as `DRAFT`, then submit it to manager.

What to say:

- "This validates the daily field-sales workflow before investing in ERP integration."
- "Prices are in AED and the demo data is shaped around Dubai routes and customer points."
- "A representative only sees their own clients and orders, while manager/admin roles see the team view."

## Manager Flow

1. Logout and sign in as `manager@rolf-demo.local` with `DemoPass123!`.
2. Open Orders.
3. Find the submitted order.
4. Add a manager comment.
5. Approve or reject the order.
6. Show that the manager dashboard has broader visibility.

What to say:

- "The approval step is intentionally simple in the MVP: it proves order control before adding accounting, warehouse, or delivery integrations."

## Admin Flow

1. Logout and sign in as `admin@rolf-demo.local` with `DemoPass123!`.
2. Show dashboard/admin view.
3. Explain that admin has full data visibility.

What to say:

- "Admin user management and full catalog maintenance are planned next, but the role model and data access boundaries already exist."

## Current Demo Notes

- Latest smoke check passed: `rep1` sees 7 clients, admin sees 20 clients.
- Latest checked order calculation: `AED 246 - AED 15 = AED 231`.
- Latest checked status flow: visit `COMPLETED`, order `APPROVED`.
- Demo catalog and customers are placeholders and must be replaced with the client's real Dubai customer base and price list before production.

Demo credentials after seed:

- `rep1@rolf-demo.local` / `DemoPass123!`
- `manager@rolf-demo.local` / `DemoPass123!`
- `admin@rolf-demo.local` / `DemoPass123!`
