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
  - backend/src/routes/packaging.routes.ts
  - backend/src/middleware/validation.middleware.ts
  - backend/src/controllers/packaging.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Packaging Supplier"** — only packaging suppliers appear in the dropdown. Read the supplier trap in step 13 before you add one.

## Steps
1. Open **Materials & Masters → All Masters** in the sidebar. It sits under the **Configuration** heading, which is collapsed by default — expand it. The page opens as **Master Data**.
2. In the **Packaging & Labels** section, click **Packaging**. The list opens as **Packaging Management**. (Shortcut: press Ctrl+K, type "Packaging" and pick it. Typing "Packaging" in the sidebar search box also shows it under **More pages**.)
3. Click **+ Add New Packaging**. The form opens with the heading **Create New Packaging**; the fields sit under **Packaging Information**.
4. **Packaging Name** is required. Trap: the box says "Leave empty to auto-generate from attributes", but saving with it blank fails with "Packaging name is required". Type a name the store can identify, for example "Poly Bag 12x18 inch Transparent".
5. There is no code box on the create form. The system assigns the code on save (PKG-0001, PKG-0002 …) and shows it as **Packaging Code (Auto-generated)** when you re-open the item.
6. **Customer (Optional)**: choose a customer only if this packing is made for that buyer. Select **No Customer (Generic Packaging)** to leave it unlinked. The **Brand (Optional)** dropdown appears only after a customer is chosen — pick a brand or **No Brand (Customer-Generic)**. If that customer has no brands, the dropdown is disabled and shows "No brands available"; add brands in the Customer form first.
7. **Packaging Type**: pick from the list — Poly Bag, Zip Lock Bag, Garment Cover, Dust Cover, Carton Box, Gift Box, Shoe Box, Inner Box, Plastic Hanger, Wooden Hanger, Velvet Hanger, Clip Hanger, Wire Hanger, Packing Tape, Barcode Sticker, Size Sticker, Tissue Paper, Silica Gel, Insert Card. Choose **Other** and a free-text box appears for a type not on the list.
8. **Size** is free text for the dimensions, for example "12x18 inches".
9. **Material** is what it is made of, for example LDPE or corrugated cardboard.
10. **Thickness (microns)** is a number-only box. Type only the number — do not add the word "microns".
11. **Print Details** is for what is printed on it, such as a logo or barcode position.
12. **Default Price per Piece (₹)** and **Default Price per Hundred (₹)** are optional and cannot be negative.
13. **Suppliers**: **Add Supplier** opens a row with **Supplier**, **Price/Piece (₹)**, **Preferred Supplier**, **Active** and **Notes**. Trap: right now a supplier row cannot be saved from this form. As soon as a row has a supplier chosen, **Create Packaging** fails with "Failed to create packaging: Invalid request data" — even with **Price/Piece (₹)** left blank — because the row's price is sent as text and the server expects a number. Remove every supplier row with the bin icon before saving. (Rows where no supplier was chosen are dropped silently.)
14. Optional: under **Reference Codes**, enter the **Supplier Reference Code** (the supplier's own item code). Under **Additional Information**, add any **Description** notes.
15. Click **Create Packaging**. You land back on the **Packaging Management** list.

To change it later, open the item and use **Update Packaging**. The same supplier-row trap applies on update. The code can never be changed.
