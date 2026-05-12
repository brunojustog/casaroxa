-- Raffle: preço por ticket (0 = grátis)
ALTER TABLE "Raffle" ADD COLUMN "ticketPriceCents" INTEGER NOT NULL DEFAULT 0;

-- RaffleEntry: flag de confirmação (entry só conta após pagamento em rifa paga)
ALTER TABLE "RaffleEntry" ADD COLUMN "confirmed" BOOLEAN NOT NULL DEFAULT true;

-- OnlinePayment: agora polimórfico — saleId ou raffleEntryId
ALTER TABLE "OnlinePayment" DROP CONSTRAINT "OnlinePayment_saleId_fkey";
ALTER TABLE "OnlinePayment" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "OnlinePayment" ADD COLUMN "raffleEntryId" TEXT;

CREATE UNIQUE INDEX "OnlinePayment_raffleEntryId_key" ON "OnlinePayment"("raffleEntryId");

ALTER TABLE "OnlinePayment"
  ADD CONSTRAINT "OnlinePayment_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlinePayment"
  ADD CONSTRAINT "OnlinePayment_raffleEntryId_fkey"
  FOREIGN KEY ("raffleEntryId") REFERENCES "RaffleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
