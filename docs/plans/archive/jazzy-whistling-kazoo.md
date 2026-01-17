# CAD Planning List Page Enhancement Plan

## ✅ COMPLETED: Fix Fabric Costing Page - Missing CAD Data and Width Variants

**Problem (SOLVED):** When clicking "Fabric Costing" from CAD Planning List:
1. ~~Shows only 2 fabric rows instead of 4~~ → Now shows 4 rows (one per width variant) ✓
2. ~~CAD (m/pc) shows `0.000 ⚠`~~ → Now shows correct values (2.788, 2.025, 0.163, 0.121) ✓
3. ~~Width column shows `-`~~ → Now shows actual widths (40", 54", 40", 54") ✓

**Solution Implemented:**
- Updated backend `fabric-costing.controller.ts` to use `cadRows` relation (one-to-many) instead of `fabricCADId` (one-to-one)
- Creates one row per CAD width variant using `cadRow.cadAverage` directly
- Updated frontend types to include `styleFabricId` and `purpose` fields

---

## Root Cause Analysis

### Data Flow Comparison

| Component | Data Source | Result |
|-----------|-------------|--------|
| CAD Planning List | `cadRows` relation (one-to-many) | 4 width variants with correct cadAverage ✓ |
| Fabric Costing Page | `fabricCADId` (one-to-one, often NULL) | 2 rows with CAD=0, Width=- ✗ |

### Backend Returns (fabric-costing.controller.ts):
```typescript
{
  "cadMeters": 0,        // From fabricCAD (NULL) → falls back to 0
  "width": 0,            // From fabricCAD (NULL) → falls back to 0
  "widthOptions": [      // Contains ALL the real data!
    { "cutableWidth": 40, "cadAverage": 2.7875, "purpose": "PLANNING" },
    { "cutableWidth": 54, "cadAverage": 2.0250, "purpose": "PLANNING" },
    { "cutableWidth": 40, "cadAverage": 0.1625, "purpose": "PLANNING" },
    { "cutableWidth": 54, "cadAverage": 0.1213, "purpose": "PLANNING" }
  ]
}
```

### Frontend Issue (FabricCostingPage.tsx):
- Uses `fabric.cadMeters` (=0) and `fabric.width` (=0) for display
- `widthOptions` array contains correct data but isn't used properly

---

## Fix Plan

### Step 1: Update Backend to Use cadRows Data

**File:** [fabric-costing.controller.ts](backend/src/controllers/fabric-costing.controller.ts)

**Change:** When `fabricCADId` is NULL, use data from `widthCADs` (cadRows) instead:

```typescript
// Lines ~316-348: Get cadMeters and width
// Current: Falls back to deprecated field or 0
// Fix: If fabricCAD is null, use first widthCAD with matching purpose

const activePurpose = purpose || 'PLANNING';
const relevantWidthCAD = styleFabric.widthCADs?.find(
  (wc) => wc.purpose === activePurpose && wc.cadAverage
) || styleFabric.widthCADs?.[0];

const cadMeters = styleFabric.fabricCAD?.cadAverage
  ? Number(styleFabric.fabricCAD.cadAverage)
  : (relevantWidthCAD?.cadAverage ? Number(relevantWidthCAD.cadAverage) : null);

const width = styleFabric.fabricCAD?.cutableWidth
  ? Number(styleFabric.fabricCAD.cutableWidth)
  : (relevantWidthCAD?.cutableWidth ? Number(relevantWidthCAD.cutableWidth) : null);
```

### Step 2: Create Rows Per Width Variant (Better Approach)

**File:** [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx)

**Change:** Instead of one row per fabric, create one row per width variant when multiple widths exist:

