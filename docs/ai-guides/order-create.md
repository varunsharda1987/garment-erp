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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/OrderList.tsx
  - frontend/src/pages/OrderForm.tsx
  - frontend/src/types/order.types.ts
  - backend/src/schemas/order.schema.ts
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
8. Open **Quantity & Pricing** to split the quantity. Choose **Absolute**, **Percentage** or **Ratio**. In Absolute, type pieces into the colour × size grid or click **Smart Distribute**. In Percentage/Ratio, type the share per size and click **Recalculate**.
9. If the customer has size presets, **Size Override (Optional)** lets you swap the style's default sizes.
10. Click **Create Order** in the bar at the bottom of the screen.

## Validation traps
- The bottom bar shows **x/5 required fields**. **Create Order** stays greyed out until all five pass: Customer, Style, Qty, Delivery date and an approved cost sheet.
- Size breakup and Unit Price are optional. A quantity mismatch warning is only information — the order saves with the Total Qty you typed.
- "This style has no size options" means you must add SKU variants in Style Master first.
- There are no Payment Terms, Shipping Address or Remarks boxes on this screen. Payment terms fill in automatically from the customer's credit days.
- When editing later, if an approved or locked BOM or MRP requirements exist, Style, Total Qty and the size breakdown are locked.

## After saving
You return to the Orders list. The next step is **Create BOM** on the order's row.
