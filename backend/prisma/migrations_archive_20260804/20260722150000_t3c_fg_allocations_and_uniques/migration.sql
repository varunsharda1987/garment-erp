-- T3-C (FG-ledger completion), all ADDITIVE. Verified pre-flight: 0 rows in transfer_slips and
-- delivery_notes, 0 duplicate slipNumbers/deliveryNumbers — the unique indexes cannot fail on existing data.

-- 1. Allocation records: which finished_goods_stock rows a delivery note actually deducted, and by how
--    much. Written inside the create-note tx; exact restore source when a PENDING note is deleted
--    (bug-hunt dispatch-2).
CREATE TABLE IF NOT EXISTS "delivery_note_fg_allocations" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "fgStockId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_note_fg_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_note_fg_allocations_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId")
        REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delivery_note_fg_allocations_fgStockId_fkey" FOREIGN KEY ("fgStockId")
        REFERENCES "finished_goods_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "delivery_note_fg_allocations_deliveryNoteId_idx" ON "delivery_note_fg_allocations"("deliveryNoteId");
CREATE INDEX IF NOT EXISTS "delivery_note_fg_allocations_fgStockId_idx" ON "delivery_note_fg_allocations"("fgStockId");

-- 2. Legal document numbers become UNIQUE (bug-hunt dispatch-5 / production-8): the count-based
--    generators could mint duplicates under concurrency; now the loser fails loudly (P2002) instead of
--    silently issuing two documents with one number.
DROP INDEX IF EXISTS "delivery_notes_deliveryNumber_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_notes_deliveryNumber_key" ON "delivery_notes"("deliveryNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_slips_slipNumber_key" ON "transfer_slips"("slipNumber");

-- 3. ONE slip per production source (bug-hunt production-8): a second transfer slip for the same
--    cutting batch / stitching issue / finishing issue double-counted the same good pieces into FG.
--    Partial uniques (WHERE NOT NULL) make the duplicate impossible at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_slips_cuttingBatchId_key" ON "transfer_slips"("cuttingBatchId") WHERE "cuttingBatchId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_slips_stitchingIssueId_key" ON "transfer_slips"("stitchingIssueId") WHERE "stitchingIssueId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_slips_finishingIssueId_key" ON "transfer_slips"("finishingIssueId") WHERE "finishingIssueId" IS NOT NULL;
