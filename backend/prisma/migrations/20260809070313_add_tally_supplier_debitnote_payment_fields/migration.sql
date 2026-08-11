-- AlterTable
ALTER TABLE "debit_notes" ADD COLUMN     "tallyLastError" TEXT,
ADD COLUMN     "tallyPushedAt" TIMESTAMP(3),
ADD COLUMN     "tallyVoucherNumber" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tallyLastError" TEXT,
ADD COLUMN     "tallyPushedAt" TIMESTAMP(3),
ADD COLUMN     "tallyVoucherNumber" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "tallyLedgerName" TEXT;
