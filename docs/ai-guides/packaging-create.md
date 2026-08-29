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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/pages/PackagingList.tsx
  - frontend/src/pages/PackagingForm.tsx
  - frontend/src/types/packaging.types.ts
  - backend/src/controllers/masterDataDashboard.controller.ts
  - backend/src/schemas/trimMasters.schema.ts
  - backend/src/controllers/packaging.controller.ts
  - backend/src/utils/code-generator.ts
---

## Before you start
Nothing is mandatory first. To link a supplier, that supplier must already exist **and be saved with category "Packaging Supplier"** — only packaging suppliers appear in the dropdown.

## Steps
1. Open **Materials & Masters → All Masters** in the sidebar (under the **Configuration** heading — expand it if collapsed).
2. In the **Packaging & Labels** section, click **Packaging**. The page opens as **Packaging Management**. (Ctrl+K and typing "Packaging" also opens it.)
3. Click **+ Add New Packaging**. The form opens with the heading **Create New Packaging**.
4. **Packaging Name** is the only field the form will not save without. If it is blank you get the red message "Packaging name is required". Write it so the store can identify the item, for example "Poly Bag 12x18 inch Transparent".
5. There is no code box on the create form. The system assigns the code on save (PKG-0001, PKG-0002 …) and shows it when you re-open the item.
6. **Customer (Optional)**: choose a customer only if this packing is made for that buyer. The **Brand (Optional)** dropdown appears after a customer is chosen, and stays empty if that customer has no brands set up.
7. **Packaging Type**: pick from the list — Poly Bag, Zip Lock Bag, Garment Cover, Dust Cover, Carton Box, Gift Box, Shoe Box, Inner Box, Plastic / Wooden / Velvet / Clip / Wire Hanger, Packing Tape, Barcode Sticker, Size Sticker, Tissue Paper, Silica Gel, Insert Card. Choose **Other** and a free-text box appears for a type not on the list.
8. **Size** is free text for the dimensions, for example "12x18 inches".
9. **Material** is what it is made of, for example LDPE or corrugated cardboard.
10. **Thickness (microns)** must be a number. Type only the number — do not add the word "microns" or "micron", it is a number-only box.
11. **Print Details** is for what is printed on it, such as a logo or barcode position.
12. **Default Price per Piece** and **Default Price per Hundred** are optional and cannot be negative.
13. To add a supplier, click **Add Supplier**, pick the **Supplier**, and fill **Price/Piece** and **Notes** if known. Tick **Preferred Supplier** for the main source and keep **Active** ticked.
14. Trap: a supplier row where no supplier was chosen is dropped silently on save. Remove empty rows with the bin icon.
15. Optional: enter the **Supplier Reference Code** (the supplier's own item code) and any **Description** notes.
16. Click **Create Packaging**. You land back on the **Packaging Management** list.

To change it later, open the item and use **Update Packaging**. The code can never be changed.
