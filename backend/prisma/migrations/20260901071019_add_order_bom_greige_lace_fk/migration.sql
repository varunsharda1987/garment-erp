-- AlterTable
ALTER TABLE "order_bom_items" ADD COLUMN     "greigeLaceId" TEXT;

-- CreateIndex
CREATE INDEX "order_bom_items_greigeLaceId_idx" ON "order_bom_items"("greigeLaceId");

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_greigeLaceId_fkey" FOREIGN KEY ("greigeLaceId") REFERENCES "lace_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;