```typescript
// When mapping fabrics to rows (lines ~257-401):
// If widthOptions has data and main cadMeters is 0, expand to multiple rows

const expandedRows: FabricCostingRow[] = [];

response.fabrics.forEach((fabric) => {
  if (fabric.widthOptions && fabric.widthOptions.length > 0 && fabric.cadMeters === 0) {
    // Create one row per width option
    fabric.widthOptions.forEach((wo) => {
      expandedRows.push({
        ...baseFabricData,
        cadMeters: wo.cadAverage || 0,  // Use cadAverage (per-piece consumption)
        width: wo.cutableWidth || 0,
        cadWidthId: wo.id,
        purpose: wo.purpose,
      });
    });
  } else {
    // Use main fabric data (single row)
    expandedRows.push({
      ...fabric,
      cadMeters: fabric.cadMeters || 0,
      width: fabric.width || 0,
    });
  }
});
```

### Step 3: Update Display to Show cadAverage (not cadMeters)

**Issue:** Column header says "CAD (m/pc)" but code uses `cadMeters` which is layer length, not per-piece consumption.

**Fix:** Use `cadAverage` field (per-piece consumption) instead of `cadMeters` (layer length).

---

## Files to Modify

| File | Changes |
|------|---------|
| [fabric-costing.controller.ts](backend/src/controllers/fabric-costing.controller.ts) | Use `cadAverage` from widthCADs when fabricCAD is null |
| [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) | Expand rows per width variant, use cadAverage |

---

## Testing Checklist

- [ ] Fabric Costing shows 4 rows (one per width variant) when navigating from CAD Planning
- [ ] CAD (m/pc) column shows correct values (2.7875, 2.0250, 0.1625, 0.1213)
- [ ] Width column shows correct values (40", 54", 40", 54")
- [ ] Purpose is displayed for each row
- [ ] Existing costing functionality still works

---

## Previous Completed Tasks

### ✅ Fix cadAverage Not Stored (Completed)
- Updated `updateCADTableRow` to persist `cadAverage` to database
- Ran backfill script for existing records

### ✅ Part Uniqueness Validation (Completed)
- Updated `getUsedPartIds` and `isAllPartsUsed` to check width
- Added save-time duplicate validation in `handleSaveRow`

---

## Previous Task: Fix Add CAD for Approved Styles (Completed)

User reported two issues when adding new CAD rows to approved styles:

1. **Cannot select same Part for same Component at different widths** - The system prevents adding a CAD row with the same Part + Component combination even when the width is different
2. **Missing UX message** - The "Adding width variant to approved style" info banner is not showing

---

## Root Cause Analysis

### Issue 1: Part Selection Too Restrictive

