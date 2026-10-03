-- The stitching rate on a stitching issue (2026-10-03).
--
-- An issue to a stitching contractor recorded no price: what was paid was assumed to be the cost sheet's stitching
-- cost, which is often not what the contractor actually agreed. Each new issue now carries what the operators get per
-- piece (typed at issue), the contractor commission % of that day (setting STITCHING_CONTRACTOR_COMMISSION_PERCENT,
-- frozen here), and the cost sheet's stitching cost per piece of that day (it includes the commission) with the cost
-- sheet it came from. What the contractor is owed = good pieces × rate × (1 + commission %) — computed, never stored
-- (helpers/stitching-rate.helper.ts).
--
-- All nullable: the issues made before today have no rate. Only adds.

ALTER TABLE "stitching_issues"
  ADD COLUMN "operatorRatePerPiece" DECIMAL(10,2),
  ADD COLUMN "commissionPercent" DECIMAL(5,2),
  ADD COLUMN "costingRatePerPiece" DECIMAL(10,2),
  ADD COLUMN "costingSheetId" TEXT;

ALTER TABLE "stitching_issues"
  ADD CONSTRAINT "stitching_issues_costingSheetId_fkey"
  FOREIGN KEY ("costingSheetId") REFERENCES "style_costing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stitching_issues"
  ADD CONSTRAINT "stitching_issues_operatorRatePerPiece_check" CHECK ("operatorRatePerPiece" IS NULL OR "operatorRatePerPiece" > 0),
  ADD CONSTRAINT "stitching_issues_commissionPercent_check" CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));
