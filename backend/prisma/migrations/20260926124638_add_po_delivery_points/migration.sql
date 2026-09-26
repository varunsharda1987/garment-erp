-- AlterTable
ALTER TABLE "goods_receiving_notes" ADD COLUMN     "poDeliveryPointId" TEXT;

-- CreateTable
CREATE TABLE "po_delivery_points" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_delivery_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_delivery_point_lines" (
    "id" TEXT NOT NULL,
    "deliveryPointId" TEXT NOT NULL,
    "poItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "po_delivery_point_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_delivery_plan_revisions" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT,
    "poStatus" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_delivery_plan_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "po_delivery_points_warehouseId_idx" ON "po_delivery_points"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "po_delivery_points_poId_warehouseId_key" ON "po_delivery_points"("poId", "warehouseId");

-- CreateIndex
CREATE INDEX "po_delivery_point_lines_poItemId_idx" ON "po_delivery_point_lines"("poItemId");

-- CreateIndex
CREATE UNIQUE INDEX "po_delivery_point_lines_deliveryPointId_poItemId_key" ON "po_delivery_point_lines"("deliveryPointId", "poItemId");

-- CreateIndex
CREATE INDEX "po_delivery_plan_revisions_poId_idx" ON "po_delivery_plan_revisions"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "po_delivery_plan_revisions_poId_revisionNumber_key" ON "po_delivery_plan_revisions"("poId", "revisionNumber");

-- CreateIndex
CREATE INDEX "goods_receiving_notes_poDeliveryPointId_idx" ON "goods_receiving_notes"("poDeliveryPointId");

-- AddForeignKey
ALTER TABLE "goods_receiving_notes" ADD CONSTRAINT "goods_receiving_notes_poDeliveryPointId_fkey" FOREIGN KEY ("poDeliveryPointId") REFERENCES "po_delivery_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_points" ADD CONSTRAINT "po_delivery_points_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_points" ADD CONSTRAINT "po_delivery_points_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_point_lines" ADD CONSTRAINT "po_delivery_point_lines_deliveryPointId_fkey" FOREIGN KEY ("deliveryPointId") REFERENCES "po_delivery_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_point_lines" ADD CONSTRAINT "po_delivery_point_lines_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_plan_revisions" ADD CONSTRAINT "po_delivery_plan_revisions_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_delivery_plan_revisions" ADD CONSTRAINT "po_delivery_plan_revisions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A delivery point line always carries a quantity (Prisma cannot express CHECK constraints)
ALTER TABLE "po_delivery_point_lines" ADD CONSTRAINT "po_delivery_point_lines_quantity_positive" CHECK ("quantity" > 0);
