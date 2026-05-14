-- Sprint 7: Carrinho abandonado

-- Enum
CREATE TYPE "AbandonedCartStatus" AS ENUM ('PENDING', 'NOTIFIED', 'RECOVERED', 'EXPIRED');

-- WhatsAppEvent novo valor
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'ABANDONED_CART';

-- Settings: toggle + janela em minutos
ALTER TABLE "Settings"
  ADD COLUMN "whatsappNotifyAbandonedCart"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "abandonedCartNotifyAfterMinutes" INTEGER NOT NULL DEFAULT 30;

-- Tabela
CREATE TABLE "AbandonedCart" (
  "id"               TEXT NOT NULL,
  "customerPhone"    TEXT NOT NULL,
  "customerName"     TEXT,
  "customerId"       TEXT,
  "itemsSnapshot"    JSONB NOT NULL,
  "totalSnapshot"    DECIMAL(14,2) NOT NULL,
  "status"           "AbandonedCartStatus" NOT NULL DEFAULT 'PENDING',
  "notifiedAt"       TIMESTAMP(3),
  "recoveredSaleId"  TEXT,
  "recoveredAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AbandonedCart_customerPhone_key" ON "AbandonedCart"("customerPhone");
CREATE INDEX "AbandonedCart_status_createdAt_idx" ON "AbandonedCart"("status", "createdAt");
CREATE INDEX "AbandonedCart_customerId_idx" ON "AbandonedCart"("customerId");

ALTER TABLE "AbandonedCart"
  ADD CONSTRAINT "AbandonedCart_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
