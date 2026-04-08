-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "foldLengthCm" DECIMAL(5,2),
ADD COLUMN     "thanCount" INTEGER;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "foldLengthCm" DECIMAL(5,2),
ADD COLUMN     "thanCount" INTEGER;
