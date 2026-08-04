-- AlterTable
ALTER TABLE "sale_orders" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "orderDate" TIMESTAMP(3),
ADD COLUMN     "paymentTerms" TEXT;
