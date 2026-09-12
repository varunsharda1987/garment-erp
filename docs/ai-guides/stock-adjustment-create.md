---
slug: stock-adjustment-create
title: Adjust Stock (Shortage/Excess)
keywords:
  # English
  - stock adjustment
  - shortage
  - excess
  - stock correction
  - inventory adjustment
  - adjust stock
  - write off
  - damaged stock
  - lost stock
  - found stock
  # Hinglish
  - stock adjustment karna
  - kami ya adhik
  - stock theek karna
  - stock correct karna
  - inventory adjust karna
  # Devanagari
  - स्टॉक एडजस्टमेंट
  - कमी
  - अधिक
  - स्टॉक करेक्शन
  - इन्वेंटरी एडजस्टमेंट
  - स्टॉक ठीक करना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StockAdjustmentForm.tsx
  - frontend/src/pages/StockMovementList.tsx
route: /stock/adjustments/new
---

## Before you start

- Physical stock count completed with variance identified
- Know the warehouse and material that needs adjustment
- Have a clear reason for the adjustment (e.g., damaged, lost, found)

## Steps

1. Open **Inventory > Material Movements** in the sidebar.

2. Click the **New Movement** dropdown button (top right).

3. Select **Adjustment** from the menu.

4. Select the **Warehouse** where the adjustment applies.

5. Select the **Material** from the dropdown.
   - Only materials with stock in the selected warehouse appear
   - Shows current stock quantity next to each material

6. Review the **Current Stock** info banner showing quantity and valuation rate.

7. Choose the **Adjustment Type**:
   - **Increase Stock** - found extra stock during count
   - **Decrease Stock** - shortage discovered (damaged, lost, etc.)

8. Enter the **Quantity to Add** or **Quantity to Subtract**.
   - Unit auto-fills from the material
   - Cannot decrease more than available stock

9. Select **Reason for Adjustment**:
   - **Damaged** - material damaged or defective
   - **Expired** - material expired or obsolete
   - **Lost** - material lost or stolen
   - **Found** - material found during count
   - **Correction** - correcting previous error
   - **Other** - see remarks

10. Enter **Detailed Remarks** explaining the adjustment.

11. Click **Create Adjustment** (red button for decrease, blue for increase).

## Adjustment reasons

| Reason | When to use |
|--------|-------------|
| Damaged | Physical damage, defects, water damage |
| Expired | Past shelf life, obsolete materials |
| Lost | Cannot locate, suspected theft |
| Found | Extra stock discovered during count |
| Correction | Fixing data entry or GRN errors |
| Other | Any reason not covered above |

## Traps

- **Reason is required** - system won't accept "no reason" adjustments
- **Remarks are mandatory** - provide clear explanation for audit trail
- **Cannot over-decrease** - system blocks reducing below zero
- **Quantity must be positive** - enter the adjustment amount, not the final stock

## After saving

- Stock level immediately updated in the system
- Movement recorded with ADJUSTMENT direction
- Valuation updated based on current rate
- Audit trail preserved with user, reason, and remarks
