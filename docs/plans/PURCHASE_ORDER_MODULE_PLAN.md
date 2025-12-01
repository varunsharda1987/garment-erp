# Purchase Order Module Implementation Plan

## Overview
Build a complete Purchase Order (PO) module for the garment ERP system, following existing architectural patterns and integrating with Suppliers, Materials, and Stock Management modules.

## Existing Schema (Already Defined)
The Prisma schema already has these models:
- `purchase_orders` (lines 642-665) - Main PO model
- `purchase_order_items` (lines 624-640) - PO line items
- `goods_receiving_notes` (lines 256-278) - GRN for receiving
- `grn_items` (lines 279-296) - GRN line items
- `PurchaseOrderStatus` enum: DRAFT, SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED

## Files to Create

### Backend (10 files)

| File | Purpose |
|------|---------|
| `backend/src/types/purchaseOrder.types.ts` | PO DTOs and interfaces |
| `backend/src/services/purchaseOrder.service.ts` | PO business logic, CRUD, status workflow |
| `backend/src/controllers/purchaseOrder.controller.ts` | PO HTTP handlers |
| `backend/src/routes/purchaseOrder.routes.ts` | PO route definitions |
| `backend/src/types/grn.types.ts` | GRN DTOs and interfaces |
| `backend/src/services/grn.service.ts` | GRN business logic with stock integration |
| `backend/src/controllers/grn.controller.ts` | GRN HTTP handlers |
| `backend/src/routes/grn.routes.ts` | GRN route definitions |

### Frontend (10 files)

| File | Purpose |
|------|---------|
| `frontend/src/types/purchaseOrder.types.ts` | PO TypeScript types and enums |
| `frontend/src/services/purchaseOrder.service.ts` | PO API client |
| `frontend/src/pages/PurchaseOrderList.tsx` | PO list view with filters |
| `frontend/src/pages/PurchaseOrderForm.tsx` | PO create/edit form |
| `frontend/src/pages/PurchaseOrderDetail.tsx` | PO detail with receiving history |
| `frontend/src/types/grn.types.ts` | GRN TypeScript types |
| `frontend/src/services/grn.service.ts` | GRN API client |
| `frontend/src/pages/GRNList.tsx` | GRN list view with filters |
| `frontend/src/pages/GRNForm.tsx` | GRN create form (from PO) |
| `frontend/src/pages/GRNDetail.tsx` | GRN detail with approve/reject |

### Files to Modify

| File | Changes |
|------|---------|
| `backend/src/routes/index.ts` | Register PO and GRN routes |
| `frontend/src/App.tsx` | Add PO and GRN routes |
| `frontend/src/components/Sidebar.tsx` | Add Procurement nav group |

---

## Implementation Details

### 1. Backend Types (`purchaseOrder.types.ts`)

```typescript
// Key interfaces
interface CreatePurchaseOrderDTO {
  supplierId: string;
  expectedDeliveryDate: Date;
  paymentTerms?: string;
  remarks?: string;
  items: PurchaseOrderItemDTO[];
}

interface PurchaseOrderItemDTO {
  materialId: string;
  orderedQuantity: number;
  unit: Unit;
  unitPrice: number;
  remarks?: string;
}

interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}
```

### 2. Backend Service (`purchaseOrder.service.ts`)

**Key Methods:**
- `generatePONumber()` - Format: PO2511-0001
- `createPurchaseOrder(data, userId)` - Create PO with items in transaction
- `getAllPurchaseOrders(filters)` - List with filters
- `getPurchaseOrderById(id)` - Get with relations
- `updatePurchaseOrder(id, data)` - Update (DRAFT only)
- `deletePurchaseOrder(id)` - Delete (DRAFT only)
- `sendPurchaseOrder(id)` - DRAFT → SENT
- `acknowledgePurchaseOrder(id)` - SENT → ACKNOWLEDGED
- `cancelPurchaseOrder(id, reason)` - Any → CANCELLED
- `approvePurchaseOrder(id, userId)` - Set approvedById
- `recalculatePOTotal(poId)` - Sum item totals

