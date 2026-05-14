-- Sprint 6: NPS / CustomerReview

-- Enum
CREATE TYPE "NpsCategory" AS ENUM ('DETRACTOR', 'PASSIVE', 'PROMOTER');

-- Novos valores no enum CampaignAudienceKey (Sprint 5 + 6 integração)
ALTER TYPE "CampaignAudienceKey" ADD VALUE IF NOT EXISTS 'DETRACTORS_30D';
ALTER TYPE "CampaignAudienceKey" ADD VALUE IF NOT EXISTS 'PROMOTERS_30D';

-- Novo valor de WhatsAppEvent
ALTER TYPE "WhatsAppEvent" ADD VALUE IF NOT EXISTS 'NPS_REQUEST';

-- Settings: novo toggle
ALTER TABLE "Settings"
  ADD COLUMN "whatsappNotifyNpsRequest" BOOLEAN NOT NULL DEFAULT false;

-- Sale: token + timestamp NPS
ALTER TABLE "Sale"
  ADD COLUMN "npsToken"  TEXT,
  ADD COLUMN "npsSentAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Sale_npsToken_key" ON "Sale"("npsToken");

-- CustomerReview
CREATE TABLE "CustomerReview" (
  "id"                TEXT NOT NULL,
  "saleId"            TEXT,
  "customerId"        TEXT,
  "customerName"      TEXT NOT NULL,
  "customerPhone"     TEXT,
  "score"             INTEGER NOT NULL,
  "category"          "NpsCategory" NOT NULL,
  "comment"           TEXT,
  "adminNotes"        TEXT,
  "followupCouponId"  TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerReview_saleId_key" ON "CustomerReview"("saleId");
CREATE INDEX "CustomerReview_customerId_createdAt_idx"
  ON "CustomerReview"("customerId", "createdAt");
CREATE INDEX "CustomerReview_category_createdAt_idx"
  ON "CustomerReview"("category", "createdAt");

ALTER TABLE "CustomerReview"
  ADD CONSTRAINT "CustomerReview_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReview"
  ADD CONSTRAINT "CustomerReview_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReview"
  ADD CONSTRAINT "CustomerReview_followupCouponId_fkey"
  FOREIGN KEY ("followupCouponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
