-- Chave aberto/fechado da cozinha online (cardápio). Encomendas/empório não são afetados.
ALTER TABLE "Settings" ADD COLUMN "cardapioClosed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "cardapioClosedMessage" TEXT;
