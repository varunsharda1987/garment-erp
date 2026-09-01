---
slug: purchase-order-create
title: Raise a Purchase Order (PO)
keywords:
  - purchase order
  - PO
  - po banaye
  - order to supplier
  - supplier ko order
  - raise po
  - खरीद आदेश
  - पर्चेस ऑर्डर
  - सप्लायर
  - माल मंगाना
  - purchse order
  - create po
  - draft po
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/pages/PurchaseOrderForm.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/types/purchaseOrder.types.ts
  - backend/src/schemas/purchaseOrder.schema.ts
---

## Before you start
The supplier must already exist in **Materials & Masters → Suppliers**, and every material you order must exist as a master. A PO can only be raised for MATERIALS. Processing, dyeing, printing and other outside service work is NOT a PO any more — use a Job Work Order instead.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Click **Create PO**. The page title reads **Create Purchase Order**.
3. Optional but recommended: in the **Link to Style** card, pick a style, and link an order if this PO is for a specific order. Linking a style shows the **Materials Required** card so you can pull quantities from the style.
4. In the **PO Details** card, choose **PO Category ***. Options are material categories only: Fabric, Greige, Trims, Lace, Greige Lace, General. The category cannot be changed later while editing. If you add a material from the **Materials Required** card (for example with its **GREIGE PO** button), the category fills in on its own and shows a **Set by material** lock — click **Clear Style** to change it.
5. Choose **Supplier ***. The supplier list is filtered by the category, so select the category first — the box stays disabled until you do.
6. Optionally set **Delivery Location (Optional)** — the warehouse the goods should reach.
7. Set **Expected Delivery Date *** (required).
8. In the **Order Items** card, use **Quick Add Material** to search and add a material, or click **Browse All Materials**. For a Greige PO with no style linked, use **Add Greige Fabric**.
9. For each row fill **Quantity**, **Unit Price** and, for Greige/Fabric, **Fold L (cm)** if known. **GST %** defaults on each row; **Amount**, **Tax** and **Total** calculate automatically. Use the bin icon to remove a row.
10. Add anything else in **Notes**.
11. Click **Preview** to check the document, then **Save as Draft**, or **Save & Send** to save and send it to the supplier in one go.

## Validation traps
- **PO Category**, **Supplier**, **Expected Delivery Date** and at least one item are all required — saving without any of them shows a Validation Error.
- Every item needs a material selected, a quantity greater than zero and a unit price greater than zero. Zero or blank price is rejected.
- If any material is already on another open PO, a duplicate warning appears. Read it, then either cancel or confirm to continue.

## After saving
- Editing a Draft PO keeps everything you already entered on each line, including **Fold L (cm)**, and shows the **Delivery Location** it was saved with. Changing it there records a proper amendment (the original location is kept for tracking), so change it before sending — the supplier's PDF prints the delivery address. It cannot be cleared once set; pick a different warehouse instead. Removing a line from the PO puts that material back on the material plan so it can be ordered again on another PO.
- A Draft PO can be edited. From the PO page use **Send to Supplier**, then the supplier side can be marked with **Acknowledge**.
- Goods can only be received once the PO is Sent, Acknowledged or Partially Received. From the PO page click **Receive Goods** to start the GRN.
- If the supplier delivers part of the order and tells you the rest is not coming, do NOT cancel it — use **Close Short** on the PO page. Cancel is no longer offered on a Partially Received PO because it would claim the delivery never happened.
