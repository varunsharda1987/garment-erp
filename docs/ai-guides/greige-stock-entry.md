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
  - backend/src/schemas/stockMovement.schema.ts
---

> **DEPRECATED (2026-08-26):** This page now redirects to **Inventory → Stock In** with Greige pre-selected. Use Stock In for all greige entries — it supports the same fields (fold length, than count, roll numbers, received date, invoice date) plus multi-item receipts.

## New workflow

1. Open **Inventory → Stock In** in the sidebar.
2. Select your **Supplier** (choose a Greige Supplier).
3. Pick the **Warehouse** where the greige is stored.
4. Set **Received Date** if backdating (leave blank for today).
5. Enter **Invoice Number** and **Invoice Date** from the supplier bill.
6. Under **Material Type**, select **Greige Fabric**.
7. Search and pick the greige.
8. Enter **Quantity**, **Than Count**, **Fold Length (L)**, and **Roll Numbers** as needed.
9. Click **Save Stock In**.

See **Receive Greige Without a Purchase Order** for the full guide.
