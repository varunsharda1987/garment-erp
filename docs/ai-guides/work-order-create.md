---
slug: work-order-create
title: Create a Work Order (Production Run)
keywords:
  - run not linked to order
  - order se link
  - ऑर्डर से लिंक
  - duplicate production run
  - do run ban gaye
  - work order
  - WO
  - production run
  - create work order
  - work order kaise banaye
  - production run banana
  - वर्क ऑर्डर
  - प्रोडक्शन रन
  - उत्पादन
  - बनाना
  - size breakup
  - colour size breakup
  - color size breakup
  - order quantity
  - split production run
  - split run
  - run split karna
  - रन स्प्लिट
  - edit production run
  - production location
  - location
  - production kahan hoga
  - location badalna
  - प्रोडक्शन लोकेशन
  - लोकेशन
  - create production run from order
  - ready to cut
  - order se production run banana
  - run kaise banaye order se
  - ऑर्डर से प्रोडक्शन रन
  - कटिंग के लिए तैयार
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
sources:
  - frontend/src/services/order.service.ts
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/WorkOrderCreate.tsx
  - frontend/src/pages/WorkOrderList.tsx
  - frontend/src/pages/WorkOrderForm.tsx
  - frontend/src/pages/WorkOrderDetail.tsx
  - frontend/src/components/StyleCombobox.tsx
  - frontend/src/lib/style-code.ts
  - frontend/src/components/SplitProductionModal.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - frontend/src/pages/OrderDetail.tsx
  - backend/src/controllers/order.controller.ts
  - backend/src/services/helpers/order-status.helper.ts
  - backend/src/schemas/workOrder.schema.ts
  - backend/src/routes/workOrder.routes.ts
  - backend/src/services/workOrder.service.ts
  - backend/src/services/helpers/material-sync.helper.ts
  - backend/src/services/productionBlockingValidation.service.ts
  - backend/src/services/saleOrder.service.ts
  - backend/src/services/helpers/sku-colour.helper.ts
route: /production/work-orders/new
---

Note: in this ERP a work order is shown as a **Production Run**. Both words mean the same thing.

## Before you start
The style must already exist, be published (draft styles are not listed), and have its sizes (variants) configured. The colour and size dropdowns are filled from the style's variants; a colour is optional. If the style has no variants, no sizes will appear and you cannot save.

## Steps
1. Open **Manufacturing → Production Runs** in the sidebar.
2. Click **Create Work Order** at the top right.
3. Under **Style Selection**, click the **Style** box (**Select a style...**) and type part of the Buyer Style Code, our Style Code, the style name or the customer. Each style is listed as Buyer Style Code, our Style Code in brackets when it is different, then name and customer — for example `SP27DR27 (EBWW-021) - GEMINI (Easybuy)` — in Buyer Style Code order. Every published style can be found this way — when the box says "Showing N of M", keep typing to narrow it. Pick one. This field is required. The grey box under it then shows the style's **Buyer Style Code**, **Style Code** and **Name**.
   If the style has an order still waiting for its production run, a note says so with a button per order (order number, customer, pieces). A run made on this page is **not linked** to that order — the order keeps saying "no production run" and its BOM, requirements and dispatch never meet this run. Click the order's button and use **Create Production Run** there instead. Carry on here only for a run no order asked for, such as stock.
4. Under **Planning Details**, set **Planned Start Date** and **Planned End Date**. Both are required, and the end date cannot be before the start date. Today's date and a date one week later are filled in for you.
5. Choose **Priority**: **Low**, **Medium**, **High** or **Urgent**. Medium is the default.
6. Type notes in **Remarks** if needed. This is optional, maximum 1000 characters.
7. Under **Quantity Breakup**, fill one row per colour and size:
   - **Color (optional)** — pick a colour, or leave **Any / N/A**.
   - **Size** — required.
   - **Qty** — required, must be a whole number greater than zero.
8. Click **Add Row** for each extra colour/size line. Use the bin icon to delete a row.
9. Check the **Total** shown in the Quantity Breakup heading. This total is the work order quantity.
10. Click **Create Work Order**. You land on the new production run page.

There is no location field on this page. Every new production run, including one started from a sale order, gets the company's own unit (**Kashaya Fabs**) as its **Production Location** automatically. You can see it in the **Production Location** card on the run page and the **Location** column of the list. If a run is made somewhere else, change it with **Edit** (see below).

