# CAD Planning Module - Implementation Plan

## Reference Documentation

**Full Architecture Documentation:** [docs/CAD-Planning.md](../../docs/CAD-Planning.md)

This document contains:
- Complete database schema (all CAD-related models)
- All API endpoints with handlers
- Frontend component hierarchy
- Data flow diagrams
- Testing checklist
- Common issues & solutions

---

## Current State Summary

### Backend: ✅ COMPLETE
- All CAD Planning endpoints implemented (~3,120 lines)
- Pattern parts endpoints fully implemented
- Embroidery CAD endpoints fully implemented
- Size breakdown support in all relevant queries

### Frontend: ✅ COMPLETE
- `InlineCADTable.tsx` (372 lines) - Inline CAD editing table
- `InlineCADRow.tsx` (438 lines) - Editable CAD row
- `PatternPartAssignment.tsx` (382 lines) - Pattern part UI
- `EmbroideryCadForm.tsx` (538 lines) - Embroidery CAD form
- All components integrated into CADPlanningPage

### What Remains: Step-by-Step Testing & Fixing
The implementation exists but needs corrections at each step. We will test and fix issues incrementally.

---

## 1. Module Overview

The CAD (Consumption Average Data) Planning module calculates and manages fabric consumption per garment. It bridges style design and production costing.

### Module Purpose
- Calculate fabric consumption per garment (CAD meters)
- Support multi-width options for cost comparison
- Enable component-level vs combined CAD
- Handle embroidery parts separately
- Track print direction (One-Way/Two-Way)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPSTREAM (Data Sources)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Style Module         │  Greige Master        │  Embroidery Master          │
│  • Fabrics            │  • Width              │  • Design ID                │
│  • Components         │  • Cost/meter         │  • Cost/meter               │
│  • Variants/Sizes     │  • Composition        │                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAD PLANNING MODULE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Group fabrics by: genericGreigeName + fabricFinishType + embroidery    │
│  2. Select Greige → Creates fabric_master → Generates CAD width options    │
│  3. Enter CAD values: cadMeters, wastage%, layerMargin, piecesPerMarker    │
│  4. Size breakdown for averaging (S:2, M:4, L:3, XL:1)                     │
│  5. Approve CAD → Links style_fabrics to fabric_width_cad                  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOWNSTREAM (Data Consumers)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Costing              │  Work Orders          │  Cutting                    │
│  Procurement          │  Order Items          │  BOM                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Locations

### Backend
| File | Purpose | Lines |
|------|---------|-------|
| [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) | Main CAD workflow | ~2,070 |
| [fabric-cad.controller.ts](backend/src/controllers/fabric-cad.controller.ts) | Fabric width CAD CRUD | ~460 |
| [style-cad-planning.routes.ts](backend/src/routes/style-cad-planning.routes.ts) | API endpoints | 15 routes |
| [style-cad-planning.types.ts](backend/src/types/style-cad-planning.types.ts) | Type definitions | |

### Frontend
| File | Purpose | Lines |
|------|---------|-------|
| [CADPlanningPage.tsx](frontend/src/pages/CADPlanningPage.tsx) | Main planning workflow | ~1,296 |
| [CADEditPage.tsx](frontend/src/pages/CADEditPage.tsx) | CAD value editing | ~854 |
| [PatternPartAssignment.tsx](frontend/src/components/PatternPartAssignment.tsx) | Pattern parts assignment | NEW |
| [EmbroideryCadForm.tsx](frontend/src/components/EmbroideryCadForm.tsx) | Embroidery CAD form | NEW |
| [InlineCADTable.tsx](frontend/src/components/cad/InlineCADTable.tsx) | Inline CAD table | NEW |
| [InlineCADRow.tsx](frontend/src/components/cad/InlineCADRow.tsx) | Editable CAD row | NEW |

### Database Models
| Model | Purpose |
|-------|---------|
| `fabric_width_cad` | Central CAD repository per fabric width |
| `cad_size_breakdown` | Size-wise piece counts for averaging |
| `styles.cadStatus` | CAD approval status (PENDING/IN_PROGRESS/APPROVED) |
| `style_pattern_parts` | Pattern parts assigned to style fabrics |
| `embroidery_part_cad` | Separate CAD for embroidery parts |

---

