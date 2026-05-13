-- Sprint 3: Encomendas (OrderRequest + OrderRequestItem)

-- Enums
CREATE TYPE "OrderRequestStatus" AS ENUM (
  'PENDENTE', 'APROVADA', 'RECUSADA', 'EM_PRODUCAO', 'PRONTA', 'ENTREGUE', 'CANCELADA'
);
CREATE TYPE "OrderRequestSource" AS ENUM ('SITE', 'ADMIN');
CREATE TYPE "OrderRequestDeliveryMode" AS ENUM ('PICKUP', 'DELIVERY');

-- Settings: nova coluna com default 48
ALTER TABLE "Settings"
  ADD COLUMN "orderLeadTimeHours" INTEGER NOT NULL DEFAULT 48;

-- OrderRequest
CREATE TABLE "OrderRequest" (
  "id" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerId" TEXT,
  "requestedFor" TIMESTAMP(3) NOT NULL,
  "deliveryMode" "OrderRequestDeliveryMode" NOT NULL DEFAULT 'PICKUP',
  "address" TEXT,
  "addressNumber" TEXT,
  "addressComplement" TEXT,
  "neighborhood" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "status" "OrderRequestStatus" NOT NULL DEFAULT 'PENDENTE',
  "source" "OrderRequestSource" NOT NULL DEFAULT 'SITE',
  "rejectionReason" TEXT,
  "adminNotes" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "depositRequiredCents" INTEGER,
  "depositPaidAt" TIMESTAMP(3),
  "saleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderRequest_number_key" ON "OrderRequest"("number");
CREATE UNIQUE INDEX "OrderRequest_saleId_key" ON "OrderRequest"("saleId");
CREATE INDEX "OrderRequest_status_requestedFor_idx" ON "OrderRequest"("status", "requestedFor");
CREATE INDEX "OrderRequest_requestedFor_idx" ON "OrderRequest"("requestedFor");
CREATE INDEX "OrderRequest_customerId_idx" ON "OrderRequest"("customerId");

ALTER TABLE "OrderRequest"
  ADD CONSTRAINT "OrderRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderRequest"
  ADD CONSTRAINT "OrderRequest_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderRequest"
  ADD CONSTRAINT "OrderRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderRequest"
  ADD CONSTRAINT "OrderRequest_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderRequestItem
CREATE TABLE "OrderRequestItem" (
  "id" TEXT NOT NULL,
  "orderRequestId" TEXT NOT NULL,
  "productId" TEXT,
  "comboId" TEXT,
  "quantity" DECIMAL(10,4) NOT NULL,
  "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderRequestItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderRequestItem_orderRequestId_idx" ON "OrderRequestItem"("orderRequestId");

ALTER TABLE "OrderRequestItem"
  ADD CONSTRAINT "OrderRequestItem_orderRequestId_fkey"
  FOREIGN KEY ("orderRequestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRequestItem"
  ADD CONSTRAINT "OrderRequestItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRequestItem"
  ADD CONSTRAINT "OrderRequestItem_comboId_fkey"
  FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
