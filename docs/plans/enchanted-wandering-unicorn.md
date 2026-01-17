# Fabric Costing Page - Linkage Analysis & Change Plan

## Analysis Complete ✓

I've mapped all backward and forward linkages for the Fabric Costing system.

---

## BACKWARD LINKAGES (Data Sources)

### 1. Master Data Dependencies

**Customer → Style Selection**
- [frontend/src/pages/FabricCostingPage.tsx:76](frontend/src/pages/FabricCostingPage.tsx#L76) - Fetches customers via `customerService`
- [frontend/src/pages/FabricCostingPage.tsx:116](frontend/src/pages/FabricCostingPage.tsx#L116) - Loads styles for selected customer via `styleService`

**Style → Fabric Data**
- [backend/src/controllers/fabric-costing.controller.ts:160-335](backend/src/controllers/fabric-costing.controller.ts#L160-L335) - `getStyleFabrics()` endpoint
- Queries: `styles` → `style_components` → `style_fabrics` → `fabric_master`
- Includes: greige data, fabric stock, existing width CADs

**Fabric Master**
- `costPerMeter` - Ready fabric cost
- `finishType` - Determines if DYEING or PRINTING
- Relation to `greige_master` for greige data

**Greige Master**
- `costPerMeter` - Default greige cost
- `averageShrinkagePercent` - Fallback shrinkage value
- Used in rate card lookups

**Fabric Stock**
- `weightedAvgCost` - Stock WAC (weighted average cost)
- Most recent stock entry used for costing

**Existing Costing Data**
- [backend/prisma/schema.prisma:3581-3666](backend/prisma/schema.prisma#L3581-L3666) - `fabric_width_cad` model
- Pre-existing costing loaded via `widthCADs` relation

### 2. Processor & Rate Card System

**Processors (Suppliers)**
- [backend/src/controllers/fabric-costing.controller.ts:118](backend/src/controllers/fabric-costing.controller.ts#L118) - `getProcessors()` endpoint
- Filters suppliers with `supplierType = 'DYEING_PRINTING'`

**Processor Rate Cards**
- [backend/src/services/processor-rate-v2.service.ts:742-829](backend/src/services/processor-rate-v2.service.ts#L742-L829) - `lookupRate()` function
- Queries: `processor_rate_card` with greige + slab + processor
- Returns: `ratePerMeter`, `shrinkagePercent`, `screenCostPerScreen`

**Quantity Slabs**
- `processor_quantity_slabs` - Min/max quantity ranges
- Used to determine slab for rate lookup

---

## FORWARD LINKAGES (Data Consumers)

### 1. Order Costing System

**Order Item Costing**
- [backend/src/services/orderCosting.service.ts:134-151](backend/src/services/orderCosting.service.ts#L134-L151)
- Uses `selectedCadId` to fetch `fabric_width_cad` record
- Recalculates order item costs based on selected CAD
- **CRITICAL:** Order costing depends on saved fabric costing data

**Database Relations**
- `order_items.selectedCadId` → `fabric_width_cad.id`
- `order_item_costing.selectedCadId` → `fabric_width_cad.id`

### 2. Style Costing System

**Cost Sheet Generation**
- [frontend/src/pages/CostSheetForm.tsx](frontend/src/pages/CostSheetForm.tsx) - Uses fabric costing components
- [frontend/src/components/cost-sheet/FabricCostingRow.tsx](frontend/src/components/cost-sheet/FabricCostingRow.tsx) - Displays fabric with sourcing strategies
- [frontend/src/components/cost-sheet/CostComparisonTable.tsx](frontend/src/components/cost-sheet/CostComparisonTable.tsx) - Shows cost comparison

**Legacy Calculation Endpoints** (Still Active)
- `/api/fabric-costing/calculate` - Single fabric cost calculation
- `/api/fabric-costing/batch-calculate` - Batch calculation
- These use `fabric-cost-calculation.service.ts` for priority-based sourcing

### 3. CAD Planning System

**CAD Planning Controller**
- Multiple references to `fabric_width_cad` throughout CAD planning
- Creates/updates CAD records during option generation
- Approves CAD by selecting preferred width

---

## KEY INTEGRATION POINTS

### API Endpoints

| Endpoint | Method | Purpose | File |
|----------|--------|---------|------|
| `/api/fabric-costing/processors` | GET | Fetch dyeing/printing suppliers | [fabric-costing.controller.ts:118](backend/src/controllers/fabric-costing.controller.ts#L118) |
| `/api/fabric-costing/style/:styleId` | GET | Get fabrics from style with costing data | [fabric-costing.controller.ts:160](backend/src/controllers/fabric-costing.controller.ts#L160) |
| `/api/fabric-costing/lookup-rate` | POST | Lookup processor rate | [fabric-costing.controller.ts:340](backend/src/controllers/fabric-costing.controller.ts#L340) |
| `/api/fabric-costing/save` | POST | Save costing to fabric_width_cad | [fabric-costing.controller.ts:402](backend/src/controllers/fabric-costing.controller.ts#L402) |
| `/api/fabric-costing/calculate` | POST | Legacy: Calculate single fabric cost | [fabric-costing.controller.ts:17](backend/src/controllers/fabric-costing.controller.ts#L17) |
| `/api/fabric-costing/batch-calculate` | POST | Legacy: Batch calculation | [fabric-costing.controller.ts:54](backend/src/controllers/fabric-costing.controller.ts#L54) |

### Database Model (Primary Storage)

**fabric_width_cad** - [schema.prisma:3581-3666](backend/prisma/schema.prisma#L3581-L3666)

**Key Fields:**
- `fabricId`, `cutableWidth`, `componentName` - Composite unique key
- `greigeId`, `greigeCostPerMeter` - Greige data
- `transportCostPerMeter` - Transport cost
- `processorId`, `processingPricePerMeter` - Processor & rate
- `shrinkagePercent`, `shrinkageCostPerMeter` - Shrinkage
- `screenCostPerMeter`, `screenType`, `numberOfColors` - Printing
- `totalCostPerMeter` - Final calculated cost
- `costInputMode` - 'LANDED_PRICE' or 'BUILD_UP'
- `costingStyleId` - Style this costing belongs to

### Serialization (CRITICAL)

**Backend Serializer** - [backend/src/utils/serializer.ts](backend/src/utils/serializer.ts)

**Transforms:**
- `style_components` → `styleComponents`
- `style_fabrics` → `styleFabrics`
- `fabric_width_cad` → `fabricWidthCad`

**Frontend MUST use camelCase** when accessing nested relations:
```typescript
// WRONG
const cad = fabric.fabric_width_cad;

// CORRECT
const cad = fabric.fabricWidthCad;
```

---

## IDENTIFIED ISSUES & POTENTIAL CHANGES

### 1. **Missing Navigation Link**
- Fabric Costing page exists but may not be in main navigation
- Check: [frontend/src/App.tsx](frontend/src/App.tsx) and navigation components

### 2. **Cost Input Modes**
- Two modes: `LANDED_PRICE` vs `BUILD_UP`
- UI handles both but documentation may be needed

### 3. **Legacy Endpoints Still Active**
- `/calculate` and `/batch-calculate` endpoints still exist
- Used by `CostSheetForm.tsx` components
- Should these be deprecated or kept?

### 4. **Processor Rate Card Dependency**
- Fabric costing heavily depends on processor rate cards
- Missing rate cards = no processing cost auto-fill
- Need validation/fallback handling?

### 5. **Screen Cost Calculation**
- Amortized over quantity: `(screenCost × colors) / quantity`
- What happens if quantity changes after costing?
- Re-costing workflow needed?

### 6. **Transport Cost Modes**
- `PER_METER` vs `FIXED` (distributed over quantity)
- FIXED mode depends on accurate quantity
- Quantity change impact?

### 7. **Data Persistence Strategy**
- Saves to `fabric_width_cad` (not `style_fabrics` directly)
- Multiple costing options possible per fabric/width
- Data cleanup/versioning strategy?

### 8. **Order Costing Integration**
- Order costing pulls `selectedCadId` from order_items
- What if CAD costing is updated after order creation?
- Versioning/audit trail needed?

---

## CRITICAL ARCHITECTURAL ISSUES DISCOVERED 🔴

### Issue 1: fabric_width_cad - Hybrid Master/Transaction Table

**Problem:** Mixing CAD master data with style-specific costing

**Current Structure:**
```typescript
fabric_width_cad {
  // CAD Master Data (correct)
  fabricId, cutableWidth, cadMeters, cadWastagePercent

  // Style-Specific Costing (WRONG - should not be here!)
  costingStyleId  // ← Links to specific style!
  greigeCostPerMeter, transportCostPerMeter
  processorId, processingCostPerMeter
  shrinkagePercent, shrinkageCostPerMeter
  screenCostPerMeter, totalCostPerMeter
  costInputMode, numberOfColors
}
```

**Unique Constraint Conflict:**
- Constraint: `@@unique([fabricId, cutableWidth, componentName])`
- But `costingStyleId` makes it style-specific
- **Result:** Cannot store different costs for same fabric/width across multiple styles!

**Impact:** Style-specific costing pollutes master CAD data

---

### Issue 2: Missing Master Tables

| Master Type | Status | Current Location | Problem |
|-------------|--------|------------------|---------|
| **Transport Cost** | ❌ MISSING | fabric_width_cad.transportCostPerMeter | No reusability across styles |
| **Screen Cost** | ⚠️ INCOMPLETE | processor_rate_card.screenCostPerScreen | Coupled with rate cards |
| **Cost Versioning** | ❌ MISSING | None | No historical cost tracking |
| **Fabric Cost History** | ❌ MISSING | fabric_master.costPerMeter (no version) | Updated in place |
| **Greige Cost History** | ❌ MISSING | greige_master.costPerMeter (no version) | Updated in place |

---

### Issue 3: Transactional Data Used as Cost Source

**Problem:** `fabric_stock` (transactional) used as cost source

**Current Flow:**
```
fabric-cost-calculation.service.ts
├─ Option 1: fabric_stock.weightedAvgCost ← TRANSACTIONAL!
├─ Option 2: fabric_procurement.ratePerUnit ← HISTORICAL!
└─ Option 3: fabric_master.costPerMeter ← MASTER (correct)
```

**Impact:** Inconsistent cost sources, historical costs bleeding into new calculations

---

### Issue 4: Correct Design Exists But Underutilized

**style_costing_fabric_items** is CORRECTLY designed:
- ✓ Versioned (via style_costing.version)
- ✓ Has sourcing strategy field
- ✓ References masters (processorId, rateCardId)
- ✓ Stores calculated costs

**Problem:** fabric_width_cad still being used for costing instead!

---

## BACKWARD LINKAGES - DETAILED ANALYSIS

### ✓ CORRECT Backward Linkages

1. **fabric_master** → Cost source (ready fabric)
   - Field: `costPerMeter`
   - Usage: Correct as master data
   - Issue: No versioning

2. **greige_master** → Cost source (greige)
   - Field: `costPerMeter`, `averageShrinkagePercent`
   - Usage: Correct as master data
   - Issue: No versioning

3. **processor_rate_card** → Processing rates
   - Fields: `ratePerMeter`, `shrinkagePercent`, `screenCostPerScreen`
   - Usage: Correct as master data
   - Issue: Screen cost should be separate master

4. **suppliers** (processors) → Processor info
   - Usage: Correct as master data

5. **processor_quantity_slabs** → Quantity ranges
   - Usage: Correct as master data

### ❌ INCORRECT Backward Linkages

1. **fabric_width_cad** → Costing storage
   - **Problem:** Stores style-specific costs in CAD master table
   - **Should be:** CAD dimensions only, costs in style_costing_fabric_items

2. **fabric_stock** → Cost source via `weightedAvgCost`
   - **Problem:** Transactional stock data used as master cost
   - **Should be:** Use fabric_master.costPerMeter only

3. **fabric_procurement** → Cost source via `ratePerUnit`
   - **Problem:** Historical transaction costs used
   - **Should be:** Use fabric_master.costPerMeter only

### ⚠️ MISSING Backward Linkages

1. **transport_cost_master** (does not exist)
   - Current: Ad-hoc in fabric_width_cad
   - Needed: Supplier/region-based transport costs

2. **cost_version_master** (does not exist)
   - Current: Costs updated in place
   - Needed: Effective date tracking for historical costing

---

## RECOMMENDED ARCHITECTURE CHANGES

### Priority 1: Separate CAD Master from Costing (CRITICAL)

**Remove from fabric_width_cad:**
- costingStyleId
- greigeCostPerMeter, transportCostPerMeter
- processorId, processingCostPerMeter
- shrinkagePercent, shrinkageCostPerMeter
- screenCostPerMeter, totalCostPerMeter
- costInputMode, numberOfColors

**Keep in fabric_width_cad:**
- CAD-specific: fabricId, cutableWidth, cadMeters, cadWastagePercent
- Marker data: markerEfficiency, markerPlanFile, etc.
- Preferences: isPreferred, supplierAvailability

**Move to style_costing_fabric_items:**
- All costing breakdown fields (already has greigeCost, processingCost, etc.)
- Style-specific sourcing decisions

### Priority 2: Create Missing Master Tables

1. **transport_cost_master**
```sql
CREATE TABLE transport_cost_master (
  id UUID PRIMARY KEY,
  supplierId UUID, -- or sourceRegion
  destinationRegion VARCHAR,
  costPerMeter DECIMAL,
  costPerKg DECIMAL?,
  effectiveDate DATE,
  supersededDate DATE?,
  ...
)
```

2. **screen_cost_master** (optional, could stay in processor_rate_card)
```sql
CREATE TABLE screen_cost_master (
  id UUID PRIMARY KEY,
  processorId UUID?,
  screenType VARCHAR, -- ROTARY, FLATBELT, TABLE
  costPerScreen DECIMAL,
  effectiveDate DATE,
  ...
)
```

3. **Cost Versioning Strategy**
- Add `effectiveDate`, `supersededDate` to fabric_master
- OR create fabric_cost_version table
- Similar for greige_master

### Priority 3: Fix Cost Calculation Service

**Update fabric-cost-calculation.service.ts:**
- Remove fabric_stock.weightedAvgCost lookups
- Remove fabric_procurement.ratePerUnit lookups
- Use masters only: fabric_master, greige_master, processor_rate_card
- Add transport_cost_master lookup

### Priority 4: Update Fabric Costing Page

**Backend (fabric-costing.controller.ts):**
- `saveFabricCosting()` should save to style_costing_fabric_items, NOT fabric_width_cad
- `getStyleFabrics()` should load existing costs from style_costing_fabric_items
- Keep fabric_width_cad for CAD dimensions only

**Frontend (FabricCostingPage.tsx):**
- Update to work with style_costing_fabric_items
- Keep CAD selection separate from costing

---

## USER CLARIFICATIONS RECEIVED ✓

### 1. Shrinkage Source Priority
**User Decision:** Processor rate card should be PRIMARY source
- ✓ If processor is set → use processor_rate_card.shrinkagePercent
- ✓ If processor is NOT set → use greige_master.averageShrinkagePercent (default)
- **Action:** Update shrinkage lookup logic in backend

### 2. Transport & Screen Cost Masters
**User Decision:** DO NOT create new master tables
- **Reasoning:** One-time setup values
- Screen costs are hardcoded (3 values: ROTARY, FLATBELT, TABLE)
- Screen costs are universal across all processors
- Transport costs can remain ad-hoc per style
- **Action:** Keep current structure, no new masters needed

### 3. fabric_width_cad Design
**User Question:** "Need more information on why it was made and its usage"
**Analysis Result:**
- **Purpose:** Hybrid table serving TWO workflows:
  1. **CAD Planning** - Creates records with width options and consumption
  2. **Fabric Costing** - Populates cost breakdown for style quotations
- **Usage:** Preliminary style-level costing BEFORE orders
- **Order Costing:** Uses only `cadMeters` and `cutableWidth`, NOT the costing fields
- **Design Intent:** `costingStyleId` links costing to specific style for audit trail
- **Conclusion:** Working as designed - costing fields are archived preliminary calculations

### 4. Stock Cost Usage
**User Question:** "If a stock fabric has certain price, shouldn't we use that?"
**Analysis Result:**
- **Current Logic:** Three sourcing strategies (STOCK_REUSE, READY_FABRIC, GREIGE_PROCESSED)
- System shows ALL options and recommends cheapest
- Stock uses **Weighted Average Cost (WAC)**, not original purchase price
- Users can manually override to select stock even if not cheapest
- **Stock is CORRECT as a cost source** - it's an option, not a requirement
- **Conclusion:** Current usage is appropriate for sourcing strategy comparison

### 5. fabric_procurement Usage
**Analysis Result:**
- Used for "last purchased price" of ready fabric
- Priority: Latest procurement price → fabric_master.costPerMeter
- **Purpose:** Historical market pricing reference
- **Conclusion:** Appropriate usage for READY_FABRIC sourcing strategy

---

## REVISED ARCHITECTURE ASSESSMENT

### ✅ CORRECT Design Patterns (Keep As-Is)

1. **fabric_width_cad hybrid structure**
   - Stores both CAD dimensions AND preliminary costing
   - `costingStyleId` provides audit trail
   - Order costing extracts only dimensions, recalculates costs
   - **No changes needed**

2. **Stock cost usage**
   - Part of three-strategy comparison (STOCK_REUSE vs READY_FABRIC vs GREIGE_PROCESSED)
   - Uses Weighted Average Cost appropriately
   - **No changes needed**

3. **fabric_procurement as cost source**
   - Historical "last purchased price" reference
   - Fallback to fabric_master if no procurement history
   - **No changes needed**

4. **Screen costs hardcoded**
   - Three universal values (ROTARY ₹3000, FLATBELT ₹1100, TABLE ₹1000)
   - No need for separate master table
   - **No changes needed**

### ⚠️ MINOR FIXES NEEDED

1. **Shrinkage Lookup Priority**
   - **Current:** Uses greige_master.averageShrinkagePercent as default
   - **Fix:** Check processor_rate_card.shrinkagePercent FIRST, then greige_master
   - **Files:**
     - [backend/src/services/processor-rate-v2.service.ts:742-829](backend/src/services/processor-rate-v2.service.ts#L742-L829) - `lookupRate()` already returns shrinkage
     - [frontend/src/pages/FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) - Ensure UI uses processor shrinkage when available

2. **Documentation/Comments**
   - Add comments explaining fabric_width_cad dual purpose
   - Document sourcing strategy comparison logic
   - Clarify that order costing recalculates, doesn't use stored costs

### ❌ NO CHANGES NEEDED

1. **transport_cost_master** - NOT creating (per user decision)
2. **screen_cost_master** - NOT creating (per user decision)
3. **Cost versioning** - NOT needed for current requirements
4. **fabric_width_cad refactoring** - NOT needed (working as designed)
5. **Removing stock/procurement costs** - NOT needed (appropriate usage)

---

## FINAL IMPLEMENTATION PLAN

### Phase 1: Fix Shrinkage Lookup Logic

**Backend Changes:**

1. **File:** [backend/src/services/processor-rate-v2.service.ts:742-829](backend/src/services/processor-rate-v2.service.ts#L742-L829)
   - Review `lookupRate()` function
   - Ensure it returns `shrinkagePercent` from processor_rate_card when available
   - Fallback to greige_master.averageShrinkagePercent if rate card has null

2. **File:** [backend/src/controllers/fabric-costing.controller.ts:340-401](backend/src/controllers/fabric-costing.controller.ts#L340-L401)
   - Review `lookupProcessorRate()` endpoint
   - Ensure shrinkage is properly returned in response

**Frontend Changes:**

3. **File:** [frontend/src/pages/FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx)
   - Line ~600-700: `handleProcessorRateLookup()` function
   - Ensure shrinkagePercent from processor rate card is used
   - Only fallback to greige default if processor not selected

### Phase 2: Add Documentation

**Schema Documentation:**

4. **File:** [backend/prisma/schema.prisma:3581-3666](backend/prisma/schema.prisma#L3581-L3666)
   - Add comments to fabric_width_cad model explaining:
     - Dual purpose (CAD dimensions + preliminary costing)
     - costingStyleId usage (style-specific audit trail)
     - How order costing uses this table (dimensions only)

**Service Documentation:**

5. **File:** [backend/src/services/fabric-cost-calculation.service.ts](backend/src/services/fabric-cost-calculation.service.ts)
   - Add comments explaining three sourcing strategies
   - Document when each strategy is appropriate
   - Clarify stock WAC usage

### Phase 3: Code Cleanup (Optional)

**Remove Confusing Comments:**

6. Review and update any misleading comments that suggest:
   - Stock costs shouldn't be used (they should for STOCK_REUSE)
   - fabric_width_cad costing fields are wrong (they're for preliminary costing)
   - procurement costs are incorrect (they're for historical reference)

---

## DETAILED FILE CHANGES

### 1. processor-rate-v2.service.ts (Shrinkage Priority Fix)

**Current Code (Lines 742-829):**
```typescript
export async function lookupRate(query: RateLookupQuery): Promise<RateLookupResult | null> {
  // ... lookup logic ...

  return {
    id: rateCard.id,
    processorId: processor.id,
    processorName: processor.name,
    processingType,
    greigeId: greige.id,
    greigeName: greige.greigeName,
    slabLabel: slab.slabLabel,
    ratePerMeter: Number(rateCard.ratePerMeter),
    shrinkagePercent: rateCard.shrinkagePercent
      ? Number(rateCard.shrinkagePercent)
      : greige.averageShrinkagePercent  // ← Fallback to greige
      ? Number(greige.averageShrinkagePercent)
      : null,
    screenCostPerScreen: rateCard.screenCostPerScreen
      ? Number(rateCard.screenCostPerScreen)
      : null,
  };
}
```

**Status:** ✅ Already implements correct priority! No change needed.

### 2. FabricCostingPage.tsx (Verify Shrinkage Usage)

**Review Lines ~600-700:**
```typescript
const handleProcessorRateLookup = async (row: FabricCostingRow) => {
  // ... lookup logic ...

  // Ensure we use the shrinkagePercent from rate lookup result
  const shrinkagePercent = rateLookup.shrinkagePercent || 0;

  // Apply shrinkage cost calculation
  const shrinkageValue = (row.greigeCostPerMeter || 0) * (shrinkagePercent / 100);
}
```

**Action:** Verify this uses processor shrinkage when available

### 3. Schema Comments (Documentation)

**Add to fabric_width_cad model:**
```prisma
/// This table serves TWO purposes:
/// 1. CAD Planning: Stores width options and consumption per garment (cadMeters, cutableWidth)
/// 2. Fabric Costing: Stores preliminary cost breakdown for style quotations
///
/// The costing fields (greigeCostPerMeter, transportCostPerMeter, etc.) are STYLE-SPECIFIC
/// and linked via costingStyleId. These are preliminary calculations used for quotations.
///
/// During order costing, ONLY the CAD dimensions (cadMeters, cutableWidth) are used.
/// Actual costs are recalculated from style_costing based on order-specific quantities.
model fabric_width_cad {
  // ...
}
```

---

## TESTING PLAN

### Test Case 1: Shrinkage Priority
1. Create processor rate card with shrinkagePercent = 5%
2. Set greige_master.averageShrinkagePercent = 8%
3. Use FabricCostingPage to lookup rate
4. **Expected:** Should use 5% (processor), not 8% (greige)

### Test Case 2: Shrinkage Fallback
1. Create processor rate card with shrinkagePercent = NULL
2. Set greige_master.averageShrinkagePercent = 8%
3. Use FabricCostingPage to lookup rate
4. **Expected:** Should use 8% (greige default)

### Test Case 3: No Processor Selected
1. Don't select processor on FabricCostingPage
2. Set greige_master.averageShrinkagePercent = 8%
3. Calculate costs
4. **Expected:** Should use 8% (greige default)

---

## SUMMARY OF CHANGES

**What we're changing:**
1. ✅ Verify shrinkage lookup priority (likely already correct)
2. ✅ Add documentation/comments to clarify design
3. ✅ Minor UI verification for shrinkage display

**What we're NOT changing:**
1. ❌ No new master tables (transport_cost_master, screen_cost_master)
2. ❌ No fabric_width_cad refactoring (working as designed)
3. ❌ No stock/procurement cost removal (appropriate usage)
4. ❌ No architectural overhaul (current design is sound)

**Impact:** Minimal - mostly documentation and verification

---

## IMPLEMENTATION STATUS ✅

### Phase 1: Greige Cost from Stock - COMPLETED ✅

**Issue Fixed:** Greige cost from procurement/stock was not showing in BUILD_UP mode

**Changes Implemented:**

1. **Backend API** ([fabric-costing.controller.ts:180-254](backend/src/controllers/fabric-costing.controller.ts#L180-L254))
   - Added `fabricProcurements` relation to greige queries
   - Fetches latest greige procurement (ordered by `purchaseDate DESC`)
   - Priority: `greigeStockCost` (procurement) → `greigeDefaultCost` (master)

2. **Backend Data Mapping** ([fabric-costing.controller.ts:330-360](backend/src/controllers/fabric-costing.controller.ts#L330-L360))
   - New fields: `greigeStockCost`, `greigeCostPerMeter`, `greigeCostSource`, `greigeStockAvailable`

3. **Frontend Types** ([fabricCosting.types.ts:170-174](frontend/src/types/fabricCosting.types.ts#L170-L174))
   - Added greige procurement cost fields

4. **Frontend Display** ([FabricCostingPage.tsx:259-260, 778-789](frontend/src/pages/FabricCostingPage.tsx#L259-L260))
   - Uses `greigeCostPerMeter` (stock → default)
   - Visual badges: "Stock" (green) or "Default" (blue)

**Result:** Greige cost now properly displays procurement cost when available, with visual source indicator

---

## PHASE 2: FINISH TYPE → PROCESS LINKAGE

### Current Analysis Needed

**Objective:** Link Finish Type to processing types, rates, and shrinkages

**Key Questions to Investigate:**

1. **Finish Type Mapping**
   - How does `finishType` (DYED, PRINTED, YARN_DYED, RAW) map to `processingType` (DYEING, PRINTING)?
   - Is the mapping automatic or manual?
   - Current logic location?

2. **Processing Type Selection**
   - When/how is `processingType` determined from `finishType`?
   - Current: [FabricCostingPage.tsx:271-272](frontend/src/pages/FabricCostingPage.tsx#L271-L272)
   ```typescript
   processingType: fabric.finishType === 'PRINTED' ? 'PRINTING' :
                   (fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED') ? 'DYEING' : null,
   ```

3. **Processor Rate Lookup**
   - Requires: `processorId`, `processingType`, `greigeId`, `quantityMeters`
   - Current endpoint: `/api/fabric-costing/lookup-rate`
   - Returns: `ratePerMeter`, `shrinkagePercent`, `screenCostPerScreen`

4. **Automatic Rate Population**
   - Should rates auto-populate when processor is selected?
   - Should shrinkage auto-populate from rate card?
   - What if rate card is missing?

5. **Issues to Verify:**
   - Is the finish type → processing type mapping correct?
   - Are rates being fetched correctly?
   - Is shrinkage priority working (processor → greige master)?
   - Are there validation issues?

### Files to Investigate

- [frontend/src/pages/FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) - Finish type mapping logic
- [backend/src/controllers/fabric-costing.controller.ts:340-401](backend/src/controllers/fabric-costing.controller.ts#L340-L401) - Rate lookup endpoint
- [backend/src/services/processor-rate-v2.service.ts:742-829](backend/src/services/processor-rate-v2.service.ts#L742-L829) - Rate lookup service

### Investigation Complete ✅

**1. Finish Type → Processing Type Mapping**
- **Status:** ✅ Working correctly
- **Logic:** Automatic, non-editable mapping at row initialization
  - `PRINTED` → `PRINTING`
  - `DYED` → `DYEING`
  - `YARN_DYED` → `DYEING`
  - `RAW` → `null` (no processor)
- **Location:** [FabricCostingPage.tsx:272-273](frontend/src/pages/FabricCostingPage.tsx#L272-L273)

**2. Processor Rate Lookup Flow**
- **Status:** ✅ Working, but manual trigger
- **Workflow:**
  1. User selects processor from dropdown
  2. (If PRINTING) User selects printing type (PIGMENT, PROCIAN, etc.)
  3. User clicks "Lookup Rate" button (RefreshCw icon)
  4. API fetches rate card: processor + processingType + printingType + greige + quantity slab
  5. Auto-populates: `processingCostPerMeter`, `shrinkagePercent`, `screenCostPerScreen`
  6. Auto-recalculates total cost
- **Location:** [FabricCostingPage.tsx:399-460](frontend/src/pages/FabricCostingPage.tsx#L399-L460)

**3. Shrinkage Priority**
- **Status:** ✅ Correctly implemented
- **Priority:** Processor rate card → Greige master → null
- **Location:** [processor-rate-v2.service.ts:807-813](backend/src/services/processor-rate-v2.service.ts#L807-L813)
```typescript
const shrinkagePercent = rateCard.shrinkagePercent
  ? Number(rateCard.shrinkagePercent)
  : (rateCard.greige.averageShrinkagePercent ? Number(rateCard.greige.averageShrinkagePercent) : null);
```

**4. Processing Type Selection UI**
- **Finish Type Display:** Visual badges (read-only)
- **Processing Type:** Automatically determined from finish type (not in UI)
- **Printing Type:** Dropdown in expanded details (required for PRINTING)
- **Processor Selection:** Dropdown filtered by `supplierType = 'DYEING_PRINTING'`

**5. Automatic Population**
| Feature | Current Status | Notes |
|---------|---------------|-------|
| Greige cost from stock | ✅ Auto-populated | Completed in Phase 1 |
| Processing type from finish type | ✅ Auto-mapped | Cannot be manually changed |
| Processor selection | ✅ Working | User selects from dropdown |
| Rate auto-fetch on processor select | ❌ Manual | Requires "Lookup Rate" button click |
| Rate auto-fetch on printing type select | ❌ Manual | Same button trigger |
| Shrinkage from rate card | ✅ Auto-populated | After rate lookup |
| Screen cost calculation | ✅ Auto-calculated | Amortized over quantity |
| Total cost recalculation | ✅ Auto-updated | Real-time |

### Issues Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| Rate lookup requires manual button click | Low-Medium | Minor workflow friction |
| No auto-fetch on processor selection | Low | Could streamline for DYEING (simple case) |
| Printing type required but UI location not obvious | Low | In expanded details section |
| No error message if slab not found | Medium | Silent failure; shows warning |

### Recommendations

**No changes needed** - Current implementation is working correctly:
1. ✅ Finish type correctly maps to processing type
2. ✅ Processor rate lookup works with proper validation
3. ✅ Shrinkage priority is correctly implemented
4. ✅ All costs auto-recalculate properly

**Optional Enhancement** (not critical):
- Could auto-trigger rate lookup when processor is selected for DYEING (simpler case without printing type)
- Could show clearer error message when rate card slab not found

**User should verify:**
1. Rate cards exist for all processor + greige + slab combinations
2. Printing type is selected for PRINTED fabrics before rate lookup
3. Screen costs are configured in rate cards for PRINTING
4. Quantity slabs cover expected order quantities

---

## PHASE 3: ACTUAL ISSUES FOUND - LNG211 STYLE

### User Report: Prices Not Reflecting

**Screenshots Analysis:**
1. **Fabric Costing Page:** Shows greige cost ₹42, but CAD (m) = 0.00 and processing cost not populated
2. **Processor Rate Card:** Manish Textiles has rates configured (₹25 for 0-50M, ₹18 for 50-550M, 10% shrinkage)
3. **Selected:** "Manish Textiles" processor is selected, but no rates showing

### Issues Identified

| Issue # | Problem | Cause | Impact |
|---------|---------|-------|--------|
| **1** | CAD meters = 0.00 | Not loading from style_fabrics | Total quantity = 0, rate lookup fails |
| **2** | Processing cost not populated | Manual rate lookup not triggered | No processing cost showing |
| **3** | No auto-rate lookup | Current design requires manual button click | User friction, rates not populated |

### Root Cause Analysis

**Issue 1: CAD Meters Not Loading**

Current code at [FabricCostingPage.tsx:238-239](frontend/src/pages/FabricCostingPage.tsx#L238-L239):
```typescript
cadMeters: fabric.cadMeters || 0,
```

Backend sends at [fabric-costing.controller.ts:299](backend/src/controllers/fabric-costing.controller.ts#L299):
```typescript
const cadMeters = styleFabric.fabricCAD?.cadMeters
  ? Number(styleFabric.fabricCAD.cadMeters)
  : styleFabric.cadAverageMeters
    ? Number(styleFabric.cadAverageMeters)
    : null;
```

**Problem:**
- Backend tries `fabricCAD.cadMeters` (from fabric_width_cad) first
- Falls back to `cadAverageMeters` (from style_fabrics)
- Likely BOTH are null/undefined for LNG211 style

**Issue 2 & 3: Rate Lookup Not Automatic**

Current workflow requires:
1. User selects processor ✅ (done)
2. User clicks "Lookup Rate" button ❌ (not done)

Since CAD = 0, even if user clicks lookup, it will fail because `quantityMeters = 0.00 × 1000 = 0`

### User Requirements Confirmed

1. ✅ **CAD should auto-populate from style_fabrics**
   - Load CAD consumption automatically when style is selected

2. ✅ **Auto-lookup rates on processor selection**
   - For DYEING: Auto-fetch when processor selected
   - For PRINTING: Auto-fetch when processor AND printing type selected

### Proposed Fixes

**Fix 1: CAD Meters Loading Priority**

Change backend priority order:
1. `style_fabrics.cadAverageMeters` (PRIMARY - style-specific consumption)
2. `fabric_width_cad.cadMeters` (fallback - if CAD planning done)
3. `fabric_master.cadMeters` (last resort - fabric default)

**Fix 2: Auto-Rate Lookup on Processor Selection**

Add auto-trigger logic in frontend:
- When processor changes → auto-lookup for DYEING
- When printing type changes → auto-lookup for PRINTING (if processor set)
- Validate: processor + greige + quantity > 0

**Fix 3: Better Error Messaging**

- Show warning when CAD = 0
- Show error when rate card not found with specific missing criteria
- Guide user to fix data issues

### Implementation Plan

**Backend Changes:**

1. **File:** [backend/src/controllers/fabric-costing.controller.ts:299-303](backend/src/controllers/fabric-costing.controller.ts#L299-L303)
   ```typescript
   // Change priority: style_fabrics → fabric_width_cad → fabric_master
   const cadMeters = styleFabric.cadAverageMeters
     ? Number(styleFabric.cadAverageMeters)
     : styleFabric.fabricCAD?.cadMeters
       ? Number(styleFabric.fabricCAD.cadMeters)
       : styleFabric.fabric?.cadMeters
         ? Number(styleFabric.fabric.cadMeters)
         : null;
   ```

**Frontend Changes:**

2. **File:** [frontend/src/pages/FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx)

   **Add auto-lookup on processor change:**
   - Modify processor selection handler (~850 lines)
   - After processor selected, check if can auto-lookup
   - For DYEING: call `lookupRate()` immediately
   - For PRINTING: wait for printing type

   **Add auto-lookup on printing type change:**
   - Modify printing type handler (~1000 lines)
   - After printing type selected, check if processor set
   - If yes, call `lookupRate()` immediately

   **Add validation messages:**
   - Show warning badge when CAD = 0
   - Show tooltip: "CAD consumption not set. Go to CAD Planning or enter manually."
   - Show clear error when rate lookup fails with reason

### Testing Checklist

- [ ] Load LNG211 style - verify CAD meters populate
- [ ] Select processor - verify rates auto-populate (DYEING)
- [ ] For PRINTED fabric - verify rates populate after printing type selected
- [ ] Verify shrinkage shows from rate card (10% for Viscose Staple)
- [ ] Verify processing cost shows (₹25 for 0-50M slab)
- [ ] Verify total cost calculates correctly
- [ ] Test with CAD = 0 - verify warning shows
- [ ] Test with missing rate card - verify clear error message
