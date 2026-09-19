-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


-- BEFORE 'FIT_SAMPLE' rather than a bare ADD VALUE, which appends to the end of the enum.
-- Two reasons: schema.prisma declares these two FIRST, so this keeps the database's order matching
-- the schema; and they are genuinely the earliest samples in the pipeline (ORIGINAL 28 days and
-- LOOK 25 days before ship, vs FIT's later slot — see SAMPLE_LEAD_DAYS in sample.service.ts).
-- customer.service.ts:1044 lists a customer's sample requirements with `orderBy: { sampleType:
-- 'asc' }`, which sorts by the enum's physical order, so appending would have shown the two
-- earliest samples at the bottom of that list.
ALTER TYPE "SampleType" ADD VALUE 'ORIGINAL_SAMPLE' BEFORE 'FIT_SAMPLE';
ALTER TYPE "SampleType" ADD VALUE 'LOOK_SAMPLE' BEFORE 'FIT_SAMPLE';
