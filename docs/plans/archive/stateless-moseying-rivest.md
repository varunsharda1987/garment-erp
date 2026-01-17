# Fabric Costing System - Issues & Improvements

## Real-World Factory Scenario Issues

The user identified 6 critical issues that need resolution to match real-world garment factory workflows.

---

## Issue 1: Greige Price Fluctuation & Manual Override

### User's Raw Thought:
> "Greige prices keep fluctuating. If something is not in stock and we have to order the same, or if we need to put a new price - how do we do that?"

### Current Implementation:
**File:** `backend/src/services/fabric-cost-calculation.service.ts:372-404`

**Current Priority Chain:**
1. `fabric_procurement.ratePerUnit` (Latest GREIGE procurement)
2. `stock_levels.valuationRate` (Via materials table with greigeId)
3. `greige_master.costPerMeter` (Default fallback)

**Frontend Type:** `frontend/src/types/fabricCosting.types.ts:175-178`
```typescript
greigeCostSource: 'GREIGE_PROCUREMENT' | 'GREIGE_MASTER' | 'MANUAL';
```

### Problem:
- Users CAN manually enter greige cost in the UI (field exists)
- BUT there's no clear way to save a "new procurement price" for future use
- No historical tracking of greige price changes
- No way to set a "planning price" different from actual procurement

### Questions for Discussion:
1. Should we add a "Manual Override" checkbox that lets user type any price?
2. Should manual prices be saved back to greige_master?
3. Should we create a "greige price history" table for tracking?
4. For planning purposes, should we allow "estimated" greige prices?

