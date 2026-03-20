-- CreateTable
CREATE TABLE "cutting_lays" (
    "id" TEXT NOT NULL,
    "cuttingBatchId" TEXT NOT NULL,
    "layDate" TIMESTAMP(3) NOT NULL,
    "layNumber" INTEGER NOT NULL,
    "layerLength" DECIMAL(10,2) NOT NULL,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_lays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_lay_skus" (
    "id" TEXT NOT NULL,
    "cuttingLayId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "sizeId" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL,

    CONSTRAINT "cutting_lay_skus_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add issuedToId to transfer_slips
ALTER TABLE "transfer_slips" ADD COLUMN "issuedToId" TEXT;

-- CreateIndex
CREATE INDEX "cutting_lays_cuttingBatchId_idx" ON "cutting_lays"("cuttingBatchId");
CREATE INDEX "cutting_lays_layDate_idx" ON "cutting_lays"("layDate");

CREATE INDEX "cutting_lay_skus_cuttingLayId_idx" ON "cutting_lay_skus"("cuttingLayId");
CREATE UNIQUE INDEX "cutting_lay_skus_cuttingLayId_colorId_sizeId_key" ON "cutting_lay_skus"("cuttingLayId", "colorId", "sizeId");

-- AddForeignKey
ALTER TABLE "cutting_lays" ADD CONSTRAINT "cutting_lays_cuttingBatchId_fkey" FOREIGN KEY ("cuttingBatchId") REFERENCES "cutting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_lays" ADD CONSTRAINT "cutting_lays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_cuttingLayId_fkey" FOREIGN KEY ("cuttingLayId") REFERENCES "cutting_lays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cutting_lay_skus" ADD CONSTRAINT "cutting_lay_skus_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transfer_slips" ADD CONSTRAINT "transfer_slips_issuedToId_fkey" FOREIGN KEY ("issuedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
