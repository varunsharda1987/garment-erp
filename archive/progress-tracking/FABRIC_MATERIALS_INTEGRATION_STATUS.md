# Fabric-Materials Integration Status

## Overview
This document tracks the integration of Fabric/Greige management system with the Materials module to create a unified polymorphic architecture.

## Completed Schema Changes (Phase 1)

### 1. MaterialType Enum Added
**Location:** `backend/prisma/schema.prisma` (Line ~1485)

```prisma
enum MaterialType {
  GENERIC          // Regular materials (trims, threads, accessories, etc.)
  GREIGE_FABRIC    // Raw/unfinished fabric - references greige_master
  FINISHED_FABRIC  // Dyed/printed/finished fabric - references fabric_master
  TRIMS            // Buttons, zippers, labels, etc.
  THREAD           // Sewing thread, embroidery thread
  ACCESSORIES      // Tags, hangers, poly bags
  PACKAGING        // Boxes, cartons
  SERVICE          // Subcontracting services
}
```

### 2. Materials Model Extended
**Location:** `backend/prisma/schema.prisma` (Line ~329)

**New Fields:**
- `materialType MaterialType @default(GENERIC)` - Discriminator for material type
- `greigeId String?` - Foreign key to greige_master (for GREIGE_FABRIC type)
- `fabricId String?` - Foreign key to fabric_master (for FINISHED_FABRIC type)

**New Relations:**
- `greige_master greige_master?` - Polymorphic reference to greige
- `fabric_master fabric_master?` - Polymorphic reference to fabric

**New Indexes:**
- `@@index([materialType])`
- `@@index([greigeId])`
- `@@index([fabricId])`

### 3. Greige Master Extended
**Location:** `backend/prisma/schema.prisma` (Line ~1852)

**New Relation:**
- `materials materials[]` - Reverse relation for materials referencing greige

### 4. Fabric Master Extended
**Location:** `backend/prisma/schema.prisma` (Line ~1901)

**New Relation:**
- `materials materials[]` - Reverse relation for materials referencing fabric

### 5. BOM Items Extended
**Location:** `backend/prisma/schema.prisma` (Line ~47)

**New Fields:**
- `fabricCADId String?` - Optional reference to fabric_width_cad

**New Relations:**
- `fabricCAD fabric_width_cad?` - Link to specific CAD width configuration

**New Index:**
- `@@index([fabricCADId])`

**Benefits:**
- BOM can now specify exact fabric width and CAD consumption
- Automatic cost calculation from CAD data
- Width-specific material requirements

### 6. Fabric Width CAD Extended
**Location:** `backend/prisma/schema.prisma` (Line ~1961)

**New Relation:**
- `bom_items bom_items[]` - Reverse relation for BOM items using this CAD

---

## Pending Schema Changes (Phase 1)

### 7. Style Fabrics Model - NEEDS UPDATE
**Location:** `backend/prisma/schema.prisma` (Line ~762)

**Current Issues:**
- Hardcoded `fabricName`, `fabricType`, `fabricColor`, `fabricGSM` strings
- Hardcoded `greigeName` and `supplierName` strings
- No foreign key to `fabric_master`
- Duplicate CAD structure via `cad_averages` table

**Required Changes:**
```prisma
model style_fabrics {
  id           String @id @default(uuid())
  componentId  String

  // REMOVE HARDCODED FIELDS:
  // fabricName, fabricType, fabricColor, fabricGSM, greigeName, supplierName

  // ADD PROPER REFERENCES:
  fabricId        String                // Link to fabric_master
  fabricCADId     String?               // Optional override for specific CAD width
  quantityNeeded  Decimal?              // For cost calculations

  // KEEP COMPONENT-SPECIFIC OVERRIDES:
  unitPrice       Decimal?              // Override fabric master price if needed
  notes           String?

  // Relations
  style_components style_components
  fabric           fabric_master        @relation(fields: [fabricId], references: [id])
  fabricCAD        fabric_width_cad?    @relation(fields: [fabricCADId], references: [id])

  // REMOVE: cad_averages relation (migrate to fabric_width_cad)
}
```

**Migration Plan:**
1. Match existing `style_fabrics.fabricName` with `fabric_master.fabricName`
2. Where match found, populate `fabricId`
3. Where no match, create new `fabric_master` entry
4. Migrate `cad_averages` data to `fabric_width_cad`
5. Drop `cad_averages` table

### 8. Stock Levels Model - NEEDS UPDATE
**Location:** `backend/prisma/schema.prisma` (Line ~stock_levels)

