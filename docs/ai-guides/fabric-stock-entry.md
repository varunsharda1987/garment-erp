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
  - warehouse
  - godown
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
  - गोदाम
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/FabricStockEntry.tsx
  - frontend/src/pages/FabricAvailableStock.tsx
  - frontend/src/components/WarehouseCombobox.tsx
  - backend/src/schemas/fabricStock.schema.ts
  - backend/src/routes/fabric-stock.routes.ts
route: /fabric-stock
---

**Before you start:** the fabric must already exist in **Materials & Masters → Fabric Master**, with its **Actual Width** filled in.

## Steps

1. Open **Inventory → Fabric Stock** in the sidebar. The page is titled **Finished Fabric Stock**.
2. Press **Add Stock** at the top right. (If the list is empty the button reads **Add First Stock Entry**.) The page **Finished Fabric Stock Entry** opens.
3. In **Select Finished Fabric \*** search by code, name or colour and pick the fabric. This field is required.
4. A **Fabric Details** panel appears with code, name, finish type, colour, actual width and cutable width. Press **Greige Base Details** to expand the greige it was made from.
5. Read the coloured strip below the details. Green means the fabric is **Linked to N style(s)**, followed by those styles, each named by its Buyer Style Code first with our Style Code in brackets when different (e.g. SP27DR27 (EBWW-021)); click one to open the style. Yellow means **Not linked to any style** — stock for unlinked fabric cannot be used for cutting, so link it in **Styles** first if you plan to cut it.
6. Fill **Quantity (meters) \***. Required, must be more than zero.
7. **Width (inches) \*** fills in automatically from the Fabric Master and is read-only. If it is blank or wrong, correct the fabric's actual width in the Fabric Master, or the save will be rejected.
8. Set **Quality Grade \*** — **Grade A (Premium)**, **Grade B (Standard)** or **Defect (Rejected)**. It starts on Grade A.
9. Set **Stock Type** — **Generic Stock**, **Planned Stock**, **Excess Stock**, **Returned Stock** or **Variance/Unused**. It starts on Generic Stock.
10. Fill the optional fields as needed: **Purchase Cost (per meter)**, **Received Date** (today by default), **Warehouse Location** (pick from the dropdown), **Rack Number**, **Roll Numbers**, **Notes**.
11. Press **Save Stock Entry**. On success a green message appears and the screen returns to **Finished Fabric Stock** after a moment.

## Traps to avoid

- The **Save Stock Entry** button stays disabled until both a fabric and a quantity are entered.
- If you pick a fabric that belongs to a specific style, the page jumps straight to that style's own stock entry screen. That is expected — finish the entry there.
- Quantity and width must both be positive numbers; purchase cost cannot be negative. **Notes** is limited to 500 characters.
- The lot is booked with the width from the Fabric Master and a cutable width 2" less (the selvedge). If a lot in the list turns out to measure differently, do not re-enter it — click the ruler icon (**Correct width**) on its row (see "Correct a fabric lot's width"). The **Width** column shows the lot's measured width with its own cutable width under it, e.g. **55"** and **(53" cut)**.
- **Warehouse Location** starts empty. It is a searchable dropdown — search by warehouse code, name or city and pick from the list; it cannot be typed in free-form.
- If the warehouse box reads **Could not load — open to retry** (the server was busy for a moment), open it again — the list is fetched afresh. It is never stuck.
- To book stock directly against a style instead, press **Add Stock Against Style** on the **Finished Fabric Stock** page. In **Select Style for Fabric Stock Entry** type the buyer style code or our style code (the list is sorted by buyer style code), pick the style and press **Continue**.
- A lot entered here has no roll or than list — its **Rolls / thans** column reads "No list". To list them, click **Record rolls & thans** on the lot's row (see "Record or check the rolls & thans of a fabric lot"). Fabric received back from a processor than-wise, bale-wise or roll-wise gets its list automatically.
