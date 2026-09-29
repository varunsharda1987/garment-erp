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
  - default delivery location
  - kashaya fabs
  - delivery location har baar
  - godown par delivery
  - baad mein batayenge
  - डिलीवरी कहाँ
  - डिलीवरी लोकेशन
  - गोदाम
  - काशाया फैब्स
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
  - po date
  - back date po
  - backdated po
  - purani date ka po
  - po ki tareekh
  - पीओ की तारीख
  - पुरानी तारीख
  - edit po
  - po edit nahi ho raha
  - पीओ एडिट
  - save and send
  - send to supplier
  - sending failed
  - पीओ भेजें
  - po list
  - purchase order list
  - पीओ लिस्ट
  - accessories
  - accessories po
  - एक्सेसरीज़
  - एक्सेसरीज़ पीओ
  - label po
  - labels kis po par
  - label ka po
  - packaging po
  - packing material po
  - carton po
  - पैकेजिंग
  - पैकिंग सामान
  - machine parts po
  - machine ka saaman
  - needle po
  - मशीन पार्ट्स
  - po category
  - category nahi dikh rahi
  - change category
  - category badlo
  - कैटेगरी
  - श्रेणी
  - gst percent
  - gst rate on po
  - hsn
  - hsn code 6 digit
  - gst kitna lagega
  - zero gst
  - जीएसटी
  - एचएसएन
  - materials required
  - style se po
  - greige lace po
  - trims po
  - स्टाइल से पीओ
  - dyeing po
  - processing po
  - रंगाई
  - wrong category
  - delivery date before po date
  - which label
  - kaunsa label
  - kis buyer ka label
  - कौन सा लेबल
  - po for which buyer
  - kiske liye po
  - किसके लिए पीओ
  - allocate to orders
  - po ko order se jodna
  - पीओ ऑर्डर से जोड़ें
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/pages/PurchaseOrderForm.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/types/purchaseOrder.types.ts
  - backend/src/schemas/purchaseOrder.schema.ts
  - backend/src/services/helpers/po-line-category.helper.ts
  - backend/src/services/unified-po-creation.service.ts
  - backend/src/services/document-data/po-deliver-to.ts
  - frontend/src/components/WeaverCombobox.tsx
  - frontend/src/components/purchase-orders/LabelSizeQtyDialog.tsx
  - backend/src/controllers/material.controller.ts
  - frontend/src/components/purchase-orders/DeliverySplitEditor.tsx
  - frontend/src/components/purchase-orders/LabelSetDialog.tsx
  - frontend/src/components/requirements/requirement-list-options.ts
  - frontend/src/lib/label-materials.ts
  - frontend/src/lib/label-lines.ts
  - backend/src/services/label-set.service.ts
  - frontend/src/types/thread.types.ts
  - frontend/src/services/thread.service.ts
  - backend/src/services/helpers/purchase-unit.helper.ts
  - backend/src/services/helpers/thread-pack.helper.ts
  - frontend/src/lib/po-list-stats.ts
  - frontend/src/lib/delivery-plan.ts
  - frontend/src/components/purchase-orders/DeliveryPlanCard.tsx
  - frontend/src/components/purchase-orders/CancelPoDialog.tsx
  - backend/src/services/document-data/purchase-order.doc-data.ts
  - backend/src/services/helpers/material-detail.helper.ts
  - backend/src/services/helpers/material-hsn.helper.ts
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/ui/combobox.tsx
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/SearchInput.tsx
  - frontend/src/lib/material-detail.ts
  - backend/src/services/helpers/po-for-buyer.helper.ts
  - backend/templates/kf/purchase-order.hbs
  - frontend/src/components/purchase-orders/PoAllocationCard.tsx
  - frontend/src/lib/po-allocation-view.ts
  - frontend/src/components/WarehouseCombobox.tsx
  - backend/src/services/helpers/po-default-delivery.helper.ts
route: /procurement/purchase-orders/new
---

## Before you start
The supplier must already exist in **Materials & Masters → Suppliers**, and every material you order must exist as a master. A PO can only be raised for MATERIALS. Processing, dyeing, printing and other outside service work is NOT a PO any more — use a Job Work Order instead.

