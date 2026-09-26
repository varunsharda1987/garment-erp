---
slug: order-track-status
title: Check the Status of an Order
keywords:
  - order status
  - track order
  - order progress
  - order kahan pahuncha
  - order status kaise dekhe
  - ऑर्डर
  - स्टेटस
  - ट्रैक
  - प्रोडक्शन
  - डिलीवरी
  - production status
  - work order progress
  - pending order
  - dispatched
  - production workflow
  - workflow tracker
  - order pipeline
  - वर्कफ़्लो
  - view POs
  - POs for this order
  - which POs for this order
  - purchase orders of an order
  - order ke PO
  - order ke PO kaise dekhe
  - is order ke kitne PO bane
  - PO kitne bane
  - ऑर्डर के पीओ
  - पीओ देखना
  - पर्चेज़ ऑर्डर
  - size breakdown
  - size split
  - size split pending
  - add size breakdown
  - edit size breakdown
  - saiz
  - saiz kaise dale
  - साइज़
  - साइज़ ब्रेकडाउन
  - साइज़ पेंडिंग
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/OrderList.tsx
  - frontend/src/pages/OrderDetail.tsx
  - frontend/src/pages/OrderForm.tsx
  - frontend/src/components/orders/SizeBreakupDialog.tsx
  - frontend/src/pages/ProductionStatus.tsx
  - frontend/src/components/OrderWorkflowTracker.tsx
  - frontend/src/pages/PurchaseOrderList.tsx
  - frontend/src/types/order.types.ts
  - frontend/src/types/mrp.types.ts
  - backend/src/services/purchaseOrder.service.ts
route: /orders
---

## Steps
1. Open **Orders & Sales → Orders** in the sidebar.
2. Search by order number, customer, style code, buyer style code, or the sale order / buyer PO it came from, or narrow the list with the **All Customers**, **All Status** and **All Priorities** dropdowns. Typing several words narrows the list — each word must match something, so a customer name and a style code together find exactly that order. Status values are Pending, In Production, Completed, Dispatched, Cancelled and Split. **Split** means the order was divided into child production runs — open the children to follow the work.
3. Click the order number (or the **View** button) to open **Order Details**.
4. The top card shows the status and priority badges, Customer, Order Date, Expected Delivery, Total Quantity, Total Amount and Payment Terms. "Pricing Pending" means no unit price was entered yet. Shipping Address and Remarks show underneath when they were filled in.
5. The **Production Workflow** card shows the pipeline **Order → BOM → MRP → PO → GRN → Processing → Production → Dispatch** with a badge "N of 8 steps completed". Each step is marked done, in progress, not started or waiting, with a short note under its name (for example "v2 Locked" or "Waiting for MRP"). A step that is still waiting for the one before it has no button. What each button does is under *Production Workflow buttons* below.
6. **Order Procurement Summary** has two boxes. **Materials (MRP)** counts Total, Pending PO, PO Generated and With Shortfall. **Services** counts Total, Pending, JWO Created and Completed. Each box has a **View** button that opens the requirements for this order.
7. **Order Items** shows each style with its **Quantity Breakup** table (Color, Size, Quantity) and an **Edit Size Breakdown** button. If the order was created without sizes, the item shows **Size breakdown not specified** and an **Add Size Breakdown** button instead — see *Enter the sizes later* below.
8. **Order BOM** shows the BOM version and status; **View Details** opens it.
9. **Production Runs** lists each work order with its status, Location, Quantity (done / total pcs), Planned Start, Planned End and a progress bar. **View** opens the run. **Split** appears on a Pending run of more than one piece.
10. **Billing & Dispatch** lists Invoices and Delivery Notes for the order. Click one to open it.

