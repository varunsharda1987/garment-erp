---
slug: button-create
title: Add a Button (Button Master)
keywords:
  - button
  - BTN
  - button master
  - trim master
  - add button
  - new button
  - button code
  - button kaise banaye
  - button banana
  - naya button
  - बटन
  - बटन मास्टर
  - ट्रिम
  - नया बटन
  - बटन कैसे बनाये
  - बटन जोड़ें
  - buton
  - buttton
  - holes
  - button supplier
  - add supplier
  - supplier row
  - supplier price
  - Invalid request data
  - supplier nahi jud raha
  - button me supplier kaise jode
  - बटन सप्लायर
  - सप्लायर जोड़ें
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ButtonList.tsx
  - frontend/src/pages/ButtonForm.tsx
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/types/supplier.types.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/schemas/common.schema.ts
  - backend/src/controllers/button.controller.ts
---

## Before you start
Nothing is mandatory first. But if you want to link a supplier, that supplier must already exist **and be saved with category "Trims Supplier"** — only trims suppliers appear in the dropdown. To link styles, those styles must already exist.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it sits under the **Fabric & Materials** heading). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Buttons**.
   (Alternative: open the **Buttons** card on the dashboard and click **+ Add New Button** on the **Button Management** list.)
3. The form opens with the heading **Create New Button**.
4. **Button Code** is greyed out and marked **Auto-generated**. Do not type it — the system assigns it on save (BTN-000001, BTN-000002 …).
5. **Button Name**: leave it empty. The name is built automatically in this order: Colour, Material, Holes ("4-Hole"), the word "Button", then Size. If you fill nothing, the name falls back to "Button" plus the code. Type a name only if you want to override it.
6. Fill in the **Button Information** fields you know: **Size**, **Holes**, **Color**, **Material**, **Shape**. All are optional, but the more you fill, the better the auto name.
7. **Color** is picked from the Color Master list, not typed. If the colour is missing, use the **add a new color** link (opens in a new tab), create it, then come back.
8. **Holes** must be a whole number between 0 and 10. Half numbers or 12 will be rejected.
9. **Price per Piece (₹)** and **Price per Gross (₹)** are optional. They cannot be negative.
10. To add a supplier, go to the **Suppliers** section and click **Add Supplier**. Each row has: **Supplier** (dropdown — the only required field in the row), **Price/Piece (₹)**, **Price/Gross (₹)**, the tick boxes **Preferred Supplier** and **Active**, and **Notes**. Pick the supplier, then fill the prices and notes if you have them. Tick **Preferred Supplier** for your main source (the first row is ticked automatically) and keep **Active** ticked.
11. You may leave a supplier's price boxes empty — the row still saves, and the supplier is simply stored without a price. A typed price saves as entered. Add more rows with **Add Supplier** for each extra source.
12. Trap: a supplier row where you did not choose a supplier is dropped silently on save. Remove empty rows with the bin icon.
13. Optional: enter the **Supplier Reference Code** (the supplier's own item code) under **Reference Codes**.
14. Optional: under **Style Associations**, use **Associated Styles** to search and select the styles that use this button. The first style you pick is marked primary.
15. Add any **Description** notes under **Additional Information**.
16. Click **Create Button**. On success you land back on the **Button Management** list with the new code visible. **Cancel** returns to the list without saving.

To change it later, open the button from the list, click **Edit**, and use **Update Button**. The code can never be changed. On edit, the name keeps rebuilding itself from the attributes until you type your own.
