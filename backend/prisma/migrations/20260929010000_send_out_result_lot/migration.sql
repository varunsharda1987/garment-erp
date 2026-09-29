-- A send-out's processed fabric comes back as ITS OWN lot (owner, 2026-09-29: smocked fabric is not the plain
-- fabric). external_process_send_outs.resultFabricStockId = the lot it came back as (one per send-out).

-- AlterTable
ALTER TABLE "external_process_send_outs" ADD COLUMN     "resultFabricStockId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "external_process_send_outs_resultFabricStockId_key" ON "external_process_send_outs"("resultFabricStockId");

-- AddForeignKey
ALTER TABLE "external_process_send_outs" ADD CONSTRAINT "external_process_send_outs_resultFabricStockId_fkey" FOREIGN KEY ("resultFabricStockId") REFERENCES "fabric_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

