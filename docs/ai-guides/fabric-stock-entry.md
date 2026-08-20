---
slug: fabric-stock-entry
title: Enter Finished Fabric Stock
keywords:
  - fabric stock
  - finished fabric
  - fabric stock entry
  - add stock
  - kapda stock entry
  - dyed fabric stock
  - कपड़ा
  - फैब्रिक
  - स्टॉक एंट्री
  - माल
  - quality grade
  - roll numbers
  - stock type
  - fabric master
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/FabricStockEntry.tsx
  - frontend/src/pages/FabricAvailableStock.tsx
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/fabric-stock.routes.ts
---

**Before you start:** the fabric must already exist in **Materials & Masters → Fabric Master**, with its **Actual Width** filled in.

## Steps

1. Open **Inventory → Fabric Stock** in the sidebar. The page is titled **Finished Fabric Stock**.
2. Press **Add Stock** at the top right. (If the list is empty the button reads **Add First Stock Entry**.) The page **Finished Fabric Stock Entry** opens.
3. In **Select Finished Fabric \*** search by code, name or colour and pick the fabric. This field is required.
4. A **Fabric Details** panel appears with code, name, finish type, colour, actual width and cutable width. Press **Greige Base Details** to expand the greige it was made from.
5. Read the coloured strip below the details. Green means the fabric is **Linked to N style(s)**. Yellow means **Not linked to any style** — stock for unlinked fabric cannot be used for cutting, so link it in **Styles** first if you plan to cut it.
6. Fill **Quantity (meters) \***. Required, must be more than zero.
7. **Width (inches) \*** fills in automatically from the Fabric Master and is read-only. If it is blank or wrong, correct the fabric's actual width in the Fabric Master, or the save will be rejected.
8. Set **Quality Grade \*** — **Grade A (Premium)**, **Grade B (Standard)** or **Defect (Rejected)**. It starts on Grade A.
9. Set **Stock Type** — **Generic Stock**, **Planned Stock**, **Excess Stock**, **Returned Stock** or **Variance/Unused**. It starts on Generic Stock.
10. Fill the optional fields as needed: **Purchase Cost (per meter)**, **Received Date** (today by default), **Warehouse Location**, **Rack Number**, **Roll Numbers**, **Notes**.
11. Press **Save Stock Entry**. On success a green message appears and the screen returns to **Finished Fabric Stock** after a moment.

## Traps to avoid

- The **Save Stock Entry** button stays disabled until both a fabric and a quantity are entered.
- If you pick a fabric that belongs to a specific style, the page jumps straight to that style's own stock entry screen. That is expected — finish the entry there.
- Quantity and width must both be positive numbers; purchase cost cannot be negative. **Notes** is limited to 500 characters.
- **Warehouse Location** defaults to Kashaya Fabs. Change it if the goods went elsewhere. Warehouses marked **(Virtual)** are not physical godowns.
- To book stock directly against a style instead, use **Add Stock Against Style** on the **Finished Fabric Stock** page and pick the style code.
