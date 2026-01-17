# CAD Purposes - Detailed Analysis & Implementation Plan

## Overview

This plan covers the detailed analysis and implementation of the three CAD purposes:
1. **PRODUCTION** - For actual production orders
2. **PLANNING** - For style development and planning
3. **COSTING** - For quotations and cost calculations

**Note**: SAMPLE purpose mentioned in docs will be removed - not needed.

---

## Phase 1: PRODUCTION Purpose - Detailed Analysis

### What is PRODUCTION Purpose?

PRODUCTION purpose CAD is used for **actual production orders** where fabric will be purchased, cut, and manufactured into garments.

### Key Characteristics
- **Accuracy Required**: High - affects actual fabric purchase and consumption
- **Approval Workflow**: May require approval before production
- **Used By**: Production team, cutting team, fabric procurement
- **Linked To**: Work orders, cutting plans, fabric stock, actual consumption tracking

---

### PRODUCTION Purpose - Module Relationships

Need to investigate and document:

#### 1. **Order Management Module**
Questions to answer:
- How does order creation link to PRODUCTION CAD?
- When an order is placed, which CAD purpose is used?
- Can an order reference specific PRODUCTION CAD rows?
- How is fabric consumption calculated from PRODUCTION CAD for orders?

**Files to explore**:
- `backend/src/controllers/order.controller.ts`
- `backend/src/services/order.service.ts`
- `backend/prisma/schema.prisma` - `orders` model
- `frontend/src/pages/OrderForm.tsx`

#### 2. **Work Order Module**
Questions to answer:
- Do work orders reference PRODUCTION CAD?
- How is CAD data passed to work orders?
- Is fabric consumption pulled from PRODUCTION CAD?
- Can work orders use PLANNING CAD or only PRODUCTION?

**Files to explore**:
- `backend/src/controllers/workOrder.controller.ts`
- `backend/prisma/schema.prisma` - `work_orders` model
- Look for `cadId` or `fabricWidthCadId` foreign keys

#### 3. **Cutting Module**
Questions to answer:
- Does cutting plan use PRODUCTION CAD data?
- How are cutting markers related to CAD planning?
- Is the "pieces per marker" in CAD used for actual cutting?
- Do cutting teams see PRODUCTION CAD values?

**Files to explore**:
- `backend/src/controllers/cutting.controller.ts`
- `backend/prisma/schema.prisma` - `cutting_*` models
- `frontend/src/pages/CuttingList.tsx`

#### 4. **Fabric Stock & Procurement**
Questions to answer:
- Is fabric procurement based on PRODUCTION CAD consumption?
- How does fabric stock allocation work with PRODUCTION CAD?
- When fabric is issued, is it tracked against PRODUCTION CAD?
- Is there a fabric requirement report based on PRODUCTION CAD?

**Files to explore**:
- `backend/src/controllers/fabric-stock.controller.ts`
- `backend/src/services/fabric.service.ts`
- `backend/prisma/schema.prisma` - `fabric_stock` model

#### 5. **Costing Module**
Questions to answer:
- Does final production costing use PRODUCTION CAD?
- Is there variance tracking between COSTING CAD and PRODUCTION CAD?
- How are actual costs compared to estimated costs?

**Files to explore**:
- `backend/src/controllers/styleCosting.controller.ts`
- `backend/prisma/schema.prisma` - `style_costing` model

#### 6. **Consumption Tracking**
Questions to answer:
- Is actual fabric consumption tracked against PRODUCTION CAD?
- Are there variance reports (planned vs actual)?
- How is wastage calculated?

**Files to explore**:
- Look for consumption tracking models in schema
- Check for any consumption reports or controllers

---

### PRODUCTION Purpose - Data Fields Analysis

Current fields (all purposes):
```
- purpose: "PRODUCTION"
- componentId: string
- styleFabricId: string
- partId: string (pattern part)
- greigeId: string
- cutableWidth: number
- printDirection: string
- sizeBreakdowns: array
- piecesPerMarker: number
- layerLengthMeters: number (cadMeters in DB)
- layerMarginMeters: number
- cadAverage: number (calculated)
- isEmbroidery: boolean
```

**Additional fields that might be needed for PRODUCTION**:
- `approvalStatus`: "PENDING" | "APPROVED" | "REJECTED"
- `approvedBy`: User ID
- `approvedAt`: DateTime
- `productionNotes`: Text
- `isLocked`: Boolean (prevent editing once production starts)
- `actualConsumption`: Number (for variance tracking)
- `linkedOrderIds`: Array of order IDs using this CAD

---

### PRODUCTION Purpose - Workflow Requirements

Need to define:

1. **Creation Workflow**
   - Who can create PRODUCTION CAD?
   - When is PRODUCTION CAD created (after PLANNING approval?)
   - Can PRODUCTION CAD be created from scratch or only from PLANNING CAD?

2. **Approval Workflow**
   - Does PRODUCTION CAD require approval?
   - Who approves? (Production manager, merchandiser?)
   - Can unapproved PRODUCTION CAD be used in orders?

3. **Locking Mechanism**
   - Should PRODUCTION CAD be locked once orders are created?
   - Can it be edited if cutting has started?
   - What happens to existing orders if PRODUCTION CAD changes?

4. **Version Control**
   - Should PRODUCTION CAD have version history?
   - If CAD changes, how are old orders affected?

---

### PRODUCTION Purpose - Business Rules

Need to define:

1. **Validation Rules**
   - Must PRODUCTION CAD have size breakdowns filled?
   - Must greige fabric be selected?
   - Are there minimum/maximum consumption limits?

2. **Calculation Rules**
   - Standard wastage percentage for PRODUCTION?
   - How is safety margin calculated?
   - Rounding rules for fabric procurement

