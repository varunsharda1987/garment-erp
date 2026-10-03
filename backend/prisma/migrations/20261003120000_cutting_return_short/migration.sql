-- Cutting: fabric expected back at Complete Batch (issued − used in lays) that did not come back, and why
-- (owner, 2026-10-03). Nullable: old batches have no reason recorded.
CREATE TYPE "CuttingReturnShortReason" AS ENUM ('END_BITS', 'DAMAGED', 'SHORT_IN_ROLL', 'NOT_TRACED', 'OTHER');

ALTER TABLE "cutting_batch_fabrics"
  ADD COLUMN "returnShortQty" DECIMAL(10,2),
  ADD COLUMN "returnShortReason" "CuttingReturnShortReason",
  ADD COLUMN "returnShortNote" TEXT;
