-- CreateTable
CREATE TABLE "button_stock" (
    "id" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
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

    CONSTRAINT "button_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zipper_stock" (
    "id" TEXT NOT NULL,
    "zipperId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
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

    CONSTRAINT "zipper_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elastic_stock" (
    "id" TEXT NOT NULL,
    "elasticId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'meters',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
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

    CONSTRAINT "elastic_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_stock" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
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

    CONSTRAINT "label_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packaging_stock" (
    "id" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pieces',
    "procurementId" TEXT,
    "supplierId" TEXT,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "sourceType" TEXT,
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "warehouseLocation" TEXT,
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

    CONSTRAINT "packaging_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "button_stock_buttonId_status_idx" ON "button_stock"("buttonId", "status");

-- CreateIndex
CREATE INDEX "button_stock_status_idx" ON "button_stock"("status");

-- CreateIndex
CREATE INDEX "button_stock_receivedDate_idx" ON "button_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "zipper_stock_zipperId_status_idx" ON "zipper_stock"("zipperId", "status");

-- CreateIndex
CREATE INDEX "zipper_stock_status_idx" ON "zipper_stock"("status");

-- CreateIndex
CREATE INDEX "zipper_stock_receivedDate_idx" ON "zipper_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "elastic_stock_elasticId_status_idx" ON "elastic_stock"("elasticId", "status");

-- CreateIndex
CREATE INDEX "elastic_stock_status_idx" ON "elastic_stock"("status");

-- CreateIndex
CREATE INDEX "elastic_stock_receivedDate_idx" ON "elastic_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "label_stock_labelId_status_idx" ON "label_stock"("labelId", "status");

-- CreateIndex
CREATE INDEX "label_stock_status_idx" ON "label_stock"("status");

-- CreateIndex
CREATE INDEX "label_stock_receivedDate_idx" ON "label_stock"("receivedDate");

-- CreateIndex
CREATE INDEX "packaging_stock_packagingId_status_idx" ON "packaging_stock"("packagingId", "status");

-- CreateIndex
CREATE INDEX "packaging_stock_status_idx" ON "packaging_stock"("status");

-- CreateIndex
CREATE INDEX "packaging_stock_receivedDate_idx" ON "packaging_stock"("receivedDate");

-- AddForeignKey
ALTER TABLE "button_stock" ADD CONSTRAINT "button_stock_buttonId_fkey" FOREIGN KEY ("buttonId") REFERENCES "button_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_stock" ADD CONSTRAINT "button_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "button_stock" ADD CONSTRAINT "button_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_stock" ADD CONSTRAINT "zipper_stock_zipperId_fkey" FOREIGN KEY ("zipperId") REFERENCES "zipper_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_stock" ADD CONSTRAINT "zipper_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zipper_stock" ADD CONSTRAINT "zipper_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_stock" ADD CONSTRAINT "elastic_stock_elasticId_fkey" FOREIGN KEY ("elasticId") REFERENCES "elastic_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_stock" ADD CONSTRAINT "elastic_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elastic_stock" ADD CONSTRAINT "elastic_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_stock" ADD CONSTRAINT "label_stock_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_stock" ADD CONSTRAINT "label_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_stock" ADD CONSTRAINT "label_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_stock" ADD CONSTRAINT "packaging_stock_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packaging_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_stock" ADD CONSTRAINT "packaging_stock_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_stock" ADD CONSTRAINT "packaging_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
