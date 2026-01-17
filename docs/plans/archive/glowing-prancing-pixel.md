# Fabric Costing - Multiple Options & Approval Workflow

## Requirements

1. **Multiple costing options per fabric** - Different processors and/or widths should be saved as separate options
2. **View all options** - User should see all saved costing options for comparison
3. **Approve/select best option** - Mark one option as approved to move to costing stage
4. **No hard limit** - Realistically up to 5 options per fabric

---

## Current State (Problem)

**Unique constraint:** `@@unique([costingStyleId, componentName, cutableWidth])`

This means:
- Same width + same component = **overwrites** (only 1 record)
- Different processors for same width → **NOT possible** (overwritten)

---

## Solution: Add `processorId` to Unique Constraint

Change unique key to: `(costingStyleId, componentName, cutableWidth, processorId)`

This allows:
- Same fabric + Same width + **Processor A** = Option 1
- Same fabric + Same width + **Processor B** = Option 2
- Same fabric + **Different width** + Processor A = Option 3

### Why this approach?
- Minimal schema change (just add one field to constraint)
- Uses existing `processorId` field (already in table)
- `processorId` can be NULL for LANDED_PRICE mode (direct purchase without processor)
- Existing approval fields (`approvalStatus`, `isPreferred`) already exist

---

## Implementation Plan

### Step 1: Schema Migration

**File:** `backend/prisma/schema.prisma` (line 3788)

```prisma
// BEFORE
@@unique([costingStyleId, componentName, cutableWidth])

// AFTER
@@unique([costingStyleId, componentName, cutableWidth, processorId])
```

**Migration command:**
```bash
# Drop old constraint, add new one
node -r dotenv/config -e "..." (manual SQL)
npx prisma generate
```

---

### Step 2: Update Backend Save Logic

**File:** `backend/src/controllers/fabric-costing.controller.ts`

Change upsert to use new unique key:

```typescript
return prisma.fabric_width_cad.upsert({
  where: {
    costingStyleId_componentName_cutableWidth_processorId: {
      costingStyleId: styleId,
      componentName,
      cutableWidth,
      processorId: costing.processorId || null,
    },
  },
  update: costingData,
  create: {
    fabricId: fabricId || null,
    cutableWidth,
    componentName,
    ...costingData,
  },
});
```

---

### Step 3: Add Approval Endpoints

**File:** `backend/src/controllers/fabric-costing.controller.ts`

Add new endpoints:

#### 3a. Get All Costing Options (with filtering)
```typescript
// GET /api/fabric-costing/options
// Query params: customerId, styleId, processorId, status, page, limit
export async function getCostingOptions(req, res) {
  const { customerId, styleId, processorId, status, page = 1, limit = 10 } = req.query;

  // Build filter
  const where: any = {
    costingStyleId: { not: null }, // Only records with costing data
    totalCostPerMeter: { not: null }, // Only calculated costings
  };

  if (styleId) where.costingStyleId = styleId;
  if (processorId) where.processorId = processorId;
  if (status === 'APPROVED') where.approvalStatus = 'APPROVED';
  if (status === 'PENDING') where.approvalStatus = { not: 'APPROVED' };

  // If customerId filter, we need to join through styles
  const styleFilter = customerId ? { customerId } : {};

  const options = await prisma.fabric_width_cad.findMany({
    where: {
      ...where,
      costingStyle: styleFilter,
    },
    include: {
      processor: { select: { id: true, name: true, code: true } },
      greige: { select: { id: true, greigeName: true, greigeCode: true } },
      costingStyle: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { costingStyleId: 'asc' },
      { componentName: 'asc' },
      { totalCostPerMeter: 'asc' },
    ],
  });

  // Group by style, then by component
  const groupedByStyle = groupByStyleAndComponent(options);

  // Paginate styles
  const styleIds = Object.keys(groupedByStyle);
  const paginatedStyles = styleIds.slice((page - 1) * limit, page * limit);
  const paginatedData = paginatedStyles.reduce((acc, styleId) => {
    acc[styleId] = groupedByStyle[styleId];
    return acc;
  }, {});

  res.json(serialize({
    success: true,
    data: paginatedData,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalStyles: styleIds.length,
      totalPages: Math.ceil(styleIds.length / limit),
    },
  }));
}
```

