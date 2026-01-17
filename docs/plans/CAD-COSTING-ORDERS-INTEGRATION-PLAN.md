# CAD Planning, Fabric Costing, Cost Sheet & Orders Integration Plan

## Document Purpose
This document captures the detailed features and relationships between four interconnected modules. Requirements will be documented here before implementation begins.

**Status:** ✅ REQUIREMENTS COMPLETE - Ready for Implementation Planning

---

## Current System Overview

### Module Summary

| Module | Primary Purpose | Key Database Models |
|--------|----------------|---------------------|
| CAD Planning | Calculate fabric consumption per piece | `fabric_width_cad`, `cad_size_breakdown` |
| Fabric Costing | Calculate cost per meter (3 strategies) | Uses `fabric_width_cad` costing columns |
| Cost Sheet | Aggregate all costs → final price per piece | `style_costing`, `style_costing_fabric_items` |
| Orders | Customer orders with delivery tracking | `orders`, `order_items`, `order_item_breakup` |

### Current Data Flow

```
┌─────────────┐
│   STYLE     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   CAD PLANNING      │  ← Calculates: width, meters, average consumption
│   fabric_width_cad  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   FABRIC COSTING    │  ← Calculates: cost per meter (3 strategies)
│   + processor rates │     • Stock Reuse
│                     │     • Ready Fabric
│                     │     • Greige + Processing
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   COST SHEET        │  ← Assembles: fabric + trims + CMT costs
│   style_costing     │     → Final cost per piece
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   ORDERS            │  ← Uses cost sheet for unit pricing
│   orders            │     → Work orders, production
└─────────────────────┘
```

### Existing Features by Module

#### 1. CAD Planning
- Multi-purpose modes: PLANNING → COSTING → PRODUCTION
- Width variant management (cutableWidth)
- Greige selection from `greige_master`
- Pattern part assignment
- Size-based quantity breakdown (`cad_size_breakdown`)
- Embroidery CAD planning
- CAD approval workflow with versioning

#### 2. Fabric Costing
- **Three Sourcing Strategies:**
  1. Stock Reuse - existing fabric at weighted average cost
  2. Ready Fabric - purchase finished fabric
  3. Greige + Processing - buy greige, process it
- Cost breakdown: greige + transport + processing + shrinkage + screen cost
- Processor rate card lookup
- Approval workflow for costing options

#### 3. Cost Sheet
- Fabric line items (from Fabric Costing)
- Trim line items (thread, lace, buttons, zippers, elastics, labels, packaging)
- Embroidery costs
- CMT costs (Cutting, Stitching, Finishing, Button Attachment, Handwork)
- Value loss % and Markup % calculation
- Version control with supersession tracking
- Cost variance monitoring

#### 4. Orders
- Order numbering: ORD{YEAR}{MONTH}{SEQUENCE}
- Size/color breakup support
- Status workflow: PENDING → IN_PRODUCTION → COMPLETED → DISPATCHED
- Priority levels: LOW, MEDIUM, HIGH, URGENT
- Order-specific costing recalculation
- Work order creation
- Delivery note integration

---

## Requirements Documentation

---

### Section 1: CAD Planning Features & Changes

#### 1.1 Mode Renaming (CRITICAL)

**Current Modes → New Modes:**
| Current | New | Purpose |
|---------|-----|---------|
| PLANNING | **COSTING** | For costing purpose - rough estimates |
| COSTING | **RAW_MATERIAL_CALCULATION** | Used once we have final order quantity from buyer |
| PRODUCTION | **PRODUCTION** | Used when fabric is inwarded; actual fabric width determines if Raw Material Calculation can be used |

**Decision:** Replace everywhere (database enum, code, and UI) - not just UI labels

#### 1.2 Cutable Width Improvements

**Current State (Issue):**
- Width options generated dynamically from `expectedFinishedWidthMin/Max` from greige
- Only min and max values displayed, nothing in between shown explicitly
- Widths generated in 2" increments internally but not clearly visible

**Required Changes:**
- [ ] Must use **Cutable Width** as the primary field
- [ ] Derive cutable width options FROM greige min/max range
- [ ] Display ALL width options between min and max (not just endpoints)
- [ ] Make intermediate widths clearly selectable
- [ ] **Use 1 inch increments** (e.g., 44, 45, 46, 47, 48...)

