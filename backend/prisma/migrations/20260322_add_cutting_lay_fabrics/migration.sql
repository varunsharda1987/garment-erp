-- CreateTable: Per-fabric layer lengths within a cutting lay
CREATE TABLE "cutting_lay_fabrics" (
    "id" TEXT NOT NULL,
    "cuttingLayId" TEXT NOT NULL,
    "cuttingBatchFabricId" TEXT NOT NULL,
    "layerLength" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "cutting_lay_fabrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cutting_lay_fabrics_cuttingLayId_cuttingBatchFabricId_key" ON "cutting_lay_fabrics"("cuttingLayId", "cuttingBatchFabricId");

-- AddForeignKey
ALTER TABLE "cutting_lay_fabrics" ADD CONSTRAINT "cutting_lay_fabrics_cuttingLayId_fkey" FOREIGN KEY ("cuttingLayId") REFERENCES "cutting_lays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_lay_fabrics" ADD CONSTRAINT "cutting_lay_fabrics_cuttingBatchFabricId_fkey" FOREIGN KEY ("cuttingBatchFabricId") REFERENCES "cutting_batch_fabrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
