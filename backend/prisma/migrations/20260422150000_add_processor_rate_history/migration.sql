-- Add rate history tracking fields to processor_rate_card
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "previousRateValue" DECIMAL(10,2);
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "changeReasonCode" TEXT;
ALTER TABLE "processor_rate_card" ADD COLUMN IF NOT EXISTS "changeNotes" TEXT;

-- Backfill effectiveFrom from createdAt for existing records
UPDATE "processor_rate_card" SET "effectiveFrom" = "createdAt" WHERE "effectiveFrom" = CURRENT_TIMESTAMP;

-- Add self-referencing FK for rate history chain
ALTER TABLE "processor_rate_card" ADD CONSTRAINT "processor_rate_card_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old unique constraint and create new one with effectiveFrom
DROP INDEX IF EXISTS "unique_rate_card_v3";
CREATE UNIQUE INDEX "unique_rate_card_v4" ON "processor_rate_card"("processorId", "processingType", "printingType", "greigeId", "laceId", "slabId", "effectiveFrom");

-- Add new indexes for efficient rate lookups
CREATE INDEX IF NOT EXISTS "processor_rate_card_processorId_processingType_effectiveFrom_idx"
  ON "processor_rate_card"("processorId", "processingType", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "processor_rate_card_effectiveTo_idx" ON "processor_rate_card"("effectiveTo");

-- Create processor_rate_change_log table for audit trail
CREATE TABLE IF NOT EXISTS "processor_rate_change_log" (
    "id" TEXT NOT NULL,
    "oldRateCardId" TEXT NOT NULL,
    "newRateCardId" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "processorName" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "printingType" TEXT,
    "greigeId" TEXT,
    "greigeName" TEXT,
    "laceId" TEXT,
    "laceName" TEXT,
    "slabId" TEXT,
    "slabLabel" TEXT,
    "previousRate" DECIMAL(10,2) NOT NULL,
    "newRate" DECIMAL(10,2) NOT NULL,
    "changeAmount" DECIMAL(10,2) NOT NULL,
    "changePercent" DECIMAL(5,2) NOT NULL,
    "changeReasonCode" TEXT,
    "changeNotes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "processor_rate_change_log_pkey" PRIMARY KEY ("id")
);

-- Add FK constraint to users table
ALTER TABLE "processor_rate_change_log" ADD CONSTRAINT "processor_rate_change_log_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes for processor_rate_change_log
CREATE INDEX IF NOT EXISTS "processor_rate_change_log_processorId_changedAt_idx"
  ON "processor_rate_change_log"("processorId", "changedAt");
CREATE INDEX IF NOT EXISTS "processor_rate_change_log_changedAt_idx"
  ON "processor_rate_change_log"("changedAt");
CREATE INDEX IF NOT EXISTS "processor_rate_change_log_greigeId_idx"
  ON "processor_rate_change_log"("greigeId");
CREATE INDEX IF NOT EXISTS "processor_rate_change_log_laceId_idx"
  ON "processor_rate_change_log"("laceId");
