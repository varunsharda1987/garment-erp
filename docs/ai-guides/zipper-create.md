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
  - slider
  - teeth type
  - tape width
  - zipper length
  - invalid request data
  - trims supplier
  - zipper kaise banaye
  - nayi zip
  - ज़िपर मास्टर
  - नई ज़िप
  - स्लाइडर
  - ज़िपर
  - ziper
  - zipr
  - supplier price
  - price per piece
  - supplier row
  - zipper supplier price
  - duplicate supplier
  - same supplier twice
  - zipper name blank
  - zipper naam khali
  - सप्लायर प्राइस
  - डुप्लीकेट सप्लायर
  - ज़िपर नाम
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/pages/ZipperList.tsx
  - frontend/src/pages/ZipperForm.tsx
  - frontend/src/types/supplier.types.ts
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/ColorPicker.tsx
  - frontend/src/services/zipper.service.ts
  - frontend/src/lib/api-error-handler.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/schemas/common.schema.ts
  - backend/src/routes/zipper.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/middleware/error.middleware.ts
  - backend/src/errors/index.ts
  - backend/src/controllers/zipper.controller.ts
  - backend/src/utils/code-generator.ts
route: /zippers/new
---

## Before you start
To link a supplier, that supplier must already exist **with category "Trims Supplier"** — other suppliers do not show in the dropdown. Each supplier can be linked to a zipper only once (see step 10). To link styles, those styles must already exist. The colour must already exist in the Color Master.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it is listed under **Fabric & Materials**). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Zippers**.
   (Alternative: expand the **Fasteners & Closures** card, click the **Zippers** tile to reach **Zipper Management**, then click **+ Add New Zipper**.)
3. The form opens with the heading **Create New Zipper**; the fields sit under **Zipper Information**.
4. **Zipper Code** is greyed out and marked **Auto-generated** — the system assigns it on save (ZIP-0001, ZIP-0002 …). Never type it. The placeholder shows "ZIP-000001", but real codes have four digits.
5. **Zipper Name**: leave it empty. It is built automatically from Buyer Code (in brackets), Colour, Teeth Type, the word "Zipper", Length (with an inch mark) and Brand — for example "[BC-12] Black Metal Zipper 7" YKK". If every one of those is blank the name becomes "Zipper" plus the new code. Type a name only to override.
6. Fill the **Zipper Information** fields you know: **Buyer Code**, **Length (inches)**, **Teeth Type**, **Color**, **Brand**, **Slider Type**, **Tape Width (mm)**. All are optional.
7. **Color** is chosen from the Color Master dropdown, not typed. Narrow the list with the **All Families** filter if needed. If the shade is missing, use the **add a new color** link (opens the Colour form in a new tab), create it, then return and pick it.
8. **Length (inches)** must be greater than zero — a minus value is rejected with "Invalid request data", and 0 is treated as blank. **Tape Width (mm)** is a number-only box and cannot be negative.
9. **Default Price per Piece (₹)** is optional and cannot be negative. It is only the fallback used when a supplier row has no price of its own.
10. **Suppliers**: **Add Supplier** opens a row with **Supplier** (required for that row), **Price/Piece (₹)**, **Preferred Supplier**, **Active** and **Notes**. The first row you add is ticked **Preferred Supplier** for you — untick it if that supplier is not your main source. **Price/Piece (₹)** can be typed or left blank: blank means "no price for this supplier" (not zero) and the default price applies; the row saves either way. Remove a row with the bin icon. A row where no supplier was chosen is dropped silently on save. Trap: the same supplier in two rows is refused — the save stops with "Failed to create zipper: Duplicate suppliers are not allowed. Each supplier can only be linked once." Delete the extra row and save again.
11. Optional: enter **Supplier Reference Code** under **Reference Codes**.
12. Optional: under **Style Associations**, use **Associated Styles** to search and select the styles that use this zipper.
13. Add any **Description** notes under **Additional Information**.
14. Click **Create Zipper**. You return to the **Zipper Management** list with the new code shown.

To edit later, open the zipper from the list and press **Update Zipper**. Trap: on edit the name is NOT rebuilt — if you clear the **Zipper Name** box, the zipper is saved with an empty name. To rename it, type the new name yourself. Supplier rows save on update the same way as on create, with the same one-row-per-supplier rule. The zipper code never changes.
