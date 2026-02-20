# Processor Rate Card Management - Redesign Plan

## Overview
Redesign the Processor Rate Card Management system with a new matrix-based UI that:
- Shows ONE editable table per processor
- Displays Greige fabrics as rows (Generic Name + Full Greige Name columns)
- Displays custom quantity slabs as columns (editable headers)
- Only applies to PRINTING & DYEING processes
- Supports copying entire tables between processors

## Key Requirements Summary
| Requirement | Implementation |
|-------------|----------------|
| Process Types | DYEING and PRINTING only |
| Table Layout | One table per processor |
| Row Data | Generic Fabric Name + Greige Name (from Greige Master) |
| Column Data | Custom quantity slabs (editable) |
| Rate Fields | Rate per meter only (simplified) |
| Row Population | Auto-populate from Greige Master + allow add/remove |
| Copy Feature | Copy structure + slabs (rates optional) |
| Old Page | **REPLACE entirely** (not keeping old page) |
| Costing Module | **UPDATE to new API** (no dual support) |

## Fields to REMOVE from Current System
- `setupCharge`
- `minimumCharge`
- `turnaroundDays`
- `conditions`
- `priority`
- `effectiveFrom` / `effectiveTo`

---

## Phase 1: Database Schema Changes

### 1.1 New Table: `processor_quantity_slabs`
Stores slab definitions (column headers) for each processor.

```prisma
model processor_quantity_slabs {
  id             String   @id @default(uuid())
  processorId    String
  processingType String   // "DYEING" or "PRINTING" only
  slabOrder      Int      // Display order (1, 2, 3...)
  minQuantity    Decimal  @db.Decimal(10, 2)
  maxQuantity    Decimal  @db.Decimal(10, 2)
  slabLabel      String?  // e.g., "0-500m"
  isActive       Boolean  @default(true)
  createdById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  processor      suppliers @relation(...)
  rateEntries    processor_rate_card[] @relation(...)

  @@unique([processorId, processingType, slabOrder])
}
```

### 1.2 Modify `processor_rate_card`
- ADD: `greigeId` (FK to greige_master)
- ADD: `slabId` (FK to processor_quantity_slabs)
- REMOVE: `setupCharge`, `minimumCharge`, `turnaroundDays`, `conditions`, `priority`, `effectiveFrom`, `effectiveTo`
- DEPRECATE: `minQuantityMeters`, `maxQuantityMeters`, `fabricCategory`, `genericGreigeName`

### 1.3 Add Relation to `greige_master`
```prisma
processorRateCards processor_rate_card[] @relation("greige_rate_cards")
```

**Files to modify:**
- [schema.prisma](backend/prisma/schema.prisma) (lines 1960-2004)

---

## Phase 2: Backend API Implementation

### 2.1 New Service: `processor-rate-v2.service.ts`

Key functions:
| Function | Purpose |
|----------|---------|
| `getAllDyeingPrintingProcessors()` | Get processors handling DYEING/PRINTING |
| `getProcessorRateMatrix(processorId, processingType)` | Get complete matrix with slabs, greiges, rates |
| `getGreigeFabricsForRateCard()` | Get all active greiges for row population |
| `updateProcessorSlabs(processorId, processingType, slabs)` | Create/update slab definitions |
| `saveProcessorRateMatrix(processorId, processingType, rates)` | Bulk save all rates |
| `copyProcessorRates(source, target, options)` | Copy matrix between processors |
| `addGreigeToProcessor(processorId, greigeId)` | Add greige row |
| `removeGreigeFromProcessor(processorId, greigeId)` | Remove greige row |

### 2.2 New Controller: `processor-rate-card-v2.controller.ts`

### 2.3 New Routes: `processor-rate-card-v2.routes.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v2/processors` | List DYEING/PRINTING processors |
| GET | `/v2/processors/:id/matrix` | Get rate matrix |
| GET | `/v2/greiges` | List greiges for rows |
| POST | `/v2/processors/:id/slabs` | Update slabs |
| PUT | `/v2/processors/:id/matrix` | Save rates |
| POST | `/v2/copy` | Copy between processors |
| POST | `/v2/processors/:id/greiges/:greigeId` | Add row |
| DELETE | `/v2/processors/:id/greiges/:greigeId` | Remove row |

