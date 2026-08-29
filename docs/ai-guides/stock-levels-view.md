---
slug: stock-levels-view
title: Find Current Stock of a Material
keywords:
  - stock levels
  - current stock
  - kitna stock hai
  - stock kaise dekhe
  - available quantity
  - स्टॉक
  - कितना स्टॉक
  - माल
  - गोदाम
  - warehouse
  - low stock
  - reorder level
  - inventory dashboard
  - material stock check
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/routes/lazy-routes.tsx
  - frontend/src/pages/StockLevelList.tsx
  - frontend/src/pages/StockDashboard.tsx
  - frontend/src/components/WarehouseCombobox.tsx
---

## Steps

1. Open **Inventory → Stock Levels** in the sidebar.
2. The page is titled **Stock Levels**. Each row shows one material in one warehouse: **Material Code**, **Material Name**, **Type**, **Warehouse**, **Current Stock**, **Valuation Rate**, **Stock Value**, **Reorder Level** and **Status**.
3. To find one material, type its code or name in the **Search Material** box at the top left. The list filters as you type.
4. To see only one kind of material, use the **Material Type** dropdown. Options are: **All Material Types**, **Greige**, **Fabric**, **Thread**, **Button**, **Zipper**, **Elastic**, **Lace**, **Label**, **Packaging**, **Machine Parts**, **Other Materials**.
5. To check stock in one godown only, use the **Warehouse** box (it shows **All Warehouses** by default). Type to search; each warehouse is listed as code plus name.
6. When a material type filter is on, a bar appears saying "Showing stock for". Press **Clear filter** to go back to all materials.
7. To see only items that are running out, press the **Low Stock Only** button at the top right. Press it again to switch back.
8. Read the **Status** column to judge the item: **Critical** (below minimum), **Low Stock** (at or below reorder level), **Overstock** (above maximum) or **Normal**.

## Notes

- The same material can appear on more than one row if it is kept in more than one warehouse. Add the rows up for the total.
- The count at the bottom ("Showing N stock levels") reflects the filters currently applied, not the whole factory.
- For a summary of the whole inventory instead of a list, open **Inventory → Inventory Dashboard** (the page is titled **Unified Inventory Dashboard**). Its **Finished Fabric Stock** and **Generic Greige Stock** cards each have a **View Details** button, and the **Trim & Accessories Stock** card has **View All Stock Levels**. The greige card shows five tiles: **Total Meters**, **Total Value**, **Bales**, **Thans** and **Aging (>180d)**.
- Greige and finished fabric also have their own detailed screens: **Inventory → Greige Stock** and **Inventory → Fabric Stock**. Use those when you need roll numbers, lot detail or ageing.
- This screen is read-only. To change a quantity use **Inventory → Material Movements** (Stock In, Stock Out, Transfer, Adjustment) or **Inventory → Stock Counts**.
