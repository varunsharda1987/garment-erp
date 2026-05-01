-- AlterTable
ALTER TABLE "greige_master" ALTER COLUMN "averageShrinkagePercent" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "foldLengthCm" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "style_costing_lace_items" ALTER COLUMN "wastagePercent" DROP DEFAULT;
