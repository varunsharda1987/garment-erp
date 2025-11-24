# Phase 2: Current Schema Analysis

**Date:** January 23, 2025
**Purpose:** Detailed analysis of existing style-related tables to plan material integration

---

## Current Tables Overview

### 1. `style_garment_trims`
**Purpose:** Track trims used in garment construction (buttons, zippers, lace, etc.)

**Current Schema:**
```prisma
model style_garment_trims {
  id               String   @id
  styleId          String
  trimName         String              // ❌ FREE TEXT
  trimType         String              // ❌ FREE TEXT
  quantityPerPiece Decimal  @db.Decimal(10, 3)
  unit             String
  supplier         String?             // ❌ FREE TEXT
  createdAt        DateTime @default(now())
  updatedAt        DateTime
  styles           styles   @relation(fields: [styleId], references: [id], onDelete: Cascade)

  @@index([styleId])
}
```

**Problems:**
- ❌ `trimName` is free text (e.g., "Black Button 18mm") instead of FK to `button_master`
- ❌ `trimType` is free text (e.g., "Button", "Zipper") instead of enum
- ❌ `supplier` is text instead of FK to `suppliers` table
- ❌ No cost tracking
- ❌ Cannot link to material masters (lace, button, thread, zipper, elastic)
- ❌ No material code reference
- ❌ Duplicate data entry

**Usage Examples (Current System):**
```json
{
  "trimName": "Black 4-hole Button 18mm",
  "trimType": "Button",
  "quantityPerPiece": 5,
  "unit": "pcs",
  "supplier": "ABC Buttons"
}
```

**What We Need:**
```json
{
  "materialCode": "BTN-0001",
  "materialType": "BUTTON",
  "componentName": "Front Placket",
  "quantityPerPiece": 5,
  "unit": "pcs",
  "unitPrice": 0.08,
  "totalCost": 0.40
}
```

---

### 2. `style_value_additions`
**Purpose:** Track value-added processes (embroidery, printing, washing, etc.)

**Current Schema:**
```prisma
model style_value_additions {
  id            String   @id
  styleId       String
  additionType  String              // e.g., "Embroidery", "Printing"
  description   String?             // ❌ FREE TEXT
  type          String?             // ❌ REDUNDANT with additionType
  numberOfItems String?             // ❌ SHOULD BE NUMERIC
  estimatedCost Decimal? @db.Decimal(10, 2)
  vendor        String?             // ❌ FREE TEXT
  createdAt     DateTime @default(now())
  updatedAt     DateTime
  styles        styles   @relation(fields: [styleId], references: [id], onDelete: Cascade)

  @@index([styleId])
}
```

**Problems:**
- ❌ `description` is free text instead of material references
- ❌ For embroidery: should reference `thread_master` for thread used
- ❌ For printing: should reference `label_master` or printing materials
- ❌ `numberOfItems` is string instead of numeric
- ❌ `vendor` is text instead of FK
- ❌ `type` field is redundant with `additionType`
- ❌ No material consumption tracking

**Usage Examples (Current System):**
```json
{
  "additionType": "Embroidery",
  "description": "Logo embroidery with gold thread on front",
  "numberOfItems": "1",
  "estimatedCost": 2.50,
  "vendor": "XYZ Embroidery"
}
```

**What We Need:**
```json
{
  "additionType": "Embroidery",
  "componentName": "Front Logo",
  "materials": [
    {
      "materialCode": "THR-0001",
      "materialType": "THREAD",
      "quantityPerGarment": 10,
      "unit": "meters"
    }
  ],
  "estimatedCost": 2.50,
  "vendorId": "vendor-uuid-123"
}
```

---

### 3. `style_packaging`
**Purpose:** Track packaging materials and specifications

**Current Schema:**
```prisma
model style_packaging {
  id              String   @id
  styleId         String
  itemName        String              // ❌ FREE TEXT
  itemType        String              // ❌ FREE TEXT
  specification   String?             // ❌ FREE TEXT
  quantityPerPack Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime
  styles          styles   @relation(fields: [styleId], references: [id], onDelete: Cascade)

  @@index([styleId])
}
```

**Problems:**
- ❌ `itemName` is free text (e.g., "Polybag 12x18") instead of FK to `packaging_master`
- ❌ `itemType` is free text instead of reference
- ❌ `specification` duplicates what's in `packaging_master`
- ❌ No cost tracking
- ❌ Cannot track label materials
- ❌ No material code reference

