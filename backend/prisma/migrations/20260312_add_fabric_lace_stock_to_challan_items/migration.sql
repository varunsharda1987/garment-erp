-- Add fabricStockId and laceStockId to challan_items for stock integration
ALTER TABLE "challan_items" ADD COLUMN IF NOT EXISTS "fabricStockId" VARCHAR(255);
ALTER TABLE "challan_items" ADD COLUMN IF NOT EXISTS "laceStockId" VARCHAR(255);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "challan_items_fabricStockId_idx" ON "challan_items"("fabricStockId");
CREATE INDEX IF NOT EXISTS "challan_items_laceStockId_idx" ON "challan_items"("laceStockId");
