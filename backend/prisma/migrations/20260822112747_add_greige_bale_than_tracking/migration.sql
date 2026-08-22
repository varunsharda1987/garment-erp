-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "baleCount" INTEGER;

-- CreateTable
CREATE TABLE "greige_stock_details" (
    "id" VARCHAR(50) NOT NULL,
    "greigeStockId" VARCHAR(50) NOT NULL,
    "baleNumber" INTEGER,
    "sequenceNo" INTEGER NOT NULL,
    "meters" DECIMAL(10,3) NOT NULL,
    "metersRemaining" DECIMAL(10,3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "greige_stock_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "greige_issue_details" (
    "id" VARCHAR(50) NOT NULL,
    "greigeStockDetailId" VARCHAR(50) NOT NULL,
    "jobWorkOrderId" VARCHAR(50),
    "challanId" VARCHAR(50),
    "metersIssued" DECIMAL(10,3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "greige_issue_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "greige_stock_details_greigeStockId_idx" ON "greige_stock_details"("greigeStockId");

-- CreateIndex
CREATE INDEX "greige_stock_details_status_idx" ON "greige_stock_details"("status");

-- CreateIndex
CREATE INDEX "greige_issue_details_greigeStockDetailId_idx" ON "greige_issue_details"("greigeStockDetailId");

-- CreateIndex
CREATE INDEX "greige_issue_details_jobWorkOrderId_idx" ON "greige_issue_details"("jobWorkOrderId");

-- CreateIndex
CREATE INDEX "greige_issue_details_challanId_idx" ON "greige_issue_details"("challanId");

-- AddForeignKey
ALTER TABLE "greige_stock_details" ADD CONSTRAINT "greige_stock_details_greigeStockId_fkey" FOREIGN KEY ("greigeStockId") REFERENCES "greige_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_issue_details" ADD CONSTRAINT "greige_issue_details_greigeStockDetailId_fkey" FOREIGN KEY ("greigeStockDetailId") REFERENCES "greige_stock_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_issue_details" ADD CONSTRAINT "greige_issue_details_jobWorkOrderId_fkey" FOREIGN KEY ("jobWorkOrderId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_issue_details" ADD CONSTRAINT "greige_issue_details_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "greige_issue_details" ADD CONSTRAINT "greige_issue_details_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
