-- AlterTable
ALTER TABLE "style_costing_accessory_items" ADD COLUMN     "masterId" TEXT;

-- AlterTable
ALTER TABLE "style_costing_trim_items" ADD COLUMN     "masterId" TEXT;

-- CreateIndex
CREATE INDEX "style_costing_accessory_items_masterId_idx" ON "style_costing_accessory_items"("masterId");

-- CreateIndex
CREATE INDEX "style_costing_trim_items_masterId_idx" ON "style_costing_trim_items"("masterId");
