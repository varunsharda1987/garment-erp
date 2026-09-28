---
slug: allocate-po-to-orders
title: Allocate a sent PO to running orders (link a PO to an order, undo it)
keywords:
  # English
  - allocate PO
  - allocate to orders
  - allocate PO to orders
  - link PO to order
  - link PO
  - link to open PO
  - open PO not linked
  - PO not linked
  - running orders need these
  - free to link
  - left free
  - held for order
  - held at once
  - undo allocation
  - unlink PO
  - PO covers order
  - open PO covers sizes
  - link sizes
  - on PO / JWO
  - already here held
  - take them anyway
  - held for another order
  - buy twice
  - late badge
  # Hinglish
  - PO ko order se jodna
  - po order se link karna
  - po allocate karna
  - order ko po dena
  - khula po
  - open po link nahi hai
  - po se jodo
  - allocation undo karna
  - po hatana order se
  - maal order ke liye rakha
  - dusre order ka maal
  - do baar kharidna
  # Devanagari
  - पीओ ऑर्डर से जोड़ें
  - पीओ को ऑर्डर से जोड़ना
  - पीओ अलॉट करना
  - ऑर्डर को अलॉट
  - पीओ लिंक करना
  - खुला पीओ
  - लिंक नहीं है
  - अलॉटमेंट अनडू
  - ऑर्डर के लिए रखा माल
  - दूसरे ऑर्डर का माल
  - दोबारा खरीदना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/PurchaseOrderDetail.tsx
  - frontend/src/components/purchase-orders/AllocateToOrdersDialog.tsx
  - frontend/src/components/purchase-orders/PoAllocationCard.tsx
  - frontend/src/lib/po-allocation-view.ts
  - frontend/src/lib/po-allocation-split.ts
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/OpenPOSupplyNote.tsx
  - frontend/src/components/requirements/open-po-supply.ts
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/components/BulkPOGenerationDialog.tsx
  - frontend/src/hooks/useHeldStockConfirm.tsx
  - frontend/src/lib/held-stock-confirm.ts
  - frontend/src/pages/ChallanDetail.tsx
  - frontend/src/pages/StockOutForm.tsx
  - frontend/src/components/processing/SendToMillDialog.tsx
  - frontend/src/components/TrimIssuanceSection.tsx
  - frontend/src/components/PackagingIssuanceSection.tsx
  - backend/src/routes/po-allocation.routes.ts
  - backend/src/schemas/po-allocation.schema.ts
  - backend/src/services/helpers/po-allocation.helper.ts
  - backend/src/services/mrp.service.ts
route: /procurement/purchase-orders
---

## What allocating does

A PO that has already gone to the supplier may have room for more than it was raised for (it was bought over, or raised for other orders). Allocating links part of a PO line to a running order that still needs that material, so the order is covered by that PO instead of being bought again.

- The order's requirement moves onto the PO and follows it (for example **PO Sent**, then **Received**).
- When goods arrive, the order with the **earliest delivery** is filled first. Goods that arrive for a linked order are **held for that order** — other orders cannot use them without asking.
- If only part of an order's need is allocated, the rest stays **PO Required** as a separate balance row, to be bought.

Who can do it: anyone with the **MRP** or the **Purchase Orders** permission. Anyone can see the allocation card.

## Allocate from the PO page

1. Open **Procurement → Purchase Orders** in the sidebar and click the PO number.
2. The PO must be **Sent**, **Acknowledged** or **Partially Received**. A draft, cancelled, closed-short or fully received PO cannot be allocated.
3. If running orders need what this PO brings and are not linked, a banner says **"N running orders need these and are not linked"**. Click **Allocate to orders** in the banner or in the top bar.
4. The box **Allocate <PO number> to orders** lists each PO line with **Free to link** and **Left free**, and under it every running order that needs that material, **earliest delivery first**: **Order**, **Style**, **Delivery**, **Needs** and **Allocate**.
5. It opens already ticked the suggested way: each order gets its full need, in delivery order, until the line runs out (the last one may get part).
   - **Untick** an order to leave it out.
   - **Type a quantity** in **Allocate** to give it less. Rows you did not type in then share what is left, in the same order.
   - **Reset to suggested** puts the ticks and quantities back.
6. Read the badges before saving:
   - **Late** — this PO is expected after that order needs the goods.
   - **"N already here — held at once, can't be undone"** — part of the line has already arrived and is free; the first orders linked take it and it is held for them at once.
   - **More than it needs** / **Enter a quantity** — fix the typed figure.
   - **Ticked on <other line>** — an order can be linked on one line only.
   - A grey reason (for example "is already on PO…", "its order … is cancelled") — that order cannot be linked here.
