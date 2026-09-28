---
slug: order-track-status
title: Check an Order's Status and What Is Stopping It
keywords:
  # English
  - order status
  - track order
  - order progress
  - where is my order
  - what is stopping the order
  - why is the order stuck
  - order blocked
  - order blockers
  - ready to cut
  - production status
  - production run progress
  - work order progress
  - pending order
  - in production
  - completed order
  - dispatched
  - order late
  - due date
  - order page
  - order details
  - order pipeline
  - production workflow
  - materials of an order
  - requirements of an order
  - view POs
  - POs for this order
  - which POs for this order
  - purchase orders of an order
  - cancel order
  - delete order
  - order cannot be deleted
  - order cannot be cancelled
  - size breakdown
  - size split
  - size split pending
  - add size breakdown
  - edit size breakdown
  - style has no colour
  - size without colour
  - colour optional
  - fabric issued
  - costing per piece
  - oder status
  - ordr status
  # Hinglish
  - order kahan pahuncha
  - order status kaise dekhe
  - order kyun ruka hai
  - order kahan atka hai
  - order late hai
  - order ka kaam kitna hua
  - order ke PO
  - order ke PO kaise dekhe
  - is order ke kitne PO bane
  - PO kitne bane
  - order cancel kaise kare
  - order delete kaise kare
  - order delete nahi ho raha
  - order cancel nahi ho raha
  - status khud badalta hai
  - saiz
  - saiz kaise dale
  - bina colour ke size
  - colour nahi hai
  - kapda kitna issue hua
  # Devanagari (MANDATORY)
  - ऑर्डर
  - ऑर्डर स्टेटस
  - स्टेटस
  - ट्रैक
  - प्रोडक्शन
  - डिलीवरी
  - ऑर्डर क्यों रुका है
  - ऑर्डर कहाँ अटका है
  - रुकावट
  - ऑर्डर लेट
  - ऑर्डर के पीओ
  - पीओ देखना
  - पर्चेज़ ऑर्डर
  - ऑर्डर कैंसल
  - ऑर्डर रद्द
  - ऑर्डर डिलीट
  - साइज़
  - साइज़ ब्रेकडाउन
  - साइज़ पेंडिंग
  - बिना रंग
  - रंग नहीं है
  - रंग के बिना साइज़
  - कपड़ा जारी
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/OrderList.tsx
  - frontend/src/pages/OrderDetail.tsx
  - frontend/src/pages/OrderForm.tsx
  - frontend/src/components/orders/SizeBreakupDialog.tsx
  - frontend/src/components/orders/CancelOrderDialog.tsx
  - frontend/src/hooks/useCreateOrderBom.tsx
  - frontend/src/components/ExportButton.tsx
  - frontend/src/pages/ProductionStatus.tsx
  - frontend/src/pages/UnifiedRequirementsPage.tsx
  - frontend/src/components/requirements/OrderStyleLabelView.tsx
  - frontend/src/components/requirements/requirement-list-options.ts
  - frontend/src/types/order.types.ts
  - frontend/src/types/mrp.types.ts
  - backend/src/services/helpers/order-status.helper.ts
  - backend/src/services/helpers/order-requirements.helper.ts
  - backend/src/services/order.service.ts
  - backend/src/controllers/order.controller.ts
  - backend/src/services/helpers/sku-colour.helper.ts
route: /orders
---

## Find the order
1. Open **Orders & Sales → Orders** in the sidebar.
2. Type in **Search by order number, customer or style...** — the order number, customer name or code, style code / buyer style / style name, or the sale order / buyer PO it came from. Several words narrow the list: each word must match something.
3. Narrow the list with **All Customers** and **All Status** (Pending, In Production, Completed, Dispatched, Cancelled).
4. The row shows the order number with its order date (and an **SO …** chip when it came from a sale order — click it to open the sale order), Customer, Style, Buyer Style, Delivery Date, Quantity, Amount ("Price TBD" when no price is set) and Status.
5. Click the order number, the row, or **View** to open the order page.

**Export** (top right) downloads the list as CSV, Excel or PDF, with the same search and filters you applied.

