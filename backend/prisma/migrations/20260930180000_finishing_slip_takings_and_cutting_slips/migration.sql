-- 1. What each finishing issue took from each stitching → finishing transfer slip (2026-09-30).
-- A finishing issue never used its slip up: create did not touch the slip, receive (from the pages)
-- never flipped it, so the same stitched pieces could be issued to finishing again and again. Same
-- rule as stitching_issue_slip_skus (migration 20260930150000): a slip stays open while any piece is
-- not yet issued and turns RECEIVED only when these rows cover it
-- (backend/src/services/helpers/stitching-slip-balance.helper.ts, stage FINISHING).

-- CreateTable
CREATE TABLE "finishing_issue_slip_skus" (
    "id" TEXT NOT NULL,
    "finishingIssueId" TEXT NOT NULL,
    "transferSlipId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finishing_issue_slip_skus_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finishing_issue_slip_skus_quantity_positive" CHECK ("quantity" > 0)
);

-- A blank colour is ONE value: NULLS NOT DISTINCT. Prisma cannot express it; the schema keeps a plain
-- @@unique of the same name. Never drop/recreate it through Prisma.
CREATE UNIQUE INDEX "finishing_issue_slip_skus_finishingIssueId_transferSlipId_colorId_sizeId_key" ON "finishing_issue_slip_skus"("finishingIssueId", "transferSlipId", "colorId", "sizeId") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "finishing_issue_slip_skus_transferSlipId_idx" ON "finishing_issue_slip_skus"("transferSlipId");

-- AddForeignKey
ALTER TABLE "finishing_issue_slip_skus" ADD CONSTRAINT "finishing_issue_slip_skus_finishingIssueId_fkey" FOREIGN KEY ("finishingIssueId") REFERENCES "finishing_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finishing_issue_slip_skus" ADD CONSTRAINT "finishing_issue_slip_skus_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "transfer_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. A cutting batch may reach stitching on several slips. The partial unique index
-- transfer_slips_cuttingBatchId_key ("ONE slip per production source", bug-hunt production-8, created
-- by the archived migration 20260722150000 and never carried into the baseline — so it existed on live
-- but not on a database built from this migration chain) refused every second Issue to Stitching and
-- made Generate Transfer Slip refuse after a partial issue: the rest of the batch could never reach
-- stitching. The cap is now the batch's good pieces per colour + size, under a batch row lock
-- (backend/src/services/helpers/cutting-slip.helper.ts). The stitchingIssueId / finishingIssueId
-- partial uniques stay: a stitching or finishing issue still sends ONE slip onward.
DROP INDEX IF EXISTS "transfer_slips_cuttingBatchId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transfer_slips_cuttingBatchId_idx" ON "transfer_slips"("cuttingBatchId");
