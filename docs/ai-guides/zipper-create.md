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
  - backend/src/routes/zipper.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/controllers/zipper.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
To link a supplier, that supplier must already exist **with category "Trims Supplier"** — other suppliers do not show in the dropdown. Read the supplier trap in step 10 before you add one. To link styles, those styles must already exist. The colour must already exist in the Color Master.

## Steps
1. Open **Materials & Masters → Trims Dashboard** in the sidebar (it is listed under **Fabric & Materials**). The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right. Under **Fasteners & Closures** choose **New Zippers**.
   (Alternative: expand the **Fasteners & Closures** card, click the **Zippers** tile to reach **Zipper Management**, then click **+ Add New Zipper**.)
3. The form opens with the heading **Create New Zipper**; the fields sit under **Zipper Information**.
4. **Zipper Code** is greyed out and marked **Auto-generated** — the system assigns it on save (ZIP-0001, ZIP-0002 …). Never type it. The placeholder shows "ZIP-000001", but real codes have four digits.
5. **Zipper Name**: leave it empty. It is built automatically from Buyer Code (in brackets), Colour, Teeth Type, Length and Brand. Type a name only to override.
6. Fill the **Zipper Information** fields you know: **Buyer Code**, **Length (inches)**, **Teeth Type**, **Color**, **Brand**, **Slider Type**, **Tape Width (mm)**. All are optional.
7. **Color** is chosen from the Color Master dropdown, not typed. Narrow the list with the **All Families** filter if needed. If the shade is missing, use the **add a new color** link (opens the Colour form in a new tab), create it, then return and pick it.
8. **Length (inches)** must be greater than zero — a minus value is rejected with "Invalid request data", and 0 is treated as blank. **Tape Width (mm)** is a number-only box and cannot be negative.
9. **Default Price per Piece (₹)** is optional and cannot be negative. It is only the fallback used when a supplier has no price of its own.
10. **Suppliers**: **Add Supplier** opens a row with **Supplier**, **Price/Piece (₹)**, **Preferred Supplier**, **Active** and **Notes**. Trap: right now a supplier row cannot be saved from this form. As soon as a row has a supplier chosen, **Create Zipper** fails with "Failed to create zipper: Invalid request data" — even with **Price/Piece (₹)** left blank — because the row's price is sent as text and the server expects a number. Remove every supplier row with the bin icon before saving. (Rows where no supplier was chosen are dropped silently.)
11. Optional: enter **Supplier Reference Code** under **Reference Codes**.
12. Optional: under **Style Associations**, use **Associated Styles** to search and select the styles that use this zipper.
13. Add any **Description** notes under **Additional Information**.
14. Click **Create Zipper**. You return to the **Zipper Management** list with the new code shown.

To edit later, open the zipper from the list and press **Update Zipper**. The same supplier-row trap applies on update. The zipper code never changes.
