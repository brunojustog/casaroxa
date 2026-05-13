-- Sprint 2: Pré-venda (SalesEvent + SalesEventProduct + SalesEventWindow)

-- Enums
CREATE TYPE "SalesEventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "SalesEventWindowKind" AS ENUM ('PICKUP', 'DELIVERY');

-- SalesEvent
CREATE TABLE "SalesEvent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventDate" DATE NOT NULL,
  "status" "SalesEventStatus" NOT NULL DEFAULT 'DRAFT',
  "opensAt" TIMESTAMP(3) NOT NULL,
  "closesAt" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "reservationTimeoutMinutes" INTEGER NOT NULL DEFAULT 120,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesEvent_status_eventDate_idx" ON "SalesEvent"("status", "eventDate");
ALTER TABLE "SalesEvent"
  ADD CONSTRAINT "SalesEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SalesEventProduct (polimórfico: product OR combo)
CREATE TABLE "SalesEventProduct" (
  "id" TEXT NOT NULL,
  "salesEventId" TEXT NOT NULL,
  "productId" TEXT,
  "comboId" TEXT,
  "quantityLimit" INTEGER NOT NULL,
  "reservedQty" INTEGER NOT NULL DEFAULT 0,
  "unitPriceCents" INTEGER,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesEventProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesEventProduct_salesEventId_idx" ON "SalesEventProduct"("salesEventId");
CREATE UNIQUE INDEX "SalesEventProduct_salesEventId_productId_key"
  ON "SalesEventProduct"("salesEventId", "productId");
CREATE UNIQUE INDEX "SalesEventProduct_salesEventId_comboId_key"
  ON "SalesEventProduct"("salesEventId", "comboId");
ALTER TABLE "SalesEventProduct"
  ADD CONSTRAINT "SalesEventProduct_salesEventId_fkey"
  FOREIGN KEY ("salesEventId") REFERENCES "SalesEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesEventProduct"
  ADD CONSTRAINT "SalesEventProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesEventProduct"
  ADD CONSTRAINT "SalesEventProduct_comboId_fkey"
  FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SalesEventWindow
CREATE TABLE "SalesEventWindow" (
  "id" TEXT NOT NULL,
  "salesEventId" TEXT NOT NULL,
  "kind" "SalesEventWindowKind" NOT NULL,
  "label" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 0,
  "reservedCount" INTEGER NOT NULL DEFAULT 0,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesEventWindow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesEventWindow_salesEventId_startsAt_idx"
  ON "SalesEventWindow"("salesEventId", "startsAt");
ALTER TABLE "SalesEventWindow"
  ADD CONSTRAINT "SalesEventWindow_salesEventId_fkey"
  FOREIGN KEY ("salesEventId") REFERENCES "SalesEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sale: novas FKs opcionais
ALTER TABLE "Sale" ADD COLUMN "salesEventId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "salesEventWindowId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_salesEventId_fkey"
  FOREIGN KEY ("salesEventId") REFERENCES "SalesEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_salesEventWindowId_fkey"
  FOREIGN KEY ("salesEventWindowId") REFERENCES "SalesEventWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
