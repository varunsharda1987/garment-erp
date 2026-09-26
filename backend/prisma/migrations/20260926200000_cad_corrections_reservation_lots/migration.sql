-- Correct CAD flow + requirement reconcile (garment-erp-37, 2026-09-26). Additive only.

-- CreateEnum
CREATE TYPE "CadCorrectionStatus" AS ENUM ('PENDING_APPROVAL', 'APPLIED', 'PARTIAL', 'REJECTED');

-- AlterEnum
ALTER TYPE "MaterialRequirementStatus" ADD VALUE 'DECISION_PENDING';

-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "surplusQty" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "order_bom_items" ADD COLUMN     "previousItemId" TEXT;

-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "fabricStockId" TEXT,
ADD COLUMN     "greigeStockId" VARCHAR(50),
ADD COLUMN     "laceStockId" TEXT;

-- CreateTable
CREATE TABLE "cad_corrections" (
    "id" TEXT NOT NULL,
    "cadId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "status" "CadCorrectionStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "impact" JSONB,
    "newCostSheetIds" TEXT[],
    "appliedOrders" JSONB,
    "correctedById" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cad_corrections_cadId_idx" ON "cad_corrections"("cadId");

-- CreateIndex
CREATE INDEX "cad_corrections_styleId_idx" ON "cad_corrections"("styleId");

-- CreateIndex
CREATE INDEX "cad_corrections_status_idx" ON "cad_corrections"("status");

-- CreateIndex
CREATE INDEX "order_bom_items_previousItemId_idx" ON "order_bom_items"("previousItemId");

-- CreateIndex
CREATE INDEX "stock_reservations_greigeStockId_idx" ON "stock_reservations"("greigeStockId");

-- CreateIndex
CREATE INDEX "stock_reservations_fabricStockId_idx" ON "stock_reservations"("fabricStockId");

-- CreateIndex
CREATE INDEX "stock_reservations_laceStockId_idx" ON "stock_reservations"("laceStockId");

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_previousItemId_fkey" FOREIGN KEY ("previousItemId") REFERENCES "order_bom_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_greigeStockId_fkey" FOREIGN KEY ("greigeStockId") REFERENCES "greige_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_fabricStockId_fkey" FOREIGN KEY ("fabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_laceStockId_fkey" FOREIGN KEY ("laceStockId") REFERENCES "lace_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_corrections" ADD CONSTRAINT "cad_corrections_cadId_fkey" FOREIGN KEY ("cadId") REFERENCES "fabric_width_cad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_corrections" ADD CONSTRAINT "cad_corrections_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_corrections" ADD CONSTRAINT "cad_corrections_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cad_corrections" ADD CONSTRAINT "cad_corrections_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