#### 1.3 Size Quantity UX Improvements

**Context:** Sizes are already all selected by default. The issue is about QUANTITY entry.

**Required Changes:**
- [ ] Add **"Select All Sizes"** button that applies a quantity to ALL sizes at once
- [ ] Add **quantity increment (+) button** against each size row for quick qty addition
- [ ] User can then adjust individual size quantities after bulk selection

#### 1.4 Mode Workflow Details

**COSTING Mode:**
- User can create MULTIPLE CAD entries for SAME pattern part at DIFFERENT widths (to compare options)
- Example: Body @ 44", Body @ 46", Body @ 48" - all valid in COSTING mode
- All width options preserved for future use

**COSTING → RAW_MATERIAL_CALCULATION Transition:**
- User SELECTS ONE width option per pattern part to proceed
- Size ratios CAN be changed in RAW_MAT mode
- Width IS STILL EDITABLE in RAW_MAT mode if needed
- **Unselected width options:** KEPT in COSTING mode for future orders

**RAW_MATERIAL_CALCULATION → PRODUCTION Transition:**
- Triggered when fabric is inwarded (GRN)
- **Key reason for PRODUCTION mode:** Actual fabric width often differs from planned width
- User must recalculate consumption with actual inwarded width
- System shows VARIANCE between planned (RAW_MAT) and actual (PRODUCTION) consumption

#### 1.5 Skip-Mode Scenario

**Scenario:** Raw material already in-house + order quantity known
- User should NOT need to go through all three modes (COSTING → RAW_MATERIAL_CALCULATION → PRODUCTION)
- Doesn't make sense to do rough estimates when raw material and order qty are already available
- **Solution:** Allow direct entry to PRODUCTION mode with actual fabric width
- **Cost Sheet:** Uses rates from Style-Linked Fabric (fabric master rates)

---

### Section 2: Fabric Costing Features & Changes

#### 2.1 Processor Selection UX

**Required Changes:**
- [ ] Add **search and type functionality** when selecting processor
- [ ] Current: Dropdown selection only
- [ ] Needed: Searchable dropdown with type-ahead

#### 2.2 Greige Rate Logic Improvements

**Current State:**
```
Priority chain: Procurement Rate → Stock Valuation → Greige Master Default → null
If all sources = 0 or null → Returns available: false
```

**Issues Identified:**
1. If greige rate = 0, system falls back to default rate ✓
2. If greige rate > 0, should check from stock ✓
3. **Problem:** Current approach doesn't reflect current greige price which might be higher than stored rates

**Required Changes:**
- [ ] Show rate SOURCE with date (Stock/Procurement/Master) so user knows where rate came from
- [ ] Allow MANUAL OVERRIDE when current market rate differs
- [ ] Flag when using outdated rates vs current procurement rates

**Decision:** Implement BOTH features - show source info AND allow manual override

#### 2.3 Fabric Costing Trigger & Preservation

**Trigger:** Auto-create costing when CAD is saved with width (from COSTING mode)

**Preservation Strategy:**
- ALL width-based CAD entries preserved (not just selected one)
- ALL corresponding costing calculations preserved
- When user selects one option for RAW_MATERIAL_CALCULATION, others remain available
- Different orders can use different width options from the preserved set

**Key Insight:**
> "I want to calculate fabric cost at different widths and have them ALL in the system, as we might need to use a different width in next order"

**Required Changes:**
- [ ] Auto-create fabric costing when CAD saved in COSTING mode
- [ ] Preserve ALL width-based CAD + costing options (not just approved one)
- [ ] Unselected options remain in COSTING mode for future orders
- [ ] Each order can select from available costing options

#### 2.4 UI/UX Overhaul

**Requires complete redesign of:**
- [ ] Mode navigation/progression
- [ ] Multi-width costing display
- [ ] Approval workflow integration with orders
- [ ] Historical costing options visibility

---

### Section 3: Cost Sheet Features & Changes

#### 3.1 Cost Sheet Creation & Structure

**When Created:** After COSTING mode CAD + Fabric Costing is complete

