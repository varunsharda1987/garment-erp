# Fabric Costing & Processor Rate Cards - Complete Guide

> **Last Updated:** December 27, 2025
> **System Version:** V2 (Matrix-Based)

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Processor Rate Cards V2](#processor-rate-cards-v2)
4. [Default Rates Setup](#default-rates-setup)
5. [Fabric Costing Calculator](#fabric-costing-calculator)
6. [Integration with Cost Sheets](#integration-with-cost-sheets)
7. [Complete System Flow](#complete-system-flow)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Quick Start

### 🚀 Launch the System

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

### 📍 Access URLs

| Page | URL | Purpose |
|------|-----|---------|
| **Processor Rate Cards** | [/processor-rate-cards](http://localhost:5173/processor-rate-cards) | Manage processing rates (DYEING, PRINTING) |
| **Fabric Costing** | [/fabric-costing](http://localhost:5173/fabric-costing) | Test fabric sourcing strategies |
| **Cost Sheets** | [/cost-sheets/new](http://localhost:5173/cost-sheets/new) | Production cost sheets |

### ⚡ 30-Second Setup: Default Rates

Run this command to populate default rates for all greige fabrics:

```bash
cd backend
npx ts-node prisma/seeds/seed-default-processor-rates.ts
```

**What this creates:**
- ✅ SYSTEM_DEFAULT processor
- ✅ 4 DYEING quantity slabs (0-500m, 500-1000m, 1000-5000m, 5000+m)
- ✅ 4 PRINTING quantity slabs (same ranges)
- ✅ Default rates for all greige fabrics (46 greiges)
- ✅ All 4 printing types (PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE)
- ✅ Default shrinkage (5%) and screen costs

---

## System Overview

### 🎯 What Does This System Do?

The Fabric Costing System provides intelligent fabric sourcing recommendations by comparing **three strategies**:

1. **Stock Reuse** - Use existing fabric from warehouse (lowest cost, zero lead time)
2. **Ready Fabric** - Purchase finished fabric from supplier (medium cost, medium lead time)
3. **Greige + Processing** - Buy greige fabric and process it (variable cost, longer lead time)

### 🏗️ Architecture

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
```

### ✨ Key Features

- **Matrix-Based Rate Management** - One table per processor with greige rows × quantity slab columns
- **Quantity-Based Pricing** - Different rates for different order quantities (bulk discounts)
- **Multiple Printing Types** - PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE
- **Shrinkage Tracking** - Per greige-processor combination
- **Screen Cost Management** - ROTARY, FLATBELT, TABLE screen types
- **Default Rates System** - SYSTEM_DEFAULT processor for fallback rates
- **Copy Functionality** - Duplicate rate structures between processors

---

## Processor Rate Cards V2

### What is V2?

**V2** is the current matrix-based system for managing processor rates. It replaced the legacy V1 system with superior architecture:

- ✅ **Greige-Based Matching** (not generic categories)
- ✅ **Matrix UI** (faster than form-based CRUD)
- ✅ **Shrinkage Support** (per greige-processor)
- ✅ **4 Printing Types** (PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE)
- ✅ **Screen Cost Tracking** (for printing)
- ✅ **Copy Rates** (between processors)

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

### UI Behavior Notes

**"Add Greige Row" Button Requirements:**
- ✅ Processor must be selected
- ✅ **At least one slab must exist**

This is intentional - you need columns (slabs) before adding rows (greiges).

**If using SYSTEM_DEFAULT after seed script:**
You don't need to add greiges! The seed script already added all 46 greiges with default rates. Just select the processor and view/edit the matrix.

---

## Default Rates Setup

### Why Default Rates?

Default rates provide:
- ✅ **Preliminary costing** without processor commitment
- ✅ **Fallback rates** when no specific processor selected
- ✅ **Comparison baseline** for processor negotiations

### Automated Setup (Recommended)

Run the seed script:

```bash
cd backend
npx ts-node prisma/seeds/seed-default-processor-rates.ts
```

**Expected Output:**
```
=== Seeding Default Processor Rates ===

Step 1: Checking for SYSTEM_DEFAULT processor...
  ✓ SYSTEM_DEFAULT processor found: abc-123-xyz

Step 2: Loading greige fabrics...
  ✓ Found 46 active greige fabrics

Step 3: Creating DYEING quantity slabs...
  ✓ Created slab 1: 0-500m
  ✓ Created slab 2: 500-1000m
  ✓ Created slab 3: 1000-5000m
  ✓ Created slab 4: 5000+ m

Step 4: Creating PRINTING quantity slabs...
  ✓ Created slab 1: 0-500m
  ✓ Created slab 2: 500-1000m
  ✓ Created slab 3: 1000-5000m
  ✓ Created slab 4: 5000+ m

Step 5: Creating DYEING rates for all greiges...
  ✓ Created 184 DYEING rates

Step 6: Creating PRINTING rates for all greiges...
  ✓ Created 736 PRINTING rates

=== Summary ===
Total rate cards: 920 created
✓ Default processor rates seeded successfully!
```

### Default Rate Configuration

The seed script uses these values (customizable in the script):

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

### Customizing Default Rates

Edit the file: `backend/prisma/seeds/seed-default-processor-rates.ts`

**Change quantity slabs:**
```typescript
const DYEING_SLABS = [
  { slabOrder: 1, minQuantity: 0, maxQuantity: 1000, slabLabel: '0-1000m' },
  { slabOrder: 2, minQuantity: 1000, maxQuantity: 5000, slabLabel: '1000-5000m' },
  { slabOrder: 3, minQuantity: 5000, maxQuantity: 999999, slabLabel: '5000+ m' },
];
```

**Change DYEING rates:**
```typescript
const DYEING_RATES = {
  slab1: 70, // Your custom rate
  slab2: 65,
  slab3: 60,
};
```

**Change PRINTING rates:**
```typescript
const PRINTING_RATES = {
  PIGMENT: {
    slab1: 90,
    slab2: 85,
    slab3: 80,
  },
  PROCIAN: { /* ... */ },
  DISCHARGE: { /* ... */ },
  PIGMENT_DISCHARGE: { /* ... */ },
};
```

**Change shrinkage:**
```typescript
const DEFAULT_SHRINKAGE_PERCENT = 6.0; // 6% instead of 5%
```

**Change screen costs:**
```typescript
const DEFAULT_SCREEN_COSTS = {
  ROTARY: 3500,
  FLATBELT: 1200,
  TABLE: 1100,
};
```

Then re-run the seed script.

### Viewing Default Rates in UI

1. Go to [http://localhost:5173/processor-rate-cards](http://localhost:5173/processor-rate-cards)
2. Select **"System Default Rates"** from processor dropdown
3. Click **DYEING** tab - you should see:
   - 4 quantity slabs (column headers)
   - 46 greige fabrics (rows)
   - All rates pre-filled
   - All shrinkage % filled (5%)
4. Click **PRINTING** → **PIGMENT** - same structure with printing rates

### Using Default Rates

**In Fabric Costing:**
- Don't select a processor (or select "System Default Rates")
- System automatically uses these default rates
- Great for preliminary costing

**Example Calculation:**
```
Greige: Cotton Cambric
Process: PRINTING (PIGMENT)
Quantity: 1200 meters
Colors: 3

Matched slab: 1000-5000m → Rate ₹75/m
Processing cost: 1200m × ₹75 = ₹90,000
Shrinkage cost: (greige cost) × 5%
Screen cost: 3 colors × ₹3000 = ₹9000 → ₹7.50/m
Total per meter: ₹75 + shrinkage + ₹7.50
```

### Re-running the Seed Script

To start fresh with new values:

1. **Delete existing rates:**
   ```sql
   DELETE FROM processor_rate_card
   WHERE "processorId" = (
     SELECT id FROM suppliers WHERE code = 'SYSTEM_DEFAULT'
   );

   DELETE FROM processor_quantity_slabs
   WHERE "processorId" = (
     SELECT id FROM suppliers WHERE code = 'SYSTEM_DEFAULT'
   );
   ```

2. **Edit the seed script** with new values

3. **Re-run:**
   ```bash
   npx ts-node prisma/seeds/seed-default-processor-rates.ts
   ```

---

## Fabric Costing Calculator

### Accessing the Page

**URL:** [http://localhost:5173/fabric-costing](http://localhost:5173/fabric-costing)

**Purpose:** Standalone test page for fabric cost calculation before integrating into cost sheets.

### Features

#### 1. Style Selection (Optional)

- Select customer from dropdown
- Select style from that customer's styles
- System auto-populates fabrics from the style

#### 2. Manual Fabric Entry

- Add/remove fabric rows
- Enter fabric details:
  - **Fabric ID** - UUID from fabric_master
  - **Fabric Name** - Display name
  - **CAD (meters)** - Consumption per piece
  - **Width (inches)** - Fabric width

#### 3. Cost Calculation

- **Single:** Click calculator icon (🧮) on individual row
- **Batch:** Click "Calculate All" to process all fabrics

#### 4. Sourcing Strategy Modal

Opens with **3 tabs**:

**Stock Reuse Tab:**
- Availability status
- Weighted average cost (WAC)
- Stock location
- Origin style (if reused fabric)
- Lead time: 0 days

**Ready Fabric Tab:**
- Cost from fabric_master or latest procurement
- Supplier name
- Lead time: ~15 days

**Greige + Processing Tab:**
- Greige cost (WAC from stock)
- Processing cost (from processor_rate_card)
- Processor name
- Processing type
- Shrinkage %
- Screen costs (if printing)
- Lead time: ~30 days
- **Manual override** option with justification

#### 5. Cost Comparison Table

Side-by-side comparison of all options:
- Cost per meter and total cost
- Lead time
- Highlighted recommended option
- Grand totals and savings

### Calculation Logic

#### Option 1: Stock Reuse

```
Query: fabric_stock
  WHERE fabricId = input.fabricId
    AND status = 'AVAILABLE'
    AND quantityAvailable >= needed

Cost = weightedAvgCost (WAC)

Priority:
  1. Same originStyleId (highest priority)
  2. Lowest WAC
  3. Newest lot
```

#### Option 2: Ready Fabric

```
Query: fabric_procurement (type: FINISHED)
  WHERE fabricId = input.fabricId
  ORDER BY procurementDate DESC
  LIMIT 1

Cost = ratePerUnit

Fallback: fabric_master.costPerMeter
```

#### Option 3: Greige + Processing

```
Step 1: Get greige cost
  Query: greige_stock (greige WAC)
    OR greige_master.costPerMeter
    OR user manual override

Step 2: Get processing cost
  Query: processor_rate_card
    WHERE processingType = mapped from fabric.finishType
      AND greigeId = fabric.greigeId
      AND quantityMeters BETWEEN minQty AND maxQty
      AND isActive = true
    ORDER BY slabOrder
    LIMIT 1

Step 3: Calculate screen costs (if PRINTING)
  screenCostPerMeter = (screenCostPerScreen × numberOfColors) / totalQuantity

Total Cost = greigeCost + processingCost + shrinkageCost + screenCostPerMeter
```

**Finish Type Mapping:**
```
fabric.finishType → processingType
├── DYED          → DYEING
├── PRINTED       → PRINTING
├── WASHED        → WASHING
└── FINISHED      → FINISHING
```

**Quantity Slab Matching:**
```
Order: 100 pieces × 1.5m CAD = 150 meters total

Rate Card Lookup:
├── 0-500m:     ✅ MATCH → ₹65/m
├── 500-1000m:  ❌ (quantity too low)
└── 1000-5000m: ❌ (quantity too low)

Selected Rate: ₹65/m
```

### Testing Workflow

#### Style-Based Test

1. Navigate to `/fabric-costing`
2. Select customer from dropdown
3. Select style (fabrics auto-populate)
4. Click **"Calculate All"**
5. View results inline
6. Click **"View Details"** to see sourcing modal
7. Check cost comparison table at bottom

#### Manual Entry Test

1. Get fabric ID from database:
   ```sql
   SELECT id, "fabricName", "fabricCategory", "finishType"
   FROM fabric_master
   WHERE "isActive" = true
   LIMIT 10;
   ```
2. Click **"Add Fabric"**
3. Enter fabric ID, CAD, width
4. Click calculator icon (🧮)
5. Modal opens with 3 sourcing options
6. Review each tab
7. Check recommended strategy

#### Quantity Slab Pricing Test

Use same fabric, but vary order quantity:

**Small Order (100 pieces):**
- Total: 100 × 1.5m = 150m
- Expected: ₹65/m (0-500m slab)

**Large Order (800 pieces):**
- Total: 800 × 1.5m = 1200m
- Expected: ₹55/m (1000-5000m slab)

System should automatically apply the correct rate based on total quantity.

---

## Integration with Cost Sheets

### Cost Sheet Form Enhancement

**URL:** [http://localhost:5173/cost-sheets/new](http://localhost:5173/cost-sheets/new)

The cost sheet form now includes fabric sourcing integration.

### New Features in Cost Sheet

#### Fabric Row Actions

Each fabric row has a **"Select Sourcing"** button that:
1. Calls fabric costing API
2. Opens sourcing strategy modal
3. Allows user to select strategy
4. Updates fabric cost in form

#### Auto-Update Fields

When sourcing strategy selected:
- `fabricRate` - Cost per meter
- `fabricTotal` - Total cost
- `sourcingStrategy` - STOCK_REUSE | READY_FABRIC | GREIGE_PROCESSED
- Associated IDs - stockLotId, processorId, rateCardId, etc.

#### Cost Comparison

Bottom of form shows:
- Total cost for each sourcing strategy
- Recommended option
- Savings vs alternatives

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
│                2. TESTING (Standalone)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
            Fabric Costing Page
            - Enter fabrics manually
            - Or load from style
            - Calculate costs
            - View 3 sourcing options
            - Compare total costs
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 3. PRODUCTION (Integrated)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              Cost Sheet Form
              - Auto-populate fabrics from style
              - Click "Select Sourcing" per fabric
              - Choose sourcing strategy
              - System updates costs
              - Complete cost sheet
              - Save with sourcing data
```

### Use Cases

#### Use Case 1: Compare All Options

**Scenario:** 200 pieces of cotton poplin style (1.5m CAD/piece)

**Calculation:** 200 × 1.5 = 300 meters

**Results:**
```
┌─────────────────┬──────────────┬───────────────┬────────────┐
│ Strategy        │ Cost/Meter   │ Total Cost    │ Lead Time  │
├─────────────────┼──────────────┼───────────────┼────────────┤
│ Stock Reuse     │ ₹120 (WAC)   │ ₹36,000       │ 0 days     │ ✅ Recommended
│ Ready Fabric    │ ₹150         │ ₹45,000       │ 15 days    │
│ Greige+Process  │ ₹145         │ ₹43,500       │ 30 days    │
│                 │ (₹80+₹65)    │               │            │
└─────────────────┴──────────────┴───────────────┴────────────┘

Savings by using stock: ₹9,000 (20%)
```

#### Use Case 2: Bulk Discount Effect

**Scenario:** Same fabric, but 1,500 pieces instead

**Calculation:** 1,500 × 1.5 = 2,250 meters

**Rate Change:**
```
Previous (300m): 0-500m slab → ₹65/m processing
New (2,250m):    1000-5000m slab → ₹55/m processing
```

**Updated Results:**
```
┌─────────────────┬──────────────┬───────────────┬────────────┐
│ Strategy        │ Cost/Meter   │ Total Cost    │ Lead Time  │
├─────────────────┼──────────────┼───────────────┼────────────┤
│ Stock Reuse     │ ₹120 (WAC)   │ ₹270,000      │ 0 days     │
│ Ready Fabric    │ ₹150         │ ₹337,500      │ 15 days    │
│ Greige+Process  │ ₹135         │ ₹303,750      │ 30 days    │ ✅ Recommended
│                 │ (₹80+₹55)    │               │            │
└─────────────────┴──────────────┴───────────────┴────────────┘

Savings: ₹33,750 (10% vs ready fabric)
Note: ₹10/m discount from bulk slab
```

#### Use Case 3: Manual Override

**Scenario:** Negotiated better greige price

**System Default:**
- Greige WAC: ₹80/m
- Processing: ₹65/m
- Total: ₹145/m

**User Override:**
- Negotiated Greige: ₹70/m
- Processing: ₹65/m
- Total: ₹135/m
- Override Reason: "Bulk negotiation with supplier XYZ"

**Result:** System tracks override for audit

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

#### Test 3: Edit a Rate

1. Click any rate cell
2. Change value (e.g., ₹65 → ₹70)
3. Click **"Save All Changes"**
4. **Expected:**
   - Success notification
   - Rate updated in table

#### Test 4: Add Slab (Manual)

1. Click **"Add Slab"**
2. Enter min: 10000, max: 50000
3. **Expected:**
   - New column appears
   - Empty rate cells for all greiges
   - Can fill rates and save

### Phase 2: Fabric Costing

#### Test 5: Manual Fabric Entry

1. Navigate to `/fabric-costing`
2. Get fabric ID:
   ```sql
   SELECT id FROM fabric_master
   WHERE "fabricCategory" = 'COTTON' AND "finishType" = 'DYED'
   LIMIT 1;
   ```
3. Enter fabric details, CAD: 1.5m
4. Click calculator icon (🧮)
5. **Expected:**
   - Modal opens with 3 tabs
   - Stock Reuse shows availability/WAC
   - Ready Fabric shows procurement cost
   - Greige + Processing shows greige cost + processing rate

#### Test 6: Quantity Slab Test

1. Same fabric from Test 5
2. Order quantity: 100 pieces
   - Total: 100 × 1.5 = 150m
   - **Expected rate:** ₹65/m (0-500m slab)
3. Change order quantity: 800 pieces
   - Total: 800 × 1.5 = 1200m
   - **Expected rate:** ₹55/m (1000-5000m slab)

#### Test 7: Style-Based Auto-Population

1. Select customer from dropdown
2. Select style with fabrics
3. **Expected:**
   - Fabric rows auto-populate
   - Fabric names, CAD, width filled
4. Click **"Calculate All"**
5. **Expected:**
   - All fabrics calculated
   - Results shown inline

#### Test 8: Cost Comparison Table

1. After calculating all fabrics
2. Scroll to bottom
3. **Expected:**
   - Table shows all fabrics
   - 3 columns: Stock, Ready, Greige+Process
   - Total row at bottom
   - Recommended option highlighted

### Phase 3: Integration

#### Test 9: Cost Sheet Integration

1. Navigate to `/cost-sheets/new`
2. Select style
3. Fabrics auto-populate
4. Click **"Select Sourcing"** on first fabric
5. **Expected:**
   - Modal opens (same as fabric costing)
   - User selects strategy
   - Fabric cost updates in form
   - Subtotal recalculates

### Success Criteria

✅ **Processor Rate Cards**
- [ ] Default rates visible after seed script
- [ ] Can view DYEING and PRINTING rates
- [ ] Can edit rates and save
- [ ] Slabs display correctly
- [ ] Greiges display correctly

✅ **Fabric Costing**
- [ ] Manual entry works
- [ ] Style auto-populate works
- [ ] Single calculation works
- [ ] Batch calculation works
- [ ] Modal displays 3 options
- [ ] Quantity slabs apply correctly
- [ ] Cost comparison table shows data

✅ **Integration**
- [ ] Cost sheet sourcing button works
- [ ] Modal integration works
- [ ] Costs update in form
- [ ] Subtotals recalculate

---

## Troubleshooting

### Common Issues

#### Issue 1: "Add Greige Row" button disabled

**Cause:** No quantity slabs exist

**Solution:**
1. Add slabs first (click "Add Slab")
2. Enter min/max quantities
3. Then "Add Greige Row" will enable

**If using SYSTEM_DEFAULT after seed script:**
Greiges are already added! No need to add manually.

#### Issue 2: No processors in dropdown

**Cause:** No suppliers with DYEING_PRINTING category

**Solution:**
```sql
-- Check suppliers
SELECT id, name, "supplierCategories"
FROM suppliers
WHERE 'DYEING_PRINTING' = ANY("supplierCategories");

-- Create if needed
INSERT INTO suppliers (id, name, "supplierCategories", "isActive")
VALUES (
  gen_random_uuid(),
  'Test Processor',
  ARRAY['DYEING_PRINTING']::supplier_category[],
  true
);
```

Or run:
```bash
cd backend
npx ts-node prisma/seeds/seed-system-default-processor.ts
```

#### Issue 3: Processing cost showing 0

**Possible Causes:**
1. No matching rate card for quantity range
2. No greige stock for WAC
3. Fabric category mismatch

**Solution:**
- Verify rate card exists for fabric's greige and quantity
- Check greige_stock table has entries
- Ensure fabric.greigeId matches rate card greigeId

#### Issue 4: Modal not opening

**Cause:** JavaScript error or API failure

**Solution:**
1. Open browser console (F12)
2. Check for errors
3. Verify backend is running (port 5000)
4. Check network tab for failed requests

#### Issue 5: Rates not saving

**Cause:** Authentication or validation error

**Solution:**
- Check you're logged in
- Verify all required fields filled
- Check browser console for error
- Check backend logs

#### Issue 6: "System Default Rates" not in dropdown

**Cause:** SYSTEM_DEFAULT processor doesn't exist

**Solution:**
```bash
cd backend
npx ts-node prisma/seeds/seed-system-default-processor.ts
```

#### Issue 7: Seed script fails

**Error:** `No admin user found`

**Solution:**
Create admin user first, or update script to use different user.

**Error:** `No greige fabrics found`

**Solution:**
Add greige fabrics to greige_master table before running seed script.

### Verification Commands

#### Check if slabs created:
```bash
cd backend
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.processor_quantity_slabs.count().then(c => {
  console.log('Total slabs:', c);
  prisma.\$disconnect();
});
"
```

#### Check if rates created:
```bash
cd backend
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.processor_rate_card.count().then(c => {
  console.log('Total rate cards:', c);
  prisma.\$disconnect();
});
"
```

#### View rate cards by type:
```sql
SELECT
  processing_type,
  printing_type,
  COUNT(*) as rate_count
FROM processor_rate_card
WHERE "processorId" = (
  SELECT id FROM suppliers WHERE code = 'SYSTEM_DEFAULT'
)
GROUP BY processing_type, printing_type
ORDER BY processing_type, printing_type;
```

---

## API Reference

### Processor Rate Cards V2

**Base URL:** `/api/processor-rate-cards/v2`

#### Get Summary Dashboard
```
GET /summary
```
Returns overview of all processors with stats.

#### Get Processors
```
GET /processors
```
Returns all processors capable of DYEING/PRINTING.

#### Get Processor Matrix
```
GET /processors/:processorId/matrix
  ?processingType=DYEING
  &printingType=PIGMENT (optional)
```
Returns matrix data: slabs, greiges, rates.

#### Get Available Greiges
```
GET /greiges
```
Returns all greige fabrics for adding to matrix.

#### Update Slabs
```
POST /processors/:processorId/slabs
{
  processingType: "DYEING",
  slabs: [
    { slabOrder: 1, minQuantity: 0, maxQuantity: 500, slabLabel: "0-500m" },
    ...
  ]
}
```

#### Save Matrix (Bulk)
```
PUT /processors/:processorId/matrix
{
  processingType: "DYEING",
  printingType: "PIGMENT", // optional
  slabs: [...],
  rates: [...],
  shrinkages: [...]
}
```

#### Copy Rates
```
POST /copy
{
  sourceProcessorId: "uuid",
  targetProcessorId: "uuid",
  processingType: "DYEING",
  printingType: "PIGMENT", // optional
  copySlabs: true,
  copyRates: true
}
```

#### Add Greige
```
POST /processors/:processorId/greiges/:greigeId
{
  processingType: "DYEING",
  printingType: "PIGMENT" // optional
}
```

#### Remove Greige
```
DELETE /processors/:processorId/greiges/:greigeId
  ?processingType=DYEING
  &printingType=PIGMENT (optional)
```

#### Lookup Rate (Used by Fabric Costing)
```
POST /lookup
{
  processorId: "uuid", // optional, uses SYSTEM_DEFAULT if omitted
  processingType: "DYEING",
  printingType: "PIGMENT", // optional
  greigeId: "uuid",
  quantityMeters: 1200
}

Response:
{
  id: "rate-card-id",
  processorId: "processor-id",
  processorName: "ABC Dyeing Mill",
  processingType: "DYEING",
  greigeId: "greige-id",
  greigeName: "Cotton Cambric",
  slabId: "slab-id",
  slabLabel: "1000-5000m",
  minQuantity: 1000,
  maxQuantity: 5000,
  ratePerMeter: 55,
  totalCost: 66000,
  shrinkagePercent: 5,
  screenCostPerScreen: null
}
```

### Fabric Costing

**Base URL:** `/api/fabric-costing`

#### Calculate Single Fabric
```
POST /calculate
{
  fabricId: "uuid",
  cadMeters: 1.5,
  width: 60,
  orderQuantity: 100, // optional
  styleId: "uuid" // optional
}

Response:
{
  success: true,
  data: {
    fabricId: "...",
    fabricName: "...",
    stockReuse: {
      available: true,
      stockCost: 120,
      stockLotId: "...",
      leadTime: 0
    },
    readyFabric: {
      available: true,
      readyFabricCost: 150,
      supplierId: "...",
      leadTime: 15
    },
    greigeProcessing: {
      available: true,
      greigeCost: 80,
      processingCost: 65,
      processorId: "...",
      processorName: "ABC Mill",
      totalCost: 145,
      leadTime: 30,
      shrinkagePercent: 5,
      screenCostPerMeter: 7.5
    },
    recommendedStrategy: "STOCK_REUSE",
    recommendedCost: 120,
    savings: 25
  }
}
```

#### Calculate Batch
```
POST /batch-calculate
{
  fabrics: [
    { fabricId: "...", cadMeters: 1.5, width: 60 },
    ...
  ],
  orderQuantity: 100, // optional
  styleId: "uuid" // optional
}
```

---

## Database Schema

### processor_quantity_slabs
```sql
CREATE TABLE processor_quantity_slabs (
  id UUID PRIMARY KEY,
  "processorId" UUID REFERENCES suppliers(id),
  "processingType" VARCHAR NOT NULL, -- DYEING | PRINTING
  "slabOrder" INTEGER NOT NULL,
  "minQuantity" DECIMAL(10,2) NOT NULL,
  "maxQuantity" DECIMAL(10,2) NOT NULL,
  "slabLabel" VARCHAR,
  "isActive" BOOLEAN DEFAULT true,
  "createdById" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE ("processorId", "processingType", "slabOrder")
);
```

### processor_rate_card (V2)
```sql
CREATE TABLE processor_rate_card (
  id UUID PRIMARY KEY,
  "processorId" UUID REFERENCES suppliers(id),
  "processingType" VARCHAR NOT NULL, -- DYEING | PRINTING
  "printingType" VARCHAR, -- PIGMENT | PROCIAN | DISCHARGE | PIGMENT_DISCHARGE
  "greigeId" UUID REFERENCES greige_master(id),
  "slabId" UUID REFERENCES processor_quantity_slabs(id),
  "ratePerMeter" DECIMAL(10,2) NOT NULL,
  "shrinkagePercent" DECIMAL(5,2),
  "screenCostPerScreen" DECIMAL(10,2),
  "screenType" VARCHAR, -- ROTARY | FLATBELT | TABLE
  "isActive" BOOLEAN DEFAULT true,
  "createdById" UUID REFERENCES users(id),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE ("processorId", "processingType", "printingType", "greigeId", "slabId")
);
```

### Indexes
```sql
CREATE INDEX idx_processor_rate_lookup
ON processor_rate_card("processorId", "processingType");

CREATE INDEX idx_printing_type
ON processor_rate_card("processorId", "processingType", "printingType");

CREATE INDEX idx_greige
ON processor_rate_card("greigeId");

CREATE INDEX idx_slab
ON processor_rate_card("slabId");

CREATE INDEX idx_active
ON processor_rate_card("isActive");
```

---

## Related Files

### Documentation
- `CLAUDE.md` - Project-level instructions
- `.claude/plans/buzzing-riding-bachman.md` - Complete system overview plan

### Backend
- `backend/src/services/processor-rate-v2.service.ts` - Core service
- `backend/src/controllers/processor-rate-card-v2.controller.ts` - API controllers
- `backend/src/controllers/fabric-costing.controller.ts` - Fabric costing API
- `backend/src/routes/processor-rate-card-v2.routes.ts` - Routes
- `backend/src/types/processor-rate-v2.types.ts` - Type definitions
- `backend/prisma/schema.prisma` - Database schema
- `backend/prisma/seeds/seed-system-default-processor.ts` - Create SYSTEM_DEFAULT processor
- `backend/prisma/seeds/seed-default-processor-rates.ts` - Populate default rates

### Frontend
- `frontend/src/pages/ProcessorRateCardPage.tsx` - Main rate card UI (909 lines)
- `frontend/src/pages/FabricCostingPage.tsx` - Fabric costing calculator
- `frontend/src/components/processor-rate-card/ProcessorRateCardSummary.tsx` - Dashboard
- `frontend/src/services/processorRateCardV2.service.ts` - API service
- `frontend/src/types/processorRateCardV2.types.ts` - Frontend types
- `frontend/src/types/fabricCosting.types.ts` - Fabric costing types

---

## Summary

**System is ready for production use!**

✅ **V2 Matrix-Based System** - Superior to legacy V1
✅ **Default Rates Automated** - Run one seed script
✅ **Fabric Costing Calculator** - Standalone testing page
✅ **Cost Sheet Integration** - Production-ready
✅ **Complete Documentation** - This guide + inline comments

**Start using now:**

1. **Setup:** `npx ts-node prisma/seeds/seed-default-processor-rates.ts`
2. **View:** [http://localhost:5173/processor-rate-cards](http://localhost:5173/processor-rate-cards)
3. **Test:** [http://localhost:5173/fabric-costing](http://localhost:5173/fabric-costing)
4. **Use:** [http://localhost:5173/cost-sheets/new](http://localhost:5173/cost-sheets/new)

**Need help?** Check the troubleshooting section or review related files listed above.

---

**Last Updated:** December 27, 2025
**System Version:** Processor Rate Cards V2
**Status:** ✅ Production Ready
