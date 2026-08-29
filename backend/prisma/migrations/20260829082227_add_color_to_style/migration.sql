-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "colorId" TEXT;

-- CreateIndex
CREATE INDEX "styles_colorId_idx" ON "styles"("colorId");

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
