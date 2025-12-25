# Cost Sheet Form Integration Guide

This guide explains how to integrate the new fabric sourcing strategy components into CostSheetForm.tsx.

## Summary of Changes

The new fabric costing system has been implemented with:
- **Backend:** ProcessorRateService, FabricCostCalculationService, CostSheetVersioningService
- **API Endpoints:** `/api/fabric-costing/*` and `/api/processor-rate-cards/*`
- **Frontend Components:**
  - `SourcingStrategySelector.tsx` - Modal for selecting sourcing strategy
  - `FabricCostingRow.tsx` - Row component with integrated sourcing
  - `CostComparisonTable.tsx` - Comparison table for all fabrics
  - `VersionManagement.tsx` - Cost sheet versioning UI

## Integration Steps

### Step 1: Update Fabric Data Structure

The current `FabricDetail` type needs to be enhanced to support sourcing strategies.

**File:** `frontend/src/types/costSheet.types.ts`

Add these fields to `FabricDetail`:
```typescript
export interface FabricDetail {
  // Existing fields
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;

  // NEW: Add these fields for fabric costing integration
  fabricId?: string;  // Link to fabric_master
  sourcingStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
  stockLotId?: string;
  processorId?: string;
  rateCardId?: string;
  procurementId?: string;
  greigeCost?: number;
  processingCost?: number;
  isManualOverride?: boolean;
  overrideReason?: string;
}
```

### Step 2: Replace Fabric Details Section in CostSheetForm.tsx

**Current Location:** Lines 840-938

**Replace the entire "Fabric Details" section with:**

```tsx
{/* Fabric Details */}
<div className="bg-white p-6 rounded-lg shadow">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">Fabric Details</h2>
    <Button type="button" onClick={addFabricRow} size="sm">
      <Plus className="w-4 h-4 mr-1" /> Add Fabric
    </Button>
  </div>

  {/* Fabric Table */}
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabric</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CAD (m)</th>
          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Width</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sourcing</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {fabricDetails.map((fabric, index) => (
          <FabricCostingRow
            key={index}
            index={index}
            fabricId={fabric.fabricId || ''}
            fabricName={fabric.fabricName}
            cadMeters={fabric.fabricAverage}
            width={fabric.fabricWidth}
            orderQuantity={selectedStyle?.estimatedQuantity}
            styleId={selectedStyleId}
            currentStrategy={fabric.sourcingStrategy}
            currentCost={fabric.fabricTotal}
            onStrategyChange={(strategy) => updateFabricSourcingStrategy(index, strategy)}
            onRemove={() => removeFabricRow(index)}
          />
        ))}
      </tbody>
    </table>
  </div>

  <div className="mt-4 pt-4 border-t">
    <p className="text-lg font-semibold text-right">
      Fabric Total: {formatCurrency(calculateFabricTotal())}
    </p>
  </div>
</div>

{/* Fabric Cost Comparison Table */}
{fabricDetails.length > 0 && fabricDetails.some(f => f.fabricId) && (
  <CostComparisonTable
    fabricResults={fabricCostResults}
    className="mt-6"
  />
)}
```

### Step 3: Add Required State and Functions

**Add these imports at the top of CostSheetForm.tsx:**

```typescript
import FabricCostingRow from '../components/cost-sheet/FabricCostingRow';
import CostComparisonTable from '../components/cost-sheet/CostComparisonTable';
import type { FabricCostCalculationResult } from '../types/fabricCosting.types';
```

**Add new state variables:**

```typescript
const [fabricCostResults, setFabricCostResults] = useState<FabricCostCalculationResult[]>([]);
```

**Add handler function for sourcing strategy changes:**

```typescript
const updateFabricSourcingStrategy = (
  index: number,
  strategy: {
    sourcingStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
    cost: number;
    stockLotId?: string;
    processorId?: string;
    rateCardId?: string;
    procurementId?: string;
    greigeCost?: number;
    processingCost?: number;
    isManualOverride?: boolean;
    overrideReason?: string;
  }
) => {
  const updated = [...fabricDetails];
  updated[index] = {
    ...updated[index],
    sourcingStrategy: strategy.sourcingStrategy,
    fabricRate: strategy.cost / updated[index].fabricAverage, // Cost per meter
    fabricTotal: strategy.cost,
    stockLotId: strategy.stockLotId,
    processorId: strategy.processorId,
    rateCardId: strategy.rateCardId,
    procurementId: strategy.procurementId,
    greigeCost: strategy.greigeCost,
    processingCost: strategy.processingCost,
    isManualOverride: strategy.isManualOverride,
    overrideReason: strategy.overrideReason,
  };
  setFabricDetails(updated);
};
```

### Step 4: Update Auto-Population Logic

**Modify the auto-population code (around lines 154-253) to include fabricId:**

Change:
```typescript
fabricDetailsFromStyle.push({
  fabricName: fabric.genericFabricName || fabric.fabricName || '',
  fabricWidth: fabric.fabricWidth || 0,
  fabricAverage: fabric.cadAverageMeters || fabric.quantityNeeded || 0,
  fabricRate: fabricRate,
  fabricTotal: (fabric.cadAverageMeters || fabric.quantityNeeded || 0) * fabricRate,
});
```