**Files to create:**
- [processor-rate-v2.service.ts](backend/src/services/processor-rate-v2.service.ts)
- [processor-rate-card-v2.controller.ts](backend/src/controllers/processor-rate-card-v2.controller.ts)
- [processor-rate-card-v2.routes.ts](backend/src/routes/processor-rate-card-v2.routes.ts)
- [processor-rate-v2.types.ts](backend/src/types/processor-rate-v2.types.ts)

---

## Phase 3: Frontend Implementation

### 3.1 New Page Structure

```
ProcessorRateCardPageV2
├── Header: Title + Processing Type Tabs [DYEING] [PRINTING]
├── Toolbar: Processor Selector | [Add Row] [Copy] [Save] [Discard]
├── Matrix Table
│   ├── Header Row (editable slab columns)
│   │   ├── "Generic Fabric Name" (fixed)
│   │   ├── "Greige Name" (fixed)
│   │   ├── [Slab 1: 0-500m] [x]
│   │   ├── [Slab 2: 500-2000m] [x]
│   │   └── [+ Add Slab]
│   └── Body Rows (greige fabrics)
│       ├── [Generic Name] | [Greige Name] | [rate] | [rate] | [x remove]
├── AddGreigeModal (search & select greiges)
└── CopyProcessorModal (target processor + options)
```

### 3.2 Components to Create

| Component | File | Purpose |
|-----------|------|---------|
| `ProcessorRateCardPageV2` | `pages/ProcessorRateCardPageV2.tsx` | Main page |
| `RateMatrixTable` | `components/processor-rate/RateMatrixTable.tsx` | Editable table |
| `SlabHeaderCell` | `components/processor-rate/SlabHeaderCell.tsx` | Editable slab header |
| `RateInputCell` | `components/processor-rate/RateInputCell.tsx` | Rate input cell |
| `AddGreigeModal` | `components/processor-rate/AddGreigeModal.tsx` | Add rows modal |
| `CopyProcessorModal` | `components/processor-rate/CopyProcessorModal.tsx` | Copy modal |

### 3.3 Frontend Service & Types

**Files to create:**
- [processorRateCardV2.service.ts](frontend/src/services/processorRateCardV2.service.ts)
- [processorRateCardV2.types.ts](frontend/src/types/processorRateCardV2.types.ts)

---

## Phase 4: Data Migration & Costing Update

### Migration Steps:
1. For each processor with existing rate cards:
   - Extract unique min/max quantity combinations → create slab definitions
   - Match `genericGreigeName` to `greige_master` → set `greigeId`
   - Update rate cards with `slabId` references
2. Log unmatched records for manual review

### Fabric Costing Module Update:
Since we're replacing entirely (no V1 API):
1. Update `fabric-costing.controller.ts` to use new rate lookup logic
2. Update `style_costing_fabric_items` references to work with new schema
3. Modify rate lookup to use `greigeId` + `slabId` instead of text matching

---

## UI/UX Design

### Matrix Table Example:
```
┌──────────────────┬─────────────────────────┬──────────┬───────────┬──────────┐
│ Generic Fabric   │ Greige Name             │ 0-500m   │ 500-2000m │ 2000m+   │
│ Name             │                         │   [x]    │    [x]    │   [x]    │
├──────────────────┼─────────────────────────┼──────────┼───────────┼──────────┤
│ Cambric          │ Cambric 40x40/133x72    │  12.50   │   11.00   │  10.50   │ [x]
│ Cambric          │ Cambric 60x60/144x80    │  14.00   │   12.50   │  12.00   │ [x]
│ Poplin           │ Poplin 40x40/96x92      │  13.00   │   11.50   │  11.00   │ [x]
└──────────────────┴─────────────────────────┴──────────┴───────────┴──────────┘
                                              [+ Add Column]
┌─────────────────────┐
│ [+ Add Row]         │
└─────────────────────┘
```

### Key Interactions:
- Click slab header → Edit min/max range
- Tab between cells → Navigate and edit rates
- [Copy] → Select target processor, copy structure + optional rates
- Unsaved changes warning before leaving

---

## Implementation Order

### Step 1: Schema & Migration
1. Add `processor_quantity_slabs` table to schema
2. Modify `processor_rate_card` - add `greigeId`, `slabId`, remove deprecated fields
3. Add relation to `greige_master`
4. Run `npx prisma migrate dev`
5. Create data migration script (if needed for existing data)

### Step 2: Backend API
1. Create `backend/src/types/processor-rate-v2.types.ts`
2. Create `backend/src/services/processor-rate-v2.service.ts`
3. Create `backend/src/controllers/processor-rate-card-v2.controller.ts`
4. Create `backend/src/routes/processor-rate-card-v2.routes.ts`
5. Register routes in `backend/src/routes/index.ts`
6. Update `fabric-costing.controller.ts` for new rate lookup

