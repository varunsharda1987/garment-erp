-- CreateEnum: SupplyType
DO $$ BEGIN
  CREATE TYPE "SupplyType" AS ENUM ('DOMESTIC', 'EXPORT_WITH_PAYMENT', 'EXPORT_WITHOUT_PAYMENT', 'SEZ_WITH_PAYMENT', 'SEZ_WITHOUT_PAYMENT', 'DEEMED_EXPORT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: invoices - E-Invoice fields
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceIrn" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceAckNo" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceAckDate" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceQrCode" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "eInvoiceStatus" TEXT;

-- AlterTable: invoices - E-Way Bill fields
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "ewayBillNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "ewayBillDate" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "ewayBillValidTo" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "transporterId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "transporterGstin" TEXT;

-- AlterTable: invoices - Supply type
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "supplyType" "SupplyType";

-- AlterTable: purchase_orders - RCM flag
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "isReverseCharge" BOOLEAN NOT NULL DEFAULT false;
