-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "scaleCode" TEXT,
ADD COLUMN     "scaleValidityDays" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_scaleCode_key" ON "Product"("scaleCode");

