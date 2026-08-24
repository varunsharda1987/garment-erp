-- AlterTable
ALTER TABLE "fabric_width_cad" ADD COLUMN     "costed_at_quantity_meters" DECIMAL(12,2),
ADD COLUMN     "costed_rate_is_batch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "job_work_orders" ADD COLUMN     "costedRatePerMeter" DECIMAL(10,2),
ADD COLUMN     "rateBasisQuantity" DECIMAL(12,2),
ADD COLUMN     "rateCardId" TEXT,
ADD COLUMN     "rateSource" TEXT,
ADD COLUMN     "rateVarianceReason" TEXT,
ADD COLUMN     "slabId" TEXT;

-- AddForeignKey
ALTER TABLE "job_work_orders" ADD CONSTRAINT "job_work_orders_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
