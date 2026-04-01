-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "supplierId" VARCHAR(50);

-- CreateIndex
CREATE INDEX "warehouses_supplierId_idx" ON "warehouses"("supplierId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
