---
slug: order-create
title: Create a Production Order
keywords:
  - order
  - production order
  - new order
  - create order
  - order kaise banaye
  - naya order
  - order banana
  - ऑर्डर
  - आर्डर
  - नया ऑर्डर
  - स्टाइल
  - डिलीवरी
  - size breakup
  - colour size
  - cost sheet
  - size breakdown
  - size split
  - add size breakdown
  - sizes later
  - saiz
  - saiz kaise dale
  - size baad mein
  - साइज़
  - साइज़ ब्रेकडाउन
  - साइज़ बाद में
  - मात्रा
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/OrderList.tsx
  - frontend/src/pages/OrderForm.tsx
  - frontend/src/pages/OrderDetail.tsx
  - frontend/src/components/orders/SizeBreakupDialog.tsx
  - frontend/src/types/order.types.ts
  - backend/src/schemas/order.schema.ts
  - backend/src/controllers/order.controller.ts
---

## Before you start
The style must be published (**Active** status) and must already have an **Approved** cost sheet with purpose *Raw Material Calculation* or *Production*. Without it the order cannot be saved. The style also needs size options (SKU variants) in Style Master. One order carries one style only.

## Steps
1. Open **Orders & Sales → Orders** in the sidebar.
2. Click **+ Create New Order** (top right). The page title reads **Create New Order**.
3. Pick **Customer Name \*** from the dropdown.
4. Pick **Style \***. Type two or more letters in the **Search styles...** box inside the dropdown to search the full catalogue.
5. Watch the message that appears under the row. Green means approved cost sheets are available; a red **No Approved Cost Sheet** panel means you must click **Create Cost Sheet** and get it approved first.
6. Enter **Total Qty \*** (total pieces) and set **Delivery \*** (expected delivery date). **Order Date** defaults to today and can be changed, including to a past date.
7. Optional: click **Use Cost Sheet** to pick an approved sheet. It fills **Unit Price** for you.
8. Open **Quantity & Pricing** to split the quantity. Choose **Absolute**, **Percentage** or **Ratio**. In Absolute, type pieces into the colour × size grid or click **Smart Distribute**. In Percentage/Ratio, type the share per size and click **Recalculate**. You may also leave the grid empty and fill the sizes in later — see *Add the size breakdown later* below.
9. If the customer has size presets, **Size Override (Optional)** lets you swap the style's default sizes.
10. Click **Create Order** in the bar at the bottom of the screen.

## Validation traps
- The bottom bar shows **x/5 required fields**. **Create Order** stays greyed out until all five pass: Customer, Style, Qty, Delivery date and an approved cost sheet.
- Size breakup and Unit Price are optional. A quantity mismatch warning is only information — the order saves with the Total Qty you typed.
- "This style has no size options" means you must add SKU variants in Style Master first.
- There are no Payment Terms, Shipping Address or Remarks boxes on this screen. Payment terms fill in automatically from the customer's credit days.
- When you reopen the order with **Edit Order** and it already has approved BOMs or active material requirements, a warning banner appears and **Style**, **Total Qty**, the size grid, the **Absolute** / **Percentage** / **Ratio** buttons, **Smart Distribute** and **Recalculate** are all disabled. The banner tells you to use **Add Size Breakdown** on the order page instead — that is the only way to enter the sizes at that stage.
- An order started from a sale order can carry several styles. An amber notice on the edit page says the form edits the **first style only** — the other styles are kept unchanged when you save.

## After saving
You return to the Orders list. The next step is **Create BOM** on the order's row.
If a dialog titled **Processor rate differs at this order quantity** appears when creating the BOM, the order's quantity falls in a different processor rate band than the style was costed at. Click **Accept order-quantity rates** to continue — the accepted rates apply to this order's BOM only, and the style costing is not changed.

## Add the size breakdown later
An order can be created with the total quantity only, so long-lead greige, dyeing and printing can be procured while the sizes are still being confirmed. Enter the sizes on the order page, not in **Edit Order**.

1. Open the order and scroll to **Order Items**.
2. The item shows **Size breakdown not specified**. Click **Add Size Breakdown**.
3. A dialog titled **Add Size Breakdown** opens. Click **Distribute … evenly** (the button carries the item's total, for example *Distribute 600 evenly*) to spread the pieces across every size, or type the pieces into the box under each size name.
4. Check the **Entered: X / Y pcs** counter. X is what you typed, Y is what the order currently carries.
5. Click **Save Size Breakdown**.
6. If the sizes add up to a different total, the save is refused once and a message explains the difference. The button then reads **Confirm & change quantity to N**. Clicking it saves the sizes and changes the order quantity to N.

This works even when the order already has an approved BOM or material requirements. Saving refreshes the material requirements and creates the production work orders, which cannot exist while an order has no sizes.

Traps in this dialog:
- **This style has no sizes defined** means you must add the sizes to the style first, then return.
- At least one size must have a quantity above zero.
- Only sizes belonging to the order's style are accepted.
- A **Cancelled** or **Split** order will not accept a size breakdown.
- If the confirmation message mentions requirements already on a purchase order, those are not adjusted automatically — check them yourself afterwards.
