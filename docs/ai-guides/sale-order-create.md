---
slug: sale-order-create
title: Create a Sale Order (Sell from Stock)
keywords:
  - sale order
  - SO
  - sell from stock
  - stock sale
  - sale order kaise banaye
  - naya sale order
  - सेल ऑर्डर
  - बिक्री
  - ऑर्डर
  - स्टॉक
  - ग्राहक
  - finished goods
  - fg stock
  - allocate stock
  - b2b
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/SaleOrderList.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - frontend/src/services/saleOrder.service.ts
  - backend/src/schemas/saleOrder.schema.ts
  - backend/src/routes/saleOrder.routes.ts
---

## Before you start
A Sale Order sells finished goods that are already in stock (or triggers production for that quantity). It is different from a production order. The customer must exist in Customers. Most sale orders that already contain item lines arrive automatically from the House of Kasya B2B app — check the list before typing a new one.

## Steps
1. Open **Orders & Sales → Sale Orders** in the sidebar.
2. Click **New Sale Order**. A dialog titled **New Sale Order** opens.
3. In **Customer \***, type at least two letters, then click the customer in the list that drops down.
4. **Expected Ship Date** and **Remarks** are optional.
5. Click **Create Sale Order**. The sale order opens with status **Draft**.
6. Item lines (style, colour, size, quantity) cannot be typed on this screen. They come from the B2B app against the same sale order. A Draft with no items shows **No items yet** and cannot be confirmed.
7. Once items are there, click **Confirm**. The dialog shows stock availability and style readiness before you approve it.
8. To ship from stock: on each item row click **Allocate**. In **Allocate Finished Goods Stock**, click an available stock line, set **Quantity to Allocate**, then click **Allocate**.
9. To make the goods instead: click **Start Production**. In the dialog set **Expected Delivery Date**, **Priority**, optional **Remarks**, then click **Create Production Order**. This creates one linked production order for the full sale-order quantity.

## Validation traps
- Customer is required. Without it you get "Please select a customer".
- **Confirm** only appears while the order is Draft and has at least one item.
- The delete (bin) icon on the list only works on Draft sale orders.
- **Start Production** only appears when the status is Confirmed or Partially Allocated, items exist, and no live production order is linked already.
- Expected Delivery Date is required in the Start Production dialog.
- Allocation only offers stock matching that exact style, colour and size.

## After saving
The status moves on its own: Draft → Confirmed → Partially/Fully Allocated → Dispatched. The linked production order appears in a **Production** card at the top.
