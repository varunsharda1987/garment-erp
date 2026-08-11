-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "tallyLastError" TEXT,
ADD COLUMN     "tallyPushedAt" TIMESTAMP(3),
ADD COLUMN     "tallyVoucherNumber" TEXT;