**Location:** [CADSpreadsheetTable.tsx:445-489](frontend/src/components/cad/CADSpreadsheetTable.tsx#L445)

```typescript
// Current logic - tracks ALL used parts regardless of width
const getUsedPartIds = (styleFabricId: string, currentRowId: string): Set<string> => {
  const usedParts = new Set<string>();
  rows.forEach((row) => {
    if (row.styleFabricId === styleFabricId && row.id !== currentRowId) {
      if (row.partId && row.partCode !== ALL_PARTS_CODE) {
        usedParts.add(row.partId);  // ❌ Marks part as used regardless of width
      }
    }
  });
  return usedParts;
};
```

**Problem:** The validation marks a Part as "used" if it exists in ANY row for the same styleFabricId, regardless of cutableWidth. This prevents users from creating multiple CAD entries for the same part at different widths.

**Business Requirement:**
- Same Part + Same Width + Same StyleFabric = NOT ALLOWED (true duplicate)
- Same Part + **Different** Width + Same StyleFabric = **ALLOWED** (width variant)

### Issue 2: Missing Info Banner

**Location:** [CADPlanningPage.tsx:370](frontend/src/pages/CADPlanningPage.tsx#L370)

```typescript
const isApproved = style.cadStatus === 'APPROVED';
// ...
<CADSpreadsheetTable
  isStyleApproved={isApproved}  // ✓ Passed correctly
/>
```

The prop IS being passed, but the banner in [CADSpreadsheetTable.tsx:1649](frontend/src/components/cad/CADSpreadsheetTable.tsx#L1649) may not be rendering due to conditional rendering issues.

---

## Fix Plan

### Step 1: Update Part Uniqueness Validation

**File:** [CADSpreadsheetTable.tsx](frontend/src/components/cad/CADSpreadsheetTable.tsx)

**Current behavior:** Parts used in ANY other row (same styleFabricId) are marked as "Used" and disabled.

**New behavior:** Parts are only marked as "Used" if they're used in another row **at the same cutableWidth**.

**Update `getUsedPartIds` function (line ~445):**

```typescript
// Track used parts considering width - same part CAN be used at different widths
const getUsedPartIds = (
  styleFabricId: string,
  currentRowId: string,
  currentWidth: number | null  // NEW: Width of the row being edited
): Set<string> => {
  const usedParts = new Set<string>();
  rows.forEach((row) => {
    if (row.styleFabricId === styleFabricId && row.id !== currentRowId) {
      // Only mark as used if SAME width (width variants are allowed)
      const sameWidth = currentWidth !== null && row.cutableWidth === currentWidth;
      if (row.partId && row.partCode !== ALL_PARTS_CODE && sameWidth) {
        usedParts.add(row.partId);
      }
    }
  });
  return usedParts;
};
```

**Update `getAvailablePatternParts` function (line ~469):**

```typescript
const getAvailablePatternParts = (
  componentId: string,
  styleFabricId: string,
  currentRowId: string,
  currentPartId: string | null,
  currentPartCode: string | null,
  currentWidth: number | null  // NEW: Pass current row's width
) => {
  const allParts = getPatternParts(componentId);
  const usedPartIds = getUsedPartIds(styleFabricId, currentRowId, currentWidth);
  // ... rest of logic unchanged
};
```

**Update call site in render (line ~1046):**

```typescript
const { parts: availableParts } = getAvailablePatternParts(
  row.componentId,
  row.styleFabricId,
  row.id,
  currentPartId,
  currentPartCode,
  row.cutableWidth || null  // NEW: Pass current row's width
);
```

**Result:** User can select "Front Panel" for row at 58" even if "Front Panel" exists at 44".

### Step 2: Debug and Fix Info Banner Visibility

**File:** [CADSpreadsheetTable.tsx:1649](frontend/src/components/cad/CADSpreadsheetTable.tsx#L1649)

The banner code exists but may not be rendering. Possible causes:
1. `isStyleApproved` prop not being passed correctly from parent
2. Dialog open state resetting the prop value

**Verification steps:**

1. **Check prop is passed from CADPlanningPage (line 496):**
```tsx
<CADSpreadsheetTable
  isStyleApproved={isApproved}  // isApproved = style.cadStatus === 'APPROVED'
/>
```

2. **Add console.log for debugging:**
```typescript
// At start of component
useEffect(() => {
  console.log('CADSpreadsheetTable - isStyleApproved:', isStyleApproved);
}, [isStyleApproved]);

// In Dialog render
{console.log('Add Row Dialog rendering, isStyleApproved:', isStyleApproved)}
{isStyleApproved && (
  <div className="mb-4 p-3 bg-blue-50 ...">
    ...
  </div>
)}
```

3. **Verify banner is not hidden by overflow:**
The Dialog uses `overflow-hidden` - ensure banner is inside scrollable area.

**Expected behavior:** When opening Add Row dialog for an APPROVED style, the blue info banner should appear at the top of the dialog.

### Step 3: No Backend Changes Needed

**File:** [style-cad-planning.controller.ts:1517-1532](backend/src/controllers/style-cad-planning.controller.ts#L1517)

Current backend validation CORRECTLY checks width:
```typescript
const existing = await prisma.fabric_width_cad.findFirst({
  where: {
    fabricId: targetFabricId,
    cutableWidth: cutableWidth,     // ✓ Checks width - allows same part at different widths
    componentName: componentName || null,
  },
});
```

The issue is purely frontend - backend already allows same part at different widths.

---

## Files to Modify

| File | Changes |
|------|---------|
| [CADSpreadsheetTable.tsx](frontend/src/components/cad/CADSpreadsheetTable.tsx) | Update `getUsedPartIds()` to check width, verify banner visibility |

---

## Testing Checklist

- [ ] Can add CAD row with same Part + Component at different width for approved style
- [ ] Blue info banner appears when opening Add Row dialog for approved style
- [ ] Existing rows remain locked (cannot edit/delete approved rows)
- [ ] New rows are created with PENDING status
- [ ] Part dropdown shows all parts as available when selecting different width

---

## Previous Completed Tasks

### ✅ Add `cadAverage` as Stored Field (Completed)

---

## Background: Current Data Architecture

**fabric_width_cad table currently stores:**
| Field | Value | Description |
|-------|-------|-------------|
| `cadMeters` | 21.60 | Layer/marker length in meters |
| `piecesPerMarker` | 8 | Pieces that fit in one marker |
| `layerMarginMeters` | 0.12 | Cutting margin between layers |

**CAD Average is currently CALCULATED (not stored):**
- Formula: `(cadMeters + layerMarginMeters) / piecesPerMarker`
- Example: (21.60 + 0.12) / 8 = **2.715 ≈ 2.74**

---

## Plan: Add `cadAverage` as Stored Field

### Step 1: Add Field to Prisma Schema

**File:** [schema.prisma](backend/prisma/schema.prisma) - fabric_width_cad model (~line 3638)

```prisma
// CAD Consumption (per single garment piece)
cadMeters         Decimal? @db.Decimal(10, 4)  // Layer/marker length
cadYards          Decimal? @db.Decimal(10, 4)
cadAverage        Decimal? @db.Decimal(10, 4)  // NEW: Per-piece consumption (stored)
cadWastagePercent Decimal  @default(5) @db.Decimal(5, 2)
```

### Step 2: Run Migration

```bash
cd backend
npx prisma migrate dev --name add_cad_average_field
```

### Step 3: Update CAD Save Logic

**File:** [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts)

When CAD is saved/updated, calculate and store `cadAverage`:

```typescript
// When saving/updating CAD row
const layerLength = cadMeters || 0;
const margin = layerMarginMeters || 0;
const pieces = piecesPerMarker || 1;
const cadAverage = pieces > 0 ? (layerLength + margin) / pieces : null;

await prisma.fabric_width_cad.update({
  where: { id: cadId },
  data: {
    cadMeters,
    layerMarginMeters,
    piecesPerMarker,
    cadAverage,  // Store calculated value
  },
});
```

### Step 4: Update CADPlanningList to Fetch cadAverage

**File:** [cad-planning.controller.ts](backend/src/controllers/cad-planning.controller.ts)

```typescript
cadRows: {
  select: {
    id: true,
    cutableWidth: true,
    cadMeters: true,      // Layer length
    cadAverage: true,     // NEW: Per-piece consumption (stored)
    purpose: true,
    greige: { select: { greigeName: true, greigeCode: true } },
  },
}
```

### Step 5: Update Frontend Types

**File:** [cad-planning.service.ts](frontend/src/services/cad-planning.service.ts)

```typescript
export interface CADWidthDetail {
  id: string;
  cutableWidth: number;
  layerLength: number;   // cadMeters - marker length
  cadAverage: number;    // NEW: Per-piece consumption
  purpose: 'PRODUCTION' | 'PLANNING' | 'COSTING' | null;
  greigeName: string | null;
  greigeCode: string | null;
}
```

### Step 6: Update CADPlanningList UI

**File:** [CADPlanningList.tsx](frontend/src/pages/CADPlanningList.tsx)

Add CAD Avg column:

```tsx
<TableHead>Layer Length (m)</TableHead>
<TableHead>CAD Avg (m)</TableHead>  {/* NEW */}
<TableHead>Purpose</TableHead>

// Cell
<TableCell>{cad.layerLength?.toFixed(3) || '-'}</TableCell>
<TableCell>{cad.cadAverage?.toFixed(4) || '-'}</TableCell>  {/* NEW */}
```

### Step 7: Backfill Existing Data (Optional)

Create a script to calculate and populate `cadAverage` for existing records:

```typescript
const records = await prisma.fabric_width_cad.findMany({
  where: { cadMeters: { not: null } },
});

for (const rec of records) {
  const layerLength = Number(rec.cadMeters) || 0;
  const margin = Number(rec.layerMarginMeters) || 0;
  const pieces = rec.piecesPerMarker || 1;
  const cadAverage = pieces > 0 ? (layerLength + margin) / pieces : null;

  await prisma.fabric_width_cad.update({
    where: { id: rec.id },
    data: { cadAverage },
  });
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| [schema.prisma](backend/prisma/schema.prisma) | Add `cadAverage` field to fabric_width_cad |
| [style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) | Calculate & store cadAverage on save |
| [cad-planning.controller.ts](backend/src/controllers/cad-planning.controller.ts) | Fetch cadAverage for list |
| [cad-planning.service.ts](frontend/src/services/cad-planning.service.ts) | Add cadAverage to type |
| [CADPlanningList.tsx](frontend/src/pages/CADPlanningList.tsx) | Display cadAverage column |

---

## Original Summary of Changes (Completed)

| # | Change | Description |
|---|--------|-------------|
| 1 | **Display CAD Width Details** | Expandable rows showing multiple CAD widths, greige name, CAD avg, and purpose |
| 2 | **Remove In Progress Tab** | Merge IN_PROGRESS styles into Pending tab (two tabs: Pending, Approved) |
| 3 | **Global Search** | Search across both tabs, show unified list with status badges |
| 4 | **Go to Fabric Costing** | Add button to navigate to Fabric Costing with style pre-populated |

---

## Files to Modify

| File | Changes |
|------|---------|
| [cad-planning.controller.ts](backend/src/controllers/cad-planning.controller.ts) | Enhance query to include CAD details, add unified search endpoint |
| [cad-planning.service.ts](frontend/src/services/cad-planning.service.ts) | Add new types for CAD details, update service methods |
| [CADPlanningList.tsx](frontend/src/pages/CADPlanningList.tsx) | Expandable rows, remove In Progress tab, unified search, add Fabric Costing button |
| [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx) | Handle `styleId` query param to pre-populate style |

---

## Phase 1: Backend Changes

### 1.1 Enhance `getStylesForCADPlanning` in [cad-planning.controller.ts:121](backend/src/controllers/cad-planning.controller.ts#L121)

**Current Query:** Returns basic style info without CAD details
**New Query:** Include `fabric_width_cad` data with greige info

```typescript
// Add to the select clause for style_fabrics:
style_fabrics: {
  select: {
    id: true,
    fabric_width_cad: {
      where: {
        purpose: { in: ['PRODUCTION', 'PLANNING', 'COSTING'] },
        cadMeters: { not: null }
      },
      select: {
        id: true,
        cutableWidth: true,
        cadMeters: true,
        purpose: true,
        greigeId: true,
        greige: {
          select: {
            greigeName: true,
            greigeCode: true,
          }
        }
      },
      orderBy: { cutableWidth: 'asc' }
    }
  }
}
```

### 1.2 Update Status Filter Logic

**Merge IN_PROGRESS into PENDING:**
```typescript
// When status === 'PENDING', include both PENDING and IN_PROGRESS
where: {
  isActive: true,
  cadStatus: status === 'PENDING'
    ? { in: ['PENDING', 'IN_PROGRESS'] }
    : status,
}
```

### 1.3 Add Unified Search Support

**New query parameter:** `searchAll=true`
When search is active, ignore status filter and return all matching styles:

```typescript
if (search && searchAll === 'true') {
  // Remove cadStatus filter, add status to response
  where = {
    isActive: true,
    OR: [
      { styleCode: { contains: search, mode: 'insensitive' } },
      { styleName: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { brand_categories: { brandName: { contains: search, mode: 'insensitive' } } },
    ],
  };
}
```

### 1.4 Transform Response

Add `cadDetails` array to each style:
```typescript
interface CADWidthDetail {
  id: string;
  cutableWidth: number;
  cadMeters: number;
  purpose: 'PRODUCTION' | 'PLANNING' | 'COSTING';
  greigeName: string | null;
  greigeCode: string | null;
}

// Transform: Extract unique CAD entries from all style_fabrics
const cadDetails: CADWidthDetail[] = [];
style.style_fabrics?.forEach(sf => {
  sf.fabric_width_cad?.forEach(cad => {
    cadDetails.push({
      id: cad.id,
      cutableWidth: Number(cad.cutableWidth),
      cadMeters: cad.cadMeters ? Number(cad.cadMeters) : 0,
      purpose: cad.purpose as any,
      greigeName: cad.greige?.greigeName || null,
      greigeCode: cad.greige?.greigeCode || null,
    });
  });
});
```

---

## Phase 2: Frontend Service Changes

### 2.1 Update Types in [cad-planning.service.ts](frontend/src/services/cad-planning.service.ts)

```typescript
export interface CADWidthDetail {
  id: string;
  cutableWidth: number;
  cadMeters: number;
  purpose: 'PRODUCTION' | 'PLANNING' | 'COSTING';
  greigeName: string | null;
  greigeCode: string | null;
}

export interface CADPlanningStyle {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  buyerName: string | null;
  brandName: string | null;
  categoryName: string | null;
  componentCount: number;
  fabricSummary: string;
  cadDetails: CADWidthDetail[]; // NEW
}
```

### 2.2 Update Service Method

```typescript
async getStylesForCADPlanning(params: {
  status?: 'PENDING' | 'APPROVED'; // Remove IN_PROGRESS
  page?: number;
  limit?: number;
  search?: string;
  searchAll?: boolean; // NEW: Search across all statuses
}): Promise<CADPlanningListResponse>
```

---

## Phase 3: Frontend UI Changes

### 3.1 Update [CADPlanningList.tsx](frontend/src/pages/CADPlanningList.tsx)

#### 3.1.1 Remove In Progress Tab

```typescript
// Change state type
const [statusTab, setStatusTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

// Update TabsList to only show 2 tabs
<TabsList>
  <TabsTrigger value="PENDING">
    <Clock className="h-4 w-4 mr-2" />
    Pending
    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
      {statusCounts.PENDING + statusCounts.IN_PROGRESS}
    </span>
  </TabsTrigger>
  <TabsTrigger value="APPROVED">
    <CheckCircle2 className="h-4 w-4 mr-2" />
    Approved
    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      {statusCounts.APPROVED}
    </span>
  </TabsTrigger>
</TabsList>
```

#### 3.1.2 Add Expandable Rows

Add state for expanded rows:
```typescript
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

const toggleRowExpand = (styleId: string) => {
  setExpandedRows(prev => {
    const next = new Set(prev);
    if (next.has(styleId)) next.delete(styleId);
    else next.add(styleId);
    return next;
  });
};
```

Update table rendering to include expand/collapse:
```tsx
// In table row, add expand button
<Button
  variant="ghost"
  size="sm"
  onClick={() => toggleRowExpand(style.id)}
>
  {expandedRows.has(style.id) ? <ChevronUp /> : <ChevronDown />}
</Button>

// After main row, render expanded details
{expandedRows.has(style.id) && style.cadDetails?.length > 0 && (
  <tr className="bg-gray-50">
    <td colSpan={7} className="px-4 py-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs">
            <th>Width</th>
            <th>Greige</th>
            <th>CAD Avg (m)</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {style.cadDetails.map((cad) => (
            <tr key={cad.id}>
              <td><Badge>{cad.cutableWidth}"</Badge></td>
              <td>{cad.greigeName || '-'}</td>
              <td>{cad.cadMeters?.toFixed(3) || '-'}</td>
              <td><Badge variant="outline">{cad.purpose}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </td>
  </tr>
)}
```

#### 3.1.3 Unified Search

When search query is entered, enable unified search:
```typescript
const loadStyles = useCallback(async () => {
  const response = await cadPlanningService.getStylesForCADPlanning({
    status: searchQuery ? undefined : statusTab, // No status filter when searching
    page: currentPage,
    limit: pageSize,
    search: searchQuery || undefined,
    searchAll: !!searchQuery, // Enable unified search when searching
  });
  // ...
}, [statusTab, currentPage, pageSize, searchQuery]);
```

When searching, show unified results with status indicator:
```tsx
// In search results, show status badge
{searchQuery && (
  <Badge
    variant={style.cadStatus === 'APPROVED' ? 'default' : 'secondary'}
    className={style.cadStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
  >
    {style.cadStatus === 'APPROVED' ? 'Approved' : 'Pending'}
  </Badge>
)}
```

#### 3.1.4 Add Actions Column with Fabric Costing Button

```tsx
{
  key: 'actions',
  header: 'Actions',
  render: (style) => (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/cad-planning/${style.id}`);
        }}
      >
        Open CAD
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/fabric-costing?styleId=${style.id}`);
        }}
      >
        Fabric Costing
      </Button>
    </div>
  ),
  className: 'w-48',
}
```

---

## Phase 4: Fabric Costing Integration

### 4.1 Update [FabricCostingPage.tsx](frontend/src/pages/FabricCostingPage.tsx)

Add URL parameter handling:
```typescript
import { useSearchParams } from 'react-router-dom';

export default function FabricCostingPage() {
  const [searchParams] = useSearchParams();
  const preselectedStyleId = searchParams.get('styleId');

  // On mount, auto-load style if styleId is provided
  useEffect(() => {
    if (preselectedStyleId) {
      // Fetch style details
      const loadPreselectedStyle = async () => {
        try {
          const response = await styleService.getStyleById(preselectedStyleId);
          if (response) {
            setSelectedStyleId(preselectedStyleId);
            setStyleSearchQuery(`${response.styleCode} - ${response.styleName || ''}`);
            // Set customer if available
            if (response.customerName) {
              const customer = customers.find(c => c.name === response.customerName);
              if (customer) setSelectedCustomerId(customer.id);
            }
          }
        } catch (error) {
          notify.error('Failed to load preselected style');
        }
      };
      loadPreselectedStyle();
    }
  }, [preselectedStyleId, customers]);

  // ... rest of component
}
```

---

## Implementation Order

1. **Backend:** Enhance `getStylesForCADPlanning` with CAD details and unified search
2. **Frontend Service:** Update types and service methods
3. **Frontend UI:**
   - Remove In Progress tab
   - Add expandable rows with CAD details
   - Implement unified search
   - Add Fabric Costing button
4. **Fabric Costing:** Handle `styleId` query param

---

## Testing Checklist

- [ ] Pending tab shows both PENDING and IN_PROGRESS styles
- [ ] Approved tab shows only APPROVED styles
- [ ] Expandable rows show CAD details (width, greige, CAD avg, purpose)
- [ ] Search returns results from both tabs with status indicator
- [ ] "Go to Fabric Costing" button opens Fabric Costing page with style pre-selected
- [ ] Pagination works correctly in both tabs and search mode