**Structure:**
- **MULTIPLE Cost Sheets per style** - one for each width combination
- Example: Style "XYZ" can have:
  - Cost Sheet A: Body @ 44", Sleeve @ 42"
  - Cost Sheet B: Body @ 46", Sleeve @ 44"
  - Cost Sheet C: Body @ 48", Sleeve @ 46"

**Width Options Display:**
- Show ALL available width options from COSTING mode
- User has freedom to create Cost Sheet with ANY width combination
- Each unique width combination = separate Cost Sheet

#### 3.2 Cost Sheet Approval

**Requirement:**
> "If the costing for a style is not approved, a user cannot generate an order"

**Approval Logic:**
- User approves SELECTED Cost Sheets only (not all)
- Only APPROVED Cost Sheets can be used for Order creation
- Unapproved Cost Sheets remain available for future approval

**Required Changes:**
- [ ] Add approval status to each Cost Sheet (PENDING, APPROVED, REJECTED)
- [ ] Block order creation unless at least ONE Cost Sheet is approved for the style
- [ ] Show approval status clearly in Order creation flow
- [ ] Allow multiple approved Cost Sheets (different width combinations)

#### 3.3 Skip-Mode Cost Sheet

**Scenario:** Raw material already in-house (skipping COSTING mode)

**Solution:**
- Allow direct Cost Sheet creation using:
  - Actual fabric width from stock
  - Rates from Style-Linked Fabric (fabric master rates)
- No need for COSTING mode CAD entries in this scenario

---

### Section 4: Orders Features & Changes

#### 4.1 Pre-requisite Validation

**Required Validation Before Order Creation:**
- [ ] At least ONE Cost Sheet must be APPROVED for the style
- [ ] Block order creation if no approved Cost Sheet exists
- [ ] Show clear error message with link to pending Cost Sheet(s)

#### 4.2 Cost Sheet Selection for Order

**Selection Method:** Comparison View
- Show side-by-side comparison of ALL approved Cost Sheets for the style
- Display width combination, total cost, cost breakdown for each
- User selects ONE Cost Sheet for the order

**After Order Created:**
- Order keeps SNAPSHOT of costs at time of creation
- If source Cost Sheet is later modified, Order is UNAFFECTED
- Order stores its own copy of costing data (not a reference)

#### 4.3 Order Cost Variance Tracking

**Requirement:** Show variance between Cost Sheet estimate and actual PRODUCTION costs

**What to Display:**
- Estimated cost (from selected Cost Sheet at order creation)
- Actual cost (calculated after PRODUCTION mode with real fabric width)
- Variance amount and percentage
- Highlight significant variances (positive/negative)

**When Available:**
- Variance calculated after PRODUCTION mode CAD is complete
- Before PRODUCTION mode: show "Pending actual costs"

---

### Section 5: Cross-Module Relationships

#### 5.1 Revised Data Flow

```
STYLE
  │
  ├──► CAD PLANNING (Mode: COSTING)
  │    └── Multiple width options per pattern part
  │    └── Example: Body @ 44", 46", 48"
  │
  ├──► FABRIC COSTING (Auto-triggered)
  │    └── Auto-calculate cost for EACH CAD entry
  │    └── Store ALL options
  │
  ├──► COST SHEET (Multiple per style)
  │    └── One Cost Sheet per width combination
  │    └── User creates from available COSTING options
  │    └── MUST BE APPROVED before order
  │
  ├──► ORDER CREATED
  │    └── Comparison view of approved Cost Sheets
  │    └── User selects ONE Cost Sheet
  │    └── SNAPSHOT copied to Order
  │
  ├──► CAD PLANNING (Mode: RAW_MATERIAL_CALCULATION)
  │    └── Select ONE width per pattern part
  │    └── Size ratios updated with order qty
  │    └── Width still editable if needed
  │
  └──► CAD PLANNING (Mode: PRODUCTION)
       └── Triggered by GRN (fabric inward)
       └── Actual fabric width entered
       └── VARIANCE calculated vs RAW_MAT estimate
       └── Variance shown on Order
```

#### 5.2 Key Integration Points

