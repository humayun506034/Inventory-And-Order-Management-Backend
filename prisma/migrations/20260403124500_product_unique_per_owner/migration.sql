DROP INDEX IF EXISTS "Product_ownerId_categoryId_name_key";
CREATE UNIQUE INDEX "Product_ownerId_name_key" ON "Product"("ownerId", "name");
