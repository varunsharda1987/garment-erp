---
slug: work-order-create
title: Create a Work Order (Production Run)
keywords:
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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/WorkOrderCreate.tsx
  - frontend/src/pages/WorkOrderList.tsx
  - frontend/src/pages/WorkOrderForm.tsx
  - frontend/src/pages/WorkOrderDetail.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - backend/src/schemas/workOrder.schema.ts
  - backend/src/routes/workOrder.routes.ts
---

Note: in this ERP a work order is shown as a **Production Run**. Both words mean the same thing.

## Before you start
The style must already exist and must have variants (colours and sizes) configured. The colour and size dropdowns are filled from the style's variants. If the style has no variants, no sizes will appear and you cannot save.

## Steps
1. Open **Manufacturing → Production Runs** in the sidebar.
2. Click **Create Work Order** at the top right.
3. Under **Style Selection**, click the **Style** box and search by style code, buyer reference or style name. Pick one. This field is required.
4. Under **Planning Details**, set **Planned Start Date** and **Planned End Date**. Both are required. Today's date and a date one week later are filled in for you.
5. Choose **Priority**: **Low**, **Medium**, **High** or **Urgent**. Medium is the default.
6. Type notes in **Remarks** if needed. This is optional, maximum 1000 characters.
7. Under **Quantity Breakup**, fill one row per colour and size:
   - **Color (optional)** — pick a colour, or leave **Any / N/A**.
   - **Size** — required.
   - **Qty** — required, must be a whole number greater than zero.
8. Click **Add Row** for each extra colour/size line. Use the bin icon to delete a row.
9. Check the **Total** shown in the Quantity Breakup heading. This total is the work order quantity.
10. Click **Create Work Order**. You land on the new production run page.

## Traps to avoid
- The **Create Work Order** button stays greyed out until a style is picked and the total is more than zero.
- Rows with no size, or with quantity zero, are dropped silently. Add at least one complete row.
- Quantities must be whole numbers. Decimals are rejected.
- The system requires the header total to equal the sum of all breakup rows. The page adds them for you, so do not edit quantities in another tab while saving.
- If you see "No sizes found for this style", fix the style's variants first.

## Other way in
From a sale order, open **Orders & Sales → Sale Orders**, open the order and click **Start Production**. That creates the production run for you.

## After creating
Open the run and use **Push to Cutting** when materials are ready. Only runs still in **Pending** status can be edited with **Edit**.
