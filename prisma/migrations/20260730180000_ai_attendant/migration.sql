-- Atendente IA no WhatsApp: conversas por telefone + chave liga/desliga.
-- Nasce DESLIGADO (aiAttendantEnabled=false).
CREATE TYPE "WaMessageRole" AS ENUM ('USER', 'ASSISTANT', 'NOTE');

ALTER TABLE "Settings" ADD COLUMN "aiAttendantEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "aiAttendantTestPhones" TEXT;

CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "displayName" TEXT,
    "customerId" TEXT,
    "handedOff" BOOLEAN NOT NULL DEFAULT false,
    "handedOffAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "WaMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaConversation_phone_key" ON "WaConversation"("phone");
CREATE INDEX "WaConversation_lastMessageAt_idx" ON "WaConversation"("lastMessageAt");
CREATE INDEX "WaConversation_handedOff_lastMessageAt_idx" ON "WaConversation"("handedOff", "lastMessageAt");
CREATE INDEX "WaMessage_conversationId_createdAt_idx" ON "WaMessage"("conversationId", "createdAt");

ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
