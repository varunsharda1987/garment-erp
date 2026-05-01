-- AlterTable
ALTER TABLE "fabric_procurement" ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "greige_stock" ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" VARCHAR(50);
