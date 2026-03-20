-- AlterTable: Add purchaseOrderId and greigeStockLotId to job_work_orders
ALTER TABLE "job_work_orders" ADD COLUMN "purchaseOrderId" VARCHAR(50);
ALTER TABLE "job_work_orders" ADD COLUMN "greigeStockLotId" VARCHAR(50);

-- CreateIndex: unique constraint for 1:1 PO relationship
CREATE UNIQUE INDEX "job_work_orders_purchaseOrderId_key" ON "job_work_orders"("purchaseOrderId");

-- CreateIndex: indexes for performance
CREATE INDEX "job_work_orders_purchaseOrderId_idx" ON "job_work_orders"("purchaseOrderId");
CREATE INDEX "job_work_orders_greigeStockLotId_idx" ON "job_work_orders"("greigeStockLotId");

-- AddForeignKey: link job_work_orders to purchase_orders
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: link job_work_orders to greige_stock
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_greigeStockLotId_fkey" FOREIGN KEY ("greigeStockLotId") REFERENCES "greige_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
