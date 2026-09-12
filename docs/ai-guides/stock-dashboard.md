---
slug: stock-dashboard
title: Use the Stock Dashboard
keywords:
  # English
  - stock dashboard
  - inventory dashboard
  - stock overview
  - inventory overview
  - stock summary
  - inventory value
  - low stock
  - aging stock
  - warehouse overview
  - fabric stock
  - greige stock
  - trim stock
  # Hinglish
  - stock dashboard dekhna
  - inventory status
  - stock kitna hai
  - godown mein kya hai
  - stock check karna
  - inventory dekhna
  # Devanagari (MANDATORY)
  - स्टॉक डैशबोर्ड
  - इन्वेंटरी डैशबोर्ड
  - स्टॉक देखना
  - गोदाम स्टॉक
  - स्टॉक समरी
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockDashboard.tsx
route: /stock/dashboard
---

## Steps

1. Go to **Inventory** in the sidebar
2. Click **Inventory Dashboard**
3. The dashboard loads showing a unified view of all inventory across fabric, greige, and trims

## Understanding the Dashboard Sections

### Top Metrics Cards

The dashboard displays four summary cards at the top:

1. **Total Inventory Value** - Combined value of all fabric, greige, and trim stock in rupees
2. **Total Materials** - Count of all material items with breakdown (e.g., "150 Fabric + 45 Greige + 320 Trims")
3. **Low Stock / Aging Alerts** - Number of items needing attention (low stock + items aging over 180 days)
4. **Active Warehouses** - Number of active warehouse locations (click to view warehouse list)

### Finished Fabric Stock Section

Shows fabric stock summary with:
- **Total Meters** - Total fabric quantity in meters
- **Total Value** - Total fabric stock value
- **Aging Stock** - Items older than 180 days
- **Quality Grades** - Breakdown by Grade A, Grade B, and Defect quantities
- Click **View Details** to go to the Fabric Stock page

### Generic Greige Stock Section

Shows greige (unprocessed fabric) stock summary with:
- **Total Meters** - Total greige quantity
- **Total Value** - Total greige stock value
- **Bales** - Number of greige bales
- **Thans** - Number of greige thans (rolls)
- **Aging** - Items older than 180 days
- Click **View Details** to go to the Greige Stock page

### Trim & Accessories Section

Shows trim and accessory stock summary with:
- **Total Materials** - Count of trim items
- **Total Value** - Total trim stock value
- **Low Stock Items** - Items below reorder level
- **By Material Type** - Breakdown showing count per material type (buttons, zippers, labels, etc.)
- Click **View All Stock Levels** to go to the Stock Levels page

### Specialty Stock Section

Quick navigation buttons for specialty materials:
- **Lace Stock** - View lace inventory
- **Lace Lab Dips** - View lace lab dip samples
- **Lace Defects** - View lace defect records
- **Embroidery Stock** - View embroidery inventory (if you have permission)
- **Embroidery Pieces** - View embroidery piece tracking (if you have permission)

### Stock Alerts Table

When there are alerts, a table shows items requiring action:
- **Type** - Material type (Trim, Fabric, or Greige)
- **Item Code** - Material code
- **Item Name** - Material name
- **Quantity** - Current stock quantity
- **Alert Reason** - Why the alert was raised (below reorder level or aging over 180 days)
- **Status** - Badge showing "Low Stock" or "Aging"

Click **View All Alerts** to see the complete list

### Quick Actions

Buttons to perform common inventory operations:
- **Stock IN** - Record incoming stock
- **Stock OUT** - Record outgoing stock
- **Transfer** - Transfer stock between warehouses
- **Adjustment** - Make stock quantity adjustments
- **Stock Counts** - View physical stock count records
- **New Stock Count** - Start a new stock count

## Tips

- The dashboard combines data from fabric, greige, and trim stock tables into one unified view
- Aging stock (over 180 days) is highlighted to help identify slow-moving inventory
- Low stock alerts are based on the reorder level set for each material
- Use the Quick Actions buttons to perform common operations without navigating through menus
- Click on the warehouse card to manage warehouse locations
