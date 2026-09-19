-- AlterTable
ALTER TABLE "sale_order_buyer_pos" ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "documentName" VARCHAR(255),
ADD COLUMN     "documentSize" INTEGER,
ADD COLUMN     "documentUploadedAt" TIMESTAMP(3),
ADD COLUMN     "documentUploadedById" TEXT,
ADD COLUMN     "documentUrl" VARCHAR(500),
ADD COLUMN     "poDate" DATE;

-- CreateIndex
CREATE INDEX "sale_order_buyer_pos_deliveryAddressId_idx" ON "sale_order_buyer_pos"("deliveryAddressId");

-- AddForeignKey
ALTER TABLE "sale_order_buyer_pos" ADD CONSTRAINT "sale_order_buyer_pos_documentUploadedById_fkey" FOREIGN KEY ("documentUploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_order_buyer_pos" ADD CONSTRAINT "sale_order_buyer_pos_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "customer_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