**Usage Examples (Current System):**
```json
{
  "itemName": "Polybag 12x18 inch",
  "itemType": "polybag",
  "specification": "LDPE 50 micron",
  "quantityPerPack": 1
}
```

**What We Need:**
```json
{
  "materialCode": "PKG-0001",
  "materialType": "PACKAGING",
  "componentName": "Individual Pack",
  "quantityPerPack": 1,
  "unitPrice": 0.08,
  "totalCost": 0.08
}
```

---

## Proposed Solution: Unified Material BOM Table

Instead of modifying 3 separate tables, create **one unified table** that handles all material types:

### `style_material_bom` (New Table)

```prisma
model style_material_bom {
  id               String   @id @default(uuid())
  styleId          String

  // Material Reference
  materialId       String   // FK to materials table
  materialType     MaterialType

  // Direct FK to specific material master (for performance)
  laceId           String?
  buttonId         String?
  threadId         String?
  zipperId         String?
  elasticId        String?
  labelId          String?
  packagingId      String?

  // Usage Details
  usageCategory    MaterialUsageCategory  // GARMENT_TRIM, VALUE_ADDITION, PACKAGING
  componentName    String?                // e.g., "Front Placket", "Logo Embroidery"

  // Quantity
  quantityPerGarment Decimal @db.Decimal(10, 4)
  unit             String                 // pcs, meters, grams, etc.

  // Cost Tracking (denormalized from master for historical accuracy)
  unitPrice        Decimal? @db.Decimal(10, 2)
  totalCost        Decimal? @db.Decimal(10, 2)  // quantityPerGarment × unitPrice

  // Optional
  notes            String?
  sortOrder        Int      @default(0)
  isActive         Boolean  @default(true)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Relations
  styles           styles   @relation(fields: [styleId], references: [id], onDelete: Cascade)
  materials        materials @relation(fields: [materialId], references: [id])
  lace_master      lace_master?     @relation(fields: [laceId], references: [id])
  button_master    button_master?   @relation(fields: [buttonId], references: [id])
  thread_master    thread_master?   @relation(fields: [threadId], references: [id])
  zipper_master    zipper_master?   @relation(fields: [zipperId], references: [id])
  elastic_master   elastic_master?  @relation(fields: [elasticId], references: [id])
  label_master     label_master?    @relation(fields: [labelId], references: [id])
  packaging_master packaging_master? @relation(fields: [packagingId], references: [id])

  @@index([styleId])
  @@index([materialId])
  @@index([usageCategory])
}
```

### New Enums

```prisma
enum MaterialUsageCategory {
  GARMENT_TRIM      // Buttons, Zippers, Lace, Elastic, Thread (construction)
  VALUE_ADDITION    // Embroidery Thread, Printing, Special Lace (decoration)
  PACKAGING         // Polybags, Labels, Hangers, Cartons
}
```

---

## Migration Strategy

### Phase 1: Add New Table (Non-Breaking)
1. Create `style_material_bom` table
2. Keep existing tables unchanged
3. New styles can use either system
4. No data migration required yet

### Phase 2: Dual Write (Transition)
1. When creating new styles, write to both old and new tables
2. UI shows new material selector interface
3. Old styles remain unchanged
4. Gradual adoption

### Phase 3: Migration Tool (Optional)
1. Provide admin tool to migrate high-value styles
2. Attempt to match free-text to material masters
3. Manual review required for unmatched items
4. Flag migrated styles

### Phase 4: Deprecation (Future)
1. Mark old tables as deprecated
2. New styles use only `style_material_bom`
3. Old styles remain read-only
4. Eventually archive old tables

---

## Database Changes Required

### 1. Add New Table
```sql
-- See Prisma schema above
```

### 2. Add Indexes
```sql
CREATE INDEX idx_style_material_bom_style ON style_material_bom(styleId);
CREATE INDEX idx_style_material_bom_material ON style_material_bom(materialId);
CREATE INDEX idx_style_material_bom_category ON style_material_bom(usageCategory);
CREATE INDEX idx_style_material_bom_type ON style_material_bom(materialType);
```

