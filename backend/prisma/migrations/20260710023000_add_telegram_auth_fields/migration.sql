-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SALES_REP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'SALES_REP',
ADD COLUMN     "telegram_first_name" TEXT,
ADD COLUMN     "telegram_id" TEXT,
ADD COLUMN     "telegram_last_name" TEXT,
ADD COLUMN     "telegram_username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