### Step 3: Frontend Service
1. Create `frontend/src/types/processorRateCardV2.types.ts`
2. Create `frontend/src/services/processorRateCardV2.service.ts`

### Step 4: Frontend Page (Replace old page)
1. Replace `ProcessorRateCardPage.tsx` with new matrix UI
2. Update routes in `lazy-routes.tsx` and `App.tsx`
3. Implement processor selector with DYEING/PRINTING tabs
4. Implement matrix table with editable cells
5. Add slab header editing (add/edit/delete columns)
6. Add rate cell editing with validation
7. Implement save functionality with bulk update

### Step 5: Frontend Modals & Features
1. Add Greige Modal (search & select from greige_master)
2. Copy Processor Modal (select target + copy options)
3. Auto-populate rows from Greige Master on first load

### Step 6: Polish & Testing
1. Tab/keyboard navigation between cells
2. Unsaved changes warning
3. Error handling & validation
4. Loading states & empty states
5. Test with existing data

---

## Critical Files Reference

| Purpose | File Path |
|---------|-----------|
| Prisma Schema | `backend/prisma/schema.prisma` |
| Current Rate Service | `backend/src/services/processor-rate.service.ts` |
| Current Frontend Page | `frontend/src/pages/ProcessorRateCardPage.tsx` |
| Greige Types | `frontend/src/types/fabric-greige.types.ts` |
| Greige Service | `frontend/src/services/fabricGreigeService.ts` |
| App Routes | `frontend/src/App.tsx`, `frontend/src/routes/lazy-routes.tsx` |
| Sidebar Navigation | `frontend/src/components/Sidebar.tsx` |

---

## Phase 7: Summary Dashboard (NEW)

### Problem
When no processor is selected, the page shows a blank state: "Select a processor to manage rate cards". This is not useful since:
- Different processors have different slab configurations
- Users need visibility into which processors are configured vs not
- No quick way to see overall coverage/status

### Solution: Summary Dashboard View

When no processor is selected, show a summary dashboard with:
1. **Overall statistics cards** - Total processors, configured count, complete count
2. **Processing type tabs** (DYEING/PRINTING) with per-type stats
3. **Processor cards grid** showing each processor's configuration status
4. **Quick actions** - Click card to edit, filter/sort options

### 7.1 New Backend API Endpoint

**Route**: `GET /api/processor-rate-cards/v2/summary`

**Add to `processor-rate-v2.service.ts`**:
```typescript
export async function getProcessorRateCardSummary() {
  // Use efficient aggregate queries with groupBy
  const [processors, slabCounts, rateStats, greigeCounts, slabDetails, lastUpdated, totalGreigeCount] =
    await Promise.all([
      getAllDyeingPrintingProcessors(),
      prisma.processor_quantity_slabs.groupBy({
        by: ['processorId', 'processingType'],
        where: { isActive: true },
        _count: { id: true },
      }),
      prisma.processor_rate_card.groupBy({
        by: ['processorId', 'processingType'],
        where: { isActive: true, greigeId: { not: null }, slabId: { not: null } },
        _count: { id: true },
        _min: { ratePerMeter: true },
        _max: { ratePerMeter: true },
      }),
      prisma.processor_rate_card.groupBy({
        by: ['processorId', 'processingType', 'greigeId'],
        where: { isActive: true, greigeId: { not: null } },
      }),
      prisma.processor_quantity_slabs.findMany({
        where: { isActive: true },
        select: { processorId: true, processingType: true, slabLabel: true },
        orderBy: { slabOrder: 'asc' },
      }),
      prisma.processor_rate_card.groupBy({
        by: ['processorId'],
        _max: { updatedAt: true },
      }),
      prisma.greige_master.count({ where: { isActive: true } }),
    ]);
  // Build and return summary response
}
```

### 7.2 Response Types

