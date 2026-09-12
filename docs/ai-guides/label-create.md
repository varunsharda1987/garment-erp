---
slug: label-create
title: Add a Label, Hangtag or Price Tag (Label Master)
keywords:
  - label
  - LBL
  - label master
  - add label
  - new label
  - hangtag
  - hang tag
  - price tag
  - pricetag
  - care label
  - washcare
  - size label
  - main label
  - size variants
  - label kaise banaye
  - label banana
  - naya label
  - लेबल
  - लेबल मास्टर
  - नया लेबल
  - हैंगटैग
  - प्राइस टैग
  - वॉशकेयर
  - केयर लेबल
  - साइज लेबल
  - टैग
  - lable
  - labal
  - label supplier
  - add supplier
  - supplier row
  - supplier price
  - Invalid request data
  - supplier nahi jud raha
  - label me supplier kaise jode
  - लेबल सप्लायर
  - सप्लायर जोड़ें
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/stores/ui-preferences.store.ts
  - frontend/src/components/CommandPalette.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/pages/LabelList.tsx
  - frontend/src/pages/LabelForm.tsx
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/types/label.types.ts
  - frontend/src/types/supplier.types.ts
  - backend/src/controllers/masterDataDashboard.controller.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/schemas/common.schema.ts
  - backend/src/controllers/label.controller.ts
route: /labels/new
---

## Before you start
Labels are NOT under Trims Dashboard — they live under Packaging. To link a supplier, that supplier must exist **with category "Trims Supplier"**. To auto-create size-wise labels, the Size Category must already exist. To link a customer's brand, that brand must already be set up on the customer.

## Steps
1. Open **Materials & Masters → All Masters** in the sidebar. It sits under the **Configuration** heading, which is collapsed by default — click **Configuration** to expand it.
2. The page opens as **Master Data**. In the **Packaging & Labels** section, click **Labels**. The page opens as **Label Management**. (Pressing Ctrl+K and typing "Labels" also opens it.)
3. Click **+ Add New Label**.
4. **Label Category** is the one required choice: **Sewn-in Label (Care/Size Labels)**, **Hangtag**, or **Price Tag**. It starts on Sewn-in Label. The whole form re-titles itself to match — for a hangtag the heading, the field names and the save button all say Hangtag.
5. **Label Code** is greyed out and marked **Auto-generated**. The system assigns it on save (LBL-000001, LBL-000002 …).
6. **Label Name**: leave it empty to have it built automatically from Type, Colour, Material and Size. The word "Label" is added only for sewn-in labels, and only when the chosen Type does not already contain it. Type a name only to override.
7. **Label Type** lists only the types valid for the chosen category. Sewn-in: **Main Label**, **Washcare Label**, **Size Label**, **Main Cum Size Label**, **Brand Label**, **Loop Tag**, **Traceability Label**, **Barcode Label**, **Country of Origin**, **Composition Label**. Hangtag: **Hangtag**, **Brand Hangtag**, **Product Hangtag**, **Disclaimer Tag**, **Liva Tag**, **Eco-Vera Tag**. Price Tag: **Price Tag**. Pick **Other (Custom)** to type your own in the box that appears. Trap: if you change the Category afterwards, an incompatible Type is cleared and must be picked again.
8. **Customer (Optional)** and **Brand (Optional)** link the label to one buyer. Leave **No Customer (Generic Label)** for a generic label (the option is named after the category — **No Customer (Generic Hangtag)** for a hangtag). Choose the customer first — the **Brand (Optional)** dropdown only appears after that, and stays disabled with "No brands available" if that customer has no brands set up. Leave **No Brand (Customer-Generic)** to link the customer but not one brand.
9. **Size (Physical Dimensions)** is the physical size of the printed label, not the garment size.
10. **Size Variants (Optional)**: pick a Size Category (the list shows its sizes) to create one separate label per garment size, each with its own stock. The tick box **Auto-generate size variants** switches on by itself — untick it if you do not want them. Leave **No Size Variants** to skip. Trap: once variants exist, the Size Category is locked and cannot be changed on edit.
11. Fill **Fabric Content / Composition**, **Washcare Instructions**, **Print Method**, **Material** and **Color** as printed on the label. Here **Color** is typed, not picked from the Color Master.
12. **Default Price per Piece (₹)** and **Default Price per Hundred (₹)** are optional and cannot be negative. They are only fallbacks when a supplier has no price of its own.
13. To add a supplier, go to the **Suppliers** section and click **Add Supplier**. Each row has: **Supplier** (dropdown — the only required field in the row), **Price/Piece (₹)**, **Price/100 (₹)**, the tick boxes **Preferred Supplier** and **Active**, and **Notes**. Pick the supplier, then fill the prices and notes if known. Tick **Preferred Supplier** for the main source (the first row is ticked automatically) and keep **Active** ticked.
14. You may leave a supplier's price boxes empty — the row still saves, and the supplier is simply stored without a price. A typed price saves as entered. Rows with no supplier chosen are dropped silently on save — remove them with the bin icon.
15. Optional: enter the **Supplier Reference Code** under **Reference Codes**, and any **Description** notes under **Additional Information**.
16. Click **Create Label** (or **Create Hangtag** / **Create Price Tag**). You return to the **Label Management** list. **Cancel** returns without saving.

Back on the list, use the **All Categories** filter to see only **Sewn-in Labels**, **Hangtags** or **Price Tags**, and **All Customers** / **Generic Only** to filter by buyer. To change a label later, open it, click **Edit**, and use **Update Label** (or **Update Hangtag** / **Update Price Tag**). The code never changes.
