---
slug: greige-stock-entry
title: Enter Greige Stock
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
  - frontend/src/pages/GreigeAvailableStock.tsx
  - frontend/src/services/style-stock.service.ts
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/greige-stock.routes.ts
---

**Before you start:** the greige must already exist in **Materials & Masters → Greige Master**. If it is not there, create it first. Only Admin and Inventory users can save this entry.

## Steps

1. Open **Inventory → Greige Stock** in the sidebar. The page is titled **Generic Greige Stock**.
2. Press **Add Greige Stock** at the top right. (If the list is empty the button reads **Add First Greige Stock**.) The page **Generic Greige Stock Entry** opens.
3. In **Select Greige Fabric \*** type the greige code, name or composition and pick it from the list. This field is required.
4. A **Greige Details** panel appears showing code, composition, yarn count, construction, weave, width, greige quality and weaver. Check it is the right greige before continuing.
5. Fill **Quantity (meters) \***. This is required and must be more than zero.
6. **Width (inches)** fills in automatically from the Greige Master and cannot be typed over. If it is wrong, fix the width in the Greige Master first.
7. Fill the optional fields as needed: **Purchase Cost (per meter)**, **Received Date** (today by default), **Invoice Number**, **Invoice Date**, **Supplier**, **Warehouse Location**, **Roll Numbers (comma-separated)**.
8. If the cloth is folded short, enter **Fold Length (L)** in cm and **Than Count**. Fold length must be between 1 and 100. When L is less than 100 the system shows **Nominal Quantity**, **Fold Length** and **Actual Quantity** — actual meters = nominal × L ÷ 100.
9. Press **Review & Save**. A **Confirm Stock Entry** dialog opens listing everything you entered.
10. Check the dialog, then press **Confirm & Save**. Press **Go Back** if something is wrong.
11. On success a green message appears and the screen returns to **Generic Greige Stock** after a moment.

## Traps to avoid

- Leaving **Quantity** blank or zero shows "Please enter a valid quantity" and nothing is saved.
- Not choosing a greige shows "Please select a greige fabric".
- The **Supplier** dropdown only lists suppliers whose category is Greige Supplier. If your supplier is missing, fix its category in **Materials & Masters → Suppliers**.
- Purchase cost cannot be negative.
- This entry creates *generic* greige — it is not tied to any style and can be allocated to any future order.
