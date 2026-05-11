-- CreateEnum
CREATE TYPE "RaffleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'DRAWN', 'CANCELLED');

-- AlterEnum
ALTER TYPE "WhatsAppEvent" ADD VALUE 'RAFFLE_WIN';

-- CreateTable
CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prizeDescription" TEXT,
    "imageUrl" TEXT,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "drawAt" TIMESTAMP(3),
    "status" "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "winnerEntryId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "drawnById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleEntry" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Raffle_winnerEntryId_key" ON "Raffle"("winnerEntryId");

-- CreateIndex
CREATE INDEX "Raffle_status_closesAt_idx" ON "Raffle"("status", "closesAt");

-- CreateIndex
CREATE INDEX "RaffleEntry_customerId_idx" ON "RaffleEntry"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_raffleId_customerId_key" ON "RaffleEntry"("raffleId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_raffleId_number_key" ON "RaffleEntry"("raffleId", "number");

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_winnerEntryId_fkey" FOREIGN KEY ("winnerEntryId") REFERENCES "RaffleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_drawnById_fkey" FOREIGN KEY ("drawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
