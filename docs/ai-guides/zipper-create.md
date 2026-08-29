---
slug: zipper-create
title: Add a Zipper (Zipper Master)
keywords:
  - zipper
  - ZIP
  - zipper master
  - chain
  - trim master
  - zip kaise banaye
  - naya zipper
  - जिप
  - ज़िप
  - चेन
  - ट्रिम
  - नया ज़िपर
  - zippper
  - ykk
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ZipperList.tsx
  - frontend/src/pages/ZipperForm.tsx
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/zipper.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
To link a supplier, that supplier must already exist **with category "Trims Supplier"** — other suppliers do not show in the dropdown. To link styles, those styles must already exist.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Zippers**.
   (Alternative: open the Zippers list and click **+ Add New Zipper**.)
3. The form opens with the heading **Create New Zipper**.
4. **Zipper Code** is greyed out — the system assigns it on save (ZIP-0001, ZIP-0002 …). Never type it.
5. **Zipper Name**: leave it empty. It is built automatically from Colour, Teeth Type, Length and Brand. Type a name only to override.
6. Fill the **Zipper Information** fields you know: **Buyer Code**, **Length (inches)**, **Teeth Type**, **Color**, **Brand**, **Slider Type**, **Tape Width (mm)**. All are optional.
7. **Color** is chosen from the Color Master dropdown, not typed. If the shade is missing, use the **add a new color** link, create it, then return.
8. **Length (inches)** must be a positive number — 0 or a minus value is rejected. **Tape Width (mm)** must be a number, not text like "25 mm".
9. **Default Price per Piece** is optional. It is only the fallback used when a supplier has no price of its own.
10. To add a supplier, click **Add Supplier**, pick the **Supplier**, and fill **Price/Piece** and **Notes** if known. Tick **Preferred Supplier** for the main source and keep **Active** ticked.
11. Trap: you cannot add the same supplier twice — save fails with "Duplicate suppliers are not allowed". Also, a supplier row with no supplier selected is dropped silently; delete empty rows with the bin icon.
12. Optional: enter **Supplier Reference Code** under **Reference Codes**.
13. Optional: under **Style Associations**, search and select the styles that use this zipper.
14. Add any **Description** notes.
15. Click **Create Zipper**. You return to the **Zipper Management** list with the new code shown.

To edit later, open the zipper from the list and press **Update Zipper**. The zipper code never changes.
