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
  - to be advised
  - weaver
  - bunkar
  - mill
  - बुनकर
  - deliver to
  - delivery location
  - baad mein batayenge
  - डिलीवरी कहाँ
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/pages/PurchaseOrderForm.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/types/purchaseOrder.types.ts
  - backend/src/schemas/purchaseOrder.schema.ts
  - backend/src/services/document-data/po-deliver-to.ts
  - frontend/src/components/WeaverCombobox.tsx
route: /procurement/purchase-orders/new
---

## Before you start
The supplier must already exist in **Materials & Masters → Suppliers**, and every material you order must exist as a master. A PO can only be raised for MATERIALS. Processing, dyeing, printing and other outside service work is NOT a PO any more — use a Job Work Order instead.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Click **Create PO**. The page title reads **Create Purchase Order**.
3. Optional but recommended: in the **Link to Style** card, pick a style, and link an order if this PO is for a specific order. Linking a style shows the **Materials Required** card so you can pull quantities from the style.
4. In the **PO Details** card, choose **PO Category ***. Options are material categories only: Fabric, Greige, Trims, Lace, Greige Lace, General. The category cannot be changed later while editing. If you add a material from the **Materials Required** card (for example with its **GREIGE PO** button), the category fills in on its own and shows a **Set by material** lock — click **Clear Style** to change it.
5. Choose **Supplier ***. The supplier list is filtered by the category, so select the category first — the box stays disabled until you do.
6. Set **Delivery Location** — the warehouse or processor's unit the goods should reach. If the place will be decided at dispatch, leave it empty (the box reads **Decide at dispatch (to be advised)**): the PO then prints "To be advised before dispatch", and you set the place later from the PO page. Choosing your own store prints your address from Company Profile.
7. Set **Expected Delivery Date *** (required).
8. In the **Order Items** card, use **Quick Add Material** to search and add a material, or click **Browse All Materials**. For a Greige PO with no style linked, use **Add Greige Fabric**.
9. For each row fill **Quantity**, **Unit Price** and, for Greige/Fabric, **Fold L (cm)** if known. The quantity is in actual metres; with a Fold L under 100 the row shows the same quantity as the mill will count it, e.g. "actual · = 10,011 m counted @ L=98". **GST %** defaults on each row; **Amount**, **Tax** and **Total** calculate automatically. Use the bin icon to remove a row.
   On Greige and Fabric POs each row also has a **Weaver** box — the mill this cloth is woven by. It is optional here (you may only know it at dispatch). Pick a weaver, or type a new name and click **Add "…" as a new weaver**; the same name in any spelling is kept as one weaver. Do NOT make a new greige just because the weaver changed — the weaver is recorded on the PO line and the stock lot, and all weavers stay under the same greige. When set, the PO prints "Weaver: …" under the line.
10. Add anything else in **Notes**.
11. Click **Preview** to check the document, then **Save as Draft**, or **Save & Send** to save and send it to the supplier in one go.

## Validation traps
- **PO Category**, **Supplier**, **Expected Delivery Date** and at least one item are all required — saving without any of them shows a Validation Error.
- Every item needs a material selected, a quantity greater than zero and a unit price greater than zero. Zero or blank price is rejected.
- If any material is already on another open PO, a duplicate warning appears. Read it, then either cancel or confirm to continue.

## After saving
- The PO appears in **Procurement → Purchase Orders**, each row showing its **Material** (the first line's material, with "+N more" when the PO has several lines) and **Category**. The search box finds it by PO number, supplier, style or material.
- Editing a Draft PO keeps everything you already entered on each line, including **Fold L (cm)**, and shows the **Delivery Location** it was saved with. Changing it there records a proper amendment (the original location is kept for tracking), so change it before sending — the supplier's PDF prints the delivery address. It cannot be cleared once set; pick a different warehouse instead.
- The PO page always shows a **Deliver To** card. On a PO left to be advised it reads **To be advised** with a **Set** button; otherwise it has **Change**. Set or change it until the PO is fully Received, Short Closed or Cancelled, then share the PO with the supplier again. Removing a line from the PO puts that material back on the material plan so it can be ordered again on another PO.
- A Draft PO can be edited. From the PO page use **Send to Supplier**, then the supplier side can be marked with **Acknowledge**.
- Goods can only be received once the PO is Sent, Acknowledged or Partially Received. From the PO page click **Receive Goods** to start the GRN.
- If the supplier delivers part of the order and tells you the rest is not coming, do NOT cancel it — use **Close Short** on the PO page. Cancel is no longer offered on a Partially Received PO because it would claim the delivery never happened.
