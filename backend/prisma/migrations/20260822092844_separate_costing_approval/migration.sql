-- AlterTable
ALTER TABLE "fabric_width_cad" ADD COLUMN     "costing_approval_status" "CadApprovalStatus",
ADD COLUMN     "costing_approved_at" TIMESTAMP(3),
ADD COLUMN     "costing_approved_by" TEXT;

-- CreateIndex
CREATE INDEX "fabric_width_cad_costing_approval_status_idx" ON "fabric_width_cad"("costing_approval_status");

-- ============================================================================
-- Two-owner approval split (2026-08-22)
-- approval_status/approved_by/approved_at remain CAD-GEOMETRY approval only.
-- costing_approval_status/_by/_at carry the Fabric Costing PRICE approval.
-- ============================================================================

-- Pre-flight: the partial unique index below requires at most ONE would-be-approved
-- costing per option tuple. The old 6-column unique (…, approval_status) guarantees
-- this for fully-non-null tuples, but fail fast with a readable error on ANY database
-- this migration ever runs on rather than aborting mid-CREATE INDEX.
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT 1
    FROM "fabric_width_cad"
    WHERE "approval_status" = 'APPROVED' AND "totalCostPerMeter" IS NOT NULL
    GROUP BY "costingStyleId", "componentName", "style_fabric_id", "cutableWidth", "purpose"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'separate_costing_approval pre-flight: % option tuple(s) have more than one APPROVED costed row — resolve duplicates before migrating', dup_count;
  END IF;
END $$;

-- Backfill: costing approvals were historically written into the shared approval_status
-- by approveCostingOption. A row was a costing approval iff it also carried a price.
-- approval_status is deliberately NOT modified: zero CAD-side behavior change. Rows with
-- {approval_status APPROVED, cost NULL} keep their CAD approval and get NULL costing
-- approval — the legitimate "CAD-approved, not yet costed" state.
UPDATE "fabric_width_cad"
SET "costing_approval_status" = "approval_status",
    "costing_approved_by"     = "approved_by",
    "costing_approved_at"     = "approved_at"
WHERE "totalCostPerMeter" IS NOT NULL
  AND "approval_status" IN ('APPROVED', 'ALTERNATE_APPROVED');

-- One APPROVED costing option per option tuple. Prisma cannot express partial indexes
-- (precedent: 20260822_harden_code_uniqueness / styles_styleCode_active_key). NULLs are
-- distinct, matching the scope of the old approval_status slot constraint, which is KEPT
-- for the CAD side.
CREATE UNIQUE INDEX "fabric_width_cad_costing_approved_key"
  ON "fabric_width_cad"("costingStyleId", "componentName", "style_fabric_id", "cutableWidth", "purpose")
  WHERE "costing_approval_status" = 'APPROVED';
