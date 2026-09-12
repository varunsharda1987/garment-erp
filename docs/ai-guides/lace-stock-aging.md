---
slug: lace-stock-aging
title: Check Lace Stock Aging
keywords:
  # English
  - lace aging
  - old stock
  - stock aging
  - dead stock
  - lace report
  - aging report
  - slow moving
  - fifo
  # Hinglish
  - purana lace
  - aging report
  - lace ki umar
  - purana stock
  # Devanagari
  - लेस एजिंग
  - पुराना स्टॉक
  - पुराना लेस
  - एजिंग रिपोर्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/LaceStockAging.tsx
route: /laces/stock/aging
---

## Steps

1. Go to **Materials & Masters** in the sidebar
2. Click **Lace Stock**
3. Click the **Aging** button or navigate directly to `/lace-stock/aging`
4. View the aging report with summary cards and detailed table

## Understanding Aging Buckets

The report groups lace stock into four FIFO aging buckets based on days since receipt:

| Bucket | Meaning |
|--------|---------|
| **0-30 days** | Fresh stock, recently received |
| **31-60 days** | Normal turnover, monitor if not moving |
| **61-90 days** | Aging stock, consider using in upcoming orders |
| **90+ days** | Dead/slow-moving stock, priority for consumption |

## Summary Cards

At the top, four cards show totals per bucket:
- **Lot count** - number of lots in each bucket
- **Quantity** - total available metres
- **Value** - total value at weighted average cost

## Detail Table Columns

| Column | Description |
|--------|-------------|
| Lace | Lace code and name (click to view lot details) |
| Lot | Lot number from GRN |
| Origin Style | Style the lace was originally procured for |
| Available | Quantity available in metres |
| Avg Cost | Weighted average cost per metre |
| Total Value | Available qty x avg cost |
| Received | Date received into stock |
| Age (days) | Days since received date |
| Bucket | Color-coded aging bucket badge |

## Actions

- **Refresh** - Reload the aging report
- **Click lace code** - Navigate to the individual lace stock lot details
- **Back to Lace Stock** - Return to the main lace stock list

## Traps

- The report only shows **available** lace stock (not reserved or issued quantities)
- Aging is calculated from the GRN **received date**, not purchase order date
- High-value items in the 90+ bucket should be prioritized for upcoming orders
- Click the lace code to see full lot history and movements
