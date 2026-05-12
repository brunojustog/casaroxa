-- ============================================================
-- Rifa com múltiplos prêmios: nova model RafflePrize. Cada Raffle pode
-- ter N prêmios sorteados em sequência (admin sorteia 1 por vez).
-- Cada cliente ganha no máximo 1 prêmio (regra de negócio no service).
--
-- Migra `Raffle.prizeDescription` pra um único `RafflePrize` na posição 1.
-- Migra `Raffle.winnerEntryId` pra `RafflePrize.winnerEntryId` desse mesmo.
-- ============================================================

-- 1) Cria RafflePrize
CREATE TABLE "RafflePrize" (
  "id" TEXT NOT NULL,
  "raffleId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "winnerEntryId" TEXT,
  "drawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RafflePrize_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RafflePrize_winnerEntryId_key" ON "RafflePrize"("winnerEntryId");
CREATE UNIQUE INDEX "RafflePrize_raffleId_position_key" ON "RafflePrize"("raffleId", "position");
CREATE INDEX "RafflePrize_raffleId_idx" ON "RafflePrize"("raffleId");

ALTER TABLE "RafflePrize"
  ADD CONSTRAINT "RafflePrize_raffleId_fkey"
  FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RafflePrize"
  ADD CONSTRAINT "RafflePrize_winnerEntryId_fkey"
  FOREIGN KEY ("winnerEntryId") REFERENCES "RaffleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Migra dados legados: cria 1 RafflePrize por Raffle existente
--    usando prizeDescription (ou "Prêmio principal" se null).
INSERT INTO "RafflePrize" ("id", "raffleId", "position", "description", "winnerEntryId", "drawnAt")
SELECT
  CONCAT('migr_', "id"),
  "id",
  1,
  COALESCE("prizeDescription", 'Prêmio principal'),
  "winnerEntryId",
  "drawnAt"
FROM "Raffle";

-- 3) Remove campos legados de Raffle
ALTER TABLE "Raffle" DROP CONSTRAINT IF EXISTS "Raffle_winnerEntryId_fkey";
DROP INDEX IF EXISTS "Raffle_winnerEntryId_key";
ALTER TABLE "Raffle" DROP COLUMN IF EXISTS "prizeDescription";
ALTER TABLE "Raffle" DROP COLUMN IF EXISTS "winnerEntryId";