## 3. Issues Status (Updated After Exploration)

### Previously Identified Issues - NOW RESOLVED ✅

#### Issue #1: sizeOptions Missing from API
**Status:** ✅ **RESOLVED** - Already implemented
- `style_variants` is queried at line 839
- `sizeOptions` extracted at lines 869-879
- Returned in response at line 1180

#### Issue #2: sizeBreakdowns Missing from CAD Options
**Status:** ✅ **RESOLVED** - Already implemented
- `sizeBreakdowns` included in widthCADs query at lines 983, 1015-1017
- Mapped in CAD options response at lines 1039-1044, 1107-1112

#### Issue #3: PatternPartAssignment API Response Mismatch
**Status:** ✅ **RESOLVED** - Fixed in previous session

#### Issue #4: Potential Empty Fabrics Array
**Status:** ⚠️ **NEEDS VERIFICATION** - Check if guard exists

#### Issue #5: hasEmbroideryParts Local State
**Status:** ⚠️ **LOW PRIORITY** - Works but could be improved

### Current Action: Step-by-Step Testing & Fixing

The implementation exists but needs corrections at each step. We will go through the CAD Planning workflow one step at a time, testing and fixing issues as we find them.

---

## ITERATIVE TESTING & FIX PLAN

### Step 1: Page Load & Fabric Groups Display
**Goal:** CAD Planning page loads and displays fabric groups correctly
- [ ] Navigate to CAD Planning page for a style
- [ ] Verify fabric groups load with correct grouping (genericGreigeName + fabricFinishType)
- [ ] Verify greige options display for each group
- [ ] Fix any errors that occur

### Step 2: Greige Selection
**Goal:** Selecting a greige works and triggers CAD option generation
- [ ] Select a greige from dropdown
- [ ] Verify CAD width options are generated
- [ ] Verify averaging mode selection works (COMBINED/SEPARATE)
- [ ] Fix any errors that occur

### Step 3: InlineCADTable Display
**Goal:** CAD width options display in editable table
- [ ] Verify InlineCADTable renders with correct columns
- [ ] Verify existing CAD options populate correctly
- [ ] Verify sizeOptions are available for size breakdown
- [ ] Fix any errors that occur

### Step 4: Inline CAD Editing
**Goal:** Can edit CAD values inline and they save correctly
- [ ] Edit cadMeters value - verify saves
- [ ] Edit layerMargin value - verify saves
- [ ] Edit piecesPerMarker - verify saves
- [ ] Test auto-calculation logic
- [ ] Fix any errors that occur

### Step 5: Size Breakdown
**Goal:** Size breakdown popover works and saves
- [ ] Open size breakdown popover
- [ ] Verify sizes from sizeOptions display
- [ ] Edit quantities (S:2, M:4, etc.)
- [ ] Verify saves correctly
- [ ] Fix any errors that occur

### Step 6: Add/Delete CAD Width
**Goal:** Can add new widths and delete existing ones
- [ ] Add a new CAD width option
- [ ] Verify it appears in table
- [ ] Delete a CAD width option
- [ ] Verify deletion works
- [ ] Fix any errors that occur

### Step 7: Pattern Part Assignment
**Goal:** PatternPartAssignment component works correctly
- [ ] Verify component renders after greige selection
- [ ] Load pattern parts from component master
- [ ] Toggle embroidery flag on a part
- [ ] Verify hasEmbroideryParts updates
- [ ] Fix any errors that occur

### Step 8: Embroidery CAD Form
**Goal:** EmbroideryCadForm appears and works when embroidery parts exist
- [ ] Verify form shows when parts marked for embroidery
- [ ] Enter embroidery CAD values
- [ ] Verify saves correctly
- [ ] Test size breakdown for embroidery CAD
- [ ] Fix any errors that occur

### Step 9: Set Preferred & Approval
**Goal:** Can mark preferred width and approve CAD plan
- [ ] Mark a CAD width as preferred (star icon)
- [ ] Verify preferred status saves
- [ ] Click Approve button
- [ ] Verify CAD status changes to APPROVED
- [ ] Verify style fabrics get linked to CAD
- [ ] Fix any errors that occur

### Step 10: CAD History
**Goal:** CAD History tab shows historical data
- [ ] Switch to History tab
- [ ] Verify historical CAD data displays
- [ ] Fix any errors that occur