#### 3b. Approve Costing Option
```typescript
// POST /api/fabric-costing/option/:optionId/approve
export async function approveCostingOption(req, res) {
  const { optionId } = req.params;
  const { userId } = req.body; // From auth middleware

  // Get the option to find its component/style
  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  // Unset isPreferred for other options of same component
  await prisma.fabric_width_cad.updateMany({
    where: {
      costingStyleId: option.costingStyleId,
      componentName: option.componentName,
      id: { not: optionId },
    },
    data: { isPreferred: false, approvalStatus: null },
  });

  // Set this option as approved
  const updated = await prisma.fabric_width_cad.update({
    where: { id: optionId },
    data: {
      isPreferred: true,
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });

  res.json(serialize({ success: true, data: updated }));
}
```

#### 3c. Delete Costing Option
```typescript
// DELETE /api/fabric-costing/option/:optionId
export async function deleteCostingOption(req, res) {
  const { optionId } = req.params;

  await prisma.fabric_width_cad.delete({
    where: { id: optionId },
  });

  res.json({ success: true });
}
```

---

### Step 4: Add Routes

**File:** `backend/src/routes/fabric-costing.routes.ts`

```typescript
router.get('/style/:styleId/options', fabricCostingController.getCostingOptions);
router.post('/option/:optionId/approve', fabricCostingController.approveCostingOption);
router.delete('/option/:optionId', fabricCostingController.deleteCostingOption);
```

---

### Step 5: Frontend - Saved Costing Options List Page (DEDICATED PAGE)

**New File:** `frontend/src/pages/FabricCostingOptionsPage.tsx`

**Route:** `/fabric-costing/options` (accessible from sidebar)

**Purpose:** View ALL saved fabric costings across styles with filtering, comparison, and approval

#### UI Layout:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Fabric Costing Options                                          [+ New Costing] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filters:                                                                    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Customer ▼  │ │ Style ▼     │ │ Processor ▼ │ │ Status ▼    │ [Clear]   │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│ Style: KF-2024-001 - Printed Kurti (Customer: ABC Textiles)                │
│ ═══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│ Component: BLOUSE                                                           │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ # │ Greige        │ Width │ Processor      │ Greige │ Trp │ Process │ Total  │ Status     │ Actions          │
│ │ 1 │ Mul Mul 60×60 │  44"  │ Manish Textile │ ₹45    │ ₹2  │ ₹20     │ ₹67    │ ✅ APPROVED │                  │
│ │ 2 │ Mul Mul 60×60 │  44"  │ Shree Dye      │ ₹45    │ ₹3  │ ₹18     │ ₹66 ⭐ │ PENDING    │ [Approve][Delete]│
│ │ 3 │ Mul Mul 60×60 │  52"  │ Manish Textile │ ₹48    │ ₹2  │ ₹22     │ ₹72    │ PENDING    │ [Approve][Delete]│
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ Component: PALLAZO                                                          │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ # │ Greige        │ Width │ Processor      │ Greige │ Trp │ Process │ Total  │ Status     │ Actions          │
│ │ 1 │ Cotton Sheeting│ 58"  │ Manish Textile │ ₹42    │ ₹2  │ ₹18     │ ₹62    │ PENDING    │ [Approve][Delete]│
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                      [Proceed to Cost Sheet →]              │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│ Style: KF-2024-002 - Embroidered Suit (Customer: XYZ Garments)             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│ ... (more styles)                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Features:

**Filtering:**
- Filter by Customer (dropdown)
- Filter by Style (dropdown, filtered by customer)
- Filter by Processor (dropdown)
- Filter by Status: All / Pending / Approved
- Clear filters button

**Grouping & Display:**
- Group by Style → then by Component
- Show style code, name, customer in header
- Each component shows all its costing options
- ⭐ Star icon on lowest cost option per component
- Color coding: Green for approved, Yellow for pending

**Actions per Option:**
- **Approve** - Mark as preferred (only one per component)
- **Delete** - Remove option
- **Edit** - Opens FabricCostingPage with this option loaded (optional)

**Batch Actions:**
- "Proceed to Cost Sheet" per style (enabled only when all components have approved option)

**Pagination:**
- Paginate by style (10 styles per page)
- Total count of styles with pending approvals