7. Check **Left free after this** at the bottom, then click **Allocate to N orders**.
8. A message confirms "<PO number> linked to N orders". If some orders were only part-covered, it names the new balance rows that stay to be bought.

For greige and lace lines the box also shows **Delivers to** and each order's **Dyed at**: an order dyed at a processor this line does not deliver to cannot be linked to it.

## See what is allocated (the "Allocated to orders" card)

On the PO page the card **Allocated to orders** shows, per line, in the material's own unit: **Ordered**, **Arrived**, **Linked**, **Received for orders**, **Held**, **Free to link**, **Arrived free** and **To come**. A label bought in sizes shows one heading with its sizes under it.

Click a line to open its orders, listed in fill order (**#**): **Order**, **Style**, **Delivery**, **Allocated**, **Received**, **Held**, **Issued** and **Status**. Warnings under an order say, for example, "Order cancelled — undo to free …" or "BOM now needs … less".

## Undo an allocation

1. On the PO page open the line in **Allocated to orders**.
2. Click **Undo** on the order's row.
3. The box **Undo this allocation?** explains the quantity goes back to being free on the line, and the requirement goes back to needing a purchase order. Click **Undo allocation** (or **Keep it**).
4. A message confirms it, for example "Allocation undone — <requirement> is po required again". If a balance row had been split off it, the message says it folded back in.

Undo is only possible **before any goods arrive for that order**. When it is not allowed, the **Undo** button is greyed out; point at it to see why — for example "… already arrived for this order — it can't be undone", "… is held for this order", "… was already issued", or "GRN … on this line is awaiting QC — finish QC first".

## Link from the Requirements page

1. Open **Procurement → Requirements** in the sidebar, **Material Requirements** tab.
2. A requirement that an open PO could cover shows an amber note under its status or in the PO column, for example "**PO2609-0231 · 1,589 pcs free · not linked** (unlinked orders need …)". It may add "… here + … to come", "delivers to …", or "due … — after it is needed".
3. Click **Link** on that row (a menu appears when several open POs could take it — pick one).
4. The same **Allocate … to orders** box opens on that PO, with only this requirement ticked. Check the quantity and click **Allocate to 1 order**. Nothing is linked until you save.
5. In **Show: Order & Style**, a style card shows the badge **Open PO covers N lines**. A sized label's heading shows **Open PO covers N/M sizes** with a **Link sizes** button that opens the box with those sizes ticked.
6. Once linked, the row shows the PO and how much of it is theirs, for example "PO2609-0231 · 350 pcs". The stat card **On PO / JWO** counts it.

If you tick rows that an open PO already has room for, the selection bar says "N selected could be linked to open POs instead", and **Bulk Generate POs** warns at step 1 that a new PO would buy them again. Close it and use **Link** on those rows.

## Goods held for another order

When an issue screen (**Issue Challan** on a challan, **Stock Out**, a job-work issue or **Send to Mill**, or **Issue to Stitching** / **Issue to Finishing** on a work order) would take goods held for another order, a box **These goods are held for another order** lists "Held for ORD… (STYLE): N" and asks **"Take them anyway? That order will need them bought again."**
- **No, keep them** — nothing is issued.
- **Take them anyway** — the goods are issued, and that order's requirement goes back to needing them bought.

On **Stock Out → Internal Issue**, pick the order in **For order** so goods held for that order are issued to it instead of being taken from it.

## Validation traps

- **Only a sent PO can be allocated** — "only a sent PO (sent, acknowledged or part received) can be allocated to orders".
- **Not every line can be allocated.** Fabric, thread, service and machine-part lines are never linked, nor are processing POs.
- **Only a requirement that still needs buying** (**PO Required** or **Partially from Stock**) of a running order can be linked. A label waiting for sizes needs the sizes entered first; a **Needs Decision** row needs **Order the extra** first.
- **Colour and unit must match** the PO line (colour is not compared for greige).
- **A GRN awaiting QC blocks the line** — both linking and Undo wait until QC is finished.
- **Use Stock refuses a row that is on a PO** — "… is on PO… — its goods come on that PO. To cover it from stock instead, undo its allocation on the PO first."
- **Someone else changed the PO meanwhile** — the box reloads the figures; check the split and save again.