| From | To | Data | Trigger | Notes |
|------|-----|------|---------|-------|
| CAD (COSTING) | Fabric Costing | width, consumption | Auto on CAD save | Multiple widths per part |
| Fabric Costing | Cost Sheet | cost per width option | User creates | Multiple Cost Sheets possible |
| Cost Sheet | Orders | Comparison view | Approval | User selects one, SNAPSHOT copied |
| Orders | CAD (RAW_MAT) | Order qty | Order confirmed | Select one width per part |
| GRN (Fabric In) | CAD (PRODUCTION) | Actual width | Fabric inwarded | Recalculate, show variance |
| CAD (PRODUCTION) | Order | Actual cost | Production complete | Variance displayed on Order |

#### 5.3 Skip-Mode Shortcut

**Scenario:** Raw material already in-house + order qty known

| Step | Action |
|------|--------|
| 1 | Skip COSTING and RAW_MAT modes |
| 2 | Go directly to PRODUCTION mode |
| 3 | Enter actual fabric width from stock |
| 4 | Create Cost Sheet using Style-Linked Fabric rates |
| 5 | Approve Cost Sheet |
| 6 | Create Order with approved Cost Sheet |

**Note:** Cost Sheet still required even in skip-mode (using stock fabric rates)

---

### Section 6: Workflow & Approvals

#### 6.1 Approval Gates

| Stage | What Gets Approved | Blocks | Notes |
|-------|-------------------|--------|-------|
| Cost Sheet | Individual Cost Sheet (specific width combo) | Order creation | Multiple can be approved per style |

#### 6.2 Complete Workflow

```
1. STYLE CREATED
   └── Fabrics linked to style

2. CAD PLANNING - COSTING MODE
   └── Create CAD entries for pattern parts
   └── Multiple widths allowed per part (e.g., Body @ 44", 46", 48")
   └── Save triggers auto Fabric Costing calculation

3. FABRIC COSTING (Auto)
   └── Cost calculated for EACH CAD entry
   └── Show rate source (Stock/Procurement/Master) + date
   └── Allow manual override if needed
   └── All options preserved

4. COST SHEET CREATION
   └── User creates Cost Sheet from available COSTING options
   └── Select width combination (e.g., Body @ 46", Sleeve @ 44")
   └── Each combination = separate Cost Sheet
   └── Multiple Cost Sheets can exist per style

5. COST SHEET APPROVAL
   └── User approves selected Cost Sheets
   └── Only approved Cost Sheets available for Orders
   └── Unapproved remain for future approval

6. ORDER CREATION
   └── BLOCKED if no approved Cost Sheet exists
   └── Show comparison view of approved Cost Sheets
   └── User selects ONE Cost Sheet
   └── SNAPSHOT copied to Order

7. CAD PLANNING - RAW_MATERIAL_CALCULATION MODE
   └── AUTO-TRIGGERED when Order is confirmed
   └── Show all COSTING options, user MUST SELECT widths
   └── Select ONE width per pattern part
   └── Adjust size ratios with actual order qty
   └── Width still editable if needed

8. GRN (Fabric Inward)
   └── Record actual fabric width received

9. CAD PLANNING - PRODUCTION MODE
   └── Triggered after GRN
   └── Enter actual fabric width
   └── Recalculate consumption
   └── Calculate VARIANCE vs RAW_MAT estimate

10. ORDER VARIANCE DISPLAY
    └── Show estimated vs actual costs
    └── Highlight significant variances
```

#### 6.3 Decisions Made

| Question | Decision | Notes |
|----------|----------|-------|
| Mode naming | Replace everywhere | DB enum, code, and UI all use new names |
| Width increment | 1 inch | Show all widths between min/max in 1" steps |
| Order uses costing - copied or referenced? | **COPY (Snapshot)** | Order gets its own copy |
| Skip-mode fabric costs | **From Style-Linked Fabric** | Use fabric master rates |
| Cost Sheet timing | After COSTING mode | Created from COSTING mode options |
| Multiple Cost Sheets per style | Yes | One per width combination |
| Cost Sheet approval | Selected only | Approve specific Cost Sheets, not all |
| Order Cost Sheet selection | Comparison view | Side-by-side view of approved options |
| Cost Sheet modification after Order | Order unaffected | Snapshot preserved |
| Order variance tracking | Yes | Show estimated vs actual from PRODUCTION |
| Width suggestion in COSTING | No | Show all options equally, user decides |
| RAW_MAT mode trigger | Auto-trigger | Auto-creates when Order confirmed |
| RAW_MAT width pre-selection | User must select | Show all COSTING options, user selects |
| Order scope | One style per Order | Each Order is for single style only |

