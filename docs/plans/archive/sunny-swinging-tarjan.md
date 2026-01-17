# Stock Display System Improvements Plan

## Current State Analysis

### Two Parallel Inventory Systems Exist:

#### 1. **Warehouse-Based Generic Inventory System**
- **Purpose**: General inventory management for ALL material types
- **Pages**: Inventory Dashboard, Stock Levels, Stock Counts, Stock IN/OUT/Transfer/Adjustment
- **Materials Supported**: Threads, Buttons, Zippers, Labels, Elastic, Lace, Packaging, Machine Parts, Other Materials
- **Database**: `materials`, `stock_levels`, `stock_movements`, `stock_transactions`, `warehouses`
- **Features**: Weighted average costing, reorder level tracking, warehouse-based tracking

#### 2. **Fabric-Specific Stock System**
- **Purpose**: Specialized garment manufacturing workflow
- **Pages**: Fabric Stock Entry/View, Greige Stock Entry/View, Embroidery Stock, Style Stock Entry
- **Materials Supported**: Finished Fabrics, Greige Fabrics, Embroidered Fabrics
- **Database**: `fabric_stock`, `fabric_stock_transaction`, `greige_stock`
- **Features**: Quality grading (A/B/DEFECT), aging analysis, CAD variance tracking, width tracking, style/order allocation, cross-style usage

### Current Issues Identified:
1. **Confusion**: Multiple stock pages with unclear purposes and overlap
2. **Disconnected Systems**: Fabric stock doesn't appear in Stock Levels/Inventory Dashboard
3. **Navigation**: Unclear when to use which page
4. **Material Type Separation**: Trims use warehouse system, fabrics use dedicated system

## User Requirements:
✅ **Confirmed Decisions:**
1. Keep Fabric Stock and Greige Stock as dedicated pages with their specialized features
2. Add "View Stock" buttons to each trim/accessory master page (Thread, Button, Zipper, etc.)
3. Unified Inventory Dashboard showing ALL materials (fabric + greige + trims) with summaries

## Recommended Approach: Unified Dashboard with Material-Specific Navigation

### Core Strategy:
Create a **unified inventory overview** while preserving specialized workflows for different material types.

### Three-Tier Information Architecture:

**Tier 1: Unified Dashboard (Central Hub)**
- Location: `/inventory/dashboard` (enhanced StockDashboard.tsx)
- Shows: Combined metrics + summaries for all material types
- Quick links to detailed pages

**Tier 2: Detailed Stock Views**
- Fabric: `/fabric-stock` (existing FabricAvailableStock.tsx)
- Greige: `/greige-stock` (existing GreigeAvailableStock.tsx)
- Trims: `/inventory/stock-levels?materialType=X` (enhanced StockLevelList.tsx)

**Tier 3: Master Data with Stock Links**
- Thread, Button, Zipper, etc. master pages get "View Stock" buttons
- Clicking navigates to Stock Levels filtered by that material type

---

## Implementation Plan

### Phase 1: Backend API Enhancements

#### 1.1 Fabric Stock Summary Endpoint
**File:** [fabric-stock.controller.ts](backend/src/controllers/fabric-stock.controller.ts)
- Add `getFabricStockSummary()` function
- Returns: totalMeters, totalValue, agingCount, qualityGrade breakdown, warehouse breakdown

**File:** [fabric-stock.routes.ts](backend/src/routes/fabric-stock.routes.ts)
- Add route: `GET /api/stock/summary`

#### 1.2 Greige Stock Summary Endpoint
**File:** Create [greige-stock.controller.ts](backend/src/controllers/greige-stock.controller.ts)
- Add `getGreigeStockSummary()` function
- Similar structure to fabric summary

**File:** [greige-stock.routes.ts](backend/src/routes/greige-stock.routes.ts)
- Add route: `GET /api/greige/summary`

#### 1.3 Stock Level Material Type Filter
**File:** [stockLevel.controller.ts](backend/src/controllers/stockLevel.controller.ts)
- Add `getStockLevelsByMaterialType(materialType)` function
- Filters stock_levels by materials.material_type

**File:** [stockLevel.routes.ts](backend/src/routes/stockLevel.routes.ts)
- Add route: `GET /api/stock-levels/by-type/:materialType`

#### 1.4 Unified Dashboard Endpoint (Optional)
**File:** Create [dashboard.controller.ts](backend/src/controllers/dashboard.controller.ts)
- Add `getInventoryDashboardSummary()` - fetches all summaries in parallel
- Returns: { fabric, greige, trims, combined }

**File:** Create [dashboard.routes.ts](backend/src/routes/dashboard.routes.ts)
- Add route: `GET /api/dashboard/inventory-summary`
- Register in main app routes

---