### 3. Add Helper Views
```sql
-- Garment Trims View
CREATE OR REPLACE VIEW v_style_garment_trims AS
SELECT
  smb.id,
  smb.styleId,
  smb.componentName,
  smb.quantityPerGarment,
  smb.unit,
  smb.unitPrice,
  smb.totalCost,
  smb.materialType,
  COALESCE(lm.laceCode, bm.buttonCode, tm.threadCode, zm.zipperCode, em.elasticCode) as materialCode,
  COALESCE(lm.laceName, bm.buttonName, tm.threadName, zm.zipperName, em.elasticName) as materialName
FROM style_material_bom smb
LEFT JOIN lace_master lm ON smb.laceId = lm.id
LEFT JOIN button_master bm ON smb.buttonId = bm.id
LEFT JOIN thread_master tm ON smb.threadId = tm.id
LEFT JOIN zipper_master zm ON smb.zipperId = zm.id
LEFT JOIN elastic_master em ON smb.elasticId = em.id
WHERE smb.usageCategory = 'GARMENT_TRIM' AND smb.isActive = true;

-- Packaging View
CREATE OR REPLACE VIEW v_style_packaging AS
SELECT
  smb.id,
  smb.styleId,
  smb.componentName,
  smb.quantityPerGarment,
  smb.unit,
  smb.unitPrice,
  smb.totalCost,
  COALESCE(lbl.labelCode, pkg.packagingCode) as materialCode,
  COALESCE(lbl.labelName, pkg.packagingName) as materialName
FROM style_material_bom smb
LEFT JOIN label_master lbl ON smb.labelId = lbl.id
LEFT JOIN packaging_master pkg ON smb.packagingId = pkg.id
WHERE smb.usageCategory = 'PACKAGING' AND smb.isActive = true;

-- Material Cost Summary View
CREATE OR REPLACE VIEW v_style_material_costs AS
SELECT
  styleId,
  SUM(CASE WHEN usageCategory = 'GARMENT_TRIM' THEN totalCost ELSE 0 END) as garmentTrimsCost,
  SUM(CASE WHEN usageCategory = 'VALUE_ADDITION' THEN totalCost ELSE 0 END) as valueAdditionsCost,
  SUM(CASE WHEN usageCategory = 'PACKAGING' THEN totalCost ELSE 0 END) as packagingCost,
  SUM(totalCost) as totalMaterialCost,
  COUNT(*) as totalMaterialCount
FROM style_material_bom
WHERE isActive = true
GROUP BY styleId;
```

---

## Impact Analysis

### Breaking Changes
- ✅ **NONE** - New table doesn't affect existing functionality

### Additive Changes
- ✅ New table `style_material_bom`
- ✅ New enum `MaterialUsageCategory`
- ✅ New relations in material master tables
- ✅ New database views

### Backend Changes Required
- Update `POST /api/styles` to accept `materialBOM` array
- Add `GET /api/styles/:id/material-bom` endpoint
- Add `GET /api/styles/materials/search` endpoint
- Add cost calculation utilities

### Frontend Changes Required
- Create `MaterialSelector` component
- Update `StyleForm` to include material BOM section
- Update `StyleDetail` to show material costs
- Add material cost summary display

---

## Data Model Comparison

### Old System (Free Text)
```
Style "Polo Shirt"
  ├─ style_garment_trims
  │   ├─ "Black Button 18mm" (5 pcs)
  │   └─ "YKK Zipper 7inch" (1 pcs)
  ├─ style_value_additions
  │   └─ "Embroidery with gold thread"
  └─ style_packaging
      └─ "Polybag 12x18"
```

**Problems:**
- No link to actual button/zipper/thread/packaging records
- Cannot calculate costs automatically
- Duplicate specifications
- No inventory integration

### New System (Material Linked)
```
Style "Polo Shirt"
  └─ style_material_bom
      ├─ BTN-0001 → button_master (Black Button 18mm) - 5 pcs @ ₹0.08 = ₹0.40
      ├─ ZIP-0001 → zipper_master (YKK 7inch) - 1 pcs @ ₹2.50 = ₹2.50
      ├─ THR-0002 → thread_master (Gold Thread 40s) - 10m @ ₹0.05/m = ₹0.50
      └─ PKG-0001 → packaging_master (Polybag 12x18) - 1 pcs @ ₹0.08 = ₹0.08
                                                      TOTAL = ₹3.48/garment
```

**Benefits:**
- ✅ Single source of truth
- ✅ Automatic cost calculation
- ✅ Real-time price updates
- ✅ Inventory integration ready
- ✅ Material requirement planning possible
- ✅ Supplier tracking
- ✅ Consistent specifications

---

## Next Steps

1. ✅ Complete schema analysis
2. [ ] Update Prisma schema with new table
3. [ ] Generate migration
4. [ ] Apply to database
5. [ ] Create backend API endpoints
6. [ ] Build frontend components
7. [ ] Test with sample data
8. [ ] Document for users

---

**Document Version:** 1.0
**Last Updated:** January 23, 2025