3. **Usage Rules**
   - Can one PRODUCTION CAD be used for multiple orders?
   - Can an order use mix of PRODUCTION and PLANNING CAD?
   - What happens if PRODUCTION CAD is deleted but orders exist?

---

## Next Steps

### Step 1: Information Gathering (Current Phase)
- [ ] Explore order management module relationship
- [ ] Explore work order module relationship
- [ ] Explore cutting module relationship
- [ ] Explore fabric stock relationship
- [ ] Explore costing module relationship
- [ ] Document current foreign key relationships in schema
- [ ] Identify gaps in current implementation

### Step 2: User Requirements Discussion
- [ ] Discuss PRODUCTION CAD approval workflow
- [ ] Define who creates/edits PRODUCTION CAD
- [ ] Define locking rules
- [ ] Define validation rules
- [ ] Get examples of PRODUCTION CAD usage scenarios

### Step 3: Documentation
- [ ] Create comprehensive PRODUCTION CAD documentation
- [ ] Add to CAD-Planning.md with all relationships
- [ ] Create workflow diagrams
- [ ] Document business rules

### Step 4: Repeat for PLANNING Purpose
- [ ] Same analysis for PLANNING purpose
- [ ] Document differences from PRODUCTION

### Step 5: Repeat for COSTING Purpose
- [ ] Same analysis for COSTING purpose
- [ ] Document differences from PRODUCTION and PLANNING

### Step 6: Implementation Planning
- [ ] Design database schema changes
- [ ] Design API endpoints
- [ ] Design UI changes
- [ ] Plan migration strategy for existing data

---

## PRODUCTION CAD - Current Implementation Analysis

### Module Integration Status

| Module | Integration Status | Details |
|--------|-------------------|----------|
| **Order Items** | ✅ FULLY INTEGRATED | `selectedCadId` FK allows order-specific CAD override |
| **Order Costing** | ✅ FULLY INTEGRATED | Snapshots `cadMeters`, `cadWidth` from selected CAD |
| **Style Costing** | ✅ FULLY INTEGRATED | `fabricCADId` FK in costing fabric items |
| **Cutting Batches** | ✅ PARTIAL | Stores `cadAverageUsed`, `cadWidthUsed` (snapshots, not FK) |
| **Fabric Stock** | ✅ PARTIAL | Has `plannedCad`, `actualCad` for variance tracking |
| **BOM Items** | ✅ AVAILABLE | Has `fabricCADId` FK but optional |
| **Embroidery CAD** | ✅ INTEGRATED | Separate CAD for embroidery parts |
| **Work Orders** | ⚠️ GAP | No direct CAD field, must traverse via order_items |
| **Procurement** | ⚠️ GAP | No CAD tracking in fabric_procurement |
| **MRP** | ⚠️ GAP | No CAD reference in material_requirements |

### Current CAD Data Flow

```
CAD Planning (fabric_width_cad)
  └─ purpose: "PRODUCTION"
     ├─→ order_items.selectedCadId (Order-specific override)
     │   └─→ order_item_costing (Snapshots: cadMeters, cadWidth)
     │       └─→ work_orders (No direct FK, manual lookup)
     │           └─→ cutting_batches (Snapshots: cadAverageUsed, cadWidthUsed)
     │               └─→ Tracks actual vs planned variance
     │
     ├─→ style_fabrics.fabricCADId (Component fabric CAD)
     │   └─→ style_costing_fabric_items.fabricCADId (Costing snapshot)
     │
     └─→ bom_items.fabricCADId (BOM reference)
```

### Key Findings

**What Works:**
1. Orders can override style CAD with `selectedCadId` per order item
2. Costing recalculates correctly using selected CAD
3. Cutting batches track variance from CAD (planned vs actual)
4. Fabric stock has fields for CAD variance tracking

**What's Missing:**
1. Work orders don't store CAD snapshot (must query backwards)
2. Fabric procurement has no CAD audit trail
3. Material requirements don't track which CAD was used
4. No validation that BOM uses approved CAD

**Consumption Calculation Methods Found:**
```typescript
// Method 1: Direct CAD meters × order quantity
totalRequired = cadMeters × orderQuantity

// Method 2: CAD average × pieces
consumption = cadAverage × piecesPerMarker

// Method 3: With wastage
effectiveCad = cadMeters × (1 + wastagePercent/100)
```

---

## PRODUCTION Purpose - User Requirements (Answered)

### 1. Order CAD Purpose Selection
**Requirement**: Users should be able to see **all three purposes** (PRODUCTION, PLANNING, COSTING) when creating PRODUCTION CAD.

**Key Point**: "The purpose is to take the average using actual fabric widths that we received after processing or from the fabric that we have in stock."

**Meaning**:
- PRODUCTION CAD is created **after receiving actual fabric**
- Uses **actual finished widths** from stock/processed fabric
- User can reference PLANNING and COSTING CAD values while creating PRODUCTION CAD
- PRODUCTION CAD reflects **reality**, not estimates

### 2. Approval Workflow
**Requirement**: ✅ **Yes, PRODUCTION CAD requires approval**

**Fields needed**:
- `approvalStatus`: "PENDING" | "APPROVED" | "REJECTED"
- `approvedBy`: User ID (FK to users)
- `approvedAt`: DateTime
- `approvalNotes`: Text (optional)

**Business Rules**:
- New PRODUCTION CAD starts as "PENDING"
- Only approved PRODUCTION CAD can be used in orders
- Who can approve? (Need to clarify: Admin? Production Manager? Merchandiser?)

### 3. CAD Relationship Between Purposes
**Requirement**: All three purposes are **independent but allow copying values**

**Implementation**:
- PRODUCTION, PLANNING, COSTING are separate CAD rows (same table, different `purpose` value)
- UI should allow "Copy from PLANNING" or "Copy from COSTING" button
- User can manually adjust copied values
- Each purpose maintains its own lifecycle

