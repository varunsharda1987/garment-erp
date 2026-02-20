# Production Pipeline Guide

> **Complete Production Workflow Documentation**
> **Last Updated:** January 12, 2026
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Work Order Management](#2-work-order-management)
3. [Cutting Phase](#3-cutting-phase)
4. [Stitching Phase](#4-stitching-phase)
5. [Finishing Phase](#5-finishing-phase)
6. [External Processing](#6-external-processing)
7. [Sample Management](#7-sample-management)
8. [Complete Workflow Diagram](#8-complete-workflow-diagram)
9. [API Reference](#9-api-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

The Production Pipeline consists of 7 major phases:

| Phase | Purpose | Key Model |
|-------|---------|-----------|
| Work Order | Order orchestration | `work_orders` |
| Cutting | Fabric cutting | `cutting_batches` |
| Stitching | Component assembly | `stitching_issues` |
| Finishing | Final assembly & QC | `finishing_issues` |
| Processing | Dyeing/Printing | `processing_batch` |
| Sample | Prototype creation | `samples` |
| Dispatch | Shipment | See [DISPATCH_LOGISTICS_GUIDE](DISPATCH_LOGISTICS_GUIDE.md) |

### Production Flow

```
Order → Work Order → Cutting → Stitching → Finishing → Dispatch
                  ↘                                    ↗
                    Processing (Dyeing/Printing)
```

---

## 2. Work Order Management

### Purpose
Orchestrates production by linking orders to manufacturing stages.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/workOrder.routes.ts` |
| Controller | `backend/src/controllers/workOrder.controller.ts` |
| Pages | `frontend/src/pages/WorkOrderList.tsx`, `WorkOrderForm.tsx`, `WorkOrderDetail.tsx` |

### API Endpoints

```
GET    /api/work-orders                    - List work orders
POST   /api/work-orders                    - Create work order
GET    /api/work-orders/:id                - Get details
PUT    /api/work-orders/:id                - Update
DELETE /api/work-orders/:id                - Delete
GET    /api/work-orders/:id/material-readiness - Check materials
POST   /api/work-orders/:id/approve        - Approve
POST   /api/work-orders/:id/push-to-cutting - Start production
GET    /api/work-orders/dashboard/summary  - Production KPIs
```

### Database Model: `work_orders`

| Field | Type | Description |
|-------|------|-------------|
| workOrderNumber | String | Unique identifier |
| orderId | UUID | Parent order |
| styleId | UUID | Style reference |
| totalQuantity | Int | Pieces to produce |
| completedQuantity | Int | Pieces completed |
| status | Enum | PENDING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| plannedStartDate | DateTime | Target start |
| plannedEndDate | DateTime | Target end |

### Workflow

```
Create WO → Check Material Readiness → Approve → Push to Cutting
    ↓
Track Progress → Update Completed Qty → Mark Complete
```

### Status Transitions

```
PENDING → APPROVED → IN_PROGRESS → COMPLETED
                  ↘ CANCELLED
```

---

## 3. Cutting Phase

### Purpose
Cuts fabric according to CAD specifications, tracks consumption and wastage.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/cutting.routes.ts` |
| Controller | `backend/src/controllers/cutting.controller.ts` |
| Pages | `frontend/src/pages/CuttingList.tsx`, `CuttingForm.tsx`, `CuttingDetail.tsx` |

### API Endpoints

```
GET    /api/cutting/batches                          - List batches
POST   /api/cutting/batches                          - Create batch
GET    /api/cutting/batches/:id                      - Get details
PUT    /api/cutting/batches/:id                      - Update
POST   /api/cutting/batches/:id/start                - Start cutting
POST   /api/cutting/batches/:id/record-output        - Record pieces
POST   /api/cutting/batches/:id/complete             - Complete batch
POST   /api/cutting/batches/:id/generate-transfer-slip - Transfer to stitching
GET    /api/cutting/available-work-orders            - Ready WOs
GET    /api/cutting/available-fabric-stock/:fabricId - Available fabric
GET    /api/cutting/summary                          - Cutting KPIs
```

### Database Model: `cutting_batches`

| Field | Type | Description |
|-------|------|-------------|
| batchNumber | String | Unique identifier |
| workOrderId | UUID | Work order reference |
| fabricStockId | UUID | Fabric being cut |
| cadAverageUsed | Decimal | Meters per garment |
| layersPerLay | Int | Layers in cutting spread |
| numberOfLays | Int | Number of spreads |
| fabricConsumed | Decimal | Total meters used |
| wastagePercent | Decimal | Wastage calculation |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED, HELD, CANCELLED |

### Related Models

| Model | Purpose |
|-------|---------|
| `cutting_batch_skus` | Color × Size breakdown |
| `cutting_batch_defects` | Defect tracking |

### Workflow

```
Select WO + Fabric → Create Batch → Set Parameters (CAD, Layers)
         ↓
    Start Cutting → Record Output (Good/Reject) → Complete
         ↓
    Generate Transfer Slip → Send to Stitching
```

### Key Calculations

```
Fabric Required = (Pieces × CAD Average) + Wastage Buffer
Actual Average = Fabric Consumed / Good Pieces
Variance = (Actual Average - CAD Average) / CAD Average × 100%
```

---

## 4. Stitching Phase

### Purpose
Assembles cut pieces, tracks daily production by managers.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/stitching.routes.ts` |
| Controller | `backend/src/controllers/stitching.controller.ts` |
| Pages | `frontend/src/pages/StitchingList.tsx`, `StitchingForm.tsx`, `StitchingDetail.tsx` |

### API Endpoints

```
GET    /api/stitching/issues                         - List issues
POST   /api/stitching/issues                         - Create issue
GET    /api/stitching/issues/:id                     - Get details
POST   /api/stitching/issues/:id/receive             - Receive from cutting
POST   /api/stitching/issues/:id/issue-to-manager    - Assign manager
POST   /api/stitching/issues/:id/start               - Start stitching
POST   /api/stitching/issues/:id/record-output       - Record daily output
POST   /api/stitching/issues/:id/complete            - Complete
POST   /api/stitching/issues/:id/generate-transfer-slip - To finishing
GET    /api/stitching/available-transfer-slips       - Available cut pieces
GET    /api/stitching/summary/work-order/:id         - WO summary
```

### Database Model: `stitching_issues`

| Field | Type | Description |
|-------|------|-------------|
| issueNumber | String | Unique identifier |
| workOrderId | UUID | Work order reference |
| managerId | UUID | Assigned manager |
| issueDate | DateTime | Issue date |
| expectedCompletionDate | DateTime | Target date |
| status | Enum | PENDING_RECEIPT, RECEIVED, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED |

### Related Models

| Model | Purpose |
|-------|---------|
| `stitching_issue_skus` | SKU breakdown |
| `stitching_issue_components` | Assigned components |
| `stitching_daily_outputs` | Daily production |
| `stitching_output_skus` | Output by color/size |

### Workflow

```
Receive Cut Pieces → Issue to Manager → Start Stitching
         ↓
    Daily Output Recording (Good/Defect by SKU) → Complete
         ↓
    Generate Transfer Slip → Send to Finishing
```

---

## 5. Finishing Phase

### Purpose
Applies finishing operations (buttons, labels, ironing), conducts QC.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/finishing.routes.ts` |
| Controller | `backend/src/controllers/finishing.controller.ts` |
| Pages | `frontend/src/pages/FinishingList.tsx`, `FinishingForm.tsx`, `FinishingDetail.tsx` |

### API Endpoints

```
GET    /api/finishing/issues                         - List issues
POST   /api/finishing/issues                         - Create issue
GET    /api/finishing/issues/:id                     - Get details
POST   /api/finishing/issues/:id/receive             - Receive from stitching
POST   /api/finishing/issues/:id/start               - Start finishing
POST   /api/finishing/issues/:id/record-output       - Record daily output
POST   /api/finishing/issues/:id/move-to-packing     - Move to packing
POST   /api/finishing/issues/:id/complete            - Complete
POST   /api/finishing/issues/:id/generate-transfer-slip - To dispatch
GET    /api/finishing/summary/work-order/:id         - WO summary
```

### Database Model: `finishing_issues`

| Field | Type | Description |
|-------|------|-------------|
| issueNumber | String | Unique identifier |
| workOrderId | UUID | Work order reference |
| managerId | UUID | Assigned manager |
| status | Enum | PENDING_RECEIPT, RECEIVED, IN_PROGRESS, PACKING, COMPLETED, CANCELLED |

### Related Models

| Model | Purpose |
|-------|---------|
| `finishing_issue_skus` | SKU breakdown |
| `finishing_daily_outputs` | Daily production |
| `quality_inspections_mfg` | QC inspections |
| `polybag_entries` | Packaging |
| `carton_packings` | Carton assignment |

### Workflow

```
Receive Stitched Pieces → Start Finishing (buttons, labels, etc.)
         ↓
    Daily Output Recording → QC Inspection → Move to Packing
         ↓
    Complete → Generate Transfer Slip → To Dispatch
```

---

## 6. External Processing

### Overview

External processing handles fabric transformation (dyeing, printing) at external mills/processors.

### 6.1 Processing Batch

**Routes:** `backend/src/routes/processingBatch.routes.ts`

```
POST   /api/processing-batch           - Create batch
GET    /api/processing-batch           - List batches
GET    /api/processing-batch/:id       - Get details
POST   /api/processing-batch/:id/complete - Complete
POST   /api/processing-batch/:id/cancel - Cancel
```

**Model:** `processing_batch`

| Field | Type | Description |
|-------|------|-------------|
| batchNumber | String | Unique identifier |
| materialType | Enum | GREIGE, FABRIC |
| greigeId/fabricId | UUID | Source material |
| totalQuantitySent | Decimal | Meters sent |
| quantityReceived | Decimal | Meters received |
| overallStatus | Enum | ACTIVE, COMPLETED, CANCELLED |

### 6.2 Processing Stages

**Routes:** `backend/src/routes/processingStage.routes.ts`

Each batch can have multiple processing stages (e.g., Dyeing → Printing → Finishing).

**Model:** `processing_stage`

| Field | Type | Description |
|-------|------|-------------|
| stageNumber | Int | Sequence number |
| processorId | UUID | Supplier/processor |
| processingType | Enum | DYEING, PRINTING, EMBROIDERY, etc. |
| quantitySent | Decimal | Meters in stage |
| status | Enum | PENDING, IN_TRANSIT_TO_PROCESSOR, AT_PROCESSOR, IN_PROCESS, COMPLETED, REWORK_REQUIRED |

### 6.3 Processing Movement

Tracks transit between company and processors.

**Routes:** `backend/src/routes/processingMovement.routes.ts`

```
POST   /api/processing-movement           - Create movement
GET    /api/processing-movement/in-transit - In transit items
POST   /api/processing-movement/:id/deliver - Mark delivered
```

### 6.4 Dyeing & Printing

**Dyeing Routes:** `backend/src/routes/dyeing.routes.ts`
**Printing Routes:** `backend/src/routes/printing.routes.ts`

Both follow similar patterns:

```
GET    /api/dyeing/lab-dips              - Lab dip samples
POST   /api/dyeing/lab-dips              - Create lab dip
POST   /api/dyeing/lab-dips/:id/approve  - Approve color
GET    /api/dyeing/jobs                  - Dye jobs
POST   /api/dyeing/jobs                  - Create job
POST   /api/dyeing/jobs/:id/send         - Send to mill
POST   /api/dyeing/jobs/:id/receive      - Receive from mill
```

### Processing Workflow

```
Create Batch → Add Stages → Send to Processor
      ↓
Track Movement → Receive at Processor → Process
      ↓
QC Check → Send Back → Receive at Company → Update Stock
```

---

## 7. Sample Management

### Purpose
Manages sample creation (FIT, BULK, COUNTER) for buyer approval before production.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/sample.routes.ts` |
| Controller | `backend/src/controllers/sample.controller.ts` |
| Pages | `frontend/src/pages/SampleList.tsx`, `SampleForm.tsx`, `SampleDetail.tsx` |

### API Endpoints

```
GET    /api/samples                      - List samples
POST   /api/samples                      - Create sample
GET    /api/samples/:id                  - Get details
PATCH  /api/samples/:id/status           - Update status
POST   /api/samples/:id/send             - Mark as sent
POST   /api/samples/:id/receive          - Record receipt
POST   /api/samples/:id/feedback         - Record feedback
POST   /api/samples/:id/revision         - Create revision
GET    /api/samples/approval-gate/:styleId - Check approval
```

### Database Model: `samples`

| Field | Type | Description |
|-------|------|-------------|
| sampleNumber | String | Unique identifier |
| styleId | UUID | Style reference |
| customerId | UUID | Customer reference |
| sampleType | Enum | BULK, FIT, COUNTER, PRE_PRODUCTION, SHIPMENT, INSPECTION |
| status | Enum | REQUESTED, IN_PROGRESS, SENT, RECEIVED, APPROVED, REJECTED, MODIFICATION_REQUIRED, PRODUCTION_READY |

### Related Models

| Model | Purpose |
|-------|---------|
| `sample_measurements` | Size/fit measurements |
| `sample_colorways` | Color options |
| `sample_size_sets` | Size sets |

### Sample Types

| Type | Purpose | When Used |
|------|---------|-----------|
| FIT | Fit/sizing approval | Before bulk production |
| BULK | Production quality check | During production |
| COUNTER | Showroom sample | Sales samples |
| PRE_PRODUCTION | Pre-production check | Before full run |
| SHIPMENT | Shipment sample | With delivery |

### Workflow

```
Request Sample → Create (BULK/FIT) → Send to Buyer
      ↓
Receive at Buyer → Get Feedback
      ↓
   ├─ APPROVED → Production Ready
   ├─ REJECTED → Create Revision
   └─ MODIFICATION_REQUIRED → Update & Resubmit
```

---

## 8. Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION PIPELINE FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

1. WORK ORDER PLANNING
   ├─ Create Work Order from Order Item
   ├─ Check Material Readiness
   ├─ Approve Work Order
   └─ Push to Cutting

2. CUTTING PHASE
   ├─ Create Cutting Batch (select WO + Fabric)
   ├─ Set Parameters (CAD, Layers, Lays)
   ├─ Start Cutting
   ├─ Record Output (Good/Defect by SKU)
   ├─ Complete Batch
   └─ Generate Transfer Slip → Stitching

3. STITCHING PHASE
   ├─ Receive from Cutting
   ├─ Issue to Manager
   ├─ Start Stitching
   ├─ Daily Output Recording (Good/Defect)
   ├─ Complete Issue
   └─ Generate Transfer Slip → Finishing

4. FINISHING PHASE
   ├─ Receive from Stitching
   ├─ Start Finishing (buttons, labels, ironing)
   ├─ Daily Output Recording
   ├─ QC Inspection (Inline/Final)
   ├─ Move to Packing
   ├─ Complete Issue
   └─ Transfer to Dispatch

5. SAMPLE APPROVAL (Parallel)
   ├─ Create Sample (BULK/FIT)
   ├─ Send to Buyer
   ├─ Receive Feedback
   │   ├─ APPROVED → Production Continues
   │   ├─ REJECTED → Create Revision
   │   └─ MODIFICATION → Update & Resubmit
   └─ Production Ready Gate Check

6. EXTERNAL PROCESSING (If Required)
   ├─ Create Processing Batch
   ├─ Add Processing Stages (Dyeing/Printing)
   ├─ Track Movement to/from Processor
   ├─ QC at Each Stage
   └─ Receive Finished Fabric → Update Stock

7. DISPATCH
   → See DISPATCH_LOGISTICS_GUIDE.md
```

---

## 9. API Reference

### Common Status Enums

**Work Order Status:**
```
PENDING → APPROVED → IN_PROGRESS → COMPLETED | CANCELLED
```

**Cutting/Stitching/Finishing Status:**
```
PENDING → IN_PROGRESS → COMPLETED | HELD | CANCELLED
```

**Processing Status:**
```
PENDING → IN_TRANSIT_TO_PROCESSOR → AT_PROCESSOR → IN_PROCESS
       → IN_TRANSIT_TO_COMPANY → COMPLETED | REWORK_REQUIRED
```

**Sample Status:**
```
REQUESTED → IN_PROGRESS → SENT → RECEIVED
         → APPROVED | REJECTED | MODIFICATION_REQUIRED → PRODUCTION_READY
```

### Key Database Relations

```
work_orders
├── order_items
├── cutting_batches
│   └── cutting_batch_skus
├── stitching_issues
│   └── stitching_daily_outputs
├── finishing_issues
│   └── finishing_daily_outputs
└── production_tracking
```

---

## 10. Controller Reference

This section provides comprehensive documentation for all production pipeline controllers.

### 10.1 Work Order Controller

**Controller:** [backend/src/controllers/workOrder.controller.ts](../backend/src/controllers/workOrder.controller.ts:1)
**Routes:** [backend/src/routes/workOrder.routes.ts](../backend/src/routes/workOrder.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/work-orders/dashboard/summary` | Production dashboard KPIs (total WOs, quantities, status breakdown) |
| GET | `/api/work-orders` | Get all work orders (paginated, filterable) |
| GET | `/api/work-orders/order/:orderId` | Get work orders for specific order |
| GET | `/api/work-orders/:id/material-readiness` | Check if materials are available for production |
| GET | `/api/work-orders/:id` | Get work order by ID with full details |
| POST | `/api/work-orders` | Create new work order from order item |
| POST | `/api/work-orders/:id/tracking` | Add production tracking milestone |
| POST | `/api/work-orders/:id/split` | Split work order into multiple batches |
| POST | `/api/work-orders/:id/push-to-cutting` | Send approved WO to cutting phase |
| PUT | `/api/work-orders/:id` | Update work order details (PENDING only) |
| PATCH | `/api/work-orders/:id/approve` | Approve work order (PENDING → APPROVED) |
| DELETE | `/api/work-orders/:id` | Delete work order (PENDING only) |

#### Request/Response Examples

**Create Work Order:**
```typescript
POST /api/work-orders
{
  orderId: string;
  orderItemId: string;
  styleId: string;
  totalQuantity: number;
  plannedStartDate: string;  // ISO 8601
  plannedEndDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  remarks?: string;
}

Response:
{
  success: true;
  data: {
    id: string;
    workOrderNumber: string;  // WO-202506-0001
    status: "PENDING";
    totalQuantity: number;
    completedQuantity: 0;
    // ... full WO object
  }
}
```

**Check Material Readiness:**
```typescript
GET /api/work-orders/:id/material-readiness

Response:
{
  isReady: boolean;
  materials: [
    {
      materialId: string;
      materialName: string;
      requiredQuantity: number;
      availableQuantity: number;
      unit: string;
      shortage: number;      // If negative
      isAvailable: boolean;
    }
  ],
  overallStatus: "READY" | "PARTIAL" | "NOT_READY";
}
```

**Production Dashboard:**
```typescript
GET /api/work-orders/dashboard/summary

Response:
{
  totalWorkOrders: number;
  totalQuantity: number;
  completedQuantity: number;
  statusBreakdown: {
    PENDING: number;
    APPROVED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  },
  avgCompletionTime: number;  // Days
  onTimeDelivery: number;     // Percentage
}
```

**Split Work Order:**
```typescript
POST /api/work-orders/:id/split
{
  splits: [
    {
      quantity: number;
      plannedStartDate: string;
      plannedEndDate: string;
    }
  ]
}

Response:
{
  success: true;
  data: {
    originalWO: WorkOrder;
    newWorkOrders: WorkOrder[];  // Created from split
  }
}
```

#### Use Cases

1. **Order to Production Conversion**
   - Order approved → Create work orders for each order item
   - One order item can have multiple WOs (split by delivery date, factory, etc.)
   - Work order links style, quantity, and production timeline

2. **Material Readiness Gate**
   - Before approving WO, check material availability
   - Prevents starting production without required materials
   - Identifies shortages early for procurement action

3. **Production Tracking**
   - Add milestones: cutting started, stitching complete, etc.
   - Track actual vs planned dates
   - Calculate completion percentage

4. **Work Order Splitting**
   - Large orders split into manageable batches
   - Different factories or production lines
   - Phased delivery to customer

---

### 10.2 Cutting Controller

**Controller:** [backend/src/controllers/cutting.controller.ts](../backend/src/controllers/cutting.controller.ts:1)
**Routes:** [backend/src/routes/cutting.routes.ts](../backend/src/routes/cutting.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cutting/summary` | Cutting department summary (total batches, quantities) |
| GET | `/api/cutting/summary/work-order/:workOrderId` | Cutting summary for specific work order |
| GET | `/api/cutting/available-work-orders` | Get approved WOs ready for cutting |
| GET | `/api/cutting/available-fabric-stock/:fabricId` | Get available fabric stock for cutting |
| GET | `/api/cutting/batches` | Get all cutting batches (paginated, filterable) |
| GET | `/api/cutting/batches/:id` | Get cutting batch by ID with SKUs |
| POST | `/api/cutting/batches` | Create new cutting batch |
| PUT | `/api/cutting/batches/:id` | Update cutting batch (PENDING only) |
| DELETE | `/api/cutting/batches/:id` | Delete cutting batch (PENDING only) |
| POST | `/api/cutting/batches/:id/start` | Start cutting batch (PENDING → IN_PROGRESS) |
| POST | `/api/cutting/batches/:id/record-output` | Record cut pieces by size/color |
| POST | `/api/cutting/batches/:id/complete` | Complete cutting batch |
| POST | `/api/cutting/batches/:id/hold` | Put batch on hold (e.g., machine breakdown) |
| POST | `/api/cutting/batches/:id/cancel` | Cancel cutting batch |
| POST | `/api/cutting/batches/:id/generate-transfer-slip` | Generate transfer slip for stitching |

#### Request/Response Examples

**Create Cutting Batch:**
```typescript
POST /api/cutting/batches
{
  workOrderId: string;
  fabricStockId: string;
  plannedLayers: number;
  plannedPiecesPerLayer: number;
  cadId?: string;            // CAD planning reference
  cuttingManagerId: string;
  remarks?: string;
  skus: [                    // SKU breakdown (color × size)
    {
      colorId: string;
      sizeId: string;
      plannedQuantity: number;
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    batchNumber: string;   // CUT-202506-0001
    status: "PENDING";
    totalPlannedQty: number;
    fabricConsumption: {
      plannedMeters: number;
      actualMeters?: number;  // After completion
    }
  }
}
```

**Record Cutting Output:**
```typescript
POST /api/cutting/batches/:id/record-output
{
  actualLayers: number;
  actualPiecesPerLayer: number;
  actualFabricUsed: number;  // Meters
  actualWidth: number;       // Inches
  skuOutputs: [
    {
      colorId: string;
      sizeId: string;
      cutQuantity: number;
      damagedQuantity?: number;
    }
  ],
  remarks?: string;
}

Response:
{
  success: true;
  data: {
    batch: CuttingBatch;
    variance: {
      fabricVariance: number;      // Actual vs CAD
      quantityVariance: number;    // Cut vs planned
      efficiencyPercent: number;   // Utilization %
    }
  }
}
```

**Generate Transfer Slip:**
```typescript
POST /api/cutting/batches/:id/generate-transfer-slip

Response:
{
  success: true;
  data: {
    transferSlipNumber: string;  // TS-CUT-202506-0001
    fromStage: "CUTTING";
    toStage: "STITCHING";
    workOrderId: string;
    items: [
      {
        colorId: string;
        sizeId: string;
        quantity: number;
      }
    ],
    generatedAt: string;
  }
}
```

#### Use Cases

1. **Fabric Cutting Workflow**
   - Select approved work order
   - Choose fabric stock allocation
   - Define layer count and pieces per layer
   - Record actual cutting output
   - Calculate fabric utilization vs CAD

2. **CAD Integration**
   - Link cutting batch to CAD planning
   - Compare actual vs CAD fabric consumption
   - Identify cutting inefficiencies
   - Optimize marker planning

3. **SKU Tracking**
   - Record cut pieces by color × size combination
   - Track damaged/rejected pieces
   - Ensure accurate inventory for stitching

4. **Transfer to Stitching**
   - Complete cutting batch
   - Generate transfer slip with SKU details
   - Stitching receives via transfer slip number

---

### 10.3 Stitching Controller

**Controller:** [backend/src/controllers/stitching.controller.ts](../backend/src/controllers/stitching.controller.ts:1)
**Routes:** [backend/src/routes/stitching.routes.ts](../backend/src/routes/stitching.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stitching/summary` | Stitching department summary |
| GET | `/api/stitching/summary/work-order/:workOrderId` | Stitching summary for specific work order |
| GET | `/api/stitching/available-transfer-slips` | Get cutting transfer slips pending receipt |
| GET | `/api/stitching/available-managers` | Get available stitching line managers |
| GET | `/api/stitching/issues` | Get all stitching issues (paginated) |
| GET | `/api/stitching/issues/:id` | Get stitching issue by ID |
| POST | `/api/stitching/issues` | Create new stitching issue |
| PUT | `/api/stitching/issues/:id` | Update stitching issue (PENDING only) |
| DELETE | `/api/stitching/issues/:id` | Delete stitching issue (PENDING only) |
| POST | `/api/stitching/issues/:id/receive` | Receive cut pieces from cutting |
| POST | `/api/stitching/issues/:id/issue-to-manager` | Issue to line manager |
| POST | `/api/stitching/issues/:id/start` | Start stitching |
| POST | `/api/stitching/issues/:id/record-output` | Record daily stitched quantity |
| POST | `/api/stitching/issues/:id/complete` | Complete stitching issue |
| POST | `/api/stitching/issues/:id/generate-transfer-slip` | Generate transfer slip for finishing |

#### Request/Response Examples

**Receive from Cutting:**
```typescript
POST /api/stitching/issues/:id/receive
{
  transferSlipNumber: string;
  receivedBy: string;
  receivedDate: string;
  skus: [
    {
      colorId: string;
      sizeId: string;
      receivedQuantity: number;
      damagedQuantity?: number;
    }
  ],
  remarks?: string;
}

Response:
{
  success: true;
  data: {
    issue: StitchingIssue;
    status: "RECEIVED";
    totalReceived: number;
  }
}
```

**Record Daily Output:**
```typescript
POST /api/stitching/issues/:id/record-output
{
  date: string;             // Output date
  lineManagerId: string;
  skuOutputs: [
    {
      colorId: string;
      sizeId: string;
      stitchedQuantity: number;
      rejectedQuantity?: number;
      remarks?: string;
    }
  ],
  shift: "MORNING" | "EVENING" | "NIGHT";
}

Response:
{
  success: true;
  data: {
    dailyOutput: StitchingDailyOutput;
    cumulativeTotal: number;
    remainingQuantity: number;
    completionPercent: number;
  }
}
```

#### Use Cases

1. **Cutting to Stitching Flow**
   - Receive cut pieces via transfer slip
   - Verify quantities by SKU
   - Record any damages during transfer
   - Issue to line manager for stitching

2. **Daily Production Tracking**
   - Record stitched quantities per shift
   - Track by line manager
   - Identify rejected pieces
   - Calculate completion percentage

3. **Line Manager Assignment**
   - Allocate work to specific managers
   - Track productivity by manager
   - Balance workload across lines

4. **Quality Control**
   - Record rejected quantities
   - Track reasons for rejection
   - Identify recurring quality issues

---

### 10.4 Finishing Controller

**Controller:** [backend/src/controllers/finishing.controller.ts](../backend/src/controllers/finishing.controller.ts:1)
**Routes:** [backend/src/routes/finishing.routes.ts](../backend/src/routes/finishing.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finishing/summary` | Finishing department summary |
| GET | `/api/finishing/summary/work-order/:workOrderId` | Finishing summary for specific work order |
| GET | `/api/finishing/available-transfer-slips` | Get stitching transfer slips pending receipt |
| GET | `/api/finishing/available-managers` | Get available finishing managers |
| GET | `/api/finishing/issues` | Get all finishing issues (paginated) |
| GET | `/api/finishing/issues/:id` | Get finishing issue by ID |
| POST | `/api/finishing/issues` | Create new finishing issue |
| PUT | `/api/finishing/issues/:id` | Update finishing issue (PENDING only) |
| DELETE | `/api/finishing/issues/:id` | Delete finishing issue (PENDING only) |
| POST | `/api/finishing/issues/:id/receive` | Receive from stitching |
| POST | `/api/finishing/issues/:id/start` | Start finishing operations |
| POST | `/api/finishing/issues/:id/record-output` | Record daily finished quantity |
| POST | `/api/finishing/issues/:id/move-to-packing` | Move finished goods to packing |
| POST | `/api/finishing/issues/:id/complete` | Complete finishing issue |
| POST | `/api/finishing/issues/:id/generate-transfer-slip` | Generate transfer slip for dispatch |

#### Request/Response Examples

**Receive from Stitching:**
```typescript
POST /api/finishing/issues/:id/receive
{
  transferSlipNumber: string;
  receivedBy: string;
  receivedDate: string;
  skus: [
    {
      colorId: string;
      sizeId: string;
      receivedQuantity: number;
      damagedQuantity?: number;
    }
  ]
}

Response:
{
  success: true;
  data: {
    issue: FinishingIssue;
    status: "RECEIVED";
    totalReceived: number;
  }
}
```

**Record Finishing Output:**
```typescript
POST /api/finishing/issues/:id/record-output
{
  date: string;
  finishingManagerId: string;
  skuOutputs: [
    {
      colorId: string;
      sizeId: string;
      finishedQuantity: number;
      rejectedQuantity?: number;
      operations: [
        {
          operationType: "IRONING" | "BUTTON_ATTACH" | "LABEL_ATTACH" | "QC_CHECK" | "FOLDING" | "POLY_BAG";
          completedQuantity: number;
        }
      ]
    }
  ]
}

Response:
{
  success: true;
  data: {
    dailyOutput: FinishingDailyOutput;
    cumulativeTotal: number;
    remainingQuantity: number;
    completionPercent: number;
  }
}
```

**Move to Packing:**
```typescript
POST /api/finishing/issues/:id/move-to-packing
{
  packingLocation: string;
  skus: [
    {
      colorId: string;
      sizeId: string;
      quantity: number;
    }
  ],
  packingInstructions?: string;
}

Response:
{
  success: true;
  data: {
    transferSlipNumber: string;  // TS-FIN-202506-0001
    location: string;
    totalQuantity: number;
    status: "IN_PACKING";
  }
}
```

#### Use Cases

1. **Final Assembly Operations**
   - Receive stitched garments
   - Perform finishing tasks: ironing, button attachment, label attachment
   - QC inspection
   - Poly bagging and folding

2. **Multi-Step Finishing**
   - Track each finishing operation separately
   - Ironing → Button → Label → QC → Poly bag → Folding
   - Record completion by operation type
   - Identify bottlenecks in finishing flow

3. **Quality Gate**
   - Final QC check before packing
   - Record rejected pieces
   - Send rejects back to stitching if needed
   - Ensure only quality goods proceed to dispatch

4. **Packing Handoff**
   - Move approved goods to packing area
   - Generate packing instructions
   - Create transfer slip for dispatch team
   - Link to delivery notes and shipping

---

## 11. Troubleshooting

### Work Order Not Showing for Cutting

**Cause:** Material readiness check failed
**Solution:** Check `/api/work-orders/:id/material-readiness` endpoint, ensure fabric stock is available

### CAD Variance Too High

**Cause:** Cutting inefficiency or incorrect parameters
**Solution:** Review `actualAverage` vs `cadAverageUsed`, check layer count and wastage

### Transfer Slip Not Generated

**Cause:** Batch not in COMPLETED status
**Solution:** Ensure batch is marked complete before generating transfer slip

### Sample Approval Gate Failing

**Cause:** No approved sample for style
**Solution:** Check `/api/samples/approval-gate/:styleId`, ensure FIT sample is APPROVED status

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) - Fabric/material inventory
- [DISPATCH_LOGISTICS_GUIDE.md](DISPATCH_LOGISTICS_GUIDE.md) - Shipment workflow
- [TESTING_QUALITY_GUIDE.md](TESTING_QUALITY_GUIDE.md) - QC procedures

---

**Maintained By:** Kashaya Fabs Development Team