```typescript
interface ProcessorTypeStats {
  slabCount: number;
  greigeCount: number;        // Greiges with rates
  totalRateCount: number;
  coverage: number;           // Percentage filled
  minRate?: number;
  maxRate?: number;
  slabRanges?: string[];      // e.g., ["0-500m", "500-2000m"]
}

interface ProcessorSummary {
  id: string;
  name: string;
  code: string;
  dyeing: ProcessorTypeStats;
  printing: ProcessorTypeStats;
  status: 'NOT_CONFIGURED' | 'PARTIAL' | 'COMPLETE';
  lastUpdatedAt?: string;
}

interface ProcessorRateCardSummary {
  processors: ProcessorSummary[];
  totals: {
    totalProcessors: number;
    configuredProcessors: number;
    completeProcessors: number;
    totalGreigeCount: number;
  };
  processingTypeSummary: {
    DYEING: { totalSlabs, totalRates, processorsConfigured, averageCoverage };
    PRINTING: { totalSlabs, totalRates, processorsConfigured, averageCoverage };
  };
}
```

### 7.3 Frontend Summary Component

**Create**: `frontend/src/components/processor-rate-card/ProcessorRateCardSummary.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Total: 5]  [Configured: 3]  [Complete: 1]  [Greiges: 45]         │  <- Stats cards
├─────────────────────────────────────────────────────────────────────┤
│  [DYEING (3)] [PRINTING (2)]        [Search...] [Sort: Status ▼]   │  <- Tabs + filters
├─────────────────────────────────────────────────────────────────────┤
│  Configured: 3 | Slabs: 12 | Rates: 89 | Avg Coverage: 67%         │  <- Type summary bar
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Manish Text. │  │ ABC Dyeing   │  │ XYZ Process  │              │
│  │ [Complete ✓] │  │ [Partial ⚠]  │  │ [Not Config] │              │
│  │              │  │              │  │              │              │
│  │ Slabs: 3     │  │ Slabs: 2     │  │ [Configure]  │              │
│  │ 0-500m       │  │ 0-100m       │  │              │              │
│  │ 500-2000m    │  │ 100-500m     │  │              │              │
│  │ 2000m+       │  │              │  │              │              │
│  │              │  │              │  │              │              │
│  │ Greiges: 12  │  │ Greiges: 5   │  │              │              │
│  │ Rates: 36    │  │ Rates: 8     │  │              │              │
│  │ Coverage:100%│  │ Coverage:80% │  │              │              │
│  │ ████████████ │  │ ████████░░░░ │  │              │              │
│  │              │  │              │  │              │              │
│  │ ₹10-25/m     │  │ ₹12-18/m     │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Click processor card → Select that processor for editing
- Status badges: Complete (green), Partial (yellow), Not Configured (gray)
- Coverage progress bar with color coding (green ≥80%, yellow ≥50%, orange >0%)
- Filter by search term, sort by name/status/coverage
- Tabs switch between DYEING and PRINTING views

### 7.4 Integration with Existing Page

**Modify**: `frontend/src/pages/ProcessorRateCardPage.tsx`

Replace blank state (lines 438-442):
```tsx
// OLD:
{!selectedProcessorId && !loading && (
  <div className="text-center py-12 bg-gray-50 rounded-lg">
    <p className="text-gray-500">Select a processor to manage rate cards</p>
  </div>
)}