### 4. CAD Locking
**Requirement**: ✅ **Lock PRODUCTION CAD once orders exist**

**Business Rules**:
- Check if any `order_items.selectedCadId` references this CAD
- If yes → CAD becomes read-only (add `isLocked: true` flag)
- To make changes → must create new CAD version
- Display warning: "This CAD is locked because it's used in X orders"

---

### 5. Approval Authority
**Requirement**: **Admin users** and **Merchandisers** can approve PRODUCTION CAD

**Implementation**:
- Check user role: `role === 'ADMIN' || role === 'MERCHANDISER'`
- Add "Approve" button visible only to authorized users
- Show approval status badge on CAD rows

### 6. CAD Display in Spreadsheet
**Requirement**: Show all purposes together with **clear visual distinction**

**Implementation**:
- All CAD rows (PRODUCTION, PLANNING, COSTING) in same table
- Add visual separators/grouping by purpose
- Options:
  - **Option A**: Color-coded rows (Production=green, Planning=blue, Costing=orange)
  - **Option B**: Group header rows ("═══ PRODUCTION CAD ═══")
  - **Option C**: Badge in Purpose column with distinct colors
- Allow optional filtering dropdown to hide certain purposes

### 7. Copy from PLANNING/COSTING
**Requirement**: Copy **everything as-is** when duplicating CAD

**Implementation**:
- "Copy from PLANNING" button → duplicates entire CAD row
- Changes `purpose` to "PRODUCTION"
- Sets `approvalStatus` to "PENDING"
- Clears approval fields (approvedBy, approvedAt, approvalNotes)
- User can then edit any field (including greige/width for actual stock)

---

## PRODUCTION Purpose - Complete Specification

### Purpose Definition
**PRODUCTION CAD** is used for actual production orders where fabric will be purchased, cut, and manufactured. It reflects **actual fabric widths received** from stock or processing, not estimates.

### Lifecycle Workflow
```
1. User creates PRODUCTION CAD
   └─ Can copy from existing PLANNING or COSTING CAD
   └─ Uses actual finished widths from received fabric stock
   └─ Status: PENDING

2. Merchandiser/Admin reviews PRODUCTION CAD
   └─ Approves → Status: APPROVED
   └─ Rejects → Status: REJECTED (with notes)

3. APPROVED PRODUCTION CAD can be used in orders
   └─ Order items reference via selectedCadId

4. Once order uses PRODUCTION CAD
   └─ CAD becomes LOCKED (isLocked = true)
   └─ Read-only, cannot edit
   └─ To change: must create new CAD version
```

### Database Schema Changes Required

**New fields for `fabric_width_cad` table**:
```prisma
model fabric_width_cad {
  // ... existing fields ...

  // Approval workflow (for PRODUCTION purpose)
  approvalStatus   String?   // "PENDING" | "APPROVED" | "REJECTED" (only for PRODUCTION)
  approvedBy       String?   // FK to users.id
  approvedAt       DateTime?
  approvalNotes    String?   @db.Text

  // Locking (for PRODUCTION purpose)
  isLocked         Boolean   @default(false)
  lockedReason     String?   // "Used in X orders"
  lockedAt         DateTime?

  // Relations
  approver         users?    @relation("cad_approver", fields: [approvedBy], references: [id])

  @@index([approvalStatus])
  @@index([isLocked])
}
```

### Business Rules

#### Creation Rules
1. PRODUCTION CAD can be created:
   - From scratch (all fields empty)
   - By copying from existing PLANNING CAD
   - By copying from existing COSTING CAD
2. On creation, default values:
   - `purpose = "PRODUCTION"`
   - `approvalStatus = "PENDING"`
   - `isLocked = false`

#### Approval Rules
1. Only PENDING PRODUCTION CAD can be approved/rejected
2. Only users with role ADMIN or MERCHANDISER can approve
3. On approval:
   - `approvalStatus = "APPROVED"`
   - `approvedBy = currentUser.id`
   - `approvedAt = now()`
4. On rejection:
   - `approvalStatus = "REJECTED"`
   - `approvalNotes` = required (reason for rejection)

#### Usage Rules
1. Orders can only reference APPROVED PRODUCTION CAD
2. When `order_items.selectedCadId` is set to a PRODUCTION CAD:
   - Check `approvalStatus === "APPROVED"`
   - If not approved → show error: "Production CAD must be approved before use in orders"

#### Locking Rules
1. Before editing PRODUCTION CAD, check if locked:
   ```typescript
   const orderCount = await prisma.order_items.count({
     where: { selectedCadId: cadId }
   });

   if (orderCount > 0) {
     // Auto-lock the CAD
     await prisma.fabric_width_cad.update({
       where: { id: cadId },
       data: {
         isLocked: true,
         lockedReason: `Used in ${orderCount} order(s)`,
         lockedAt: new Date()
       }
     });
     // Block the edit
     throw new Error("Cannot edit: CAD is locked");
   }
   ```

2. Locked CAD fields are read-only in UI
3. To make changes to locked CAD:
   - User must create new CAD version (copy → edit → approve)

#### Deletion Rules
1. PRODUCTION CAD can be deleted only if:
   - `approvalStatus !== "APPROVED"` OR
   - `isLocked === false` (no orders using it)
2. Cannot delete locked PRODUCTION CAD
3. Show warning: "This CAD is used in X orders and cannot be deleted"

### UI Requirements

#### CAD Spreadsheet Table
1. Show all purposes (PRODUCTION, PLANNING, COSTING) together
2. Visual distinction:
   - Purpose badge with color coding:
     - PRODUCTION: Green badge
     - PLANNING: Blue badge
     - COSTING: Orange badge
3. Group rows by purpose with separator rows
4. Add filter dropdown (optional): "Show: All | Production Only | Planning Only | Costing Only"

