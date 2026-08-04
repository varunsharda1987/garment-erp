-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "calculatedActualMeters" DECIMAL(10,2),
ADD COLUMN     "foldLengthCm" DECIMAL(5,2),
ADD COLUMN     "nominalQuantity" DECIMAL(10,2),
ADD COLUMN     "thanCount" INTEGER;
