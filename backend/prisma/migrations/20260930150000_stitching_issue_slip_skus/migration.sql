-- What each stitching issue took from each cutting → stitching transfer slip (2026-09-30).
-- Until now an issue marked every slip it drew from RECEIVED, however few pieces it took, so the
-- rest of the slip vanished: SI-WO2609-0088-001 took size S (459) from TS-20260930-0001 and the other
-- 1,680 pcs showed nowhere. A slip now stays open while any piece is not yet issued and turns RECEIVED
-- only when these rows cover it (backend/src/services/helpers/stitching-slip-balance.helper.ts).

-- CreateTable
CREATE TABLE "stitching_issue_slip_skus" (
    "id" TEXT NOT NULL,
    "stitchingIssueId" TEXT NOT NULL,
    "transferSlipId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stitching_issue_slip_skus_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stitching_issue_slip_skus_quantity_positive" CHECK ("quantity" > 0)
);

-- A blank colour is ONE value (colour is optional, sku-colour.helper.ts): NULLS NOT DISTINCT, so two
-- blank-colour rows for one issue × slip × size collide. Prisma cannot express it; the schema keeps a
-- plain @@unique of the same name. Never drop/recreate it through Prisma.
CREATE UNIQUE INDEX "stitching_issue_slip_skus_stitchingIssueId_transferSlipId_colorId_sizeId_key" ON "stitching_issue_slip_skus"("stitchingIssueId", "transferSlipId", "colorId", "sizeId") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "stitching_issue_slip_skus_transferSlipId_idx" ON "stitching_issue_slip_skus"("transferSlipId");

-- AddForeignKey
ALTER TABLE "stitching_issue_slip_skus" ADD CONSTRAINT "stitching_issue_slip_skus_stitchingIssueId_fkey" FOREIGN KEY ("stitchingIssueId") REFERENCES "stitching_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stitching_issue_slip_skus" ADD CONSTRAINT "stitching_issue_slip_skus_transferSlipId_fkey" FOREIGN KEY ("transferSlipId") REFERENCES "transfer_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