### Phase 2: Frontend Services & Types

#### 2.1 TypeScript Type Definitions
**File:** Create [fabricStock.types.ts](frontend/src/types/fabricStock.types.ts)
```typescript
interface FabricStockSummary {
  totalMeters: number;
  totalValue: number;
  agingStockCount: number;
  totalItems: number;
  byQualityGrade: { A: number; B: number; DEFECT: number };
  byWarehouse: WarehouseStock[];
}
```

**File:** Create [greigeStock.types.ts](frontend/src/types/greigeStock.types.ts)
- Similar structure to FabricStockSummary

**File:** Create [dashboard.types.ts](frontend/src/types/dashboard.types.ts)
```typescript
interface InventoryDashboardSummary {
  fabric: FabricStockSummary;
  greige: GreigeStockSummary;
  trims: TrimStockSummary;
  combined: CombinedMetrics;
}
```

#### 2.2 Service Layer
**File:** Create [fabricStock.service.ts](frontend/src/services/fabricStock.service.ts)
- `getSummary()` method

**File:** Create [greigeStock.service.ts](frontend/src/services/greigeStock.service.ts)
- `getSummary()` method

**File:** [stockLevel.service.ts](frontend/src/services/stockLevel.service.ts)
- Add `getByMaterialType(materialType)` method

**File:** Create [dashboard.service.ts](frontend/src/services/dashboard.service.ts)
- `getInventorySummary()` method (or fetch individually)

---

### Phase 3: Enhanced Inventory Dashboard UI

#### 3.1 Redesign StockDashboard Component
**File:** [StockDashboard.tsx](frontend/src/pages/StockDashboard.tsx)

**Major Changes:**
1. **Header:** Update title to "Unified Inventory Dashboard"

2. **Layout Structure:**
   - **Row 1:** Combined metrics cards (4 cards)
     - Total Inventory Value (fabric + greige + trims)
     - Total Materials
     - Low Stock Alerts (all types)
     - Active Warehouses

   - **Row 2:** Fabric Stock Section
     - Cards: Total Meters | Total Value | Aging Stock
     - Quality breakdown
     - Button: "View Fabric Stock Details →" (navigates to /fabric-stock)

   - **Row 3:** Greige Stock Section
     - Cards: Total Meters | Total Value | Aging Stock
     - Button: "View Greige Stock Details →" (navigates to /greige-stock)

   - **Row 4:** Trim & Accessories Section
     - Cards: Total Materials | Total Value | Low Stock Items
     - Material type breakdown list (Thread: X items, Button: Y items, etc.)
     - Button: "View All Stock Levels →" (navigates to /inventory/stock-levels)

   - **Row 5:** Combined Low Stock Alerts Table
     - Shows fabric aging stock + greige aging stock + trim low stock
     - Columns: Type | Item Code | Item Name | Quantity | Alert Reason

   - **Row 6:** Quick Actions (existing functionality)
     - Stock IN, Stock OUT, Transfer, Stock Count buttons

3. **Data Fetching:**
```typescript
useEffect(() => {
  Promise.all([
    fabricStockService.getSummary(),
    greigeStockService.getSummary(),
    stockLevelService.getAll(), // or summary endpoint
  ]).then(([fabric, greige, trims]) => {
    setFabricSummary(fabric);
    setGreigeSummary(greige);
    setTrimSummary(calculateTrimSummary(trims));
    setCombinedMetrics(calculateCombined(fabric, greige, trims));
  });
}, []);
```

4. **Styling:**
   - Use color coding: Blue for Fabric, Green for Greige, Orange for Trims
   - Icons: Layers (Fabric), Box (Greige), Package (Trims)
   - Responsive grid layout

---

### Phase 4: Add "View Stock" Buttons to Material Master Pages

#### 4.1 Create Reusable Component
**File:** Create [ViewStockButton.tsx](frontend/src/components/ViewStockButton.tsx)
```typescript
interface ViewStockButtonProps {
  materialType: string;
  stockCount?: number;
}

function ViewStockButton({ materialType, stockCount }) {
  const navigate = useNavigate();
  return (
    <Button onClick={() => navigate(`/inventory/stock-levels?materialType=${materialType}`)}>
      View Stock {stockCount && <Badge>{stockCount}</Badge>}
    </Button>
  );
}
```

#### 4.2 Modify All Material Master List Pages
**Files to modify (9 files):**
- [ThreadList.tsx](frontend/src/pages/ThreadList.tsx)
- [ButtonList.tsx](frontend/src/pages/ButtonList.tsx)
- [ZipperList.tsx](frontend/src/pages/ZipperList.tsx)
- [ElasticList.tsx](frontend/src/pages/ElasticList.tsx)
- [LaceList.tsx](frontend/src/pages/LaceList.tsx)
- [LabelList.tsx](frontend/src/pages/LabelList.tsx)
- [PackagingList.tsx](frontend/src/pages/PackagingList.tsx)
- [MachinePartList.tsx](frontend/src/pages/MachinePartList.tsx)
- [OtherMaterialList.tsx](frontend/src/pages/OtherMaterialList.tsx)

