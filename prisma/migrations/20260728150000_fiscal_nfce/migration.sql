-- Módulo fiscal NFC-e (modelo 65): documentos, campos NCM/CEST/CFOP nos
-- produtos e configurações de emissão. Módulo nasce DESLIGADO (dormante).
CREATE TYPE "FiscalEnvironment" AS ENUM ('SIMULADO', 'HOMOLOGACAO', 'PRODUCAO');
CREATE TYPE "FiscalDocStatus" AS ENUM ('PENDENTE', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO');

ALTER TABLE "Settings" ADD COLUMN "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "fiscalEnvironment" "FiscalEnvironment" NOT NULL DEFAULT 'SIMULADO';
ALTER TABLE "Settings" ADD COLUMN "fiscalSeries" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "fiscalNextNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "fiscalDefaultCfop" TEXT NOT NULL DEFAULT '5102';
ALTER TABLE "Settings" ADD COLUMN "fiscalDefaultNcm" TEXT NOT NULL DEFAULT '21069090';
ALTER TABLE "Settings" ADD COLUMN "fiscalCscId" TEXT;

ALTER TABLE "Product" ADD COLUMN "ncm" TEXT;
ALTER TABLE "Product" ADD COLUMN "cest" TEXT;
ALTER TABLE "Product" ADD COLUMN "cfop" TEXT;

CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "model" INTEGER NOT NULL DEFAULT 65,
    "series" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "environment" "FiscalEnvironment" NOT NULL,
    "status" "FiscalDocStatus" NOT NULL DEFAULT 'PENDENTE',
    "accessKey" TEXT,
    "protocol" TEXT,
    "qrCodeUrl" TEXT,
    "cpfCnpj" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "xml" TEXT,
    "rejectionCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "authorizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalDocument_saleId_key" ON "FiscalDocument"("saleId");
CREATE UNIQUE INDEX "FiscalDocument_accessKey_key" ON "FiscalDocument"("accessKey");
CREATE UNIQUE INDEX "FiscalDocument_model_series_number_environment_key" ON "FiscalDocument"("model", "series", "number", "environment");
CREATE INDEX "FiscalDocument_status_createdAt_idx" ON "FiscalDocument"("status", "createdAt");

ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
