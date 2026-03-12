-- Add HSN/GST fields to materials
ALTER TABLE "materials" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "materials" ADD COLUMN "gstRate" DECIMAL(5,2);

-- Add GST fields to purchase_order_items
ALTER TABLE "purchase_order_items" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN "gstRate" DECIMAL(5,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "cgstRate" DECIMAL(5,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "cgstAmount" DECIMAL(12,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "sgstRate" DECIMAL(5,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "sgstAmount" DECIMAL(12,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "igstRate" DECIMAL(5,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "igstAmount" DECIMAL(12,2);
ALTER TABLE "purchase_order_items" ADD COLUMN "taxAmount" DECIMAL(12,2);

-- Add GST summary fields to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "subtotal" DECIMAL(12,2);
ALTER TABLE "purchase_orders" ADD COLUMN "totalCgst" DECIMAL(12,2);
ALTER TABLE "purchase_orders" ADD COLUMN "totalSgst" DECIMAL(12,2);
ALTER TABLE "purchase_orders" ADD COLUMN "totalIgst" DECIMAL(12,2);
ALTER TABLE "purchase_orders" ADD COLUMN "totalTax" DECIMAL(12,2);
ALTER TABLE "purchase_orders" ADD COLUMN "isInterstate" BOOLEAN NOT NULL DEFAULT false;
