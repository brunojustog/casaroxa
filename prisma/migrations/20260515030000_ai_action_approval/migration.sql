-- Sprint 9: IA operacional com aprovação humana

CREATE TYPE "AiActionKind" AS ENUM (
  'CREATE_COUPON', 'UPDATE_PRODUCT_PRICE',
  'SEND_WHATSAPP_CUSTOMER', 'DISPATCH_CAMPAIGN'
);
CREATE TYPE "AiActionStatus" AS ENUM (
  'PENDING', 'APPROVED', 'EXECUTED', 'FAILED', 'REJECTED', 'EXPIRED'
);

CREATE TABLE "AiActionApproval" (
  "id"             TEXT NOT NULL,
  "kind"           "AiActionKind" NOT NULL,
  "status"         "AiActionStatus" NOT NULL DEFAULT 'PENDING',
  "summary"        TEXT NOT NULL,
  "reasoning"      TEXT,
  "payload"        JSONB NOT NULL,
  "result"         JSONB,
  "failureMessage" TEXT,
  "conversationId" TEXT,
  "messageId"      TEXT,
  "proposedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "decidedAt"      TIMESTAMP(3),
  "decidedById"    TEXT,
  "executedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiActionApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiActionApproval_status_proposedAt_idx"
  ON "AiActionApproval"("status", "proposedAt");
CREATE INDEX "AiActionApproval_expiresAt_idx"
  ON "AiActionApproval"("expiresAt");

ALTER TABLE "AiActionApproval"
  ADD CONSTRAINT "AiActionApproval_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