**Changes for each file:**
1. Import ViewStockButton component
2. Add state: `const [stockCount, setStockCount] = useState(0)`
3. Fetch stock count on mount using `stockLevelService.getByMaterialType()`
4. Add button to CardHeader actions:
```typescript
<CardHeader>
  <div className="flex justify-between">
    <CardTitle>Thread Management</CardTitle>
    <div className="flex gap-2">
      <ViewStockButton materialType="THREAD" stockCount={stockCount} />
      <ExportButton ... />
      <ImportButton ... />
      <Button>+ Add New Thread</Button>
    </div>
  </div>
</CardHeader>
```

---

### Phase 5: Enhanced Stock Levels Page

#### 5.1 Modify StockLevelList Component
**File:** [StockLevelList.tsx](frontend/src/pages/StockLevelList.tsx)

**Major Changes:**

1. **Add URL Parameter Support:**
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const initialMaterialType = searchParams.get('materialType') || '';
const [materialTypeFilter, setMaterialTypeFilter] = useState(initialMaterialType);
```

2. **Add Material Type Filter Dropdown:**
```typescript
<Select
  value={materialTypeFilter}
  onValueChange={(value) => {
    setMaterialTypeFilter(value);
    setSearchParams(value ? { materialType: value } : {});
  }}
>
  <SelectItem value="">All Material Types</SelectItem>
  <SelectItem value="THREAD">Thread</SelectItem>
  <SelectItem value="BUTTON">Button</SelectItem>
  <SelectItem value="ZIPPER">Zipper</SelectItem>
  {/* ... other types */}
</Select>
```

3. **Update Data Fetching:**
```typescript
useEffect(() => {
  if (materialTypeFilter) {
    stockLevelService.getByMaterialType(materialTypeFilter).then(setStockLevels);
  } else {
    stockLevelService.getAll().then(setStockLevels);
  }
}, [materialTypeFilter, warehouseFilter, searchTerm]);
```

4. **Add Filtered State Indicator:**
```typescript
{materialTypeFilter && (
  <Alert>
    Showing stock for: <Badge>{formatMaterialType(materialTypeFilter)}</Badge>
    <Button size="sm" onClick={() => {
      setMaterialTypeFilter('');
      setSearchParams({});
    }}>Clear filter</Button>
  </Alert>
)}
```

5. **Add Material Type Column to Table:**
```typescript
{
  key: 'materialType',
  header: 'Type',
  render: (stock) => <Badge>{formatMaterialType(stock.materials?.materialType)}</Badge>
}
```

---

### Phase 6: Utility Functions

**File:** [formatters.ts](frontend/src/lib/formatters.ts)
```typescript
export function formatMaterialType(type: string): string {
  const mapping = {
    'THREAD': 'Thread',
    'BUTTON': 'Button',
    'ZIPPER': 'Zipper',
    'ELASTIC': 'Elastic',
    'LACE': 'Lace',
    'LABEL': 'Label',
    'PACKAGING': 'Packaging',
    'MACHINE_PART': 'Machine Parts',
    'OTHER': 'Other Materials'
  };
  return mapping[type] || type;
}
```

---

### Phase 7: Navigation & Page Clarity

#### 7.1 Update Page Titles/Descriptions
- **StockDashboard:** "Unified Inventory Dashboard - All Materials Overview"
- **StockLevelList:** "Stock Levels - Trim & Accessories Inventory"
- **FabricAvailableStock:** "Finished Fabric Stock"
- **GreigeAvailableStock:** "Generic Greige Stock"

#### 7.2 Navigation Flow Diagram
```
Inventory Dashboard (Central Hub)
├─→ Click "View Fabric Stock" → FabricAvailableStock
├─→ Click "View Greige Stock" → GreigeAvailableStock
└─→ Click "View All Stock Levels" → StockLevelList

Material Master Pages (Thread, Button, etc.)
└─→ Click "View Stock" → StockLevelList?materialType=X

