-- AlterTable
ALTER TABLE "button_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "elastic_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "fabric_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "warehouseId" VARCHAR(50);

-- AlterTable
ALTER TABLE "label_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "lace_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "packaging_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "thread_stock" ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "zipper_stock" ADD COLUMN     "warehouseId" TEXT;

-- CreateTable
CREATE TABLE "machine_part_stock" (
    "id" TEXT NOT NULL,
    "machinePartId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PIECE',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
    "warehouseId" TEXT,
    "rackNumber" TEXT,
    "qualityGrade" TEXT NOT NULL DEFAULT 'A',
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "stockType" "StockEntryType" NOT NULL DEFAULT 'GENERIC',
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastConsumedDate" TIMESTAMP(3),
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "machine_part_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_material_stock" (
    "id" TEXT NOT NULL,
    "otherMaterialId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PIECE',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
    "warehouseId" TEXT,
    "rackNumber" TEXT,
    "qualityGrade" TEXT NOT NULL DEFAULT 'A',
    "status" "StockStatus" NOT NULL DEFAULT 'AVAILABLE',
    "stockType" "StockEntryType" NOT NULL DEFAULT 'GENERIC',
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastConsumedDate" TIMESTAMP(3),
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "other_material_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machine_part_stock_machinePartId_status_idx" ON "machine_part_stock"("machinePartId", "status");

-- CreateIndex
CREATE INDEX "machine_part_stock_warehouseId_idx" ON "machine_part_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "machine_part_stock_status_idx" ON "machine_part_stock"("status");

-- CreateIndex
CREATE INDEX "machine_part_stock_receivedDate_idx" ON "machine_part_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "other_material_stock_otherMaterialId_status_idx" ON "other_material_stock"("otherMaterialId", "status");

-- CreateIndex
CREATE INDEX "other_material_stock_warehouseId_idx" ON "other_material_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "other_material_stock_status_idx" ON "other_material_stock"("status");

-- CreateIndex
CREATE INDEX "other_material_stock_receivedDate_idx" ON "other_material_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "button_stock_warehouseId_idx" ON "button_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "elastic_stock_warehouseId_idx" ON "elastic_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "fabric_stock_warehouseId_idx" ON "fabric_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "greige_stock_warehouseId_idx" ON "greige_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "label_stock_warehouseId_idx" ON "label_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "lace_stock_warehouseId_idx" ON "lace_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "packaging_stock_warehouseId_idx" ON "packaging_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "thread_stock_warehouseId_idx" ON "thread_stock"("warehouseId");

-- CreateIndex
CREATE INDEX "zipper_stock_warehouseId_idx" ON "zipper_stock"("warehouseId");

-- AddForeignKey
ALTER TABLE "greige_stock" ADD CONSTRAINT "greige_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fabric_stock" ADD CONSTRAINT "fabric_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lace_stock" ADD CONSTRAINT "lace_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_stock" ADD CONSTRAINT "thread_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_stock" ADD CONSTRAINT "button_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_stock" ADD CONSTRAINT "zipper_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_stock" ADD CONSTRAINT "elastic_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_stock" ADD CONSTRAINT "label_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_stock" ADD CONSTRAINT "packaging_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_stock" ADD CONSTRAINT "machine_part_stock_machinePartId_fkey" FOREIGN KEY ("machinePartId") REFERENCES "machine_part_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_stock" ADD CONSTRAINT "machine_part_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_stock" ADD CONSTRAINT "machine_part_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_part_stock" ADD CONSTRAINT "machine_part_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_stock" ADD CONSTRAINT "other_material_stock_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "other_material_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_stock" ADD CONSTRAINT "other_material_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_stock" ADD CONSTRAINT "other_material_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_material_stock" ADD CONSTRAINT "other_material_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
