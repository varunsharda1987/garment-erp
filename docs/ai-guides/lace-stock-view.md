---
slug: lace-stock-view
title: View Lace Stock
keywords:
  # English
  - lace stock
  - lace inventory
  - lace available
  - lace reserved
  - lace consumed
  - lace aging
  - greige lace
  - dyed lace
  - lace quality
  - lace allocation
  - lace transfer
  - lace return
  # Hinglish
  - lace stock dekhna
  - lace kitna hai
  - lace check karna
  - lace inventory dekhna
  - lace available kitna
  - lace aging report
  # Devanagari (MANDATORY)
  - लेस स्टॉक
  - लेस इन्वेंटरी
  - लेस कितना है
  - लेस देखना
  - लेस उपलब्ध
  - लेस रिज़र्व
  - ग्रेज लेस
  - डाई लेस
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/LaceStockList.tsx
  - frontend/src/pages/LaceStockDetail.tsx
route: /laces/stock
---

## Steps to view lace stock list

1. Go to **Materials & Masters** in the sidebar
2. Click **Lace Stock**
3. The lace stock list shows all lace inventory

## Summary cards (top of page)

The page shows four summary cards:

| Card | Shows |
|------|-------|
| **Available Stock** | Total meters available across all lots (green) |
| **Reserved Stock** | Total meters reserved for orders (blue) |
| **Total Value** | Rupee value of available stock (WAC x available qty) |
| **Aging Alert** | Count of lots older than 60 days (orange warning) |

## Filtering the list

Use filters to narrow down:

| Filter | Options |
|--------|---------|
| **Search** | Type lace name, lot number, or style code |
| **Status** | All Statuses, Available, Reserved, Consumed, Depleted, Defect Hold |
| **Stock Type** | All Types, Greige, Dyed |
| **Quality Grade** | All Grades, Grade A, Grade B, Defect |

Click **Refresh** to reload the list.

## Understanding the columns

| Column | Meaning |
|--------|---------|
| **Lace / Lot** | Lace name, code, color, origin style, lot number, dye lot number |
| **Origin Style** | Style the lace was originally purchased for (or "Generic" if no specific style) |
| **Available** | Meters available for use (green) |
| **Reserved** | Meters reserved for orders but not yet consumed (blue) |
| **WAC** | Weighted Average Cost per meter |
| **Status** | Current status badge |
| **Grade** | Quality grade (A, B, or Defect) |
| **Aging** | Days since the lot was received (color-coded) |

## Aging buckets

Aging shows how old the stock is:

| Days | Color |
|------|-------|
| 0-30 days | Green |
| 31-60 days | Yellow |
| 61-90 days | Orange |
| 90+ days | Red |

Click **Aging Report** button to see the full aging analysis.

## View lot details

1. Click the **eye icon** in the Actions column
2. This opens the detail page for that lot

## Lace stock detail page

The detail page has three tabs:

### Overview tab

Shows:
- **Stock Quantities**: Available, Reserved, Consumed, Total Original (in meters)
- **Cost Information**: Weighted Avg Cost, Purchase Cost, Total Value
- **Origin & Traceability**: Origin Style, Origin Order, Procurement Ref, Processing Batch
- **Location & Dates**: Warehouse, Rack, Received Date, Last Consumed Date

### Allocations tab

Shows all allocations from this lot:

| Column | Meaning |
|--------|---------|
| **Style** | Style code allocated to |
| **Order** | Order number |
| **Type** | Allocation type (STYLE_BOM, CROSS_STYLE, etc.) |
| **Allocated** | Total meters allocated |
| **Consumed** | Meters actually used |
| **Status** | RESERVED, IN_USE, or CONSUMED |
| **Date** | When allocated |

Click the **return icon** to return unused stock from an allocation back to available.

### History tab

Shows all transactions:
- **IN** transactions (receipt, return) in green
- **OUT** transactions (consumption, transfer) in red
- Each shows quantity, balance after, date/time, and who performed it

## Transfer stock

To transfer lace from one style/order to another:

1. On the detail page, click **Transfer** button (only shows for Available stock)
2. Enter Target Style ID
3. Enter Target Order ID
4. Enter quantity to transfer (cannot exceed available)
5. Add notes (optional)
6. Click **Transfer**

## Return stock from allocation

To return unused lace from an allocation:

1. Go to the **Allocations** tab on detail page
2. Find the allocation with returnable quantity
3. Click the **return icon** in Actions
4. Enter quantity to return (cannot exceed unreturned amount)
5. Add notes (optional)
6. Click **Return**

The returned quantity moves back to Available stock.

## Understanding greige vs dyed lace

| Type | Description |
|------|-------------|
| **GREIGE** | Unprocessed lace, natural color, not yet dyed |
| **DYED** | Lace that has been dyed to a specific color |

Greige lace is typically purchased, then sent for dyeing. The dyed result is tracked as a separate dyed variant.

## Status meanings

| Status | Meaning |
|--------|---------|
| **AVAILABLE** | Can be allocated to orders |
| **RESERVED** | Allocated but not yet consumed |
| **CONSUMED** | Fully used in production |
| **DEPLETED** | Exhausted (zero remaining) |
| **DEFECT_HOLD** | Quality issue, cannot be used |

## Traps

- **Stock Type filter**: Remember "Greige" is raw/undyed lace while "Dyed" has been processed
- **Aging alerts**: Lots over 60 days appear in the Aging Alert count - prioritize using older stock first (FIFO)
- **Transfer requires IDs**: You need the actual Style ID and Order ID (UUIDs), not the display codes
- **Return is per-allocation**: You can only return from a specific allocation, not from the lot overall
- **Generic stock**: Stock without an origin style ("Generic") was not tied to a specific order and can be used anywhere
- **Quality downgrade**: Currently not available in the UI - contact admin if lace quality has degraded
