-- Venda iniciada pelo PDV: o caixa só reaproveita vendas com esta flag.
ALTER TABLE "Sale" ADD COLUMN "openedInPdv" BOOLEAN NOT NULL DEFAULT false;
