# Garment ERP - Complete Product Flow Guide

> **From Style Creation to Dispatch**: A comprehensive guide to how information and products flow through the Kashaya Fabs Garment ERP system.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Stage 1: Style Creation](#stage-1-style-creation)
3. [Stage 2: CAD Planning & Average](#stage-2-cad-planning--average)
4. [Stage 3: Costing Sheet](#stage-3-costing-sheet)
5. [Stage 4: Order Creation](#stage-4-order-creation)
6. [Stage 5: Work Order Generation](#stage-5-work-order-generation)
7. [Stage 6: Material Requisition & Procurement](#stage-6-material-requisition--procurement)
8. [Stage 7: Fabric Processing](#stage-7-fabric-processing)
9. [Stage 8: Production Tracking](#stage-8-production-tracking)
10. [Stage 9: Quality Control](#stage-9-quality-control)
11. [Stage 10: Finished Goods](#stage-10-finished-goods)
12. [Stage 11: Delivery & Dispatch](#stage-11-delivery--dispatch)
13. [Stage 12: Invoicing & Payment](#stage-12-invoicing--payment)
14. [Database Models Reference](#database-models-reference)
15. [API Endpoints Reference](#api-endpoints-reference)

---

## Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE PRODUCT FLOW                        │
└─────────────────────────────────────────────────────────────────┘

 1. STYLE CREATION          Create style with fabrics, trims, packaging
        ↓
 2. CAD PLANNING            Determine fabric consumption per piece
        ↓
 3. COSTING SHEET           Calculate complete cost per garment
        ↓
 4. ORDER CREATION          Customer order with color × size matrix
        ↓
 5. WORK ORDER              Production orders per order item
        ↓
 6. MATERIAL REQUISITION    Request materials from inventory
        ↓
 7. FABRIC PROCESSING       Greige → Dyeing → Printing → Finishing
        ↓
 8. PRODUCTION              Cutting → Stitching → Finishing → Packing
        ↓
 9. QUALITY CONTROL         Inline, final, and AQL inspections
        ↓
10. FINISHED GOODS          Completed units in stock
        ↓
11. DELIVERY & DISPATCH     Ship to customer
        ↓
12. INVOICING & PAYMENT     Bill and collect payment
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

## Stage 2: CAD Planning & Average

**Purpose:** Determine fabric consumption per garment piece at different fabric widths.

> ⚠️ **This stage MUST be completed before costing can begin.**

### Key Files
- **Frontend:** `frontend/src/pages/CADPlanningPage.tsx`, `frontend/src/pages/CadAverageManagement.tsx`
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

## Stage 3: Costing Sheet

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

### Auto-Generation Flow

```javascript
// POST /api/style-costing/generate/:styleId

1. Validate: style.cadStatus === APPROVED ✓

2. Extract fabric costs:
   for each style_component:
     for each style_fabric with fabricCADId:
       fabricCost = fabricCAD.cadMeters × fabricRate

3. Extract material costs from style_material_bom

4. Calculate totals:
   subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal
   valueLoss = subtotal × 2%
   markup = (subtotal + valueLoss) × 15%
   totalProductCost = subtotal + valueLoss + markup
```

---

## Stage 4: Order Creation

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

## Stage 5: Work Order Generation

**Purpose:** Create production orders from customer orders.

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

## Stage 6: Material Requisition & Procurement

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

## Stage 7: Fabric Processing

**Purpose:** Process raw greige fabric through dyeing, printing, and finishing.

### Key Files
- **Frontend:** `frontend/src/pages/JobWorkDashboard.tsx`
- **Backend:** `backend/src/controllers/processing-batches.controller.ts`
- **Database:** `processing_batch`, `processing_stage`, `processing_movement`, `processing_delivery`

### Processing Structure

```
processing_batch (1 batch = one greige through all processing)
  ├── batchNumber: PB2512-0001
  ├── greigeId: Source greige fabric
  ├── fabricId: Target finished fabric
  └── processing_stage (many - sequential stages)
        ├── Stage 1: DYEING at Processor A
        ├── Stage 2: PRINTING at Processor B
        └── Stage 3: FINISHING at Processor C
```

### Processing Stage Status
```
PENDING → IN_TRANSIT_TO_PROCESSOR → AT_PROCESSOR → IN_PROCESS
        → IN_TRANSIT_TO_COMPANY → COMPLETED
```

### Movement Types
- `WAREHOUSE_TO_PROCESSOR` - Sending fabric to processor
- `PROCESSOR_TO_WAREHOUSE` - Receiving back from processor
- `PROCESSOR_TO_PROCESSOR` - Direct transfer between processors
- `REWORK_TO_PROCESSOR` - Sending back for rework

### Delivery & QC
```
processing_delivery
  ├── quantityDelivered
  ├── quantityAccepted
  ├── quantityRejected
  └── qualityStatus: PENDING_QC → QC_PASSED → ACCEPTED
                                            ↘ REJECTED
                                            ↘ REWORK_REQUIRED
```

---

## Stage 8: Production Tracking

**Purpose:** Track garment production through manufacturing stages.

### Key Files
- **Frontend:** `frontend/src/pages/ProductionDashboard.tsx`
- **Backend:** `backend/src/controllers/workOrder.controller.ts`
- **Database:** `production_tracking`

### Production Stages

| Stage | Description |
|-------|-------------|
| `ORDER_RECEIVED` | Order acknowledged |
| `PENDING_COSTING` | Awaiting cost sheet |
| `PENDING_GREIGE_ORDER` | Awaiting fabric procurement |
| `TRIMS_NOT_ORDERED` | Trims pending |
| `IN_CUTTING` | Fabric being cut |
| `IN_STITCHING` | Garment assembly |
| `IN_EMBROIDERY` | Embroidery work |
| `IN_HANDWORK` | Hand work |
| `IN_FINISHING` | Final touches |
| `CHECKING` | Quality inspection |
| `PACKING` | Ready for dispatch |
| `READY_TO_SHIP` | Awaiting pickup |
| `SHIPPED` | In transit |
| `COMPLETED` | Delivered |

### Stock Consumption During Production

```javascript
// As materials are used:
stock_movement.create({
  type: 'STOCK_OUT',
  materialId: material.id,
  quantity: consumedQty,
  referenceType: 'WORK_ORDER',
  referenceId: workOrder.id
});

// inventory_stock quantity decreases
// Weighted Average Costing (WAC) applied
```

---

## Stage 9: Quality Control

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

## Stage 10: Finished Goods

**Purpose:** Track completed garments ready for dispatch.

### Key Files
- **Database:** `finished_goods_stock`

### Data Structure

| Field | Description |
|-------|-------------|
| `styleId` | Which style |
| `colorId` | Which color |
| `sizeId` | Which size |
| `locationId` | Where stored |
| `quantity` | Units available |
| `workOrderId` | Source work order |
| `receivedDate` | When completed |

### Unique Constraint
```
@@unique([styleId, colorId, sizeId, locationId])
```

---

## Stage 11: Delivery & Dispatch

**Purpose:** Ship finished goods to customers.

### Key Files
- **Backend:** `backend/src/controllers/deliveryNote.controller.ts`
- **Database:** `delivery_notes`, `delivery_note_items`

### Delivery Note Structure

```
order (1)
  └── delivery_notes (many - multiple shipments per order)
        ├── deliveryNumber (unique)
        ├── deliveryDate
        ├── vehicleNumber, driverName, driverPhone
        └── delivery_note_items (many)
              ├── styleId, colorId, sizeId
              ├── quantity shipped
              └── cartons
```

### Delivery Status Flow
```
PENDING → IN_TRANSIT → DELIVERED
```

### API Endpoints

```
GET    /api/delivery-notes                  - List deliveries
GET    /api/delivery-notes/:id              - Get delivery details
POST   /api/delivery-notes                  - Create delivery note
PATCH  /api/delivery-notes/:id/status       - Update status
```

---

## Stage 12: Invoicing & Payment

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
| CAD | `fabric_width_cad` |
| Costing | `style_costing`, `style_costing_fabric_items` |
| Order | `orders`, `order_items`, `order_item_breakup` |
| Work Order | `work_orders`, `work_order_breakup`, `production_tracking` |
| Requisition | `material_requisitions`, `material_requisition_items` |
| Procurement | `purchase_orders`, `purchase_order_items`, `goods_receiving_notes`, `grn_items` |
| Processing | `processing_batch`, `processing_stage`, `processing_movement`, `processing_delivery` |
| Inventory | `materials`, `stock_levels`, `stock_movements`, `inventory_stock` |
| Quality | `quality_inspections`, `quality_defects` |
| Finished Goods | `finished_goods_stock` |
| Dispatch | `delivery_notes`, `delivery_note_items` |
| Finance | `invoices`, `payments` |

### Master Data Models

| Category | Tables |
|----------|--------|
| Materials | `fabric_master`, `greige_master`, `button_master`, `zipper_master`, `label_master`, `elastic_master`, `thread_master`, `lace_master`, `packaging_master` |
| Lookups | `color_options`, `size_options`, `categories` |
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

### Inventory & Procurement

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/purchase-orders` | Create PO |
| POST | `/api/grn` | Create GRN |
| GET | `/api/inventory/stock` | Get stock levels |
| POST | `/api/stock-movements` | Record stock movement |

### Delivery

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/delivery-notes` | Create delivery note |
| PATCH | `/api/delivery-notes/:id/status` | Update delivery status |

---

## Integration Points Summary

| System | Uses CAD Average For | Uses Cost Sheet For |
|--------|---------------------|---------------------|
| **BOM** | `bom_items.fabricCADId` → actual consumption | Material cost reference |
| **Orders** | - | `totalProductCost` for pricing |
| **Work Orders** | Fabric requirement = CAD × quantity | - |
| **Material Requisition** | Fabric qty = CAD × WO qty × (1 + wastage) | - |
| **Quotations** | - | `sellingPricePerPiece` |
| **Profit Analysis** | Actual vs planned consumption | `markupPercent` margin |

---

## User Roles & Access

| Role | Access |
|------|--------|
| `ADMIN` | Full access |
| `MERCHANDISER` | Styles, CAD, Costing, Orders |
| `PRODUCTION_MANAGER` | Work Orders, Production, CAD approval |
| `SALES` | Orders, Customers, Delivery |
| `INVENTORY` | Stock, Requisitions, GRN |
| `PURCHASE` | Purchase Orders, Suppliers, GRN |
| `QUALITY` | Inspections, Defects |
| `ACCOUNTS` | Invoices, Payments |
| `FACTORY_SUPERVISOR` | Production tracking |

---

## Quick Reference: Status Values

### Style
- `DRAFT` → `APPROVED` → `IN_PRODUCTION` → `COMPLETED`

### CAD
- `PENDING` → `IN_PROGRESS` → `APPROVED`

### Order
- `PENDING` → `IN_PRODUCTION` → `COMPLETED` → `DISPATCHED` | `CANCELLED`

### Work Order
- `PENDING` → `IN_PRODUCTION` → `COMPLETED`

### Material Requisition
- `PENDING` → `ISSUED` → `RECEIVED`

### Purchase Order
- `DRAFT` → `SENT` → `ACKNOWLEDGED` → `PARTIALLY_RECEIVED` → `RECEIVED` | `CANCELLED`

### Delivery
- `PENDING` → `IN_TRANSIT` → `DELIVERED`

### Invoice
- `PENDING` → `PARTIALLY_PAID` → `PAID` | `OVERDUE`

---

*Last Updated: December 2024*
*System: Kashaya Fabs Garment ERP*
