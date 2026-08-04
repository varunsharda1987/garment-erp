-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "orderBomItemId" TEXT,
ADD COLUMN     "rateSource" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,4);

-- CreateIndex
CREATE INDEX "material_requirements_orderBomItemId_idx" ON "material_requirements"("orderBomItemId");

-- AddForeignKey
ALTER TABLE "material_requirements" ADD CONSTRAINT "material_requirements_orderBomItemId_fkey" FOREIGN KEY ("orderBomItemId") REFERENCES "order_bom_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