---

### Step 6: Update Fabric Costing Page

**File:** `frontend/src/pages/FabricCostingPage.tsx`

Add:
1. **"Save as New Option"** button (always creates new record)
2. **"View All Options"** button → navigates to FabricCostingOptionsPage
3. Show badge if options exist: "3 options saved"

---

### Step 7: Frontend Service

**File:** `frontend/src/services/fabric-costing.service.ts`

Add:
```typescript
getCostingOptions(styleId: string): Promise<GroupedCostingOptions>
approveCostingOption(optionId: string): Promise<void>
deleteCostingOption(optionId: string): Promise<void>
```

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Change unique constraint to include `processorId` |
| `backend/src/controllers/fabric-costing.controller.ts` | Update upsert, add 3 new functions |
| `backend/src/routes/fabric-costing.routes.ts` | Add 3 new routes |
| `frontend/src/pages/FabricCostingOptionsPage.tsx` | **NEW** - Dedicated page for viewing/filtering all saved costings |
| `frontend/src/pages/FabricCostingPage.tsx` | Add "View All Options" button, show saved options count |
| `frontend/src/services/fabric-costing.service.ts` | Add API calls for options, approve, delete |
| `frontend/src/types/fabricCosting.types.ts` | Add types for grouped costing options |
| `frontend/src/routes/lazy-routes.tsx` | Add route `/fabric-costing/options` |
| `frontend/src/components/Sidebar.tsx` | Add "Costing Options" menu item under Costing section |

---

## Testing

1. Open Fabric Costing for a style
2. Configure costing with Processor A, Width 44" → Save
3. Change to Processor B (same width) → Save
4. Change width to 52" → Save
5. Navigate to "View All Options"
6. **Expected:** See 3 separate options
7. Click "Approve" on best option
8. **Expected:** Option marked as approved, others reset
9. Proceed to Cost Sheet
10. **Expected:** Only approved options used in calculation

---

## Previous Fixes (Completed)

1. ✅ Slab lookup for quantities exceeding max range
2. ✅ NULL fabricId support for generic fabrics
3. ✅ Multiple costing options (processorId in unique constraint)
4. ✅ FabricCostingOptionsPage created
5. ✅ Approval workflow endpoints

---

## NEW: Add Order Quantity to Costing Options

### Problem

The FabricCostingOptionsPage doesn't show the estimated quantity for which the costing was calculated. Since processor rates are **slab-based** (different rates for different quantity ranges), users need to know:
- What order quantity was used for rate lookup
- This helps them compare options fairly (e.g., 500 pcs rate vs 5000 pcs rate)

### Current Flow

1. User enters `orderQuantity` (pieces) in FabricCostingPage (default: 1000)
2. Calculation: `totalQuantity = cadMeters × orderQuantity` (meters for slab lookup)
3. Processor rate slab is looked up based on total meters
4. **Problem:** `orderQuantity` is NOT saved to database

### Solution: Add `orderQuantityPcs` Field

Store the order quantity used during costing calculation so it can be displayed in the options list.

---

### Step 8: Schema Change

**File:** `backend/prisma/schema.prisma` (in fabric_width_cad model, after line 3682)

```prisma
// === FABRIC COSTING BREAKDOWN ===
// Add after numberOfColors:
orderQuantityPcs      Int?      // Order quantity (pieces) used for slab rate lookup
```

---

### Step 9: Update Backend Save Logic

**File:** `backend/src/controllers/fabric-costing.controller.ts`

In `saveFabricCosting` function, add to `costingData`:

```typescript
const costingData = {
  // ... existing fields ...
  orderQuantityPcs: costing.orderQuantityPcs ? parseInt(costing.orderQuantityPcs) : null,
};
```

---

### Step 10: Update Frontend Types

**File:** `frontend/src/types/fabricCosting.types.ts`

Add to `FabricCostingSaveItem`:
```typescript
export interface FabricCostingSaveItem {
  // ... existing fields ...
  orderQuantityPcs?: number; // Order quantity used for costing
}
```

Add to `CostingOption`:
```typescript
export interface CostingOption {
  // ... existing fields ...
  orderQuantityPcs: number | null;
}
```

---

### Step 11: Update FabricCostingPage Save

**File:** `frontend/src/pages/FabricCostingPage.tsx`

