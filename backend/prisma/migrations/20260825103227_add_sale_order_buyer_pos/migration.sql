-- CreateTable
CREATE TABLE "sale_order_buyer_pos" (
    "id" TEXT NOT NULL,
    "saleOrderId" TEXT NOT NULL,
    "buyerPoNumber" VARCHAR(100) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_order_buyer_pos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_order_buyer_pos_saleOrderId_idx" ON "sale_order_buyer_pos"("saleOrderId");

-- CreateIndex
CREATE INDEX "sale_order_buyer_pos_buyerPoNumber_idx" ON "sale_order_buyer_pos"("buyerPoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sale_order_buyer_pos_saleOrderId_buyerPoNumber_key" ON "sale_order_buyer_pos"("saleOrderId", "buyerPoNumber");

-- AddForeignKey
ALTER TABLE "sale_order_buyer_pos" ADD CONSTRAINT "sale_order_buyer_pos_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
