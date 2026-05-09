-- CreateEnum
CREATE TYPE "SaleProgress" AS ENUM ('NOVO', 'CONFIRMADO', 'PREPARANDO', 'PRONTO', 'SAIU_ENTREGA', 'ENTREGUE');

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "progress" "SaleProgress" NOT NULL DEFAULT 'NOVO',
ADD COLUMN     "progressEstimateMinutes" INTEGER,
ADD COLUMN     "progressUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sale_progress_source_idx" ON "Sale"("progress", "source");