**Approval Workflow (Simple):**
```
DRAFT ──[Submit]──> PENDING_APPROVAL ──[Approve]──> APPROVED ──[Send]──> SENT
                          │
                    [Reject]
                          ↓
                       DRAFT (back to edit)
```

**Full Status Workflow:**
```
DRAFT → PENDING_APPROVAL → APPROVED → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED
   │          │               │         │          │                │
   └──────────┴───────────────┴─────────┴──────────┴────────────────┴──> CANCELLED
```

**Status Transitions:**
| From | To | Action | Role |
|------|-----|--------|------|
| DRAFT | PENDING_APPROVAL | Submit for Approval | Creator |
| PENDING_APPROVAL | APPROVED | Approve | Approver (PURCHASE, ADMIN) |
| PENDING_APPROVAL | DRAFT | Reject | Approver |
| APPROVED | SENT | Send to Supplier | Any |
| SENT | ACKNOWLEDGED | Acknowledge | Any |
| SENT/ACKNOWLEDGED | PARTIALLY_RECEIVED | GRN Created (partial) | Auto |
| PARTIALLY_RECEIVED | RECEIVED | GRN Created (complete) | Auto |
| Any (except RECEIVED) | CANCELLED | Cancel | ADMIN, PURCHASE |

### 3. Backend Controller (`purchaseOrder.controller.ts`)

| Endpoint | Method | Handler |
|----------|--------|---------|
| `GET /api/purchase-orders` | GET | getAllPurchaseOrders |
| `GET /api/purchase-orders/:id` | GET | getPurchaseOrderById |
| `GET /api/purchase-orders/supplier/:supplierId` | GET | getPurchaseOrdersBySupplier |
| `POST /api/purchase-orders` | POST | createPurchaseOrder |
| `PUT /api/purchase-orders/:id` | PUT | updatePurchaseOrder |
| `DELETE /api/purchase-orders/:id` | DELETE | deletePurchaseOrder |
| `POST /api/purchase-orders/:id/items` | POST | addPurchaseOrderItem |
| `PUT /api/purchase-orders/:id/items/:itemId` | PUT | updatePurchaseOrderItem |
| `DELETE /api/purchase-orders/:id/items/:itemId` | DELETE | removePurchaseOrderItem |
| `PATCH /api/purchase-orders/:id/send` | PATCH | sendPurchaseOrder |
| `PATCH /api/purchase-orders/:id/acknowledge` | PATCH | acknowledgePurchaseOrder |
| `PATCH /api/purchase-orders/:id/approve` | PATCH | approvePurchaseOrder |
| `PATCH /api/purchase-orders/:id/cancel` | PATCH | cancelPurchaseOrder |

### 4. Frontend Types (`purchaseOrder.types.ts`)

```typescript
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED'
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  poDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  totalAmount: number | null;
  paymentTerms: string | null;
  remarks: string | null;
  // Relations
  suppliers: SupplierSummary;
  purchaseOrderItems: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  materialId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  materials: MaterialSummary;
}
```

### 5. Frontend Pages

#### PurchaseOrderList.tsx
- **Filters**: Status, Supplier, Search, Date Range
- **Columns**: PO#, Supplier, Date, Expected Delivery, Total, Status, Actions
- **Actions**: View, Edit (if DRAFT), Send (if DRAFT)

#### PurchaseOrderForm.tsx
- **Card: Order Info** - PO Date, Expected Delivery
- **Card: Supplier** - Supplier select, Payment Terms (auto-populated)
- **Card: Items** - Material picker, Qty, Unit, Price, Total table
- **Card: Summary** - Subtotal, Grand Total display
- **Card: Notes** - Remarks textarea
- **Actions**: Cancel, Save as Draft, Submit

#### PurchaseOrderDetail.tsx
- **Header Card**: PO#, Status badge, Priority badge, Dates
- **Supplier Card**: Name, Contact, Payment Terms
- **Items Card**: Table with columns:
  - Material Code | Name | Unit | Ordered | Received | Pending | Status
  - Progress bar per item showing received %