#### 6.4 Additional Decisions

| Question | Decision | Notes |
|----------|----------|-------|
| Cost Sheet approval authority | **Admin Only** | Only Admin role can approve Cost Sheets |
| Modifying approved Cost Sheet | **Create New Version** | Cannot edit approved; must create new version (v1 → v2) |

#### 6.5 Cost Sheet Versioning Rules

- Approved Cost Sheets are IMMUTABLE (cannot be edited)
- To modify, create a NEW VERSION (v1 → v2 → v3...)
- Previous versions remain accessible for reference
- Orders linked to a version continue using that version's snapshot
- New orders can only select from APPROVED versions

#### 6.6 Repeat Orders & RAW_MAT Cloning

- Each Order gets its own RAW_MAT calculation
- **Clone Option:** User can clone previous Order's RAW_MAT as starting point
- Cloned RAW_MAT can be adjusted for new order quantities
- Useful for repeat orders of same style

#### 6.7 PRODUCTION Variance Approval

**Threshold:** Variance > **3%** requires approval

**Workflow:**
- If variance ≤ 3%: Proceed normally, just display variance
- If variance > 3%:
  - Block production progress
  - Require Admin approval to proceed
  - Admin can approve or reject with notes

**Approver:** Admin role (same as Cost Sheet approval)

---

## Implementation Plan

*To be completed after requirements are finalized*

### Database Schema Changes
```prisma
// Schema changes will be documented here
```

### API Changes
- New endpoints
- Modified endpoints
- Deprecated endpoints

### Frontend Changes
- New pages/components
- Modified workflows
- UI/UX updates

### Migration Strategy
- Data migration steps
- Backward compatibility considerations

---

## Notes & Decisions

*Record important decisions and context here during requirements gathering*

| Date | Decision | Rationale |
|------|----------|-----------|
| | | |

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-15 | Claude | Initial document creation with current system overview |
| 2026-01-15 | Claude | Added all requirements after detailed Q&A session |
| 2026-01-15 | Claude | Requirements complete - ready for implementation |
| 2026-01-15 | Claude | Implemented: Size breakdown popup UI improvements |
| 2026-01-15 | Claude | Fixed: Prisma upsert error (`processorId must not be null`) |
| 2026-01-15 | Claude | Fixed: Cost sheet auto-generation (CAD values not populating) |

---

## Implementation Progress

### Completed Changes (2026-01-15)

#### 1. Size Breakdown Popup UI Improvements
**File:** `frontend/src/components/cad/CADSpreadsheetTable.tsx`

**Changes Made:**
- ✅ Removed -10 and +10 quantity adjustment buttons
- ✅ Changed "Apply to All" from input field to single "+ Add 1 to all" button
- ✅ Simplified quantity entry UX - users click + button to increment all sizes by 1

**Code Added:**
```typescript
const handleIncrementAll = () => {
  const safeSizeOptions = sizeOptions || [];
  setBreakdowns((prev) => {
    const newBreakdowns: Record<string, number> = { ...prev };
    safeSizeOptions.forEach((size) => {
      newBreakdowns[size.name] = (newBreakdowns[size.name] || 0) + 1;
    });
    return newBreakdowns;
  });
};
```

---

#### 2. Prisma Upsert Error Fix (`processorId must not be null`)
**Files Modified:**
- `backend/prisma/schema.prisma` (line ~3865)
- `backend/src/controllers/fabric-costing.controller.ts` (line ~695)

**Problem:**
The `fabric_width_cad` table had a composite unique constraint including `processorId`, but `processorId` is nullable. Prisma doesn't allow null values in composite unique constraints.

**Solution:**
- Removed `processorId` from the unique constraint in schema.prisma
- Changed: `@@unique([costingStyleId, componentName, cutableWidth, processorId, purpose])`
- To: `@@unique([costingStyleId, componentName, cutableWidth, purpose])`
- Updated upsert in fabric-costing.controller.ts to use new composite key name
- Applied with `npx prisma db push`

