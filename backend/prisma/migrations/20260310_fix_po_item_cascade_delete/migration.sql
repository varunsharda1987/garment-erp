-- Fix FK constraints: Add CASCADE DELETE to requirement_po_links and grn_items
-- so PO items can be deleted/recreated during PO update

-- requirement_po_links.purchaseOrderItemId -> purchase_order_items.id
ALTER TABLE "requirement_po_links" DROP CONSTRAINT "requirement_po_links_purchaseOrderItemId_fkey";
ALTER TABLE "requirement_po_links" ADD CONSTRAINT "requirement_po_links_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- grn_items.poItemId -> purchase_order_items.id
ALTER TABLE "grn_items" DROP CONSTRAINT "grn_items_poItemId_fkey";
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "purchase_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
