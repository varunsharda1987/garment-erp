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
  # Filter / search
  - fg stock by style
  - search fg stock
  - style wise fg stock
  - style ka ready stock
  - fg stock by colour
  - colour wise fg stock
  - colour wise tayaar maal
  - रंग वाइज तैयार माल
  - स्टाइल वाइज तैयार माल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/FGStockList.tsx
  - frontend/src/components/Pagination.tsx
  - frontend/src/components/StyleCombobox.tsx
  - frontend/src/components/StyleColourCombobox.tsx
  - frontend/src/components/filters/FilterBar.tsx
  - backend/src/controllers/fg-stock.controller.ts
  - backend/src/controllers/finishing.controller.ts
  - backend/src/services/helpers/finished-goods.helper.ts
route: /inventory/fg-stock
---

## Steps

1. Open **Inventory → FG Stock** in the sidebar. The page is titled **Finished Goods Stock**.
2. The **FG Stock Inventory** table lists the finished garments ready to ship, by style, colour and size, most recently updated first.

## Search and filter

1. Type in the **Search style, buyer's code, colour, size, work order, location...** box. It matches the style code, style name, buyer style code, colour name, size, work order number and location.
2. To see one style only, open the **All styles** picker, type the style code and pick it. Archived styles are listed too, because stock can outlive a style.
3. To see one colour of that style, open the **All colours** picker and pick the colour. It lists only the chosen style's colours, so pick a style first (until then it reads "Pick a style first"). Changing the style clears the colour.
4. Results update straight away and go back to page 1.
5. Click **Clear N filters** (e.g. **Clear 2 filters**) to empty the search, the style and the colour and go back to page 1. Your rows-per-page choice stays.
6. If nothing matches, the table says "No finished goods stock matches these filters." with a **Clear filters** button.

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

- **Empty list with no filters?** — the page says "No finished goods stock found". Stock appears only after a finishing issue's **Generate Transfer Slip**. Check **Manufacturing → Finishing** if you expect stock.
- **Colour shows "-"?** — that is stock of a style with no colour, which is normal. It can be shipped or allocated against any line of that style and size.
- **No costing data?** — **Unit Cost** and **Stock Value** show **-** when there is no cost sheet or actual costing for that style.
