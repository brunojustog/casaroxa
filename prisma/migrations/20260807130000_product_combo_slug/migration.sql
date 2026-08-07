-- URLs amigáveis no site público
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "Combo" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Combo_slug_key" ON "Combo"("slug");
