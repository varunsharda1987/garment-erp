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
  - size breakdown
  - size split
  - size split pending
  - add size breakdown
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
  - frontend/src/types/order.types.ts
  - frontend/src/types/mrp.types.ts
---

## Steps
1. Open **Orders & Sales → Orders** in the sidebar.
2. Search by order number or customer name in the search box, or narrow the list with the **All Customers**, **All Status** and **All Priorities** dropdowns. Status values are Pending, In Production, Completed, Dispatched, Cancelled and Split. **Split** means the order was divided into child production runs — open the children to follow the work.
3. Click the order number (or the **View** button) to open **Order Details**.
4. The top card shows the status and priority badges, Customer, Order Date, Expected Delivery, Total Quantity, Total Amount and Payment Terms. "Pricing Pending" means no unit price was entered yet.
5. Below it is the pipeline strip: **Order → BOM → MRP → PO → GRN → Processing → Production → Dispatch**. Each step is marked done, in progress or blocked, and carries a button that takes you to that stage (for example **Create BOM** or **View MRP**).
6. **Order Procurement Summary** shows how many material requirements exist and how many still need a PO. Click **View** to open them.
7. **Order Items** shows each style with its **Quantity Breakup** table (Color, Size, Quantity). If the order was created without sizes, the item shows **Size breakdown not specified** and an **Add Size Breakdown** button instead — see *Enter the sizes later* below.
8. **Order BOM** shows the BOM version and status; **View Details** opens it.
9. **Production Runs** lists each work order with a progress bar and pieces completed.
10. **Billing & Dispatch** lists Invoices and Delivery Notes for the order. Click one to open it.

## Enter the sizes later
Orders are often started with the total quantity only so long-lead greige, dyeing and printing can be procured first. Enter the sizes from the order page — not from **Edit Order**, where the size grid is disabled once the order has approved BOMs or active material requirements.

1. Open the order and scroll to **Order Items**.
2. On the item showing **Size breakdown not specified**, click **Add Size Breakdown**.
3. In the **Add Size Breakdown** dialog, click **Distribute [N] evenly** (the button carries the item's total) or type the pieces into the box under each size name. The description explains that entering sizes generates per-size label requirements and lets production work orders be created.
4. Check the **Entered: X / Y pcs** counter, then click **Save Size Breakdown**.
5. If the sizes add up to a different total, the save is refused once and an alert explains the difference. The button then reads **Confirm & change quantity to [N]**. Clicking it saves the sizes and updates the order quantity.

Saving refreshes the order's material requirements and creates the production work orders, which cannot exist while the order has no sizes. A success message summarises what happened.

## Factory-wide view
For all running orders at once, open **Production Status** at the top of the sidebar. The **Production Status Dashboard** has a **By Order** / **By Style** toggle, search and filters, and a **Refresh** button showing when the data was last updated.

## Good to know
- The order status updates on its own as work moves through the pipeline. There is no manual status dropdown on the order page.
- Clicking **Create BOM** can show a dialog titled **Processor rate differs at this order quantity**. It means this order's quantity falls in a different processor rate band than the style was costed at. **Accept order-quantity rates** continues with rates that apply to this order only.
- If an **SO ...** chip sits next to the order number, that order came from a sale order — click the chip to open it.
- **Create Work Orders** on the order page creates any missing production runs. **Edit Order** reopens the order form.
- While an order has no size breakdown, size-wise labels still appear in **Procurement → Requirements** with the status **Size Split Pending**, planned at the order's full quantity. They cannot be put on a purchase order until the sizes are entered. Labels without size variants, and size-independent materials such as fabric, greige, processing and most trims, are unaffected and can be procured straight away.
