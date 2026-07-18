-- CreateEnum
CREATE TYPE "OrderRequestKind" AS ENUM ('SEMANAL', 'EMPORIO');

-- CreateEnum
CREATE TYPE "SupplyTripStatus" AS ENUM ('AGENDADA', 'CONCLUIDA', 'CANCELADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductCategory" ADD VALUE 'EMPORIO';
ALTER TYPE "ProductCategory" ADD VALUE 'CONGELADOS';

-- AlterTable
ALTER TABLE "OrderRequest" ADD COLUMN     "kind" "OrderRequestKind" NOT NULL DEFAULT 'SEMANAL',
ADD COLUMN     "supplyTripId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "emporioWhatsappGroupUrl" TEXT;

-- CreateTable
CREATE TABLE "SupplyTrip" (
    "id" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "status" "SupplyTripStatus" NOT NULL DEFAULT 'AGENDADA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyTrip_status_tripDate_idx" ON "SupplyTrip"("status", "tripDate");

-- CreateIndex
CREATE INDEX "OrderRequest_supplyTripId_idx" ON "OrderRequest"("supplyTripId");

-- AddForeignKey
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_supplyTripId_fkey" FOREIGN KEY ("supplyTripId") REFERENCES "SupplyTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

