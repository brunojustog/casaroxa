-- CreateEnum
CREATE TYPE "WhatsAppEvent" AS ENUM ('ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_ON_DELIVERY', 'BIRTHDAY_COUPON', 'LOYALTY_REDEEM', 'MANUAL', 'TEST');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "whatsappApiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNotifyBirthday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNotifyConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNotifyLoyaltyRedeem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNotifyOnDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappNotifyReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "saleId" TEXT,
    "phone" TEXT NOT NULL,
    "event" "WhatsAppEvent" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL,
    "errorMessage" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_customerId_createdAt_idx" ON "WhatsAppMessageLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_event_createdAt_idx" ON "WhatsAppMessageLog"("event", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_status_createdAt_idx" ON "WhatsAppMessageLog"("status", "createdAt");
