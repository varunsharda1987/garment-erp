/*
  Warnings:

  - A unique constraint covering the columns `[batchNumber]` on the table `cutting_batches` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[issueNumber]` on the table `stitching_issues` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cutting_batches_batchNumber_key" ON "cutting_batches"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stitching_issues_issueNumber_key" ON "stitching_issues"("issueNumber");

-- CreateIndex
CREATE INDEX "styles_buyer_style_ref_idx" ON "styles"("buyer_style_ref");

-- Partial unique index: no two ACTIVE styles may share a styleCode.
-- (Deleted/inactive styles keep their codes for history; import may deliberately
-- reuse a deleted style's code, so the constraint is scoped to isActive = true.
-- Prisma cannot express partial indexes, hence raw SQL here.)
CREATE UNIQUE INDEX "styles_styleCode_active_key" ON "styles"("styleCode") WHERE "isActive" = true;
