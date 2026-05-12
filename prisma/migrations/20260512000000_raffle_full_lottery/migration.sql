-- ============================================================
-- Rifa "de verdade": pool fechado de números, cliente escolhe, múltiplos
-- números por compra (1 PIX vincula N RaffleEntries).
--
-- Limpeza necessária:
--   - OnlinePayment.raffleEntryId era 1-1; agora é 1-N via FK na entry.
--   - RaffleEntry sem mais unique(raffleId, customerId).
--   - Customer.id agora referenciado por OnlinePayment.customerId.
--
-- Dados existentes: pagamentos de rifa em teste (nenhum confirmado) são
-- descartados — Bruno confirmou 0 inscritos válidos.
-- ============================================================

-- 1) Limpa OnlinePayments de rifa (havia 1-1 antiga) e respectivas entries
DELETE FROM "OnlinePayment" WHERE "raffleEntryId" IS NOT NULL;
DELETE FROM "RaffleEntry" WHERE "confirmed" = false;

-- 2) Raffle: pool de números
ALTER TABLE "Raffle" ADD COLUMN "totalNumbers" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Raffle" ADD COLUMN "maxTicketsPerCustomer" INTEGER;

-- 3) RaffleEntry: remove unique(raffleId, customerId) + adiciona FK pra payment
DROP INDEX IF EXISTS "RaffleEntry_raffleId_customerId_key";
ALTER TABLE "RaffleEntry" ADD COLUMN "onlinePaymentId" TEXT;
CREATE INDEX "RaffleEntry_onlinePaymentId_idx" ON "RaffleEntry"("onlinePaymentId");

-- 4) OnlinePayment: remove raffleEntryId; adiciona raffleId + customerId
ALTER TABLE "OnlinePayment" DROP CONSTRAINT IF EXISTS "OnlinePayment_raffleEntryId_fkey";
DROP INDEX IF EXISTS "OnlinePayment_raffleEntryId_key";
ALTER TABLE "OnlinePayment" DROP COLUMN "raffleEntryId";

ALTER TABLE "OnlinePayment" ADD COLUMN "raffleId" TEXT;
ALTER TABLE "OnlinePayment" ADD COLUMN "customerId" TEXT;

-- 5) Preenche customerId nos OnlinePayments existentes (todos são de Sale,
--    já que apagamos os de raffle acima). Sale.customerId é o source.
UPDATE "OnlinePayment" op
  SET "customerId" = s."customerId"
  FROM "Sale" s
  WHERE op."saleId" = s."id" AND s."customerId" IS NOT NULL;

-- Se sobrou algum sem customerId (pagamento de Sale sem cliente — não
-- deveria existir mas por garantia), apaga.
DELETE FROM "OnlinePayment" WHERE "customerId" IS NULL;

-- Agora torna customerId obrigatório
ALTER TABLE "OnlinePayment" ALTER COLUMN "customerId" SET NOT NULL;

CREATE INDEX "OnlinePayment_raffleId_idx" ON "OnlinePayment"("raffleId");
CREATE INDEX "OnlinePayment_customerId_idx" ON "OnlinePayment"("customerId");

-- 6) FKs
ALTER TABLE "RaffleEntry"
  ADD CONSTRAINT "RaffleEntry_onlinePaymentId_fkey"
  FOREIGN KEY ("onlinePaymentId") REFERENCES "OnlinePayment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlinePayment"
  ADD CONSTRAINT "OnlinePayment_raffleId_fkey"
  FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlinePayment"
  ADD CONSTRAINT "OnlinePayment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
