CREATE TYPE "OwnerSessionMode" AS ENUM ('ROLE_PREVIEW', 'USER_IMPERSONATION');

ALTER TABLE "auth_sessions"
ADD COLUMN "owner_mode" "OwnerSessionMode",
ADD COLUMN "effective_role" "UserRole",
ADD COLUMN "effective_user_id" UUID;

ALTER TABLE "activity_logs"
ADD COLUMN "effective_user_id" UUID,
ADD COLUMN "action_source" TEXT NOT NULL DEFAULT 'mini_app',
ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "manager_daily_metrics"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "note" TEXT;

CREATE TABLE "bot_action_confirmations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "telegram_chat_id" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "intent" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'medium',
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),

    CONSTRAINT "bot_action_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_sessions_effective_user_id_idx" ON "auth_sessions"("effective_user_id");
CREATE INDEX "activity_logs_effective_user_id_idx" ON "activity_logs"("effective_user_id");
CREATE INDEX "activity_logs_action_source_idx" ON "activity_logs"("action_source");
CREATE UNIQUE INDEX "activity_logs_idempotency_key_key" ON "activity_logs"("idempotency_key");
CREATE UNIQUE INDEX "bot_action_confirmations_idempotency_key_key" ON "bot_action_confirmations"("idempotency_key");
CREATE INDEX "bot_action_confirmations_chat_status_idx" ON "bot_action_confirmations"("telegram_chat_id", "status");
CREATE INDEX "bot_action_confirmations_actor_user_id_idx" ON "bot_action_confirmations"("actor_user_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_effective_user_id_fkey" FOREIGN KEY ("effective_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