- **Receiving History Card** (Multi-location tracking):
  - List of all GRNs against this PO
  - Columns: GRN# | Date | Warehouse | Qty Received | Status | Link
  - Summary by warehouse (total received at each location)
- **Action Buttons** based on status:
  - DRAFT: Edit, Submit for Approval, Delete
  - PENDING_APPROVAL: Approve, Reject
  - APPROVED: Send to Supplier
  - SENT/ACKNOWLEDGED/PARTIALLY_RECEIVED: Create GRN, Print
  - RECEIVED: Print, Close

### 6. Route Registration

**Backend** (`routes/index.ts`):
```typescript
import purchaseOrderRoutes from './purchaseOrder.routes';
router.use('/purchase-orders', purchaseOrderRoutes);
```

**Frontend** (`App.tsx`):
```typescript
{/* Purchase Orders */}
<Route path="/procurement/purchase-orders" element={<PurchaseOrderList />} />
<Route path="/procurement/purchase-orders/new" element={<PurchaseOrderForm />} />
<Route path="/procurement/purchase-orders/:id" element={<PurchaseOrderDetail />} />
<Route path="/procurement/purchase-orders/:id/edit" element={<PurchaseOrderForm />} />

{/* Goods Receiving Notes */}
<Route path="/procurement/grn" element={<GRNList />} />
<Route path="/procurement/grn/new" element={<GRNForm />} />
<Route path="/procurement/grn/:id" element={<GRNDetail />} />
```

**Sidebar Navigation** (`Sidebar.tsx`):
```typescript
{
  title: 'Procurement',
  icon: <ShoppingCart />,
  items: [
    { title: 'Purchase Orders', path: '/procurement/purchase-orders' },
    { title: 'Goods Receiving', path: '/procurement/grn' },
  ],
}
```

---

## Integration Points

### Supplier Integration
- Fetch supplier's default payment terms on selection
- Auto-populate payment terms field (editable)
- Show supplier contact info
- Filter materials by supplier (optional)

### Material Integration
- Material selector with search (code, name)
- Auto-populate unit from material
- Show current stock level for reference
- Show reorder level indicator

### Warehouse Integration
- GRN requires warehouse selection (destination)
- Each GRN goes to ONE warehouse per delivery
- Multiple GRNs can distribute same PO to different warehouses
- Stock levels updated per warehouse on GRN approval
- PO Detail shows receiving summary by warehouse:
  ```
  Warehouse     | Qty Received | GRN Count
  Main          | 500m         | 2
  Branch-A      | 300m         | 1
  Total         | 800m         | 3
  ```

### Stock Movement Integration
- On GRN approval, create stock_movements with:
  - movementType: 'STOCK_IN'
  - referenceType: 'GRN'
  - referenceId: grn.id
  - referenceNumber: grn.grnNumber
  - warehouseId: grn.warehouseId
  - rate: poItem.unitPrice (for valuation)
- Update stock_levels for material+warehouse combination

---

## GRN Module Details

### Key Design Principles for Multi-Location Receiving

**Business Requirements:**
- A single PO can be received in **multiple parts** (partial deliveries)
- Each delivery can go to a **different warehouse/location**
- Deliveries can happen on **different dates**
- Each GRN tracks: what was received, where, when, and quality status
- PO status automatically updates based on total received vs ordered

**Example Scenario:**
```
PO-2511-0001: Order 1000 meters of Fabric from Supplier X
  ├── GRN-2511-0001: 300m received at Main Warehouse (Nov 15)
  ├── GRN-2511-0002: 400m received at Branch Warehouse (Nov 20)
  └── GRN-2511-0003: 300m received at Main Warehouse (Nov 25)
  Status: RECEIVED (1000/1000 = 100%)
```

### GRN Types (`grn.types.ts`)

