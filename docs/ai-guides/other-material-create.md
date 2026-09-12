---
slug: other-material-create
title: Add Other Material
keywords:
  # English
  - other material
  - misc material
  - sundry material
  - miscellaneous material
  - add material
  - create material
  - other materials management
  # Hinglish
  - material add karna
  - other material banana
  - misc material add karna
  - material create karna
  # Devanagari (MANDATORY)
  - अन्य मटीरियल
  - मिस मटीरियल
  - मटीरियल बनाना
  - नया मटीरियल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/OtherMaterialList.tsx
  - frontend/src/pages/OtherMaterialForm.tsx
  - frontend/src/types/otherMaterial.types.ts
  - frontend/src/services/otherMaterial.service.ts
route: /other-materials/new
---

## Steps

### View Other Materials List
1. Go to **Materials & Masters** > **Other Materials** in sidebar
2. The list shows all miscellaneous materials with code, name, category, unit, suppliers, price, and status
3. Use the search box to filter by code, name, or category
4. Click **View Stock** button to see stock levels for OTHER material type

### Add New Material
1. Go to **Materials & Masters** > **Other Materials**
2. Click **+ Add New Material** button (top right)
3. Fill in the Material Information section:
   - **Material Code**: Auto-generated (displays after save)
   - **Material Name**: Required - enter a descriptive name (e.g., "Safety Pins", "Measuring Tape", "Chalk")
   - **Category**: Optional - helps organize materials (e.g., "Tools", "Stationery", "Miscellaneous")
   - **Unit**: Required - select from dropdown:
     - PIECE, METER, KG, GRAM, LITER, SET, PAIR, DOZEN, PACKET, BOX, ROLL, YARD
   - **Price Per Unit**: Optional - default price in rupees
   - **Specifications**: Optional - technical details, dimensions, etc.
   - **Description**: Optional - additional notes
4. Click **Create Material** to save

### Add Suppliers to Material
1. In the Suppliers section, click **Add Supplier** button
2. For each supplier row:
   - **Supplier**: Required - select from dropdown (filtered to OTHER_SERVICES category)
   - **Price Per Unit**: Optional - supplier-specific price
   - **Preferred**: Checkbox - mark as preferred supplier (first added is preferred by default)
   - **Active**: Checkbox - whether supplier link is active
   - **Notes**: Optional - supplier-specific notes
3. Add multiple suppliers if needed using **Add Supplier** button
4. Use the red **Remove** button to delete a supplier row

### Edit Material
1. In the list, click on any row OR click **Edit** button
2. Update fields as needed
3. Click **Update Material** to save changes

### Delete Material
1. In the list, click **Delete** button on the row
2. Confirm deletion in the dialog
3. Note: This also removes the associated materials table entry

### Import/Export Materials
1. Use **Export** button to download materials data
2. Use **Import** button to bulk upload materials from file

## Traps
- Material Code is auto-generated - you cannot enter it manually
- First supplier added is automatically marked as Preferred
- Deleting a material also deletes the unified materials entry - cannot be undone
- Supplier dropdown only shows suppliers in OTHER_SERVICES category - add supplier there first if missing
- Price Per Unit on the material is the default; supplier-specific prices override it
- Empty supplier rows (without a supplier selected) are ignored on save
