-- CreateEnum
CREATE TYPE "DeliveryLocationType" AS ENUM ('WAREHOUSE', 'PROCESSOR');

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "deliveryLocationAmendedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryLocationAmendedById" TEXT,
ADD COLUMN     "deliveryLocationId" TEXT,
ADD COLUMN     "deliveryLocationType" "DeliveryLocationType",
ADD COLUMN     "originalDeliveryLocationId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_deliveryLocationId_idx" ON "purchase_orders"("deliveryLocationId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_deliveryLocationAmendedById_fkey" FOREIGN KEY ("deliveryLocationAmendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