To:
```typescript
fabricDetailsFromStyle.push({
  fabricName: fabric.genericFabricName || fabric.fabricName || '',
  fabricWidth: fabric.fabricWidth || 0,
  fabricAverage: fabric.cadAverageMeters || fabric.quantityNeeded || 0,
  fabricRate: fabricRate,
  fabricTotal: (fabric.cadAverageMeters || fabric.quantityNeeded || 0) * fabricRate,
  fabricId: fabric.fabricId, // ADD THIS LINE
});
```

### Step 5: Add Version Management (Optional)

If you want to add version management to the cost sheet form, add this section **above** the "Basic Information" section:

```tsx
{/* Version Management - Only show if editing existing cost sheet */}
{isEditMode && currentCostSheetVersion && (
  <VersionManagement
    currentVersion={currentCostSheetVersion}
    allVersions={allCostSheetVersions}
    onCreateNewVersion={handleCreateNewVersion}
    onCompareVersions={handleCompareVersions}
    onSelectVersion={handleSelectVersion}
    className="mb-6"
  />
)}
```

You'll need to add the state and handlers:

```typescript
const [currentCostSheetVersion, setCurrentCostSheetVersion] = useState<any>(null);
const [allCostSheetVersions, setAllCostSheetVersions] = useState<any[]>([]);

const handleCreateNewVersion = () => {
  // Navigate to create new version or show modal
  notify.info('Version management coming soon!');
};

const handleCompareVersions = (v1Id: string, v2Id: string) => {
  // Navigate to comparison view
  navigate(`/cost-sheets/${v1Id}/compare/${v2Id}`);
};

const handleSelectVersion = (versionId: string) => {
  // Load selected version
  navigate(`/cost-sheets/${versionId}`);
};
```

## Backend Integration Required

The backend `cost-sheet.controller.ts` and `cost-sheet.service.ts` also need updates to:

1. **Accept new sourcing fields** when creating/updating cost sheets
2. **Trigger auto-versioning** when cost variance > 5%
3. **Save sourcing strategy data** to `style_costing_fabric_items`

### Update Cost Sheet Creation/Update Endpoint

**File:** `backend/src/services/cost-sheet.service.ts`

The service should:
1. Calculate total cost from all fabric items (including sourcing costs)
2. Check if auto-versioning is needed (if updating existing cost sheet)
3. Save sourcing strategy data to database

Example change in fabric item creation:

```typescript
// Create fabric items with sourcing data
const fabricItems = await Promise.all(
  fabricDetails.map(async (fabric, index) => {
    return await prisma.style_costing_fabric_items.create({
      data: {
        costingId: costSheet.id,
        fabricName: fabric.fabricName,
        fabricWidth: fabric.fabricWidth,
        fabricAverage: fabric.fabricAverage,
        fabricRate: fabric.fabricRate,
        fabricTotal: fabric.fabricTotal,
        serialNumber: index + 1,
        // NEW: Sourcing fields
        sourcingStrategy: fabric.sourcingStrategy || 'READY_FABRIC',
        stockLotId: fabric.stockLotId,
        processorId: fabric.processorId,
        rateCardId: fabric.rateCardId,
        procurementId: fabric.procurementId,
        greigeCost: fabric.greigeCost,
        processingCost: fabric.processingCost,
        readyFabricCost: fabric.sourcingStrategy === 'READY_FABRIC' ? fabric.fabricRate : undefined,
        stockCost: fabric.sourcingStrategy === 'STOCK_REUSE' ? fabric.fabricRate : undefined,
        isManualOverride: fabric.isManualOverride || false,
        overrideReason: fabric.overrideReason,
      },
    });
  })
);
```

## Testing Checklist

- [ ] Fabric rows display correctly with new FabricCostingRow component
- [ ] Clicking "Select Sourcing" opens SourcingStrategySelector modal
- [ ] Modal shows stock availability, ready fabric cost, and greige+processing options
- [ ] Selecting a sourcing strategy updates the fabric row with correct cost
- [ ] Cost comparison table displays all fabrics with sourcing breakdown
- [ ] Manual override for greige cost works and requires justification
- [ ] Fabric total calculates correctly based on selected sourcing
- [ ] Cost sheet saves with sourcing strategy data to backend
- [ ] Version management (if implemented) shows version history

## Migration Notes

**For existing cost sheets:**
- Existing fabric items will default to `sourcingStrategy: 'READY_FABRIC'`
- Users can re-select sourcing strategy to optimize costs
- No data loss - existing `fabricRate` and `fabricTotal` are preserved

**For new cost sheets:**
- Users must select a sourcing strategy for each fabric
- System recommends the cheapest available option
- Manual override supported with audit trail

## URLs for New Features

Once integrated, these features will be accessible:

- **Cost Sheet Form:** `/cost-sheets/new` or `/cost-sheets/:id/edit`
- **Fabric Sourcing Strategy:** Click "Select Sourcing" button on any fabric row
- **Cost Comparison:** Automatically shown below fabric table when fabrics have IDs
- **Version Management:** Shown at top when editing existing cost sheet (if implemented)

## Support

For questions or issues:
1. Check backend logs: `backend/logs/`
2. Check browser console for frontend errors
3. Verify API endpoints are registered in `backend/src/routes/index.ts`
4. Ensure Prisma client is regenerated: `npx prisma generate`
