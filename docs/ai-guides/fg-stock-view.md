---
slug: fg-stock-view
title: View Finished Goods Stock
keywords:
  # English
  - finished goods
  - FG stock
  - ready stock
  - garment stock
  - sellable stock
  - finished inventory
  - ready to ship
  - completed garments
  # Hinglish
  - FG stock dekhna
  - ready maal
  - tayaar stock
  - finished maal
  - packing ke liye tayaar
  # Devanagari
  - फिनिश्ड गुड्स
  - एफजी स्टॉक
  - तैयार माल
  - पूर्ण स्टॉक
  - रेडी स्टॉक
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FGStockList.tsx
route: /inventory/fg-stock
---

## Steps

1. Open **Inventory → FG Stock** in the sidebar.
2. The page displays all finished goods (completed garments) ready for dispatch.

## Search

- Use the **Search** box to find items by style code, style name, color name, or size.
- Results filter in real-time as you type.

## Understanding the Table

The table shows finished goods with these columns:

| Column | Description |
|--------|-------------|
| **Style** | Style code and name of the garment |
| **Color** | Color swatch and name |
| **Size** | Size label (S, M, L, XL, etc.) |
| **Quantity** | Number of pieces in stock |
| **Unit Cost** | Cost per piece (actual or estimated*) |
| **Stock Value** | Total value (Unit Cost x Quantity) |
| **Location** | Warehouse where stock is stored |
| **Work Order** | Work order number that produced this batch |
| **Last Updated** | Date of last stock movement |

## Understanding Costs

- **Unit Cost** shows the cost per piece.
- A **bold** value means actual cost is captured; a value with **\*** is estimated.
- Hover over the cost to see a tooltip with:
  - Actual cost (if available)
  - Estimated cost (from cost sheet)
  - Cost variance percentage (how much actual differs from estimate)

## Summary Badges

At the top-right of the page:
- **Total Pieces** — sum of all quantities on current page
- **Total Value** — sum of all stock values (shown only when costing data exists)

## How FG Stock Gets Created

Finished goods stock is created automatically when:
1. A **finishing batch** is completed in Manufacturing.
2. The work order moves to COMPLETED status.
3. The system books the finished quantity into FG Stock.

## Pagination

- Results show **20 items per page**.
- Use **Previous** / **Next** buttons to navigate pages.
- The status bar shows "Showing X to Y of Z items".

## Traps

- **Empty list?** — FG stock only appears after production batches are completed. Check Work Orders → Finishing if expecting stock.
- **No costing data?** — The Unit Cost and Stock Value columns show "-" if no cost sheet or actual costing exists for that style.
- **Search not finding items?** — Search works on style code, style name, color name, and size. It does not search by location or work order number.