// NEW:
{!selectedProcessorId && !loading && (
  <ProcessorRateCardSummary
    onSelectProcessor={(processorId, processingType) => {
      setProcessingType(processingType);
      setSelectedProcessorId(processorId);
    }}
  />
)}
```

### 7.5 Files to Modify/Create

| Action | File |
|--------|------|
| ADD | `frontend/src/components/processor-rate-card/ProcessorRateCardSummary.tsx` |
| MODIFY | `frontend/src/pages/ProcessorRateCardPage.tsx` - Import and use summary component |
| MODIFY | `frontend/src/types/processorRateCardV2.types.ts` - Add summary types |
| MODIFY | `frontend/src/services/processorRateCardV2.service.ts` - Add `getSummary()` |
| MODIFY | `backend/src/services/processor-rate-v2.service.ts` - Add `getProcessorRateCardSummary()` |
| MODIFY | `backend/src/controllers/processor-rate-card-v2.controller.ts` - Add handler |
| MODIFY | `backend/src/routes/processor-rate-card-v2.routes.ts` - Add route |
| MODIFY | `backend/src/types/processor-rate-v2.types.ts` - Add summary types |

### 7.6 Status Determination Logic

```typescript
function determineStatus(dyeing: Stats, printing: Stats): Status {
  const dyeingConfigured = dyeing.slabCount > 0;
  const printingConfigured = printing.slabCount > 0;

  if (!dyeingConfigured && !printingConfigured) return 'NOT_CONFIGURED';

  const dyeingComplete = dyeingConfigured && dyeing.coverage >= 80;
  const printingComplete = printingConfigured && printing.coverage >= 80;

  if ((dyeingConfigured && dyeingComplete) || (printingConfigured && printingComplete)) {
    return 'COMPLETE';
  }

  return 'PARTIAL';
}
```

---

## Phase 8: Printing Types Dimension (NEW)

### Problem
For PRINTING, rates vary not just by greige and quantity slab, but also by **printing type**:
- Pigment
- Procian
- Discharge
- Pigment Discharge

Each printing type has different costs, so rates need to be stored separately per printing type.

### Design Decisions (User Confirmed)
1. **Shared slabs**: All printing types share the same quantity slab columns (e.g., 0-500m, 500-2000m). Only rates differ per printing type.
2. **Sub-tabs UI**: Within PRINTING tab, show sub-tabs: [Pigment] [Procian] [Discharge] [Pigment Discharge]

### Current vs New Structure

**Current**: One rate per (processor, processingType, greige, slab)
```
Processor + PRINTING + Greige A + Slab 1 → ₹12/m
```

**New**: One rate per (processor, processingType, printingType, greige, slab)
```
Processor + PRINTING + Pigment + Greige A + Slab 1 → ₹12/m
Processor + PRINTING + Procian + Greige A + Slab 1 → ₹18/m
Processor + PRINTING + Discharge + Greige A + Slab 1 → ₹22/m
Processor + PRINTING + Pigment Discharge + Greige A + Slab 1 → ₹25/m
```

### 8.1 Database Schema Changes

**Add PrintingType enum** to Prisma schema:
```prisma
enum PrintingType {
  PIGMENT
  PROCIAN
  DISCHARGE
  PIGMENT_DISCHARGE
}
```

**Modify `processor_rate_card`** table:
```prisma
model processor_rate_card {
  // ... existing fields ...
  printingType    PrintingType?  // NULL for DYEING, required for PRINTING

  // Update unique constraint
  @@unique([processorId, processingType, printingType, greigeId, slabId], name: "unique_rate_card_v2")
}
```

**Note**: `processor_quantity_slabs` stays unchanged - slabs are shared across printing types.

### 8.2 Type Changes

**Backend** (`backend/src/types/processor-rate-v2.types.ts`):
```typescript
// Add PrintingType enum
export type PrintingTypeV2 = 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';

// Display labels for UI
export const PRINTING_TYPE_LABELS: Record<PrintingTypeV2, string> = {
  PIGMENT: 'Pigment',
  PROCIAN: 'Procian',
  DISCHARGE: 'Discharge',
  PIGMENT_DISCHARGE: 'Pigment Discharge',
};

// Update RateEntry
export interface RateEntry {
  greigeId: string;
  slabId: string;
  ratePerMeter: number | null;
  printingType?: PrintingTypeV2;  // Only for PRINTING
}

// Update SaveMatrixRequest
export interface SaveMatrixRequest {
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2;  // Only for PRINTING
  slabs: SlabInput[];
  rates: RateEntry[];
  deletedGreigeIds?: string[];
}

// Update rate lookup
export interface RateLookupQuery {
  processorId: string;
  processingType: ProcessingTypeV2;
  printingType?: PrintingTypeV2;  // Required when processingType = PRINTING
  greigeId: string;
  quantityMeters: number;
}
```

**Frontend** (`frontend/src/types/processorRateCardV2.types.ts`):
Same additions as backend.

### 8.3 API Changes

**GET `/v2/processors/:processorId/matrix`**
Add query parameter: `printingType` (required when processingType=PRINTING)

```
GET /v2/processors/123/matrix?processingType=PRINTING&printingType=PIGMENT
```

**PUT `/v2/processors/:processorId/matrix`**
Add `printingType` to request body (required when processingType=PRINTING)

**POST `/v2/lookup`**
Add `printingType` to lookup query (required when processingType=PRINTING)

### 8.4 Service Changes

**`getProcessorRateMatrix(processorId, processingType, printingType?)`**
- Add optional `printingType` parameter
- When processingType=PRINTING, filter rates by printingType
- Slabs are still fetched without printingType filter (shared)

**`saveProcessorRateMatrix(processorId, processingType, printingType?, request)`**
- Add optional `printingType` parameter
- When saving rates for PRINTING, include printingType in upsert
- Slabs are still shared (no change to slab handling)

**`lookupRate(query)`**
- Add printingType to lookup logic

### 8.5 UI Changes

**ProcessorRateCardPage.tsx**

Add printing type sub-tabs within PRINTING:
```tsx
// State
const [printingType, setPrintingType] = useState<PrintingTypeV2>('PIGMENT');

