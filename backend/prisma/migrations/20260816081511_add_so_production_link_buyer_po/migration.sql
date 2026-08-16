-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "saleOrderId" TEXT;

-- AlterTable
ALTER TABLE "sale_orders" ADD COLUMN     "buyerPoNumber" TEXT;

-- CreateIndex
CREATE INDEX "orders_saleOrderId_idx" ON "orders"("saleOrderId");

-- CreateIndex
CREATE INDEX "sale_orders_buyerPoNumber_idx" ON "sale_orders"("buyerPoNumber");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