StockLevelList
└─→ Clear filter → Shows all trim/accessory stock
```

---

## Critical Files Summary

### Backend (7 files)
1. [fabric-stock.controller.ts](backend/src/controllers/fabric-stock.controller.ts) - Add summary endpoint
2. [fabric-stock.routes.ts](backend/src/routes/fabric-stock.routes.ts) - Register summary route
3. [greige-stock.controller.ts](backend/src/controllers/greige-stock.controller.ts) - New file, summary endpoint
4. [greige-stock.routes.ts](backend/src/routes/greige-stock.routes.ts) - Add summary route
5. [stockLevel.controller.ts](backend/src/controllers/stockLevel.controller.ts) - Add material type filter
6. [stockLevel.routes.ts](backend/src/routes/stockLevel.routes.ts) - Register filter route
7. [dashboard.controller.ts](backend/src/controllers/dashboard.controller.ts) - Optional unified endpoint

### Frontend Services/Types (5 files)
1. [fabricStock.types.ts](frontend/src/types/fabricStock.types.ts) - New type definitions
2. [greigeStock.types.ts](frontend/src/types/greigeStock.types.ts) - New type definitions
3. [dashboard.types.ts](frontend/src/types/dashboard.types.ts) - New type definitions
4. [fabricStock.service.ts](frontend/src/services/fabricStock.service.ts) - New service
5. [greigeStock.service.ts](frontend/src/services/greigeStock.service.ts) - New service

### Frontend Components (12 files)
1. [StockDashboard.tsx](frontend/src/pages/StockDashboard.tsx) - **Major redesign**
2. [StockLevelList.tsx](frontend/src/pages/StockLevelList.tsx) - Add material type filtering
3. [ViewStockButton.tsx](frontend/src/components/ViewStockButton.tsx) - New reusable component
4. [ThreadList.tsx](frontend/src/pages/ThreadList.tsx) - Add View Stock button
5. [ButtonList.tsx](frontend/src/pages/ButtonList.tsx) - Add View Stock button
6. [ZipperList.tsx](frontend/src/pages/ZipperList.tsx) - Add View Stock button
7. [ElasticList.tsx](frontend/src/pages/ElasticList.tsx) - Add View Stock button
8. [LaceList.tsx](frontend/src/pages/LaceList.tsx) - Add View Stock button
9. [LabelList.tsx](frontend/src/pages/LabelList.tsx) - Add View Stock button
10. [PackagingList.tsx](frontend/src/pages/PackagingList.tsx) - Add View Stock button
11. [MachinePartList.tsx](frontend/src/pages/MachinePartList.tsx) - Add View Stock button
12. [OtherMaterialList.tsx](frontend/src/pages/OtherMaterialList.tsx) - Add View Stock button

### Utilities (1 file)
1. [formatters.ts](frontend/src/lib/formatters.ts) - Add formatMaterialType function

---

## Key Database Queries

### Fabric Stock Summary
```sql
SELECT
  COUNT(*) as total_items,
  SUM(quantity_available) as total_meters,
  SUM(quantity_available * weighted_avg_cost) as total_value,
  COUNT(CASE WHEN aging_days > 180 THEN 1 END) as aging_stock_count,
  quality_grade,
  SUM(quantity_available) as grade_meters
FROM fabric_stock
WHERE status IN ('AVAILABLE', 'RESERVED')
GROUP BY quality_grade;
```

### Stock Levels by Material Type
```sql
SELECT
  sl.*,
  m.code as material_code,
  m.name as material_name,
  m.material_type,
  w.warehouse_code,
  w.warehouse_name
FROM stock_levels sl
JOIN materials m ON sl.material_id = m.id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE m.material_type = $1
ORDER BY sl.quantity ASC;
```

### Combined Low Stock Alerts
```sql
-- Fabric aging stock
SELECT 'FABRIC' as type, fabric_code, fabric_name, quantity_available, aging_days
FROM fabric_stock fs
JOIN fabric_master fm ON fs.fabric_id = fm.id
WHERE aging_days > 180

UNION ALL

-- Trim below reorder
SELECT 'TRIM' as type, m.code, m.name, sl.quantity, NULL
FROM stock_levels sl
JOIN materials m ON sl.material_id = m.id
WHERE sl.quantity <= sl.reorder_level;
```

---

## Expected Benefits

### User Experience
✅ **Single source of truth**: One dashboard shows all inventory at a glance
✅ **Clear navigation**: Each page has a well-defined purpose
✅ **Quick access**: View Stock buttons on master pages reduce clicks
✅ **Contextual filtering**: Deep linking preserves context when navigating

### Business Value
✅ **Better visibility**: See aging fabric alongside low trim stock
✅ **Faster decisions**: Combined metrics help identify priority issues
✅ **Reduced confusion**: Clear hierarchy between overview and details
✅ **Maintained specialization**: Fabric features remain intact while integrating with overall inventory

### Technical Quality
✅ **Code reuse**: ViewStockButton component used across 9 pages
✅ **URL state management**: Filters preserved in query parameters
✅ **Type safety**: Full TypeScript coverage for new features
✅ **Serializer compliance**: All API responses use camelCase as expected