#### Approval Status Column (PRODUCTION only)
- Show status badge:
  - PENDING: Yellow "Pending" badge
  - APPROVED: Green "Approved ✓" badge with approver name on hover
  - REJECTED: Red "Rejected ✗" badge with rejection reason on hover
- For PLANNING and COSTING: Show "-" or blank

#### Locked Status Indicator
- Show lock icon 🔒 if `isLocked === true`
- Tooltip: "Locked - Used in X orders"
- Disable all edit fields for locked CAD

#### Action Buttons
1. **Copy from PLANNING** button
   - Visible when purpose dropdown is set to "PRODUCTION"
   - Opens modal to select which PLANNING CAD to copy from
   - Duplicates entire row with purpose="PRODUCTION", status="PENDING"

2. **Copy from COSTING** button
   - Same behavior as above, but copies from COSTING CAD

3. **Approve** button (PRODUCTION only)
   - Visible only if:
     - Current user is ADMIN or MERCHANDISER
     - CAD status is PENDING
   - Click → Approve CAD (status="APPROVED")

4. **Reject** button (PRODUCTION only)
   - Visible only if:
     - Current user is ADMIN or MERCHANDISER
     - CAD status is PENDING
   - Click → Show rejection notes dialog → Reject CAD

### API Endpoints Required

**New endpoints**:
```
POST   /api/styles/:styleId/cad-table/row/:rowId/approve
POST   /api/styles/:styleId/cad-table/row/:rowId/reject
POST   /api/styles/:styleId/cad-table/copy-from-planning
POST   /api/styles/:styleId/cad-table/copy-from-costing
GET    /api/styles/:styleId/cad-table/lock-status/:rowId
```

**Modified endpoints**:
```
PUT    /api/styles/:styleId/cad-table/row/:rowId
  → Add lock check before update
  → Validate approval status for PRODUCTION purpose

DELETE /api/styles/:styleId/cad-table/row/:rowId
  → Add lock check before delete
  → Prevent deletion of APPROVED/LOCKED CAD
```

---

## Stock/GRN Integration for PRODUCTION CAD - Investigation Results

### Current Fabric Flow (As Implemented)

```
Fabric Procurement → Fabric Processing (greige) → Fabric Stock → CAD Planning
     ↓                        ↓                        ↓
orderedForStyleId    greigeId → fabricId        originStyleId
                     actual widths              + finishedWidth
                                                + cutableWidth
```

**Detailed Flow:**

1. **Fabric Procurement** (`fabric_procurement` table - lines 3884-3952)
   - Records purchase with `orderedForStyleId` (WHY it was bought)
   - Tracks greige or finished fabric purchase
   - Status: ORDERED → RECEIVED → PROCESSING → COMPLETED

2. **Fabric Processing** (`fabric_processing` table - lines 4050-4126, greige only)
   - Links: `procurementId` → `greigeId` → `finishedFabricId`
   - Records **actual finished widths** after dyeing/printing
   - Tracks shrinkage variance from expected
   - Creates finished fabric master record

3. **Fabric Stock** (`fabric_stock` table - lines 3957-4048)
   - Links to procurement via `procurementId`
   - Stores **actual finished widths**: `finishedWidth`, `cutableWidth` ✅
   - Tracks origin: `originStyleId`, `originOrderId` ✅
   - Status: AVAILABLE, RESERVED, CONSUMED, DEPLETED

4. **CAD Planning** (`fabric_width_cad` table)
   - Currently uses `greigeId` + `cutableWidth` (user enters manually)
   - **NO direct link to fabric_stock** ⚠️

### Key Database Fields Found

**fabric_stock.originStyleId** - Already exists! ✅
```prisma
model fabric_stock {
  originStyleId String? // Style that originally caused purchase
  originStyle   styles? @relation("StockOriginStyle", fields: [originStyleId], references: [id])

  finishedWidth Decimal @db.Decimal(10, 2) // Width after processing
  cutableWidth  Decimal @db.Decimal(10, 2) // Usable cutting width

  // CAD variance tracking (already exists!)
  plannedCad     Decimal? @db.Decimal(10, 4)
  actualCad      Decimal? @db.Decimal(10, 4)
  varianceReason String?
}
```

### Stock-to-CAD Integration Design

#### UI Flow for PRODUCTION CAD Creation

**Step 1: User clicks "Create PRODUCTION CAD"**

Backend query:
```typescript
GET /api/styles/:styleId/fabric-stock?status=AVAILABLE

// Returns stock entries where:
// - fabric_stock.originStyleId = styleId OR
// - fabric_procurement.orderedForStyleId = styleId
```

**Step 2: Show Stock Selection Modal**

Display available stock with:
- Fabric name + type (greige → finished)
- Actual finished width (e.g., 44.0″)
- Cutable width (e.g., 42.5″)
- Quantity available
- Quality grade (A/B/DEFECT)
- Roll numbers
- Received date

**Step 3: User selects stock → Auto-populate CAD**
- `fabricStockId`: Selected stock ID
- `cutableWidth`: From stock.cutableWidth
- `greigeId`: From stock → procurement → greigeId
- Badge: "📦 Using Stock: R123 (42.5″ × 500m)"

**Step 4: Variance Warning (if PLANNING CAD exists)**
```
⚠️ Width Variance Detected
PLANNING CAD: 44.0″ (estimated)
STOCK CAD:    42.5″ (actual from R123)
Variance:     -1.5″ (-3.4%)

Impact: +15m fabric needed for 1000 pieces
[Use Actual Width] [Cancel]
```

#### Database Schema Changes Required

