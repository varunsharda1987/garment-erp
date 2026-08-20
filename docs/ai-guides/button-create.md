---
slug: button-create
title: Add a Button (Button Master)
keywords:
  - button
  - BTN
  - button master
  - trim master
  - add button
  - button kaise banaye
  - naya button
  - बटन
  - ट्रिम
  - नया बटन
  - बटन कैसे बनाये
  - buton
  - buttton
  - holes
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ButtonList.tsx
  - frontend/src/pages/ButtonForm.tsx
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/button.controller.ts
---

## Before you start
Nothing is mandatory first. But if you want to link a supplier, that supplier must already exist **and be saved with category "Trims Supplier"** — only trims suppliers appear in the dropdown. To link styles, those styles must already exist.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Buttons**.
   (Alternative: open the Buttons list and click **+ Add New Button**.)
3. The form opens with the heading **Create New Button**.
4. **Button Code** is greyed out. Do not type it — the system assigns it on save (BTN-000001, BTN-000002 …).
5. **Button Name**: leave it empty. The name is built automatically from Colour, Material, Holes and Size. Type a name only if you want to override it.
6. Fill in the **Button Information** fields you know: **Size**, **Holes**, **Color**, **Material**, **Shape**. All are optional, but the more you fill, the better the auto name.
7. **Color** is picked from the Color Master list, not typed. If the colour is missing, use the **add a new color** link, create it, then come back.
8. **Holes** must be a whole number between 0 and 10. Half numbers or 12 will be rejected.
9. **Price per Piece** and **Price per Gross** are optional. They cannot be negative.
10. To add a supplier, click **Add Supplier**, then pick the **Supplier** from the dropdown. Fill **Price/Piece**, **Price/Gross** and **Notes** if you have them. Tick **Preferred Supplier** for your main source and keep **Active** ticked.
11. Trap: a supplier row where you did not choose a supplier is dropped silently on save. Remove empty rows with the bin icon.
12. Optional: enter the **Supplier Reference Code** (the supplier's own item code) under **Reference Codes**.
13. Optional: under **Style Associations**, search and select the styles that use this button. The first style you pick is marked primary.
14. Add any **Description** notes.
15. Click **Create Button**. On success you land back on the **Button Management** list with the new code visible.

To change it later, open the button from the list and use **Update Button**. The code can never be changed.
