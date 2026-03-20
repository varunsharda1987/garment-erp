-- Fix: drop default before casting, then re-add
ALTER TABLE "stitching_issues" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "stitching_issues" ALTER COLUMN "status" TYPE "StitchingIssueStatus" USING status::text::"StitchingIssueStatus";
ALTER TABLE "stitching_issues" ALTER COLUMN "status" SET DEFAULT 'PENDING_RECEIPT'::"StitchingIssueStatus";
DROP TYPE "StitchingIssueStatus_old";