## The row's next-step button
Next to **View**, each open order shows the next BOM step across all its styles:
- **Create BOM** — a style on the order has no BOM yet. It builds the BOM from the style's approved raw-material cost sheet and opens it for review.
- **Review BOM** — a draft BOM is waiting to be approved.
- **Requirements** — every style has an approved BOM (locking it is optional). Opens **Requirements** filtered to this order.

**Edit** appears while the order is Pending or In Production.

## How the status moves
Nobody sets an order's status by hand. It follows the production runs and delivery notes, and the order page says why on its **Status:** line:
- **Pending** — no production run has started yet ("no production run yet" / "no production run has started").
- **In Production** — a production run has started (for example "WO… in production").
- **Completed** — every production run is completed and the runs cover the whole order quantity.
- **Dispatched** — everything ordered has shipped on delivery notes (returned pieces are taken off).

It also moves back: a cancelled or rejected delivery note takes a Dispatched order back to Completed, and a new production run takes a Completed order back to In Production. **Cancelled** comes only from **Cancel Order**. **Split** means the order was divided into child production runs — open the children to follow the work.

## Read the order page
1. **Header** — the order number, the status badge, the **SO …** chip for a sale-order order, and the **Status:** reason line. Buttons: the share menu, **Back to Orders**, and — while the order is still open — **Cancel Order** and **Edit Order**.
2. **Summary** — Customer, Order Date, Delivery Date, Quantity and Amount. Under Delivery Date it says "due in N days", "due today" or, in red, "N days late". Quantity shows "N shipped" once something has shipped. "Pricing Pending" means no unit price was entered.
3. **What's stopping it** — one box for each style on the order that has no production run yet, listing everything that stops it being cut:
   - **No BOM yet.** — click **Create BOM**.
   - **BOM vN is a draft — review and approve it.** — click **Review BOM**.
   - **Size breakdown not given** — click **Add Size Breakdown** (see *Enter the sizes later*).
   - The cutting checks, in the words the cutting step uses: a sample not approved, a lab round not passed, a fabric or garment test not passed, material short, or no approved Production CAD. Each has a button to where it is fixed: **Open the style**, **Fabric tests**, **Garment tests**, **Requirements** or **CAD Planning**.
   - When nothing blocks: **Ready to cut — plan the production run.** with **Create Production Run**.

   A style that already has a production run shows the run number and its status instead — follow it in **Production**. "Checking…" shows while the checks load. A cancelled order says "This order is cancelled."; a completed one says "Production is finished" (and "and shipped" once dispatched).
4. **Materials** — the **Materials to buy — N lines** row counts every live requirement line of the order once: **To order**, **On order**, **Received**, **From stock**, and, when there are any, **Waiting for sizes**, **Needs a decision** and **Not checked**, with "% ordered or in hand". Cancelled lines are not counted. A second row, **Processing (dyeing / printing)**, has an **Open** button for the Outsourced Work tab; **Services on the production runs** shows To assign / Job work created / Completed. **Open Requirements** opens **Requirements** filtered to this order. Before the BOM is approved it reads "No requirements yet".
5. **Production** — one box per production run: number, status, style, planned dates and location, then **Fabric issued**, **Cut** (of the run's total), **Stitched**, **Finished** and **Completed** with a %. **Fabric issued** is net of any fabric returned from Cutting (fabric sent back and issued again is not counted twice), with how much is "still at Cutting" underneath. **View** opens the run. **Split** appears on a Pending run of more than one piece that has sizes. **Create Production Run** appears at the top when a style with sizes has no run yet.
6. **Items & Sizes** — each style with its quantity and price per piece ("Price not set" when there is none), the colour × size grid (the **Colour** column reads **—** for sizes saved without a colour) and **Edit Size Breakdown**, and a **Costing (per piece)** box. The costing box uses the cost sheet's own words: the section totals (**Fabric Total**, **Trims Total** and so on), **Subtotal**, **Value Loss**, **Total After Value Loss**, **Markup**, **Total Product Cost** (the calculated cost) and **Closed Cost per Piece** (the buyer's agreed price, excluding GST — "not set on the cost sheet" when blank). Once a run has an actual cost, **Actual Total Product Cost** is shown against the Closed Cost.
7. **Order BOM** — one row per style with its BOM version, status and number of lines. **Review BOM** (draft) or **View BOM** opens it; **Create BOM** appears when the style has none.
8. **Dispatch & Billing** — appears once there are delivery notes or invoices, including those made from the linked sale order. The heading says how many pieces of the order have shipped. Click a note or invoice to open it.

