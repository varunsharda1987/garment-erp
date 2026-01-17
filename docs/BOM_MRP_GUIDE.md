# Bill of Materials (BOM) & Material Requirement Planning (MRP) Guide

## Table of Contents

1. [Overview](#overview)
2. [BOM System](#bom-system)
3. [Style Material BOM](#style-material-bom)
4. [BOM Versioning](#bom-versioning)
5. [Material Requirement Planning (MRP)](#material-requirement-planning-mrp)
6. [MRP Dashboard](#mrp-dashboard)
7. [Requirement Generation](#requirement-generation)
8. [Requirement to PO Linking](#requirement-to-po-linking)
9. [Material Requisition Workflow](#material-requisition-workflow)
10. [API Reference](#api-reference)
11. [Frontend Integration](#frontend-integration)
12. [Best Practices](#best-practices)

---

## 1. Overview

The BOM & MRP system is the cornerstone of production planning in the Garment ERP. It manages:

- **Bill of Materials (BOM)**: Defines material components and quantities needed to produce a style
- **Style Material BOM**: Flexible material assignment system supporting all trim types
- **Material Requirement Planning (MRP)**: Calculates material needs based on orders
- **Requirement to PO**: Links material requirements to procurement

### Key Concepts

**BOM (Bill of Materials):**
- Versioned material list per style
- Quantity specifications with wastage calculation
- Cost tracking and approval workflow
- Integration with material masters

**MRP (Material Requirement Planning):**
- Order-driven requirement generation
- Stock availability checking
- Shortfall identification
- Automatic PO generation
- Supplier selection

---

## 2. BOM System

### 2.1 BOM Structure

The `bill_of_materials` table tracks material requirements for production:

```prisma
model bill_of_materials {
  id           String   @id @default(uuid())
  styleId      String
  version      Int      @default(1)
  isActive     Boolean  @default(true)
  totalCost    Decimal? @db.Decimal(10, 2)
  createdById  String
  approvedById String?
  approvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  styles        styles
  bom_items     bom_items[]
  createdBy     users
  approvedBy    users?

  @@unique([styleId, version])
}
```

### 2.2 BOM Items

Each BOM contains multiple items representing materials:

```prisma
model bom_items {
  id              String  @id @default(uuid())
  bomId           String
  materialId      String
  quantityPerUnit Decimal @db.Decimal(10, 3)
  unit            Unit
  wastagePercent  Decimal @default(0) @db.Decimal(5, 2)
  costPerUnit     Decimal @db.Decimal(10, 2)
  notes           String?

  // Fabric CAD Integration
  fabricCADId String?
  fabricCAD   fabric_width_cad?

  // Relations
  bill_of_materials bill_of_materials
  materials         materials
  material_requirements material_requirements[]
}
```

**Key Fields:**
- `quantityPerUnit`: Base quantity needed per garment
- `wastagePercent`: Expected wastage (e.g., 5% = 0.05 multiplier)
- `costPerUnit`: Material cost for budgeting
- `fabricCADId`: Optional link to specific CAD width for fabrics

### 2.3 BOM Creation Workflow

**Step 1: Create BOM with Items**

```typescript
// POST /api/bom
{
  "styleId": "uuid",
  "bomItems": [
    {
      "materialId": "uuid",
      "quantityPerUnit": 2.5,
      "unit": "METERS",
      "wastagePercent": 5,
      "costPerUnit": 150.00,
      "notes": "Main fabric for body"
    },
    {
      "materialId": "uuid",
      "quantityPerUnit": 8,
      "unit": "PIECES",
      "wastagePercent": 0,
      "costPerUnit": 2.50,
      "notes": "Buttons for front placket"
    }
  ]
}
```

**Backend Logic ([bom.service.ts:87-169](backend/src/services/bom.service.ts#L87-L169)):**
1. Validates style exists
2. Gets next version number (auto-increment)
3. Validates all materials exist
4. Calculates total cost with wastage
5. **Deactivates previous BOMs** for the style
6. Creates new BOM as active version
7. Creates all BOM items in transaction

**Total Cost Calculation:**
```typescript
private calculateTotalCost(bomItems: BOMItemInput[]): number {
  return bomItems.reduce((sum, item) => {
    const effectiveQuantity = item.quantityPerUnit * (1 + (item.wastagePercent || 0) / 100);
    return sum + effectiveQuantity * item.costPerUnit;
  }, 0);
}
```

### 2.4 BOM Versioning System

**Why Versioning?**
- Track material changes over time
- Maintain historical accuracy
- Preserve approved BOMs
- Allow updates without data loss

**Version Management:**
```typescript
// Get next version number
const latestBOM = await prisma.bill_of_materials.findFirst({
  where: { styleId },
  orderBy: { version: 'desc' }
});
const nextVersion = latestBOM ? latestBOM.version + 1 : 1;
```

**Rules:**
- Only one active BOM per style at a time
- Creating new BOM deactivates previous versions
- Approved BOMs cannot be edited (create new version)
- All versions preserved for audit trail

### 2.5 BOM Approval Workflow

**Approve BOM:**
```typescript
// POST /api/bom/:id/approve
{
  "approved": true
}
```

**Business Rules:**
- Only unapproved BOMs can be edited
- Approved BOMs are immutable
- Approval locks the BOM for production use
- To update: Create new version (auto-increments)

**Backend Logic ([bom.service.ts:371-397](backend/src/services/bom.service.ts#L371-L397)):**
```typescript
if (bom.approvedById) {
  throw new BusinessError('BOM is already approved');
}

const updatedBOM = await prisma.bill_of_materials.update({
  where: { id },
  data: {
    approvedById: approved ? userId : null,
    approvedAt: approved ? new Date() : null,
  },
});
```

### 2.6 BOM Queries

**Get Active BOM for Style:**
```typescript
// GET /api/bom/styles/:styleId/active
const bom = await prisma.bill_of_materials.findFirst({
  where: { styleId, isActive: true },
  include: {
    bom_items: {
      include: { materials: true }
    }
  }
});
```

**Get All BOM Versions:**
```typescript
// GET /api/bom?styleId=uuid
const boms = await prisma.bill_of_materials.findMany({
  where: { styleId },
  orderBy: { version: 'desc' }
});
```

### 2.7 Material Requirement Calculation

Calculate materials needed for an order quantity:

```typescript
// GET /api/bom/:id/calculate?orderQuantity=1000
const result = {
  bom: { id, version, style },
  orderQuantity: 1000,
  requirements: [
    {
      material: { id, code, name },
      quantityPerUnit: 2.5,
      unit: "METERS",
      wastagePercent: 5,
      costPerUnit: 150.00,
      baseQuantity: 2500,      // 2.5 × 1000
      wastageQuantity: 125,     // 2500 × 0.05
      totalQuantity: 2625,      // 2500 + 125
      totalCost: 393750.00      // 2625 × 150
    }
  ],
  totalMaterialCost: 413750.00,
  costPerPiece: 413.75
};
```

**Backend Logic ([bom.service.ts:432-501](backend/src/services/bom.service.ts#L432-L501)):**
1. Fetch BOM with items and materials
2. For each BOM item:
   - Calculate base quantity = quantityPerUnit × orderQuantity
   - Calculate wastage = baseQuantity × (wastagePercent / 100)
   - Total quantity = baseQuantity + wastage
   - Total cost = totalQuantity × costPerUnit
3. Sum all costs for total material cost

---

## 3. Style Material BOM

### 3.1 Overview

`style_material_bom` is a flexible material assignment system that supports **all 19 material types** without creating individual materials records.

> **Important (Migration Note - Jan 2026):** The legacy `style_garment_trims` table has been deprecated and removed. All trim data is now stored in `style_material_bom`. This unification provides:
> - Single source of truth for all style materials (fabrics + trims)
> - Consistent API responses using `styleMaterialBom` field (camelCase)
> - Simplified frontend code without legacy fallback patterns

**Key Advantages:**
- Direct linkage to specialized masters (lace, button, thread, etc.)
- No need to create `materials` entry for every trim
- Supports polymorphic material types
- Optimized for performance with direct foreign keys
- **Unified storage** for both fabrics and trims (no separate `style_garment_trims`)

### 3.2 Schema Structure

```prisma
model style_material_bom {
  id           String       @id @default(uuid())
  styleId      String
  materialId   String?      // Optional generic material reference
  materialType MaterialType

  // Direct foreign keys to specific material masters
  laceId          String?
  buttonId        String?
  threadId        String?
  zipperId        String?
  elasticId       String?
  labelId         String?
  packagingId     String?
  machinePartId   String?
  otherMaterialId String?

  // Usage specifications
  usageCategory      MaterialUsageCategory
  componentName      String? // "Front Placket", "Logo Embroidery"
  quantityPerGarment Decimal @db.Decimal(10, 4)
  unit               String

  // Cost tracking
  unitPrice Decimal? @db.Decimal(10, 2)
  totalCost Decimal? @db.Decimal(10, 2)

  notes     String?
  sortOrder Int     @default(0)
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations to all material masters
  styles                styles
  materials             materials?
  lace_master           lace_master?
  button_master         button_master?
  thread_master         thread_master?
  zipper_master         zipper_master?
  elastic_master        elastic_master?
  label_master          label_master?
  packaging_master      packaging_master?
  machine_part_master   machine_part_master?
  other_material_master other_material_master?
}
```

### 3.3 Material Type Enumeration

```prisma
enum MaterialType {
  GENERIC
  GREIGE_FABRIC
  FINISHED_FABRIC
  LACE
  BUTTON
  THREAD
  ZIPPER
  ELASTIC
  LABEL
  PACKAGING
  HOOK_EYE
  SNAP_BUTTON
  BUCKLE
  BELT
  VELCRO
  DRAWSTRING
  RIBBON
  SEQUIN
  BEAD
  MOTIF
  INTERLINING
  PADDING
  MACHINE_PART
  OTHER
}
```

### 3.4 Usage Categories

```prisma
enum MaterialUsageCategory {
  FABRIC           // Body, lining, interlining
  TRIM             // Buttons, zippers, elastic
  LABEL            // Care, brand, size labels
  PACKAGING        // Poly bags, cartons, hangers
  EMBELLISHMENT    // Sequins, beads, embroidery
  FINISHING        // Threads, tapes
  HARDWARE         // Buckles, snaps, hooks
  OTHER
}
```

### 3.5 Adding Materials to Style BOM

**Example 1: Add Buttons to Style**

```typescript
// POST /api/styles/:styleId/materials
{
  "materialType": "BUTTON",
  "buttonId": "uuid",
  "usageCategory": "TRIM",
  "componentName": "Front Placket",
  "quantityPerGarment": 8,
  "unit": "pieces",
  "unitPrice": 2.50,
  "totalCost": 20.00,
  "notes": "4-hole plastic buttons, 15mm"
}
```

**Example 2: Add Lace Trim**

```typescript
{
  "materialType": "LACE",
  "laceId": "uuid",
  "usageCategory": "TRIM",
  "componentName": "Neckline Trim",
  "quantityPerGarment": 0.5,
  "unit": "meters",
  "unitPrice": 45.00,
  "totalCost": 22.50,
  "notes": "Floral lace, 2cm width"
}
```

**Example 3: Add Packaging**

```typescript
{
  "materialType": "PACKAGING",
  "packagingId": "uuid",
  "usageCategory": "PACKAGING",
  "componentName": "Individual Pack",
  "quantityPerGarment": 1,
  "unit": "pieces",
  "unitPrice": 5.00,
  "totalCost": 5.00
}
```

### 3.6 MRP Integration with Style Material BOM

The MRP service uses `style_material_bom` for requirement calculation:

**Backend Logic ([material-requirement.service.ts:56-148](backend/src/services/material-requirement.service.ts#L56-L148)):**

```typescript
// Get style with material BOM
const style = await prisma.styles.findUnique({
  where: { id: styleId },
  include: {
    style_material_bom: {
      where: { isActive: true },
      include: {
        materials: true,
        lace_master: true,
        button_master: true,
        thread_master: true,
        zipper_master: true,
        elastic_master: true,
        label_master: true,
        packaging_master: true,
      },
    },
  },
});

// Process each BOM entry
for (const bom of style.style_material_bom) {
  const totalRequired = Number(bom.quantityPerGarment) * orderQuantity;

  // Get material info from appropriate master
  let materialCode, materialName;
  if (bom.lace_master) {
    materialCode = bom.lace_master.laceCode;
    materialName = bom.lace_master.laceName;
  } else if (bom.button_master) {
    materialCode = bom.button_master.buttonCode;
    materialName = bom.button_master.buttonName;
  }
  // ... (similar for all material types)

  const availableStock = await getAvailableStock(materialId);
  const shortfall = totalRequired - availableStock;

  requirements.push({
    materialId,
    materialCode,
    materialName,
    materialType: bom.materialType,
    requiredQuantity: totalRequired,
    unit: bom.unit,
    availableStock,
    shortfall,
    usedInStyles: [style.styleCode],
  });
}
```

### 3.7 Querying Styles Using a Material

Find all styles that use a specific material:

```typescript
// GET /api/materials/:materialCode/styles
export async function getStylesUsingMaterial(
  materialCode: string
): Promise<StyleRequirement[]> {
  const material = await prisma.materials.findFirst({
    where: { code: { equals: materialCode, mode: 'insensitive' } },
  });

  const styles = await prisma.styles.findMany({
    where: {
      style_material_bom: {
        some: { materialId: material.id, isActive: true },
      },
      isActive: true,
    },
    include: {
      style_material_bom: {
        where: { materialId: material.id, isActive: true },
        include: { materials: true },
      },
    },
  });

  return styles.map((style) => ({
    styleId: style.id,
    styleCode: style.styleCode,
    styleName: style.styleName,
    orderQuantity: 0,
    materials: style.style_material_bom.map((bom) => ({
      materialCode: bom.materials?.code || materialCode,
      materialName: bom.materials?.name || bom.componentName,
      quantityPerPiece: Number(bom.quantityPerGarment),
      totalRequired: 0,
      unit: bom.unit,
    })),
  }));
}
```

---

## 4. BOM Versioning

### 4.1 Version Lifecycle

**Creation Flow:**
```
Style Created → BOM v1 Draft → Approve v1 → Active
                     ↓
              Need Changes?
                     ↓
              Create BOM v2 (v1 auto-deactivated)
                     ↓
              v2 becomes Active
```

### 4.2 Version Comparison

Compare two BOM versions to see changes:

```typescript
// GET /api/bom/compare?bomId1=uuid&bomId2=uuid
{
  "bom1": {
    "version": 1,
    "totalCost": 450.00,
    "items": [...]
  },
  "bom2": {
    "version": 2,
    "totalCost": 475.00,
    "items": [...]
  },
  "differences": {
    "added": [...],
    "removed": [...],
    "modified": [...],
    "costDelta": +25.00
  }
}
```

### 4.3 Historical Tracking

**Use Cases:**
- Cost variance analysis
- Material price history
- Production cost tracking
- Audit compliance

**Query Pattern:**
```typescript
const bomHistory = await prisma.bill_of_materials.findMany({
  where: { styleId },
  include: {
    bom_items: { include: { materials: true } },
    createdBy: true,
    approvedBy: true,
  },
  orderBy: { version: 'asc' },
});
```

---

## 5. Material Requirement Planning (MRP)

### 5.1 MRP Overview

MRP automates the calculation of material needs based on production orders.

**Core Workflow:**
1. Order received (with quantities)
2. MRP calculates material requirements from BOM
3. Checks stock availability
4. Identifies shortfalls
5. Generates purchase requirements
6. Creates or links to Purchase Orders

### 5.2 MRP Data Model

```prisma
model material_requirements {
  id                String @id @default(uuid())
  requirementNumber String @unique

  // Source linkage
  source      RequirementSource  // SALES_ORDER, WORK_ORDER, MANUAL
  orderId     String?
  orderItemId String?

  // Material details
  materialId String
  bomItemId  String?

  // Quantity calculations
  orderQuantity   Int     // Pieces ordered
  quantityPerUnit Decimal @db.Decimal(10, 4) // From BOM
  unit            String

  // Stock & procurement
  totalRequired      Decimal @db.Decimal(12, 3)
  availableStock     Decimal @default(0) @db.Decimal(12, 3)
  allocatedStock     Decimal @default(0) @db.Decimal(12, 3)
  shortfall          Decimal @db.Decimal(12, 3) // Can be negative (surplus)
  poQuantity         Decimal @default(0) @db.Decimal(12, 3)
  receivedQuantity   Decimal @default(0) @db.Decimal(12, 3)

  // Supplier selection
  preferredSupplierId String?
  estimatedUnitCost   Decimal? @db.Decimal(10, 2)
  estimatedTotalCost  Decimal? @db.Decimal(12, 2)

  // Status tracking
  status       MaterialRequirementStatus
  requiredDate DateTime

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  orders        orders?
  order_items   order_items?
  materials     materials
  bom_items     bom_items?
  preferredSupplier suppliers?
  createdBy     users
  requirement_po_links requirement_po_links[]
}
```

### 5.3 Requirement Status Flow

```prisma
enum MaterialRequirementStatus {
  PENDING      // Newly created, not processed
  IN_STOCK     // Sufficient stock available
  PARTIAL      // Partial stock, PO needed
  PO_CREATED   // PO generated, awaiting receipt
  PO_PARTIAL   // PO partially received
  RECEIVED     // Material received
  CANCELLED    // Requirement cancelled
}
```

**Status Transitions:**
```
PENDING → IN_STOCK (if stock available)
       ↓
PENDING → PARTIAL (if partial stock)
       ↓
PENDING → PO_CREATED (PO generated for shortfall)
       ↓
PO_CREATED → PO_PARTIAL (partial GRN)
          ↓
PO_PARTIAL → RECEIVED (full GRN received)
```

### 5.4 Requirement Source Types

```prisma
enum RequirementSource {
  SALES_ORDER  // From customer order
  WORK_ORDER   // From production
  MANUAL       // Manually created
}
```

---

## 6. MRP Dashboard

### 6.1 Dashboard Statistics

**GET /api/mrp/dashboard**

Returns summary statistics:

```typescript
{
  "totalRequirements": 156,
  "byStatus": {
    "PENDING": 42,
    "IN_STOCK": 28,
    "PARTIAL": 15,
    "PO_CREATED": 45,
    "PO_PARTIAL": 12,
    "RECEIVED": 14
  },
  "totalShortfall": {
    "value": 125000.00,
    "currency": "INR"
  },
  "urgentRequirements": 18,  // Due within 7 days
  "lowStockMaterials": 23,
  "pendingPOs": 12
}
```

### 6.2 Order Requirements Summary

**GET /api/mrp/orders/:orderId/summary**

Per-order requirement breakdown:

```typescript
{
  "orderId": "uuid",
  "orderNumber": "ORD-2024-001",
  "totalRequirements": 25,
  "fulfilled": 18,
  "pending": 7,
  "totalCost": 125000.00,
  "requirements": [
    {
      "materialCode": "FAB-001",
      "materialName": "Cotton Twill",
      "totalRequired": 2500,
      "availableStock": 1800,
      "shortfall": 700,
      "status": "PARTIAL",
      "estimatedCost": 105000.00
    }
  ]
}
```

### 6.3 Material-wise Requirements

**GET /api/mrp/requirements?materialId=uuid**

All requirements for a specific material across orders:

```typescript
{
  "materialCode": "BTN-001",
  "materialName": "Plastic Button 15mm",
  "totalRequirements": 5,
  "aggregated": {
    "totalRequired": 8000,
    "availableStock": 5000,
    "totalShortfall": 3000,
    "poQuantity": 3500
  },
  "byOrder": [
    {
      "orderNumber": "ORD-2024-001",
      "styleCode": "ST-001",
      "required": 4000,
      "status": "PO_CREATED"
    }
  ]
}
```

---

## 7. Requirement Generation

### 7.1 Auto-Generate from Order

**POST /api/mrp/calculate**

```typescript
{
  "orderId": "uuid",
  "orderItemId": "uuid",  // Optional: specific item
  "requiredDate": "2024-12-01",
  "checkStock": true
}
```

**Backend Process ([mrp.service.ts](backend/src/services/mrp.service.ts)):**

1. **Fetch Order with BOMs:**
```typescript
const order = await prisma.orders.findUnique({
  where: { id: orderId },
  include: {
    order_items: {
      include: {
        styles: {
          include: {
            bill_of_materials: {
              where: { isActive: true },
              include: { bom_items: { include: { materials: true } } }
            }
          }
        }
      }
    }
  }
});
```

2. **Calculate Requirements per Material:**
```typescript
for (const orderItem of order.order_items) {
  const bom = orderItem.styles.bill_of_materials[0];

  for (const bomItem of bom.bom_items) {
    const totalRequired =
      Number(bomItem.quantityPerUnit) * orderItem.totalQuantity;

    const availableStock = await getStockLevel(bomItem.materialId);
    const shortfall = Math.max(0, totalRequired - availableStock);

    // Create or update requirement
    await createOrUpdateRequirement({
      source: 'SALES_ORDER',
      orderId: order.id,
      orderItemId: orderItem.id,
      materialId: bomItem.materialId,
      bomItemId: bomItem.id,
      orderQuantity: orderItem.totalQuantity,
      quantityPerUnit: bomItem.quantityPerUnit,
      unit: bomItem.unit,
      totalRequired,
      availableStock,
      shortfall,
      status: shortfall > 0 ? 'PENDING' : 'IN_STOCK',
      requiredDate,
    });
  }
}
```

3. **Stock Checking Logic:**
```typescript
const stockLevels = await prisma.stock_levels.aggregate({
  where: { materialId },
  _sum: { quantity: true },
});
return Number(stockLevels._sum.quantity || 0);
```

### 7.2 Manual Requirement Creation

**POST /api/mrp/requirements**

For ad-hoc material needs:

```typescript
{
  "materialId": "uuid",
  "quantity": 500,
  "unit": "METERS",
  "requiredDate": "2024-11-15",
  "preferredSupplierId": "uuid",
  "notes": "Emergency requirement for sample production"
}
```

### 7.3 Bulk Requirements

Calculate requirements for multiple orders:

```typescript
export async function calculateBulkRequirements(
  orders: Array<{ styleId: string; quantity: number }>
): Promise<MaterialRequirement[]> {
  const allRequirements: Map<string, MaterialRequirement> = new Map();

  for (const order of orders) {
    const styleRequirements = await calculateMaterialRequirement(
      order.styleId,
      order.quantity
    );

    // Aggregate by material code
    for (const req of styleRequirements) {
      const existing = allRequirements.get(req.materialCode);
      if (existing) {
        existing.requiredQuantity += req.requiredQuantity;
        existing.shortfall += req.shortfall;
        if (!existing.usedInStyles.includes(req.usedInStyles[0])) {
          existing.usedInStyles.push(req.usedInStyles[0]);
        }
      } else {
        allRequirements.set(req.materialCode, { ...req });
      }
    }
  }

  return Array.from(allRequirements.values());
}
```

---

## 8. Requirement to PO Linking

### 8.1 Linking Model

```prisma
model requirement_po_links {
  id                  String   @id @default(uuid())
  requirementId       String
  purchaseOrderId     String
  purchaseOrderItemId String
  allocatedQuantity   Decimal  @db.Decimal(12, 3)
  receivedQuantity    Decimal  @default(0) @db.Decimal(12, 3)
  createdAt           DateTime @default(now())

  // Relations
  material_requirements material_requirements
  purchase_orders       purchase_orders
  purchase_order_items  purchase_order_items

  @@unique([requirementId, purchaseOrderItemId])
}
```

**Many-to-Many Rationale:**
- One requirement can be fulfilled by multiple POs
- One PO item can fulfill multiple requirements
- Enables PO consolidation

### 8.2 Generate PO from Requirements

**POST /api/mrp/generate-po**

```typescript
{
  "requirementIds": ["uuid1", "uuid2", "uuid3"],
  "supplierId": "uuid",
  "expectedDeliveryDate": "2024-12-15",
  "paymentTerms": "Net 30",
  "remarks": "Consolidated procurement for ORD-2024-001"
}
```

**Backend Process:**

1. **Validate Requirements:**
```typescript
const requirements = await prisma.material_requirements.findMany({
  where: {
    id: { in: requirementIds },
    status: { in: ['PENDING', 'PARTIAL'] }
  },
  include: { materials: true }
});
```

2. **Group by Material (Consolidate):**
```typescript
const materialGroups = requirements.reduce((acc, req) => {
  if (!acc[req.materialId]) {
    acc[req.materialId] = {
      material: req.materials,
      requirements: [],
      totalQuantity: 0,
    };
  }
  acc[req.materialId].requirements.push(req);
  acc[req.materialId].totalQuantity += Number(req.shortfall);
  return acc;
}, {});
```

3. **Create Purchase Order:**
```typescript
const po = await prisma.purchase_orders.create({
  data: {
    poNumber: await generatePONumber(),
    supplierId,
    expectedDeliveryDate,
    paymentTerms,
    remarks,
    status: 'DRAFT',
    createdById: userId,
    purchase_order_items: {
      create: Object.values(materialGroups).map(group => ({
        materialId: group.material.id,
        orderedQuantity: group.totalQuantity,
        unit: group.material.unit,
        unitPrice: group.material.costPerUnit || 0,
        totalPrice: group.totalQuantity * (group.material.costPerUnit || 0),
      })),
    },
  },
  include: { purchase_order_items: true },
});
```

4. **Create Links:**
```typescript
for (const poItem of po.purchase_order_items) {
  const relatedRequirements = materialGroups[poItem.materialId].requirements;

  for (const req of relatedRequirements) {
    await prisma.requirement_po_links.create({
      data: {
        requirementId: req.id,
        purchaseOrderId: po.id,
        purchaseOrderItemId: poItem.id,
        allocatedQuantity: req.shortfall,
      },
    });

    // Update requirement status
    await prisma.material_requirements.update({
      where: { id: req.id },
      data: {
        status: 'PO_CREATED',
        poQuantity: { increment: Number(req.shortfall) },
      },
    });
  }
}
```

### 8.3 Link to Existing PO

**POST /api/mrp/requirements/:id/link-po**

```typescript
{
  "purchaseOrderId": "uuid",
  "purchaseOrderItemId": "uuid",
  "allocatedQuantity": 500
}
```

**Use Case:**
- Manual PO created before MRP run
- Linking existing PO to newly calculated requirement
- Updating allocations

### 8.4 Receiving Materials (GRN Update)

When GRN is received, update requirement status:

```typescript
// In GRN service
async function updateRequirementOnGRN(grnItem) {
  const links = await prisma.requirement_po_links.findMany({
    where: { purchaseOrderItemId: grnItem.poItemId },
  });

  for (const link of links) {
    await prisma.requirement_po_links.update({
      where: { id: link.id },
      data: {
        receivedQuantity: { increment: grnItem.acceptedQuantity },
      },
    });

    await prisma.material_requirements.update({
      where: { id: link.requirementId },
      data: {
        receivedQuantity: { increment: grnItem.acceptedQuantity },
        status: checkFullyReceived(link) ? 'RECEIVED' : 'PO_PARTIAL',
      },
    });
  }
}
```

---

## 9. Material Requisition Workflow

### 9.1 Requisition vs Requirement

**Distinction:**
- **Requirement (MRP)**: Calculated need for materials to fulfill orders (planning phase)
- **Requisition**: Physical request to issue materials from warehouse to production floor

### 9.2 Requisition Data Model

```prisma
model material_requisitions {
  id                String   @id
  requisitionNumber String   // Unique among active
  workOrderId       String
  requisitionDate   DateTime @default(now())
  issuedById        String
  receivedById      String?
  status            RequisitionStatus @default(PENDING)
  remarks           String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())

  material_requisition_items material_requisition_items[]
  issuedBy                   users
  receivedBy                 users?
  work_orders                work_orders
}

model material_requisition_items {
  id                    String  @id
  requisitionId         String
  materialId            String
  requiredQuantity      Decimal @db.Decimal(10, 3)
  issuedQuantity        Decimal @default(0) @db.Decimal(10, 3)
  unit                  Unit
  remarks               String?

  materials             materials
  material_requisitions material_requisitions
}
```

### 9.3 Requisition Status Flow

```prisma
enum RequisitionStatus {
  PENDING    // Created, not issued
  PARTIAL    // Partially issued
  ISSUED     // Fully issued
  RECEIVED   // Received by production
  CANCELLED  // Cancelled
}
```

### 9.4 Creating Requisition from Work Order

**Workflow:**
1. Work Order created for production
2. System calculates materials needed from BOM
3. Requisition created to issue materials from warehouse
4. Warehouse issues materials (updates stock)
5. Production receives materials

**Example:**
```typescript
// POST /api/requisitions
{
  "workOrderId": "uuid",
  "items": [
    {
      "materialId": "uuid",
      "requiredQuantity": 250,
      "unit": "METERS"
    }
  ]
}
```

### 9.5 Stock Movement

When requisition is issued:

```typescript
// Update stock levels
await prisma.stock_movements.create({
  data: {
    materialId,
    fromWarehouseId,
    toLocationId: workOrder.productionLocationId,
    quantity: issuedQuantity,
    movementType: 'PRODUCTION_ISSUE',
    referenceType: 'REQUISITION',
    referenceId: requisitionId,
  },
});

// Reduce warehouse stock
await prisma.stock_levels.update({
  where: {
    materialId_warehouseId: {
      materialId,
      warehouseId: fromWarehouseId
    }
  },
  data: {
    quantity: { decrement: issuedQuantity },
  },
});
```

---

## 10. API Reference

### 10.1 BOM Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bom` | Create new BOM with items |
| GET | `/api/bom` | Get all BOMs (filterable) |
| GET | `/api/bom/:id` | Get BOM by ID |
| GET | `/api/bom/styles/:styleId/active` | Get active BOM for style |
| GET | `/api/bom/styles/:styleId/versions` | Get all BOM versions |
| PATCH | `/api/bom/:id` | Update BOM items (unapproved only) |
| POST | `/api/bom/:id/approve` | Approve or reject BOM |
| DELETE | `/api/bom/:id` | Deactivate BOM |
| GET | `/api/bom/:id/calculate` | Calculate material requirements |

### 10.2 MRP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mrp/calculate` | Calculate requirements from order |
| POST | `/api/mrp/requirements` | Create manual requirement |
| GET | `/api/mrp/requirements` | Get all requirements (filterable) |
| GET | `/api/mrp/requirements/:id` | Get requirement by ID |
| GET | `/api/mrp/orders/:orderId/summary` | Get order requirements summary |
| GET | `/api/mrp/dashboard` | Get MRP dashboard statistics |
| POST | `/api/mrp/requirements/:id/allocate-stock` | Allocate stock to requirement |
| POST | `/api/mrp/generate-po` | Generate PO from requirements |
| POST | `/api/mrp/requirements/:id/link-po` | Link requirement to existing PO |
| PATCH | `/api/mrp/requirements/:id/status` | Update requirement status |
| DELETE | `/api/mrp/requirements/:id` | Cancel requirement |

### 10.3 Style Material BOM Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/styles/:styleId/materials` | Add material to style BOM |
| GET | `/api/styles/:styleId/materials` | Get style material BOM |
| PATCH | `/api/styles/:styleId/materials/:id` | Update BOM item |
| DELETE | `/api/styles/:styleId/materials/:id` | Remove BOM item |
| GET | `/api/materials/:materialCode/styles` | Get styles using material |

### 10.4 Requisition Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requisitions` | Create material requisition |
| GET | `/api/requisitions` | Get all requisitions |
| GET | `/api/requisitions/:id` | Get requisition by ID |
| PATCH | `/api/requisitions/:id/issue` | Issue materials |
| PATCH | `/api/requisitions/:id/receive` | Mark as received |
| DELETE | `/api/requisitions/:id` | Cancel requisition |

---

## 11. Frontend Integration

### 11.1 BOM Form Component

```tsx
// frontend/src/pages/BOMForm.tsx
import { useState } from 'react';
import { bomService } from '@/services/bom.service';

interface BOMItem {
  materialId: string;
  quantityPerUnit: number;
  unit: string;
  wastagePercent: number;
  costPerUnit: number;
  notes?: string;
}

export default function BOMForm({ styleId }: { styleId: string }) {
  const [items, setItems] = useState<BOMItem[]>([]);

  const handleSubmit = async () => {
    const response = await bomService.create({
      styleId,
      bomItems: items,
    });

    if (response.success) {
      alert(`BOM version ${response.data.version} created`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Bill of Materials</h2>

      {items.map((item, index) => (
        <BOMItemRow
          key={index}
          item={item}
          onChange={(updated) => updateItem(index, updated)}
        />
      ))}

      <button type="button" onClick={addItem}>
        Add Material
      </button>

      <button type="submit">Create BOM</button>
    </form>
  );
}
```

### 11.2 MRP Dashboard Component

```tsx
// frontend/src/pages/MRPDashboard.tsx
import { useEffect, useState } from 'react';
import { mrpService } from '@/services/mrp.service';

export default function MRPDashboard() {
  const [stats, setStats] = useState(null);
  const [requirements, setRequirements] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const statsRes = await mrpService.getDashboardStats();
    const reqRes = await mrpService.getRequirements({
      status: 'PENDING',
      hasShortfall: true,
    });

    setStats(statsRes.data);
    setRequirements(reqRes.data);
  };

  return (
    <div className="mrp-dashboard">
      <h1>Material Requirement Planning</h1>

      <div className="stats-grid">
        <StatCard title="Total Requirements" value={stats?.totalRequirements} />
        <StatCard title="Pending" value={stats?.byStatus.PENDING} />
        <StatCard title="Urgent" value={stats?.urgentRequirements} />
        <StatCard title="Total Shortfall" value={`₹${stats?.totalShortfall.value}`} />
      </div>

      <RequirementsTable data={requirements} />
    </div>
  );
}
```

### 11.3 Material BOM Picker

```tsx
// frontend/src/components/MaterialBOMPicker.tsx
import { MaterialCombobox } from '@/components/MaterialCombobox';

interface MaterialBOMPickerProps {
  styleId: string;
  onAdd: (material: StyleMaterialBOM) => void;
}

export function MaterialBOMPicker({ styleId, onAdd }: MaterialBOMPickerProps) {
  const [materialType, setMaterialType] = useState<MaterialType>('BUTTON');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('pieces');

  const handleAdd = async () => {
    const bomEntry = {
      styleId,
      materialType,
      buttonId: materialType === 'BUTTON' ? selectedMaterial.id : null,
      laceId: materialType === 'LACE' ? selectedMaterial.id : null,
      // ... other material type IDs
      usageCategory: 'TRIM',
      quantityPerGarment: quantity,
      unit,
      unitPrice: selectedMaterial.price,
      totalCost: quantity * selectedMaterial.price,
    };

    await styleMaterialBOMService.create(bomEntry);
    onAdd(bomEntry);
  };

  return (
    <div className="material-bom-picker">
      <MaterialTypeSelect value={materialType} onChange={setMaterialType} />
      <MaterialCombobox
        materialType={materialType}
        value={selectedMaterial}
        onChange={setSelectedMaterial}
      />
      <Input
        type="number"
        placeholder="Quantity per garment"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <Select value={unit} onChange={setUnit}>
        <option value="pieces">Pieces</option>
        <option value="meters">Meters</option>
        <option value="grams">Grams</option>
      </Select>
      <Button onClick={handleAdd}>Add to BOM</Button>
    </div>
  );
}
```

---

## 12. Best Practices

### 12.1 BOM Management

1. **Always Approve BOMs Before Production**
   - Prevents accidental changes during production
   - Maintains cost accuracy
   - Ensures quality consistency

2. **Use Wastage Percentages Realistically**
   - Fabric: 3-10% (depending on pattern complexity)
   - Trims: 0-5%
   - Elastic/Ribbon: 5-8%

3. **Version BOMs When Making Changes**
   - Don't edit approved BOMs
   - Create new version for changes
   - Track cost impact of changes

4. **Link BOMs to CAD Widths for Fabrics**
   - Use `fabricCADId` field in BOM items
   - Ensures accurate fabric consumption
   - Prevents over/under ordering

### 12.2 MRP Best Practices

1. **Run MRP Immediately After Order Confirmation**
   - Early identification of shortfalls
   - More time for procurement
   - Better supplier negotiations

2. **Consolidate Requirements**
   - Group requirements by material and supplier
   - Reduce number of POs
   - Better pricing through volume

3. **Set Realistic Required Dates**
   - Factor in lead times
   - Add buffer for delays
   - Coordinate with production schedule

4. **Monitor Stock Levels Regularly**
   - Prevent shortages
   - Optimize inventory
   - Reduce holding costs

### 12.3 Style Material BOM Best Practices

1. **Use Appropriate Material Types**
   - Don't use GENERIC for specialized trims
   - Link directly to master tables
   - Improves data integrity

2. **Set Usage Categories Correctly**
   - FABRIC for body/lining materials
   - TRIM for functional components
   - LABEL for all label types
   - PACKAGING for packing materials

3. **Update Unit Prices Regularly**
   - Reflect current market rates
   - Maintain costing accuracy
   - Track price trends

### 12.4 Common Pitfalls to Avoid

1. **Not Checking Stock Before Creating Requirements**
   - Wastes time on unnecessary POs
   - Increases inventory unnecessarily

2. **Forgetting Wastage in BOMs**
   - Leads to material shortages
   - Production delays

3. **Creating Multiple POs for Same Material**
   - Use PO consolidation feature
   - Reduces administrative overhead

4. **Not Linking Requirements to POs**
   - Loses traceability
   - Difficult to track fulfillment

5. **Editing Approved BOMs**
   - Use versioning instead
   - Prevents production errors

---

## Related Documentation

- [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) - All 19 material types
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) - Order to PO workflow
- [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) - Stock levels & movements
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) - Work Orders & requisitions
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) - Main system documentation

---

**Last Updated:** 2026-01-13
**Version:** 1.1
**Maintained By:** Development Team

---

## Changelog

### v1.1 (2026-01-13)
- Added migration note about `style_garment_trims` deprecation
- Documented `style_material_bom` as unified storage for all materials
- Updated "Key Advantages" to reflect unification
