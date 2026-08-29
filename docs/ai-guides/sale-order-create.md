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
  - add item
  - size breakdown
  - buyer po
  - साइज़ ब्रेकडाउन
  - sale order filter
  - sale order search
  - order dhundo
  - ऑर्डर खोजें
  - फ़िल्टर
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/SaleOrderList.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - frontend/src/components/sale-order/SaleOrderForm.tsx
  - frontend/src/components/sale-order/SaleOrderItemsTable.tsx
  - frontend/src/components/sale-order/SaleOrderItemDialog.tsx
  - frontend/src/components/sale-order/SizeBreakdownDialog.tsx
  - frontend/src/services/saleOrder.service.ts
  - backend/src/schemas/saleOrder.schema.ts
  - backend/src/routes/saleOrder.routes.ts
---

## Before you start
A Sale Order sells finished goods that are already in stock, or triggers production for that quantity. It is different from a production order. The customer must exist in Customers and every line's style must exist in Styles. Sale orders can also arrive automatically from the House of Kasya B2B app with items already filled in — check the list before typing a new one.

## Steps
1. Open **Orders & Sales → Sale Orders** in the sidebar. The list shows each order's styles, total quantity in pcs, amount and status. To find an order, use the search box (**Search by SO number, buyer PO or customer...**), the **All Customers** picker, the **All Status** dropdown, or the **Sale date range** calendar.
2. Click **New Sale Order**. A panel titled **New Sale Order** slides in from the right.
3. In **Customer \***, search and pick the customer.
4. Everything else in the header is optional: **Buyer PO Number** (the buyer's own PO reference), **Primary Style** (for single-style orders), **Expected Ship Date**, **Buyer Deadline**, **Order Date**, **Delivery Date**, **Payment Terms**, **Delivery Address**, **Remarks**.
5. In **Items \***, click **Add Item**. In the dialog pick **Style \*** (Color and Size are optional — leave Size as "Size to be decided" if unknown), enter **Quantity \*** and **Unit Price \*** (the price auto-fills from the style's selling price when one is set), then click **Add Single Item**.
6. To split one quantity across sizes, fill Quantity and Unit Price first, then click **Size Breakdown** and enter per-size quantities — one line is added per size.
7. Add more lines the same way. Use the pencil and bin icons on a line to edit or remove it. The **Total Amount** box sums the order.
8. Click **Create Sale Order**. The sale order opens with status **Draft**. While Draft, the **Edit** button on the order page changes details and items.
9. Once the order is ready, click **Confirm**. The dialog shows stock availability and style readiness before you approve it.
10. To ship from stock: on each item row click **Allocate**. In **Allocate Finished Goods Stock**, click an available stock line, set **Quantity to Allocate**, then click **Allocate**.
11. To make the goods instead: click **Start Production**. In the dialog set **Expected Delivery Date**, **Priority**, optional **Remarks**, then click **Create Production Order**. This creates one linked production order for the full sale-order quantity.

## Validation traps
- Customer and at least one item are both required — the **Create Sale Order** button stays disabled until both are there.
- In the Add Item dialog, Style, a quantity above zero and a unit price are required.
- **Confirm** only appears while the order is Draft and has at least one item.
- The delete (bin) icon on the list only works on Draft sale orders.
- **Start Production** only appears when the status is Confirmed or Partially Allocated, items exist, and no live production order is linked already.
- Expected Delivery Date is required in the Start Production dialog. It pre-fills from the buyer deadline or ship date when set.
- Allocation only offers stock matching that exact style, colour and size.

## After saving
The status moves on its own: Draft → Confirmed → Partially/Fully Allocated → Dispatched. There is no way to type or edit the status by hand — it always follows from what actually happened to the items (confirm, allocation, dispatch, delivery). Linked production orders appear in a **Production** card at the top.