In `handleSaveAll` function, include orderQuantity in payload:

```typescript
const savePayload = {
  styleId: selectedStyleId,
  fabricCostings: fabricRows
    .filter(row => row.totalCostPerMeter !== null)
    .map(row => ({
      // ... existing fields ...
      orderQuantityPcs: orderQuantity, // Add this
    })),
};
```

---

### Step 12: Update Backend Get Options

**File:** `backend/src/controllers/fabric-costing.controller.ts`

In `getStyleCostingOptions`, include `orderQuantityPcs` in the response:

```typescript
// Add to option mapping
orderQuantityPcs: option.orderQuantityPcs,
```

---

### Step 13: Update FabricCostingOptionsPage Display

**File:** `frontend/src/pages/FabricCostingOptionsPage.tsx`

Add a new column to show the order quantity:

```tsx
// In TableHeader (after Processor column):
<TableHead className="text-right">Qty (pcs)</TableHead>

// In TableBody (after processor cell):
<TableCell className="text-right">
  {option.orderQuantityPcs?.toLocaleString() || '-'}
</TableCell>
```

Also show total meters calculation in tooltip:
```tsx
<TableCell className="text-right" title={option.cadMeters && option.orderQuantityPcs
  ? `${(option.cadMeters * option.orderQuantityPcs).toFixed(0)}m total`
  : undefined
}>
  {option.orderQuantityPcs?.toLocaleString() || '-'}
</TableCell>
```

---

### Files to Modify (Step 8-13)

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Add `orderQuantityPcs Int?` field to fabric_width_cad |
| `backend/src/controllers/fabric-costing.controller.ts` | Save and return orderQuantityPcs |
| `frontend/src/types/fabricCosting.types.ts` | Add orderQuantityPcs to types |
| `frontend/src/pages/FabricCostingPage.tsx` | Include orderQuantity in save payload |
| `frontend/src/pages/FabricCostingOptionsPage.tsx` | Display quantity column |

---

### Migration Steps

```bash
# 1. Add field to schema
# 2. Generate client
npx prisma generate

# 3. Push schema (or create migration)
npx prisma db push
```

---

### UI Preview (Updated Table)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ # │ Greige        │ Width │ Processor      │ Qty (pcs) │ Greige │ Trp │ Process │ Total │
│ 1 │ Mul Mul 60×60 │  44"  │ Manish Textile │   1,000   │ ₹45    │ ₹2  │ ₹20     │ ₹67   │
│ 2 │ Mul Mul 60×60 │  44"  │ Shree Dye      │   5,000   │ ₹45    │ ₹3  │ ₹16     │ ₹64 ⭐│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Now users can see:
- Option 1 was calculated for 1,000 pcs (lower quantity slab rate)
- Option 2 was calculated for 5,000 pcs (bulk rate, hence lower processing cost)

---

## Step 14: Add Fabric Quantity (meters) Column ✅ COMPLETED

Added "Fabric (m)" column to FabricCostingOptionsPage.

---

# NEW: Workflow Modes for Fabric Costing Options

## Requirements

Add three workflow modes to Fabric Costing Options (same as CAD Planning):
1. **PLANNING** - Initial fabric costing estimates during style development
2. **COSTING** - Approved costings used for quotations
3. **PRODUCTION** - Final costings locked for production orders

---

## Current State Analysis

### Existing Infrastructure (Already in `fabric_width_cad` table!)

```prisma
purpose String? // "PRODUCTION" | "PLANNING" | "COSTING"
approvalStatus String? // "PENDING" | "APPROVED" | "REJECTED"
approvedBy String?
approvedAt DateTime?
isLocked Boolean @default(false)
```

**Key insight:** The schema already supports workflow modes - we just need to use them!

### What's Missing

1. Fabric Costing doesn't set `purpose` when saving
2. Options page doesn't filter by purpose
3. No purpose tabs in UI
4. No transition workflow between modes

---

## Implementation Plan

### Step 15: Backend - Save with Purpose

**File:** `backend/src/controllers/fabric-costing.controller.ts`

```typescript
// In saveFabricCosting, add purpose to costingData:
const costingData = {
  // ... existing fields ...
  purpose: costing.purpose || 'PLANNING', // Default to PLANNING
};
```

---