### Proposed Solution Options:
**Option A:** Simple manual override (just enter price, doesn't save to master)
**Option B:** Create new procurement record when price changes
**Option C:** Add "estimated price" field to greige_master for planning

---

## Issue 2: Repeat Style vs One-Time Order Workflow

### User's Raw Thought:
> "A repeat style can be produced again and again multiple times. In this case, maybe I don't want to go through different stages every time. But in production, I might get a different width fabric. Values come from CAD, and I need to approve that cost as well. Currently, the system doesn't let you approve multiple widths."

### Current Implementation:
**File:** `backend/src/controllers/fabric-costing.controller.ts:940-951`

**Approval Logic:**
```typescript
// When approving Option A, ALL other options for same component get unapproved:
await tx.fabric_width_cad.updateMany({
  where: {
    costingStyleId: option.costingStyleId,
    componentName: option.componentName,  // Same component
    id: { not: optionId },                // Other widths
  },
  data: {
    isPreferred: false,
    approvalStatus: null,
  },
});
```

### Problems:
1. **Only ONE width can be approved per component** - Real factories may receive fabric in different widths
2. **Repeat styles have to go through PLANNING → COSTING → PRODUCTION each time** - Wasteful for repeat orders
3. **No "quick approval" path for repeat styles** - Forces full workflow

### Questions for Discussion:
1. Should repeat styles skip directly to PRODUCTION mode?
2. Should we allow multiple widths to be approved simultaneously?
3. Should there be a "repeat order" flag that simplifies the workflow?
4. How do we handle width variations in repeat production runs?

### Proposed Solution Options:
**Option A:** Add "Allow Multiple Widths" toggle per style/component
**Option B:** Create "Repeat Order" mode that skips PLANNING/COSTING
**Option C:** Change approval to approve ALL widths at once (batch approval)
**Option D:** Remove the "only one approved" constraint entirely

---

## Issue 3: Style-Specific Costing View (Options Page Confusion)

### User's Raw Thought:
> "I want to see all the different prices calculated in different modes for a PARTICULAR style, not all styles. Current 'View All Options' is confusing. Also, if costing is already done for a style, the first page doesn't show this."

### Current Implementation:

**Options Page:** `frontend/src/pages/FabricCostingOptionsPage.tsx`
- Shows ALL styles grouped together
- Must filter by Customer → Style (tedious)
- No indication on main costing page if style already has costings

**Unused Backend Endpoint:** `GET /api/fabric-costing/style/:styleId/options`
- Exists but NOT used by any frontend component
- Returns style-specific costing options

### Problems:
1. **Options page shows ALL styles** - Overwhelming, hard to find specific style
2. **No "already costed" indicator** on main Fabric Costing page
3. **Style-specific endpoint exists but unused** - Backend ready, frontend not
4. **Confusing navigation** - User doesn't know where to look

### Questions for Discussion:
1. Should we add a "View Options" button on the main costing page that opens style-specific view?
2. Should the style search show "Costing Done ✓" badge?
3. Should we create a new dedicated route: `/fabric-costing/style/:styleId/options`?

### Proposed Solution:
1. Add badge on style search: "Costed" / "Pending" / "Not Started"
2. Add "View Existing Options" button when style has costings
3. Create style-specific options page using existing backend endpoint

---

## Issue 4: Remove Global Estimated Qty (Already Have Row-Level)

### User's Raw Thought:
> "Need to remove the Estimated Qty from top bar as we are taking the same in individual rows."

### Current Implementation:
**File:** `frontend/src/pages/FabricCostingPage.tsx:815-825`

```typescript
<div>
  <Label className="text-sm font-medium mb-2 block">Estimated Quantity (pcs)</Label>
  <Input
    type="number"
    value={orderQuantity}
    onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
  />
</div>
```

**Row-Level Qty:** Lines 929-941 (Qty column with per-row input)

### Problem:
- **Duplicate inputs** - Global qty in header + row-level qty in table
- **Confusing** - Which one takes precedence?
- **Row qty already implemented** - Global is redundant

### Solution:
**Simple removal** - Delete the global qty input from header card (lines 815-825)
- Row-level qty (lines 929-941) already handles this
- Default `orderQuantity` state can remain as fallback for new rows

---

## Issue 5: Approve Button Not Working

### User's Raw Thought:
> "The approve button on the front page is not working."

### Current Implementation:
**File:** `frontend/src/pages/FabricCostingPage.tsx`

**Button Disabled Conditions (Line 1214):**
```typescript
disabled={!row.fabricWidthCadId || approvingRowId === row.id || !row.totalCostPerMeter}
```

**Handler (Lines 641-656):**
```typescript
const handleApproveRow = async (row: FabricCostingRow) => {
  if (!row.fabricWidthCadId) {
    notify.warning('Save the costing first before approving');
    return;
  }
  // ... API call
};
```

### ROOT CAUSE FOUND:
**After saving, the page does NOT refresh to get the new `fabricWidthCadId`!**

**handleSave() (Line 582-638):**
- Saves to backend successfully
- Backend returns new IDs
- **BUT page state is NOT updated**
- `fabricWidthCadId` remains `null` in UI
- Button stays disabled

### Solution:
**Add data refresh after save:**
```typescript
// After line 632 in handleSave():
notify.success(`Saved costing...`);
// ADD THIS:
if (selectedStyleId) {
  await fetchStyleFabrics(); // Re-fetch to get fabricWidthCadIds
}
```

---

## Issue 6: CAD Planning ↔ Fabric Costing Mode Linking

### User's Raw Thought:
> "Is there any linking between CAD planning modes and the modes that we have here?"

### Current Implementation:

**YES - They ARE linked via `purpose` field!**

**Database:** `fabric_width_cad` table stores both CAD data and costing data
**Field:** `purpose: 'PLANNING' | 'COSTING' | 'PRODUCTION'`

**CAD Planning saves:**
- `cadMeters`, `cutableWidth`, `purpose` to `fabric_width_cad`

**Fabric Costing reads:**
- Same `fabric_width_cad` records
- Preserves `purpose` field (Line 394 in controller)

**Unique Constraint:**
```sql
@@unique([costingStyleId, componentName, cutableWidth, processorId, purpose])
```

### Problem:
- **Link exists but not obvious to users**
- **No visual indication** that CAD mode affects costing mode
- **Can create confusion** when same style has records in different modes

### Questions for Discussion:
1. Should CAD mode automatically set costing mode?
2. Should we show "From CAD: PLANNING" badge in costing page?
3. Should mode selection be disabled if coming from CAD Planning?
4. Should we sync modes bidirectionally?

### Current Behavior:
- CAD Planning creates record with `purpose: 'PLANNING'`
- Fabric Costing shows that record
- User can change mode in costing page (creates new record due to unique constraint)

---

## Summary: All 6 Issues

| # | Issue | Severity | Fix Type |
|---|-------|----------|----------|
| 1 | Greige price fluctuation | MEDIUM | New feature |
| 2 | Repeat style / multiple widths | HIGH | Logic change |
| 3 | Style-specific options view | MEDIUM | New UI |
| 4 | Remove global qty | LOW | Simple removal |
| 5 | Approve button not working | CRITICAL | Bug fix |
| 6 | CAD-Costing mode linking | SKIP | Needs more brainstorming |

---

## User Decisions (Confirmed)

| Issue | Decision | Implementation |
|-------|----------|----------------|
| **1. Greige Price** | This costing only | Manual price saved with costing record, doesn't update greige_master |
| **2. Width Approval** | Primary + Alternates | One width is `isPreferred=true`, others can be `approvalStatus='ALTERNATE_APPROVED'` |
| **2. Repeat Orders** | Skip to PRODUCTION | Repeat styles go directly to PRODUCTION mode, no PLANNING/COSTING workflow |
| **6. CAD-Costing Link** | SKIP FOR NOW | Needs more brainstorming later |

---

## Final Implementation Plan

### Priority Order:
1. **Issue 5** - Fix Approve Button (CRITICAL - bug fix)
2. **Issue 4** - Remove Global Qty (LOW - simple removal)
3. **Issue 2** - Repeat Style + Multiple Widths (HIGH - logic change)
4. **Issue 1** - Greige Price Manual Override (MEDIUM - UI enhancement)
5. **Issue 3** - Style-Specific Options View (MEDIUM - new UI)
6. ~~Issue 6~~ - SKIPPED

---

### Implementation Step 1: Fix Approve Button (Issue 5)

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**Problem:** After saving, `fabricWidthCadId` is not refreshed in UI state.

**Fix:** Add data refresh after save in `handleSave()`:

```typescript
// After line 632:
notify.success(`Saved costing for ${rowsToSave.length} fabric(s) to fabric_width_cad`);
// ADD:
if (selectedStyleId) {
  // Re-fetch to get the newly assigned fabricWidthCadIds
  const response = await fabricCostingService.getStyleFabrics(selectedStyleId);
  // Update fabric rows with new IDs
  // ... merge logic to preserve user edits while updating IDs
}
```

**Lines to modify:** 627-633

---

### Implementation Step 2: Remove Global Qty (Issue 4)

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**Action:** Delete the "Estimated Quantity (pcs)" section from header card

**Lines to remove:** ~815-830 (the entire div containing the global qty input)

**Keep:**
- `orderQuantity` state variable (used as default for new rows)
- Row-level qty inputs in table

---

### Implementation Step 3: Repeat Style + Multiple Widths (Issue 2)

#### 3A: Add Alternate Approval Status

**File:** `backend/src/controllers/fabric-costing.controller.ts`

**Change:** Modify `approveCostingOption()` to NOT unapprove other widths, but mark them as alternates

```typescript
// Current (lines 940-951): Unapproves ALL other options
// NEW: Only unapprove if different COMPONENT, keep alternates for same component

// For same component, different width:
await tx.fabric_width_cad.updateMany({
  where: {
    costingStyleId: option.costingStyleId,
    componentName: option.componentName,
    cutableWidth: { not: option.cutableWidth }, // Different width
    id: { not: optionId },
  },
  data: {
    isPreferred: false,
    approvalStatus: 'ALTERNATE_APPROVED', // NEW status
  },
});
```

#### 3B: Add Repeat Order Detection

**File:** `backend/src/controllers/fabric-costing.controller.ts`

**New logic in `saveFabricCosting()`:**

```typescript
// Check if style has previous PRODUCTION costings
const hasProductionCostings = await prisma.fabric_width_cad.findFirst({
  where: {
    costingStyleId: styleId,
    purpose: 'PRODUCTION',
    isLocked: true,
  },
});

// If repeat order and purpose is PLANNING, auto-upgrade to PRODUCTION
if (hasProductionCostings && costing.purpose === 'PLANNING') {
  costing.purpose = 'PRODUCTION';
  costing.isLocked = true;
}
```

#### 3C: Frontend - Show "Repeat Order" Badge

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**Add:** Badge next to style name showing "Repeat Order" if previous PRODUCTION records exist

---

### Implementation Step 4: Greige Price Manual Override (Issue 1)

**Already Supported!** The field exists, just need to make it clearer in UI.

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**Enhancement:**
- Add "Manual" label when user edits greige price
- Show source indicator: "From: Procurement ₹45/m" or "Manual: ₹50/m"
- Ensure `greigeCostSource: 'MANUAL'` is saved when user overrides

---

### Implementation Step 5: Style-Specific Options View (Issue 3)

#### 5A: Add "Costing Status" Badge in Style Search

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**In style search results, show:**
- ✅ "Costed" - Has approved PRODUCTION costings
- ⏳ "Pending" - Has costings but not all approved
- ⚪ "Not Started" - No costings yet

#### 5B: Add "View Options" Button

**File:** `frontend/src/pages/FabricCostingPage.tsx`

**When style is selected and has costings:**
```tsx
<Button onClick={() => navigate(`/fabric-costing/style/${selectedStyleId}/options`)}>
  View Existing Options
</Button>
```

#### 5C: Create Style-Specific Options Page

**New File:** `frontend/src/pages/StyleCostingOptionsPage.tsx`

**Uses existing backend:** `GET /api/fabric-costing/style/:styleId/options`

**Features:**
- Shows ONLY selected style's costing options
- Grouped by component
- Approve/Promote/Delete actions
- Link back to edit costing

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/FabricCostingPage.tsx` | Fix approve button, remove global qty, add status badges |
| `backend/src/controllers/fabric-costing.controller.ts` | Add ALTERNATE_APPROVED status, repeat order detection |
| `frontend/src/pages/StyleCostingOptionsPage.tsx` | NEW FILE - style-specific options view |
| `frontend/src/App.tsx` | Add new route for style options page |

---

## Previous UI Changes (Completed)

---

## Implementation Plan

### Step 1: Update Table Header - "Width" → "Cutable Width"

**File:** [FabricCostingPage.tsx:840](frontend/src/pages/FabricCostingPage.tsx#L840)

```typescript
// Change from:
<TableHead className="w-[38px] px-1 text-center text-xs">Width</TableHead>

// To:
<TableHead className="w-[55px] px-1 text-center text-xs whitespace-nowrap">Cutable Width</TableHead>
```

---

### Step 2: Add Row-Level Quantity Column

**2.1 Update FabricCostingRow type** (may need to add to local state)
- Add `rowQuantity: number` field to track per-row quantity

**2.2 Add Quantity column to table header** (after CAD column, line ~840)
```typescript
<TableHead className="w-[60px] px-1 text-center text-xs">Qty (pcs)</TableHead>
```

**2.3 Add Quantity input cell** (after CAD cell, line ~901)
```typescript
<TableCell className="px-1 text-center">
  <Input
    type="number"
    min="1"
    className="w-14 text-center text-xs h-7"
    value={row.rowQuantity || orderQuantity}
    onChange={(e) =>
      updateRow(index, {
        rowQuantity: parseInt(e.target.value) || 1,
      })
    }
  />
</TableCell>
```

**2.4 Update calculateRowTotals()** (line ~428)
```typescript
// Change from:
const totalQuantity = row.cadMeters * orderQuantity;

// To:
const totalQuantity = row.cadMeters * (row.rowQuantity || orderQuantity);
```

**2.5 Update handleSave()** (line ~620)
```typescript
// Change from:
orderQuantityPcs: orderQuantity,

// To:
orderQuantityPcs: row.rowQuantity || orderQuantity,
```

---

### Step 3: Add "Approve" Button Column

**3.1 Add Approve column to table header** (at end of headers, line ~849)
```typescript
<TableHead className="w-[70px] px-1 text-center text-xs">Approve</TableHead>
```

**3.2 Add state for tracking approval loading**
```typescript
const [approvingRowId, setApprovingRowId] = useState<string | null>(null);
```

**3.3 Add approve handler function**
```typescript
const handleApproveRow = async (row: FabricCostingRow) => {
  if (!row.fabricWidthCadId) {
    notify.warning('Save the costing first before approving');
    return;
  }

  setApprovingRowId(row.id);
  try {
    await fabricCostingService.approveCostingOption(row.fabricWidthCadId);
    notify.success('Costing option approved');
    // Optionally refresh the row data
  } catch (error: any) {
    notify.error(error.response?.data?.error || 'Failed to approve');
  } finally {
    setApprovingRowId(null);
  }
};
```

**3.4 Add Approve button cell** (at end of row, line ~1165)
```typescript
<TableCell className="px-1 text-center">
  <Button
    variant="outline"
    size="sm"
    className="h-7 text-xs px-2"
    onClick={() => handleApproveRow(row)}
    disabled={!row.fabricWidthCadId || approvingRowId === row.id || !row.totalCostPerMeter}
  >
    {approvingRowId === row.id ? (
      <Loader2 className="w-3 h-3 animate-spin" />
    ) : (
      'Approve'
    )}
  </Button>
</TableCell>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) | Add quantity column, approve button column, rename Width header |