**Add to `fabric_width_cad` table:**
```prisma
model fabric_width_cad {
  // ... existing fields ...

  // Stock Integration (PRODUCTION purpose only)
  fabricStockId    String?   // FK to fabric_stock ✅ NEW
  procurementId    String?   // FK to fabric_procurement (traceability) ✅ NEW

  // Variance from PLANNING to PRODUCTION
  planningCadWidth Decimal?  @db.Decimal(10, 2) // Original PLANNING width ✅ NEW
  widthVariance    Decimal?  @db.Decimal(10, 2) // actualWidth - planningWidth ✅ NEW
  variancePercent  Decimal?  @db.Decimal(5, 2)  // Percentage ✅ NEW

  // Relations ✅ NEW
  fabricStock      fabric_stock?       @relation(fields: [fabricStockId], references: [id])
  procurement      fabric_procurement? @relation(fields: [procurementId], references: [id])

  @@index([fabricStockId])
  @@index([procurementId])
}
```

#### API Endpoints Required

**New endpoints:**
```
GET    /api/styles/:styleId/fabric-stock
  → List available stock for this style
  → Filter: fabricId, status, qualityGrade
  → Return: finishedWidth, cutableWidth, quantityAvailable, rollNumbers

POST   /api/styles/:styleId/cad-table/link-stock
  → Link CAD row to fabric stock
  → Auto-populate cutableWidth from stock
  → Calculate variance from PLANNING CAD (if exists)
  → Payload: { cadRowId, fabricStockId }
```

#### Business Rules

1. **PRODUCTION CAD requires stock linkage**
   - `fabricStockId` must be set
   - Validation: stock.status === "AVAILABLE"
   - Error: "Stock entry required for PRODUCTION CAD"

2. **Stock reservation on approval**
   - When PRODUCTION CAD → APPROVED: reserve stock
   - Update `fabric_stock.quantityReserved`
   - Create `fabric_stock_allocation` record

3. **Width variance threshold**
   - If `|actualWidth - planningWidth| > 2″` → ⚠️ Warning
   - If `variancePercent > 5%` → Require approval notes

4. **Stock availability check**
   - Before approval: verify `quantityAvailable >= estimatedConsumption`

5. **FIFO (First In, First Out)**
   - Multiple stock lots → prioritize oldest
   - Sort by `receivedDate ASC`

### Complete PRODUCTION CAD Workflow (Updated)

```
1. User opens CAD Planning page

2. User clicks "Create PRODUCTION CAD"
   └─ Backend checks: Does style have fabric stock?
      ├─ YES → Show "Select from Stock" modal
      │   ├─ Display available stock (sorted by receivedDate)
      │   ├─ User selects stock lot
      │   ├─ Auto-populate: cutableWidth, greigeId
      │   ├─ Link: fabricStockId, procurementId
      │   └─ If PLANNING CAD exists:
      │       └─ Calculate variance → Show warning if >5%
      │
      └─ NO → Show error message
          └─ "Stock entry required for PRODUCTION CAD"
          └─ Provide link to Fabric Stock Entry page

3. User fills: size breakdowns, layer length, margin
   └─ CAD Average auto-calculates

4. User submits → Status: PENDING
   └─ Validate:
      ├─ fabricStockId is set
      ├─ Stock is AVAILABLE
      ├─ Quantity sufficient
      └─ All required fields filled

5. Merchandiser/Admin reviews
   └─ See: stock details, variance from PLANNING
   └─ Approve → Status: APPROVED
      ├─ Reserve stock: update quantityReserved
      ├─ Create stock_allocation record
      └─ CAD now usable in orders

6. Order creation
   └─ Select APPROVED PRODUCTION CAD
   └─ Stock auto-allocated from linked lot
```

### Files to Modify

**Backend:**
1. [backend/prisma/schema.prisma](backend/prisma/schema.prisma) - Add fabricStockId, procurementId to fabric_width_cad
2. [backend/src/controllers/style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts) - Add stock linkage endpoints
3. [backend/src/controllers/fabric-stock.controller.ts](backend/src/controllers/fabric-stock.controller.ts) - Add style stock query

**Frontend:**
4. [frontend/src/components/cad/CADSpreadsheetTable.tsx](frontend/src/components/cad/CADSpreadsheetTable.tsx) - Add stock selection modal, variance warnings
5. [frontend/src/services/fabricStockService.ts](frontend/src/services/fabricStockService.ts) - Add stock query by style
6. [frontend/src/types/style.types.ts](frontend/src/types/style.types.ts) - Add fabricStockId, procurementId to CAD type

---

## PLANNING Purpose - Complete Specification

### Purpose Definition
**PLANNING CAD** is created after sample approval but before bulk orders. It uses manually entered estimated fabric widths for planning purposes and requires approval before proceeding to production.

### Key Characteristics (User Requirements)
- **When Created**: After sample approval, before bulk order
- **Approval Required**: Yes (requires approval)
- **Width Source**: Standard/assumed widths (user enters manually)
- **Editability**: Version control - create new version instead of editing
- **Used For**: Bulk production planning, initial fabric requirement estimation

### Lifecycle Workflow
```
1. Sample approved → User creates PLANNING CAD
   └─ Manually enter estimated fabric widths
   └─ Based on greige specifications or experience
   └─ Status: PENDING

2. Merchandiser/Designer reviews PLANNING CAD
   └─ Approves → Status: APPROVED
   └─ Rejects → Status: REJECTED (with notes)

3. APPROVED PLANNING CAD becomes baseline
   └─ Used for fabric procurement planning
   └─ Can be copied to PRODUCTION CAD later

4. If changes needed to APPROVED PLANNING CAD
   └─ Create new version (v2, v3, etc.)
   └─ Original version remains locked
   └─ New version starts as PENDING
```

### Database Schema Changes Required