```typescript
interface CreateGRNDTO {
  poId: string;
  warehouseId: string;           // Each GRN goes to ONE warehouse
  receivingDate: Date;           // Actual receipt date
  invoiceNumber?: string;
  invoiceDate?: Date;
  transportDetails?: string;     // Truck/courier info
  remarks?: string;
  items: GRNItemDTO[];
}

interface GRNItemDTO {
  poItemId: string;
  materialId: string;
  receivedQuantity: number;      // What physically arrived
  acceptedQuantity: number;      // What passed QC
  rejectedQuantity: number;      // What failed QC
  unit: string;
  rejectionReason?: string;      // Why rejected (if any)
  remarks?: string;
}

interface GRNFilters {
  poId?: string;
  poNumber?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: GRNStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}
```

### GRN Service (`grn.service.ts`)

**Key Methods:**
- `generateGRNNumber()` - Format: GRN2511-0001
- `createGRN(data, userId)` - Create GRN with items in transaction
- `getAllGRNs(filters)` - List with filters, pagination
- `getGRNById(id)` - Get with all relations
- `getGRNsByPO(poId)` - Get all GRNs for a specific PO (receiving history)
- `getPendingItemsForPO(poId)` - Get remaining quantities to receive per item
- `approveGRN(id, userId)` - PENDING_QC → ACCEPTED, create stock movements
- `rejectGRN(id, userId, reason)` - PENDING_QC → REJECTED
- `getReceivingSummaryByPO(poId)` - Summary of all receipts grouped by warehouse

**GRN Creation Flow (Multi-Location Support):**
```
1. Validate PO exists and is in receivable status (SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED)
2. For each item in GRN:
   a. Get total already received for this PO item (sum from all previous GRNs)
   b. Validate: alreadyReceived + thisReceipt <= orderedQuantity
   c. Allow over-receipt with warning (configurable)
3. Create GRN record with:
   - warehouseId (destination for this delivery)
   - receivingDate (actual date of receipt)
   - status: PENDING_QC
4. Create GRN items linked to PO items
5. Update PO item receivedQuantity (cumulative from all GRNs)
6. Update PO status:
   - If any item has receivedQty > 0 but < orderedQty → PARTIALLY_RECEIVED
   - If all items have receivedQty >= orderedQty → RECEIVED
```

**GRN Approval Flow (Stock Integration):**
```
1. Validate GRN status is PENDING_QC
2. Update GRN status to ACCEPTED
3. For each accepted item:
   a. Create stock_movements record:
      - movementType: STOCK_IN
      - warehouseId: from GRN (destination warehouse)
      - referenceType: 'GRN'
      - referenceId: grnId
      - referenceNumber: grnNumber
   b. Update/Create stock_levels for material+warehouse combination
   c. Track rate for valuation (from PO item unitPrice)
4. Set approvedById and approvedAt timestamp
```

**Pending Quantities Calculation:**
```typescript
// For PO Item display in GRN Form
interface POItemPendingQty {
  poItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  orderedQuantity: number;
  totalReceivedQuantity: number;    // Sum from all GRNs
  pendingQuantity: number;          // ordered - received
  receivedByWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
}
```

### GRN Controller Endpoints

| Endpoint | Method | Handler |
|----------|--------|---------|
| `GET /api/grn` | GET | getAllGRNs |
| `GET /api/grn/:id` | GET | getGRNById |
| `GET /api/grn/po/:poId` | GET | getGRNsByPO |
| `GET /api/grn/po/:poId/pending` | GET | getPendingItemsForPO |
| `GET /api/grn/po/:poId/summary` | GET | getReceivingSummaryByPO |
| `POST /api/grn` | POST | createGRN |
| `PATCH /api/grn/:id/approve` | PATCH | approveGRN |
| `PATCH /api/grn/:id/reject` | PATCH | rejectGRN |

### GRN Frontend Pages

**GRNList.tsx:**
- Filters: Status, Supplier, PO Number, Warehouse, Date Range
- Columns: GRN#, PO#, Supplier, Receiving Date, Warehouse, Total Items, Status, Actions
- Row click → GRN Detail view

