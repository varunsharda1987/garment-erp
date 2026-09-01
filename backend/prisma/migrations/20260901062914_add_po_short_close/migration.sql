-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'SHORT_CLOSED';

-- AlterTable
ALTER TABLE "material_requirements" ADD COLUMN     "shortCloseReason" TEXT,
ADD COLUMN     "shortQuantity" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "shortCloseReason" TEXT,
ADD COLUMN     "shortClosedAt" TIMESTAMP(3),
ADD COLUMN     "shortClosedById" TEXT;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_shortClosedById_fkey" FOREIGN KEY ("shortClosedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
