-- One delivery, one receipt — however many times it is sent (2026-09-25).
-- A stalled server answered "Response timeout" while still saving; the user pressed Receive again and
-- six receipts were filed for one delivery of DJ-ESSKY076LS-001. The Receive-from-processor dialog now
-- sends a per-opening key; the same key arriving again returns the receipt already filed.
-- Additive only: a nullable column, unique (NULLs never collide, so every existing receipt is untouched).

-- AlterTable
ALTER TABLE "goods_receiving_notes" ADD COLUMN     "submissionKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "goods_receiving_notes_submissionKey_key" ON "goods_receiving_notes"("submissionKey");
