-- CreateEnum
CREATE TYPE "ThreadRequirementStatus" AS ENUM ('PENDING', 'PO_GENERATED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "POCategory" ADD VALUE 'THREAD';

-- AlterTable
ALTER TABLE "order_thread_requirements" ADD COLUMN     "poItemId" TEXT,
ADD COLUMN     "status" "ThreadRequirementStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "thread_stock" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "procurementId" TEXT,
    "supplierLotNumber" TEXT,
    "quantityAvailable" DECIMAL(10,2) NOT NULL,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityConsumed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'SPOOL',
    "boxesAvailable" DECIMAL(10,2),
    "metersAvailable" DECIMAL(10,2),
    "purchaseCost" DECIMAL(10,2) NOT NULL,
    "weightedAvgCost" DECIMAL(10,2) NOT NULL,
    "ply" "ThreadPly",
    "packagingType" "ThreadPackagingType",
    "materialComposition" "ThreadMaterial",
    "colorName" TEXT,
    "warehouseLocation" TEXT,
    "rackNumber" TEXT,
    "qualityGrade" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "stockType" TEXT NOT NULL DEFAULT 'PLANNED_STOCK',
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "lastConsumedDate" TIMESTAMP(3),
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "thread_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_stock_transaction" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT NOT NULL,

    CONSTRAINT "thread_stock_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thread_stock_threadId_status_idx" ON "thread_stock"("threadId", "status");

-- CreateIndex
CREATE INDEX "thread_stock_status_idx" ON "thread_stock"("status");

-- CreateIndex
CREATE INDEX "thread_stock_packagingType_ply_idx" ON "thread_stock"("packagingType", "ply");

-- CreateIndex
CREATE INDEX "thread_stock_receivedDate_idx" ON "thread_stock"("receivedDate");

-- CreateIndex
CREATE UNIQUE INDEX "thread_stock_threadId_procurementId_packagingType_ply_key" ON "thread_stock"("threadId", "procurementId", "packagingType", "ply");

-- CreateIndex
CREATE INDEX "thread_stock_transaction_stockId_idx" ON "thread_stock_transaction"("stockId");

-- CreateIndex
CREATE INDEX "thread_stock_transaction_transactionType_idx" ON "thread_stock_transaction"("transactionType");

-- CreateIndex
CREATE INDEX "thread_stock_transaction_transactionDate_idx" ON "thread_stock_transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "order_thread_requirements_status_idx" ON "order_thread_requirements"("status");

-- CreateIndex
CREATE INDEX "order_thread_requirements_supplierId_idx" ON "order_thread_requirements"("supplierId");

-- AddForeignKey
ALTER TABLE "order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_thread_requirements" ADD CONSTRAINT "order_thread_requirements_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_stock" ADD CONSTRAINT "thread_stock_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "thread_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_stock" ADD CONSTRAINT "thread_stock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_stock_transaction" ADD CONSTRAINT "thread_stock_transaction_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "thread_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_stock_transaction" ADD CONSTRAINT "thread_stock_transaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
