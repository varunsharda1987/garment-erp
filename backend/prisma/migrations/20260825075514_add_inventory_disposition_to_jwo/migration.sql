-- CreateEnum
CREATE TYPE "InventoryDisposition" AS ENUM ('PENDING', 'RETURNED_TO_STOCK', 'AT_PROCESSOR', 'WRITTEN_OFF', 'TRANSFERRED', 'RETURNED_TO_SUPPLIER');

-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "inventoryDisposition" "InventoryDisposition",
ADD COLUMN     "inventoryDispositionById" TEXT,
ADD COLUMN     "inventoryDispositionDate" TIMESTAMP(3),
ADD COLUMN     "inventoryDispositionNotes" TEXT,
ADD COLUMN     "inventoryTransferredToId" TEXT;

-- CreateIndex
CREATE INDEX "job_work_orders_inventoryDisposition_idx" ON "job_work_orders"("inventoryDisposition");

-- CreateIndex
CREATE INDEX "job_work_orders_inventoryDispositionById_idx" ON "job_work_orders"("inventoryDispositionById");

-- CreateIndex
CREATE INDEX "job_work_orders_inventoryTransferredToId_idx" ON "job_work_orders"("inventoryTransferredToId");

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_inventoryDispositionById_fkey" FOREIGN KEY ("inventoryDispositionById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_inventoryTransferredToId_fkey" FOREIGN KEY ("inventoryTransferredToId") REFERENCES "job_work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
