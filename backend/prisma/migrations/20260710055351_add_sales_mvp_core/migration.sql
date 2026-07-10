-- CreateEnum
CREATE TYPE "ClientPointType" AS ENUM ('AUTO_SHOP', 'SERVICE_STATION', 'WHOLESALE', 'RETAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientPointStatus" AS ENUM ('ACTIVE', 'PAUSED', 'LEAD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VisitResult" AS ENUM ('ORDER_CREATED', 'NO_NEED', 'CLIENT_ABSENT', 'CALLBACK_REQUIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "client_points" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "type" "ClientPointType" NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "assigned_rep_id" UUID NOT NULL,
    "status" "ClientPointStatus" NOT NULL DEFAULT 'ACTIVE',
    "comment" TEXT,
    "last_visit_at" TIMESTAMP(3),
    "next_visit_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "viscosity" TEXT,
    "volume" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "client_point_id" UUID NOT NULL,
    "sales_rep_id" UUID NOT NULL,
    "planned_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'PLANNED',
    "result" "VisitResult",
    "comment" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_number" TEXT NOT NULL,
    "client_point_id" UUID NOT NULL,
    "sales_rep_id" UUID NOT NULL,
    "visit_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "manager_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_points_assigned_rep_id_idx" ON "client_points"("assigned_rep_id");

-- CreateIndex
CREATE INDEX "client_points_status_idx" ON "client_points"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "visits_sales_rep_id_idx" ON "visits"("sales_rep_id");

-- CreateIndex
CREATE INDEX "visits_client_point_id_idx" ON "visits"("client_point_id");

-- CreateIndex
CREATE INDEX "visits_planned_at_idx" ON "visits"("planned_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_sales_rep_id_idx" ON "orders"("sales_rep_id");

-- CreateIndex
CREATE INDEX "orders_client_point_id_idx" ON "orders"("client_point_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- AddForeignKey
ALTER TABLE "client_points" ADD CONSTRAINT "client_points_assigned_rep_id_fkey" FOREIGN KEY ("assigned_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_client_point_id_fkey" FOREIGN KEY ("client_point_id") REFERENCES "client_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_point_id_fkey" FOREIGN KEY ("client_point_id") REFERENCES "client_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
