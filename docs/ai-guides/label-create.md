---
slug: label-create
title: Add a Label, Hangtag or Price Tag (Label Master)
keywords:
  - label
  - LBL
  - label master
  - hangtag
  - price tag
  - care label
  - washcare
  - size label
  - main label
  - label kaise banaye
  - naya label
  - लेबल
  - हैंगटैग
  - वॉशकेयर
  - टैग
  - lable
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/pages/LabelList.tsx
  - frontend/src/pages/LabelForm.tsx
  - frontend/src/types/label.types.ts
  - backend/src/controllers/masterDataDashboard.controller.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/label.controller.ts
---

## Before you start
Labels are NOT under Trims Dashboard — they live under Packaging. To link a supplier, that supplier must exist **with category "Trims Supplier"**. To auto-create size-wise labels, the Size Category must already exist.

## Steps
1. Open **Materials & Masters → All Masters** in the sidebar (under the **Configuration** heading — expand it if collapsed).
2. In the **Packaging & Labels** section, click **Labels**. The page opens as **Label Management**. (Ctrl+K and typing "Labels" also opens it.)
3. Click **+ Add New Label**.
4. **Label Category** is the one required choice: **Sewn-in Label (Care/Size Labels)**, **Hangtag**, or **Price Tag**. It starts on Sewn-in Label. The whole form re-titles itself to match — for a hangtag the heading and save button say Hangtag.
5. **Label Code** is greyed out. The system assigns it on save (LBL-000001, LBL-000002 …).
6. **Label Name**: leave it empty to have it built automatically from type, colour, material and size. Type a name only to override.
7. **Label Type** lists only the types valid for the chosen category (Main Label, Washcare Label, Size Label, Brand Label, Barcode Label for sewn-in; Hangtag types for hangtags). Pick **Other (Custom)** to type your own. Trap: if you change the Category afterwards, an incompatible Type is cleared and must be picked again.
8. **Customer** and **Brand** are optional. Choose the customer first — the **Brand** dropdown only appears after that, and stays empty if that customer has no brands set up.
9. **Size (Physical Dimensions)** is the physical size of the printed label, not the garment size.
10. **Size Variants (Optional)**: pick a Size Category to create one separate label per garment size, each with its own stock. The tick box **Auto-generate size variants** switches on by itself — untick it if you do not want them. Trap: once variants exist, the Size Category is locked and cannot be changed on edit.
11. Fill **Fabric Content / Composition**, **Washcare Instructions**, **Print Method**, **Material** and **Color** as printed on the label.
12. **Default Price per Piece** and **Default Price per Hundred** are optional and cannot be negative.
13. To add a supplier, click **Add Supplier** and pick the **Supplier**. Tick **Preferred Supplier** for the main source. Rows with no supplier chosen are dropped silently on save.
14. Click **Create Label** (or **Create Hangtag** / **Create Price Tag**).

Back on the list, use the **All Categories** filter to see only Sewn-in Labels, Hangtags or Price Tags. To change a label later, open it and use **Update Label**. The code never changes.
