-- AlterTable: Add patternPartId and fabricFinishType to fabric_stock
ALTER TABLE "fabric_stock" ADD COLUMN "pattern_part_id" TEXT;
ALTER TABLE "fabric_stock" ADD COLUMN "fabricFinishType" "FabricFinishType";

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_pattern_part_id_fkey" FOREIGN KEY ("pattern_part_id") REFERENCES "pattern_part_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "fabric_stock_pattern_part_id_idx" ON "fabric_stock"("pattern_part_id");
CREATE INDEX "fabric_stock_fabricFinishType_idx" ON "fabric_stock"("fabricFinishType");
