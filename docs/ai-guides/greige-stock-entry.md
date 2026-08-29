---
slug: greige-stock-entry
title: Enter Greige Stock (DEPRECATED — use Stock In)
keywords:
  - greige stock
  - greage stock
  - grey fabric entry
  - greige stock entry
  - kora kapda
  - than entry
  - fold length
  - stock in receipt
  - fresh stock
  - ग्रेज
  - कोरा कपड़ा
  - स्टॉक एंट्री
  - थान
  - माल
  - add greige stock
  - greige master
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/GreigeStockEntry.tsx
  - frontend/src/pages/StockInForm.tsx
  - frontend/src/pages/StockMovementList.tsx
  - backend/src/schemas/stockMovement.schema.ts
---

> **DEPRECATED:** This page now redirects to **Stock IN (Receipt)** with Greige pre-selected. Use Stock In for all greige entries — it supports the same fields (fold length, than count, roll numbers, received date, invoice date) plus multi-item receipts.

## New workflow

1. Press **Ctrl+K** and search **Stock In**, or open **Inventory → Material Movements**, click **New Movement** and choose **Stock IN (Receipt)**.
2. Keep **Source Type** as **Fresh Stock**.
3. In **Step 1: Select Supplier**, search and pick your supplier (choose a Greige Supplier).
4. In **Step 2: Warehouse & Reference**, pick the **Warehouse**. Fill **Challan/DC Number** or **Supplier Invoice**, set **Received Date** if backdating (leave blank for today), and **Invoice Date** from the supplier bill.
5. In **Step 3: Add Items**, pick **Greige Fabric** as the Material Type if the type tiles are shown. A greige-only supplier selects it automatically.
6. Search and pick the greige, then enter **Quantity** and **Unit** (usually Meter).
7. Optional per item: **Rate (₹)**, **Lot/Batch Number**, **Than Count**, **Fold Length (cm)** and **Roll Numbers** (comma-separated).
8. Click **Create Stock IN**.

See **Receive Greige Without a Purchase Order** for the full guide.
