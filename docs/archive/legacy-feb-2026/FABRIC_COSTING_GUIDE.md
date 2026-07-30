# Fabric Costing & Processor Rate Cards - Complete Guide

> **Last Updated:** January 29, 2026
> **System Version:** V2 (Matrix-Based) with Workflow Management
> **CAD Purpose Modes:** COSTING | RAW_MATERIAL_CALCULATION | PRODUCTION
>
> **⚠️ Mode Name Change (Jan 2026):**
> - Old "PLANNING" → Now "COSTING" 🔵 (rough estimates for quotations)
> - Old "COSTING" → Now "RAW_MATERIAL_CALCULATION" 🟠 (MRP for confirmed orders)
> - "PRODUCTION" 🟢 (unchanged - final locked production)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Processor Rate Cards V2](#processor-rate-cards-v2)
4. [Default Rates Setup](#default-rates-setup)
5. [Fabric Costing Calculator](#fabric-costing-calculator)
6. [**Workflow Management (Costing/Raw Material Calculation/Production)**](#workflow-management)
7. [Integration with Cost Sheets](#integration-with-cost-sheets)
8. [Complete System Flow](#complete-system-flow)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)

---

## Quick Start

### Launch the System

**Start Backend:**
```bash
cd backend
npm run dev
```
Wait for: `Server running on port 5000`

**Start Frontend:**
```bash
cd frontend
npm run dev
```
Wait for: `Local: http://localhost:5173/`

### Access URLs

| Page | URL | Purpose |
|------|-----|---------|
| **Processor Rate Cards** | [/processor-rate-cards](http://localhost:5173/processor-rate-cards) | Manage processing rates (DYEING, PRINTING) |
| **Fabric Costing** | [/fabric-costing](http://localhost:5173/fabric-costing) | Calculate fabric costs per style |
| **Fabric Costing Options** | [/fabric-costing/options](http://localhost:5173/fabric-costing/options) | View/approve all costing options |
| **Cost Sheets** | [/cost-sheets/new](http://localhost:5173/cost-sheets/new) | Production cost sheets |

### 30-Second Setup: Default Rates

Run this command to populate default rates for all greige fabrics:

```bash
cd backend
npx ts-node prisma/seeds/seed-default-processor-rates.ts
```

**What this creates:**
- SYSTEM_DEFAULT processor
- 4 DYEING quantity slabs (0-500m, 500-1000m, 1000-5000m, 5000+m)
- 4 PRINTING quantity slabs (same ranges)
- Default rates for all greige fabrics (46 greiges)
- All 4 printing types (PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE)
- Default shrinkage (5%) and screen costs

---

## System Overview

### What Does This System Do?

The Fabric Costing System provides intelligent fabric sourcing recommendations by comparing **three strategies**:

1. **Stock Reuse** - Use existing fabric from warehouse (lowest cost, zero lead time)
2. **Ready Fabric** - Purchase finished fabric from supplier (medium cost, medium lead time)
3. **Greige + Processing** - Buy greige fabric and process it (variable cost, longer lead time)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FABRIC COSTING SYSTEM                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────┐  ┌──────────────┐  ┌───────────────┐
    │  Processor  │  │   Fabric     │  │  Cost Sheet   │
    │ Rate Cards  │  │   Costing    │  │     Form      │
    │   (Setup)   │  │   (Testing)  │  │ (Production)  │
    └─────────────┘  └──────────────┘  └───────────────┘
                              │
                              ▼
                    ┌──────────────────────────┐
                    │   Workflow Modes         │
                    │ COSTING →                │
                    │ RAW_MATERIAL_CALCULATION │
                    │ → PRODUCTION             │
                    └──────────────────────────┘
```

### Key Features

- **Matrix-Based Rate Management** - One table per processor with greige rows × quantity slab columns
- **Quantity-Based Pricing** - Different rates for different order quantities (bulk discounts)
- **Multiple Printing Types** - PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE
- **Shrinkage Tracking** - Per greige-processor combination
- **Screen Cost Management** - ROTARY, FLATBELT, TABLE screen types
- **Default Rates System** - SYSTEM_DEFAULT processor for fallback rates
- **Copy Functionality** - Duplicate rate structures between processors
- **Three-Stage Workflow** - PLANNING → COSTING → PRODUCTION with approval

---

## Processor Rate Cards V2

### What is V2?

**V2** is the current matrix-based system for managing processor rates. It replaced the legacy V1 system with superior architecture:

- **Greige-Based Matching** (not generic categories)
- **Matrix UI** (faster than form-based CRUD)
- **Shrinkage Support** (per greige-processor)
- **4 Printing Types** (PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE)
- **Screen Cost Tracking** (for printing)
- **Copy Rates** (between processors)

### Accessing the Page

**URL:** [http://localhost:5173/processor-rate-cards](http://localhost:5173/processor-rate-cards)

**You'll see:**
- Processor dropdown (select processor)
- Processing type tabs (DYEING | PRINTING)
- For PRINTING: Sub-type tabs (PIGMENT | PROCIAN | DISCHARGE | PIGMENT_DISCHARGE)
- Matrix table with:
  - **Rows:** Greige fabrics
  - **Columns:** Quantity slabs
  - **Cells:** Rate per meter input fields

### Creating Rate Cards

#### Step 1: Select Processor

Choose a processor from the dropdown. If using default rates, select **"System Default Rates"**.

#### Step 2: Choose Processing Type

Click either **DYEING** or **PRINTING** tab.

For PRINTING, you'll also choose a printing type:
- **PIGMENT** - Standard, least expensive (₹70-85/m)
- **PROCIAN** - Better color fastness, reactive dyes (₹75-90/m)
- **DISCHARGE** - Complex process, removes base color (₹80-95/m)
- **PIGMENT_DISCHARGE** - Combination, most expensive (₹85-100/m)

#### Step 3: Create Quantity Slabs (Columns)

Click **"Add Slab"** to create quantity ranges:

| Slab | Min (m) | Max (m) | Label | Rate (DYEING) | Rate (PRINTING-PIGMENT) |
|------|---------|---------|-------|---------------|-------------------------|
| 1 | 0 | 500 | 0-500m | ₹65/m | ₹85/m |
| 2 | 500 | 1000 | 500-1000m | ₹60/m | ₹80/m |
| 3 | 1000 | 5000 | 1000-5000m | ₹55/m | ₹75/m |
| 4 | 5000 | 999999 | 5000+ m | ₹50/m | ₹70/m |

**Tip:** Click on slab labels to edit ranges inline.

#### Step 4: Add Greige Fabrics (Rows)

1. Click **"Add Greige Row"** button
   - **Note:** Button is disabled until slabs exist (by design)
2. Search/select greige fabrics from modal
3. Check boxes for greiges to add
4. Click **"Add X Greige(s)"**

#### Step 5: Enter Rates

Fill in the matrix:
- **Rate cells:** Enter cost per meter for each greige-slab combination
- **Shrinkage %:** Enter shrinkage percentage for each greige
- **For PRINTING:** Also select screen type and enter screen cost per screen

#### Step 6: Save

Click **"Save All Changes"** to persist the entire matrix.

### Copy Rates Between Processors

To duplicate rate structure:

1. Set up one processor completely
2. Click **"Copy to Another Processor"**
3. Select target processor
4. Choose to copy:
   - Slabs only (structure)
   - Slabs + rates (full duplicate)
5. Click **"Copy"**

---

## Default Rates Setup

### Why Default Rates?

Default rates provide:
- **Preliminary costing** without processor commitment
- **Fallback rates** when no specific processor selected
- **Comparison baseline** for processor negotiations

### Automated Setup (Recommended)

Run the seed script:

```bash
cd backend
npx ts-node prisma/seeds/seed-default-processor-rates.ts
```

### Default Rate Configuration

#### DYEING Rates

| Quantity Range | Rate per Meter | Description |
|---------------|----------------|-------------|
| 0 - 500m | ₹65 | Small order rate |
| 500 - 1000m | ₹60 | Medium order discount |
| 1000 - 5000m | ₹55 | Bulk order discount |
| 5000+ m | ₹50 | Maximum bulk discount |

#### PRINTING Rates

| Quantity Range | PIGMENT | PROCIAN | DISCHARGE | PIGMENT_DISCHARGE |
|---------------|---------|---------|-----------|-------------------|
| 0 - 500m | ₹85 | ₹90 | ₹95 | ₹100 |
| 500 - 1000m | ₹80 | ₹85 | ₹90 | ₹95 |
| 1000 - 5000m | ₹75 | ₹80 | ₹85 | ₹90 |
| 5000+ m | ₹70 | ₹75 | ₹80 | ₹85 |

#### Default Shrinkage

All greiges: **5%** (customizable per greige)

#### Default Screen Costs

| Screen Type | Cost per Screen |
|------------|-----------------|
| ROTARY | ₹3,000 |
| FLATBELT | ₹1,100 |
| TABLE | ₹1,000 |

---

## Fabric Costing Calculator

### Accessing the Page

**URL:** [http://localhost:5173/fabric-costing](http://localhost:5173/fabric-costing)

**Purpose:** Calculate and save fabric costs for styles with approval workflow.

### Features

#### 1. Style Selection

- Quick search by style code or name
- Select customer to filter styles
- System auto-populates fabrics from the style

#### 2. Row-Level Data

Each fabric row shows:
- **Greige name** - From CAD Planning
- **CAD (m/pc)** - Per-piece consumption
- **Qty (pcs)** - Order quantity (per row)
- **Cutable Width** - Fabric width in inches
- **Finish Type** - DYED, PRINTED, YARN_DYED, RAW
- **Mode Toggle** - Build-up (B) vs Landed (L)
- **Greige + Transport** - Cost inputs
- **Processor** - Select and lookup rate
- **Colors** - Number of print colors
- **Print Type** - PIGMENT, PROCIAN, etc.
- **Screen Type** - ROTARY, FLATBELT, TABLE
- **Process Cost** - Rate from processor
- **Total (₹/m)** - Calculated total per meter
- **Approve** - Approve this costing option

#### 3. Cost Input Modes

**Build-up Mode (B):**
- Enter greige cost per meter
- Enter transport cost per meter
- Select processor and lookup rate
- System calculates: Greige + Transport + Shrinkage + Processing + Screen

**Landed Price Mode (L):**
- Enter single landed price per meter
- No processor lookup needed
- Used for ready fabric purchases

#### 4. Greige Cost Priority

The system sources greige cost in this order:
1. **Greige Procurement** - Latest procurement rate
2. **Greige Stock** - Valuation rate (WAC) from stock_levels
3. **Greige Master** - Default cost from greige_master

---

## Workflow Management

### The Three Workflow Modes

The system uses a **three-mode workflow** to track fabric cost estimates from initial costing through to final production.

| Mode | Purpose | Editable | Deletable | Can Promote To |
|------|---------|----------|-----------|----------------|
| **COSTING** | Rough estimates for quotations | Yes | Yes | RAW_MATERIAL_CALCULATION |
| **RAW_MATERIAL_CALCULATION** | MRP for confirmed orders | Yes | Yes | PRODUCTION |
| **PRODUCTION** | Final costings locked for manufacturing | **No** | **No** | N/A |

### Database Schema (fabric_width_cad)

The workflow uses these key fields:

```sql
-- Workflow Mode (CadPurpose enum)
purpose          String?   -- "COSTING" | "RAW_MATERIAL_CALCULATION" | "PRODUCTION"

-- Approval Workflow
approvalStatus   String?   -- "PENDING" | "APPROVED" | "REJECTED"
approvedBy       String?   -- User ID who approved
approvedAt       DateTime? -- Approval timestamp
approvalNotes    String?   -- Notes from approver
isPreferred      Boolean   -- Marks recommended option (only one per component)

-- Locking Mechanism (PRODUCTION only)
isLocked         Boolean   -- true = immutable record
lockedReason     String?   -- Reason for lock
lockedAt         DateTime? -- Lock timestamp
```

**Unique Constraint:**
```sql
@@unique([costingStyleId, componentName, cutableWidth, processorId, purpose])
```

This allows **multiple costing options per component** across different workflow modes.

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FABRIC COSTING WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐
  │    CREATE NEW    │
  │  COSTING OPTION  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐     Can Edit
  │    COSTING       │◄────────────┐
  │                  │             │
  │  isLocked=false  │─────────────┘
  │  approvalStatus  │
  │  = null/PENDING  │
  └────────┬─────────┘
           │
           │ Click "Approve"
           ▼
  ┌──────────────────┐
  │    COSTING       │
  │   (APPROVED)     │
  │  isPreferred=true│
  └────────┬─────────┘
           │
           │ Click "Raw Mat" (Promote)
           │ Creates NEW record
           ▼
  ┌────────────────────────┐     Can Edit
  │ RAW_MATERIAL_CALC      │◄────────────┐
  │                        │             │
  │  isLocked=false        │─────────────┘
  │  isPreferred=false     │
  │  approvalStatus        │
  │  = null/PENDING        │
  └────────┬───────────────┘
           │
           │ Click "Approve"
           ▼
  ┌────────────────────────┐
  │ RAW_MATERIAL_CALC      │
  │   (APPROVED)           │
  │  isPreferred=true      │
  └────────┬───────────────┘
           │
           │ Click "Prod" (Promote)
           │ Creates NEW record
           │ AUTO-LOCKS immediately
           ▼
  ┌──────────────────┐
  │   PRODUCTION     │
  │                  │
  │  isLocked=TRUE   │◄── IMMUTABLE
  │  isPreferred=fals│
  │  approvalStatus  │
  │  = null/PENDING  │
  └────────┬─────────┘
           │
           │ Click "Approve" (audit only)
           ▼
  ┌──────────────────┐
  │   PRODUCTION     │
  │   (APPROVED)     │
  │                  │
  │  isLocked=TRUE   │◄── STILL IMMUTABLE
  │  isPreferred=true│
  └──────────────────┘
```

### How Each Mode Works

#### COSTING Mode 🔵

- **Purpose:** Rough cost estimates for quotations
- **Who uses it:** Merchandisers, costing team
- **Editable:** Yes - can edit, delete, re-approve
- **Locked:** No
- **Versioning:** Supports v1, v2, v3... (create new version instead of editing approved)
- **Next step:** Approve, then promote to RAW_MATERIAL_CALCULATION

#### RAW_MATERIAL_CALCULATION Mode 🟠

- **Purpose:** MRP (Material Requirement Planning) for confirmed orders
- **Who uses it:** Finance, purchasing team, procurement
- **Editable:** Yes - can still edit before fabric receipt
- **Locked:** No
- **Use Case:** More refined estimates after order confirmation, used for procurement planning
- **Next step:** Approve, then promote to PRODUCTION

#### PRODUCTION Mode 🟢

- **Purpose:** Final costings locked for actual manufacturing
- **Who uses it:** Production planning, inventory
- **Editable:** **No - record is auto-locked**
- **Locked:** Yes (auto-locked on creation)
- **Stock Integration:** Must link to actual fabric stock (uses real widths from inwarded fabric)
- **Next step:** None - this is the final immutable mode

### Promotion Rules

**Valid Promotion Paths:**
```
COSTING → RAW_MATERIAL_CALCULATION    (requires APPROVED status)
RAW_MATERIAL_CALCULATION → PRODUCTION (requires APPROVED status + fabric in stock)
```

**What Happens During Promotion:**

1. A **new record** is created (original remains for audit trail)
2. New record starts with:
   - `purpose: <target stage>`
   - `approvalStatus: 'PENDING'`
   - `isPreferred: false`
   - `isLocked: true` (only for PRODUCTION)

### Approval Rules

**When you approve a costing option:**

1. Sets `isPreferred = true` (marks as recommended)
2. Sets `approvalStatus = 'APPROVED'`
3. **Unsets** `isPreferred` for all OTHER options of the same component
4. Only ONE costing option per component can be preferred at a time

**Lock Protection:**
- Cannot approve a locked record (PRODUCTION)
- Cannot delete a locked record (PRODUCTION)

### UI Implementation

**In Fabric Costing Page (/fabric-costing):**
- Mode tabs: Costing (Blue) | Raw Mat Calculation (Amber) | Production (Green)
- User selects mode before saving
- "Approve" button on each row
- Color-coded badges for mode identification

**In Fabric Costing Options Page (/fabric-costing/options):**
- Purpose filter tabs with counts: All | Costing | Raw Mat Calculation | Production
- Shows all saved costing options grouped by style
- Actions per option:
  - **Approve** - Mark as preferred
  - **Raw Mat** - Promote COSTING → RAW_MATERIAL_CALCULATION
  - **Prod** - Promote RAW_MATERIAL_CALCULATION → PRODUCTION
  - **Delete** - Remove option (blocked if locked)
- Lock icon shows on PRODUCTION records

### Current Issues & Complexity

#### Issue 1: Record Duplication
- Promoting creates a **new record** instead of updating the existing one
- Results in multiple records per component (one per mode)
- Complicates tracking and querying

#### Issue 2: Confusing Approval Flow
- `isPreferred` and `approvalStatus` serve similar purposes
- Unclear when to use "Approve" vs "Promote"
- Must approve before promoting (not obvious to users)

#### Issue 3: Lock Behavior
- Only PRODUCTION records are locked
- Users can accidentally edit RAW_MATERIAL_CALCULATION records after promotion
- No way to "finalize" a RAW_MATERIAL_CALCULATION record without promoting to PRODUCTION

#### Issue 4: No Audit Trail Navigation
- Original COSTING record remains but is disconnected from promoted versions
- No easy way to see the history of a costing option

#### Issue 5: Unclear UI
- Three separate tabs (Costing, Raw Mat Calculation, Production) in the entry page
- User must select correct mode before saving
- Easy to save in wrong mode

### Questions for Simplification

**Q1: Record Duplication**
Should promotion UPDATE the existing record instead, or is the audit trail of separate records valuable?

**Q2: Approval vs Preferred**
Can we merge `isPreferred` and `approvalStatus` into one concept?

**Q3: Lock Behavior**
Should RAW_MATERIAL_CALCULATION also be lockable? Or simplify to just two states: Draft and Finalized?

**Q4: Workflow Modes**
Are three modes necessary, or could we simplify to:
- **Draft:** Work in progress, editable
- **Approved:** Reviewed and locked for use

**Q5: Multiple Options per Component**
Is this necessary, or should there be only one active costing per component?

### Proposed Simplification Options

**Option A: Keep 3 Modes, Simplify Flow**
- Remove record duplication (update instead of create new)
- Merge `isPreferred` with `approvalStatus`
- Add lock capability to RAW_MATERIAL_CALCULATION mode

**Option B: Reduce to 2 Modes**
- **DRAFT:** Editable, multiple options allowed
- **FINALIZED:** Locked, only one option per component
- Remove COSTING/RAW_MATERIAL_CALCULATION/PRODUCTION distinction

**Option C: Single Record with Version History**
- One record per component
- Version history table for audit trail
- Status field: DRAFT | APPROVED | LOCKED

---

## Integration with Cost Sheets

### Cost Sheet Form Enhancement

**URL:** [http://localhost:5173/cost-sheets/new](http://localhost:5173/cost-sheets/new)

The cost sheet form now includes fabric sourcing integration.

### Workflow in Cost Sheet

```
User creates cost sheet
         │
         ▼
   Select style → Fabrics auto-populate
         │
         ▼
   For each fabric row:
   - Click "Select Sourcing" button
         │
         ▼
   System calls fabric costing API
         │
         ▼
   Modal opens with sourcing options
         │
         ▼
   User selects preferred strategy
         │
         ▼
   Form updates:
   - fabricRate
   - fabricTotal
   - sourcingStrategy
   - Associated IDs
         │
         ▼
   Cost sheet subtotal recalculates
         │
         ▼
   User completes trims, CMT, etc.
         │
         ▼
   Save cost sheet with sourcing data
```

---

## Complete System Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   1. SETUP (One-Time)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
         Create Processor Rate Cards
         - Define quantity slabs
         - Set rates for greige fabrics
         - Configure shrinkage, screen costs
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                2. COSTING ENTRY                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
            Fabric Costing Page (/fabric-costing)
            - Select style
            - Enter costs per fabric/width
            - Select processor, lookup rates
            - Save with purpose (PLANNING/COSTING/PRODUCTION)
            - Approve individual rows
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                3. APPROVAL & PROMOTION                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
            Fabric Costing Options (/fabric-costing/options)
            - View all saved costing options
            - Filter by purpose (stage)
            - Approve preferred options
            - Promote: PLANNING → COSTING → PRODUCTION
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 4. PRODUCTION USE                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Cost Sheet Form
              - Auto-populate fabrics from style
              - Pull approved fabric costs
              - Complete cost sheet
              - Save with sourcing data
```

---

## Testing Guide

### Phase 1: Processor Rate Cards

#### Test 1: View Default Rates

1. Navigate to `/processor-rate-cards`
2. Select **"System Default Rates"**
3. Click **DYEING** tab
4. **Expected:**
   - 4 slabs visible (0-500m, 500-1000m, 1000-5000m, 5000+m)
   - 46 greige rows
   - All rates filled (₹50-₹65/m)
   - Shrinkage filled (5%)

#### Test 2: View Printing Rates

1. Click **PRINTING** tab
2. Click **PIGMENT** sub-tab
3. **Expected:**
   - Same 4 slabs
   - Same 46 greiges
   - Rates ₹70-₹85/m
   - Screen costs visible

### Phase 2: Fabric Costing

#### Test 3: Style-Based Costing

1. Navigate to `/fabric-costing`
2. Search for a style in quick search
3. **Expected:**
   - Fabric rows auto-populate
   - CAD, width, greige name shown

#### Test 4: Rate Lookup

1. Select a processor for a row
2. Click refresh icon (🔄)
3. **Expected:**
   - Processing cost populated
   - Slab label shown
   - Total recalculates

#### Test 5: Save and Approve

1. Enter costs for all rows
2. Click "Save Costing"
3. Click "Approve" on a row
4. **Expected:**
   - Success notification
   - Row marked as approved

### Phase 3: Workflow

#### Test 6: View Options

1. Navigate to `/fabric-costing/options`
2. **Expected:**
   - See saved costing options grouped by style
   - Purpose tabs show counts

#### Test 7: Promote to Costing

1. Find an APPROVED PLANNING option
2. Click "Cost" button
3. **Expected:**
   - New COSTING record created
   - Original PLANNING record remains

#### Test 8: Promote to Production

1. Approve the COSTING option
2. Click "Prod" button
3. **Expected:**
   - New PRODUCTION record created
   - Record shows lock icon
   - Cannot edit or delete

---

## Troubleshooting

### Common Issues

#### Issue 1: "Add Greige Row" button disabled

**Cause:** No quantity slabs exist

**Solution:**
1. Add slabs first (click "Add Slab")
2. Enter min/max quantities
3. Then "Add Greige Row" will enable

#### Issue 2: Processing cost showing 0

**Possible Causes:**
1. No matching rate card for quantity range
2. No greige reference on fabric
3. Processor not selected

**Solution:**
- Verify rate card exists for fabric's greige and quantity
- Check fabric has greigeId set
- Select a processor and click refresh

#### Issue 3: Cannot approve/delete PRODUCTION record

**Cause:** PRODUCTION records are locked

**Solution:** This is by design. PRODUCTION records are immutable. Create a new costing option if changes are needed.

#### Issue 4: Greige cost showing as 0

**Cause:** No greige cost source found

**Solution:** Check that the greige has:
1. Recent procurement records, OR
2. Stock with valuation rate, OR
3. Default cost in greige_master

#### Issue 5: CAD meters showing as 0.00

**Cause:** CAD consumption data not loaded properly

**Root Cause Analysis:**
- Backend priority order: `fabricCAD.cadMeters` → `style_fabrics.cadAverageMeters` → `fabric_master.cadMeters`
- If both `fabricCAD` and `style_fabrics.cadAverageMeters` are null, defaults to 0

**Solution:**
1. Go to CAD Planning page and complete CAD for the style
2. Ensure `cadAverageMeters` is saved in style_fabrics
3. Or enter CAD consumption manually in the fabric costing page

**Backend Fix Applied:**
Changed priority order to check `style_fabrics.cadAverageMeters` FIRST (style-specific consumption should be primary source).

[fabric-costing.controller.ts:299-314](backend/src/controllers/fabric-costing.controller.ts#L299-L314)

#### Issue 6: Approve button remains disabled after saving

**Cause:** Page state not refreshed with new `fabricWidthCadId` after save

**Root Cause:**
- After saving costing, backend returns new record IDs
- Frontend receives success response but doesn't update row state
- `fabricWidthCadId` remains null in UI, keeping approve button disabled

**Solution:**
Added data refresh after save in `handleSave()` function to re-fetch style fabrics and update row state with new IDs.

[FabricCostingPage.tsx:627-638](frontend/src/pages/FabricCostingPage.tsx#L627-L638)

---

## Known Issues & Resolutions

### Issue 1: Greige Price Fluctuation & Manual Override

**Problem:** Greige prices keep fluctuating. Users need ability to override price for one-time costing without updating greige master.

**Current Implementation:**
- Greige cost sources (priority order):
  1. `fabric_procurement.ratePerUnit` (Latest GREIGE procurement)
  2. `stock_levels.valuationRate` (Via materials table)
  3. `greige_master.costPerMeter` (Default fallback)

**Solution Implemented:**
- Manual price entry field exists in UI
- Price is saved with `greigeCostSource: 'MANUAL'` flag
- Does NOT update greige_master (one-time costing only)
- Historical tracking available via fabric_width_cad records

[FabricCostingPage.tsx:778-789](frontend/src/pages/FabricCostingPage.tsx#L778-L789)

### Issue 2: Repeat Style vs One-Time Order Workflow

**Problem:**
1. Only ONE width can be approved per component (blocks real factory workflows)
2. Repeat styles must go through full PLANNING → COSTING → PRODUCTION workflow each time

**Current Limitation:**
When approving one width, ALL other widths for same component are automatically unapproved.

[fabric-costing.controller.ts:940-951](backend/src/controllers/fabric-costing.controller.ts#L940-L951)

**Proposed Solution:**
1. **Primary + Alternate Approval Status:**
   - One width: `isPreferred=true` (primary)
   - Other widths: `approvalStatus='ALTERNATE_APPROVED'` (available alternatives)
2. **Repeat Order Detection:**
   - Check if style has previous PRODUCTION costings
   - Auto-upgrade PLANNING → PRODUCTION for repeat orders
   - Skip unnecessary workflow stages

**Status:** Pending implementation (design approved)

### Issue 3: Style-Specific Costing View

**Problem:**
- Options page shows ALL styles (overwhelming)
- No indication on main page if style already has costings
- Style-specific backend endpoint exists but unused

**Current Behavior:**
- `/fabric-costing/options` shows all styles grouped together
- Must filter by Customer → Style manually
- No "already costed" badge in style search

**Proposed Solution:**
1. Add costing status badge in style search: ✅ "Costed" / ⏳ "Pending" / ⚪ "Not Started"
2. Add "View Existing Options" button when style has costings
3. Create dedicated route: `/fabric-costing/style/:styleId/options`
4. Use existing backend endpoint: `GET /api/fabric-costing/style/:styleId/options`

**Status:** Planned enhancement

### Issue 4: Duplicate Global Quantity Input

**Problem:**
- Global "Estimated Quantity" in header
- Row-level quantity inputs in table
- Confusing which takes precedence

**Solution Implemented:**
Removed global quantity input from header. Row-level quantities are now the single source of truth.

**Status:** ✅ Completed

### Issue 5: CAD Planning ↔ Fabric Costing Mode Linking

**Question:** Is there linking between CAD planning modes and fabric costing modes?

**Answer:** YES - They ARE linked via `purpose` field

**Database:** `fabric_width_cad` table stores both CAD data and costing data

**Field:** `purpose: 'PLANNING' | 'COSTING' | 'PRODUCTION'`

**How it works:**
- CAD Planning creates records with `purpose` value
- Fabric Costing reads same records and preserves `purpose`
- Unique constraint ensures separation: `@@unique([costingStyleId, componentName, cutableWidth, processorId, purpose])`

**Behavior:**
- CAD Planning creates record with `purpose: 'PLANNING'`
- Fabric Costing shows that record
- User can change mode (creates new record due to unique constraint)
- Provides audit trail of costing evolution

**Visual Indicator:** Consider adding "From CAD: PLANNING" badge to clarify mode origin

---

## Design Decisions & Architecture

### fabric_width_cad: Hybrid Master/Transaction Table

**Purpose:** Serves TWO workflows simultaneously:

1. **CAD Planning** - Creates records with width options and consumption data
2. **Fabric Costing** - Populates cost breakdown for style quotations

**Key Design:**
- `costingStyleId` links costing to specific style (audit trail)
- Stores preliminary style-level costing BEFORE orders
- Order costing uses only `cadMeters` and `cutableWidth`, NOT the costing fields

**Unique Constraint:**
```sql
@@unique([costingStyleId, componentName, cutableWidth, processorId, purpose])
```

Allows multiple costing options per component across different workflow stages.

[schema.prisma:3581-3666](backend/prisma/schema.prisma#L3581-L3666)

### Cost Source Priority Logic

**Greige Cost Priority:**
1. `fabric_procurement.ratePerUnit` (Latest GREIGE procurement)
2. `stock_levels.valuationRate` (Weighted Average Cost from stock)
3. `greige_master.costPerMeter` (Default fallback)

[fabric-cost-calculation.service.ts:372-404](backend/src/services/fabric-cost-calculation.service.ts#L372-L404)

**Shrinkage Priority:**
1. `processor_rate_card.shrinkagePercent` (Processor-specific)
2. `greige_master.averageShrinkagePercent` (Greige default)

[processor-rate-v2.service.ts:807-813](backend/src/services/processor-rate-v2.service.ts#L807-L813)

**CAD Meters Priority (FIXED):**
1. `style_fabrics.cadAverageMeters` (Style-specific consumption - PRIMARY)
2. `fabric_width_cad.cadMeters` (Fallback - if CAD planning done)
3. `fabric_master.cadMeters` (Last resort - fabric default)

Changed from old priority that checked `fabricCAD` first.

### Three Sourcing Strategies

The system compares three fabric sourcing options:

1. **STOCK_REUSE** - Use existing fabric from warehouse
   - Source: `fabric_stock.weightedAvgCost`
   - Pros: Lowest cost, zero lead time
   - Cons: Limited to available stock

2. **READY_FABRIC** - Purchase finished fabric from supplier
   - Source: `fabric_procurement.ratePerUnit` (latest) → `fabric_master.costPerMeter`
   - Pros: Medium cost, medium lead time
   - Cons: Market price fluctuation

3. **GREIGE_PROCESSED** - Buy greige fabric and process it
   - Source: Greige + Transport + Processing + Shrinkage + Screen
   - Pros: Control over quality and color
   - Cons: Longest lead time, variable cost

System shows all options and recommends cheapest. Users can manually override selection.

[fabric-cost-calculation.service.ts](backend/src/services/fabric-cost-calculation.service.ts)

### Screen Cost Handling

**Universal Screen Costs:**
- ROTARY: ₹3,000
- FLATBELT: ₹1,100
- TABLE: ₹1,000

**Calculation:** Amortized over order quantity
```
screenCostPerMeter = (screenCostPerScreen × numberOfColors) / totalQuantityMeters
```

**Design Decision:** No separate master table needed (one-time setup values, universal across processors)

---

## Code Review Findings

### 🔴 HIGH PRIORITY

#### 1. Missing Error Handling for Locked Records
**File:** [fabric-costing.controller.ts:971-1002](backend/src/controllers/fabric-costing.controller.ts#L971-L1002)

**Issue:** `deleteCostingOption()` doesn't check `isLocked` before deleting PRODUCTION records.

**Fix:** Add check for `isLocked` field before allowing delete.

```typescript
if (option.isLocked) {
  return res.status(400).json({
    success: false,
    error: 'Cannot delete locked PRODUCTION costing option',
  });
}
```

#### 2. Missing `isLocked` Check in Approve Function
**File:** [fabric-costing.controller.ts:896-965](backend/src/controllers/fabric-costing.controller.ts#L896-L965)

**Issue:** `approveCostingOption()` doesn't check if record is locked (PRODUCTION).

**Fix:** Add guard to prevent modifying locked records.

#### 3. Race Condition in Approval Transaction
**File:** [fabric-costing.controller.ts:921-951](backend/src/controllers/fabric-costing.controller.ts#L921-L951)

**Issue:** Transaction updates other options first, then target. If target update fails, others are already modified.

**Fix:** Wrap both operations in proper transaction with rollback.

### 🟡 MEDIUM PRIORITY

#### 4. Inconsistent Type: greigeCostSource Mismatch
**File:** [fabricCosting.types.ts:247](frontend/src/types/fabricCosting.types.ts#L247)

**Issue:** Type defines `'GREIGE_MASTER' | 'MANUAL'` but code uses `'GREIGE_PROCUREMENT'`.

**Fix:** Update type to include `'GREIGE_PROCUREMENT'`.

```typescript
greigeCostSource: 'GREIGE_MASTER' | 'GREIGE_PROCUREMENT' | 'MANUAL';
```

#### 5. Missing Validation: Negative Cost Values
**File:** [fabric-costing.controller.ts:631-685](backend/src/controllers/fabric-costing.controller.ts#L631-L685)

**Issue:** `saveFabricCosting()` doesn't validate that cost values are non-negative.

**Fix:** Add validation to reject negative costs.

#### 6. Unused `getDefaultLayerMargin` Function
**File:** [fabric-costing.controller.ts:14-21](backend/src/controllers/fabric-costing.controller.ts#L14-L21)

**Issue:** Function is defined but never called.

**Fix:** Remove dead code.

### 🟢 LOW PRIORITY

#### 7. Console.log in Production Code
**File:** [FabricCostingPage.tsx:573](frontend/src/pages/FabricCostingPage.tsx#L573)

**Issue:** Debug console.log left in production code.

**Fix:** Remove or wrap in development check.

#### 8. Hardcoded Default Transport Cost
**File:** [FabricCostingPage.tsx:368](frontend/src/pages/FabricCostingPage.tsx#L368)

**Issue:** Transport cost defaults to ₹2/m hardcoded.

**Fix:** Consider making configurable (or document as acceptable default).

---

## API Reference

### Fabric Costing Endpoints

**Base URL:** `/api/fabric-costing`

#### Get Style Fabrics
```
GET /style/:styleId
```
Returns fabrics from a style with greige data for costing.

#### Lookup Processor Rate
```
POST /lookup-rate
{
  processorId: "uuid",
  processingType: "DYEING" | "PRINTING",
  printingType?: "PIGMENT" | "PROCIAN" | "DISCHARGE" | "PIGMENT_DISCHARGE",
  greigeId: "uuid",
  quantityMeters: 1200
}
```

#### Save Fabric Costing
```
POST /save
{
  styleId: "uuid",
  fabricCostings: [{
    fabricWidthCadId: "uuid" | null,
    fabricId: "uuid",
    cutableWidth: 45,
    componentName: "Blouse",
    greigeId: "uuid",
    greigeCostPerMeter: 80,
    transportCostPerMeter: 2,
    processorId: "uuid",
    processingCostPerMeter: 65,
    shrinkagePercent: 5,
    shrinkageCostPerMeter: 4,
    screenCostPerMeter: 7.5,
    screenType: "ROTARY",
    numberOfColors: 3,
    totalCostPerMeter: 158.5,
    costInputMode: "BUILD_UP" | "LANDED_PRICE",
    orderQuantityPcs: 1000,
    cadMeters: 1.5,
    purpose: "PLANNING" | "COSTING" | "PRODUCTION"
  }]
}
```

#### Get Costing Options
```
GET /options?customerId=&styleId=&processorId=&status=&purpose=&page=1&limit=20
```
Returns paginated costing options grouped by style.

#### Approve Costing Option
```
POST /option/:optionId/approve
```
Marks option as preferred, unsets others for same component.

#### Delete Costing Option
```
DELETE /option/:optionId
```
Deletes option (blocked if locked).

#### Promote Costing Option
```
POST /option/:optionId/promote
{
  targetPurpose: "COSTING" | "PRODUCTION"
}
```
Creates new record in target stage.

---

## Files Involved

### Backend

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Database model for fabric_width_cad |
| `backend/src/controllers/fabric-costing.controller.ts` | API endpoints |
| `backend/src/services/fabric-cost-calculation.service.ts` | Core calculation logic |
| `backend/src/services/processor-rate-v2.service.ts` | Processor rate lookup |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/FabricCostingPage.tsx` | Main costing entry page |
| `frontend/src/pages/FabricCostingOptionsPage.tsx` | Options list with approval/promotion |
| `frontend/src/services/fabricCosting.service.ts` | API client |
| `frontend/src/types/fabricCosting.types.ts` | TypeScript types |

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-27 | System | Initial documentation |
| 2026-01-11 | Claude | Added workflow management section, merged with FABRIC_COSTING_WORKFLOW.md |
| 2026-01-29 | Claude | **Updated mode names**: PLANNING→COSTING, old COSTING→RAW_MATERIAL_CALCULATION |

---

**System Status:** Production Ready with Workflow Management

**Need help?** Check the troubleshooting section or review related files listed above.
