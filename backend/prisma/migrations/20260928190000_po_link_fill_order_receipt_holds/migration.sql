-- Allocate a sent PO to running orders (2026-09-28, plan docs/plans/po-allocation-design.md).
-- requirement_po_links.fillOrder: the link's earliest-delivery rank on its PO line — a receipt fills the line's
-- links in this order and is recomputed from the line total, so a GRN reversal is exact.
ALTER TABLE "requirement_po_links" ADD COLUMN "fillOrder" INTEGER;
CREATE INDEX "requirement_po_links_purchaseOrderItemId_fillOrder_idx" ON "requirement_po_links"("purchaseOrderItemId", "fillOrder");

-- stock_reservations.poLinkId: set = a receipt hold (goods that arrived on a linked line, held for that order);
-- null = a Use Stock hold. SET NULL keeps history on closed rows; code releases a link's holds before deleting it.
ALTER TABLE "stock_reservations" ADD COLUMN "poLinkId" TEXT;
CREATE INDEX "stock_reservations_poLinkId_idx" ON "stock_reservations"("poLinkId");
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_poLinkId_fkey" FOREIGN KEY ("poLinkId") REFERENCES "requirement_po_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
