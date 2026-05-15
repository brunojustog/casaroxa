-- Sprint 8a: IngredientAlias — matching melhor de NFe via memória

CREATE TYPE "IngredientAliasSource" AS ENUM ('XML_NFE', 'MANUAL');

CREATE TABLE "IngredientAlias" (
  "id"             TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "rawName"        TEXT NOT NULL,
  "ingredientId"   TEXT NOT NULL,
  "source"         "IngredientAliasSource" NOT NULL DEFAULT 'XML_NFE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngredientAlias_normalizedName_key"
  ON "IngredientAlias"("normalizedName");
CREATE INDEX "IngredientAlias_ingredientId_idx"
  ON "IngredientAlias"("ingredientId");
ALTER TABLE "IngredientAlias"
  ADD CONSTRAINT "IngredientAlias_ingredientId_fkey"
  FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