**Required Changes:**
```prisma
model stock_levels {
  // ... existing fields

  // ADD FABRIC TRACKING:
  fabricId    String?
  fabricCADId String?

  // Relations
  fabric      fabric_master?    @relation(fields: [fabricId], references: [id])
  fabricCAD   fabric_width_cad? @relation(fields: [fabricCADId], references: [id])

  @@index([fabricId])
  @@index([fabricCADId])
}
```

### 9. Style Costing Model - NEEDS UPDATE
**Location:** `backend/prisma/schema.prisma` (Line ~740)

**Current Issues:**
- Uses JSON for `fabricDetails` instead of proper relations
- Manual calculation instead of automatic from BOM

**Required Changes:**
```prisma
// NEW MODEL:
model CostingFabricItem {
  id              String @id @default(uuid())
  costingId       String
  fabricId        String
  fabricCADId     String
  quantityNeeded  Decimal  @db.Decimal(10, 4)
  costPerUnit     Decimal  @db.Decimal(10, 2)
  totalCost       Decimal  @db.Decimal(10, 2)

  costing         style_costing     @relation(fields: [costingId], references: [id])
  fabric          fabric_master     @relation(fields: [fabricId], references: [id])
  fabricCAD       fabric_width_cad  @relation(fields: [fabricCADId], references: [id])
}

// UPDATE style_costing:
model style_costing {
  // ... existing fields

  // DEPRECATE (keep for transition):
  fabricDetails Json?  // Mark as deprecated

  // ADD:
  fabricItems CostingFabricItem[]  // Proper relational structure
}
```

---

## Backend Code Changes Required (Phase 2)

### 1. Material Controller Enhancement
**File:** `backend/src/controllers/material.controller.ts`

**Changes Needed:**
```typescript
// Add type filtering
export const getMaterials = async (req, res) => {
  const { materialType, search, page = 1, limit = 50 } = req.query;

  const where = {
    ...(materialType && materialType !== 'all' && { materialType }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    })
  };

  const materials = await prisma.materials.findMany({
    where,
    include: {
      greige_master: materialType === 'GREIGE_FABRIC',
      fabric_master: materialType === 'FINISHED_FABRIC' ? {
        include: { widthCADs: true }
      } : false,
    }
  });

  // ... rest of logic
};
```

### 2. BOM Controller Enhancement
**File:** `backend/src/controllers/bom.controller.ts`

**Changes Needed:**
```typescript
// Validate fabricCADId when material is fabric type
const BOMItemSchema = z.object({
  materialId: z.string().uuid(),
  quantityPerUnit: z.number().positive(),
  unit: z.nativeEnum(Unit),
  wastagePercent: z.number().min(0).max(100),
  costPerUnit: z.number().nonnegative(),
  fabricCADId: z.string().uuid().optional(), // New field
  notes: z.string().optional(),
});

// In createBOM function, resolve cost from fabric CAD:
for (const item of validatedData.bomItems) {
  const material = await prisma.materials.findUnique({
    where: { id: item.materialId },
    include: { fabric_master: { include: { widthCADs: true } } }
  });

  if (material.materialType === 'FINISHED_FABRIC' && item.fabricCADId) {
    const cad = material.fabric_master.widthCADs.find(c => c.id === item.fabricCADId);
    if (cad) {
      // Auto-calculate cost based on CAD consumption
      item.costPerUnit = material.fabric_master.costPerMeter * (cad.cadMeters || 0);
    }
  }
}
```

### 3. Cost Sheet Controller Enhancement
**File:** `backend/src/controllers/styleCosting.controller.ts`

**Changes Needed:**
```typescript
// Replace manual fabric extraction with proper BOM lookup
export const generateCostSheet = async (req, res) => {
  const { bomId } = req.body;

  const bom = await prisma.bill_of_materials.findUnique({
    where: { id: bomId },
    include: {
      bom_items: {
        include: {
          materials: {
            include: {
              fabric_master: {
                include: {
                  greige: true,
                  widthCADs: true
                }
              }
            }
          },
          fabricCAD: true // Direct CAD reference from BOM
        }
      }
    }
  });

  // Process fabric materials
  const fabricItems = bom.bom_items
    .filter(item => item.materials.materialType === 'FINISHED_FABRIC')
    .map(item => ({
      fabricId: item.materials.fabricId,
      fabricName: item.materials.fabric_master.fabricName,
      cadWidth: item.fabricCAD?.availableWidth,
      cadConsumption: item.fabricCAD?.cadMeters,
      costPerMeter: item.materials.fabric_master.costPerMeter,
      totalCost: item.costPerUnit * item.quantityPerUnit
    }));

  // ... rest of logic
};
```

