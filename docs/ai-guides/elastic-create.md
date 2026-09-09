---
slug: elastic-create
title: Add an Elastic (Elastic Master)
keywords:
  - elastic
  - ELA
  - elastic master
  - trim master
  - add elastic
  - new elastic
  - elastic code
  - elastic kaise banaye
  - elastic banana
  - naya elastic
  - lastic
  - elastik
  - इलास्टिक
  - इलास्टिक मास्टर
  - लास्टिक
  - ट्रिम
  - नया इलास्टिक
  - इलास्टिक कैसे बनाये
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
  - frontend/src/types/supplier.types.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/elastic.controller.ts
---

## Before you start
To link a supplier, that supplier must already exist **with category "Trims Supplier"** — other suppliers will not appear in the dropdown.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it sits under the **Fabric & Materials** heading). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Threads & Tapes** choose **New Elastic**.
   (Alternative: open the **Elastic** card on the dashboard and click **+ Add New Elastic** on the **Elastic Management** list.)
3. The form opens with the heading **Create New Elastic**.
4. **Elastic Code** is greyed out and marked **Auto-generated** — the system assigns it on save (ELA-000001, ELA-000002 …). Ignore the sample text in the box; the real prefix is ELA.
5. **Elastic Name**: leave it empty. It is built automatically in this order: Colour, Elastic Type, the word "Elastic", Width ("25mm"), then Composition. If you fill nothing, the name falls back to "Elastic" plus the code. Type a name only to override.
6. Fill the **Elastic Information** fields you know: **Buyer Code**, **Width (mm)**, **Stretch Percent (%)**, **Color**, **Composition**, **Elastic Type**. All are optional.
7. **Color** is chosen from the Color Master dropdown, not typed. If the shade is missing, use the **add a new color** link (opens in a new tab), create it, then come back.
8. **Width (mm)** must be a positive number — enter 25, not "25mm" and not 0.
9. **Stretch Percent (%)** must be a number from 0 to 1000. Enter the number only, without the % sign.
10. **Default Price per Meter (₹)** is optional. It is only the fallback used when a supplier has no price of its own.
11. To add a supplier, go to the **Suppliers** section and click **Add Supplier**, pick the **Supplier** (the only required field in the row), then fill **Price/Meter (₹)** and **Notes** if known. Tick **Preferred Supplier** for the main source (the first row is ticked automatically) and keep **Active** ticked.
12. Trap: a supplier row where no supplier was selected is dropped silently on save. Remove empty rows with the bin icon.
13. Optional: enter the **Supplier Reference Code** under **Reference Codes**.
14. Add any **Description** notes under **Additional Information**.
15. Click **Create Elastic**. You return to the **Elastic Management** list with the new code shown. **Cancel** returns to the list without saving.

Note: unlike Buttons and Zippers, the Elastic form has **no Style Associations section** — elastic cannot be tagged to styles here. Link it through the style's BOM instead. To edit later, open the elastic from the list, click **Edit**, and press **Update Elastic**; the code never changes.
