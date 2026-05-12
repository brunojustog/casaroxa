-- Referral: cliente A compartilha link → cliente B se inscreve → A ganha
-- 1 entry bônus na mesma rifa. 1 par (A,B) por rifa.

CREATE TABLE "RaffleReferral" (
  "id" TEXT NOT NULL,
  "raffleId" TEXT NOT NULL,
  "referrerCustomerId" TEXT NOT NULL,
  "referredCustomerId" TEXT NOT NULL,
  "awardedEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaffleReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaffleReferral_awardedEntryId_key" ON "RaffleReferral"("awardedEntryId");
CREATE UNIQUE INDEX "RaffleReferral_raffleId_referredCustomerId_key"
  ON "RaffleReferral"("raffleId", "referredCustomerId");
CREATE INDEX "RaffleReferral_referrerCustomerId_idx" ON "RaffleReferral"("referrerCustomerId");
CREATE INDEX "RaffleReferral_raffleId_idx" ON "RaffleReferral"("raffleId");

ALTER TABLE "RaffleReferral"
  ADD CONSTRAINT "RaffleReferral_raffleId_fkey"
  FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaffleReferral"
  ADD CONSTRAINT "RaffleReferral_referrerCustomerId_fkey"
  FOREIGN KEY ("referrerCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaffleReferral"
  ADD CONSTRAINT "RaffleReferral_referredCustomerId_fkey"
  FOREIGN KEY ("referredCustomerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaffleReferral"
  ADD CONSTRAINT "RaffleReferral_awardedEntryId_fkey"
  FOREIGN KEY ("awardedEntryId") REFERENCES "RaffleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
