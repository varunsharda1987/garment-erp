/*
  Warnings:

  - You are about to drop the column `jobWorkOrderId` on the `debit_notes` table. All the data in the column will be lost.
  - Made the column `uom` on table `job_work_orders` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "job_work_orders" DROP CONSTRAINT "job_work_orders_fabricId_fkey";

-- DropForeignKey
ALTER TABLE "job_work_orders" DROP CONSTRAINT "job_work_orders_fabricStockLotId_fkey";

-- DropForeignKey
ALTER TABLE "job_work_orders" DROP CONSTRAINT "job_work_orders_styleId_fkey";

-- DropIndex
DROP INDEX "debit_notes_jobWorkOrderId_idx";

-- AlterTable
ALTER TABLE "debit_notes" DROP COLUMN "jobWorkOrderId";

-- AlterTable
ALTER TABLE "job_work_orders" ALTER COLUMN "uom" SET NOT NULL;

-- CreateTable
CREATE TABLE "tally_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "tallyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tallyHost" TEXT NOT NULL DEFAULT '127.0.0.1',
    "tallyPort" INTEGER NOT NULL DEFAULT 9000,
    "tallyCompanyName" TEXT,
    "tallyPartyGroup" TEXT NOT NULL DEFAULT 'Sundry Debtors',
    "tallyVoucherType" TEXT NOT NULL DEFAULT 'Sales',
    "tallySalesLedgerIntra" TEXT NOT NULL DEFAULT '',
    "tallySalesLedgerInter" TEXT NOT NULL DEFAULT '',
    "tallyCgstLedger" TEXT NOT NULL DEFAULT '',
    "tallySgstLedger" TEXT NOT NULL DEFAULT '',
    "tallyIgstLedger" TEXT NOT NULL DEFAULT '',
    "tallyCgstLedger18" TEXT NOT NULL DEFAULT '',
    "tallySgstLedger18" TEXT NOT NULL DEFAULT '',
    "tallyIgstLedger18" TEXT NOT NULL DEFAULT '',
    "tallyRoundOffLedger" TEXT NOT NULL DEFAULT '',
    "tallyFreightLedger" TEXT NOT NULL DEFAULT '',
    "tallyGodownName" TEXT NOT NULL DEFAULT 'Main Location',
    "tallyStockUnit" TEXT NOT NULL DEFAULT 'Pcs',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tally_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "fabric_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_fabricStockLotId_fkey" FOREIGN KEY ("fabricStockLotId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