// UI - Show sub-tabs when processingType is PRINTING
{processingType === 'PRINTING' && (
  <div className="flex gap-2 mb-4 ml-4">
    {(['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE'] as PrintingTypeV2[]).map((type) => (
      <Button
        key={type}
        variant={printingType === type ? 'default' : 'outline'}
        size="sm"
        onClick={() => setPrintingType(type)}
        disabled={hasUnsavedChanges}
      >
        {PRINTING_TYPE_LABELS[type]}
      </Button>
    ))}
  </div>
)}
```

Update matrix loading:
```tsx
useEffect(() => {
  if (selectedProcessorId) {
    loadMatrix();
  }
}, [selectedProcessorId, processingType, printingType]); // Add printingType dependency

const loadMatrix = async () => {
  const matrix = await processorRateCardV2Service.getProcessorMatrix(
    selectedProcessorId,
    processingType,
    processingType === 'PRINTING' ? printingType : undefined
  );
  // ... rest of loading logic
};
```

Update save:
```tsx
const handleSave = async () => {
  await processorRateCardV2Service.saveMatrix(selectedProcessorId, {
    processingType,
    printingType: processingType === 'PRINTING' ? printingType : undefined,
    slabs,
    rates,
    deletedGreigeIds,
  });
};
```

### 8.6 Summary Dashboard Updates

**ProcessorRateCardSummary.tsx**

For PRINTING tab, show printing type breakdown:
- Show stats per printing type OR aggregated stats with breakdown on card hover
- Could add mini printing type indicators on processor cards

**Backend summary updates**:
- Group stats by (processorId, processingType, printingType)
- Show per-printing-type coverage for PRINTING processors

### 8.7 Data Migration

For existing PRINTING rate cards:
1. Option A: Set `printingType = NULL` initially, require user to re-enter rates with specific types
2. Option B: Set all existing PRINTING rates to a default type (e.g., PIGMENT)
3. Option C: Copy existing rates to ALL printing types (multiplication)

**Recommended**: Option A - Set NULL and let users configure properly. Old NULL rates won't be found by new lookups that require printingType.

### 8.8 Implementation Order

1. **Schema Migration**
   - Add PrintingType enum to Prisma
   - Add printingType column to processor_rate_card (nullable)
   - Update unique constraint
   - Run migration

2. **Backend Types & Service**
   - Add PrintingTypeV2 type and labels
   - Update RateEntry, SaveMatrixRequest, RateLookupQuery
   - Update getProcessorRateMatrix with printingType param
   - Update saveProcessorRateMatrix with printingType
   - Update lookupRate with printingType

3. **Backend Controller & Routes**
   - Add printingType query param to getProcessorMatrix
   - Add printingType to saveMatrix body
   - Add printingType to lookup body

4. **Frontend Types & Service**
   - Mirror backend type changes
   - Update service methods with printingType param

5. **Frontend UI**
   - Add printingType state
   - Add printing type sub-tabs
   - Update matrix loading/saving to include printingType

6. **Summary Dashboard**
   - Update stats to show printing type breakdown
   - Update processor cards for PRINTING

### 8.9 Files to Modify

| Action | File |
|--------|------|
| MODIFY | `backend/prisma/schema.prisma` - Add enum, update processor_rate_card |
| MODIFY | `backend/src/types/processor-rate-v2.types.ts` - Add PrintingTypeV2, update interfaces |
| MODIFY | `backend/src/services/processor-rate-v2.service.ts` - Add printingType to all functions |
| MODIFY | `backend/src/controllers/processor-rate-card-v2.controller.ts` - Handle printingType |
| MODIFY | `frontend/src/types/processorRateCardV2.types.ts` - Mirror backend changes |
| MODIFY | `frontend/src/services/processorRateCardV2.service.ts` - Add printingType param |
| MODIFY | `frontend/src/pages/ProcessorRateCardPage.tsx` - Add sub-tabs, update loading/saving |
| MODIFY | `frontend/src/components/processor-rate-card/ProcessorRateCardSummary.tsx` - Show printing type stats |

### 8.10 Validation Rules

- When `processingType = 'DYEING'`: `printingType` must be NULL
- When `processingType = 'PRINTING'`: `printingType` is required for new rates
- Slabs are shared - no printingType on slabs
- Copy functionality should ask whether to copy all printing types or specific ones
