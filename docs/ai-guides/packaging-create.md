---
slug: packaging-create
title: Add a Packaging Item (Packaging Master)
keywords:
  - packaging
  - PKG
  - packaging master
  - poly bag
  - polybag
  - carton
  - hanger
  - packing material
  - packaging kaise banaye
  - naya packing
  - पैकेजिंग
  - पॉली बैग
  - कार्टन
  - हैंगर
  - पैकिंग
  - packing
  - packaging name required
  - invalid request data
  - packaging supplier
  - packing kaise banaye
  - nayi packaging
  - पैकेजिंग मास्टर
  - नई पैकेजिंग
  - पैकेजिंग सप्लायर
  - packging
  - packeging
  - auto name
  - auto-generate name
  - packaging name optional
  - name blank
  - naam khali chhodo
  - packaging naam
  - पैकेजिंग नाम
  - अपने आप नाम
  - supplier price
  - price per piece
  - supplier row
  - packaging supplier price
  - सप्लायर प्राइस
  - सप्लायर रेट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/components/CommandPalette.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/pages/PackagingList.tsx
  - frontend/src/pages/PackagingForm.tsx
  - frontend/src/types/packaging.types.ts
  - frontend/src/types/supplier.types.ts
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/services/packaging.service.ts
  - frontend/src/lib/api-error-handler.ts
  - backend/src/controllers/masterDataDashboard.controller.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/schemas/common.schema.ts
  - backend/src/routes/packaging.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/controllers/packaging.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Packaging Supplier"** — only packaging suppliers appear in the dropdown. If you want the system to name the item for you, decide its **Material**, **Packaging Type** and **Size** before saving — the name is built from those three (see step 4).

## Steps
1. Open **Materials & Masters → All Masters** in the sidebar. It sits under the **Configuration** heading, which is collapsed by default — expand it. The page opens as **Master Data**.
2. In the **Packaging & Labels** section, click **Packaging**. The list opens as **Packaging Management**. (Shortcut: press Ctrl+K, type "Packaging" and pick it. Typing "Packaging" in the sidebar search box also shows it under **More pages**.)
3. Click **+ Add New Packaging**. The form opens with the heading **Create New Packaging**; the fields sit under **Packaging Information**.
4. **Packaging Name** is optional. The box says "Leave empty to auto-generate from attributes", and the hint under it reads: If left empty, the name is built from the attributes as [buyer code] material type size (e.g., "Corrugated Carton Box 12x10"). Leave it blank and the system joins **Material**, **Packaging Type** and **Size** in that order — for example Material "Corrugated", Packaging Type "Carton Box" and Size "12x10" become "Corrugated Carton Box 12x10". (There is no buyer-code box on this form, so the "[buyer code]" part is never added.) If all three are blank, the name becomes "Packaging" plus the new code, for example "Packaging PKG-0001". Type a name only when you want something different, such as "Poly Bag 12x18 inch Transparent".
5. There is no code box on the create form. The system assigns the code on save (PKG-0001, PKG-0002 …) and shows it as **Packaging Code (Auto-generated)** when you re-open the item.
6. **Customer (Optional)**: choose a customer only if this packing is made for that buyer. Select **No Customer (Generic Packaging)** to leave it unlinked. The **Brand (Optional)** dropdown appears only after a customer is chosen — pick a brand or **No Brand (Customer-Generic)**. If that customer has no brands, the dropdown is disabled and shows "No brands available"; add brands in the Customer form first.
7. **Packaging Type**: pick from the list — Poly Bag, Zip Lock Bag, Garment Cover, Dust Cover, Carton Box, Gift Box, Shoe Box, Inner Box, Plastic Hanger, Wooden Hanger, Velvet Hanger, Clip Hanger, Wire Hanger, Packing Tape, Barcode Sticker, Size Sticker, Tissue Paper, Silica Gel, Insert Card. Choose **Other** and a box "Enter custom packaging type..." appears for a type not on the list; whatever you type there is what goes into the auto-built name.
8. **Size** is free text for the dimensions, for example "12x18 inches". It is the last part of the auto-built name.
9. **Material** is what it is made of, for example LDPE or corrugated cardboard. It is the first part of the auto-built name.
10. **Thickness (microns)** is a number-only box. Type only the number — do not add the word "microns".
11. **Print Details** is for what is printed on it, such as a logo or barcode position.
12. **Default Price per Piece (₹)** and **Default Price per Hundred (₹)** are optional and cannot be negative.
13. **Suppliers**: **Add Supplier** opens a row with **Supplier** (required for that row), **Price/Piece (₹)**, **Preferred Supplier**, **Active** and **Notes**. The first row you add is ticked **Preferred Supplier** for you — untick it if that supplier is not your main source. **Price/Piece (₹)** can be typed or left blank: blank means "no price for this supplier" (not zero), and the row saves either way. Remove a row with the bin icon. Trap: a row where no supplier was chosen is dropped silently on save — pick the supplier or delete the row.
14. Optional: under **Reference Codes**, enter the **Supplier Reference Code** (the supplier's own item code). Under **Additional Information**, add any **Description** notes.
15. Click **Create Packaging**. You land back on the **Packaging Management** list.

To change it later, open the item and use **Update Packaging**. The name box shows the saved name and does not change by itself when you edit Material, Packaging Type or Size — clear the **Packaging Name** box and save to have it rebuilt from the current attributes. Supplier rows save on update the same way as on create. The code can never be changed.