---

**Current Progress:** Starting at Step 1

---

## 4. API Endpoints & Data Contracts

### Primary Endpoints

#### GET /api/styles/:styleId/cad-planning
**Response Structure:**
```typescript
{
  success: true,
  data: {
    style: { id, styleCode, styleName, cadStatus },
    fabricGroups: [
      {
        groupKey: string,
        genericGreigeName: string,
        fabricFinishType: string,
        hasEmbroidery: boolean,
        embroidery: { id, embroideryCode, designName, costPerMeter } | null,
        components: string[],
        selectedGreigeId: string | null,
        averagingMode: 'COMBINED' | 'SEPARATE',
        availableGreiges: [...],
        cadOptions: [...],        // NEEDS sizeBreakdowns
        fabrics: [...],
        sizeOptions: [...]        // NEEDS to be added
      }
    ],
    missingGreigeNames: string[]
  }
}
```

#### GET /api/styles/:styleId/fabrics/:fabricId/pattern-parts
**Response Structure:**
```typescript
{
  success: true,
  data: {
    styleFabricId: string,
    componentId: string,
    componentName: string,
    componentType: string,
    availableFromComponent: [...],
    assignedParts: [
      {
        id: string,
        patternPartId: string,
        partName: string,
        partCode: string,
        quantity: number,
        goesToEmbroidery: boolean,
        notes: string | null
      }
    ],
    hasEmbroideryParts: boolean
  }
}
```

#### GET /api/styles/:styleId/fabrics/:fabricId/embroidery-cad
**Response Structure:**
```typescript
{
  success: true,
  data: {
    styleFabricId: string,
    hasEmbroideryParts: boolean,
    embroideryParts: [...],
    embroideryCad: {
      id, fabricWidthCadId, cadMeters, cadYards,
      cadWastagePercent, layerMarginMeters, piecesPerMarker,
      markerEfficiency, printDirection, isApproved, notes,
      sizeBreakdowns: [...],
      selectedWidth: { id, cutableWidth } | null,
      embroideryDesign: { id, designName, costPerMeter } | null
    } | null
  }
}
```

---

## 5. Simplified Single-Page Workflow Design

### User Feedback
> "The entire form has been made too complicated with unnecessary pages and steps. Once the greige is selected user should be given all the options in a single row, and if another width we want user can select in second row."

### Current Problems
1. Two-Page Flow - CADPlanningPage → CADEditPage navigation is cumbersome
2. Hidden CAD Entry - CAD values are entered on a separate page
3. Pattern Parts Missing - Component exists but not integrated
4. Embroidery CAD Missing - Component exists but not integrated
5. Too Many Clicks - Select greige → Navigate → Add width → Enter CAD → Navigate back