### Step 16: Backend - Filter by Purpose

**File:** `backend/src/controllers/fabric-costing.controller.ts`

```typescript
// In getCostingOptions, add purpose filter:
const { customerId, styleId, processorId, status, purpose, page = 1, limit = 10 } = req.query;

const where: any = {
  costingStyleId: { not: null },
  totalCostPerMeter: { not: null },
};

if (purpose && purpose !== 'ALL') {
  where.purpose = purpose;
}
```

---

### Step 17: Backend - Add Purpose Counts

**File:** `backend/src/controllers/fabric-costing.controller.ts`

```typescript
// Get counts by purpose
const counts = await prisma.fabric_width_cad.groupBy({
  by: ['purpose'],
  where: { costingStyleId: { not: null }, totalCostPerMeter: { not: null } },
  _count: { id: true },
});

const purposeCounts = {
  all: counts.reduce((sum, c) => sum + c._count.id, 0),
  planning: counts.find(c => c.purpose === 'PLANNING')?._count.id || 0,
  costing: counts.find(c => c.purpose === 'COSTING')?._count.id || 0,
  production: counts.find(c => c.purpose === 'PRODUCTION')?._count.id || 0,
};

// Return in response
return res.json(serialize({
  success: true,
  data: paginatedData,
  pagination: { ... },
  purposeCounts, // NEW
}));
```

---

### Step 18: Backend - Promote Endpoint

**File:** `backend/src/controllers/fabric-costing.controller.ts`

```typescript
/**
 * Promote costing option to next workflow stage
 * POST /api/fabric-costing/option/:optionId/promote
 */
export async function promoteCostingOption(req: Request, res: Response) {
  const { optionId } = req.params;
  const { targetPurpose } = req.body;

  const validPaths = [
    { from: 'PLANNING', to: 'COSTING' },
    { from: 'COSTING', to: 'PRODUCTION' },
  ];

  const option = await prisma.fabric_width_cad.findUnique({
    where: { id: optionId },
  });

  const isValid = validPaths.some(
    p => p.from === option.purpose && p.to === targetPurpose
  );

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: `Invalid transition: ${option.purpose} → ${targetPurpose}`,
    });
  }

  // Create copy with new purpose
  const { id, createdAt, updatedAt, ...data } = option;
  const promoted = await prisma.fabric_width_cad.create({
    data: {
      ...data,
      purpose: targetPurpose,
      approvalStatus: 'PENDING',
      approvedBy: null,
      approvedAt: null,
    },
  });

  return res.json({ success: true, data: promoted });
}
```

---

### Step 19: Add Route

**File:** `backend/src/routes/fabric-costing.routes.ts`

```typescript
router.post('/option/:optionId/promote', fabricCostingController.promoteCostingOption);
```

---

### Step 20: Frontend Types

**File:** `frontend/src/types/fabricCosting.types.ts`

```typescript
// Add to FabricCostingSaveItem
purpose?: 'PLANNING' | 'COSTING' | 'PRODUCTION';

// Add to CostingOption
purpose: 'PLANNING' | 'COSTING' | 'PRODUCTION' | null;

// Add to CostingOptionsFilters
purpose?: 'ALL' | 'PLANNING' | 'COSTING' | 'PRODUCTION';

// New type
export type CostingPurpose = 'PLANNING' | 'COSTING' | 'PRODUCTION';
```

---

### Step 21: FabricCostingPage - Purpose Selector

**File:** `frontend/src/pages/FabricCostingPage.tsx`

```tsx
// Add state
const [purpose, setPurpose] = useState<CostingPurpose>('PLANNING');

// Add tabs UI
<div className="flex items-center gap-2 mb-4">
  <span className="text-sm font-medium">Mode:</span>
  <Tabs value={purpose} onValueChange={(v) => setPurpose(v as CostingPurpose)}>
    <TabsList>
      <TabsTrigger value="PLANNING">Planning</TabsTrigger>
      <TabsTrigger value="COSTING">Costing</TabsTrigger>
      <TabsTrigger value="PRODUCTION">Production</TabsTrigger>
    </TabsList>
  </Tabs>
</div>

// Include in save payload
purpose: purpose,
```

---

### Step 22: FabricCostingOptionsPage - Purpose Tabs

