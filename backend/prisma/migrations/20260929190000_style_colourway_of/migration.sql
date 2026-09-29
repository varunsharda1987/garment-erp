-- Create Colourway (owner, 2026-09-29): a colourway is its own style, copied from another with a new colour.
-- This links the copies: each points at the FIRST style of its colour group (null on that style), so a style
-- page can list its colourways. Written only by style-colourway.service.ts. Additive and nullable.

-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "colourwayOfStyleId" TEXT;

-- CreateIndex
CREATE INDEX "styles_colourwayOfStyleId_idx" ON "styles"("colourwayOfStyleId");

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_colourwayOfStyleId_fkey" FOREIGN KEY ("colourwayOfStyleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
