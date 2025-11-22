# Finished Fabric Stock Management - Implementation Plan

**Date Created:** November 21, 2025
**Status:** Planning Phase - Awaiting Clarifications
**Goal:** Build comprehensive finished fabric stock management that mirrors greige stock implementation

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Pending Clarification Questions](#pending-clarification-questions)
4. [Key Requirements & Constraints](#key-requirements--constraints)
5. [Data Model & Relationships](#data-model--relationships)
6. [Implementation Phases](#implementation-phases)
7. [Technical Details from Research](#technical-details-from-research)

---

## Executive Summary

We are building a finished fabric stock management system that mirrors the successful greige stock implementation. The system will include:

- **Finished Fabric Master** - Master data for all finished fabrics
- **Fabric Stock Entry** - Add finished fabric stock to inventory
- **Fabric Stock View** - View available finished fabric stock
- **Bulk Import/Export** - Excel-based bulk operations
- **Seamless Integration** - Links to Style, Greige, and Stock modules

### Key Design Principles
1. Mirror the greige stock implementation patterns
2. Auto-generate codes and names where possible
3. Link Greige → Finished Fabric → Style → Stock
4. Support value-added processes (embroidery, special finishes)
5. Handle multiple fabrics per style with multiple components

---

## Current Implementation Status

### ✅ What EXISTS

**Frontend:**
- `FabricList.tsx` - Full CRUD list view with pagination, search, filtering
- `FabricForm.tsx` - Create/edit fabric master with greige selection, finish details
- Navigation in sidebar (Masters section)
- Routes for list, create, edit
- Type definitions in `fabric-greige.types.ts`
- Service layer (`fabricGreigeService`)

**Backend:**
- Full CRUD API for `fabric_master` table
- `fabric_stock` controller with advanced features (aging, valuation, allocation)
- `fabric_stock` service with stock management logic
- `fabric_procurement` tracking
- Weighted average costing system
- Multi-supplier support via `fabric_suppliers` junction table

**Database Schema:**
- `fabric_master` table - Finished fabric specifications
- `fabric_stock` table - Unified stock for greige AND finished fabrics
- `fabric_procurement` table - Purchase tracking
- `fabric_stock_allocation` table - Order allocation tracking
- `fabric_width_cad` table - CAD width management
- `greige_master` table - Raw fabric specifications
- `style_fabrics` table - Links fabrics to styles
- `style_components` table - Style component definitions

### ❌ What's MISSING

**Frontend Pages (to be built):**
- `FabricDetail.tsx` - Comprehensive detail view
- `FabricStockEntry.tsx` - Stock entry form
- `FabricAvailableStock.tsx` - Stock view/dashboard
- `FabricBulkImport.tsx` - Excel bulk import

**Frontend Routes (to add):**
- `/fabric/:id` - Fabric detail route
- `/fabric/bulk-import` - Bulk import route
- `/fabric-stock-entry` - Stock entry route
- `/fabric-stock` - Stock view route

**Navigation Updates:**
- Add "— Finished Fabric Stock —" section in Inventory
- Add menu items for stock entry and stock view

**Backend Enhancements:**
- Bulk import endpoint for fabric_master
- Export endpoint for fabric_master
- Dedicated finished fabric stock entry endpoint (optional)

---

## Pending Clarification Questions

### 🔴 CRITICAL - Must Answer Before Implementation

#### Q1: Finished Fabric Naming Convention

**Context:** Need to define how fabric names are auto-generated.

**Question:** What should the auto-generated Finished Fabric Name format be?

**Options:**
- **Option A:** `{Greige Name} - {Color Name}`
  - Example: "Cambric 40×40 / 92×88 / 63" - Navy Blue"

- **Option B:** `{Greige Name} - {Finish Type}`
  - Example: "Cambric 40×40 / 92×88 / 63" - Dyed"

- **Option C:** `{Greige Name} - {Color Name} {Finish Type}`
  - Example: "Cambric 40×40 / 92×88 / 63" - Navy Blue Dyed"

- **Option D:** Custom format with value addition
  - Example: "Cambric 40×40 / 92×88 / 63" - Navy Blue Dyed + Embroidery"

- **Option E:** Something else?

**Related Sub-Questions:**
- Should component type be included? (e.g., "... - BODY" or "... - SLEEVE")
- How do we differentiate base fabric from value-added fabric?
  - Same greige → Navy Dyed vs Navy Dyed + Embroidery
- Should value addition be a separate field in the name?

**User Notes:**
- Style can have multiple fabrics
- Some fabrics have value addition (embroidery)
- Example: "Shentun dyed" vs "Shentun dyed + embroidery"

#### Q2: Finished Fabric Code Auto-Generation

**Question:** Should Fabric Code be auto-generated? If yes, what format?

**Options:**
- **Option A:** Sequential - `FAB-0001`, `FAB-0002`, `FAB-0003`...
- **Option B:** Based on Greige Code - `GRG-0012-FAB-001`, `GRG-0012-FAB-002`
- **Option C:** Include date - `FAB-20251121-001`
- **Option D:** Custom prefix for value-added - `FAB-0001`, `FAB-0001-EMB`

**Follow-up:**
- If based on greige code, how to handle multiple finishes from same greige?
- How to track value-added vs base fabric in the code?

#### Q3: Cutable Width - Manual or Calculated?

**Context:** You added "Cutable Width" as a new required field.

**Question:** Should Cutable Width be:

**Option A: Manual Entry**
- User enters the value
- Allows for custom adjustments per fabric

**Option B: Auto-Calculated**
- Formula: `Cutable Width = Actual Width - (Actual Width × Greige Shrinkage%)`
- Read-only field, calculated automatically

**Option C: Hybrid**
- Auto-calculated as default
- User can override if needed
- Show formula/calculation for transparency

**Which approach do you prefer?**

#### Q4: Value Addition Handling

**Context:** Fabrics can have value addition like embroidery.

**Question:** How should we structure value addition?

**Option A: Separate Field in fabric_master**
```
- Base Fabric: Navy Blue Dyed (FAB-0001)
- Value Addition: Embroidery
- Display Name: "Cambric Navy Blue Dyed + Embroidery"
```

**Option B: Separate Fabric Records**
```
- Fabric 1: Navy Blue Dyed (FAB-0001)
- Fabric 2: Navy Blue Dyed + Embroidery (FAB-0002)
  - Links to FAB-0001 as "base fabric"
```

**Option C: Value Addition Master Table**
```
- fabric_value_additions table
- Links: fabric_id → value_addition_id
- Types: Embroidery, Printing, Special Wash, etc.
```

**Follow-up Questions:**
- Can one fabric have multiple value additions?
- Does value addition affect cost, width, or other specs?
- Should we track value addition separately in procurement?

#### Q5: Style-Fabric-Component Relationships

**Context:** Style has multiple components, each can use different fabrics.

**Question:** When a style uses multiple fabrics across multiple components, how do we name/track them?

**Current Schema Understanding:**
```
styles (garment: shirt, dress, etc.)
  ↓
style_components (BODY, SLEEVE, COLLAR, etc.)
  ↓
style_fabrics (fabric assignments per component)
  ↓
fabric_master (finished fabrics)
  ↓
greige_master (raw fabrics)
```

**Scenarios to Clarify:**

**Scenario A:** Same fabric, different components
- Style: Men's Shirt
- BODY: Navy Blue Dyed Cambric (FAB-0001)
- SLEEVE: Navy Blue Dyed Cambric (FAB-0001) - Same fabric
- COLLAR: White Dyed Cambric (FAB-0002) - Different fabric

**Scenario B:** Same greige, different finishes
- Style: Women's Dress
- BODY: Red Dyed Poplin (FAB-0010)
- SLEEVE: Red Dyed Poplin + Embroidery (FAB-0011) - Value-added
- Both from same greige: GRG-0005

**Question:**
- Should fabric naming include component context?
- Or keep fabric names generic and assign to components separately?
- How to display this in stock entry/view?

#### Q6: Bulk Import Template Final Structure

**Based on your feedback, proposed columns:**

**Required Columns:**
1. Greige Code (Required - Lookup/Dropdown)
2. Greige Name (Auto-filled from Greige Code, read-only in preview)
3. Finish Type (Required - Dyed/Printed/Yarn Dyed)
4. Actual Width (Required - inches)
5. Cutable Width (Required - inches, manual or calculated?)

**Optional Columns:**
6. Color Name (Optional)
7. Color Code (Optional - Pantone)
8. Print Design (Optional - for Printed fabrics)
9. Actual GSM (Optional)
10. Value Addition (Optional - new field)
11. Description (Optional)
12. Notes (Optional)
13. Suppliers (Optional - comma-separated codes)
14. Is Active (TRUE/FALSE - default TRUE)

**Auto-Generated Fields:**
- Fabric Code (FAB-XXXX or custom format)
- Fabric Name (based on naming convention from Q1)

**Removed Fields (as per your request):**
- ❌ Finish Process (removed)
- ❌ Actual Shrinkage % (removed - this is greige property)

**Question:** Is this template structure correct? Any additions/changes?

#### Q7: Stock Entry Display Details

**Question:** In Fabric Stock Entry form, what information should we display?

**Option A: Finished Fabric Details Only**
- Fabric Code, Name
- Color, Finish Type
- Actual Width, Cutable Width
- Value Addition

**Option B: Greige Details Only**
- Greige Code, Name
- Composition, Yarn Count, Construction
- Greige Width

**Option C: Both Finished + Greige**
- Show finished fabric details prominently
- Show greige base info in collapsible section
- Include: composition, yarn count, construction, shrinkage

**Recommendation:** Option C for complete context

---

## Key Requirements & Constraints

### User-Specified Requirements

1. ✅ **Greige Linkage:** Both Greige Code AND Greige Name must be linked
2. ✅ **Optional Color Name:** Color name is optional (not required)
3. ✅ **Remove Finish Process:** This field should not exist
4. ✅ **Add Cutable Width:** New required field for usable width
5. ✅ **Remove Shrinkage:** Actual shrinkage is greige property, not fabric
6. ✅ **Value Addition Support:** Handle embroidery and special processes
7. ✅ **Style Integration:** All fabrics linked to styles
8. ✅ **Multiple Fabrics per Style:** One style can use many fabrics
9. ✅ **Multiple Components:** Each component can have different fabrics

### Technical Constraints

1. **Unified Stock Table:** Use existing `fabric_stock` table for both greige and finished fabrics
2. **Foreign Key Integrity:** Finished fabrics must reference valid `fabric_master.id`
3. **Auto-Generation:** Codes and names should be auto-generated where possible
4. **Read-Only Width:** Width in stock entry should be auto-filled and read-only
5. **Quality Grades:** Support A, B, DEFECT grades in stock management
6. **Aging Tracking:** Track stock age and alert for old inventory (>180 days)
7. **Weighted Average Costing:** Maintain cost calculations across stock entries

---

## Data Model & Relationships

### Current Database Schema

#### greige_master (Raw Fabric)
```sql
- id (PK)
- greigeCode (UNIQUE) - e.g., "GRG-0012"
- greigeName - e.g., "Cambric 40×40 / 92×88 / 63""
- yarnCount - e.g., "40×40"
- construction - e.g., "92×88"
- composition - e.g., "100% Cotton"
- weaveType - e.g., "Plain"
- greigeWidth (Decimal) - e.g., 63 inches
- expectedFinishedWidthMin (Decimal)
- expectedFinishedWidthMax (Decimal)
- averageShrinkagePercent (Decimal) - e.g., 8%
- gsmRange
- description, notes
- isActive
- createdById, createdAt, updatedAt
```

**Relationships:**
- One-to-Many with `fabric_master` (one greige → many finished fabrics)
- Many-to-Many with `suppliers` via `greige_suppliers`

#### fabric_master (Finished Fabric)
```sql
- id (PK)
- fabricCode (UNIQUE) - e.g., "FAB-0001"
- fabricName - e.g., "Cambric Navy Blue Dyed"
- greigeId (FK → greige_master) - REQUIRED

-- Finishing Details
- colorName - e.g., "Navy Blue" (OPTIONAL per user)
- colorCode - e.g., "Pantone 19-4052" (OPTIONAL)
- finishType - e.g., "Dyed", "Printed", "Yarn Dyed" (REQUIRED)
- finishProcess - REMOVE THIS FIELD
- printDesign - e.g., "Floral Pattern" (OPTIONAL)

-- Specifications
- actualWidth (Decimal) - REQUIRED - Finished width in inches
- cutableWidth (Decimal) - NEW FIELD - REQUIRED - Usable width
- actualGSM (Int) - OPTIONAL
- actualShrinkage - REMOVE THIS FIELD

-- Value Addition (NEW - to be added?)
- valueAddition - e.g., "Embroidery", "Special Wash" (OPTIONAL)
- valueAdditionCost (Decimal) - Cost of value addition

-- Additional Info
- description, notes, imageUrl
- styleReference (for style-specific fabrics)
- isGeneric (Boolean) - Can be used across styles
- componentType - e.g., "BODY", "SLEEVE", "COLLAR"
- isActive
- createdById, createdAt, updatedAt
```

**Relationships:**
- Many-to-One with `greige_master` (many fabrics → one greige)
- Many-to-Many with `suppliers` via `fabric_suppliers`
- One-to-Many with `fabric_width_cad` (CAD measurements)
- One-to-Many with `fabric_stock` (stock records)
- Many-to-Many with `styles` via `style_fabrics`

#### fabric_stock (Unified Stock - Greige + Finished)
```sql
- id (PK)
- fabricId (FK → fabric_master) - REQUIRED
- width (Decimal)
- quantityAvailable (Decimal)
- quantityReserved (Decimal)
- quantityConsumed (Decimal)
- unit (default: "meters")
- procurementId (FK → fabric_procurement)
- originStyleId (FK → styles) - NULL for generic stock
- originOrderId (FK → orders)
- status - "AVAILABLE", "RESERVED", "DEPLETED", "QUARANTINED"
- stockType - "EXCESS", "PLANNED_STOCK", "GENERIC", "RETURNED", "VARIANCE_UNUSED"
- weightedAvgCost (Decimal)
- purchaseCost (Decimal)
- qualityGrade - "A", "B", "DEFECT"
- defectValue (Decimal)
- rollNumbers (Text) - Comma-separated
- warehouseLocation
- rackNumber
- receivedDate
- agingDays (Int) - Auto-calculated
- agingAlertSent (Boolean)
- createdById, createdAt, updatedAt
```

**Key Insight:** This table is used for BOTH greige (via virtual fabric_master) AND finished fabrics (direct fabric_master reference)

#### style_fabrics (Links Fabrics to Styles)
```sql
- id (PK)
- styleId (FK → styles)
- componentId (FK → style_components)
- fabricId (FK → fabric_master)
- quantityNeeded (Decimal) - Meters per garment
- cadWidthId (FK → fabric_width_cad) - Specific CAD width
- notes
```

**This is how fabrics connect to styles!**

### Data Flow Diagram

```
┌─────────────────┐
│  greige_master  │ (Raw Fabric)
│  GRG-0012       │
└────────┬────────┘
         │ greigeId
         │ (One-to-Many)
         ↓
┌─────────────────────────────┐
│     fabric_master           │ (Finished Fabric)
│  FAB-0001: Navy Dyed        │
│  FAB-0002: Navy + Emb       │
│  FAB-0003: Red Dyed         │
└────────┬────────────────────┘
         │ fabricId
         ├────────────┬────────────┐
         │            │            │
         ↓            ↓            ↓
┌──────────────┐  ┌──────────┐  ┌──────────────┐
│ fabric_stock │  │  style   │  │ fabric_      │
│ (Inventory)  │  │ _fabrics │  │ procurement  │
└──────────────┘  └────┬─────┘  └──────────────┘
                       │
                       ↓
                ┌──────────────┐
                │    styles    │
                │  (Garments)  │
                └──────────────┘
```

### Example Data Flow

**Scenario: Men's Shirt with Multiple Fabrics**

```
1. Greige Master:
   - GRG-0012: Cambric 40×40 / 92×88 / 63" (100% Cotton)

2. Finished Fabrics (from same greige):
   - FAB-0100: Cambric Navy Blue Dyed
   - FAB-0101: Cambric Navy Blue Dyed + Embroidery
   - FAB-0102: Cambric White Dyed

3. Style: STY-001 (Men's Formal Shirt)
   - Component: BODY → Uses FAB-0100 (Navy Blue)
   - Component: SLEEVE → Uses FAB-0101 (Navy + Embroidery)
   - Component: COLLAR → Uses FAB-0102 (White)

4. Stock Entries:
   - STOCK-001: 1000m of FAB-0100, Quality A, Warehouse-A
   - STOCK-002: 500m of FAB-0101, Quality A, Warehouse-A
   - STOCK-003: 200m of FAB-0102, Quality B, Warehouse-B

5. Procurement:
   - PROC-001: Purchased 1000m FAB-0100 from Supplier-XYZ
   - PROC-002: Purchased 500m FAB-0101 (with embroidery charge)
```

---

## Implementation Phases

### Phase 1: Field Updates & Schema Changes (1-2 hours)

**Update fabric_master Schema:**
1. Add `cutableWidth` field (Decimal, required)
2. Add `valueAddition` field (String, optional) - if needed
3. Add `valueAdditionCost` field (Decimal, optional) - if needed
4. Remove `finishProcess` field (if exists)
5. Remove `actualShrinkage` field (if exists)
6. Make `colorName` optional (already is?)

**Database Migration:**
```sql
ALTER TABLE fabric_master
ADD COLUMN cutableWidth DECIMAL(10,2),
ADD COLUMN valueAddition VARCHAR(255),
ADD COLUMN valueAdditionCost DECIMAL(10,2);

-- Set default cutableWidth for existing records
UPDATE fabric_master
SET cutableWidth = actualWidth * 0.95  -- Example: 95% of actual width
WHERE cutableWidth IS NULL;
```

### Phase 2: Fabric Stock Entry Page (4-6 hours)

**Create: `frontend/src/pages/FabricStockEntry.tsx`**

**Features:**
- Select finished fabric from dropdown (active only)
- Display fabric details panel:
  - Fabric Code, Name
  - Greige Base: Code, Name (clickable link)
  - Color, Finish Type, Value Addition
  - Actual Width (show), Cutable Width (show)
  - Composition, Yarn Count, Construction (from greige)
- Stock entry form:
  - Quantity (meters) - required
  - Width (inches) - auto-filled from actualWidth, read-only
  - Purchase cost per meter
  - Received date (default: today)
  - Warehouse location
  - Roll numbers (comma-separated)
  - Quality grade: A/B/DEFECT (default: A)
- Real-time total stock value calculation
- Submit to create fabric_stock + fabric_procurement

**Route:** `/fabric-stock-entry`

### Phase 3: Fabric Stock View Page (6-8 hours)

**Create: `frontend/src/pages/FabricAvailableStock.tsx`**

**Features:**
- Summary Dashboard (4 cards):
  - Total stock items
  - Total meters
  - Total value
  - Aged stock count (>180 days)
- Filters:
  - Search: fabric code, name, color
  - Show aged only checkbox
  - Filter by quality grade
  - Filter by warehouse
  - Filter by value addition
- Data table columns:
  - Fabric Code (link to detail)
  - Fabric Name
  - Color
  - Greige Base (link to greige)
  - Value Addition badge
  - Quantity (meters)
  - Width / Cutable Width
  - Value
  - Quality Grade badge
  - Location
  - Age badge (Fresh/Aging/Old)
  - Received Date
- Export to Excel

**Route:** `/fabric-stock`

### Phase 4: Fabric Detail Page (8-10 hours)

**Create: `frontend/src/pages/FabricDetail.tsx`**

**Sections:**
1. **Header:** Fabric Code, Name, Active status
2. **Greige Base:** Link to greige, full specs
3. **Finishing Details:** Color, finish type, value addition
4. **Specifications:** Actual width, cutable width, GSM
5. **Suppliers:** List with preferred indicator
6. **CAD Widths:** Table of measurements
7. **Current Stock:** Summary + breakdown by warehouse/grade
8. **Procurement History:** Recent purchases
9. **Usage in Styles:** Which styles/components use this fabric

**Actions:**
- Edit, Delete, Add Stock, View Stock

**Route:** `/fabric/:id`

### Phase 5: Bulk Import/Export (10-12 hours)

**Create: `frontend/src/pages/FabricBulkImport.tsx`**

**Features:**
- Download Excel template with sample data
- Upload Excel file
- Preview data in table (with validation warnings)
- Auto-generate Fabric Code and Name
- Bulk process with progress tracking
- Success/failure report per row

**Backend Endpoints:**
- POST `/api/fabric-management/fabric/bulk-import`
- GET `/api/fabric-management/fabric/export`

**Excel Template (after Q&A):**
- Columns based on answers to Q6
- Auto-generation based on answers to Q1 and Q2

### Phase 6: Navigation & Polish (2-3 hours)

**Updates:**
1. Add routes to `App.tsx`
2. Update `Sidebar.tsx` with new menu items
3. Add action buttons to `FabricList.tsx`
4. Link fabric detail from all relevant pages
5. Breadcrumb navigation
6. Success/error toasts

---

## Technical Details from Research

### Existing Backend APIs (Can Reuse)

**fabric_stock Controller (`/api/stock`):**
- ✅ GET `/` - List stock with filters (status, fabricId, warehouse, quality)
- ✅ GET `/dashboard` - Stock analytics
- ✅ GET `/aging` - Aging stock report
- ✅ GET `/valuation` - Stock valuation
- ✅ GET `/:id` - Stock details
- ✅ POST `/transfer` - Transfer between warehouses
- ✅ POST `/adjust` - Stock adjustments

**fabric Controller (`/api/fabric-management/fabric`):**
- ✅ GET `/` - List fabrics with pagination/filters
- ✅ GET `/:id` - Get fabric details
- ✅ POST `/` - Create fabric
- ✅ PUT `/:id` - Update fabric
- ✅ DELETE `/:id` - Delete fabric

**TO ADD:**
- POST `/api/fabric-management/fabric/bulk-import`
- GET `/api/fabric-management/fabric/export`
- POST `/api/fabric-management/fabric/stock-entry` (optional - can reuse generic stock API)

### Frontend Patterns to Follow

**From Greige Implementation:**

1. **Layout Pattern:**
```tsx
<PageHeader title="..." breadcrumb={...}>
  <div className="flex gap-2">
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </div>
</PageHeader>

<div className="space-y-6">
  {/* Detail panels */}
  <Card>...</Card>
  {/* Form sections */}
  <Card>...</Card>
</div>
```

2. **Form Pattern:**
```tsx
const [formData, setFormData] = useState({...});
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);

const handleSave = async () => {
  // Validation
  // API call
  // Success handling
};
```

3. **Filter Pattern:**
```tsx
const [searchTerm, setSearchTerm] = useState('');
const [filters, setFilters] = useState({...});
const [filteredData, setFilteredData] = useState([]);

useEffect(() => {
  applyFilters();
}, [searchTerm, filters, rawData]);
```

### Component Library (shadcn/ui)

**Use these components:**
- `Button` - Actions
- `Input` - Form fields
- `Select` - Dropdowns
- `Label` - Form labels
- `Card` - Content sections
- `Badge` - Status indicators
- `Table` - Data tables
- `Alert` - Error/success messages
- `Dialog` - Confirmations

---

## Next Steps

### Before Next Session

**USER ACTION REQUIRED:**

Please answer the 7 critical questions above (Q1-Q7) so we can:
1. Finalize the naming convention for finished fabrics
2. Determine code generation format
3. Decide cutable width calculation
4. Design value addition structure
5. Clarify style-fabric-component relationships
6. Lock down the bulk import template
7. Define stock entry display requirements

### During Next Session

Once questions are answered, we will:
1. Update this document with decisions
2. Create detailed technical specifications
3. Begin implementation in order of phases
4. Test each phase before moving to next

---

## Appendix: File Locations

### Frontend Files

**Existing:**
- `frontend/src/pages/FabricList.tsx` (358 lines)
- `frontend/src/pages/FabricForm.tsx` (541 lines)
- `frontend/src/types/fabric-greige.types.ts`
- `frontend/src/services/fabricGreigeService.ts`

**To Create:**
- `frontend/src/pages/FabricDetail.tsx`
- `frontend/src/pages/FabricStockEntry.tsx`
- `frontend/src/pages/FabricAvailableStock.tsx`
- `frontend/src/pages/FabricBulkImport.tsx`

**To Modify:**
- `frontend/src/App.tsx` (add 4 routes)
- `frontend/src/components/Sidebar.tsx` (add menu items)
- `frontend/src/pages/FabricList.tsx` (add action buttons)

### Backend Files

**Existing:**
- `backend/src/controllers/fabric.controller.ts`
- `backend/src/controllers/fabric-stock.controller.ts`
- `backend/src/services/fabric-stock.service.ts`
- `backend/src/routes/fabric-greige.routes.ts`
- `backend/src/routes/fabric-stock.routes.ts`
- `backend/prisma/schema.prisma`

**To Modify:**
- `backend/src/controllers/fabric.controller.ts` (add bulk import/export)
- `backend/src/routes/fabric-greige.routes.ts` (add new routes)
- `backend/prisma/schema.prisma` (add cutableWidth, valueAddition fields)

---

**END OF DOCUMENT**

*This document will be updated after Q&A session with final decisions and detailed specifications.*