### 4. Style Controller Enhancement
**File:** `backend/src/controllers/style.controller.ts`

**Changes Needed:**
```typescript
// Update style fabric creation to use fabric_master
const StyleFabricSchema = z.object({
  componentId: z.string().uuid(),
  fabricId: z.string().uuid(),     // Reference to fabric_master
  fabricCADId: z.string().uuid().optional(), // Specific CAD width
  quantityNeeded: z.number().optional(),
  unitPrice: z.number().optional(), // Override if needed
});

// Validate fabric exists
const fabric = await prisma.fabric_master.findUnique({
  where: { id: fabricData.fabricId },
  include: { widthCADs: true, greige: true }
});

if (!fabric) {
  throw new Error('Fabric not found');
}

// Auto-populate from fabric master
const styleFabric = await prisma.style_fabrics.create({
  data: {
    componentId: fabricData.componentId,
    fabricId: fabricData.fabricId,
    fabricCADId: fabricData.fabricCADId,
    unitPrice: fabricData.unitPrice || fabric.costPerMeter,
  }
});
```

---

## Frontend Changes Required (Phase 3)

### 1. BOMForm Component
**File:** `frontend/src/pages/BOMForm.tsx`

**Changes Needed:**
- Add Material Type selector (Generic/Fabric)
- When Fabric selected, show Fabric Selector dropdown
- When fabric selected, show available CAD widths
- Auto-populate cost based on selected CAD

### 2. FabricSelector Component (NEW)
**File:** `frontend/src/components/FabricSelector.tsx`

**Purpose:**
- Dropdown to select fabric from fabric_master
- Shows fabric details (color, width, GSM)
- Allows selection of specific CAD width
- Displays calculated consumption

### 3. CostSheetForm Component
**File:** `frontend/src/pages/CostSheetForm.tsx`

**Changes Needed:**
- Remove manual fabric parsing logic (lines 310-329)
- Use BOM fabric items directly
- Display fabric master data with CAD details

### 4. StyleForm Component
**File:** `frontend/src/pages/StyleForm.tsx`

**Changes Needed:**
- When adding fabric component, use FabricSelector
- Auto-populate fabric details from fabric_master
- Show greige fabric info
- Select CAD width for the component

---

## Migration Strategy

### Phase 1: Schema Migration ✅ FULLY COMPLETED
- [x] Add MaterialType enum
- [x] Extend materials model
- [x] Add fabric/greige references
- [x] Update BOM items for CAD support
- [x] Add 6 new Phase 1B tables (procurement, stock, processing, allocation, transaction, inspection)
- [x] Add reverse relations to all existing models (greige_master, fabric_master, styles, orders, suppliers, users)
- [x] Update style_fabrics (added fabricId, fabricCADId references, deprecated hardcoded fields)
- [x] Create style_costing_fabric_items model (replaces JSON fabricDetails)
- [x] Deprecate cad_averages table (migrate to fabric_width_cad)
- [ ] Update stock_levels (OPTIONAL - can be done in Phase 3 if needed)

**Schema Status**: All changes complete and validated with `npx prisma format`

### Phase 2: Data Migration (PENDING)
1. Create materials entries for existing fabrics
2. Link style_fabrics to fabric_master
3. Migrate cad_averages to fabric_width_cad
4. Update BOM items with fabric references

### Phase 3: Backend Code (PENDING)
1. Material service enhancements
2. BOM controller updates
3. Cost sheet controller refactor
4. Style controller updates

### Phase 4: Frontend Updates (PENDING)
1. Material type filtering
2. Fabric selector component
3. BOM form enhancements
4. Cost sheet form fixes
5. Style form updates

### Phase 5: Testing & Validation (PENDING)
1. Unit tests for new logic
2. Integration tests for workflows
3. Data migration validation
4. Performance testing

---

## Benefits After Integration

1. **Single Source of Truth**
   - All materials (generic, fabrics, greige) in one unified system
   - No data duplication

2. **Automatic Cost Calculations**
   - BOM automatically uses CAD consumption
   - Cost sheets derive from BOM, not manual entry

3. **Consistent Data**
   - Fabric master updates propagate to styles
   - Price changes reflect immediately in cost sheets

4. **Simplified Workflows**
   - Create fabric master once, reuse everywhere
   - No manual CAD entry per style

5. **Better Reporting**
   - Unified material consumption reports
   - Fabric usage tracking across all styles
   - Supplier analysis for all material types

---

## Next Steps

1. Complete style_fabrics schema update
2. Create database migration SQL script
3. Write data migration script
4. Update backend controllers
5. Update frontend components
6. Testing and validation
