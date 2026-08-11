-- AlterEnum
ALTER TYPE "ProcessType" ADD VALUE 'KAAJ_BUTTON';

-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "buttonCount" INTEGER,
ADD COLUMN     "buttonRatePerUnit" DECIMAL(10,2),
ADD COLUMN     "buttonholeCount" INTEGER,
ADD COLUMN     "buttonholeRatePerUnit" DECIMAL(10,2);