### New Single-Page Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAD Planning Page (Unified)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For each Fabric Group:                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ HEADER: Cambric - DYED                                     [Approved] │  │
│  │ Components: Body, Sleeve, Yoke                                        │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │ Step 1: Select Greige                                                 │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [Dropdown: Select Greige] Greige: 63" | Cutable: 53"-55"       │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 2: Pattern Parts (shows after greige selection)                  │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [PatternPartAssignment Component]                              │   │  │
│  │ │ ☑ Front ☑ Back ☑ Sleeve   ☐ Yoke (goes to embroidery)         │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 3: CAD Width Rows (Inline Table)                                │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ Width│ CAD(m) │ Layer │ Pcs │ Size Breakdown │ Print │ Actions │   │  │
│  │ ├──────┼────────┼───────┼─────┼────────────────┼───────┼─────────┤   │  │
│  │ │ 54"  │ 1.55   │ 15.5m │ 10  │ S:2 M:4 L:3 XL:1│ 2-Way │ ○ ★ 🗑  │   │  │
│  │ │ 53"  │ 1.62   │ 16.2m │ 10  │ S:2 M:4 L:3 XL:1│ 2-Way │ ● ☆ 🗑  │   │  │
│  │ ├──────┴────────┴───────┴─────┴────────────────┴───────┴─────────┤   │  │
│  │ │ [+Add Row: Enter width ___" ]                        [Add]     │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │ Step 4: Embroidery CAD (Only if embroidery parts marked)             │  │
│  │ ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │ │ [EmbroideryCadForm Component]                                  │   │  │
│  │ │ Parts: Yoke    Width: 52"    CAD: 0.45m                       │   │  │
│  │ └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [Approve CAD Plan]                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Plan

### Phase 1: Backend API Fixes (Critical - Blocking)

**File:** `backend/src/controllers/style-cad-planning.controller.ts`

#### Step 1.1: Add style_variants to initial Prisma query (~line 836)

**Change:**
```typescript
const style = await prisma.styles.findUnique({
  where: { id: styleId },
  include: {
    style_variants: true,  // ADD THIS
    style_components: {
      include: {
        style_fabrics: { ... },
      },
    },
  },
});
```

#### Step 1.2: Extract sizeOptions (add after line 863)

```typescript
// Extract size options from style variants
const sizeOptions = style.style_variants
  .filter(v => v.sizeName)
  .map(v => ({
    sizeId: v.sizeId,
    sizeName: v.sizeName!,
    sortOrder: v.sortOrder,
  }))
  .filter((size, index, self) =>
    index === self.findIndex(s => s.sizeName === size.sizeName)
  )
  .sort((a, b) => a.sortOrder - b.sortOrder);
```

#### Step 1.3: Add sizeBreakdowns to widthCADs query (~line 991)

**Change:**
```typescript
widthCADs: {
  orderBy: { cutableWidth: 'desc' },
  include: {
    sizeBreakdowns: {
      orderBy: { sizeName: 'asc' },
    },
  },
},
```

#### Step 1.4: Map sizeBreakdowns in cadOptions (~line 998-1012)

Add to each CAD option mapping:
```typescript
sizeBreakdowns: cad.sizeBreakdowns?.map(sb => ({
  id: sb.id,
  sizeName: sb.sizeName,
  sizeId: sb.sizeId,
  quantity: sb.quantity,
})) || [],
```

#### Step 1.5: Add sizeOptions to fabricGroups response (~line 1136)

Add to `fabricGroups.push({...})`:
```typescript
sizeOptions,  // Add this field
```

### Phase 2: Frontend - Inline CAD Components

#### Step 2.1: Create InlineCADRow.tsx

**File:** `frontend/src/components/cad/InlineCADRow.tsx`

```typescript
interface InlineCADRowProps {
  cad: CADOptionData;
  sizeOptions: SizeOption[];
  isSelected: boolean;
  onUpdate: (cadId: string, data: Partial<CADOptionData>) => Promise<void>;
  onDelete: (cadId: string) => Promise<void>;
  onSelect: (cadId: string) => void;
  onSetPreferred: (cadId: string) => void;
  widthRange: { min: number; max: number };
  isApproved: boolean;
}
```

Features:
- Editable inputs for: cutableWidth, cadMeters, markerLengthMeters, piecesPerMarker
- Inline size breakdown inputs (S:_, M:_, L:_, XL:_)
- Print direction dropdown (One-Way / Two-Way)
- Radio button for selection
- Star icon for preferred
- Delete button
- Debounced auto-save on blur

#### Step 2.2: Create InlineCADTable.tsx

**File:** `frontend/src/components/cad/InlineCADTable.tsx`

```typescript
interface InlineCADTableProps {
  cadOptions: CADOptionData[];
  sizeOptions: SizeOption[];
  selectedCADId: string | null;
  onUpdate: (cadId: string, data: Partial<CADOptionData>) => Promise<void>;
  onAdd: (cutableWidth: number) => Promise<void>;
  onDelete: (cadId: string) => Promise<void>;
  onSelect: (cadId: string) => void;
  onSetPreferred: (cadId: string) => void;
  widthRange: { min: number; max: number };
  isApproved: boolean;
}
```

Features:
- Header row with column labels
- Renders InlineCADRow for each cadOption
- "Add Row" input at bottom
- Width validation against expectedFinishedWidthMin/Max

#### Step 2.3: Update CADPlanningPage.tsx

Refactor FabricGroupCard to include:
1. Keep greige selection as-is
2. Add PatternPartAssignment component below greige selection
3. Replace CAD summary table with InlineCADTable
4. Add EmbroideryCadForm below when embroidery parts exist

### Phase 3: Integration & Testing

#### Step 3.1: Wire up API calls
- Use existing endpoints for CAD CRUD
- Add debounced update calls from InlineCADRow
- Handle optimistic updates with rollback on error

#### Step 3.2: Test full workflow
- [ ] Load CAD Planning page
- [ ] Select greige
- [ ] Verify sizeOptions populate
- [ ] Add CAD width row
- [ ] Enter CAD values inline
- [ ] Verify sizeBreakdowns save
- [ ] Test pattern parts assignment
- [ ] Test embroidery CAD (if applicable)
- [ ] Approve CAD plan

---

## 7. Type Definitions

### Frontend Types (Expected by Components)

#### CADOptionData (InlineCADTable expects)
```typescript
interface CADOptionData {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  layerMarginMeters: number | null;
  markerLengthMeters: number | null;
  markerEfficiency: number | null;
  piecesPerMarker: number | null;
  cadWastagePercent: number;
  printDirection: PrintDirection | null;
  componentName: string | null;
  isPreferred: boolean;
  notes: string | null;
  sizeBreakdowns: SizeBreakdown[];
}
```

#### SizeOption
```typescript
interface SizeOption {
  sizeId: string | null;
  sizeName: string;
  sortOrder: number;
}
```

#### SizeBreakdown
```typescript
interface SizeBreakdown {
  id?: string;
  sizeName: string;
  sizeId?: string | null;
  quantity: number;
}
```

#### PrintDirection enum
```typescript
enum PrintDirection {
  ONE_WAY = 'ONE_WAY',
  TWO_WAY = 'TWO_WAY'
}
```

---

## 8. Files to Modify Summary

| Priority | File | Changes |
|----------|------|---------|
| **P0** | `backend/src/controllers/style-cad-planning.controller.ts` | Add `sizeOptions` and `sizeBreakdowns` to `getEnhancedCADPlanning` |
| **P1** | `frontend/src/components/cad/InlineCADRow.tsx` | **CREATE** - Editable CAD row component |
| **P1** | `frontend/src/components/cad/InlineCADTable.tsx` | **CREATE** - CAD table with inline editing |
| **P2** | `frontend/src/pages/CADPlanningPage.tsx` | Integrate InlineCADTable, PatternPartAssignment, EmbroideryCadForm |
| **P2** | `frontend/src/components/PatternPartAssignment.tsx` | Verify working after API fix |
| **P2** | `frontend/src/components/EmbroideryCadForm.tsx` | Verify working after API fix |
| **P3** | `frontend/src/pages/CADEditPage.tsx` | Keep for advanced editing (optional) |

---

## 9. Success Criteria

1. **Single page** - User never leaves CAD Planning page for basic workflow
2. **Inline editing** - CAD values editable directly in table rows
3. **Size breakdowns work** - Can enter S:2, M:4, L:3, XL:1 inline
4. **Pattern parts visible** - PatternPartAssignment shows after greige selection
5. **Embroidery CAD shown** - EmbroideryCadForm appears when parts marked for embroidery
6. **Fewer clicks** - Add width + enter CAD in same row
7. **Data persists** - All changes saved to database correctly

---

## 10. Implementation Checklist

### Backend (Phase 1)
- [ ] Add `style_variants` to initial Prisma query
- [ ] Extract `sizeOptions` from variants
- [ ] Add `sizeBreakdowns` include to widthCADs query
- [ ] Map `sizeBreakdowns` in cadOptions response
- [ ] Add `sizeOptions` to each fabricGroup
- [ ] Test API response with Postman/curl

### Frontend Components (Phase 2)
- [ ] Create `InlineCADRow.tsx` component
- [ ] Create `InlineCADTable.tsx` component
- [ ] Add debounced save logic
- [ ] Add width validation

### Frontend Integration (Phase 3)
- [ ] Update CADPlanningPage to use InlineCADTable
- [ ] Integrate PatternPartAssignment
- [ ] Integrate EmbroideryCadForm
- [ ] Test full workflow
- [ ] Fix any remaining issues

---

## 11. Notes

- Backend uses snake_case for Prisma relations (e.g., `brand_categories`)
- Serializer converts to camelCase in API responses (e.g., `brandCategories`)
- Frontend MUST use camelCase when accessing nested relations
- Check RELATION_MAPPINGS in serializer.ts for custom mappings
