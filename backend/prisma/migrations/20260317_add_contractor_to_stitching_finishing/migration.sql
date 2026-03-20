-- Add contractorId to stitching_issues and finishing_issues (references suppliers)
-- Make managerId nullable (was required, now optional since contractor replaces it)

ALTER TABLE "stitching_issues" ADD COLUMN "contractorId" TEXT;
ALTER TABLE "stitching_issues" ALTER COLUMN "managerId" DROP NOT NULL;
ALTER TABLE "stitching_issues" ADD CONSTRAINT "stitching_issues_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finishing_issues" ADD COLUMN "contractorId" TEXT;
ALTER TABLE "finishing_issues" ALTER COLUMN "managerId" DROP NOT NULL;
ALTER TABLE "finishing_issues" ADD CONSTRAINT "finishing_issues_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
