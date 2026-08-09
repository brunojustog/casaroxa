-- Flag "depende da cozinha" em produtos e combos.
-- Default true (negócio de assados); backfill false para itens de pronta-entrega.
ALTER TABLE "Product" ADD COLUMN "requiresKitchen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Combo" ADD COLUMN "requiresKitchen" BOOLEAN NOT NULL DEFAULT true;

-- Itens que não dependem da cozinha (compráveis a qualquer hora).
UPDATE "Product" SET "requiresKitchen" = false
  WHERE "category" IN ('BEBIDAS', 'EMPORIO', 'CONGELADOS');
UPDATE "Combo" SET "requiresKitchen" = false
  WHERE "category" IN ('BEBIDAS', 'EMPORIO', 'CONGELADOS');

-- Configuração de horário da cozinha (agendamento no checkout).
ALTER TABLE "Settings" ADD COLUMN "kitchenScheduleEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "kitchenHours" JSONB;
ALTER TABLE "Settings" ADD COLUMN "kitchenSlotStepMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Settings" ADD COLUMN "kitchenScheduleWeeksAhead" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Settings" ADD COLUMN "kitchenCutoffHours" INTEGER NOT NULL DEFAULT 2;

-- Horário inicial: sábado 07:00–14:00, domingo 07:00–13:00.
UPDATE "Settings"
  SET "kitchenHours" = '{"SAB":{"open":"07:00","close":"14:00"},"DOM":{"open":"07:00","close":"13:00"}}'::jsonb
  WHERE "kitchenHours" IS NULL;