**Add to `fabric_width_cad` table:**
```prisma
model fabric_width_cad {
  // ... existing fields ...

  // Version Control (for PLANNING and COSTING purposes)
  version          Int       @default(1)
  supersededById   String?   // Points to newer version if superseded
  supersedes       fabric_width_cad? @relation("CADVersionHistory", fields: [supersededById], references: [id])
  supersededBy     fabric_width_cad? @relation("CADVersionHistory")

  // Approval workflow (for PLANNING purpose)
  approvalStatus   String?   // "PENDING" | "APPROVED" | "REJECTED"
  approvedBy       String?   // FK to users.id
  approvedAt       DateTime?
  approvalNotes    String?   @db.Text

  @@index([version])
  @@index([supersededById])
}
```

### Business Rules

#### Creation Rules
1. PLANNING CAD created after sample approval
2. User manually enters:
   - Estimated cutable width (based on greige specs or experience)
   - All pattern parts for components
   - Size breakdowns
   - Layer length and margins
3. On creation, defaults:
   - `purpose = "PLANNING"`
   - `version = 1`
   - `approvalStatus = "PENDING"`

#### Approval Rules
1. Only PENDING PLANNING CAD can be approved/rejected
2. Who can approve: Admin, Merchandiser, Designer (need to confirm roles)
3. On approval:
   - `approvalStatus = "APPROVED"`
   - `approvedBy = currentUser.id`
   - `approvedAt = now()`
4. On rejection:
   - `approvalStatus = "REJECTED"`
   - `approvalNotes` = required

#### Version Control Rules
1. APPROVED PLANNING CAD cannot be edited directly
2. To make changes:
   - Click "Create New Version" button
   - Copy all fields from current version
   - Increment version: v1 → v2
   - Link to previous version via `supersededById`
   - New version starts as PENDING
3. Original version marked as superseded:
   - `supersededBy` points to new version
   - Remains in history for audit trail

#### Usage Rules
1. PLANNING CAD used for:
   - Fabric requirement estimation
   - Procurement planning
   - Initial costing (if COSTING CAD not created)
2. Can be copied to PRODUCTION CAD once fabric is in stock
3. Comparison baseline for variance tracking

### UI Requirements

#### Version Indicator
- Show version badge: "v1", "v2", "v3"
- If superseded, show: "v1 (Superseded by v2)" with link
- Highlight latest version in green

#### Approval Status Column (PLANNING only)
- Same as PRODUCTION:
  - PENDING: Yellow badge
  - APPROVED: Green badge
  - REJECTED: Red badge

#### Action Buttons
1. **Create New Version** button (PLANNING only)
   - Visible only if current version is APPROVED
   - Creates v2, v3, etc.
   - Copies all values from current version

2. **Approve/Reject** buttons
   - Same as PRODUCTION
   - Visible to Admin/Merchandiser/Designer

3. **Copy to PRODUCTION** button
   - Visible on APPROVED PLANNING CAD rows
   - Creates new PRODUCTION CAD with same values
   - Prompts for stock selection

### API Endpoints Required

**New endpoints:**
```
POST   /api/styles/:styleId/cad-table/planning/:rowId/create-version
  → Create new version of PLANNING CAD
  → Increment version number
  → Link to previous version
  → Return new CAD with status=PENDING

GET    /api/styles/:styleId/cad-table/planning/versions/:baseId
  → Get all versions of a PLANNING CAD
  → Return version history with approval status
```

### Differences from PRODUCTION CAD

| Aspect | PLANNING CAD | PRODUCTION CAD |
|--------|--------------|----------------|
| **When Created** | After sample approval | After fabric in stock |
| **Width Source** | Manual estimate | Actual stock width |
| **Stock Link** | No stock linkage | Must link to fabric_stock |
| **Approval** | Yes (Merchandiser/Designer) | Yes (Admin/Merchandiser) |
| **Editability** | Version control | Locked when used in orders |
| **Variance Tracking** | Baseline for comparison | Compared to PLANNING |
| **Purpose** | Planning & estimation | Actual production |

---

## COSTING Purpose - Complete Specification

### Purpose Definition
**COSTING CAD** is created very early for quotations to customers. It uses standard widths from greige master specifications and requires approval as part of the overall style costing approval.

### Key Characteristics (User Requirements)
- **When Created**: Very early - for quotations to customers
- **Approval Required**: Yes (part of costing approval)
- **Width Source**: Standard widths from greige master
- **Relationship**: Can be copied to PLANNING CAD after approval
- **Used For**: Quotation pricing, cost estimation

### Lifecycle Workflow
```
1. Customer inquiry → Create style costing
   └─ Create COSTING CAD as part of costing
   └─ Use greige master expected widths
   └─ Status: PENDING (linked to costing sheet)

2. Costing sheet prepared
   └─ COSTING CAD calculates fabric consumption
   └─ Feeds into total fabric cost
   └─ Part of overall quotation

3. Costing approval workflow
   └─ When costing sheet is APPROVED
   └─ All COSTING CADs auto-approved
   └─ Status: APPROVED

4. After quotation sent/order won
   └─ Copy COSTING CAD to PLANNING CAD
   └─ Refine estimates based on actual samples
```

### Database Schema Changes Required

**Link to style_costing table:**
```prisma
model fabric_width_cad {
  // ... existing fields ...

  // Costing Integration (for COSTING purpose)
  styleCostingId   String?   // FK to style_costing
  styleCosting     style_costing? @relation(fields: [styleCostingId], references: [id])

  // Auto-approval from parent costing
  autoApprovedFrom String?   // "COSTING_SHEET" | "MANUAL"

  @@index([styleCostingId])
}
```

### Business Rules

#### Creation Rules
1. COSTING CAD created when preparing quotation
2. Automatically use greige master widths:
   - `cutableWidth` = greige.expectedFinishedWidthMin - 2 inches (conservative)
   - OR use greige.expectedFinishedWidthMax if specified
3. On creation, defaults:
   - `purpose = "COSTING"`
   - `approvalStatus = "PENDING"`
   - `styleCostingId` = parent costing sheet ID

