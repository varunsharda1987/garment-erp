-- Move any existing ISSUED_TO_MANAGER records to RECEIVED
UPDATE "stitching_issues" SET status = 'RECEIVED' WHERE status = 'ISSUED_TO_MANAGER';

-- Remove the ISSUED_TO_MANAGER enum value
ALTER TYPE "StitchingIssueStatus" RENAME TO "StitchingIssueStatus_old";
CREATE TYPE "StitchingIssueStatus" AS ENUM ('PENDING_RECEIPT', 'RECEIVED', 'IN_PROGRESS', 'COMPLETED');
ALTER TABLE "stitching_issues" ALTER COLUMN "status" TYPE "StitchingIssueStatus" USING status::text::"StitchingIssueStatus";
DROP TYPE "StitchingIssueStatus_old";
