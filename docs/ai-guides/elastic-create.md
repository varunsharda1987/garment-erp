---
slug: elastic-create
title: Add an Elastic (Elastic Master)
keywords:
  - elastic
  - ELA
  - elastic master
  - trim master
  - elastic kaise banaye
  - naya elastic
  - lastic
  - इलास्टिक
  - लास्टिक
  - ट्रिम
  - नया इलास्टिक
  - stretch
  - width mm
  - elestic
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ElasticList.tsx
  - frontend/src/pages/ElasticForm.tsx
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/elastic.controller.ts
---

## Before you start
To link a supplier, that supplier must already exist **with category "Trims Supplier"** — other suppliers will not appear in the dropdown.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Elastic**.
   (Alternative: open the Elastic list and click **+ Add New Elastic**.)
3. The form opens with the heading **Create New Elastic**.
4. **Elastic Code** is greyed out — the system assigns it on save (ELA-000001, ELA-000002 …). Ignore the sample text in the box; the real prefix is ELA.
5. **Elastic Name**: leave it empty. It is built automatically from Colour, Elastic Type, Width and Composition. Type a name only to override.
6. Fill the **Elastic Information** fields you know: **Buyer Code**, **Width (mm)**, **Stretch Percent (%)**, **Color**, **Composition**, **Elastic Type**. All are optional.
7. **Color** is chosen from the Color Master dropdown, not typed. If the shade is missing, use the **add a new color** link, create it, then come back.
8. **Width (mm)** must be a positive number — enter 25, not "25mm" and not 0.
9. **Stretch Percent (%)** must be a number from 0 to 1000. Enter the number only, without the % sign.
10. **Default Price per Meter** is optional. It is only the fallback used when a supplier has no price of its own.
11. To add a supplier, click **Add Supplier**, pick the **Supplier**, then fill **Price/Meter** and **Notes** if known. Tick **Preferred Supplier** for the main source and keep **Active** ticked.
12. Trap: a supplier row where no supplier was selected is dropped silently on save. Remove empty rows with the bin icon.
13. Optional: enter the **Supplier Reference Code** under **Reference Codes**.
14. Add any **Description** notes.
15. Click **Create Elastic**. You return to the **Elastic Management** list with the new code shown.

Note: unlike Buttons and Zippers, the Elastic form has **no Style Associations section** — elastic cannot be tagged to styles here. Link it through the style's BOM instead. To edit later, open the elastic from the list and press **Update Elastic**; the code never changes.