## Production Workflow buttons
- **BOM** — **Create** when the order has no Order BOM yet: it builds the BOM from the style's approved cost sheet and you stay on the order page. **Review** (draft BOM) and **Lock** (approved BOM) open the Order BOM page, where you approve and lock it.
- **MRP** — waits until the BOM is locked. **Calculate** works out the material requirements and opens **Requirements** filtered to this order. After that the step shows the number of items; a **View** button appears while some are short.
- **PO** — waits until MRP has run. Then it shows one of these:
  - "N need PO" with **Generate** — opens Requirements for this order, where you make the POs.
  - "N need a decision (extra quantity)" with **Decide** — a new BOM version needs more than was already ordered. Opens Requirements for this order to choose **Order the extra** or **Don't order more**.
  - "N awaiting size breakdown" with **View** — size-wise labels wait for the sizes (see *Enter the sizes later*).
  - "N created" with **View** — nothing is left to order and the order has N purchase orders.
  - "In stock" with no button — nothing is left to order and no purchase order was needed.
- **GRN** — waits until the PO step is done. **View** opens the GRN list.
- **Processing** — shows "Not required" once the goods are received.
- **Production** — **Start** (no work orders yet) and **View** open the Production Runs list. To create missing runs use **Create Work Orders** at the top of the order page.
- **Dispatch** — **Create DN** once production is complete, then **View**.

## See the purchase orders of an order
1. Open the order. On the **Production Workflow** card, the **PO** step reads "N created".
2. Click **View** under it. **Purchase Orders** opens showing only this order's POs, with a chip **Order: [order number]** beside the filters.
3. The list includes the POs made from this order's requirements on the Requirements page as well as POs linked to the order directly. The count on the PO step counts both.
4. To see every PO again, click the **×** on the **Order:** chip, or click **Clear**.

If the PO step still reads "N need PO", "need a decision" or "awaiting size breakdown", there is no **View** button for POs yet — its button opens Requirements instead. You can always open **Procurement → Purchase Orders** and search for the style or material.

## Enter the sizes later
Orders are often started with the total quantity only so long-lead greige, dyeing and printing can be procured first. Enter the sizes from the order page — not from **Edit Order**, where the style, quantity and size grid are disabled once the order has approved BOMs or active material requirements.

1. Open the order and scroll to **Order Items**.
2. On the item showing **Size breakdown not specified**, click **Add Size Breakdown**.
3. In the **Add Size Breakdown** dialog, click **Distribute [N] evenly** (the button carries the item's total) or type the pieces into the box under each size name.
4. Pick the **Colour \*** for these sizes. It is filled in and locked when the style has only one colour.
5. Check the **Entered: X / Y pcs** counter, then click **Save Size Breakdown**.
6. If the sizes add up to a different total, the save is refused once and an alert explains the difference. The button then reads **Confirm & change quantity to [N]**. Clicking it saves the sizes and updates the order quantity.

Saving refreshes the order's material requirements and creates the production work orders, which cannot exist while the order has no sizes. A success message summarises what happened.

- **Save Size Breakdown** stays disabled until a colour is chosen. If the dialog says **This style has no colour yet**, set the style's Primary Color first.
- **This style has no sizes defined** means the sizes must be added to the style first.
- To change sizes already saved, click **Edit Size Breakdown** above the **Quantity Breakup** table. The dialog opens titled **Edit Size Breakdown** with the saved quantities and colour filled in.

## Factory-wide view
For all running orders at once, open **Production Status** at the top of the sidebar. The **Production Status Dashboard** has a **By Order** / **By Style** toggle, search and filters, and a **Refresh** button showing when the data was last updated.

## Good to know
- The order status updates on its own as work moves through the pipeline. There is no manual status dropdown on the order page.
- **Create BOM** on the **Orders** list can show a dialog titled **Processor rate differs at this order quantity**. It means this order's quantity falls in a different processor rate band than the style was costed at. **Accept order-quantity rates** continues with rates that apply to this order only. The **Create** button on the order page's BOM step does not offer this dialog — it only shows the error. Use **Create BOM** on the order's row in the Orders list instead.
- If an **SO ...** chip sits next to the order number, that order came from a sale order — click the chip to open it.
- **Create Work Orders** on the order page creates any missing production runs ("Nothing to create" means every item already has one). **Edit Order** reopens the order form.
- While an order has no size breakdown, size-wise labels still appear in **Procurement → Requirements** with the status **Size Split Pending**, planned at the order's full quantity. They cannot be put on a purchase order until the sizes are entered. Labels without size variants, and size-independent materials such as fabric, greige, processing and most trims, are unaffected and can be procured straight away.
