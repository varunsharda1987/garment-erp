---
slug: purchase-order-create
title: Raise a Purchase Order (PO)
keywords:
  - split delivery
  - two places delivery
  - aadha dyer aadha godown
  - स्प्लिट डिलीवरी
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
  - size wise label
  - label sizes
  - main cum size label
  - size label po
  - har size ki quantity
  - size wise quantity
  - साइज़
  - लेबल
  - साइज़ वाइज़
  - label set
  - order label set
  - all sizes together
  - saare size ek saath
  - poora label set
  - washcare label
  - traceability label
  - लेबल सेट
  - सारे साइज़ एक साथ
  - वॉशकेयर
  - thread po
  - dhaga order
  - cones
  - tubes
  - kitne cone
  - box
  - 2 ply cone
  - 3 ply tube
  - धागा ऑर्डर
  - कोन
  - ट्यूब
  - बॉक्स
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
  - frontend/src/components/purchase-orders/LabelSizeQtyDialog.tsx
  - backend/src/controllers/material.controller.ts
  - frontend/src/components/purchase-orders/DeliverySplitEditor.tsx
  - frontend/src/components/purchase-orders/LabelSetDialog.tsx
  - frontend/src/lib/label-materials.ts
  - frontend/src/lib/label-lines.ts
  - backend/src/services/label-set.service.ts
  - frontend/src/types/thread.types.ts
  - frontend/src/services/thread.service.ts
  - backend/src/services/helpers/purchase-unit.helper.ts
  - backend/src/services/helpers/thread-pack.helper.ts
route: /procurement/purchase-orders/new
---

## Before you start
The supplier must already exist in **Materials & Masters → Suppliers**, and every material you order must exist as a master. A PO can only be raised for MATERIALS. Processing, dyeing, printing and other outside service work is NOT a PO any more — use a Job Work Order instead.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Click **Create PO**. The page title reads **Create Purchase Order**.
3. Optional but recommended: in the **Link to Style** card, pick a style, and link an order if this PO is for a specific order. Linking a style shows the **Materials Required** card so you can pull quantities from the style. The style's labels sit in their own **Labels** section of that card (see step 8).
4. In the **PO Details** card, choose **PO Category ***. Options are material categories only: Fabric, Greige, Trims, Thread, Lace, Greige Lace, General. The category cannot be changed later while editing. If you add a material from the **Materials Required** card (for example with its **GREIGE PO** button), the category fills in on its own and shows a **Set by material** lock — click **Clear Style** to change it.
5. Choose **Supplier ***. The supplier list is filtered by the category, so select the category first — the box stays disabled until you do.
6. Set **Delivery Location** — the warehouse or processor's unit the goods should reach. If the place will be decided at dispatch, leave it empty (the box reads **Decide at dispatch (to be advised)**): the PO then prints "To be advised before dispatch", and you set the place later from the PO page. Choosing your own store prints your address from Company Profile. If part goes to one place and part to another (for example some greige straight to a dyer, the rest to Kashaya Fabs), switch on **Split delivery across locations**: a **Split delivery** card appears below the items. Pick each place and type how much of each item goes there; every item must be fully placed before you can save (**Put the balance into place 1** fills what is left). The PO prints every place under **Delivery Points**, and the supplier sends one invoice and one e-way bill per delivery.
7. Set **Expected Delivery Date *** (required).
8. In the **Order Items** card, use **Quick Add Material** to search and add a material, or click **Browse All Materials**. For a Greige PO with no style linked, use **Add Greige Fabric**.
   **A style's whole label set in one go** (main-cum-size, traceability, washcare, price tag…): link the style (and the order) in **Link to Style**, then in **Materials Required → Labels** click **Order label set…**. To order just one label, click **Sizes…** (or **Add** for a label without sizes) on that label's row. A box opens with one row per label and one column per size:
   - The top row, **Garments per size**, is filled from the linked order's size breakup. With no order linked, type the garments per size once — every label fills from it.
   - Each label's boxes = garments × labels per garment, plus the extra % from the BOM, rounded up. Change any box you like; a box you typed in keeps your number.
   - Untick a label to leave it out. A greyed-out label says why: "Not supplied by … (supplied by …)" — it is set up for another supplier on its Label page. A label with no supplier on its Label page yet is NOT greyed out: it reads "No supplier on its Label page yet — bought from …" and is bought from this PO's supplier. "—" means that label has no such size.
   - If no supplier is chosen yet, the box first asks you to pick one (it shows how many of the labels each supplier makes).
   - If the order already has open label requirements from MRP, a warning says a PO made here does not close them and links to **Requirements → By Order & Style** — order from there to keep MRP linked.
   - The footer counts labels · lines · pcs. Click **Put on the PO**: each size becomes its own PO line. Opening it again shows the PO's current quantities, and a size set to 0 is removed.
   Labels go on a **Trims** (or **General**) PO. An empty PO of another category switches to Trims for you; a PO that already has lines of another category is refused ("Labels go on a Trims PO — this PO already has other lines").
   **Labels that come in sizes** can also be added from **Quick Add Material** or **Browse All Materials**: they are listed ONCE, marked "· 7 sizes". Picking one opens a size box with one quantity per size and a **Total**; click **Add N lines** (or **Update lines** when it is already on the PO).
   On the PO, each label shows as **one heading row** (the label code, "N sizes", and the total quantity, amount, tax and total of its sizes) with one row per size beneath it, in size order. Click the heading to fold its sizes away. **Edit sizes** on the heading reopens the size box; **Remove label** removes every size line of that label. **Preview** shows the same grouping.
   Labels and packaging are listed for a supplier when that supplier is added on the label's own page (**Materials & Masters → Labels**, then **Edit**). A label or packaging item with **no supplier on its page yet** (for example a new Liva tag) is listed for every supplier on a Trims or General PO, so you choose who makes it here. Once a label has a supplier on its page, only that supplier's POs list it — add the other supplier on the Label page to buy it from them too.
   **Thread is ordered in cones or tubes and bought in boxes** — use a **Thread** PO. Picking a thread adds a line with two pickers under its name: **Cones** or **Tubes**, and the ply — **2-ply** or **3-ply** for cones; a tube is always 3-ply, so its ply is locked. In **Quantity** type how many cones (or tubes) you want: the line works out the boxes, rounded up to whole boxes of the size in the thread packaging table, and shows it, e.g. "= 3 boxes × 10 = 30 cones, Cone 3-ply" for 23 cones. Cones are priced per cone — type the rate in the **Per cone** box and the line shows the rate per box under it; tubes are priced per box — type the box rate. The PO line is saved in boxes. From a style's **Materials Required**, a thread shows **THREAD PO**: its BOM quantity counts garments, so choose the ply and type the cones or tubes yourself. Thread is not ordered from **Requirements** — order it here.
   **Buttons and snap buttons are ordered by the gross** (144 pieces). Picking one adds a line in **gross** at the button's price per gross, with "= 288 pcs" under the unit for 2 gross. A button line in pieces is refused ("bought by the gross — order it in Gross"). Pieces needed from a style's BOM are converted for you, rounded up to whole gross (2,300 pcs → 16 gross).