---

#### 3. Cost Sheet Auto-Generation Fix (CAD values not appearing)
**File:** `backend/src/controllers/styleCosting.controller.ts` (lines 867-951)

**Problem:**
When clicking "Auto-generate from CAD" in cost sheet form, fabric costs, widths, and meters were not populating.

**Root Cause Analysis:**
The `fabric_width_cad` table has TWO different relationships:
1. `costingStyleId` → Links directly to `styles` table (used by Fabric Costing)
2. `styleFabricId` → Links to `style_fabrics` table (component-level)

**The Issue:**
- Fabric Costing saves data with `costingStyleId` (style-level)
- Cost Sheet generation was querying through `style_fabrics.cadRows` which requires `styleFabricId`
- But Fabric Costing NEVER sets `styleFabricId`, so `cadRows` always returned empty

**Solution:**
Changed the approach to query `fabric_width_cad` directly by `costingStyleId`:

```typescript
// NEW: Direct query for COSTING CAD data
const costingCadRows = await prisma.fabric_width_cad.findMany({
  where: {
    costingStyleId: styleId,
    purpose: 'COSTING',
  },
  include: {
    fabric: { select: { fabricName: true } },
    greige: { select: { greigeName: true } },
  },
  orderBy: { updatedAt: 'desc' },
});
```

**Key Changes:**
1. Added direct query for `fabric_width_cad` by `costingStyleId`
2. Group by `componentName` to avoid duplicates (takes latest per component)
3. Use `totalCostPerMeter` from CAD row as fabric rate (already calculated in Fabric Costing)
4. Fallback mechanism - if no COSTING CAD found, falls back to legacy `style_fabrics` data

**Data Flow Now Works:**
| Field | Source |
|-------|--------|
| `fabricWidth` | `cadRow.cutableWidth` |
| `fabricAverage` | `cadRow.cadMeters` |
| `fabricRate` | `cadRow.totalCostPerMeter` |
| `fabricName` | `cadRow.fabric.fabricName` or `cadRow.greige.greigeName` or `cadRow.componentName` |

---

### Technical Notes

#### Understanding the `fabric_width_cad` Relationships

The table has multiple relationships that serve different purposes:

| Relationship | Field | Used By | Purpose |
|-------------|-------|---------|---------|
| `costingStyleId` | Links to `styles` | Fabric Costing | Style-level costing calculations |
| `styleFabricId` | Links to `style_fabrics` | CAD Planning | Component-level CAD entries |
| `fabricId` | Links to `fabric_master` | Both | Fabric reference |
| `greigeId` | Links to `greige_master` | Fabric Costing | Greige selection |

**Key Insight:**
- Fabric Costing saves with `costingStyleId` (style-level)
- CAD Planning saves with `styleFabricId` (component-level)
- Cost Sheet generation should query by `costingStyleId` to get fabric costing data

---

## Summary of Key Changes Required

### Database Changes
1. Rename enum: PLANNING → COSTING, COSTING → RAW_MATERIAL_CALCULATION
2. Add Cost Sheet approval status field (PENDING, APPROVED, REJECTED)
3. Add Cost Sheet version tracking
4. Add Order costing snapshot table
5. Add PRODUCTION variance fields with approval status

### Backend Changes
1. Mode renaming across all controllers/services
2. Auto-trigger fabric costing on CAD save
3. Cost Sheet approval workflow (Admin only)
4. Cost Sheet versioning logic
5. Order-Cost Sheet snapshot on creation
6. RAW_MAT auto-trigger on Order confirmation
7. PRODUCTION variance calculation
8. Variance approval workflow (>3% threshold)
9. Greige rate source display + manual override

### Frontend Changes
1. Mode label changes in all CAD/Costing UIs
2. Cutable width: 1" increments, show all options
3. Size quantity: "Apply to All" button + increment buttons
4. Searchable processor dropdown in Fabric Costing
5. Multiple Cost Sheets per style UI
6. Cost Sheet comparison view for Order creation
7. Cost Sheet approval UI (Admin)
8. PRODUCTION variance display on Order
9. Variance approval UI (>3% threshold)
10. RAW_MAT cloning from previous Order
