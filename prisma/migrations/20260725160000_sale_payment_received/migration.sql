-- Valor entregue pelo cliente no pagamento em dinheiro (pra calcular troco no PDV).
ALTER TABLE "SalePayment" ADD COLUMN "receivedAmount" DECIMAL(14,2);
