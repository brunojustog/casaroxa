-- Sprint 3 follow-up: WhatsApp notifications para encomendas

-- Novos valores no enum WhatsAppEvent (additive, sem reorder)
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'ORDER_REQUEST_RECEIVED';
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'ORDER_REQUEST_APPROVED';
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'ORDER_REQUEST_REJECTED';
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'ORDER_REQUEST_READY';

-- Novas flags em Settings (default false — admin liga manualmente)
ALTER TABLE "Settings"
  ADD COLUMN "whatsappNotifyOrderRequestReceived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappNotifyOrderRequestApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappNotifyOrderRequestRejected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappNotifyOrderRequestReady"    BOOLEAN NOT NULL DEFAULT false;
