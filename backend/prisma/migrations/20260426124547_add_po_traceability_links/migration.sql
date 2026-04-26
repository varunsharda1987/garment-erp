-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "cadId" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "styleId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_styleId_idx" ON "purchase_orders"("styleId");

-- CreateIndex
CREATE INDEX "purchase_orders_orderId_idx" ON "purchase_orders"("orderId");

-- CreateIndex
CREATE INDEX "purchase_orders_cadId_idx" ON "purchase_orders"("cadId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cadId_fkey" FOREIGN KEY ("cadId") REFERENCES "fabric_width_cad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
