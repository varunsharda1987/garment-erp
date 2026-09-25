---
slug: fabric-costing-options
title: Compare Fabric Costing Options
keywords:
  # English
  - costing options
  - fabric comparison
  - processor comparison
  - cost comparison
  - compare fabric costing
  - fabric costing options
  - approve costing
  - unapprove costing
  - costing approval
  - preferred processor
  - cost per meter
  - greige requirement
  - fabric requirement
  - shrinkage cost
  - processing cost
  # Hinglish
  - costing compare karna
  - option dekhna
  - fabric costing option
  - processor compare karna
  - approve karna
  - costing dekho
  - cost compare karo
  - fabric ka rate dekho
  # Devanagari (MANDATORY)
  - कॉस्टिंग ऑप्शन
  - तुलना करना
  - फैब्रिक कॉस्टिंग
  - प्रोसेसर तुलना
  - अप्रूव करना
  - कॉस्ट देखना
  - रेट तुलना
  - ऑप्शन देखना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingOptionsPage.tsx
  - frontend/src/services/fabricCosting.service.ts
  - frontend/src/types/fabricCosting.types.ts
route: /fabric-costing/options
---

## Navigate to Costing Options

1. Click **Pre-Production** in the sidebar
2. Click **Costing Options**
3. The page shows all saved fabric costing options grouped by style

## Filter Options

Use the filters at the top to narrow down results:

1. **Customer** - Select a customer to see only their styles
2. **Style** - Select a specific style (requires customer selection first)
3. **Processor** - Filter by fabric processor
4. **Status** - Choose All, Approved, or Pending
5. Click **Clear** to reset all filters

## Purpose Tabs

Switch between different costing purposes using the tabs:

- **All** - Shows all costing options
- **Costing** - Options created for cost estimation
- **Raw Mat** - Options for raw material calculation

The count next to each tab shows how many options exist. There is no Production tab: a Production CAD (one per received fabric lot) is made and approved in **CAD Planning** and is never costed.

## Understanding the Comparison Table

Each style shows its fabric components. For each component, you see multiple costing options in a table:

| Column | Meaning |
|--------|---------|
| **Greige** | Base greige fabric name |
| **CW** | Cutable width in inches |
| **Qty (pcs)** | Order quantity in pieces |
| **Mode** | Purpose - Costing or Raw Mat |
| **Greige +Trp** | Greige cost plus transport per meter |
| **Processor** | Fabric processor name (or Direct) |
| **Process** | Processing cost per meter with color count |
| **Shrink** | Shrinkage cost per meter with percentage |
| **Total** | Total cost per meter (key comparison number) |
| **Part Cost** | Cost per garment piece (CAD average x Total) |
| **Fabric Req** | Total finished fabric needed in meters |
| **Greige Req** | Total greige needed (accounts for shrinkage) |
| **Status** | Approved, Alternate, or Pending |

## Compare Options

To compare costing options for the same fabric:

1. Look at rows within the same component group
2. Compare **Total** (cost per meter) - lower is better for margin
3. Check **Greige Req** - shows actual raw material needed
4. Review **Processor** - different processors may have different quality
5. Options are grouped by **Order Qty** when multiple quantities exist

## Approve a Costing Option

1. Find the option you want to approve
2. Click the **three-dot menu** (Actions)
3. Click **Approve**
4. The row turns green and shows Approved badge

Only one option per fabric can be APPROVED (others become Alternate if approved).

## Unapprove an Option

1. Click the **three-dot menu** on an approved option
2. Click **Unapprove**
3. If the option is used by orders, an impact dialog shows:
   - Which orders/documents reference this costing
   - Whether unapproval is allowed or blocked

## Remove a Costing Option

1. Click the **three-dot menu** on a pending option
2. Click **Remove Costing**
3. Confirm the deletion
4. The CAD planning data is preserved; only costing details are removed

**Note:** Cannot remove approved options. Unapprove first.

## Create Cost Sheet

When ALL fabric options for a style are approved:

1. A **Create Cost Sheet** button appears on the component row
2. Click it to navigate to cost sheet creation
3. The approved fabric costs are pre-filled

## Quick Actions

- **Edit Costing** button on style header - Opens the Fabric Costing page for that style
- **+ New Costing** button - Creates new costing from scratch
- **Back** button - Returns to previous page

## Badges Explained

| Badge | Meaning |
|-------|---------|
| **All Approved** (green) | Every component in the style has an approved option |
| **Approved** (green) | This specific option is approved |
| **Alternate** (yellow) | Approved as backup; another option is primary |
| **Pending** (gray) | Not yet approved |

## Traps

- **Cannot unapprove** if the costing is used by live orders or cost sheets. The system shows which documents block the change.
- **Must select Customer first** before the Style dropdown becomes active.
- **Quantity groups** - Options at different order quantities may have different rates due to rate slabs. Compare within the same quantity group.
- **Total cost includes shrinkage** - The greige you buy shrinks during processing, so the effective cost per finished meter is higher.
