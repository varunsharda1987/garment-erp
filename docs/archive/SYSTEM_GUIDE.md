# Garment ERP - Comprehensive System Guide
## Complete Documentation: Materials, Stock, Job Work & Processing

**Last Updated:** 2025-12-06
**Version:** 2.0

---

## Table of Contents

1. [Material System Architecture](#1-material-system-architecture)
2. [Stock Movement System](#2-stock-movement-system)
3. [Job Work Processing System](#3-job-work-processing-system)
4. [Integration & Data Flow](#4-integration--data-flow)
5. [Quick Reference Guides](#5-quick-reference-guides)

---

# 1. MATERIAL SYSTEM ARCHITECTURE

## 1.1 Overview: Polymorphic Material Design

Your ERP uses a **sophisticated polymorphic material system** where:

- ✅ **Fabrics ARE materials** - Stored in `materials` table with type `GREIGE_FABRIC` or `FINISHED_FABRIC`
- ✅ **Specialized masters exist** - Separate detailed tables for fabric, lace, button, thread, zipper, elastic, label, packaging
- ✅ **Hybrid architecture** - Generic `materials` table with polymorphic foreign keys to specialized masters
- ✅ **Consistent naming** - Each type has its own code field (fabricCode, laceCode, buttonCode, etc.)

### Core Architecture

```prisma
model materials {
  id             String       @id
  code           String       @unique
  name           String
  materialType   MaterialType @default(GENERIC)  // ← Determines which master table
  categoryId     String
  unit           Unit

  // Polymorphic Foreign Keys (only ONE is set based on materialType)
  greigeId       String?      // → greige_master (GREIGE_FABRIC)
  fabricId       String?      // → fabric_master (FINISHED_FABRIC)
  laceId         String?      // → lace_master (LACE)
  buttonId       String?      // → button_master (BUTTON)
  threadId       String?      // → thread_master (THREAD)
  zipperId       String?      // → zipper_master (ZIPPER)
  elasticId      String?      // → elastic_master (ELASTIC)
  labelId        String?      // → label_master (LABEL)
  packagingId    String?      // → packaging_master (PACKAGING)
}
```

## 1.2 Material Type Taxonomy

### 13 Material Types

```
FABRICS
├── GREIGE_FABRIC → greige_master (raw unfinished fabric)
└── FINISHED_FABRIC → fabric_master (dyed/printed fabric)

TRIMS & ACCESSORIES
├── TRIMS (generic category)
├── LACE → lace_master
├── BUTTON → button_master
├── THREAD → thread_master
├── ZIPPER → zipper_master
├── ELASTIC → elastic_master
├── LABEL → label_master
├── PACKAGING → packaging_master
└── ACCESSORIES (generic - tags, hangers, poly bags)

OTHER
├── GENERIC (no specialized master)
└── SERVICE (subcontracting services)
```

## 1.3 Naming Conventions

| Material Type | Code Field | Example | Master Table |
|---------------|------------|---------|--------------|
| Greige Fabric | `greigeCode` | "GRG-001" | `greige_master` |
| Finished Fabric | `fabricCode` | "FAB-001" | `fabric_master` |
| Lace | `laceCode` | "LACE-0001" | `lace_master` |
| Button | `buttonCode` | "BTN-0001" | `button_master` |
| Thread | `threadCode` | "THD-0001" | `thread_master` |
| Zipper | `zipperCode` | "ZIP-0001" | `zipper_master` |
| Elastic | `elasticCode` | "ELS-0001" | `elastic_master` |
| Label | `labelCode` | "LBL-0001" | `label_master` |
| Packaging | `packagingCode` | "PKG-0001" | `packaging_master` |

**Pattern:** `{type}Code` + `{type}Name` + `{type}_master`

## 1.4 Fabric Hierarchy (Special Case)

Fabrics have a **two-level hierarchy**:

```
greige_master (raw fabric)
    ↓ Processing (dyeing/printing)
fabric_master (finished fabric)
    ↓ Multiple widths
fabric_width_cad (CAD consumption per width)
```

**Example:**
```
Greige: "40x40 Poplin Greige" (GRG-001)
    ↓ Dyeing
    ├── "Navy Blue Poplin" (FAB-001)
    ├── "White Poplin" (FAB-002)
    └── "Red Poplin" (FAB-003)
```

## 1.5 API Routes

### Generic Materials
```
/api/materials
├── GET    /                          // List all materials
├── POST   /                          // Create material
├── GET    /:id                       // Get by ID
├── PUT    /:id                       // Update
└── DELETE /:id                       // Delete
```

### Specialized Materials
```
/api/fabrics                    // Finished fabrics
/api/fabrics/greige            // Greige fabrics
/api/fabrics/cad               // CAD data
/api/materials/lace            // Lace master
/api/materials/button          // Button master
/api/materials/thread          // Thread master
/api/materials/zipper          // Zipper master
/api/materials/elastic         // Elastic master
/api/materials/label           // Label master
/api/materials/packaging       // Packaging master
```

---

# 2. STOCK MOVEMENT SYSTEM

## 2.1 Overview

The stock movement system tracks ALL inventory transactions with full audit trail, cost valuation, and warehouse-level tracking.

### Core Tables
- `stock_movements` - Audit trail of all transactions
- `stock_transactions` - Cost/valuation tracking (weighted average)
- `stock_levels` - Current inventory by warehouse

## 2.2 Stock INWARD Methods

### Method 1: Via GRN (RECOMMENDED)
**Flow:** Purchase Order → GRN → Quality Check → Approve GRN → **Automatic Stock In**

```
Purchase Order (PO2511-0001)
    ↓
Goods Receiving Note (GRN2511-0001) - Status: PENDING_QC
    ↓
Quality Check (Accept 950, Reject 50)
    ↓
Approve GRN → AUTOMATIC STOCK MOVEMENT CREATED
    ↓
stock_movements:
  - movementType: STOCK_IN
  - referenceType: 'GRN'
  - referenceNumber: 'GRN2511-0001'
  - quantity: 950 (accepted only)
  - rate: 100.00 (from PO)
    ↓
Stock Levels Updated Automatically
```

**Advantages:**
- ✅ Full audit trail (PO → GRN → Stock)
- ✅ Quality control before stock in
- ✅ Automatic costing from PO price
- ✅ Links to supplier
- ✅ Partial receiving support
- ✅ Rejection tracking

**Pages:**
- Create GRN: `/inventory/grn/new`
- Approve GRN: `/inventory/grn/:id/approve`

---

### Method 2: Direct Stock In
**Flow:** Manual form entry → Stock In

**Page:** `/inventory/movements/stock-in`

**Form Fields:**
- Material (dropdown)
- Warehouse (dropdown)
- Quantity (number)
- Unit (dropdown: METER, PIECE, KG, etc.)
- Rate per Unit (optional - for valuation)
- Reference Type (GRN, PURCHASE_ORDER, RETURN, OTHER)
- Reference Number (text field)
- Remarks (optional)

**Use Cases:**
- Opening stock entry
- Returns from customers
- Manual adjustments
- Quick receipt entries

---

### Method 3: Stock Transfer IN
**Flow:** Transfer from another warehouse → Stock Out from source → Stock In to destination

**Page:** `/inventory/movements/transfer`

**Creates TWO movements:**
- TRANSFER_OUT in source warehouse
- TRANSFER_IN in destination warehouse

**Key Features:**
- Swap button to reverse warehouses
- Validates sufficient stock in source
- Maintains valuation rate during transfer

---

### Method 4: Stock Adjustment IN
**Flow:** Physical count surplus → Adjustment entry

**Page:** `/inventory/movements/adjustment`

**Use Cases:**
- Stock count surplus
- Found materials
- Correction of data entry errors

---

### Method 5: Job Work Return
**Flow:** Material sent to processor → Processing complete → Delivery created → Stock In

**Integration:** Automatic from Job Work Processing module

**Creates:**
- STOCK_OUT from JOB_WORK (virtual warehouse)
- STOCK_IN to FINISHED_GOODS

---

### Method 6: Production Return
**Flow:** Material issued to production → Excess not used → Return to warehouse

**Creates:** STOCK_IN with referenceType: 'PRODUCTION_RETURN'

---

## 2.3 Stock OUTWARD Methods

### Method 1: Material Requisition (to Production)
**Flow:** Production order → Material requisition → Stock Out

**Validates:** Sufficient stock available

**Uses:** Weighted average valuation rate

---

### Method 2: Job Work Send (to Processor)
**Flow:** Create Processing Batch → Send to Processor → **Dual Stock Movement**

**Creates TWO movements:**
1. STOCK_OUT from RAW_MATERIAL warehouse
2. STOCK_IN to JOB_WORK warehouse (virtual)

**Integration:** Automatic from Job Work Processing module

---

### Method 3: Stock Transfer OUT
**Page:** `/inventory/movements/transfer`

**Paired with:** TRANSFER_IN at destination

---

### Method 4: Sales Dispatch
**Flow:** Sales order → Pick materials → Dispatch → Stock Out

**Creates:** STOCK_OUT with referenceType: 'SALES_ORDER'

---

### Method 5: Stock Adjustment OUT
**Flow:** Physical count shortage → Adjustment entry

**Use Cases:**
- Stock count shortage
- Damaged/expired materials
- Theft/loss
- Data correction

---

### Method 6: Wastage/Scrap
**Flow:** Production process → Scrap generation → Stock Out

**Creates:** STOCK_OUT with referenceType: 'WASTAGE'

---

## 2.4 Stock Movement Reference Types

| Reference Type | Description | Auto-Populated? | Integration |
|---------------|-------------|-----------------|-------------|
| `GRN` | Goods Receipt Note | ✅ Yes | Via GRN approval |
| `PURCHASE_ORDER` | Direct PO reference | ❌ No (text field) | Manual entry |
| `MATERIAL_REQUISITION` | Production issue | ✅ Yes | Via requisition |
| `PROCESSING_BATCH` | Job work send | ✅ Yes | Via batch creation |
| `PROCESSING_DELIVERY` | Job work receive | ✅ Yes | Via delivery |
| `TRANSFER` | Warehouse transfer | ✅ Yes | Via transfer |
| `ADJUSTMENT` | Stock adjustment | ✅ Yes | Via adjustment |
| `SALES_ORDER` | Sales dispatch | ✅ Yes | Via sales order |
| `RETURN` | Production return | ❌ No (manual) | Manual entry |
| `OTHER` | Miscellaneous | ❌ No (manual) | Manual entry |

## 2.5 Pages & Navigation

```
Stock Movements Hub: /inventory/movements

Actions:
├── [Stock In] → /inventory/movements/stock-in
├── [Stock Out] → /inventory/movements/stock-out
├── [Transfer] → /inventory/movements/transfer
└── [Adjustment] → /inventory/movements/adjustment

Table shows:
- Date & Time
- Movement Type (with icons: ↓ IN, ↑ OUT, ⇄ TRANSFER)
- Material (code + name)
- Warehouse
- Quantity (+ for IN, - for OUT)
- Reference Number
- Performed By
```

---

# 3. JOB WORK PROCESSING SYSTEM

## 3.1 Overview

The Job Work Processing system tracks materials sent to external processors (dyeing mills, printing units, embroidery shops) for value-addition services.

### Key Features
- ✅ Multi-stage processing (greige → dyeing → printing → embroidery)
- ✅ IN_TRANSIT status tracking
- ✅ Partial deliveries support
- ✅ Rework scenarios
- ✅ Processor facility/building tracking
- ✅ Automatic stock movements
- ✅ Virtual JOB_WORK warehouse

## 3.2 Core Data Models

### processing_batch (Parent Record)
Tracks overall job work lifecycle

```prisma
model processing_batch {
  id                    String @id
  batchNumber           String @unique  // "PB2511-0001"

  materialType          String          // "GREIGE" or "FABRIC"
  greigeId              String?
  fabricId              String?

  totalQuantitySent     Decimal
  totalQuantityReceived Decimal @default(0)
  quantityInProcess     Decimal
  quantityInTransit     Decimal @default(0)
  quantityRejected      Decimal @default(0)

  overallStatus         String @default("ACTIVE")
  totalCostIncurred     Decimal @default(0)

  stages                processing_stage[]
  movements             processing_movement[]
  deliveries            processing_delivery[]
}
```

### processing_stage (Individual Processing Steps)
Tracks each processing step in the workflow

```prisma
model processing_stage {
  id                    String @id
  batchId               String
  stageNumber           Int                // 1, 2, 3... (sequence)

  processorId           String             // Supplier doing this stage
  processorFacility     String?            // Which facility/building
  processingType        String             // DYEING, PRINTING, EMBROIDERY

  quantitySent          Decimal
  quantityReceived      Decimal @default(0)
  quantityInProcess     Decimal

  status                String @default("PENDING")
  // Status flow: PENDING → IN_TRANSIT_TO_PROCESSOR → AT_PROCESSOR →
  //              IN_PROCESS → IN_TRANSIT_TO_COMPANY → COMPLETED → REWORK_REQUIRED

  sentDate              DateTime?
  expectedCompletionDate DateTime?
  actualCompletionDate  DateTime?

  processingCost        Decimal
  qualityNotes          String?
  reworkReason          String?
}
```

### processing_movement (Transit Tracking)
Tracks material in transportation

```prisma
model processing_movement {
  id                  String @id
  batchId             String
  stageId             String?

  movementType        String
  // Types: WAREHOUSE_TO_PROCESSOR, PROCESSOR_TO_WAREHOUSE,
  //        PROCESSOR_TO_PROCESSOR, REWORK_TO_PROCESSOR

  fromLocation        String  // "WAREHOUSE:RAW001" or "PROCESSOR:SUPP123:FACILITY_A"
  toLocation          String

  quantity            Decimal
  status              String @default("IN_TRANSIT")  // IN_TRANSIT, DELIVERED

  vehicleNumber       String?
  driverName          String?
  lrNumber            String?  // Lorry Receipt Number

  dispatchDate        DateTime
  expectedDeliveryDate DateTime?
  actualDeliveryDate  DateTime?

  challanNumber       String?
}
```

### processing_delivery (Partial Deliveries)
Supports receiving material in batches

```prisma
model processing_delivery {
  id                  String @id
  batchId             String
  stageId             String
  deliveryNumber      String @unique  // "DEL-2024-001"

  quantityDelivered   Decimal
  quantityAccepted    Decimal
  quantityRejected    Decimal @default(0)

  qualityStatus       String @default("PENDING_QC")
  // Status: PENDING_QC → QC_PASSED → QC_FAILED →
  //         ACCEPTED → REJECTED → REWORK_REQUIRED

  qualityNotes        String?
  rejectionReason     String?

  receivedAtWarehouse String?  // Warehouse ID if going to company
  nextStageId         String?  // If going to another processor

  deliveryDate        DateTime
  qcDate              DateTime?
  acceptanceDate      DateTime?
}
```

## 3.3 Job Work Flow Example

### Single-Stage Processing
```
Step 1: Create Batch
┌─────────────────────────────────┐
│ processing_batch                │
│ - batchNumber: PB2511-0001      │
│ - materialType: GREIGE          │
│ - greigeId: GRG-001             │
│ - totalQuantitySent: 1000m      │
│ - overallStatus: ACTIVE         │
└─────────────────────────────────┘

Step 2: Create Stage (Dyeing)
┌─────────────────────────────────┐
│ processing_stage                │
│ - stageNumber: 1                │
│ - processorId: MILL-001         │
│ - processorFacility: "Unit A"   │
│ - processingType: DYEING        │
│ - quantitySent: 1000m           │
│ - status: PENDING               │
└─────────────────────────────────┘

Step 3: Send to Processor
┌─────────────────────────────────┐
│ processing_movement             │
│ - movementType:                 │
│   WAREHOUSE_TO_PROCESSOR        │
│ - fromLocation: RAW-001         │
│ - toLocation: MILL-001:Unit A   │
│ - status: IN_TRANSIT            │
│ - dispatchDate: 2024-12-06      │
└─────────────────────────────────┘

AUTOMATIC STOCK MOVEMENTS:
1. STOCK_OUT from RAW_MATERIAL (1000m)
2. STOCK_IN to JOB_WORK (1000m)

Step 4: Receive at Processor
┌─────────────────────────────────┐
│ processing_movement             │
│ - status: DELIVERED             │
│ - actualDeliveryDate: 2024-12-07│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ processing_stage                │
│ - status: AT_PROCESSOR          │
└─────────────────────────────────┘

Step 5: Processing Complete
┌─────────────────────────────────┐
│ processing_stage                │
│ - status: IN_PROCESS → COMPLETED│
│ - actualCompletionDate: ...     │
└─────────────────────────────────┘

Step 6: Partial Delivery 1 (400m)
┌─────────────────────────────────┐
│ processing_delivery             │
│ - deliveryNumber: DEL-2024-001  │
│ - quantityDelivered: 400m       │
│ - quantityAccepted: 400m        │
│ - qualityStatus: ACCEPTED       │
└─────────────────────────────────┘

AUTOMATIC STOCK MOVEMENTS:
1. STOCK_OUT from JOB_WORK (400m)
2. STOCK_IN to FINISHED_GOODS (400m)

Step 7: Partial Delivery 2 (600m)
[Same process for remaining quantity]

Final State:
┌─────────────────────────────────┐
│ processing_batch                │
│ - totalQuantityReceived: 1000m  │
│ - quantityInProcess: 0m         │
│ - overallStatus: COMPLETED      │
└─────────────────────────────────┘
```

### Multi-Stage Processing
```
Greige (1000m)
    ↓ Stage 1: Dyeing (Mill A)
Dyed Fabric (920m - 8% shrinkage)
    ↓ Stage 2: Printing (Mill B)
Printed Fabric (900m - 2% shrinkage)
    ↓ Stage 3: Embroidery (Unit C)
Final Product (900m - 0% shrinkage)
```

## 3.4 Stock Integration

### Virtual JOB_WORK Warehouse
```
enum WarehouseType {
  RAW_MATERIAL
  FINISHED_GOODS
  WORK_IN_PROGRESS
  GENERAL
  TRANSIT
  JOB_WORK          ← Virtual warehouse for all processor inventory
}
```

**Purpose:**
- Represents ALL materials at external processors
- Not a physical location
- Tracks total value of materials in job work
- Enables inventory reports

### Stock Movement Pattern

**Send to Processor:**
```typescript
// FROM: Company RAW_MATERIAL warehouse
await stockMovementService.createStockOut({
  materialId: greigeId,
  warehouseId: rawMaterialWarehouse,
  quantity: 1000,
  referenceType: 'PROCESSING_BATCH',
  referenceId: batchId
});

// TO: Virtual JOB_WORK warehouse
await stockMovementService.createStockIn({
  materialId: greigeId,
  warehouseId: jobWorkWarehouse,
  quantity: 1000,
  referenceType: 'PROCESSING_BATCH',
  referenceId: batchId
});
```

**Receive from Processor:**
```typescript
// FROM: Virtual JOB_WORK warehouse
await stockMovementService.createStockOut({
  materialId: finishedFabricId,
  warehouseId: jobWorkWarehouse,
  quantity: 400,
  referenceType: 'PROCESSING_DELIVERY',
  referenceId: deliveryId
});

// TO: Company FINISHED_GOODS warehouse
await stockMovementService.createStockIn({
  materialId: finishedFabricId,
  warehouseId: finishedGoodsWarehouse,
  quantity: 400,
  referenceType: 'PROCESSING_DELIVERY',
  referenceId: deliveryId
});
```

## 3.5 Pages & Navigation

```
Job Work Dashboard: /processing/job-work

Shows:
- Active Batches count
- Quantity In Process
- Quantity In Transit
- Total Cost
- Recent Processing Batches table

Actions:
├── [View All Batches] → /processing/batches
└── [Create New Batch] → /processing/batches/new

Processing Batch List: /processing/batches
- Filter by status, material type, processor
- View batch details
- Track progress

Processing Batch Detail: /processing/batches/:id
- Batch overview
- Stages list with status
- Movements history
- Deliveries received
- Cost breakdown
```

---

# 4. INTEGRATION & DATA FLOW

## 4.1 Complete Procurement Flow

```
┌──────────────────┐
│ Create PO        │ PO for 1000m greige @ ₹100/m
│ PO2511-0001      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Create GRN       │ Receive 1000m
│ GRN2511-0001     │ Accept: 950m, Reject: 50m
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Approve GRN      │ AUTOMATIC:
│                  │ - STOCK_IN: 950m to RAW_MATERIAL
│                  │ - Cost: ₹100/m
│                  │ - Ref: GRN2511-0001
└────────┬─────────┘
         │
         ├─────────────┬─────────────┐
         │             │             │
         ▼             ▼             ▼
    Use in        Send to        Keep in
    Production    Job Work       Stock
         │             │             │
         ▼             ▼             │
    Material      Processing        │
    Requisition   Batch            │
         │             │             │
         ▼             ▼             ▼
    STOCK_OUT     STOCK_OUT +   Available
    to WIP        STOCK_IN to   for Use
                  JOB_WORK
```

## 4.2 Job Work Integration Points

### With Purchase Orders
- **Indirect Integration** - PO → GRN → Stock → Job Work
- Greige purchased via PO can be:
  1. Received at company warehouse (standard flow)
  2. Sent directly to processor (mark in GRN: deliveredTo = "PROCESSOR")

### With Stock Movements
- **Automatic Integration** - Job Work creates stock movements
- Send to processor: STOCK_OUT + STOCK_IN to JOB_WORK
- Receive from processor: STOCK_OUT from JOB_WORK + STOCK_IN to finished goods

### With Inventory
- **Real-time Integration** - Stock levels updated automatically
- JOB_WORK warehouse shows total value at processors
- Individual batches track quantity at each processor/facility

## 4.3 Fabric Processing Workflow

```
┌─────────────────┐
│ Purchase Greige │ PO → GRN → Stock
│ GRG-001         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create          │ Send 1000m greige for dyeing
│ Processing      │ Color: Navy Blue
│ Batch           │ Expected width: 58", GSM: 120
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Send to Mill    │ STOCK_OUT from RAW_MATERIAL
│                 │ STOCK_IN to JOB_WORK
│                 │ Track: At MILL-001, Facility A
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Processing      │ Dyeing in progress
│ at Mill         │ Status: AT_PROCESSOR
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Receive Dyed    │ Actual: 920m (8% shrinkage)
│ Fabric          │ Actual width: 58", GSM: 120
│                 │ QC: PASSED
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Finished │ fabric_master record
│ Fabric Master   │ FAB-001: Navy Blue Poplin
│                 │ Links to greige: GRG-001
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stock In        │ STOCK_OUT from JOB_WORK
│                 │ STOCK_IN to FINISHED_GOODS
│                 │ 920m @ ₹110/m (includes processing)
└─────────────────┘
```

## 4.4 Costing & Valuation

### Material Cost Tracking
```
Purchase: Greige @ ₹100/m
    ↓
Stock In: RAW_MATERIAL @ ₹100/m (weighted average)
    ↓
Send to Processor: JOB_WORK @ ₹100/m (no cost change)
    ↓
Processing Cost: ₹10/m (dyeing)
    ↓
Receive Finished: FINISHED_GOODS @ ₹110/m
    ↓
Valuation: ₹110/m (greige cost + processing cost)
```

### Stock Transactions
Every movement creates:
1. **stock_movements** - Audit record
2. **stock_transactions** - Valuation record with running balance
3. **stock_levels** - Current quantity and weighted average rate

---

# 5. QUICK REFERENCE GUIDES

## 5.1 Common Operations

### How to Receive Supplier Materials
1. **RECOMMENDED:** Use GRN Flow
   - Navigate: Purchase Orders → Select PO → Create GRN
   - Enter received quantities
   - Approve GRN → Automatic stock in

2. **Alternative:** Direct Stock In
   - Navigate: Inventory → Stock Movements → Stock In
   - Select material, warehouse, quantity
   - Enter reference (PO number)

### How to Send Material to Processor
1. Navigate: Job Work → Processing Batches → Create New
2. Select material (greige/fabric)
3. Select processor and facility
4. Enter quantity and processing type
5. Submit → Automatic stock movements created

### How to Receive Material from Processor
1. Navigate: Job Work → Processing Batches → Select Batch
2. Click "Create Delivery"
3. Enter quantity received
4. Perform quality check
5. Accept → Automatic stock movements created

### How to Transfer Between Warehouses
1. Navigate: Inventory → Stock Movements → Transfer
2. Select FROM warehouse
3. Select TO warehouse (use Swap button if needed)
4. Select material
5. Enter quantity → Creates paired movements

## 5.2 Quick Navigation

| Task | Page | Path |
|------|------|------|
| View all materials | Material List | `/materials` |
| Create material | Material Form | `/materials/new` |
| Stock in | Stock In Form | `/inventory/movements/stock-in` |
| Stock out | Stock Out Form | `/inventory/movements/stock-out` |
| Transfer | Transfer Form | `/inventory/movements/transfer` |
| View movements | Movement List | `/inventory/movements` |
| Create GRN | GRN Form | `/inventory/grn/new` |
| Job work dashboard | Dashboard | `/processing/job-work` |
| Processing batches | Batch List | `/processing/batches` |
| Batch details | Batch Detail | `/processing/batches/:id` |

## 5.3 Troubleshooting

### Material Type Not Showing
**Problem:** Material list shows empty "Type" column
**Solution:** ✅ FIXED - Updated Material interface with `materialType` field

### Stock In Not Working
**Problem:** Stock in form shows error
**Checklist:**
- [ ] Material exists and is active
- [ ] Warehouse exists and is active
- [ ] Quantity > 0
- [ ] Unit is selected
- [ ] User is authenticated

### Job Work Stock Not Updating
**Problem:** Stock levels not changing when sending to processor
**Checklist:**
- [ ] JOB_WORK warehouse exists in database
- [ ] Processing batch created successfully
- [ ] Check stock_movements table for PROCESSING_BATCH reference
- [ ] Verify both STOCK_OUT and STOCK_IN created

## 5.4 API Endpoints Summary

### Materials
```
GET    /api/materials                 // List all
POST   /api/materials                 // Create
GET    /api/materials/:id             // Get by ID
PUT    /api/materials/:id             // Update
DELETE /api/materials/:id             // Delete
```

### Stock Movements
```
GET    /api/stock-movements           // List all
POST   /api/stock-movements/stock-in  // Create stock in
POST   /api/stock-movements/stock-out // Create stock out
POST   /api/stock-movements/transfer  // Create transfer
POST   /api/stock-movements/adjustment // Create adjustment
```

### Job Work
```
GET    /api/processing-batches        // List batches
POST   /api/processing-batches        // Create batch
GET    /api/processing-batches/:id    // Get batch details
GET    /api/processing-batches/summary/job-work // Dashboard summary
POST   /api/processing-stages         // Create stage
POST   /api/processing-movements      // Track movement
POST   /api/processing-deliveries     // Record delivery
```

---

**Version:** 2.0
**Last Updated:** 2025-12-07
**Maintained By:** Development Team

**Related Documentation:**
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current state & roadmap
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