**File:** `frontend/src/pages/FabricCostingOptionsPage.tsx`

```tsx
// Add purpose to filters
const [filters, setFilters] = useState<CostingOptionsFilters>({
  // ... existing ...
  purpose: 'ALL',
});

// Add tabs above filters
<Tabs
  value={filters.purpose || 'ALL'}
  onValueChange={(val) => handleFilterChange('purpose', val)}
>
  <TabsList>
    <TabsTrigger value="ALL">All ({purposeCounts.all})</TabsTrigger>
    <TabsTrigger value="PLANNING">Planning ({purposeCounts.planning})</TabsTrigger>
    <TabsTrigger value="COSTING">Costing ({purposeCounts.costing})</TabsTrigger>
    <TabsTrigger value="PRODUCTION">Production ({purposeCounts.production})</TabsTrigger>
  </TabsList>
</Tabs>

// Add purpose badge in table
<TableCell>
  <Badge variant={option.purpose === 'PRODUCTION' ? 'default' : 'outline'}>
    {option.purpose || 'PLANNING'}
  </Badge>
</TableCell>

// Add promote buttons
{option.purpose === 'PLANNING' && option.approvalStatus === 'APPROVED' && (
  <Button size="sm" onClick={() => handlePromote(option.id, 'COSTING')}>
    → Costing
  </Button>
)}
{option.purpose === 'COSTING' && option.approvalStatus === 'APPROVED' && (
  <Button size="sm" onClick={() => handlePromote(option.id, 'PRODUCTION')}>
    → Production
  </Button>
)}
```

---

### Step 23: Frontend Service

**File:** `frontend/src/services/fabricCosting.service.ts`

```typescript
async promoteCostingOption(
  optionId: string,
  targetPurpose: 'COSTING' | 'PRODUCTION'
): Promise<void> {
  await api.post(`/fabric-costing/option/${optionId}/promote`, { targetPurpose });
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/controllers/fabric-costing.controller.ts` | Add purpose to save, filter, promote endpoint, counts |
| `backend/src/routes/fabric-costing.routes.ts` | Add promote route |
| `frontend/src/types/fabricCosting.types.ts` | Add purpose to types |
| `frontend/src/pages/FabricCostingPage.tsx` | Add purpose tabs, include in save |
| `frontend/src/pages/FabricCostingOptionsPage.tsx` | Add purpose tabs, badges, promote buttons |
| `frontend/src/services/fabricCosting.service.ts` | Add promoteCostingOption |

---

## UI Preview

### FabricCostingOptionsPage with Purpose Tabs
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Fabric Costing Options                                          [+ New Costing] │
├─────────────────────────────────────────────────────────────────────────────────┤
│ [All (15)] [Planning (8)] [Costing (5)] [Production (2)]     ← PURPOSE TABS     │
│                                                                                 │
│ Filters: [Customer ▼] [Style ▼] [Processor ▼] [Status ▼]                       │
│                                                                                 │
│ Component: BLOUSE                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────────┐│
│ │ # │ Mode     │ Greige   │ Width │ Processor │ Total  │ Status   │ Actions  ││
│ │ 1 │ PLANNING │ Mul Mul  │ 44"   │ Manish    │ ₹67    │ APPROVED │ [→Cost]  ││
│ │ 2 │ COSTING  │ Mul Mul  │ 44"   │ Manish    │ ₹67    │ APPROVED │ [→Prod]  ││
│ │ 3 │ PRODUCTION│ Mul Mul │ 44"   │ Manish    │ ₹67    │ APPROVED │ 🔒       ││
│ └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Rules

1. **PLANNING** → Initial estimates, editable
2. **COSTING** → Approved for quotations, requires approval to modify
3. **PRODUCTION** → Locked, cannot be modified

### Transitions:
- PLANNING → COSTING: Requires APPROVED status
- COSTING → PRODUCTION: Requires APPROVED status
- Promoting creates a copy (original remains for audit)

---

## Testing

1. Create costing in PLANNING mode → Save
2. Approve the PLANNING option
3. Click "→ Costing" to promote
4. Verify new COSTING option created with PENDING status
5. Approve COSTING option
6. Click "→ Production" to promote
7. Verify PRODUCTION option created
8. Test filtering by purpose tabs
9. Verify counts update correctly