#### Approval Rules
1. COSTING CAD approval linked to costing sheet
2. When `style_costing.approvalStatus = "APPROVED"`:
   - All linked COSTING CADs auto-approved
   - `autoApprovedFrom = "COSTING_SHEET"`
3. Can also be manually approved before costing sheet approval

#### Auto-Population Rules
1. When greige is selected:
   - Auto-fill `cutableWidth` from greige master
   - Use `expectedFinishedWidthMin` for conservative estimate
   - Show tooltip: "Using greige standard: 42″ (conservative)"

2. Calculation for conservative estimate:
   ```typescript
   cutableWidth = greige.expectedFinishedWidthMin - 2 // Safety margin
   // OR
   cutableWidth = greige.expectedFinishedWidthMax - selvedge // If specified
   ```

#### Usage Rules
1. COSTING CAD used for:
   - Calculating fabric cost in quotations
   - Price estimation before order confirmation
   - Cost comparison (estimated vs actual)
2. Once approved, can be copied to PLANNING CAD
3. Locked after quotation sent (prevent cost changes)

### Integration with Style Costing Module

**Fabric cost calculation:**
```typescript
// In style_costing_fabric_items
{
  fabricCADId: "costing-cad-uuid",  // Links to COSTING CAD
  cadAverage: 2.15,                  // From COSTING CAD
  requiredQuantity: 2150,            // cadAverage × 1000 pcs
  ratePerMeter: 150,                 // Fabric cost
  totalCost: 322500                  // requiredQuantity × ratePerMeter
}
```

### UI Requirements

#### Costing Link Indicator
- Show badge: "🔗 Costing v3" (links to style costing sheet)
- Click → Navigate to costing sheet
- Show costing approval status

#### Auto-Approval Status
- If auto-approved from costing sheet:
  - Badge: "✓ Auto-Approved (Costing Sheet)"
  - Tooltip: "Approved via Costing Sheet #CS-2025-001"

#### Action Buttons
1. **Copy to PLANNING** button (COSTING only)
   - Visible on APPROVED COSTING CAD
   - Creates new PLANNING CAD with same values
   - User can then refine estimates

2. **View Costing Sheet** button
   - Opens linked style costing sheet
   - Shows fabric cost breakdown

### API Endpoints Required

**New endpoints:**
```
POST   /api/styles/:styleId/cad-table/costing-to-planning
  → Copy COSTING CAD to PLANNING CAD
  → Create new PLANNING CAD with same values
  → Status starts as PENDING (requires separate approval)

GET    /api/styles/:styleId/cad-table/costing-link/:costingId
  → Get all COSTING CADs for a style costing sheet
  → Return linked CADs with approval status
```

### Differences from PLANNING and PRODUCTION CAD

| Aspect | COSTING CAD | PLANNING CAD | PRODUCTION CAD |
|--------|-------------|--------------|----------------|
| **When Created** | For quotations (very early) | After sample approval | After fabric in stock |
| **Width Source** | Greige master standard | Manual estimate | Actual stock width |
| **Approval** | Auto from costing sheet | Manual approval | Manual approval |
| **Editability** | Locked after quotation sent | Version control | Locked when used |
| **Costing Link** | Linked to style_costing | No link | No link |
| **Stock Link** | No link | No link | Must link to fabric_stock |
| **Purpose** | Quotation pricing | Planning | Actual production |

---

## Summary: Three CAD Purposes - Complete Overview

### Timeline and Flow

```
COSTING CAD (Quotation Stage)
   ↓ [Copy to PLANNING]
PLANNING CAD (After Sample Approval)
   ↓ [Copy to PRODUCTION]
PRODUCTION CAD (After Fabric in Stock)
   ↓
Orders & Production
```

### Complete Field Comparison

| Field | COSTING | PLANNING | PRODUCTION |
|-------|---------|----------|------------|
| `purpose` | "COSTING" | "PLANNING" | "PRODUCTION" |
| `cutableWidth` | From greige master | Manual entry | From fabric_stock |
| `approvalStatus` | PENDING/APPROVED | PENDING/APPROVED/REJECTED | PENDING/APPROVED/REJECTED |
| `approvedBy` | Auto or manual | Manual | Manual |
| `version` | No versioning | v1, v2, v3... | No versioning |
| `supersededById` | - | For versioning | - |
| `styleCostingId` | Required | - | - |
| `fabricStockId` | - | - | Required |
| `procurementId` | - | - | For traceability |
| `isLocked` | After quotation | Never (use versions) | When used in orders |
| `planningCadWidth` | - | - | For variance tracking |
| `widthVariance` | - | - | vs PLANNING width |

### Files to Modify (All Purposes)

