-- CreateEnum
CREATE TYPE "StockProductionOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "delivery_note_items" DROP CONSTRAINT "delivery_note_items_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_orderId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_orderId_fkey";

-- DropForeignKey
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_orderId_fkey";

-- DropForeignKey
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_orderItemId_fkey";

-- AlterTable
ALTER TABLE "delivery_note_items" ADD COLUMN     "saleOrderItemId" TEXT,
ALTER COLUMN "orderItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "delivery_notes" ADD COLUMN     "saleOrderId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "saleOrderId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "stockProductionOrderId" TEXT,
ADD COLUMN     "stockProductionOrderItemId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "orderItemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "stock_production_orders" (
    "id" TEXT NOT NULL,
    "spoNumber" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "StockProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stock_production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_production_order_items" (
    "id" TEXT NOT NULL,
    "stockProductionOrderId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_orders" (
    "id" TEXT NOT NULL,
    "saleOrderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedShipDate" TIMESTAMP(3),
    "status" "SaleOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sale_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_order_items" (
    "id" TEXT NOT NULL,
    "saleOrderId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "colorId" TEXT,
    "sizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allocatedQty" INTEGER NOT NULL DEFAULT 0,
    "dispatchedQty" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "sale_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fg_stock_allocations" (
    "id" TEXT NOT NULL,
    "saleOrderItemId" TEXT NOT NULL,
    "fgStockId" TEXT NOT NULL,
    "allocatedQty" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedById" TEXT NOT NULL,

    CONSTRAINT "fg_stock_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_production_orders_spoNumber_key" ON "stock_production_orders"("spoNumber");

-- CreateIndex
CREATE INDEX "stock_production_orders_styleId_idx" ON "stock_production_orders"("styleId");

-- CreateIndex
CREATE INDEX "stock_production_orders_status_idx" ON "stock_production_orders"("status");

-- CreateIndex
CREATE INDEX "stock_production_orders_spoNumber_idx" ON "stock_production_orders"("spoNumber");

-- CreateIndex
CREATE INDEX "stock_production_order_items_stockProductionOrderId_idx" ON "stock_production_order_items"("stockProductionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_production_order_items_stockProductionOrderId_colorId_key" ON "stock_production_order_items"("stockProductionOrderId", "colorId", "sizeId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_orders_saleOrderNumber_key" ON "sale_orders"("saleOrderNumber");

-- CreateIndex
CREATE INDEX "sale_orders_customerId_idx" ON "sale_orders"("customerId");

-- CreateIndex
CREATE INDEX "sale_orders_status_idx" ON "sale_orders"("status");

-- CreateIndex
CREATE INDEX "sale_orders_saleOrderNumber_idx" ON "sale_orders"("saleOrderNumber");

-- CreateIndex
CREATE INDEX "sale_order_items_saleOrderId_idx" ON "sale_order_items"("saleOrderId");

-- CreateIndex
CREATE INDEX "sale_order_items_styleId_idx" ON "sale_order_items"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_order_items_saleOrderId_styleId_colorId_sizeId_key" ON "sale_order_items"("saleOrderId", "styleId", "colorId", "sizeId");

-- CreateIndex
CREATE INDEX "fg_stock_allocations_saleOrderItemId_idx" ON "fg_stock_allocations"("saleOrderItemId");

-- CreateIndex
CREATE INDEX "fg_stock_allocations_fgStockId_idx" ON "fg_stock_allocations"("fgStockId");

-- CreateIndex
CREATE INDEX "delivery_note_items_saleOrderItemId_idx" ON "delivery_note_items"("saleOrderItemId");

-- CreateIndex
CREATE INDEX "delivery_notes_saleOrderId_idx" ON "delivery_notes"("saleOrderId");

-- CreateIndex
CREATE INDEX "invoices_saleOrderId_idx" ON "invoices"("saleOrderId");

-- CreateIndex
CREATE INDEX "work_orders_stockProductionOrderId_idx" ON "work_orders"("stockProductionOrderId");

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_saleOrderItemId_fkey" FOREIGN KEY ("saleOrderItemId") REFERENCES "sale_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_stockProductionOrderId_fkey" FOREIGN KEY ("stockProductionOrderId") REFERENCES "stock_production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_stockProductionOrderItemId_fkey" FOREIGN KEY ("stockProductionOrderItemId") REFERENCES "stock_production_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_orders" ADD CONSTRAINT "stock_production_orders_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_orders" ADD CONSTRAINT "stock_production_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_orders" ADD CONSTRAINT "stock_production_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_order_items" ADD CONSTRAINT "stock_production_order_items_stockProductionOrderId_fkey" FOREIGN KEY ("stockProductionOrderId") REFERENCES "stock_production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_order_items" ADD CONSTRAINT "stock_production_order_items_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_production_order_items" ADD CONSTRAINT "stock_production_order_items_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_order_items" ADD CONSTRAINT "sale_order_items_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fg_stock_allocations" ADD CONSTRAINT "fg_stock_allocations_saleOrderItemId_fkey" FOREIGN KEY ("saleOrderItemId") REFERENCES "sale_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fg_stock_allocations" ADD CONSTRAINT "fg_stock_allocations_fgStockId_fkey" FOREIGN KEY ("fgStockId") REFERENCES "finished_goods_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fg_stock_allocations" ADD CONSTRAINT "fg_stock_allocations_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
