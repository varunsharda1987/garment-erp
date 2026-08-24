-- Retire legacy JWO status column — jwoStatus is the single authority
-- DropIndex
DROP INDEX "job_work_orders_status_idx";

-- AlterTable
ALTER TABLE "job_work_orders" DROP COLUMN "status",
ALTER COLUMN "jwoStatus" SET NOT NULL,
ALTER COLUMN "jwoStatus" SET DEFAULT 'DRAFT';

-- DropEnum
DROP TYPE "JobWorkStatus";
