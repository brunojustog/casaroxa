-- Avaliações do Google (curadas) pro carrossel de prova social da Home
CREATE TABLE "GoogleReview" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "text" TEXT NOT NULL,
    "reviewedAtLabel" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoogleReview_active_displayOrder_idx" ON "GoogleReview"("active", "displayOrder");