## Traps to avoid
- The **Create Work Order** button stays greyed out until a style is picked and the total is more than zero. One click makes one run — clicking again while it saves does nothing.
- Rows with no size, or with quantity zero, are dropped silently. Add at least one complete row.
- Each colour and size combination may appear on only one row. If the same colour and size are on two rows, the page says it is entered twice — put its whole quantity on one row.
- Quantities must be whole numbers. Decimals are rejected.
- The system requires the header total to equal the sum of all breakup rows. The page adds them for you, so do not edit quantities in another tab while saving.
- If you see "No sizes found for this style", fix the style's variants first.

## Other ways in
From a production order: open **Orders & Sales → Orders** and open the order. When a style has nothing left blocking it, the **What's stopping it** card shows **Ready to cut — plan the production run.** with **Create Production Run**. The **Production** card also shows **Create Production Run** at the top while a style with sizes has no run yet. It makes one run per order line from the order's own sizes, planned from today to the order's delivery date; you can change the dates afterwards with **Edit** on the run. "Nothing to create" means every order line already has a run. A line with no size breakdown gets no run — click **Add Size Breakdown** on the order page first (saving the sizes creates the run too).

From a sale order, open **Orders & Sales → Sale Orders**, open the order, open **Actions** and click **Start Production**. If a production order for that style was raised earlier and is not linked to a sale order, **Link to Production Order** appears instead — linking copies the sale order's sizes onto it and creates its production run. That creates the production run for you — by default only for the pieces finished-goods stock does not already cover (choose **Full sale-order quantity** in the dialog to make everything). The order must be Confirmed, every line must have a size and each style needs an approved cost sheet. Colour is optional: a line with no colour takes the style's colour when the style has exactly one, and is made with no colour when the style has none; only a style with several colours must have the colour chosen on each sale-order line. Otherwise the button explains exactly what is missing. If an administrator later changes the sale order's **Expected Ship Date** (sale order **Actions → Change Dates**), the production order's delivery date and the planned end of its unfinished runs move to the new date; finished runs keep theirs.

## After creating
Open the run and use **Push to Cutting** when materials are ready.

A run made for a production order moves that order's status by itself: the order turns **In Production** once a run has started, **Completed** once all its runs are completed and cover the order quantity, and **Dispatched** once everything has shipped. Nobody sets an order's status by hand.

Only runs still in **Pending** status can be changed:
- **Edit** lets you change **Production Location**, **Priority**, the planned dates and **Remarks**. Clearing Production Location or Remarks and saving removes them. Quantities cannot be edited here.
- **Split Run** moves part of the quantity to a new production run. Enter quantities under **Select Quantities to Split**, set **Planned Dispatch Date for New Run** (it cannot be before the run's planned start), and click **Split Production Run**. Some quantity must stay in the original run. Once a run has been pushed to cutting, Split Run is no longer offered.

**Push to Cutting** checks, before it does anything: the style has an **approved Size Set Sample** (which needs an approved PP Sample, which needs an approved FIT Sample — Manufacturing → Sample Tracking); the style has an **approved Production CAD** with a CAD Average (Pre-Production → CAD Planning → **Create CAD** on the received lot, then row menu → **Approve** — a pending or rejected one does not count); and, for a run made from an order, the Order BOM is approved and its fabric is in stock (fabric already issued to Cutting for this order's runs of the style counts too). The message names whichever is missing — for example "No Size Set Sample exists for this style". When the buyer has fabric testing set to block production, the style's latest fabric test must also be a pass (record fabric results on **Manufacturing → Testing (FPT/GPT) → Fabric Physical Tests**).

Later, moving a run to **Ready to Ship** — and dispatching its goods — waits for the style's **Shipment Sample** to be approved and the latest lab round on the style's samples to have passed, but only for a buyer with **Blocks Dispatch** ticked for Shipment Sample on their Sample Requirements.

For the fabric check, a BOM line that names a greige (the usual case — the finished fabric does not exist when the BOM is made) is answered by the dyed or printed fabric made **from that greige** that was received for this style through the job's **Receive from processor** action, or that has been allocated to the style in Fabric Master (**Allocate to Style**). Another style's fabric from the same greige does not count. If nothing matches, the message says "no finished fabric made from this greige has been received for this style yet" — receive the job-work return first, or allocate the fabric to the style. Fabric lying at a processor's unit (delivered straight to a dyer, not yet back) does not count: it is not in our store to cut.

Only an **administrator** can override these checks: when materials are short, an admin sees the **Admin Override Required** dialog and must type an **Override Reason** of at least 10 characters; the override is recorded under **Admin → Override History**. Anyone else gets a message saying only an administrator can override — fix what is missing, or ask an admin.
