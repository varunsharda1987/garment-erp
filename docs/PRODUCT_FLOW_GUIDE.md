# Garment ERP - Complete Product Flow Guide

> **From Style Creation to Dispatch**: A comprehensive guide to how information and products flow through the Kashaya Fabs Garment ERP system.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Stage 1: Style Creation](#stage-1-style-creation)
3. [Stage 2: Sample Tracking](#stage-2-sample-tracking)
4. [Stage 3: CAD Planning & Average](#stage-3-cad-planning--average)
5. [Stage 4: Costing Sheet](#stage-4-costing-sheet)
6. [Stage 5: Order Creation](#stage-5-order-creation)
7. [Stage 6: Work Order Generation](#stage-6-work-order-generation)
8. [Stage 7: Material Requisition & Procurement](#stage-7-material-requisition--procurement)
9. [Stage 8: Fabric Processing (Dyeing/Printing)](#stage-8-fabric-processing-dyeingprinting)
10. [Stage 9: Cutting](#stage-9-cutting)
11. [Stage 10: Stitching](#stage-10-stitching)
12. [Stage 11: Finishing](#stage-11-finishing)
13. [Stage 12: Quality Control](#stage-12-quality-control)
14. [Stage 13: Packing](#stage-13-packing)
15. [Stage 14: Dispatch](#stage-14-dispatch)
16. [Stage 15: Invoicing & Payment](#stage-15-invoicing--payment)
17. [Database Models Reference](#database-models-reference)
18. [API Endpoints Reference](#api-endpoints-reference)
19. [Master Data Reference](#master-data-reference)

---

## Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE PRODUCT FLOW                        │
└─────────────────────────────────────────────────────────────────┘

 1. STYLE CREATION          Create style with fabrics, trims, packaging
        ↓
 2. SAMPLE TRACKING         FIT → PP → Size Set sample approvals
        ↓
 3. CAD PLANNING            Determine fabric consumption per piece
        ↓
 4. COSTING SHEET           Calculate complete cost per garment
        ↓
 5. ORDER CREATION          Customer order with color × size matrix
        ↓
 6. WORK ORDER              Production orders per order item
        ↓
 7. MATERIAL REQUISITION    Request materials from inventory
        ↓
 8. FABRIC PROCESSING       Lab Dip → Dyeing/Printing → QC → Stock
        ↓
 9. CUTTING                 Fabric cutting into garment pieces
        ↓
10. STITCHING               Garment assembly
        ↓
11. FINISHING               Final touches, ironing, tagging
        ↓
12. QUALITY CONTROL         Inline, final, and AQL inspections
        ↓
13. PACKING                 Polybag → Carton packing
        ↓
14. DISPATCH                ASN → Delivery Note → Ship to customer
        ↓
15. INVOICING & PAYMENT     Bill and collect payment
```

---

## Stage 1: Style Creation

**Purpose:** Capture all product specifications - the foundation for everything that follows.

### Key Files
- **Frontend:** `frontend/src/pages/StyleFormRedesigned.tsx`
- **Backend:** `backend/src/controllers/style.controller.ts`
- **Database:** `styles`, `style_components`, `style_fabrics`, `style_garment_trims`

### 5-Tab Workflow

| Tab | Data Captured | Database Table |
|-----|---------------|----------------|
| **Basic Details** | Style code, name, category, brand, gender, age group, image | `styles` |
| **Fabrics & Components** | Fabric per component (body, sleeves, collar), embroidery details | `style_components`, `style_fabrics` |
| **Trims & Accessories** | Buttons, zippers, labels, elastic, thread quantities | `style_garment_trims` |
| **Value Additions** | Embroidery, hand-work, special finishes | `style_value_additions` |
| **Packaging** | Polybag specs, hang tags, packaging materials | `style_packaging` |

### Style Status Flow
```
DRAFT → APPROVED → IN_PRODUCTION → COMPLETED
```

### Key Fields in `styles` Table
```
styleCode         - Buyer-given code (unique)
internalCode      - Auto-generated (STY-202506-0001)
cadStatus         - PENDING | IN_PROGRESS | APPROVED
numberOfComponents - Number of garment parts
```

---

## Stage 2: Sample Tracking

**Purpose:** Track and manage sample approvals through the FIT → PP → Size Set workflow before production begins.

> ⚠️ **Size Set sample must be approved before Work Orders can be created.**

### Key Files
- **Frontend:** `frontend/src/pages/SampleList.tsx`, `frontend/src/pages/SampleForm.tsx`, `frontend/src/pages/SampleDetail.tsx`
- **Backend:** `backend/src/controllers/sample.controller.ts`
- **Service:** `frontend/src/services/sample.service.ts`
- **Database:** `samples`, `sample_measurements`, `sample_colorways`, `sample_size_sets`

### Sample Types

| Type | Purpose | Prerequisite |
|------|---------|--------------|
| **FIT_SAMPLE** | Verify fit and measurements | Style created |
| **PP_SAMPLE** | Pre-production colorway approval | FIT sample approved |
| **SIZE_SET_SAMPLE** | Full size range verification | PP sample approved |
| **SHIPMENT_SAMPLE** | Production lot sample | Work order in production |
| **PHOTO_SAMPLE** | Marketing/catalog photos | Any approved sample |
| **PRODUCTION_SAMPLE** | Random production QC | Work order in production |

### Sample Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAMPLE APPROVAL FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FIT SAMPLE (v1)                                               │
│      ↓                                                         │
│  REQUESTED → IN_PROGRESS → SUBMITTED → SENT → FEEDBACK_PENDING │
│      ↓                                                         │
│  ┌─── APPROVED ──→ Proceed to PP Sample                       │
│  └─── REJECTED ──→ Create FIT v2 (revision)                   │
│      └─── APPROVED_WITH_COMMENTS                               │
│                                                                 │
│  PP SAMPLE (Pre-Production)                                    │
│      ↓                                                         │
│  Submit colorways for approval                                 │
│      ↓                                                         │
│  APPROVED ──→ Proceed to Size Set Sample                      │
│                                                                 │
│  SIZE SET SAMPLE                                               │
│      ↓                                                         │
│  Submit full size range                                        │
│      ↓                                                         │
│  APPROVED ──→ ✓ Can create Work Orders                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Sample Data Structure

```
samples (1)
├── sampleNumber: FIT-STY2024-0001-v1
├── sampleType: FIT_SAMPLE | PP_SAMPLE | SIZE_SET_SAMPLE
├── status: REQUESTED → APPROVED
├── version: 1, 2, 3... (for FIT revisions)
│
├── sample_measurements (many) - FIT samples
│   ├── measurementPoint: "Chest", "Length"
│   ├── specValue: 42.5
│   ├── actualValue: 42.3
│   ├── tolerance: 0.5
│   └── status: PASS | FAIL
│
├── sample_colorways (many) - PP samples
│   ├── colorId
│   ├── sizeId
│   ├── fabricLot
│   ├── qtySent
│   └── status: PENDING | APPROVED | REJECTED
│
└── sample_size_sets (many) - Size Set samples
    ├── sizeId
    ├── colorId
    ├── qty
    └── status: PENDING | APPROVED | REJECTED
```

### Sample Status Values
```
REQUESTED         - Sample request created
IN_PROGRESS       - Sample being made
SUBMITTED         - Ready for internal review
SENT              - Sent to buyer
FEEDBACK_PENDING  - Awaiting buyer response
APPROVED          - Sample approved
REJECTED          - Sample rejected
REVISION_NEEDED   - Changes required
APPROVED_WITH_COMMENTS - Approved with minor notes
```

### Sample API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/samples` | List samples with filters |
| GET | `/api/samples/:id` | Get sample details |
| POST | `/api/samples` | Create sample |
| PUT | `/api/samples/:id` | Update sample |
| PATCH | `/api/samples/:id/status` | Update status with feedback |
| POST | `/api/samples/:id/send` | Mark as sent to buyer |
| POST | `/api/samples/:id/receive` | Record buyer receipt |
| POST | `/api/samples/:id/feedback` | Record buyer feedback |
| POST | `/api/samples/:id/revision` | Create FIT revision |
| GET | `/api/samples/approval-gate/:styleId` | Check sample approval status |
| GET | `/api/samples/summary` | Get sample statistics |

---

## Stage 3: CAD Planning & Average

**Purpose:** Determine fabric consumption per garment piece at different fabric widths.

> ⚠️ **This stage MUST be completed before costing can begin.**

### Key Files
- **Frontend:** `frontend/src/pages/CADPlanningPage.tsx`
- **Backend:** `backend/src/controllers/style-cad-planning.controller.ts`
- **Database:** `fabric_width_cad`

### What is CAD Average?

CAD (Computer-Aided Design) average is the **fabric consumption per single garment piece** calculated from marker planning software. It tells you how much fabric you need to cut one piece.

### Data Stored in `fabric_width_cad`

| Field | Description | Example |
|-------|-------------|---------|
| `availableWidth` | Fabric width in inches | 44", 58", 60" |
| `cadMeters` | Consumption per piece (meters) | 1.25 |
| `cadYards` | Consumption per piece (yards) | 1.37 |
| `cadWastagePercent` | Marker wastage | 5% |
| `markerEfficiency` | Marker utilization % | 85% |
| `piecesPerMarker` | Pieces cut per marker | 50 |
| `isPreferred` | Recommended width? | true |
| `actualCad` | Actual consumption from production | 1.28 |

### CAD Planning Workflow

```
1. GET /api/styles/cad-planning/pending
   └── Lists styles with cadStatus = PENDING or IN_PROGRESS

2. POST /api/styles/cad-planning/generate
   └── Creates fabric_width_cad entries for widths: 36", 44", 54", 58", 60", 72", 108"
   └── Updates style.cadStatus = IN_PROGRESS

3. User enters CAD values:
   └── PUT /api/styles/cad-planning/update-cad/:cadId
       ├── cadMeters: 1.25
       ├── cadWastagePercent: 5%
       └── markerEfficiency: 85%

4. Compare costs across widths:
   └── POST /api/styles/cad-planning/calculate-cost
       Formula: effectiveCAD = cadMeters × (1 + wastage%)
       Cost = effectiveCAD × fabricRate

5. Approve CAD:
   └── POST /api/styles/cad-planning/approve
       ├── Updates style.cadStatus = APPROVED
       ├── Links approved CAD to style_fabrics.fabricCADId
       └── Locks style for costing
```

### Why Multiple Widths?

Same fabric available in different widths has different consumption:

| Width | CAD (m) | Wastage | Effective CAD | Rate/m | Cost/piece |
|-------|---------|---------|---------------|--------|------------|
| 44"   | 1.45    | 5%      | 1.52          | ₹120   | ₹182.40    |
| 58"   | 1.10    | 5%      | 1.16          | ₹150   | ₹174.00 ✓  |
| 60"   | 1.05    | 5%      | 1.10          | ₹160   | ₹176.00    |

58" width is most cost-effective despite higher rate/m.

### CAD Status Values
```
PENDING      - CAD planning not started
IN_PROGRESS  - CAD options generated, values being entered
APPROVED     - CAD approved and locked for costing
```

---

## Stage 4: Costing Sheet

**Purpose:** Complete cost breakdown per garment piece for pricing and profitability.

> ⚠️ **Prerequisite:** `style.cadStatus` must be `APPROVED`

### Key Files
- **Frontend:** `frontend/src/pages/CostSheetForm.tsx`, `frontend/src/pages/CostSheetList.tsx`
- **Backend:** `backend/src/controllers/styleCosting.controller.ts`
- **Database:** `style_costing`, `style_costing_fabric_items`

### Cost Sheet Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     COSTING SHEET BREAKDOWN                     │
├─────────────────────────────────────────────────────────────────┤
│ MATERIAL COSTS                                                  │
│ ├── Fabric Cost (from approved CAD × fabric rate)              │
│ ├── Trims Cost (buttons, zippers, labels)                      │
│ ├── Accessories Cost                                           │
│ ├── Packaging Cost                                             │
│ └── Other Material Cost                                        │
│     = totalMaterialCost                                        │
├─────────────────────────────────────────────────────────────────┤
│ PROCESSING COSTS                                                │
│ ├── Dyeing Cost                                                │
│ ├── Printing Cost                                              │
│ ├── Embroidery Work                                            │
│ ├── Hand Work                                                  │
│ ├── Washing Cost                                               │
│ └── Other Processing Cost                                      │
│     = totalProcessingCost                                      │
├─────────────────────────────────────────────────────────────────┤
│ CMT COSTS (Cut, Make, Trim)                                    │
│ ├── Cutting Cost                                               │
│ ├── Stitching Cost                                             │
│ ├── Finishing Cost                                             │
│ ├── Checking Cost                                              │
│ ├── Button Attachment Cost                                     │
│ └── Handwork CMT Cost                                          │
│     = cmtTotal                                                 │
├─────────────────────────────────────────────────────────────────┤
│ OVERHEAD COSTS                                                  │
│ ├── Transport Cost                                             │
│ ├── Admin Overhead                                             │
│ ├── Factory Overhead                                           │
│ └── Other Overheads                                            │
├─────────────────────────────────────────────────────────────────┤
│ CALCULATIONS                                                    │
│ subtotal = materials + processing + CMT + embroidery + access. │
│                                                                 │
│ valueLossAmount = subtotal × valueLossPercent (default 2%)     │
│ totalAfterLoss = subtotal + valueLossAmount                    │
│                                                                 │
│ markupAmount = totalAfterLoss × markupPercent (default 15%)    │
│ totalProductCost = totalAfterLoss + markupAmount               │
│                                                                 │
│ sellingPricePerPiece = totalProductCost / expectedQuantity     │
└─────────────────────────────────────────────────────────────────┘
```

### Cost Sheet API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/style-costing/generate/:styleId` | Auto-generate from approved CAD |
| `POST /api/style-costing` | Manual creation |
| `GET /api/style-costing/style/:styleId` | Get cost sheet for style |
| `PUT /api/style-costing/:id` | Update (if not approved) |
| `PATCH /api/style-costing/:id/approve` | Approve/lock cost sheet |

---

## Stage 5: Order Creation

**Purpose:** Capture customer order with quantity breakdown by color and size.

### Key Files
- **Frontend:** `frontend/src/pages/OrderForm.tsx`, `frontend/src/pages/OrderList.tsx`
- **Backend:** `backend/src/controllers/order.controller.ts`
- **Database:** `orders`, `order_items`, `order_item_breakup`

### Data Structure

```
orders (1)
├── order_items (many) - One per style
│   └── order_item_breakup (many) - Color × Size matrix
│       ├── colorId
│       ├── sizeId
│       └── quantity
```

### Order Fields

| Field | Description | Example |
|-------|-------------|---------|
| `orderNumber` | Auto-generated | ORD202512-0001 |
| `customerId` | Customer reference | UUID |
| `orderDate` | Order date | 2024-12-10 |
| `expectedDeliveryDate` | Due date | 2025-01-15 |
| `totalQuantity` | Total pieces | 5000 |
| `totalAmount` | Order value | ₹250,000 |
| `priority` | LOW, MEDIUM, HIGH, URGENT | HIGH |

### Order Status Flow
```
PENDING → IN_PRODUCTION → COMPLETED → DISPATCHED
                                   ↘ CANCELLED
```

### Color × Size Matrix Example

| Color/Size | S | M | L | XL | Total |
|------------|---|---|---|-----|-------|
| Red        | 100 | 200 | 200 | 100 | 600 |
| Blue       | 150 | 250 | 200 | 100 | 700 |
| Green      | 100 | 200 | 150 | 50 | 500 |
| **Total**  | 350 | 650 | 550 | 250 | 1800 |

---

## Stage 6: Work Order Generation

**Purpose:** Create production orders from customer orders.

> ⚠️ **Prerequisite:** Size Set sample must be approved for the style.

### Key Files
- **Frontend:** `frontend/src/pages/WorkOrderForm.tsx`, `frontend/src/pages/WorkOrderList.tsx`
- **Backend:** `backend/src/controllers/workOrder.controller.ts`
- **Database:** `work_orders`, `work_order_breakup`

### Data Structure

```
order (1)
  └── order_items (many)
        └── work_orders (1 per order item)
              ├── work_order_breakup (color-size details)
              ├── production_tracking (stage updates)
              ├── material_requisitions (issued materials)
              ├── cutting_batches (cutting records)
              └── finished_goods_stock (completed units)
```

### Work Order Fields

| Field | Description |
|-------|-------------|
| `workOrderNumber` | Auto-generated (WO2512-0001) |
| `orderId`, `orderItemId` | Links to order |
| `styleId` | Style being produced |
| `locationId` | Factory/workshop |
| `plannedStartDate`, `plannedEndDate` | Timeline |
| `totalQuantity`, `completedQuantity` | Progress tracking |

### Work Order Status Flow
```
PENDING → IN_PRODUCTION → COMPLETED
```

### API Endpoints

```
POST   /api/work-orders                    - Create from order
GET    /api/work-orders                    - List with filters
GET    /api/work-orders/:id                - Get details
GET    /api/work-orders/order/:orderId     - Get all WOs for order
PUT    /api/work-orders/:id                - Update WO
POST   /api/work-orders/:id/tracking       - Add production tracking
PATCH  /api/work-orders/:id/approve        - Approve WO
```

---

## Stage 7: Material Requisition & Procurement

**Purpose:** Request and procure materials needed for production.

### Key Files
- **Backend:** `backend/src/controllers/materialRequisition.controller.ts`
- **Database:** `material_requisitions`, `material_requisition_items`, `purchase_orders`, `goods_receiving_notes`

### Material Flow

```
Work Order BOM requirements
    ↓
Material Requisition (MRQ2512-0001)
    ↓
Check Stock → Sufficient?
    ├── YES → Issue from inventory (stock_movement: STOCK_OUT)
    └── NO → Create Purchase Order
              ↓
          Supplier delivers
              ↓
          GRN (Goods Receiving Note)
              ↓
          Quality Check → Accept/Reject
              ↓
          Auto stock_movement (STOCK_IN)
```

### Material Requisition Status
```
PENDING → ISSUED → RECEIVED
```

### Purchase Order Status
```
DRAFT → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED
                                                 ↘ CANCELLED
```

### GRN Status
```
PENDING_QC → ACCEPTED
           ↘ REJECTED
           ↘ PARTIALLY_ACCEPTED
```

---

## Stage 8: Fabric Processing (Dyeing/Printing)

**Purpose:** Process raw greige fabric through lab dip approval, dyeing/printing, and quality control.

### Key Files
- **Frontend:** `frontend/src/pages/DyeingList.tsx`, `frontend/src/pages/PrintingList.tsx`
- **Backend:** `backend/src/controllers/dyeing.controller.ts`, `backend/src/controllers/printing.controller.ts`
- **Service:** `frontend/src/services/dyeing.service.ts`, `frontend/src/services/printing.service.ts`
- **Database:** `lab_dips`, `job_work_orders`

### Lab Dip Process

Lab dips are color/print approval samples sent to mills before bulk processing.

```
┌─────────────────────────────────────────────────────────────────┐
│                       LAB DIP WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Create Lab Dip Request                                        │
│      ├── For DYEING: Target color, reference Pantone          │
│      └── For PRINTING: Design artwork, print method           │
│          ↓                                                     │
│  Send to Mill → PENDING                                        │
│          ↓                                                     │
│  Mill submits sample → SUBMITTED                               │
│          ↓                                                     │
│  Internal Review → Color match rating (Excellent/Good/Accept) │
│          ↓                                                     │
│  ┌─── APPROVED ──→ Create Job Work Order                      │
│  ├─── REJECTED ──→ Request new lab dip                        │
│  └─── RESUBMIT ──→ Mill makes adjustments                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Lab Dip Data Structure

```
lab_dips (1)
├── labDipNumber: LD-DYE-STY2024-001
├── processType: DYEING | PRINTING
├── styleId, fabricId
├── millId (supplier)
│
├── For Dyeing:
│   ├── targetColorId
│   └── colorReference (Pantone)
│
├── For Printing:
│   ├── designArtwork
│   ├── printMethod: ROTARY | FLAT_BED | DIGITAL | SCREEN
│   └── printChemistry: REACTIVE | PIGMENT | DISCHARGE | ACID
│
├── status: PENDING → APPROVED
├── colorMatchRating: Excellent | Good | Acceptable
└── approvedSampleNo
```

### Job Work Order (Dye/Print Job)

Once lab dip is approved, create job work orders for bulk processing.

```
job_work_orders (1)
├── jobWorkNumber: DJ-STY2024-001 (Dyeing) or PJ-STY2024-001 (Printing)
├── processType: DYEING | PRINTING
├── labDipId (approved lab dip)
├── styleId, fabricId, millId
│
├── Fabric Sent:
│   ├── fabricStockLotId
│   ├── qtySentMeters
│   ├── sentWidthInches
│   ├── sentDate
│   └── challanNumber
│
├── Fabric Received:
│   ├── qtyReceivedMeters
│   ├── receivedWidthInches
│   ├── receivedDate
│   └── invoiceNumber
│
├── Quality Check:
│   ├── qualityGrade: A | B | Reject
│   ├── colorMatchStatus: Match | Slight Variation | Mismatch
│   ├── actualShrinkage
│   └── defectMeters
│
└── status: READY_TO_SEND → SENT → AT_MILL → RECEIVED → QC_DONE → STOCK_UPDATED
```

### Job Work Status Flow
```
READY_TO_SEND → SENT → AT_MILL → RECEIVED → QC_DONE → STOCK_UPDATED
                                          ↘ REJECTED
```

### Dyeing/Printing API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dyeing/lab-dips` | List dyeing lab dips |
| POST | `/api/dyeing/lab-dips` | Create lab dip |
| POST | `/api/dyeing/lab-dips/:id/approve` | Approve lab dip |
| GET | `/api/dyeing/jobs` | List dye jobs |
| POST | `/api/dyeing/jobs` | Create dye job |
| POST | `/api/dyeing/jobs/:id/send` | Send fabric to mill |
| POST | `/api/dyeing/jobs/:id/receive` | Receive from mill |
| POST | `/api/dyeing/jobs/:id/quality-check` | Record QC |
| GET | `/api/printing/lab-dips` | List printing lab dips |
| GET | `/api/printing/jobs` | List print jobs |

---

## Stage 9: Cutting

**Purpose:** Cut processed fabric into garment pieces according to the marker plan.

### Key Files
- **Frontend:** `frontend/src/pages/CuttingList.tsx`
- **Backend:** `backend/src/controllers/cutting.controller.ts`
- **Service:** `frontend/src/services/cutting.service.ts`
- **Database:** `cutting_batches`, `cutting_batch_skus`, `cutting_batch_defects`

### Cutting Batch Data Structure

```
cutting_batches (1)
├── batchNumber: CB-WO2024-001-BODY-001
├── workOrderId
├── componentId (for multi-component styles)
│
├── Cutting Details:
│   ├── cuttingDate
│   ├── fabricStockId
│   ├── actualFabricWidth
│   ├── cadAverageUsed (planned)
│   ├── cadWidthUsed
│   ├── layersPerLay
│   ├── numberOfLays
│   └── fabricConsumed (actual meters)
│
├── Calculated:
│   ├── actualAverage
│   ├── varianceFromCad
│   ├── variancePercent
│   ├── wastageMeters
│   └── wastagePercent
│
├── cutting_batch_skus (many) - SKU outputs
│   ├── colorId, sizeId
│   ├── orderQty, extraAllowed, maxCuttable
│   ├── toCut, cutQty, rejectedQty
│   └── goodPcs = cutQty - rejectedQty
│
└── cutting_batch_defects (many)
    ├── colorId, sizeId
    ├── defectType: SHADE_VARIATION | FABRIC_DEFECT | CUTTING_ERROR | SIZE_WRONG | PATTERN_MISMATCH
    ├── defectQty
    └── remarks
```

### Cutting Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CUTTING WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Create Cutting Batch                                       │
│     └── Select work order, component, fabric stock             │
│         ↓                                                      │
│  2. Plan Cutting (PENDING)                                     │
│     └── Enter layers, lays, planned quantities per SKU         │
│         ↓                                                      │
│  3. Start Cutting (IN_PROGRESS)                                │
│     └── POST /cutting/batches/:id/start                        │
│         ↓                                                      │
│  4. Record Output                                              │
│     └── Enter cut qty, rejected qty, defects per SKU           │
│     └── POST /cutting/batches/:id/record-output                │
│         ↓                                                      │
│  5. Complete Batch (COMPLETED)                                 │
│     └── Calculate actuals, variance from CAD                   │
│     └── POST /cutting/batches/:id/complete                     │
│         ↓                                                      │
│  6. Generate Transfer Slip                                     │
│     └── Create slip to move pieces to stitching               │
│     └── POST /cutting/batches/:id/generate-transfer-slip       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cutting Batch Status
```
PENDING → IN_PROGRESS → COMPLETED → ON_HOLD
```

### Cutting API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cutting/batches` | List cutting batches |
| GET | `/api/cutting/batches/:id` | Get batch details |
| POST | `/api/cutting/batches` | Create batch |
| POST | `/api/cutting/batches/:id/start` | Start cutting |
| POST | `/api/cutting/batches/:id/record-output` | Record outputs |
| POST | `/api/cutting/batches/:id/complete` | Complete batch |
| POST | `/api/cutting/batches/:id/generate-transfer-slip` | Create transfer slip |
| GET | `/api/cutting/summary` | Get cutting summary |
| GET | `/api/cutting/available-work-orders` | WOs ready for cutting |

---

## Stage 10: Stitching

**Purpose:** Assemble cut pieces into garments.

### Key Files
- **Frontend:** `frontend/src/pages/StitchingList.tsx`
- **Backend:** `backend/src/controllers/stitching.controller.ts`
- **Service:** `frontend/src/services/stitching.service.ts`
- **Database:** `stitching_issues`, `stitching_issue_skus`, `stitching_daily_outputs`, `stitching_output_skus`

### Transfer Slip System

Transfer slips track movement of pieces between production stages.

```
transfer_slips (1)
├── slipNumber: TS-WO2024-001-CUT-STI-001
├── workOrderId, componentId
├── fromStage: CUTTING
├── toStage: STITCHING
├── fromDepartment, toDepartment
├── transferDate
├── status: CREATED → ACKNOWLEDGED → RECEIVED
│
├── totalGoodPieces
├── preparedById, receivedById
│
└── transfer_slip_skus (many)
    ├── colorId, sizeId
    └── quantity
```

### Stitching Data Structure

```
stitching_issues (1) - Issue slip from cutting
├── issueNumber: STI-ISS-WO2024-001
├── workOrderId, componentId
├── transferSlipId
├── issueDate, receivedById
│
└── stitching_issue_skus (many)
    ├── colorId, sizeId
    ├── issuedQty, receivedQty
    └── shortageQty

stitching_daily_outputs (1) - Daily production record
├── workOrderId, outputDate
├── lineId, supervisorId
│
├── stitching_output_skus (many)
│   ├── colorId, sizeId
│   ├── producedQty, checkedQty
│   ├── passedQty, rejectedQty, repairedQty
│   └── alterationQty
│
└── Calculated:
    ├── totalProduced, totalPassed, totalRejected
    └── passRate
```

### Stitching Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     STITCHING WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Receive Transfer Slip from Cutting                         │
│     └── Verify quantities, note any shortage                   │
│         ↓                                                      │
│  2. Create Stage Receipt                                       │
│     └── Record received quantities per SKU                     │
│         ↓                                                      │
│  3. Daily Production                                           │
│     └── Record produced, checked, passed, rejected per SKU     │
│     └── Track repairs and alterations                          │
│         ↓                                                      │
│  4. Generate Transfer Slip to Finishing                        │
│     └── Move completed garments to finishing                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stitching API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stitching/issues` | List stitching issues |
| POST | `/api/stitching/issues` | Create issue from transfer |
| GET | `/api/stitching/outputs` | List daily outputs |
| POST | `/api/stitching/outputs` | Record daily output |
| GET | `/api/stitching/summary` | Get stitching summary |

---

## Stage 11: Finishing

**Purpose:** Final touches including ironing, tagging, button attachment, and QC.

### Key Files
- **Frontend:** `frontend/src/pages/FinishingList.tsx`
- **Backend:** `backend/src/controllers/finishing.controller.ts`
- **Service:** `frontend/src/services/finishing.service.ts`
- **Database:** `finishing_issues`, `finishing_issue_skus`, `finishing_daily_outputs`, `finishing_output_skus`

### Finishing Data Structure

```
finishing_issues (1) - Issue slip from stitching
├── issueNumber: FIN-ISS-WO2024-001
├── workOrderId, componentId
├── transferSlipId
├── issueDate, receivedById
│
└── finishing_issue_skus (many)
    ├── colorId, sizeId
    ├── issuedQty, receivedQty
    └── shortageQty

finishing_daily_outputs (1) - Daily finishing record
├── workOrderId, outputDate
│
├── finishing_output_skus (many)
│   ├── colorId, sizeId
│   ├── receivedQty, finishedQty
│   ├── ironedQty, taggedQty, checkedQty
│   ├── passedQty, rejectedQty, returnedQty
│   └── packReadyQty
│
└── Calculated:
    ├── totalFinished, totalPackReady
    └── passRate
```

### Finishing Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FINISHING WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Receive Transfer Slip from Stitching                       │
│     └── Verify quantities                                      │
│         ↓                                                      │
│  2. Finishing Operations                                       │
│     ├── Ironing                                                │
│     ├── Button/accessory attachment                            │
│     ├── Tagging (brand tags, price tags)                      │
│     └── Final thread cutting                                   │
│         ↓                                                      │
│  3. Final QC Check                                             │
│     └── Record passed, rejected, returned for rework           │
│         ↓                                                      │
│  4. Pack Ready                                                 │
│     └── Garments ready for packing                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Finishing API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finishing/issues` | List finishing issues |
| POST | `/api/finishing/issues` | Create issue from transfer |
| GET | `/api/finishing/outputs` | List daily outputs |
| POST | `/api/finishing/outputs` | Record daily output |
| GET | `/api/finishing/summary` | Get finishing summary |

---

## Stage 12: Quality Control

**Purpose:** Inspect garments at multiple points to ensure quality.

### Key Files
- **Database:** `quality_inspections`, `quality_defects`

### Inspection Types

| Type | When | Method |
|------|------|--------|
| **Inline** | During production | Stage-wise checking |
| **Final** | Before packing | 100% inspection |
| **AQL** | Sampling | Statistical sampling |
| **Random** | Any time | Spot checks |

### Defect Tracking

```
quality_inspections (1)
  └── quality_defects (many)
        ├── defectType
        ├── severity: MINOR | MAJOR | CRITICAL
        ├── quantity affected
        └── remarks
```

### Quality Status
```
PASS | FAIL | CONDITIONAL_PASS
```

---

## Stage 13: Packing

**Purpose:** Pack finished garments into polybags and cartons.

### Key Files
- **Database:** `polybag_entries`, `polybag_skus`, `carton_packings`, `carton_skus`

### Polybag Entry

```
polybag_entries (1)
├── polybagNumber: PB-WO2024-001-001
├── workOrderId
├── packingDate
├── polybagSpecId (polybag size/type)
│
└── polybag_skus (many)
    ├── colorId, sizeId
    └── quantity
```

### Carton Packing

```
carton_packings (1)
├── cartonNumber: CTN-WO2024-001-001
├── workOrderId
├── packingDate
├── cartonSpecId (carton dimensions)
│
├── grossWeight, netWeight
├── dimensions (L × W × H)
│
└── carton_skus (many)
    ├── colorId, sizeId
    └── quantity
```

### Packing Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      PACKING WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pack Ready Garments (from Finishing)                          │
│      ↓                                                         │
│  1. Polybag Packing                                            │
│     └── Individual garment in polybag                          │
│         ↓                                                      │
│  2. Carton Packing                                             │
│     └── Pack polybags into cartons                            │
│     └── Record carton contents, weight, dimensions             │
│         ↓                                                      │
│  3. Carton Labeling                                            │
│     └── Shipping marks, barcodes, PO reference                │
│         ↓                                                      │
│  4. Ready for Dispatch                                         │
│     └── Cartons staged for shipment                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stage 14: Dispatch

**Purpose:** Ship finished goods to customers through ASN approval and delivery notes.

### Key Files
- **Frontend:** `frontend/src/pages/DispatchList.tsx`
- **Backend:** `backend/src/controllers/dispatch.controller.ts`
- **Service:** `frontend/src/services/dispatch.service.ts`
- **Database:** `asn_applications`, `asn_skus`, `delivery_notes`, `delivery_notes_ext`, `dispatch_cartons`, `dispatch_transports`, `dispatch_pods`

### ASN (Advance Shipping Notice) Application

Many buyers require ASN approval before accepting shipments.

```
asn_applications (1)
├── asnNumber: ASN-ORD2024-001-001
├── orderId
├── plannedDispatchQty, cartonsPlanned
├── requestedShipDate
├── applicationDate
│
├── Approval:
│   ├── status: PENDING → APPROVED → DISPATCHED
│   ├── appointmentDate, appointmentTime
│   ├── buyerRefNumber
│   ├── approvedQty
│   └── rejectionReason (if rejected)
│
└── asn_skus (many)
    ├── colorId, sizeId
    └── plannedQty
```

### ASN Status Flow
```
PENDING → APPLIED → APPROVED → DISPATCHED
                  ↘ REJECTED
                  ↘ RESCHEDULED
```

### Delivery Note Extended

```
delivery_notes_ext (1)
├── deliveryNoteId (links to existing delivery_notes)
├── asnId (links to approved ASN)
├── appointmentDate
├── shipFrom, billingAddress
├── totalCartons, totalPieces
│
├── dispatch_cartons (many) - Cartons included
├── dispatch_documents (many) - Challan, Packing List, Invoice, E-way Bill
├── dispatch_transports (1) - Vehicle, driver details
└── dispatch_pods (1) - Proof of Delivery
```

### Dispatch Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISPATCH WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Create ASN Application (if buyer requires)                 │
│     └── Submit planned qty, cartons, requested date            │
│         ↓                                                      │
│  2. Wait for Buyer Approval                                    │
│     └── Buyer confirms appointment date/time                   │
│         ↓                                                      │
│  3. Create Delivery Note                                       │
│     └── Select cartons for shipment                           │
│     └── Link to approved ASN                                  │
│         ↓                                                      │
│  4. Generate Documents                                         │
│     ├── Delivery Challan                                       │
│     ├── Packing List                                          │
│     ├── Invoice (if applicable)                               │
│     └── E-way Bill (for interstate)                           │
│         ↓                                                      │
│  5. Assign Transport                                           │
│     └── Vehicle number, driver details                        │
│         ↓                                                      │
│  6. Dispatch                                                   │
│     └── Status: PENDING → IN_TRANSIT                          │
│         ↓                                                      │
│  7. Record POD (Proof of Delivery)                            │
│     └── Delivery date, receiver name, signature               │
│     └── Status: IN_TRANSIT → DELIVERED                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Dispatch API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dispatch/asn` | List ASN applications |
| POST | `/api/dispatch/asn` | Create ASN application |
| POST | `/api/dispatch/asn/:id/apply` | Submit to buyer |
| POST | `/api/dispatch/asn/:id/approve` | Record approval |
| GET | `/api/dispatch/delivery-notes` | List delivery notes |
| POST | `/api/dispatch/delivery-notes` | Create delivery note |
| POST | `/api/dispatch/delivery-notes/:id/assign-transport` | Assign vehicle |
| POST | `/api/dispatch/delivery-notes/:id/dispatch` | Mark dispatched |
| POST | `/api/dispatch/delivery-notes/:id/record-pod` | Record delivery |
| POST | `/api/dispatch/delivery-notes/:id/generate-document` | Generate docs |
| GET | `/api/dispatch/summary` | Get dispatch summary |
| GET | `/api/dispatch/available-cartons` | Cartons ready for dispatch |
| GET | `/api/dispatch/orders-ready` | Orders ready for dispatch |

---

## Stage 15: Invoicing & Payment

**Purpose:** Bill customers and track payments.

### Key Files
- **Database:** `invoices`, `payments`

### Invoice Structure

```
order (1)
  └── invoices (many - partial invoicing supported)
        ├── invoiceNumber (unique)
        ├── invoiceDate, dueDate
        ├── subtotal, taxAmount, totalAmount
        ├── paidAmount, balanceAmount
        └── payments (many - partial payments)
              ├── paymentDate
              ├── amount
              ├── paymentMethod: CASH | CHEQUE | BANK_TRANSFER | UPI
              └── referenceNumber
```

### Invoice Status Flow
```
PENDING → PARTIALLY_PAID → PAID
                        ↘ OVERDUE
```

---

## Database Models Reference

### Core Flow Models

| Stage | Primary Tables |
|-------|----------------|
| Style | `styles`, `style_components`, `style_fabrics`, `style_garment_trims`, `style_value_additions`, `style_packaging` |
| Samples | `samples`, `sample_measurements`, `sample_colorways`, `sample_size_sets` |
| CAD | `fabric_width_cad` |
| Costing | `style_costing`, `style_costing_fabric_items` |
| Order | `orders`, `order_items`, `order_item_breakup` |
| Work Order | `work_orders`, `work_order_breakup`, `production_tracking` |
| Requisition | `material_requisitions`, `material_requisition_items` |
| Procurement | `purchase_orders`, `purchase_order_items`, `goods_receiving_notes`, `grn_items` |
| Lab Dips | `lab_dips` |
| Job Work | `job_work_orders` |
| Cutting | `cutting_batches`, `cutting_batch_skus`, `cutting_batch_defects` |
| Transfer | `transfer_slips`, `transfer_slip_skus`, `stage_receipts`, `stage_receipt_skus` |
| Stitching | `stitching_issues`, `stitching_issue_skus`, `stitching_daily_outputs`, `stitching_output_skus` |
| Finishing | `finishing_issues`, `finishing_issue_skus`, `finishing_daily_outputs`, `finishing_output_skus` |
| Quality | `quality_inspections`, `quality_defects` |
| Packing | `polybag_entries`, `polybag_skus`, `carton_packings`, `carton_skus` |
| Dispatch | `asn_applications`, `asn_skus`, `delivery_notes`, `delivery_notes_ext`, `dispatch_cartons`, `dispatch_transports`, `dispatch_pods`, `dispatch_documents` |
| Finance | `invoices`, `payments` |

### Master Data Models

| Category | Tables |
|----------|--------|
| Fabrics | `fabric_master`, `greige_master`, `fabric_stock` |
| Trims | `button_master`, `zipper_master`, `label_master`, `elastic_master`, `thread_master`, `lace_master` |
| Packaging | `packaging_master` |
| Embroidery | `embroidery_master`, `embroidery_stock` |
| Colors | `color_master`, `color_options` |
| Sizes | `size_options` |
| Lookups | `lookup_values` (configurable dropdowns) |
| Parties | `customers`, `suppliers` |
| Locations | `warehouses`, `locations` |
| Users | `users` (with roles) |

---

## API Endpoints Reference

### Style & CAD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/styles` | Create style |
| GET | `/api/styles` | List styles |
| GET | `/api/styles/:id` | Get style details |
| GET | `/api/styles/cad-planning/pending` | Styles pending CAD |
| POST | `/api/styles/cad-planning/generate` | Generate CAD options |
| POST | `/api/styles/cad-planning/approve` | Approve CAD |
| PUT | `/api/styles/cad-planning/update-cad/:cadId` | Update CAD values |

### Samples

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/samples` | List samples |
| POST | `/api/samples` | Create sample |
| GET | `/api/samples/:id` | Get sample details |
| POST | `/api/samples/:id/send` | Mark sent |
| POST | `/api/samples/:id/feedback` | Record feedback |
| GET | `/api/samples/approval-gate/:styleId` | Check approval gate |

### Costing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/style-costing` | Create cost sheet |
| POST | `/api/style-costing/generate/:styleId` | Auto-generate from CAD |
| GET | `/api/style-costing/style/:styleId` | Get cost sheet for style |
| PUT | `/api/style-costing/:id` | Update cost sheet |
| PATCH | `/api/style-costing/:id/approve` | Approve cost sheet |

### Orders & Work Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | List orders |
| POST | `/api/work-orders` | Create work order |
| GET | `/api/work-orders` | List work orders |
| POST | `/api/work-orders/:id/tracking` | Add production tracking |

### Fabric Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dyeing/lab-dips` | List dye lab dips |
| POST | `/api/dyeing/jobs` | Create dye job |
| GET | `/api/printing/lab-dips` | List print lab dips |
| POST | `/api/printing/jobs` | Create print job |

### Manufacturing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cutting/batches` | List cutting batches |
| POST | `/api/cutting/batches/:id/complete` | Complete cutting |
| GET | `/api/stitching/outputs` | List stitching outputs |
| GET | `/api/finishing/outputs` | List finishing outputs |

### Dispatch

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dispatch/asn` | Create ASN |
| POST | `/api/dispatch/delivery-notes` | Create delivery note |
| PATCH | `/api/dispatch/delivery-notes/:id/dispatch` | Dispatch shipment |
| POST | `/api/dispatch/delivery-notes/:id/record-pod` | Record POD |

### Trim Masters Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trims/summary` | Get trim counts |
| GET | `/api/trims/search` | Search all trims |
| GET | `/api/trims/recent` | Recent trims |

---

## Master Data Reference

### Trim Masters Dashboard

The system provides a unified dashboard for managing all trim masters:

| Trim Type | Route | API Endpoint |
|-----------|-------|--------------|
| Buttons | `/materials/button` | `/api/materials/button` |
| Zippers | `/materials/zipper` | `/api/materials/zipper` |
| Labels | `/materials/label` | `/api/materials/label` |
| Elastic | `/materials/elastic` | `/api/materials/elastic` |
| Thread | `/materials/thread` | `/api/materials/thread` |
| Lace | `/materials/lace` | `/api/materials/lace` |
| Packaging | `/materials/packaging` | `/api/materials/packaging` |

Access the unified dashboard at `/trim-masters` with features:
- Summary counts for all trim types
- Unified search across all trim masters
- Recent items view
- Quick navigation to individual masters

### Color Master

Global color definitions used across the system:

```
color_master
├── colorCode: CLR001 (auto-generated)
├── colorName: "Navy Blue"
├── hexCode: "#000080" (for UI swatches)
├── colorFamily: "Blues", "Reds", "Neutrals"
└── isActive
```

Route: `/colors` | API: `/api/colors`

### Embroidery Master

Track embroidery designs and stock:

```
embroidery_master
├── code, name, description
├── designFile (uploaded artwork)
├── colorCount, stitchCount
├── estimatedSAM (minutes)
└── pricePerPiece

embroidery_stock
├── embroideryId
├── quantity (in/out tracking)
└── sendOut/receive workflow
```

Routes: `/embroidery`, `/embroidery-stock`

---

## Integration Points Summary

| System | Uses CAD Average For | Uses Cost Sheet For |
|--------|---------------------|---------------------|
| **BOM** | `bom_items.fabricCADId` → actual consumption | Material cost reference |
| **Orders** | - | `totalProductCost` for pricing |
| **Work Orders** | Fabric requirement = CAD × quantity | - |
| **Material Requisition** | Fabric qty = CAD × WO qty × (1 + wastage) | - |
| **Cutting** | `cadAverageUsed` for planned consumption | - |
| **Quotations** | - | `sellingPricePerPiece` |
| **Profit Analysis** | Actual vs planned consumption | `markupPercent` margin |

---

## User Roles & Access

| Role | Access |
|------|--------|
| `ADMIN` | Full access |
| `MERCHANDISER` | Styles, CAD, Costing, Orders, Samples |
| `PRODUCTION_MANAGER` | Work Orders, Production, CAD approval |
| `SALES` | Orders, Customers, Delivery |
| `INVENTORY` | Stock, Requisitions, GRN |
| `PURCHASE` | Purchase Orders, Suppliers, GRN |
| `QUALITY` | Inspections, Defects |
| `ACCOUNTS` | Invoices, Payments |
| `FACTORY_SUPERVISOR` | Production tracking, Cutting, Stitching, Finishing |
| `DISPATCH` | ASN, Delivery Notes, POD |

---

## Quick Reference: Status Values

### Style
- `DRAFT` → `APPROVED` → `IN_PRODUCTION` → `COMPLETED`

### CAD
- `PENDING` → `IN_PROGRESS` → `APPROVED`

### Sample
- `REQUESTED` → `IN_PROGRESS` → `SUBMITTED` → `SENT` → `FEEDBACK_PENDING` → `APPROVED` | `REJECTED` | `REVISION_NEEDED`

### Lab Dip
- `PENDING` → `SUBMITTED` → `APPROVED` | `REJECTED` | `RESUBMIT`

### Job Work (Dye/Print)
- `READY_TO_SEND` → `SENT` → `AT_MILL` → `RECEIVED` → `QC_DONE` → `STOCK_UPDATED`

### Order
- `PENDING` → `IN_PRODUCTION` → `COMPLETED` → `DISPATCHED` | `CANCELLED`

### Work Order
- `PENDING` → `IN_PRODUCTION` → `COMPLETED`

### Cutting Batch
- `PENDING` → `IN_PROGRESS` → `COMPLETED` | `ON_HOLD`

### Transfer Slip
- `CREATED` → `ACKNOWLEDGED` → `RECEIVED`

### ASN
- `PENDING` → `APPLIED` → `APPROVED` | `REJECTED` | `RESCHEDULED` → `DISPATCHED`

### Delivery
- `PENDING` → `IN_TRANSIT` → `DELIVERED`

### Invoice
- `PENDING` → `PARTIALLY_PAID` → `PAID` | `OVERDUE`

---

*Last Updated: December 2024*
*System: Kashaya Fabs Garment ERP*
