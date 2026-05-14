-- Sprint 5: Campaigns

-- Enums
CREATE TYPE "CampaignChannel" AS ENUM ('WHATSAPP', 'EMAIL');
CREATE TYPE "CampaignAudienceKey" AS ENUM (
  'BIRTHDAY_MONTH', 'INACTIVE_30D', 'RECURRING',
  'HIGH_TICKET', 'BOUGHT_CHICKEN', 'BOUGHT_BEEF_RIB'
);
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'DISPATCHING', 'SENT', 'CANCELLED');
CREATE TYPE "CampaignDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- Customer.marketingOptIn
ALTER TABLE "Customer"
  ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT true;

-- Campaign
CREATE TABLE "Campaign" (
  "id"               TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "message"          TEXT NOT NULL,
  "channel"          "CampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
  "audienceKey"      "CampaignAudienceKey" NOT NULL,
  "status"           "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "couponId"         TEXT,
  "audienceSnapshot" INTEGER NOT NULL DEFAULT 0,
  "startedAt"        TIMESTAMP(3),
  "finishedAt"       TIMESTAMP(3),
  "createdById"      TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CampaignDelivery
CREATE TABLE "CampaignDelivery" (
  "id"              TEXT NOT NULL,
  "campaignId"      TEXT NOT NULL,
  "customerId"      TEXT NOT NULL,
  "status"          "CampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "phoneSnapshot"   TEXT,
  "messageSnapshot" TEXT,
  "whatsappLogId"   TEXT,
  "errorMessage"    TEXT,
  "sentAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignDelivery_campaignId_customerId_key"
  ON "CampaignDelivery"("campaignId", "customerId");
CREATE INDEX "CampaignDelivery_campaignId_status_idx"
  ON "CampaignDelivery"("campaignId", "status");
ALTER TABLE "CampaignDelivery"
  ADD CONSTRAINT "CampaignDelivery_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery"
  ADD CONSTRAINT "CampaignDelivery_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CampaignOrderAttribution
CREATE TABLE "CampaignOrderAttribution" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "saleId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignOrderAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignOrderAttribution_saleId_key"
  ON "CampaignOrderAttribution"("saleId");
CREATE INDEX "CampaignOrderAttribution_campaignId_idx"
  ON "CampaignOrderAttribution"("campaignId");
ALTER TABLE "CampaignOrderAttribution"
  ADD CONSTRAINT "CampaignOrderAttribution_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignOrderAttribution"
  ADD CONSTRAINT "CampaignOrderAttribution_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
