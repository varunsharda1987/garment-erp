-- Garment tests on a sample's lab round (2026-09-23).
--
-- The owner's process: the garment physical test (GPT) is done on the PP sample BEFORE it is sent to
-- the buyer — when no work order exists yet. So a GPT may now hang off a lab round (trfId, added in
-- 20260923114908_link_sample_lab_rounds) instead of a work order. The fabric physical test (FPT) is
-- done on the fabric lot after inward and is unaffected.
--
-- 0 rows in garment_physical_tests, so the column change and the CHECK are free. The FK stays
-- ON DELETE RESTRICT (the schema says onDelete: Restrict explicitly — an optional relation would
-- otherwise default to SET NULL and a work-order delete would trip the CHECK below instead of being
-- refused).

-- AlterTable
ALTER TABLE "garment_physical_tests" ALTER COLUMN "workOrderId" DROP NOT NULL;

-- A garment test must belong to a production run OR a lab round — never to nothing. Mirrored by the
-- Zod refine on createGarmentPhysicalTestSchema, which exists so the API answers a readable 400
-- instead of Postgres raising a 23514 that surfaces as a 500. Prisma cannot express a CHECK; do not
-- drop it.
ALTER TABLE "garment_physical_tests"
  ADD CONSTRAINT "gpt_anchor_work_order_or_trf"
  CHECK ("workOrderId" IS NOT NULL OR "trfId" IS NOT NULL);