**Backend:**
1. [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
   - Add version control fields (version, supersededById)
   - Add costing link (styleCostingId)
   - Add stock link (fabricStockId, procurementId)
   - Add approval fields (approvalStatus, approvedBy, approvedAt)
   - Add variance tracking (planningCadWidth, widthVariance)

2. [backend/src/controllers/style-cad-planning.controller.ts](backend/src/controllers/style-cad-planning.controller.ts)
   - Add version creation endpoint (PLANNING)
   - Add copy endpoints (COSTING→PLANNING, PLANNING→PRODUCTION)
   - Add approval endpoints (all purposes)
   - Add stock linkage endpoint (PRODUCTION)
   - Add auto-approval logic (COSTING from costing sheet)

3. [backend/src/controllers/fabric-stock.controller.ts](backend/src/controllers/fabric-stock.controller.ts)
   - Add style stock query endpoint

**Frontend:**
4. [frontend/src/components/cad/CADSpreadsheetTable.tsx](frontend/src/components/cad/CADSpreadsheetTable.tsx)
   - Add purpose visual distinction (color-coded badges)
   - Add approval status column
   - Add version indicator (PLANNING)
   - Add locked indicator (PRODUCTION)
   - Add action buttons (Copy, Approve, Create Version, Link Stock)
   - Add stock selection modal (PRODUCTION)
   - Add variance warnings (PRODUCTION)

5. [frontend/src/services/fabricStockService.ts](frontend/src/services/fabricStockService.ts)
   - Add stock query by style

6. [frontend/src/types/style.types.ts](frontend/src/types/style.types.ts)
   - Add new fields to CAD type
   - Add approval status enums
   - Add version tracking types

---

## Implementation Roadmap

### Phase 1: Database Schema
- [ ] Add all new fields to fabric_width_cad table
- [ ] Create migration script
- [ ] Update seed data for testing

### Phase 2: Backend - Approval Workflow
- [ ] Implement approval endpoints (all purposes)
- [ ] Add validation rules for each purpose
- [ ] Implement locking logic (PRODUCTION)
- [ ] Add auto-approval for COSTING from costing sheet

### Phase 3: Backend - Version Control
- [ ] Implement version creation (PLANNING)
- [ ] Add version history query
- [ ] Handle superseded relationships

### Phase 4: Backend - Stock Integration
- [ ] Implement stock query by style
- [ ] Add stock linkage endpoint
- [ ] Implement variance calculation
- [ ] Add stock reservation on PRODUCTION approval

### Phase 5: Backend - Copy Operations
- [ ] Implement COSTING → PLANNING copy
- [ ] Implement PLANNING → PRODUCTION copy
- [ ] Handle field transformations during copy

### Phase 6: Frontend - UI Visual Distinction
- [ ] Add purpose badges with colors
- [ ] Add approval status column
- [ ] Add version indicators
- [ ] Add locked indicators

### Phase 7: Frontend - Action Buttons
- [ ] Implement Approve/Reject buttons
- [ ] Implement Create Version button (PLANNING)
- [ ] Implement Copy buttons (all purposes)
- [ ] Implement Link Stock button (PRODUCTION)

### Phase 8: Frontend - Stock Integration UI
- [ ] Create stock selection modal
- [ ] Add variance warning dialogs
- [ ] Show stock details in CAD table

### Phase 9: Testing
- [ ] Test COSTING CAD creation from costing sheet
- [ ] Test PLANNING CAD versioning workflow
- [ ] Test PRODUCTION CAD stock linkage
- [ ] Test copy operations between purposes
- [ ] Test approval workflows
- [ ] Test locking mechanisms

### Phase 10: Documentation
- [ ] Update CAD-Planning.md with all three purposes
- [ ] Create user guide for each purpose
- [ ] Document approval workflows
- [ ] Create workflow diagrams

---

## Next Steps

The complete specification for all three CAD purposes (PRODUCTION, PLANNING, COSTING) is now documented. Ready to begin implementation when you approve.

---

## APPENDIX: Multi-Component Selection Enhancement

### User Request
"Now if a style has multiple component and if those need to be planned together how do i select multiple component?"

### Architecture Clarification

**Corrected Understanding of Component-Fabric Structure:**

The system does NOT have a simple "components" concept. The actual architecture is:

```
styles
  └─ style_components (e.g., "Blouse", "Skirt", "Belt")
      └─ style_fabrics (junction table: component × fabric pairing)
          └─ fabric_width_cad (CAD rows linked to style_fabrics)
```

**Key Database Tables:**
1. `style_components` - Component instances (e.g., "Blouse" in Style-001)
2. `style_fabrics` - **Component-Fabric pairings** (CAD links here via `styleFabricId`)
3. `fabric_width_cad` - CAD row data (each row = one style_fabric + optional pattern part)

**What User Actually Selects:**
- NOT components directly
- Instead: `style_fabrics` (component-fabric pairs)
- Example: "Blouse + Cotton Voile (PRINTED)" is ONE style_fabric

### Solution: Multi-Select Style Fabrics

Allow users to select multiple `style_fabrics` at once and batch-create CAD rows.

#### Implementation Plan

**File:** `frontend/src/components/cad/CADSpreadsheetTable.tsx`

**1. Add Multi-Select State (after line 209):**
```typescript
const [selectedStyleFabrics, setSelectedStyleFabrics] = useState<string[]>([]);
const [selectAllStyleFabrics, setSelectAllStyleFabrics] = useState(false);
```

**2. Replace Add Row Dialog Buttons with Checkboxes:**

Current dialog (lines 1153-1187) shows buttons - replace with checkboxes:
- Add "Select All" toggle at top
- Each style_fabric gets a checkbox
- Show selected count
- Button text: "Add N Rows"

**3. Add Batch Creation Handler:**
```typescript
const handleBatchAddRows = async () => {
  if (selectedStyleFabrics.length === 0) return;
  setAddingRow(true);
  try {
    for (const styleFabricId of selectedStyleFabrics) {
      await onAddRow(styleFabricId); // Call existing API
    }
    notify.success(`Created ${selectedStyleFabrics.length} CAD rows`);
    setSelectedStyleFabrics([]);
    setAddRowDialogOpen(false);
  } finally {
    setAddingRow(false);
  }
};
```

**4. Import Checkbox:**
```typescript
import { Checkbox } from '@/components/ui/checkbox';
```

#### Backend Changes
**NONE REQUIRED** - Existing `addCADTableRow` endpoint supports one-at-a-time creation. Frontend calls it N times.

#### Benefits
- **Time Saved:** 60-70% fewer clicks for multi-component styles
- **Consistency:** All selected fabrics get same purpose at once
- **Simple:** No backend changes, reuses existing API

#### Testing Checklist
- [ ] Multi-select works correctly
- [ ] Select All toggle works
- [ ] Batch creation succeeds
- [ ] Partial failures handled
- [ ] Count displays correctly
- [ ] Works with all purposes
