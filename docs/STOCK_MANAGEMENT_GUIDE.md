# Stock Management Guide

> **Complete Inventory & Stock Tables Documentation**
> **Last Updated:** January 13, 2026
> **Version:** 1.1

---

## Table of Contents

1. [Overview](#1-overview)
2. [Stock Tables Decision Matrix](#2-stock-tables-decision-matrix)
3. [Fabric Stock Management](#3-fabric-stock-management)
4. [Embroidery Stock Workflow](#4-embroidery-stock-workflow)
5. [Finished Goods Stock](#5-finished-goods-stock)
6. [Inventory Stock (Materials & Trims)](#6-inventory-stock-materials--trims)
7. [Stock Levels & Transactions](#7-stock-levels--transactions)
8. [Stock Counting & Physical Inventory](#8-stock-counting--physical-inventory)
9. [API Reference](#9-api-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

The system uses multiple stock tables for different material types:

| Table | Purpose | Material Type |
|-------|---------|---------------|
| `fabric_stock` | Finished fabric ready for cutting | Fabrics |
| `greige_master` | Raw fabric before processing | Greige |
| `embroidery_send_out` | Embroidery outsourcing workflow | Embroidered fabric |
| `finished_goods_stock` | Completed garments | Finished products |
| `inventory_stock` | Non-fabric materials | Buttons, zippers, thread, labels |
| `stock_levels` | Current balance summary | All materials |
| `stock_movements` | Transaction log | All materials |
| `stock_transactions` | Valuation ledger | All materials |

### Key Relationships

```
greige_master (raw fabric specs)
    ↓
fabric_procurement (purchase order)
    ↓
fabric_processing (dyeing/printing)
    ↓
fabric_master (finished fabric specs)
    ↓
fabric_stock (physical inventory)
    ↓
fabric_stock_allocation (order allocation)
    ↓
cutting_batches (consumption)
```

---

## 2. Stock Tables Decision Matrix

### Which Table to Use?

| Scenario | Table | Reason |
|----------|-------|--------|
| Track finished fabric ready for cutting | `fabric_stock` | Complete fabric lifecycle with allocations |
| Track raw fabric before processing | `greige_master` + `fabric_processing` | Greige as separate entity through processing |
| Track embroidered fabric | `embroidery_send_out` + resulting `fabric_stock` | Outsourcing workflow + result |
| Track buttons, zippers, thread, labels | `inventory_stock` | Material catalog for non-fabric items |
| Check current balance per material/warehouse | `stock_levels` | Fast query for current balance |
| Audit all movements | `stock_movements` | Immutable transaction log |
| Calculate valuation/COGS | `stock_transactions` | Running balance with costs |
| Reserve stock for orders | `stock_reservations` | Prevents overselling |
| Allocate fabric to specific orders | `fabric_stock_allocation` | Order-specific with CAD tracking |
| Physical inventory count | `stock_counts` + `stock_count_items` | Variance detection |
| Track finished garments | `finished_goods_stock` | Completed units by style/color/size |

---

## 3. Fabric Stock Management

### Purpose
Tracks all finished fabric inventory with lifecycle management.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/fabric-stock.routes.ts` |
| Service | `backend/src/services/fabric-stock.service.ts` |
| Pages | `frontend/src/pages/FabricAvailableStock.tsx`, `FabricStockEntry.tsx` |

### Database Model: `fabric_stock`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| fabricId | UUID | Reference to fabric_master |
| finishedWidth | Decimal | Width after processing (inches) |
| cutableWidth | Decimal | Usable cutting width |
| quantityAvailable | Decimal | Meters available |
| quantityReserved | Decimal | Meters reserved |
| quantityConsumed | Decimal | Meters used |
| status | Enum | AVAILABLE, RESERVED, DEPLETED, QUARANTINED |
| stockType | Enum | EXCESS, EXCESS_MOQ, PLANNED_STOCK, RETURNED, VARIANCE_UNUSED |
| weightedAvgCost | Decimal | Cost per meter |
| qualityGrade | Enum | A, B, DEFECT |
| warehouseLocation | String | Storage location |
| agingDays | Int | Days in stock (auto-calculated) |

### Stock Types Explained

| Type | Description |
|------|-------------|
| PLANNED_STOCK | Ordered for specific style/order |
| EXCESS | Leftover from production |
| EXCESS_MOQ | Leftover due to MOQ purchase |
| RETURNED | Returned from production |
| VARIANCE_UNUSED | CAD variance savings |

### API Endpoints

```
POST   /api/stock              - Create fabric stock
GET    /api/stock              - List all stock
GET    /api/stock/dashboard    - Stock dashboard metrics
GET    /api/stock/summary      - Fabric stock summary
GET    /api/stock/aging        - Aging stock report (>6 months)
GET    /api/stock/valuation    - Stock valuation report
GET    /api/stock/:id          - Get stock by ID
POST   /api/stock/transfer     - Transfer between warehouses
POST   /api/stock/adjust       - Adjust quantity
PATCH  /api/stock/:id          - Update stock record
DELETE /api/stock/:id          - Delete stock
```

### Fabric Allocation: `fabric_stock_allocation`

Allocates fabric to specific orders with CAD variance tracking.

| Field | Type | Description |
|-------|------|-------------|
| stockId | UUID | Fabric stock reference |
| orderId | UUID | Order receiving allocation |
| quantityAllocated | Decimal | Meters allocated |
| quantityConsumed | Decimal | Meters used |
| plannedCad | Decimal | CAD for planning |
| actualCad | Decimal | Actual consumption |
| allocationType | Enum | SAME_STYLE, CROSS_STYLE, STOCK_UTILIZATION |
| allocationStatus | Enum | RESERVED, IN_PRODUCTION, CONSUMED, CANCELLED |

### Fabric Transactions: `fabric_stock_transaction`

Complete audit trail for fabric movements.

| Transaction Type | Description |
|------------------|-------------|
| RECEIPT | New stock arrival |
| CONSUMPTION | Used in production |
| RETURN | Returned from production |
| ADJUSTMENT | Manual quantity adjustment |
| TRANSFER | Warehouse transfer |
| GRADE_DOWN | Quality downgrade |
| RESERVATION | Reserved for order |
| RELEASE | Released from reservation |

---

## 4. Embroidery Stock Workflow

### Purpose
Tracks fabric sent for embroidery and the complete lifecycle.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/embroidery-stock.routes.ts` |
| Pages | `frontend/src/pages/EmbroideryStockSendOut.tsx`, `EmbroideryStockReceive.tsx` |

### Database Model: `embroidery_send_out`

| Field | Type | Description |
|-------|------|-------------|
| sourceFabricStockId | UUID | Plain fabric being sent |
| embroideryId | UUID | Design being applied |
| supplierId | UUID | Embroidery vendor |
| quantitySent | Decimal | Meters sent |
| quantityReceived | Decimal | Meters received back |
| quantityDamaged | Decimal | Damaged/rejected meters |
| status | Enum | SENT, IN_PROGRESS, RECEIVED, PARTIALLY_RECEIVED, CANCELLED |
| resultFabricStockId | UUID | Embroidered fabric_stock created |

### API Endpoints

```
POST   /api/embroidery/send-out              - Send fabric for embroidery
POST   /api/embroidery/receive               - Receive embroidered fabric
GET    /api/embroidery/send-outs             - List send-out records
GET    /api/embroidery/send-outs/:id         - Get details
POST   /api/embroidery/send-outs/:id/cancel  - Cancel send-out
GET    /api/embroidery/by-style/:styleId     - Stock by style
GET    /api/embroidery/pending               - Pending send-outs
GET    /api/embroidery/summary               - Stock summary
```

### Workflow

```
Plain Fabric Stock → Send for Embroidery (create embroidery_send_out)
         ↓
Track at Vendor → Receive Back (partial or full)
         ↓
Create Embroidered fabric_stock (resultFabricStockId)
         ↓
Available for Cutting
```

---

## 5. Finished Goods Stock

### Purpose
Tracks completed garments by style, color, and size.

### Database Model: `finished_goods_stock`

| Field | Type | Description |
|-------|------|-------------|
| styleId | UUID | Style of garment |
| colorId | UUID | Color variant |
| sizeId | UUID | Size variant |
| variantId | UUID | Optional style variant |
| quantity | Int | Number of pieces |
| locationId | UUID | Warehouse location |
| workOrderId | UUID | Work order that produced this |
| receivedDate | DateTime | When received |

**Unique Constraint:** (styleId, colorId, sizeId, locationId)

### Use Case
After finishing phase completes, finished goods are added here and become available for dispatch.

---

## 6. Inventory Stock (Materials & Trims)

### Purpose
Tracks non-fabric items: buttons, zippers, thread, labels, packaging.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/stockLevel.routes.ts` |
| Pages | `frontend/src/pages/StockLevelList.tsx` |

### Database Model: `inventory_stock`

| Field | Type | Description |
|-------|------|-------------|
| materialId | UUID | Reference to materials table |
| locationId | UUID | Warehouse location |
| quantity | Decimal | Available quantity |
| unit | String | Unit of measurement |

**Unique Constraint:** (materialId, locationId)

### Material Categories

| Category | Examples |
|----------|----------|
| BUTTON | Shirt buttons, coat buttons |
| ZIPPER | Metal zippers, plastic zippers |
| THREAD | Sewing thread, embroidery thread |
| ELASTIC | Waistband elastic, cuff elastic |
| LABEL | Brand labels, care labels, size labels |
| LACE | Cotton lace, polyester lace |
| PACKAGING | Polybags, boxes, hangers |

---

## 7. Stock Levels & Transactions

### Stock Levels: `stock_levels`

Current balance summary per material per warehouse.

| Field | Type | Description |
|-------|------|-------------|
| materialId | UUID | Material reference |
| warehouseId | UUID | Warehouse reference |
| quantity | Decimal | Current balance |
| reorderLevel | Decimal | Reorder point |
| minLevel | Decimal | Minimum stock |
| maxLevel | Decimal | Maximum stock |
| valuationRate | Decimal | Average cost |
| stockValue | Decimal | quantity × valuationRate |

### API Endpoints

```
GET    /api/stock-levels                         - All levels
GET    /api/stock-levels/below-reorder           - Below reorder level
GET    /api/stock-levels/valuation               - Valuation report
GET    /api/stock-levels/aging/:warehouseId      - Aging report
GET    /api/stock-levels/by-type/:materialType   - By material type
GET    /api/stock-levels/material/:materialId    - By material
GET    /api/stock-levels/warehouse/:warehouseId  - By warehouse
```

### Stock Movements: `stock_movements`

Immutable log of all stock movements.

| Movement Type | Description |
|---------------|-------------|
| STOCK_IN | Material receipt |
| STOCK_OUT | Material issue |
| TRANSFER_IN | Received from transfer |
| TRANSFER_OUT | Sent for transfer |
| ADJUSTMENT_IN | Positive adjustment |
| ADJUSTMENT_OUT | Negative adjustment |

### API Endpoints

```
GET    /api/movements                              - All movements
GET    /api/movements/material/:materialId/history - Movement history
GET    /api/movements/summary/:warehouseId         - Movement summary
GET    /api/movements/ledger/:materialId/:warehouseId - Stock ledger
POST   /api/movements/stock-in                     - Stock in
POST   /api/movements/stock-out                    - Stock out
POST   /api/movements/transfer                     - Transfer
POST   /api/movements/adjustment                   - Adjustment
```

### Stock Transactions: `stock_transactions`

Detailed ledger for valuation (FIFO/LIFO/Weighted Average).

| Field | Type | Description |
|-------|------|-------------|
| transactionType | Enum | IN, OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT |
| quantity | Decimal | Transaction amount |
| rate | Decimal | Rate per unit |
| value | Decimal | Transaction value |
| balanceQuantity | Decimal | Running balance qty |
| balanceValue | Decimal | Running balance value |

### Stock Reservations: `stock_reservations`

Reserves stock for orders, work orders, or requisitions.

| Field | Type | Description |
|-------|------|-------------|
| materialId | UUID | Material being reserved |
| reservationType | String | Type of reservation |
| referenceType | String | Order, WorkOrder, MaterialRequisition |
| reservedQuantity | Decimal | Amount reserved |
| consumedQuantity | Decimal | Amount actually consumed |
| status | Enum | ACTIVE, COMPLETED, CANCELLED, EXPIRED |

---

## 8. Stock Counting & Physical Inventory

### Purpose
Manages physical inventory counts and variance detection.

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/stockCount.routes.ts` |
| Pages | `frontend/src/pages/StockCountList.tsx`, `StockCountForm.tsx` |

### Database Models

**Stock Counts (Header):** `stock_counts`

| Field | Type | Description |
|-------|------|-------------|
| countNumber | String | Unique identifier |
| warehouseId | UUID | Warehouse being counted |
| countType | Enum | FULL, PARTIAL, CYCLE, SPOT_CHECK |
| status | Enum | DRAFT, IN_PROGRESS, COUNTED, VERIFIED, APPROVED, CANCELLED |
| totalItems | Int | Items to count |
| varianceItems | Int | Items with variance |

**Stock Count Items:** `stock_count_items`

| Field | Type | Description |
|-------|------|-------------|
| stockCountId | UUID | Parent count |
| materialId | UUID | Material counted |
| systemQuantity | Decimal | System/recorded quantity |
| physicalQuantity | Decimal | Physically counted |
| variance | Decimal | Difference (physical - system) |

### API Endpoints

```
GET    /api/stock-counts                         - List counts
POST   /api/stock-counts                         - Create count
GET    /api/stock-counts/:id                     - Get details
POST   /api/stock-counts/:id/start               - Start counting
PUT    /api/stock-counts/:countId/items/:itemId  - Update count item
POST   /api/stock-counts/:id/verify              - Verify count
POST   /api/stock-counts/:id/approve             - Approve & apply adjustments
POST   /api/stock-counts/:id/cancel              - Cancel count
GET    /api/stock-counts/:id/variance            - Variance report
GET    /api/stock-counts/summary/:warehouseId    - Count summary
```

### Stock Counting Workflow

```
Create Count → Start Counting → Record Physical Quantities
      ↓
Calculate Variance → Verify → Approve
      ↓
Generate Adjustment Movements → Update Stock Levels
```

---

## 9. API Reference

### Frontend Pages Summary

| Page | Purpose | Data Source |
|------|---------|-------------|
| StockDashboard.tsx | Unified inventory overview | All stock tables |
| FabricAvailableStock.tsx | Finished fabric inventory | fabric_stock |
| GreigeAvailableStock.tsx | Raw fabric inventory | greige via style_stock.service |
| EmbroideryAvailableStock.tsx | Embroidery workflow | embroidery_send_out |
| StockLevelList.tsx | Material & trim balances | stock_levels |
| StockMovementList.tsx | Transaction history | stock_movements |
| StockCountList.tsx | Physical counts | stock_counts |
| StockInForm.tsx | Receive goods | stock_movements |
| StockOutForm.tsx | Issue goods | stock_movements |
| StockTransferForm.tsx | Warehouse transfer | stock_movements |
| StockAdjustmentForm.tsx | Adjust quantities | stock_movements |

### ViewStockButton Navigation Pattern

The `ViewStockButton` component provides consistent stock navigation across all 9 material master pages.

**Component:** `frontend/src/components/ViewStockButton.tsx`

**Implemented on Material Masters:**
- Thread Master
- Button Master
- Zipper Master
- Elastic Master
- Label Master
- Lace Master
- Packaging Master
- Other Material Master
- Embroidery Master

**Usage Pattern:**
```tsx
// On any material master detail page
<ViewStockButton
  materialType="THREAD"  // or BUTTON, ZIPPER, etc.
  materialId={material.id}
/>
```

**Navigation Flow:**
```
Material Master Page → ViewStockButton Click → StockDashboard
                                               (filtered by materialType + materialId)
```

**Features:**
- Consistent button styling across all master pages
- Pre-filters StockDashboard by material type and ID
- Shows current available quantity in button label
- Supports all 9 material categories

### Frontend Services

| Service | Purpose |
|---------|---------|
| fabricStock.service.ts | Fabric stock CRUD, dashboard, aging |
| style-stock.service.ts | Style-specific stock, greige |
| stockMovement.service.ts | Movement operations |
| stockLevel.service.ts | Balance queries, valuation |
| stockCount.service.ts | Physical count operations |

---

## 10. Troubleshooting

### Fabric Not Showing as Available

**Cause:** Status is not AVAILABLE or already reserved
**Solution:** Check `fabric_stock.status` = 'AVAILABLE' and `quantityAvailable` > 0

### Aging Alert Not Working

**Cause:** agingAlertSent flag already true
**Solution:** Check stock records where `agingDays > 180` and `agingAlertSent = false`

### Stock Variance Too High After Count

**Cause:** System quantity outdated
**Solution:** Ensure all pending movements are processed before count

### Embroidery Stock Not Created After Receive

**Cause:** Receive transaction not completed
**Solution:** Check `embroidery_send_out.status` = 'RECEIVED' and `resultFabricStockId` is set

### Cannot Allocate Stock to Order

**Cause:** Insufficient available quantity
**Solution:** Check `quantityAvailable - quantityReserved >= requested amount`

---

## Key Business Rules

1. **Fabric Stock Aging:** Alert after 6 months in stock
2. **Weighted Average Costing:** Cost calculated across all lots
3. **CAD Variance Tracking:** Compare planned vs actual consumption
4. **Cross-Style Allocation:** Stock from Style A can be used for Style B
5. **Quality Grades:** A (perfect), B (acceptable), DEFECT (separate tracking)
6. **FIFO Consumption:** First-in, first-out for stock issues

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Production workflow
- [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) - Fabric costing system

---

**Maintained By:** Kashaya Fabs Development Team

---

## Changelog

### v1.1 (2026-01-13)
- Added ViewStockButton navigation pattern documentation
- Documented unified dashboard architecture with material type filtering
