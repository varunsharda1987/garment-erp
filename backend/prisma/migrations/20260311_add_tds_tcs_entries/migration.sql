-- CreateEnum: TDSStatus
DO $$ BEGIN
  CREATE TYPE "TDSStatus" AS ENUM ('PENDING', 'CERTIFICATE_RECEIVED', 'VERIFIED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: tds_entries
CREATE TABLE IF NOT EXISTS "tds_entries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "deductorName" TEXT NOT NULL,
    "deducteeName" TEXT NOT NULL,
    "tdsSection" TEXT NOT NULL,
    "tdsRate" DECIMAL(5,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "tdsAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "certificateNo" TEXT,
    "deductionDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" "TDSStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tds_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tcs_entries
CREATE TABLE IF NOT EXISTS "tcs_entries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerName" TEXT NOT NULL,
    "tcsSection" TEXT NOT NULL,
    "tcsRate" DECIMAL(5,2) NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "tcsAmount" DECIMAL(12,2) NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "financialYear" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tcs_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes: tds_entries
CREATE INDEX IF NOT EXISTS "tds_entries_invoiceId_idx" ON "tds_entries"("invoiceId");
CREATE INDEX IF NOT EXISTS "tds_entries_financialYear_quarter_idx" ON "tds_entries"("financialYear", "quarter");
CREATE INDEX IF NOT EXISTS "tds_entries_status_idx" ON "tds_entries"("status");

-- CreateIndexes: tcs_entries
CREATE INDEX IF NOT EXISTS "tcs_entries_invoiceId_idx" ON "tcs_entries"("invoiceId");
CREATE INDEX IF NOT EXISTS "tcs_entries_financialYear_quarter_idx" ON "tcs_entries"("financialYear", "quarter");
CREATE INDEX IF NOT EXISTS "tcs_entries_status_idx" ON "tcs_entries"("status");
