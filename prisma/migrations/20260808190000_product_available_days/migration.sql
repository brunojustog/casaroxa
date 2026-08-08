-- Dias da semana em que o produto é vendido (CSV "DOM,...,SAB"; null = sempre).
ALTER TABLE "Product" ADD COLUMN "availableDays" TEXT;
