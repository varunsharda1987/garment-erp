---
slug: machine-part-create
title: Add a Machine Part
keywords:
  # English
  - machine part
  - spare part
  - machinery part
  - needle
  - bobbin
  - motor
  - belt
  - sewing machine parts
  - add machine part
  - create machine part
  - search machine part
  - filter machine parts by supplier
  # Hinglish
  - machine part add karna
  - spare part banana
  - machine ka part
  - needle add karna
  - bobbin add karna
  - machine part dhundhna
  # Devanagari
  - मशीन पार्ट
  - स्पेयर पार्ट
  - मशीन का पुर्जा
  - सुई
  - बॉबिन
  - मोटर
  - बेल्ट
  - सिलाई मशीन पार्ट्स
  - मशीन पार्ट खोजें
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/pages/MachinePartForm.tsx
  - frontend/src/pages/MachinePartList.tsx
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/components/Pagination.tsx
route: /materials/machine-part/new
---

## Steps

### Opening the Machine Parts Page
1. Press **Ctrl+K** to open the command palette
2. Type "Machine Parts" and select it
3. Or go to **Materials & Masters** > **All Masters** > **Machine Parts** (in the **Workshop & Other Materials** section)
4. The list opens as **Machine Parts Management**

### Finding a Machine Part
1. Type in the search box **Search code, name, part number, category, machine, brand, supplier…** — it matches any of those.
2. To see only one supplier's parts, pick the supplier in the **All suppliers** picker (type to search it). Choose **All suppliers** to show every part again.
3. **Clear N filters** (on the filter row) resets the search and the supplier and goes back to page 1.
4. If nothing is found, the list says **No machine parts match these filters.** — click **Clear filters**.
5. Use the pager under the table to move between pages; **Rows per page** sets how many show at once.

### Creating a New Machine Part
1. Click the **+ Add New Machine Part** button in the top right
2. Fill in the Part Information:
   - **Part Code**: Auto-generated (shown after save)
   - **Part Name**: Enter the name (e.g., "Needle Set Industrial", "Bobbin Case") - **required**
   - **Part Number**: Manufacturer's part number (optional)
   - **Category**: Type of part (e.g., Needle, Bobbin, Belt, Motor)
   - **Machine**: Which machine it fits (e.g., "Single Needle Lockstitch")
   - **Brand**: Manufacturer (e.g., Juki, Brother, Groz-Beckert)
   - **Model**: Model number
   - **Price Per Unit**: Cost in INR
   - **Specifications**: Technical specs, dimensions
   - **Description**: Additional notes

### Adding Suppliers
1. Click **Add Supplier** to link a supplier
2. For each supplier row:
   - Click **Supplier** and type part of the supplier's code or name, then pick it (only machine parts suppliers are listed)
   - Enter **Price Per Unit** from this supplier
   - Check **Preferred** if this is the primary supplier (first one is preferred by default)
   - Check **Active** to mark supplier as currently usable
   - Add **Notes** if needed
3. Add multiple suppliers by clicking "Add Supplier" again
4. Remove a supplier row using the **Remove** button

### Saving
1. Click **Create Machine Part** (or **Update Machine Part** when editing)
2. The system generates a Part Code automatically
3. You are returned to the Machine Parts list

### Viewing Stock
- Click **View Stock** on the list page to see current inventory levels for machine parts

## Traps
- **Part Name is required** - the form will not save without it
- **Supplier must be selected** - if you add a supplier row, you must choose a supplier or remove the row
- **Machine Parts Supplier category** - the **Supplier** picker only lists suppliers with MACHINE_PARTS_SUPPLIER category; add this category to the supplier first if they don't appear
- **First supplier is preferred by default** - uncheck if you want to set a different supplier as preferred later
- **Import/Export available** - use the Import and Export buttons on the list page for bulk operations
