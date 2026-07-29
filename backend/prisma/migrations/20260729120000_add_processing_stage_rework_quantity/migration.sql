-- Record HOW MUCH is being sent for rework, not just why (owner decision, 2026-07-29).
-- markForReworkSchema already required reworkQuantity, but there was no column to store it: the
-- controller read only `reason` and the service wrote only reworkReason, so the quantity was lost.
-- Additive and nullable, so existing rows are unaffected.
ALTER TABLE "processing_stage" ADD COLUMN IF NOT EXISTS "reworkQuantity" DECIMAL(10,2);
