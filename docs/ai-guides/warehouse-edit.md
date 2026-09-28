---
slug: warehouse-edit
title: Edit Warehouse Details
keywords:
  # English
  - edit warehouse
  - update warehouse
  - modify warehouse
  - change warehouse
  - warehouse details
  - warehouse settings
  # Hinglish
  - warehouse edit karna
  - godown update karna
  - warehouse badalna
  - godown details change karna
  - warehouse search
  - warehouse filter
  - godown dhundhna
  - clear filters
  # Devanagari
  - वेयरहाउस एडिट
  - गोदाम बदलना
  - वेयरहाउस अपडेट
  - गोदाम में बदलाव
  - गोदाम खोजें
  - वेयरहाउस फ़िल्टर
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/WarehouseForm.tsx
  - frontend/src/pages/WarehouseList.tsx
route: /inventory/warehouses
---

## Steps

1. Go to **Inventory > Warehouses** from the sidebar
2. Find the warehouse you want to edit using the filter row at the top:
   - Type in the search box ("Search code, name, city, state, contact person, phone…"). It matches the code, name, city, state, contact person or phone.
   - Use the type dropdown (**All types** first) to show one type: Raw Material, Finished Goods, WIP, Job Work, General or Transit.
   - Use the status dropdown (**All statuses** first) to show only **Active** or **Inactive** warehouses.
   - Once any filter is set, a **Clear N filters** button appears. Click it to reset the search, type and status filters.
   - If nothing matches, the list shows "No warehouses match these filters." with a **Clear filters** button.
3. Click the edit button (pencil icon) in the **Actions** column, OR click anywhere on the row to open the edit form
4. Update the fields you want to change:
   - **Warehouse Name** - The display name for this warehouse
   - **Address** - Full address
   - **City** - City name
   - **State** - State name
   - **Pincode** - Postal code
   - **Country** - Country (defaults to India)
   - **Contact Person** - Name of the warehouse contact
   - **Contact Phone** - Phone number
   - **Contact Email** - Email address
   - **Capacity (sq. ft.)** - Storage capacity in square feet
   - **Active** - Toggle to activate or deactivate the warehouse
5. Click **Update** to save your changes

## Fields You Cannot Change

- **Warehouse Type** - Cannot be changed after creation (Raw Material, Finished Goods, Work In Progress, Job Work, General, Transit)
- **Warehouse Code** - Cannot be changed after creation (e.g., WH-RM-001)

## Traps

- **Type and Code are locked**: These fields are disabled in edit mode because other records (stock movements, inventory) may reference this warehouse by its type and code
- **Deactivating a warehouse**: Setting a warehouse to Inactive does not delete existing stock records - it only prevents new transactions from using this warehouse
- **Cannot delete if used**: If you try to delete a warehouse that has stock movements or inventory records, the system will show an error