**GRNForm.tsx:**
- **Header Section:**
  - Select PO (dropdown with pending POs - status SENT/ACKNOWLEDGED/PARTIALLY_RECEIVED)
  - On PO select: Show supplier info, load pending items
- **Receiving Details:**
  - Select Warehouse (destination for this delivery)
  - Receiving Date (default: today, can backdate)
  - Invoice Number (optional)
  - Invoice Date (optional)
  - Transport Details (optional)
- **Items Section:**
  - Table showing PO items with pending quantities
  - Columns: Material Code | Material Name | Unit | Ordered | Already Received | Pending | This Receipt | Accepted | Rejected | Reason
  - Only show items with pending > 0
  - Validate: This Receipt <= Pending
  - Accepted + Rejected = This Receipt
- **Summary:**
  - Total items being received
  - Receiving warehouse name
- **Actions:** Cancel, Save (creates GRN in PENDING_QC status)

**GRNDetail.tsx (new):**
- Header: GRN#, Status, Receiving Date, Warehouse
- PO Reference with link
- Supplier details
- Items table with quantities (received, accepted, rejected)
- Action buttons: Approve (if PENDING_QC), Reject (if PENDING_QC)
- Approval confirmation modal with remarks

---

## Implementation Sequence

### Phase 1: Purchase Order Module
1. **PO Backend Types** - Create `purchaseOrder.types.ts`
2. **PO Backend Service** - Create `purchaseOrder.service.ts`
3. **PO Backend Controller** - Create `purchaseOrder.controller.ts`
4. **PO Backend Routes** - Create `purchaseOrder.routes.ts`
5. **PO Frontend Types** - Create `purchaseOrder.types.ts`
6. **PO Frontend Service** - Create `purchaseOrder.service.ts`
7. **PO Frontend List** - Create `PurchaseOrderList.tsx`
8. **PO Frontend Form** - Create `PurchaseOrderForm.tsx`
9. **PO Frontend Detail** - Create `PurchaseOrderDetail.tsx`

### Phase 2: GRN Module
10. **GRN Backend Types** - Create `grn.types.ts`
11. **GRN Backend Service** - Create `grn.service.ts` (with stock integration)
12. **GRN Backend Controller** - Create `grn.controller.ts`
13. **GRN Backend Routes** - Create `grn.routes.ts`
14. **GRN Frontend Types** - Create `grn.types.ts`
15. **GRN Frontend Service** - Create `grn.service.ts`
16. **GRN Frontend List** - Create `GRNList.tsx`
17. **GRN Frontend Form** - Create `GRNForm.tsx`
18. **GRN Frontend Detail** - Create `GRNDetail.tsx`

### Phase 3: Integration & Navigation
19. **Register Routes** - Update `backend/src/routes/index.ts`
20. **Frontend Routes** - Update `App.tsx` with all routes
21. **Navigation** - Update `Sidebar.tsx` with Procurement group

---

## Critical Reference Files

| File | Purpose |
|------|---------|
| `backend/src/services/workOrder.service.ts` | Service pattern with nested creates |
| `backend/src/controllers/workOrder.controller.ts` | Controller error handling pattern |
| `backend/src/services/stockMovement.service.ts` | Stock integration for GRN |
| `backend/src/services/stockLevel.service.ts` | Stock level updates |
| `backend/prisma/schema.prisma` | Existing PO/GRN models (lines 256-296, 624-665) |
| `frontend/src/pages/WorkOrderForm.tsx` | Form UI pattern |
| `frontend/src/pages/WorkOrderList.tsx` | List UI pattern |
| `backend/src/routes/index.ts` | Route registration |

---

## Decisions Made

- **PO Number Format**: `PO2511-0001` (POYYMM-sequence)
- **GRN Module**: Include basic GRN with PO integration
- **Approval Workflow**: Simple (Creator → Approver → Send to Supplier)
- **Dashboard**: Defer for now (List/Form/Detail only)
- **Navigation**: New "Procurement" group in sidebar