9. For each row fill **Quantity**, **Unit Price** and, for Greige/Fabric, **Fold L (cm)** if known. The quantity is in actual metres; with a Fold L under 100 the row shows the same quantity as the mill will count it, e.g. "actual · = 10,011 m counted @ L=98". **GST %** defaults on each row; **Amount**, **Tax** and **Total** calculate automatically. Use the bin icon to remove a row.
   On Greige and Fabric POs each row also has a **Weaver** box — the mill this cloth is woven by. It is optional here (you may only know it at dispatch). Pick a weaver, or type a new name and click **Add "…" as a new weaver**; the same name in any spelling is kept as one weaver. Do NOT make a new greige just because the weaver changed — the weaver is recorded on the PO line and the stock lot, and all weavers stay under the same greige. When set, the PO prints "Weaver: …" under the line.
10. Add anything else in **Notes**.
11. Click **Preview** to check the document, then **Save as Draft**, or **Save & Send** to save and send it to the supplier in one go.

## Validation traps
- **PO Category**, **Supplier**, **Expected Delivery Date** and at least one item are all required — saving without any of them shows a Validation Error.
- Every item needs a material selected, a quantity greater than zero and a unit price greater than zero. Zero or blank price is rejected.
- A thread line needs Cones or Tubes, the ply and a count: "Choose cone or tube, and the ply, for …" / "Enter how many cones for …". A thread line in any unit other than boxes is refused ("… is bought in boxes — enter the cones or tubes you want and the boxes follow").
- If any material is already on another open PO, a duplicate warning appears. Read it, then either cancel or confirm to continue.

## After saving
- The PO appears in **Procurement → Purchase Orders**, each row showing its **Material** (the first line's material, with "+N more" when the PO has several lines) and **Category**. The search box finds it by PO number, supplier, style or material.
- Editing a Draft PO keeps everything you already entered on each line, including **Fold L (cm)**, and shows the **Delivery Location** it was saved with. Changing it there records a proper amendment (the original location is kept for tracking), so change it before sending — the supplier's PDF prints the delivery address. It cannot be cleared once set; pick a different warehouse instead.
- The PO page always shows a **Deliver To** card. On a PO left to be advised it reads **To be advised** with a **Set** button; otherwise it has **Change**. Set or change it until the PO is fully Received, Short Closed or Cancelled, then share the PO with the supplier again. Removing a line from the PO puts that material back on the material plan so it can be ordered again on another PO.
- A Draft PO can be edited. From the PO page use **Send to Supplier**, then the supplier side can be marked with **Acknowledge**.
- Goods can only be received once the PO is Sent, Acknowledged or Partially Received. From the PO page click **Receive Goods** to start the GRN.
- If the supplier delivers part of the order and tells you the rest is not coming, do NOT cancel it — use **Close Short** on the PO page. Cancel is no longer offered on a Partially Received PO because it would claim the delivery never happened.
