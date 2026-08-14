-- AlterTable
ALTER TABLE "fabric_width_cad" ADD COLUMN     "rateCardId" TEXT;

-- CreateIndex
CREATE INDEX "fabric_width_cad_rateCardId_idx" ON "fabric_width_cad"("rateCardId");

-- AddForeignKey
ALTER TABLE "fabric_width_cad" ADD CONSTRAINT "fabric_width_cad_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "processor_rate_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
