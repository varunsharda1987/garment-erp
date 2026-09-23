-- Link the Sample Tracker to lab testing (2026-09-23).
--
-- One TRF (buyer_test_requirement_forms) per lab round; a sample has many rounds (the original and
-- each retest). Each round yields at most one fabric result (FPT) and at most one garment result (GPT):
-- trfId is UNIQUE on both test tables, which is what makes "a second test needs a second TRF" a rule
-- rather than a habit. Tests reach their sample only THROUGH the TRF — there is deliberately no
-- sampleId on the test tables.
--
-- sampleId is context, not an anchor: buyer_trf_anchor_xor (work order XOR sale order) is unchanged.
--
-- FK rules: a lab result must never be orphaned, so trfId is RESTRICT. TRFs are soft-deleted, and a
-- sample is hard-deleted — so sampleId is SET NULL (a soft-deleted TRF must not block deleting its
-- sample); deleteSample refuses while ACTIVE rounds reference it.
--
-- All columns nullable; 0 existing FPT/GPT rows, 1 TRF. Additive only — an older Prisma client keeps
-- working against this schema.

-- AlterTable
ALTER TABLE "buyer_test_requirement_forms" ADD COLUMN     "sampleId" TEXT;

-- AlterTable
ALTER TABLE "fabric_physical_tests" ADD COLUMN     "trfId" TEXT;

-- AlterTable
ALTER TABLE "garment_physical_tests" ADD COLUMN     "trfId" TEXT;

-- CreateIndex
CREATE INDEX "buyer_test_requirement_forms_sampleId_idx" ON "buyer_test_requirement_forms"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "fabric_physical_tests_trfId_key" ON "fabric_physical_tests"("trfId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_physical_tests_trfId_key" ON "garment_physical_tests"("trfId");

-- AddForeignKey
ALTER TABLE "fabric_physical_tests" ADD CONSTRAINT "fabric_physical_tests_trfId_fkey" FOREIGN KEY ("trfId") REFERENCES "buyer_test_requirement_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_physical_tests" ADD CONSTRAINT "garment_physical_tests_trfId_fkey" FOREIGN KEY ("trfId") REFERENCES "buyer_test_requirement_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_test_requirement_forms" ADD CONSTRAINT "buyer_test_requirement_forms_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
