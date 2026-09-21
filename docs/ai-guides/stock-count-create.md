---
slug: stock-count-create
title: Perform a Stock Count (Physical Inventory)
keywords:
  # English
  - stock count
  - physical inventory
  - cycle count
  - inventory count
  - physical count
  - stock verification
  - inventory audit
  - variance
  - stock adjustment
  # Hinglish
  - stock count karna
  - physical ginti
  - inventory ginti
  - stock verify karna
  - ginti kaise kare
  - variance check
  # Devanagari
  - स्टॉक काउंट
  - फिजिकल इन्वेंटरी
  - गिनती
  - स्टॉक गिनती
  - इन्वेंटरी ऑडिट
  - वेरिएंस
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockCountForm.tsx
  - frontend/src/pages/StockCountList.tsx
  - frontend/src/pages/StockCountDetail.tsx
route: /inventory/stock-counts/new
---

## Before you start

- Decide which warehouse you want to count
- Choose the count type:
  - **Full Count** - counts ALL materials in a warehouse (use for annual inventory)
  - **Partial Count** - counts only the materials you select
  - **Cycle Count** - routine count of selected high-value items
  - **Spot Check** - random verification of specific materials
- Consider freezing stock movements during the count to avoid discrepancies

## Steps

### Create a Stock Count

1. Open **Inventory > Stock Counts** in the sidebar.
2. Click the **New Stock Count** button (top right).
3. Fill in the form:
   - **Warehouse** (required) - select the warehouse to count
   - **Count Type** (required) - choose Full, Partial, Cycle, or Spot Check
   - **Count Date** (required) - defaults to today
4. If you chose Partial, Cycle, or Spot Check:
   - A **Select Materials to Count** panel appears below
   - Tick the checkbox next to each material you want to include
   - The counter shows how many materials are selected
5. Optionally add **Remarks** (purpose of count, special instructions).
6. Click **Create Stock Count**.
7. The system redirects you to the Stock Counts list.

### Execute the Count

1. From the list, click on the count row to open the detail page.
2. The count starts in **Draft** status.
3. Click **Start Counting** to change status to **In Progress**.
4. For each material in the items table:
   - Click the **Count** button in the Action column
   - Enter the **Physical Qty** you actually counted
   - Optionally add **Remarks** (e.g., "damaged items excluded")
   - Click the save icon to record the count
5. The **Progress** bar updates as you count items.
6. **Variance** shows automatically:
   - Green up-arrow = overage (physical > system)
   - Red down-arrow = shortage (physical < system)
   - Green checkmark = exact match

### Complete the Count

1. Once all items are counted, the status changes to **Counted**.
2. Click **Verify Count** to review the variance summary:
   - **Overage** - items with more stock than system shows
   - **Shortage** - items with less stock than system shows
   - **Match** - items where physical = system
3. After verification, status becomes **Verified**.
4. Click **Approve & Adjust Stock** to finalize.
5. The system creates stock adjustment entries automatically for all variance items.
6. Status becomes **Approved** and the count is complete.

## Traps

- **Cannot edit after approval** - once approved, the count and adjustments are final
- **Variance affects stock levels** - approving a count automatically adjusts the `stock_levels` table
- **Partial counts only adjust selected items** - system quantities for unselected materials remain unchanged
- **Cancel is available until approval** - you can cancel a count at any stage before approval

## After saving

- Stock adjustment entries are created for items with variance
- The audit trail shows who verified and approved the count
- Stock levels are updated to match the physical count
- View completed counts from the Stock Counts list (filter by Status = Approved)
