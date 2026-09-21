---
slug: warehouse-create
title: Create a Warehouse
keywords:
  # English
  - warehouse
  - godown
  - location
  - storage
  - add warehouse
  - new warehouse
  - create warehouse
  - warehouse master
  # Hinglish
  - warehouse banana
  - godown add karna
  - naya warehouse
  - warehouse create karna
  - storage location
  # Devanagari
  - वेयरहाउस
  - गोदाम
  - लोकेशन
  - स्टोरेज
  - वेयरहाउस बनाना
  - नया गोदाम
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/WarehouseForm.tsx
  - frontend/src/pages/WarehouseList.tsx
route: /inventory/warehouses/new
---

## Steps

1. Open **Inventory** in the sidebar
2. Click **Warehouses**
3. Click the **Add Warehouse** button (top right)
4. Select **Warehouse Type** (required):
   - Raw Material - for greige, fabric, trims
   - Finished Goods - for completed garments
   - Work In Progress - for items under production
   - Job Work - for materials at processors
   - General - for miscellaneous storage
   - Transit - for goods in transit
5. Click **Generate** to auto-create a code, or type your own **Warehouse Code**
6. Enter **Warehouse Name** (required)
7. Fill in optional details:
   - Address, City, State, Pincode, Country
   - Contact Person, Phone, Email
   - Capacity (in sq. ft.)
8. Keep **Active** toggle ON (default)
9. Click **Create**

## Traps

- You must select a warehouse type before clicking Generate for the code
- Warehouse Type and Code cannot be changed after creation - create a new warehouse if needed
- Duplicate warehouse codes are not allowed
- Deleting a warehouse with stock movements is blocked - deactivate instead

## After saving

- Warehouse appears in the Warehouses list under Inventory
- Warehouse becomes available in GRN location dropdowns
- Warehouse can be used for stock transfers and movements
- Stock levels tracked separately per warehouse
