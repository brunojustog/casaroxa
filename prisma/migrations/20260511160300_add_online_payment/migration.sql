-- CreateEnum
CREATE TYPE "OnlinePaymentBillingType" AS ENUM ('PIX', 'CREDIT_CARD', 'BOLETO');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "WhatsAppEvent" ADD VALUE 'PAYMENT_RECEIVED';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "asaasCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "asaasEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "asaasPaymentTtlHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "whatsappNotifyPaymentReceived" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OnlinePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "asaasCustomerId" TEXT NOT NULL,
    "billingType" "OnlinePaymentBillingType" NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceUrl" TEXT,
    "pixPayload" TEXT,
    "pixQrCodeBase64" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "lastEventRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePayment_saleId_key" ON "OnlinePayment"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePayment_asaasPaymentId_key" ON "OnlinePayment"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "OnlinePayment_status_createdAt_idx" ON "OnlinePayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_asaasCustomerId_key" ON "Customer"("asaasCustomerId");

-- AddForeignKey
ALTER TABLE "OnlinePayment" ADD CONSTRAINT "OnlinePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