## See the purchase orders of an order
1. On the order page, click **Open Requirements** on the **Materials** card. **Requirements** opens with **All orders** set to this order.
2. In the status box choose **On order** (or **All (not cancelled)**).
3. Open the order + style card. The **PO** column names the purchase order of each line.

Each style's POs can also be found under **Procurement → Purchase Orders** by searching the style code or the material.

## Enter the sizes later
Orders are often started with the total quantity only, so long-lead greige, dyeing and printing can be bought first. Enter the sizes on the order page — not in **Edit Order**, where the style, quantity and size grid are locked once the order has approved BOMs or active material requirements.

1. Open the order. In **What's stopping it**, the style shows **Size breakdown not given**. Click **Add Size Breakdown**.
2. In the **Add Size Breakdown** dialog, click **Distribute [N] evenly** or type the pieces under each size.
3. Below the sizes, the colour: a style with no colour shows **This style has no colour — sizes are saved without one.** (nothing to pick); a style with one colour has **Colour \*** filled in and locked; a style with several colours needs you to pick the **Colour \*** — **Save Size Breakdown** stays disabled until you do.
4. Check the **Entered: X / Y pcs** counter, then click **Save Size Breakdown**.
5. If the sizes add up to a different total, the save is refused once and an alert explains it. The button then reads **Confirm & change quantity to [N]**; clicking it saves the sizes and changes the order quantity.

Saving refreshes the order's material requirements and creates the production runs, which cannot exist while the order has no sizes.

- A colour is not needed to enter sizes — a style with no colour saves them without one. You do not have to set the style's Primary Color first.
- **This style has no sizes defined** means the sizes must be added to the style first.
- An order linked to a sale order gets its sizes from the sale order when it is linked (**Link to Production Order**), whatever the style's colour. Only a style with several colours, whose sale order lines do not name the colour, is left for you to enter here.
- To change sizes already saved, click **Edit Size Breakdown** in **Items & Sizes** (shown while the order is open).

## Cancel or delete an order
**Cancel Order** (order page, while the order is open):
1. Click **Cancel Order**. The dialog **Cancel order [number]** explains that the order, its production runs that have not started, its BOMs and its open requirements are cancelled and its reserved stock released. It cannot be undone.
2. If lace is still reserved for the order, choose **Release it to stock** or **Return it to the supplier**.
3. Optionally type a **Reason (optional)**.
4. Type the order number in the confirm box, then click **Cancel order**. **Keep order** leaves it as it is.

Cancelling is refused once production has started — a run in production, fabric issued to Cutting, or a cutting batch. The message names each run; close or cancel those runs first. It is also refused when a run is already completed or dispatched, and while a job work of the order has material issued or received. The reason shows inside the dialog.

**Delete** (Orders list, administrators only, on Pending or Cancelled orders) removes the order for good. It is refused, with the reason, when the order has production started, job work with material activity, shipped deliveries, paid invoices, processed ASN, fabric or lace allocations, lace issue notes, cutting batches, or requirement lines already on a PO or job work. A refused Delete never cancels anything; if the order is not yet cancelled, the refusal offers **Cancel the order instead…**, which opens the Cancel dialog above.

## Factory-wide view
For all running orders at once, open **Production Status** at the top of the sidebar. The **Production Status Dashboard** has a **By Order** / **By Style** toggle, **Detailed** / **Compact** / **Board** views, search and filters, and a **Refresh** button next to "Updated … ago". Below the list, the pager moves between pages and **Rows per page:** shows 20, 50 or 100 at a time (the pager is hidden in the **Board** view).

## Good to know
- **Create BOM** can show a dialog titled **Processor rate differs at this order quantity**: this order's quantity falls in a different processor rate band than the style was costed at. **Accept order-quantity rates** continues with rates that apply to this order only. It works the same on the Orders list and on the order page.
- If Create BOM says the raw-material cost sheet is waiting for approval, approve the newer cost sheet version first.
- While an order has no size breakdown, size-wise labels appear in **Procurement → Requirements** with the status **Size Split Pending**, planned at the order's full quantity. They cannot go on a purchase order until the sizes are entered. Fabric, greige, processing and most trims can be bought straight away.