---

## Summary

| Change | Impact |
|--------|--------|
| "Width" → "Cutable Width" | 1 line (header text) |
| Row-level Quantity | ~15 lines (header, cell, state, calculations) |
| Approve Button | ~25 lines (header, cell, handler, state) |

**Total estimated changes:** ~40 lines in FabricCostingPage.tsx

---

## Previous Code Review (Completed)

### 🔴 HIGH PRIORITY

#### 1. Missing Error Handling for Locked Records
**File:** [fabric-costing.controller.ts:971-1002](backend/src/controllers/fabric-costing.controller.ts#L971-L1002)
**Issue:** `deleteCostingOption()` doesn't check `isLocked` before deleting PRODUCTION records.
```typescript
// Current code - no check for locked status
await prisma.fabric_width_cad.delete({
  where: { id: optionId },
});
```
**Fix:** Add check for `isLocked` field before allowing delete.

#### 2. Missing `isLocked` Check in Approve Function
**File:** [fabric-costing.controller.ts:896-965](backend/src/controllers/fabric-costing.controller.ts#L896-L965)
**Issue:** `approveCostingOption()` doesn't check if the record is locked (PRODUCTION).
**Fix:** Add guard to prevent modifying locked records.

#### 3. Potential Null Pointer in Stock Lookup
**File:** [fabric-cost-calculation.service.ts:373-386](backend/src/services/fabric-cost-calculation.service.ts#L373-L386)
**Issue:** Stock lookup uses `fabricId: fabric.greigeId` but greige is stored in `greige_master`, not `fabric_stock`.
```typescript
const greigeStock = await prisma.fabric_stock.findFirst({
  where: {
    fabricId: fabric.greigeId, // Bug: greigeId refers to greige_master, not fabric_master
    ...
  },
});
```
**Fix:** Query greige stock properly or use procurement data for greige cost.

#### 4. Race Condition in Approval Transaction
**File:** [fabric-costing.controller.ts:921-951](backend/src/controllers/fabric-costing.controller.ts#L921-L951)
**Issue:** Transaction updates other options first, then the target. If target update fails, others are already modified.
**Fix:** Wrap both operations in a proper transaction with rollback.

---

### 🟡 MEDIUM PRIORITY

#### 5. Inconsistent Type: `greigeCostSource` Mismatch
**File:** [fabricCosting.types.ts:247](frontend/src/types/fabricCosting.types.ts#L247) vs [FabricCostingPage.tsx:299](frontend/src/pages/FabricCostingPage.tsx#L299)
**Issue:** Type defines `'GREIGE_MASTER' | 'MANUAL'` but page uses `'GREIGE_PROCUREMENT'`.
```typescript
// Type definition
greigeCostSource: 'GREIGE_MASTER' | 'MANUAL';

// Usage in page
greigeCostSource: 'GREIGE_PROCUREMENT' // Type error!
```
**Fix:** Update type to include `'GREIGE_PROCUREMENT'`.

#### 6. Missing Validation: Negative Cost Values
**File:** [fabric-costing.controller.ts:631-685](backend/src/controllers/fabric-costing.controller.ts#L631-L685)
**Issue:** `saveFabricCosting()` doesn't validate that cost values are non-negative.
**Fix:** Add validation to reject negative costs.

#### 7. Potential Division by Zero
**File:** [FabricCostingPage.tsx:471-472](frontend/src/pages/FabricCostingPage.tsx#L471-L472)
**Issue:** Screen cost calculation divides by `totalQuantity` which could be 0.
```typescript
screenCostPerMeter = totalQuantity > 0 ? screenCostTotal / totalQuantity : 0;
```
**Status:** Already handled but `row.cadMeters * orderQuantity` could still be NaN if inputs are invalid.

#### 8. Unused `getDefaultLayerMargin` Function
**File:** [fabric-costing.controller.ts:14-21](backend/src/controllers/fabric-costing.controller.ts#L14-L21)
**Issue:** Function is defined but never called in the file.
**Fix:** Remove dead code or implement where needed.

#### 9. Missing Auth Check on Delete
**File:** [fabric-costing.controller.ts:991](backend/src/controllers/fabric-costing.controller.ts#L991)
**Issue:** Delete response doesn't use `serialize()` like other endpoints.
```typescript
res.json({
  success: true,
  message: 'Costing option deleted successfully',
});
```
**Fix:** Use `serialize()` for consistency.

---

### 🟢 LOW PRIORITY

#### 10. Console.log in Production Code
**File:** [FabricCostingPage.tsx:573](frontend/src/pages/FabricCostingPage.tsx#L573)
**Issue:** Debug console.log left in production code.
```typescript
console.log('Rate lookup debug info:', debugInfo);
```
**Fix:** Remove or wrap in development check.

#### 11. Hardcoded Default Transport Cost
**File:** [FabricCostingPage.tsx:368](frontend/src/pages/FabricCostingPage.tsx#L368)
**Issue:** Transport cost defaults to ₹2/m hardcoded.
```typescript
transportCostPerMeter: 2, // Default ₹2/m transport cost
```
**Fix:** Consider making this configurable.

#### 12. Missing Loading State for Rate Lookup Button
**File:** [FabricCostingPage.tsx:1054](frontend/src/pages/FabricCostingPage.tsx#L1054)
**Issue:** Rate lookup button is disabled when loading but could benefit from better UX.

#### 13. Duplicate API Base URL Logic
**File:** [fabricCosting.service.ts:22-23](frontend/src/services/fabricCosting.service.ts#L22-L23)
**Issue:** API_URL fallback pattern duplicated across services.
**Fix:** Extract to shared config.

---

## Implementation Plan

### Step 1: Fix `fabric-costing.controller.ts` (High Priority)

**1.1 Add `isLocked` check to `deleteCostingOption()`** (line 976-989)
```typescript
// After fetching option, add:
if (option.isLocked) {
  return res.status(400).json({
    success: false,
    error: 'Cannot delete locked PRODUCTION costing option',
  });
}
```

**1.2 Add `isLocked` check to `approveCostingOption()`** (line 902-918)
```typescript
// After fetching option, add:
if (option.isLocked) {
  return res.status(400).json({
    success: false,
    error: 'Cannot modify locked PRODUCTION costing option',
  });
}
```

**1.3 Remove unused `getDefaultLayerMargin` function** (line 14-21)
- Delete the entire function since it's never called

**1.4 Add validation for negative costs in `saveFabricCosting()`** (line 631-640)
```typescript
// Add validation after array check:
for (const costing of fabricCostings) {
  if (costing.totalCostPerMeter < 0 || costing.greigeCostPerMeter < 0) {
    return res.status(400).json({
      success: false,
      error: 'Cost values cannot be negative',
    });
  }
}
```

**1.5 Use `serialize()` in delete response** (line 991-994)
```typescript
res.json(serialize({
  success: true,
  message: 'Costing option deleted successfully',
}));
```

---

### Step 2: Fix `fabric-cost-calculation.service.ts` (High Priority)

**2.1 Fix greige stock lookup** (line 373-386)
The current code queries `fabric_stock` with `fabricId: fabric.greigeId`, but greige is a separate entity.
```typescript
// Change from fabric_stock to greige procurement:
const latestGreigeProcurement = await prisma.fabric_procurement.findFirst({
  where: {
    greigeId: fabric.greigeId,
    procurementType: 'GREIGE',
    status: { in: ['RECEIVED', 'COMPLETED'] },
  },
  orderBy: { purchaseDate: 'desc' },
});

const greigeCostPerMeter = latestGreigeProcurement
  ? Number(latestGreigeProcurement.ratePerUnit)
  : fabric.greige.costPerMeter
    ? Number(fabric.greige.costPerMeter)
    : null;
```

---

### Step 3: Fix `fabricCosting.types.ts` (Medium Priority)

**3.1 Update `greigeCostSource` type** (line 247)
```typescript
// Change from:
greigeCostSource: 'GREIGE_MASTER' | 'MANUAL';

// To:
greigeCostSource: 'GREIGE_MASTER' | 'GREIGE_PROCUREMENT' | 'MANUAL';
```

---

### Step 4: Fix `FabricCostingPage.tsx` (Low Priority)

**4.1 Remove console.log** (line 573)
```typescript
// Remove this line:
console.log('Rate lookup debug info:', debugInfo);
```

---

## Files to Modify

| File | Line Changes |
|------|-------------|
| [fabric-costing.controller.ts](backend/src/controllers/fabric-costing.controller.ts) | ~30 lines (add guards, validation, remove function) |
| [fabric-cost-calculation.service.ts](backend/src/services/fabric-cost-calculation.service.ts) | ~10 lines (fix greige lookup) |
| [fabricCosting.types.ts](frontend/src/types/fabricCosting.types.ts) | 1 line (add type) |
| [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) | 1 line (remove console.log) |

---

## Summary

| Priority | Issues | Impact |
|----------|--------|--------|
| 🔴 High | 4 | Prevents data corruption, fixes incorrect cost calculations |
| 🟡 Medium | 5 | Improves type safety, validation, code cleanliness |
| 🟢 Low | 4 | Code hygiene, minor UX improvements |

**Total estimated changes:** ~42 lines across 4 files
