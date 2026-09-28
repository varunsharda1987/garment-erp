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
  # No colour
  - no colour stock
  - color blank
  - colour dash
  - bina colour ka stock
  - बिना रंग का स्टॉक
  - रंग खाली
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/FGStockList.tsx
  - frontend/src/components/Pagination.tsx
  - backend/src/controllers/fg-stock.controller.ts
  - backend/src/controllers/finishing.controller.ts
  - backend/src/services/helpers/finished-goods.helper.ts
route: /inventory/fg-stock
---

## Steps

1. Open **Inventory → FG Stock** in the sidebar. The page is titled **Finished Goods Stock**.
2. The **FG Stock Inventory** table lists the finished garments ready to ship, by style, colour and size, most recently updated first.

## Search

- Type in the **Search by style, color, size...** box. It matches the style code, style name, buyer style code, colour name, size and work order number.
- Results update as you type and go back to page 1.

## Understanding the Table

| Column | Description |
|--------|-------------|
| **Style** | Style code, with the style name underneath |
| **Color** | Colour swatch and name. A style with no colour has its stock with no colour — this column shows **-** |
| **Size** | Size label (S, M, L, XL, etc.) |
| **Quantity** | Number of pieces in stock |
| **Unit Cost** | Cost per piece (actual, or estimated marked **\***) |
| **Stock Value** | Unit Cost × Quantity |
| **Location** | Warehouse where the stock is kept |
| **Work Order** | Work order number that produced it |
| **Last Updated** | Date of the last stock movement |

## Understanding Costs

- **Unit Cost** shows the actual cost per piece when it has been captured (normal text); otherwise the estimated cost from the cost sheet, greyed and marked **\***.
- Hover over the cost for a tooltip: **Actual** (or **Estimated** when there is no actual yet) and, when known, **Variance** — how far actual differs from the estimate, in %.

## Summary Badges

At the top-right of the page:
- A badge with the total pieces (**… pcs**) — the sum of the quantities on the current page.
- A **Value:** badge — the sum of the stock values on the current page (shown only when costing data exists).

## How FG Stock Gets Created

1. Finishing is recorded on a finishing issue (**Manufacturing → Finishing**) and the issue is completed.
2. Clicking **Generate Transfer Slip** on that completed issue books every finished piece into FG Stock, one row per style, colour and size. A style with no colour is booked with no colour.
3. Delivery notes then take the pieces out when they are created; cancelling a pending note puts them back.

## Pagination

- Results show **20 items per page**; change it with **Rows per page** (20, 50 or 100) at the bottom.
- Move between pages with the page numbers, or the arrow buttons for first, previous, next and last page.
- The bottom line reads "Showing X to Y of Z items".

## Traps

- **Empty list?** — the page says "No finished goods stock found". Stock appears only after a finishing issue's **Generate Transfer Slip**. Check **Manufacturing → Finishing** if you expect stock.
- **Colour shows "-"?** — that is stock of a style with no colour, which is normal. It can be shipped or allocated against any line of that style and size.
- **No costing data?** — **Unit Cost** and **Stock Value** show **-** when there is no cost sheet or actual costing for that style.
- **Search not finding items?** — search does not look at the location. Search by style, buyer style code, colour, size or work order number instead.
