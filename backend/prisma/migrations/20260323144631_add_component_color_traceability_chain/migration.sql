-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "componentName" TEXT;

-- AlterTable
ALTER TABLE "fabric_processing" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "componentName" TEXT;

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "componentName" TEXT;

-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "componentName" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "componentName" TEXT;
