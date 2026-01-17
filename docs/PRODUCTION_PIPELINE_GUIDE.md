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

## 10. Troubleshooting

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
