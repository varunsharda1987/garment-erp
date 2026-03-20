-- AlterTable: Make colorId nullable on stitching_issue_skus and finishing_issue_skus
ALTER TABLE "stitching_issue_skus" ALTER COLUMN "colorId" DROP NOT NULL;
ALTER TABLE "finishing_issue_skus" ALTER COLUMN "colorId" DROP NOT NULL;