## Steps
1. Open **Procurement → Purchase Orders** in the sidebar.
2. Click **Create PO**. The page title reads **Create Purchase Order**.
3. Optional but recommended: in the **Link to Style** card, pick a style (**Search and select a style...** — type part of the buyer style code, our style code or the name; each style reads buyer style code first, our Style Code in brackets when it differs), and link an order if this PO is for a specific order (**Link to order (optional)...** — each order lists its styles the same way). Linking a style shows the **Materials Required** card, where you can add the style's materials straight to the PO (see *Adding from a style* below).
4. In the **PO Details** card, choose **PO Category ***. The options are material categories only: **Fabric**, **Greige**, **Trims**, **Accessories**, **Thread**, **Lace**, **Greige Lace**, **Machine Parts**, **General**. **Accessories** means a style's labels and packaging (the same split as the Style Form's **4. Accessories** tab); **Trims** is every other trim (the Style Form's **3. Trims & Materials** tab). There is no separate Packaging category any more — packaging and labels both go on an Accessories PO. An older PO saved as Packaging still shows that name when you edit it. The category cannot be changed later while editing a saved PO. If the PO already has lines and you pick another category, a box **Change category?** says the lines on this PO will be removed — click **Change to <category>** to go ahead, or **Cancel** to keep everything. If you added a line from **Materials Required**, the category shows a **Set by material** lock — click **Clear Style** to change it.
5. Choose **Supplier ***. The list is filtered by the category, so select the category first — the box stays disabled until you do. Accessories shows suppliers saved as **Trims Supplier** or **Packaging Supplier** (label makers are Trims suppliers, carton and polybag makers Packaging suppliers), Machine Parts shows machine-part suppliers, and General shows every supplier. If nobody fits, the list says "No suppliers found for this category." Changing the supplier keeps the lines already on the PO. If the supplier has no GSTIN or billing state on file, the totals say "Supplier's state is not on file — tax shown as CGST + SGST. Add the supplier's GSTIN or billing state."
6. Check **Delivery Location** — the warehouse or processor's unit the goods should reach. It is filled in for you once you pick the category: **Kashaya Fabs** (your own store) for every category except **Greige** and **Greige Lace**, with the note "Kashaya Fabs is filled in for every PO except Greige and Greige Lace — pick another place if the goods go elsewhere." Until you pick a place yourself it follows the category. A **Greige** or **Greige Lace** PO starts with no place, because that cloth usually goes straight to a dyer — pick the dyer's **… - Processing Unit** if you know it. To decide the place at dispatch on any PO, pick **To be advised — decide at dispatch** at the top of the list: the PO then prints "To be advised before dispatch", and you set the place later from the PO page. Your own store prints your address from Company Profile. If part goes to one place and part to another (for example some greige straight to a dyer, the rest to Kashaya Fabs), switch on **Split delivery across locations**: the Delivery Location box gives way to "Split across places — choose them in the Split delivery card below. Place 1 is the PO's delivery location." Pick each place in the **Split delivery** card below the items and type how much of each item goes there; every item must be fully placed before you can save (**Put the balance into place 1** fills what is left). The **Delivery Details** card and **Preview** then list every place with its quantities. Switching the split off makes place 1 the Delivery Location again. The PO prints every place under **Delivery Points**, and the supplier sends one invoice and one e-way bill per delivery.
7. Check **PO Date ***. It is today by default. If the order was placed earlier and you are only entering it now, set the day it was really placed — the list and the printed PO show this date. A date after today is not allowed.
8. Set **Expected Delivery Date *** (required). It cannot be before the PO Date — the same day is fine.
9. In the **Order Items** card, use **Quick Add Material** to search and add a material, or click **Browse All Materials** (or **Or Browse All**). For a **Greige** PO with no style linked, use **Add Greige Fabric** instead; you can add several greige types. A **Fabric** PO lists fabrics in Quick Add.
   Which materials a category lists (and accepts on save):
   - **Greige** — greige only; **Fabric** — fabric only; **Thread** — thread only.
   - **Lace** — finished laces only; **Greige Lace** — greige laces only.
   - **Accessories** — labels (sewn-in, hangtags, price tags) and packaging; **Machine Parts** — machine parts.
   - **Trims** — buttons, zippers, elastics and the other trims, but NOT labels or packaging. **General** — every material except greige, fabric, lace and thread, whoever the supplier.
   The list also shows materials linked to the chosen supplier, but only those this category takes.
   Each row in **Quick Add Material** and **Browse All Materials** has a second, grey line that tells look-alike items apart: who it is for (buyer · brand), what it is (type, size, material, colour…) and the rate a line starts at, per the unit it is bought in. You can search by any of these too — typing a buyer name or "carton" finds them.
   If nothing is listed, the card says "No materials found for this supplier or category." — click **Browse all materials instead**.
   **A style's whole label set in one go** (main-cum-size, traceability, washcare, price tag…): link the style (and the order) in **Link to Style**, then in **Materials Required → Accessories** click **Order label set…**. To order just one label, click **Sizes…** (or **Add** for a label without sizes) on that label's row. A box opens with one row per label and one column per size:
   - The top row, **Garments per size**, is filled from the linked order's size breakup. With no order linked, type the garments per size once — every label fills from it.
   - Each label's boxes = garments × labels per garment, plus the extra % from the BOM, rounded up. Change any box you like; a box you typed in keeps your number.
   - Untick a label to leave it out. A greyed-out label says why: "Not supplied by … (supplied by …)" — it is set up for another supplier on its Label page. A label with no supplier on its Label page yet is NOT greyed out: it reads "No supplier on its Label page yet — bought from …" and is bought from this PO's supplier. "—" means that label has no such size.
   - If no supplier is chosen yet, the box first asks you to pick one (it shows how many of the labels each supplier makes).
   - If the order already has open label requirements from MRP, a warning says a PO made here does not close them and links to **Requirements → Order & Style** — order from there to keep MRP linked.
   - The footer counts labels · lines · pcs. Click **Put on the PO**: each size becomes its own PO line. Opening it again shows the PO's current quantities, and a size set to 0 is removed.
   **Order label set…** makes an **Accessories** PO. An empty PO of another category switches to Accessories for you; a PO that already has lines of another category is refused ("Labels go on an Accessories PO — this PO already has other lines. Start a new PO for the labels.").
   **Labels that come in sizes** can also be added from **Quick Add Material** or **Browse All Materials**: they are listed ONCE, marked "· 7 sizes". Picking one opens a size box with one quantity per size and a **Total**; click **Add N lines** (or **Update lines** when it is already on the PO).
   On the PO, each label shows as **one heading row** (the label code, "N sizes", and the total quantity, amount, tax and total of its sizes) with one row per size beneath it, in size order. Click the heading to fold its sizes away. **Edit sizes** on the heading reopens the size box; **Remove label** removes every size line of that label. **Preview** shows the same grouping.
   Labels and packaging are listed for a supplier when that supplier is added on the label's own page (**Materials & Masters → Labels**, then **Edit**). A label or packaging item with **no supplier on its page yet** (for example a new Liva tag) is listed for every supplier on an Accessories or General PO, so you choose who makes it here. A Trims PO does not list labels or packaging. Once a label has a supplier on its page, only that supplier's POs list it — add the other supplier on the Label page to buy it from them too.
   **Thread is ordered in cones or tubes and bought in boxes** — use a **Thread** PO. Picking a thread adds a line with two pickers under its name: **Cones** or **Tubes**, and the ply — **2-ply** or **3-ply** for cones; a tube is always 3-ply, so its ply is locked. In **Quantity** type how many cones (or tubes) you want: the line works out the boxes, rounded up to whole boxes of the size in the thread packaging table, and shows it, e.g. "= 3 boxes × 10 = 30 cones, Cone 3-ply" for 23 cones. Cones are priced per cone — type the rate in the **Per cone** box and the line shows the rate per box under it; tubes are priced per box — type the box rate. The PO line is saved in boxes. Thread is not ordered from **Requirements** — order it here.
   **Buttons and snap buttons are ordered by the gross** (144 pieces). Picking one adds a line in **gross** at the button's price per gross, with "= 288 pcs" under the unit for 2 gross. A button line in pieces is refused ("bought by the gross — order it in Gross"). Pieces needed from a style's BOM are converted for you, rounded up to whole gross (2,300 pcs → 16 gross).
10. For each row fill **Quantity**, **Unit Price** and, for Greige/Fabric, **Fold L (cm)** if known. For Greige/Fabric the column reads **Quantity (actual)** — the quantity is in actual metres — and the next column, **Counted @ L**, fills itself (it cannot be typed into) with the same quantity as the mill will count it: 9,810.78 at Fold L 98 reads **10,011 m**, with "actual × 100/98" under it. With no Fold L (or 100 and over) it shows the same quantity. The unit price is kept to the paisa when you leave the box. **Amount**, **Tax** and **Total** calculate automatically. Use the bin icon to remove a row.
   The **HSN/SAC** column shows the material's HSN code. Every material has one — 6 digits (8 allowed) — filled in automatically when the material is created. **GST %** is filled in from the material's own GST rate, or the rate of its HSN code. If the material has no rate on file, the row assumes the standard rate and says so under the material: "No HSN on this material — 5% assumed" or "HSN … has no GST rate on file — 5% assumed" — type the correct rate. You can change any row's GST %: type **0** for exempt goods; the most allowed is 28. The GST % you see is the GST % saved on the line. The totals show the tax for each rate on the PO — CGST + SGST inside our state, IGST for a supplier in another state.
   On Greige and Fabric POs each row also has a **Weaver** box — the mill this cloth is woven by. It is optional here (you may only know it at dispatch). Pick a weaver, or type a new name and click **Add "…" as a new weaver**; the same name in any spelling is kept as one weaver. Do NOT make a new greige just because the weaver changed — the weaver is recorded on the PO line and the stock lot, and all weavers stay under the same greige. When set, the PO prints "Weaver: …" under the line.
11. Add anything else in **Notes**.
12. Click **Preview** to check the document, then **Save as Draft**, or **Save & Send** to save and send it to the supplier in one go. Either one returns you to the Purchase Orders list.
    If **Save & Send** saves the PO but the send fails, an error reads "<PO number> saved as Draft — sending failed" and that PO's own page opens. The PO already exists — click **Send to Supplier** there to try again. Do NOT create it again, or you will have two POs.

## Adding from a style (Materials Required)
- Choose how quantities are worked out: **Enter quantity directly** (metres of finished fabric) or **Calculate from order quantity** (type the order quantity in pieces). With an order quantity, each material shows "→ … needed".
- The card lists the style's materials in sections: **Fabrics & Greige** (from its approved CAD), **Trims** (the style's Trims & Materials tab) and **Accessories** (its labels first, then its packaging — the style's Accessories tab). Each material has a button named after the PO category it goes on: **GREIGE PO**, **TRIMS PO**, **LACE PO**, **GREIGE LACE PO**, **THREAD PO** or **ACCESSORIES PO**. Labels have **Order label set…** at the top of the Accessories section and **Sizes…** / **Add** on each label row; packaging items have **ACCESSORIES PO**.
- Clicking a button **adds** that material as a line — with its own unit — to the PO. If the PO is already that category, the supplier and the other lines stay. If it is another category, the PO switches to the button's category (asking **Change category?** first when it already has lines) and the new line starts it. Picking or changing the supplier afterwards keeps the line.
- A greige line's metres are typed by you. The row shows the **Finished Fabric** metres; greige needs more by the processor's shrinkage, so type the greige metres on the PO line. Skip **GREIGE PO** if the greige is already in stock or at the processor's warehouse.
- Dyeing or printing is not bought on a PO: under **GREIGE PO** the link **Dyeing / printing → Job Work Orders** opens the Job Work Orders page.
- A thread line from **THREAD PO** starts in cones with the ply to choose: its BOM quantity counts garments, so type the cones or tubes yourself.
- A button line is converted to whole gross, with the pieces needed noted in its remarks.
- When editing a saved PO, only the buttons for its own category work. The others are greyed out and say "This is a … PO — start a new PO for …".

## Validation traps
- **PO Category**, **Supplier**, **Expected Delivery Date**, **PO Date** and at least one item are all required — saving without any of them shows a Validation Error.
- **PO Date** cannot be after today: "The PO date cannot be in the future". Back-dating is allowed.
- **Expected Delivery Date** cannot be before the PO Date: "The expected delivery date (…) is before the PO date (…)".
- Every item needs a material selected, a quantity greater than zero and a unit price greater than zero. Zero or blank price is rejected.
- Every row needs a **GST %** from 0 to 28: "Enter the GST % for … — 0 to 28 (0 if exempt)". A blank GST box is refused; 0 is allowed.
- A material that does not belong on the category is refused, and the message says where it goes, e.g. "BTN-0003 Shell Button is a button — it goes on a Trims, General PO, not a Lace PO." Greige, fabric, lace and thread go only on their own category (a finished lace on **Lace**, a greige lace on **Greige Lace**). **Accessories** takes only labels and packaging, and **Machine Parts** only machine parts. **Trims** takes every other trim — a label or packaging item on a Trims PO is refused, e.g. "… is a label — it goes on an Accessories, General PO, not a Trims PO." **General** takes anything that is not greige, fabric, lace or thread.
- A thread line needs Cones or Tubes, the ply and a count: "Choose cone or tube, and the ply, for …" / "Enter how many cones for …". A thread line in any unit other than boxes is refused ("… is bought in boxes — enter the cones or tubes you want and the boxes follow").
- If a material is already on another PO the supplier is working on (Sent, Acknowledged or Partially Received, with goods still to come), a **Duplicate PO Warning** lists those POs and their pending quantity. Click **Cancel** to go back, or **Order Anyway** to continue. Drafts and fully received lines do not count.

## The Purchase Orders list
- The cards at the top count **Total POs**, **Pending Action** (drafts not yet sent), **Awaiting Delivery** (Sent, Acknowledged and Partially Received) and **Total Value**.
- Each row shows the PO number with its **PO Date** under it, **Supplier**, **Material** (the first line's material, with "+N more" when the PO has several lines; a label bought in sizes counts as one line; a grey line under it says whose it is and what it is, as on the PO page — point at the cell to see every line), **Category** (Fabric, Greige, Trims, Accessories, Thread, Lace, Greige Lace, Machine Parts, General; an older PO may show Packaging), **Expected Delivery**, **Items**, **Amount**, **Source** (All tab only) and **Status**. The PO number is a link — click it (or open it in a new tab) to see the PO; clicking anywhere else on the row opens it too.
- The search box finds a PO by PO number, supplier, style or material. The filters in the same row are **All statuses** (Draft, Sent, Acknowledged, Partially Received, Received, Closed Short, Cancelled), **All suppliers** (a searchable picker — type a name to find one), **All sources** (Manual, Cost Sheet, MRP; on the **All** tab), **All categories** (on the **Material** tab) and **Any delivery place** / **Delivery: to be advised**. **Clear N filters** removes every filter and goes back to page 1; it keeps the tab you are on. If nothing matches, the list says "No purchase orders match these filters" with a **Clear filters** button.
- When the list is opened from an order, it shows only that order's POs and an **Order: …** chip in the filter row. Click the **×** on the chip to see every PO again.
- The row's **…** (actions) menu always has **View Details**. A **Draft** also has **Edit** and **Delete**; a **Sent** or **Acknowledged** PO has **Cancel PO**; a **Partially Received** PO has **Close Short**.

## After saving
- Only a **Draft** can be edited — use **Edit** on the PO page or in the row menu. Opening Edit on a PO that was already sent shows "<PO number> is sent — it can no longer be edited" (or received, cancelled…) and opens the PO page instead.
- Editing a Draft PO keeps everything you already entered on each line, including **Fold L (cm)** and **GST %**, and shows the **PO Date** and **Delivery Location** it was saved with. Changing the supplier on a draft works the tax out again (CGST + SGST or IGST) for the new supplier. Emptying **Notes** and saving clears them. Changing the location there records a proper amendment (the original location is kept for tracking), so change it before sending — the supplier's PDF prints the delivery address. Emptying the box on the form does not clear it; to make it "to be advised" again, use **Change delivery** on the PO page.
- The PO page always shows a **Deliver To** card. On a PO left to be advised it reads **To be advised** with a **Set delivery** button; otherwise it has **Change delivery**. Set or change it until the PO is fully Received, Closed Short or Cancelled, then share the PO with the supplier again.
- Removing a line from a Draft puts that material back on the material plan so it can be ordered again on another PO.
- On the PO page each line has a grey line under the material saying whose it is and what it is (buyer · brand, then type, size, material, colour…); a label bought in sizes shows it once, on its heading. When the PO is for one buyer — its linked order's or style's buyer, or the one buyer all its labels and packaging are for — the card with **Category** and **Source** also shows **For** with that buyer (and the order or style, e.g. "<buyer> · Order <order number>"; a style is named by its buyer style code first, with our Style Code in brackets only when it differs, e.g. "<buyer> · Style <buyer style code> (<our style code>)"). Lines for several buyers, or none, show no **For**. The printed PO carries the same **For** line and the same grey line under each item.
- From the PO page use **Send to Supplier**; once the supplier confirms, mark it with **Acknowledge**.
- Once the PO is Sent, Acknowledged or Partially Received, it can be linked to running orders that need what it brings: a banner says "N running orders need these and are not linked", **Allocate to orders** (in the top bar or the banner) links them, and the **Allocated to orders** card shows what is linked. Full steps are in the guide "Allocate a sent PO to running orders".
- Goods can only be received once the PO is Sent, Acknowledged or Partially Received. From the PO page click **Receive Goods** to start the GRN.
- To end a PO, the action depends on its status:
  - **Draft** — it was never sent, so it is deleted, not cancelled: click **Delete** (on the PO page or in the row menu).
  - **Sent** or **Acknowledged** — click **Cancel** on the PO page (or **Cancel PO** in the row menu), type a **Reason** and click **Cancel Order**.
  - **Partially Received**, and the rest is not coming — do NOT cancel it: use **Close Short** on the PO page. A plain cancel is refused once goods have arrived.
  - Full steps are in the guide "Close a Purchase Order Short, Cancel it, or Delete a Draft".
