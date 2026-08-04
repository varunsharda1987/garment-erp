-- DropIndex
DROP INDEX "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key";

-- DropIndex
DROP INDEX "greige_stock_sourceChallanId_idx";

-- DropIndex
DROP INDEX "greige_stock_supplierId_idx";

-- AlterTable
ALTER TABLE "grn_items" ADD COLUMN     "actualRatePerUnit" DECIMAL(12,2),
ADD COLUMN     "receivedAsReadyFabric" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updateFutureSourcing" BOOLEAN NOT NULL DEFAULT false;

-- RenameIndex
ALTER INDEX "greige_stock_greigeId_procurementId_greigeWidth_qualityGra_key" RENAME TO "greige_stock_greigeId_procurementId_greigeWidth_qualityGrad_key";
