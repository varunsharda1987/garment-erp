-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "tallyLastError" TEXT,
ADD COLUMN     "tallyPushedAt" TIMESTAMP(3),
ADD COLUMN     "tallyVoucherNumber" TEXT;
