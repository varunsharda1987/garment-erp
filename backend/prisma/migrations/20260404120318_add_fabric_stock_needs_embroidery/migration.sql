-- AlterTable
ALTER TABLE "customer_accessories_preset_items" ALTER COLUMN "materialType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fabric_stock" ADD COLUMN     "needsEmbroidery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "material_master" ALTER COLUMN "materialType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "style_material_bom" ALTER COLUMN "materialType" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "fabric_stock_needsEmbroidery_status_idx" ON "fabric_stock"("needsEmbroidery", "status");
