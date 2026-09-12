---
slug: fabric-costing-approve
title: Approve Fabric Costing
keywords:
  # English
  - approve costing
  - fabric costing approval
  - lock costing
  - approve fabric cost
  - costing approval
  - lock fabric rate
  - approve rate
  # Hinglish
  - costing approve karna
  - fabric costing pass
  - costing lock karna
  - rate approve karo
  - fabric rate pass
  # Devanagari
  - कॉस्टिंग अप्रूव
  - फैब्रिक कॉस्टिंग पास
  - कॉस्टिंग लॉक करना
  - रेट अप्रूव करो
  - फैब्रिक रेट पास
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingPage.tsx
  - frontend/src/pages/FabricCostingOptionsPage.tsx
route: /fabric-costing
---

## Before you start

- You must have a saved fabric costing (not just entered values - it must be saved first)
- The costing must have a calculated total cost per meter
- Approval happens on the **Costing Options** page, not the main Fabric Costing entry page

## Steps

1. Go to **Pre-Production** in the sidebar
2. Click **Costing Options**
3. Filter to find your style:
   - Select Customer from the dropdown
   - Select Style from the dropdown
   - Or use the Purpose tabs (Costing / Raw Mat / Production) to filter
4. Find the costing option you want to approve in the table
5. Click the **three-dot menu** (More options) on the right side of the row
6. Click **Approve**
7. The status will change to show a green **Approved** badge with a lock icon

## Alternate route

- From the **Fabric Costing** page after saving, click **View Style Options** button
- This takes you directly to the Costing Options page filtered to that style

## What approval means

- **Costs are locked**: Approved costings cannot be edited until unapproved
- **Used by downstream modules**: Cost sheets, Order BOM, and MRP use approved costing rates
- **Frozen for orders**: Once orders use this costing, the rate is frozen
- **Two approval types exist**:
  - CAD geometry approval (how much fabric is needed)
  - Price approval (what the fabric costs) - this is what Fabric Costing manages

## Unapproving a costing

1. Go to **Pre-Production** > **Costing Options**
2. Find the approved costing (shows green Approved badge)
3. Click the **three-dot menu**
4. Click **Unapprove**
5. If the costing is used by orders or cost sheets, a dialog shows which documents depend on it
   - You may need to handle those documents first before unapproving

## Traps

- **Cannot edit after approval**: You must unapprove first on the Costing Options page to make changes
- **Downstream documents may block unapprove**: If orders or cost sheets use this rate, unapprove shows a warning dialog
- **Save before approving**: The approve option only appears for saved costings with a total cost
- **Approval is per-option**: Each width/processor combination is approved separately
