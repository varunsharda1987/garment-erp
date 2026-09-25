-- AlterTable
ALTER TABLE "styles" ADD COLUMN     "customerSizePresetId" TEXT;

-- CreateIndex
CREATE INDEX "styles_customerSizePresetId_idx" ON "styles"("customerSizePresetId");

-- AddForeignKey
ALTER TABLE "styles" ADD CONSTRAINT "styles_customerSizePresetId_fkey" FOREIGN KEY ("customerSizePresetId") REFERENCES "customer_size_category_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
