-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'ABERTA',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "closedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "expectedQuantity" DECIMAL(12,4) NOT NULL,
    "countedQuantity" DECIMAL(12,4),
    "unitCostSnapshot" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "countedAt" TIMESTAMP(3),
    "countedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_status_startedAt_idx" ON "Inventory"("status", "startedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_ingredientId_idx" ON "InventoryItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_inventoryId_ingredientId_key" ON "InventoryItem"("inventoryId", "ingredientId");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
