-- AlterTable: Rename buyerName to customerName in styles table
ALTER TABLE "styles" RENAME COLUMN "buyerName" TO "customerName";

-- Drop old index
DROP INDEX IF EXISTS "styles_buyerName_idx";

-- Create new index
CREATE INDEX "styles_customerName_idx" ON "styles"("customerName");
