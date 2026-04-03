ALTER TABLE "Category" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Product" ADD COLUMN "ownerId" TEXT;

UPDATE "Category"
SET "ownerId" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "ownerId" IS NULL;

UPDATE "Product"
SET "ownerId" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "ownerId" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "Category" ADD CONSTRAINT "Category_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_ownerId_name_key" ON "Category"("ownerId", "name");

DROP INDEX IF EXISTS "Product_categoryId_name_key";
CREATE UNIQUE INDEX "Product_ownerId_categoryId_name_key" ON "Product"("ownerId", "categoryId", "name");
