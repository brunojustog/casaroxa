-- Sprint 3 follow-up: Asaas para sinal de encomenda

-- Nova coluna polimórfica em OnlinePayment
ALTER TABLE "OnlinePayment" ADD COLUMN "orderRequestId" TEXT;

CREATE UNIQUE INDEX "OnlinePayment_orderRequestId_key" ON "OnlinePayment"("orderRequestId");
CREATE INDEX "OnlinePayment_orderRequestId_idx" ON "OnlinePayment"("orderRequestId");

ALTER TABLE "OnlinePayment"
  ADD CONSTRAINT "OnlinePayment_orderRequestId_fkey"
  FOREIGN KEY ("orderRequestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
