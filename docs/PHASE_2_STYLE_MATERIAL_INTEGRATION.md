# Phase 2: Style-Material Integration - Implementation Plan

**Date Started:** January 23, 2025
**Status:** In Progress
**Objective:** Integrate the 7 Material Masters (Lace, Button, Thread, Zipper, Elastic, Label, Packaging) with the Style/BOM system for accurate costing and material planning.

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Database Schema Changes](#database-schema-changes)
5. [Implementation Tasks](#implementation-tasks)
6. [API Changes](#api-changes)
7. [Frontend Changes](#frontend-changes)
8. [Testing Plan](#testing-plan)
9. [Migration Strategy](#migration-strategy)
10. [Success Criteria](#success-criteria)

---

## Overview

### Problem Statement
The current Style system uses **free-text fields** for material tracking:
- `style_garment_trims.trimName` - Free text (e.g., "Black Button 18mm")
- `style_value_additions.description` - Free text (e.g., "Embroidery with gold thread")
- `style_packaging.itemName` - Free text (e.g., "Polybag 12x18")

This creates several issues:
- ❌ No link to material master data
- ❌ Cannot track actual material costs automatically
- ❌ No inventory integration
- ❌ Duplicate data entry
- ❌ Inconsistent naming
- ❌ No material requirement planning (MRP)

### Solution
Replace free-text fields with **foreign key references** to Material Master records:
- Link to `lace_master`, `button_master`, `thread_master`, etc.
- Auto-populate specifications from master data
- Calculate costs from master prices
- Enable material requirement planning

### Business Value
- ✅ Accurate style costing
- ✅ Material requirement reports
- ✅ Inventory planning
- ✅ Price change tracking
- ✅ Supplier management
- ✅ Consistent data

---

## Current State Analysis

### Existing Tables

#### 1. `style_garment_trims` (Current Structure)
```sql
CREATE TABLE style_garment_trims (
  id TEXT PRIMARY KEY,
  styleId TEXT NOT NULL REFERENCES styles(id),
  trimName TEXT NOT NULL,           -- ❌ Free text
  trimType TEXT,                    -- ❌ Free text
  quantityPerPiece DECIMAL(10,2),
  unit TEXT,
  supplier TEXT,                    -- ❌ Free text, should FK
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**Issues:**
- No FK to material masters
- Duplicate data entry (trim details exist in both master and style)
- Cannot auto-calculate costs
- Supplier is text instead of FK

#### 2. `style_value_additions` (Current Structure)
```sql
CREATE TABLE style_value_additions (
  id TEXT PRIMARY KEY,
  styleId TEXT NOT NULL REFERENCES styles(id),
  additionType TEXT NOT NULL,       -- e.g., "Embroidery", "Printing"
  description TEXT,                 -- ❌ Free text details
  type TEXT,                        -- ❌ Redundant with additionType
  numberOfItems INTEGER,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**Issues:**
- No link to thread/lace masters for embroidery
- No cost tracking
- Cannot track which materials are used

#### 3. `style_packaging` (Current Structure)
```sql
CREATE TABLE style_packaging (
  id TEXT PRIMARY KEY,
  styleId TEXT NOT NULL REFERENCES styles(id),
  itemName TEXT NOT NULL,           -- ❌ Free text
  itemType TEXT,                    -- e.g., "polybag", "carton"
  specification TEXT,               -- ❌ Free text
  quantityPerPack INTEGER,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**Issues:**
- No FK to packaging_master or label_master
- Cannot calculate packaging costs
- Duplicate specifications

---

## Proposed Architecture

### New Unified Material BOM Table

Instead of modifying 3 separate tables, create a **unified material BOM table** that references all material types:

```sql
CREATE TABLE style_material_bom (
  id TEXT PRIMARY KEY,
  styleId TEXT NOT NULL REFERENCES styles(id),

  -- Material Reference (polymorphic via materialId)
  materialId TEXT NOT NULL REFERENCES materials(id),
  materialType TEXT NOT NULL,  -- LACE, BUTTON, THREAD, ZIPPER, ELASTIC, LABEL, PACKAGING

  -- Material-specific master IDs (for direct access)
  laceId TEXT REFERENCES lace_master(id),
  buttonId TEXT REFERENCES button_master(id),
  threadId TEXT REFERENCES thread_master(id),
  zipperId TEXT REFERENCES zipper_master(id),
  elasticId TEXT REFERENCES elastic_master(id),
  labelId TEXT REFERENCES label_master(id),
  packagingId TEXT REFERENCES packaging_master(id),

  -- Usage Details
  usageCategory TEXT NOT NULL,  -- 'GARMENT_TRIM', 'VALUE_ADDITION', 'PACKAGING'
  componentName TEXT,           -- e.g., "Front Panel", "Sleeve", "Final Pack"

  -- Quantity Specifications
  quantityPerGarment DECIMAL(10,4) NOT NULL,
  unit TEXT NOT NULL,           -- pcs, meters, grams, etc.

  -- Cost Tracking (denormalized for performance)
  unitPrice DECIMAL(10,2),      -- Snapshot from master at time of BOM creation
  totalCost DECIMAL(10,2),      -- quantityPerGarment × unitPrice

  -- Optional Details
  notes TEXT,
  sortOrder INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT true,

  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),

  -- Ensure one material type FK is set
  CONSTRAINT chk_one_material_fk CHECK (
    (laceId IS NOT NULL)::int +
    (buttonId IS NOT NULL)::int +
    (threadId IS NOT NULL)::int +
    (zipperId IS NOT NULL)::int +
    (elasticId IS NOT NULL)::int +
    (labelId IS NOT NULL)::int +
    (packagingId IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_style_material_bom_style ON style_material_bom(styleId);
CREATE INDEX idx_style_material_bom_material ON style_material_bom(materialId);
CREATE INDEX idx_style_material_bom_category ON style_material_bom(usageCategory);
```

### Architecture Benefits

1. **Single Source of Truth**: All material usage in one table
2. **Polymorphic Material Links**: Supports all 7 material types
3. **Performance**: Direct FKs to specific masters for fast joins
4. **Cost Tracking**: Denormalized prices for historical accuracy
5. **Flexibility**: Can add new material types easily
6. **Reporting**: Unified queries for material requirements

---

## Database Schema Changes

### Phase 2A: Add New Table (Non-Breaking)

**Step 1:** Create `style_material_bom` table
- New table, doesn't affect existing functionality
- Keep old tables for backward compatibility

**Step 2:** Add helper views for easy querying
```sql
-- View for garment trims only
CREATE VIEW v_style_garment_trims AS
SELECT
  smb.*,
  COALESCE(lm.laceName, bm.buttonName, tm.threadName, zm.zipperName, em.elasticName) as materialName,
  COALESCE(lm.laceCode, bm.buttonCode, tm.threadCode, zm.zipperCode, em.elasticCode) as materialCode
FROM style_material_bom smb
LEFT JOIN lace_master lm ON smb.laceId = lm.id
LEFT JOIN button_master bm ON smb.buttonId = bm.id
LEFT JOIN thread_master tm ON smb.threadId = tm.id
LEFT JOIN zipper_master zm ON smb.zipperId = zm.id
LEFT JOIN elastic_master em ON smb.elasticId = em.id
WHERE smb.usageCategory = 'GARMENT_TRIM';

-- View for packaging items
CREATE VIEW v_style_packaging AS
SELECT
  smb.*,
  COALESCE(lbl.labelName, pkg.packagingName) as materialName,
  COALESCE(lbl.labelCode, pkg.packagingCode) as materialCode
FROM style_material_bom smb
LEFT JOIN label_master lbl ON smb.labelId = lbl.id
LEFT JOIN packaging_master pkg ON smb.packagingId = pkg.id
WHERE smb.usageCategory = 'PACKAGING';
```

### Phase 2B: Migration Path (Optional)

For existing styles with free-text data:
1. Keep old tables (`style_garment_trims`, etc.) for reference
2. New styles use `style_material_bom` only
3. Provide migration tool to convert old data (manual review required)

---

## Implementation Tasks

### Task 1: Database Schema
- [x] Design `style_material_bom` table structure
- [ ] Create Prisma schema definition
- [ ] Generate migration scripts
- [ ] Create database views
- [ ] Add indexes for performance

### Task 2: Backend API - Material Selection Endpoints
- [ ] `GET /api/styles/materials/search?type=BUTTON&query=black`
  - Search materials by type and keyword
  - Return material code, name, specs, price
- [ ] `GET /api/styles/materials/by-code/:materialCode`
  - Get material details by code (BTN-0001)
  - Auto-populate specifications
- [ ] `POST /api/styles/:id/materials`
  - Add material to style BOM
  - Calculate costs automatically

### Task 3: Backend API - Style Creation/Update
- [ ] Update `POST /api/styles` to accept material BOM
- [ ] Update `PUT /api/styles/:id` to handle material changes
- [ ] Add cost calculation logic
- [ ] Return complete BOM with cost breakdown

### Task 4: Backend API - BOM Reports
- [ ] `GET /api/styles/:id/bom`
  - Complete material BOM with costs
  - Group by category (Garment Trims, Packaging, etc.)
- [ ] `GET /api/styles/:id/material-cost`
  - Total material cost breakdown
  - Cost per garment calculation
- [ ] `POST /api/styles/materials/requirements`
  - Material requirement planning (multiple styles)
  - Aggregate quantities needed

### Task 5: Frontend - Material Selector Component
- [ ] Create `MaterialSelector.tsx` component
  - Dropdown for material type (Lace, Button, Thread, etc.)
  - Search/autocomplete for materials
  - Display material specs (size, color, code)
  - Show current price
- [ ] Add quantity input with unit selection
- [ ] Display calculated cost per garment

### Task 6: Frontend - Style Form Integration
- [ ] Update `StyleForm.tsx` to use `MaterialSelector`
- [ ] Replace free-text trim fields with material selectors
- [ ] Add material BOM section with table
- [ ] Show real-time cost calculations
- [ ] Enable add/remove material rows

### Task 7: Frontend - Style Detail/View
- [ ] Update `StyleDetail.tsx` to show material BOM
- [ ] Display material codes with links to masters
- [ ] Show cost breakdown by category
- [ ] Add "View Material Master" links

### Task 8: Cost Calculation Utilities
- [ ] Create `calculateMaterialCost()` utility
- [ ] Create `calculateStyleMaterialTotal()` function
- [ ] Add price update handling (when material prices change)

### Task 9: Testing
- [ ] Unit tests for cost calculations
- [ ] Integration tests for style creation with materials
- [ ] E2E test: Create style with 5+ materials
- [ ] Test material cost updates

---

## API Changes

### New Endpoints

#### 1. Search Materials by Type
```http
GET /api/styles/materials/search?type=BUTTON&query=black&limit=20
Authorization: Bearer <token>

Response:
{
  "materials": [
    {
      "materialId": "mat-btn-0001",
      "masterRecordId": "uuid-123",
      "materialCode": "BTN-0001",
      "materialName": "Black Button 18mm 4-hole",
      "materialType": "BUTTON",
      "specifications": {
        "size": "18mm",
        "holes": 4,
        "color": "Black",
        "material": "Plastic"
      },
      "pricePerUnit": 0.08,
      "unit": "pcs",
      "supplierName": "ABC Buttons Ltd",
      "isActive": true
    }
  ]
}
```

#### 2. Get Material by Code
```http
GET /api/styles/materials/by-code/BTN-0001
Authorization: Bearer <token>

Response:
{
  "material": {
    "materialId": "mat-btn-0001",
    "materialCode": "BTN-0001",
    "materialName": "Black Button 18mm 4-hole",
    "materialType": "BUTTON",
    "specifications": { ... },
    "pricePerPiece": 0.08,
    "pricePerGross": 11.52,
    "unit": "pcs",
    "supplierName": "ABC Buttons Ltd"
  }
}
```

#### 3. Get Style Material BOM
```http
GET /api/styles/:styleId/bom
Authorization: Bearer <token>

Response:
{
  "styleCode": "STY-001",
  "styleName": "Classic Polo Shirt",
  "materialBOM": {
    "garmentTrims": [
      {
        "id": "uuid-1",
        "materialCode": "BTN-0001",
        "materialName": "Black Button 18mm",
        "componentName": "Front Placket",
        "quantityPerGarment": 5,
        "unit": "pcs",
        "unitPrice": 0.08,
        "totalCost": 0.40
      }
    ],
    "valueAdditions": [],
    "packaging": [
      {
        "id": "uuid-2",
        "materialCode": "PKG-0001",
        "materialName": "Polybag 12x18",
        "quantityPerGarment": 1,
        "unit": "pcs",
        "unitPrice": 0.08,
        "totalCost": 0.08
      }
    ]
  },
  "costSummary": {
    "garmentTrimsCost": 0.40,
    "valueAdditionsCost": 0.00,
    "packagingCost": 0.08,
    "totalMaterialCost": 0.48
  }
}
```

### Modified Endpoints

#### POST /api/styles (Enhanced)
```json
{
  "styleCode": "STY-001",
  "styleName": "Classic Polo Shirt",
  "customerName": "Brand A",
  "brandName": "Premium Line",
  "materialBOM": [
    {
      "materialCode": "BTN-0001",
      "usageCategory": "GARMENT_TRIM",
      "componentName": "Front Placket",
      "quantityPerGarment": 5,
      "unit": "pcs"
    },
    {
      "materialCode": "THR-0001",
      "usageCategory": "VALUE_ADDITION",
      "componentName": "Embroidery Logo",
      "quantityPerGarment": 10,
      "unit": "meters"
    },
    {
      "materialCode": "PKG-0001",
      "usageCategory": "PACKAGING",
      "componentName": "Individual Pack",
      "quantityPerGarment": 1,
      "unit": "pcs"
    }
  ]
}
```

---

## Frontend Changes

### 1. New Component: MaterialSelector

**File:** `frontend/src/components/MaterialSelector.tsx`

```tsx
interface MaterialSelectorProps {
  value?: string;  // materialCode
  onChange: (material: Material) => void;
  materialTypes?: MaterialType[];  // Filter by types
  label?: string;
  required?: boolean;
}

export function MaterialSelector({
  value,
  onChange,
  materialTypes = ['LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING'],
  label = "Select Material",
  required = false
}: MaterialSelectorProps) {
  // Features:
  // - Type dropdown (Lace, Button, etc.)
  // - Autocomplete search within type
  // - Display material code + name + specs
  // - Show current price
  // - Link to material master
}
```

### 2. Updated Component: StyleForm

**File:** `frontend/src/pages/StyleForm.tsx`

Add new section: **Material BOM**

```tsx
// Material BOM Section
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Material BOM</h3>

  {/* Garment Trims */}
  <Card>
    <CardHeader>
      <CardTitle>Garment Trims</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Component</TableHead>
            <TableHead>Qty/Garment</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {garmentTrims.map((trim, index) => (
            <TableRow key={index}>
              <TableCell>
                <MaterialSelector
                  value={trim.materialCode}
                  onChange={(material) => handleMaterialSelect(index, material)}
                  materialTypes={['LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC']}
                />
              </TableCell>
              <TableCell>
                <Input
                  placeholder="e.g., Front Placket"
                  value={trim.componentName}
                  onChange={(e) => updateTrim(index, 'componentName', e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={trim.quantityPerGarment}
                  onChange={(e) => updateTrim(index, 'quantityPerGarment', e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Select value={trim.unit} onValueChange={(v) => updateTrim(index, 'unit', v)}>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="meters">meters</SelectItem>
                  <SelectItem value="grams">grams</SelectItem>
                </Select>
              </TableCell>
              <TableCell>₹{trim.unitPrice?.toFixed(2)}</TableCell>
              <TableCell className="font-semibold">
                ₹{(trim.quantityPerGarment * trim.unitPrice).toFixed(2)}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => removeTrim(index)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={addGarmentTrim} variant="outline" className="mt-2">
        + Add Trim
      </Button>
    </CardContent>
  </Card>

  {/* Similar sections for Packaging, Value Additions */}

  {/* Cost Summary */}
  <Card>
    <CardHeader>
      <CardTitle>Material Cost Summary</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Garment Trims:</span>
          <span className="font-semibold">₹{garmentTrimsCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Packaging:</span>
          <span className="font-semibold">₹{packagingCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Total Material Cost/Garment:</span>
          <span>₹{totalMaterialCost.toFixed(2)}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

---

## Testing Plan

### Unit Tests
- [ ] Test `calculateMaterialCost(quantity, price)` utility
- [ ] Test material type validation
- [ ] Test BOM cost aggregation

### Integration Tests
- [ ] Create style with 5 different material types
- [ ] Update style to add/remove materials
- [ ] Verify cost calculations are accurate
- [ ] Test material code lookup

### E2E Tests
- [ ] Full style creation workflow with materials
- [ ] Material search and selection
- [ ] BOM view and cost display
- [ ] Material master link navigation

### Performance Tests
- [ ] Style BOM query with 50+ materials
- [ ] Material search with 1000+ materials
- [ ] Bulk material requirement calculation (100 styles)

---

## Migration Strategy

### Option 1: Dual System (Recommended)
- Keep old tables for existing styles (read-only)
- New styles use `style_material_bom` only
- Provide UI indicator: "Legacy BOM" vs "Material-Linked BOM"
- Manual migration tool for high-value styles

### Option 2: Automated Migration
- Attempt to match free-text to material masters
- Create unmatched materials as new master records
- Flag for manual review
- Risky: may create duplicates

### Option 3: Clean Slate
- Mark old styles as "legacy"
- All new styles require material masters
- Simplest but loses historical data linkage

**Recommendation:** Option 1 (Dual System)

---

## Success Criteria

### Phase 2A: Foundation (Week 1)
- [x] Documentation complete
- [ ] Database schema created
- [ ] Prisma models updated
- [ ] Basic CRUD for material BOM
- [ ] Material search API working

### Phase 2B: Integration (Week 2)
- [ ] StyleForm uses MaterialSelector
- [ ] Can create style with linked materials
- [ ] Cost calculations functional
- [ ] BOM view displays correctly

### Phase 2C: Production Ready (Week 3)
- [ ] All 7 material types supported
- [ ] E2E tests passing
- [ ] Documentation complete
- [ ] Migration path documented
- [ ] User training materials

### Key Metrics
- ✅ Can create style with 10+ materials in <2 minutes
- ✅ Material cost auto-calculates with 100% accuracy
- ✅ BOM query performance <500ms for 50 materials
- ✅ Zero duplicate material master entries

---

## Next Steps

1. **Create Prisma Schema** for `style_material_bom`
2. **Generate Migration** and apply to database
3. **Create Backend API** for material search
4. **Build MaterialSelector** component
5. **Update StyleForm** to use new BOM system
6. **Test** with real data
7. **Deploy** to production

---

## Related Documentation
- [Phase 1: Material System Foundation](./PHASE_1_MATERIALS_IMPLEMENTATION.md)
- [Phase 1B: Additional Material Masters](../PHASE_1B_COMPLETION_SUMMARY.md)
- [Material Master Schema](../backend/prisma/schema.prisma)
- [Style Import Guide](./STYLE_IMPORT_GUIDE.md)

---

**Document Version:** 1.0
**Last Updated:** January 23, 2025
**Author:** Development Team
