# Phase 3: Inventory & Warehouse Management - Implementation Plan

**Start Date:** 2025-11-15
**Status:** Planning → Implementation
**Priority:** High
**Estimated Duration:** 2-3 sessions (6-10 hours)

---

## 🎯 Phase 3 Objectives

### Primary Goals
1. **Real-time Stock Visibility** - Track all materials across all locations
2. **Stock Movement Tracking** - Record all ins/outs with complete audit trail
3. **Multi-Location Support** - Manage stock across office, warehouse, and production sites
4. **Reorder Management** - Automated alerts for low stock
5. **Stock Valuation** - Support FIFO/LIFO/Weighted Average methods
6. **Physical Inventory** - Periodic stock counts and reconciliation

### Business Impact
- ✅ Prevents stockouts and production delays
- ✅ Optimizes inventory carrying costs
- ✅ Enables accurate material costing
- ✅ Foundation for production planning (Phase 4)
- ✅ Supports purchase planning

---

## 📊 Database Schema Design

### New Tables (7 tables)

#### 1. **warehouses** (Storage Locations)
```prisma
model warehouses {
  id            String   @id @default(uuid())
  warehouseCode String   @unique
  warehouseName String
  type          WarehouseType  // MAIN, BRANCH, PRODUCTION_UNIT, VENDOR
  location      String
  address       String?
  city          String?
  state         String?
  pincode       String?
  contactPerson String?
  contactPhone  String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  stockLevels   stock_levels[]
  stockMovements stock_movements[]

  @@index([warehouseCode])
  @@index([type])
}

enum WarehouseType {
  MAIN_WAREHOUSE
  BRANCH_WAREHOUSE
  PRODUCTION_UNIT
  VENDOR_LOCATION
  OFFICE
}
```

#### 2. **stock_levels** (Current Stock Balance)
```prisma
model stock_levels {
  id              String   @id @default(uuid())
  materialId      String
  warehouseId     String
  quantityOnHand  Decimal  @db.Decimal(15, 4)
  quantityReserved Decimal @db.Decimal(15, 4) @default(0)
  quantityAvailable Decimal @db.Decimal(15, 4)  // computed: onHand - reserved
  reorderPoint    Decimal? @db.Decimal(15, 4)
  reorderQuantity Decimal? @db.Decimal(15, 4)
  lastStockTakeDate DateTime?
  lastStockTakeBy   String?
  averageCost     Decimal? @db.Decimal(15, 4)  // weighted average
  totalValue      Decimal? @db.Decimal(15, 4)  // quantity × average cost
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  material        materials  @relation(fields: [materialId], references: [id])
  warehouse       warehouses @relation(fields: [warehouseId], references: [id])
  lastStockTakeUser users?   @relation(fields: [lastStockTakeBy], references: [id])

  @@unique([materialId, warehouseId])
  @@index([materialId])
  @@index([warehouseId])
  @@index([quantityOnHand])
}
```

#### 3. **stock_movements** (Transaction Log)
```prisma
model stock_movements {
  id              String   @id @default(uuid())
  movementNumber  String   @unique
  movementDate    DateTime
  movementType    MovementType
  materialId      String
  fromWarehouseId String?
  toWarehouseId   String?
  quantity        Decimal  @db.Decimal(15, 4)
  unitCost        Decimal? @db.Decimal(15, 4)
  totalValue      Decimal? @db.Decimal(15, 4)
  referenceType   String?  // PO, PRODUCTION_ORDER, SALES_ORDER, ADJUSTMENT
  referenceId     String?
  referenceNumber String?
  reason          String?
  notes           String?  @db.Text
  createdById     String
  createdAt       DateTime @default(now())

  // Relations
  material        materials   @relation(fields: [materialId], references: [id])
  fromWarehouse   warehouses? @relation("FromWarehouse", fields: [fromWarehouseId], references: [id])
  toWarehouse     warehouses? @relation("ToWarehouse", fields: [toWarehouseId], references: [id])
  createdBy       users       @relation(fields: [createdById], references: [id])

  @@index([movementNumber])
  @@index([materialId])
  @@index([movementDate])
  @@index([movementType])
  @@index([referenceType, referenceId])
}

enum MovementType {
  STOCK_IN          // Receiving from supplier
  STOCK_OUT         // Issue to production/sales
  TRANSFER          // Between warehouses
  ADJUSTMENT        // Stock count adjustment
  RETURN_FROM_PRODUCTION
  RETURN_TO_SUPPLIER
  SCRAP             // Wastage/damage
}
```

#### 4. **stock_transactions** (Detailed Ledger)
```prisma
model stock_transactions {
  id              String   @id @default(uuid())
  transactionDate DateTime
  materialId      String
  warehouseId     String
  transactionType TransactionType
  quantity        Decimal  @db.Decimal(15, 4)
  unitCost        Decimal? @db.Decimal(15, 4)
  totalValue      Decimal? @db.Decimal(15, 4)
  balanceQty      Decimal  @db.Decimal(15, 4)  // Running balance
  balanceValue    Decimal? @db.Decimal(15, 4)  // Running value
  movementId      String?  // Link to stock_movements
  referenceType   String?
  referenceId     String?
  createdById     String
  createdAt       DateTime @default(now())

  // Relations
  material        materials @relation(fields: [materialId], references: [id])
  warehouse       warehouses @relation(fields: [warehouseId], references: [id])
  movement        stock_movements? @relation(fields: [movementId], references: [id])
  createdBy       users @relation(fields: [createdById], references: [id])

  @@index([materialId, warehouseId, transactionDate])
  @@index([transactionDate])
}

enum TransactionType {
  RECEIPT
  ISSUE
  TRANSFER_OUT
  TRANSFER_IN
  ADJUSTMENT_PLUS
  ADJUSTMENT_MINUS
}
```

#### 5. **stock_reservations** (Allocated Stock)
```prisma
model stock_reservations {
  id              String   @id @default(uuid())
  materialId      String
  warehouseId     String
  quantity        Decimal  @db.Decimal(15, 4)
  reservedFor     ReservationType
  referenceId     String   // Order ID, Production Order ID, etc.
  referenceNumber String?
  reservedDate    DateTime @default(now())
  expiryDate      DateTime?
  status          ReservationStatus @default(ACTIVE)
  releasedDate    DateTime?
  releasedById    String?
  createdById     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  material        materials @relation(fields: [materialId], references: [id])
  warehouse       warehouses @relation(fields: [warehouseId], references: [id])
  createdBy       users @relation("ReservationCreator", fields: [createdById], references: [id])
  releasedBy      users? @relation("ReservationReleaser", fields: [releasedById], references: [id])

  @@index([materialId, warehouseId, status])
  @@index([referenceId])
}

enum ReservationType {
  SALES_ORDER
  PRODUCTION_ORDER
  TRANSFER_ORDER
  OTHER
}

enum ReservationStatus {
  ACTIVE
  RELEASED
  EXPIRED
  CONSUMED
}
```

#### 6. **stock_counts** (Physical Inventory)
```prisma
model stock_counts {
  id              String   @id @default(uuid())
  countNumber     String   @unique
  countDate       DateTime
  warehouseId     String
  countType       CountType
  status          CountStatus @default(IN_PROGRESS)
  plannedBy       String
  countedBy       String?
  approvedBy      String?
  approvedAt      DateTime?
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  warehouse       warehouses @relation(fields: [warehouseId], references: [id])
  planner         users @relation("CountPlanner", fields: [plannedBy], references: [id])
  counter         users? @relation("CountCounter", fields: [countedBy], references: [id])
  approver        users? @relation("CountApprover", fields: [approvedBy], references: [id])
  items           stock_count_items[]

  @@index([countNumber])
  @@index([warehouseId, countDate])
}

enum CountType {
  FULL_PHYSICAL     // Complete warehouse count
  CYCLE_COUNT       // Selected items
  SPOT_CHECK        // Random verification
}

enum CountStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  APPROVED
  CANCELLED
}
```

#### 7. **stock_count_items** (Physical Count Details)
```prisma
model stock_count_items {
  id              String   @id @default(uuid())
  stockCountId    String
  materialId      String
  systemQty       Decimal  @db.Decimal(15, 4)
  countedQty      Decimal? @db.Decimal(15, 4)
  variance        Decimal? @db.Decimal(15, 4)  // counted - system
  variancePercent Decimal? @db.Decimal(5, 2)
  unitCost        Decimal? @db.Decimal(15, 4)
  varianceValue   Decimal? @db.Decimal(15, 4)
  reason          String?
  notes           String?
  countedAt       DateTime?
  adjustmentId    String?  // Link to created stock_movement if adjusted

  // Relations
  stockCount      stock_counts @relation(fields: [stockCountId], references: [id], onDelete: Cascade)
  material        materials @relation(fields: [materialId], references: [id])
  adjustment      stock_movements? @relation(fields: [adjustmentId], references: [id])

  @@index([stockCountId])
  @@index([materialId])
}
```

---

## 🏗️ Backend Implementation Plan

### Session 1: Database & Core Services (3-4 hours)

#### Step 1: Update Prisma Schema
- [ ] Add 7 new tables to schema.prisma
- [ ] Add 5 new enums
- [ ] Update materials model with inventory relations
- [ ] Run migration

#### Step 2: Create Services
1. **warehouse.service.ts**
   - CRUD for warehouses
   - Get warehouse by code
   - List active warehouses

2. **stockLevel.service.ts**
   - Get stock levels by material/warehouse
   - Update stock levels (internal use)
   - Get low stock alerts (below reorder point)
   - Get stock value by warehouse

3. **stockMovement.service.ts**
   - Create stock movement (with transaction)
   - Update stock levels automatically
   - Generate movement number
   - Get movement history

4. **stockTransaction.service.ts**
   - Create transaction record
   - Calculate running balances
   - Support FIFO/LIFO/Weighted Average

5. **stockReservation.service.ts**
   - Create reservation
   - Release reservation
   - Get active reservations

6. **stockCount.service.ts**
   - Create physical count
   - Record count items
   - Calculate variances
   - Create adjustments

### Session 2: Controllers & Routes (2-3 hours)

#### Create Controllers
1. **warehouse.controller.ts**
   - GET /api/warehouses - List all
   - POST /api/warehouses - Create
   - GET /api/warehouses/:id - Get one
   - PUT /api/warehouses/:id - Update
   - DELETE /api/warehouses/:id - Soft delete

2. **stockLevel.controller.ts**
   - GET /api/stock-levels - List with filters
   - GET /api/stock-levels/material/:id - By material
   - GET /api/stock-levels/warehouse/:id - By warehouse
   - GET /api/stock-levels/low-stock - Reorder alerts
   - GET /api/stock-levels/valuation - Stock value report

3. **stockMovement.controller.ts**
   - POST /api/stock-movements/stock-in - Receive stock
   - POST /api/stock-movements/stock-out - Issue stock
   - POST /api/stock-movements/transfer - Transfer between warehouses
   - POST /api/stock-movements/adjustment - Stock adjustment
   - GET /api/stock-movements - List with filters
   - GET /api/stock-movements/:id - Get one

4. **stockCount.controller.ts**
   - POST /api/stock-counts - Create count
   - GET /api/stock-counts - List counts
   - GET /api/stock-counts/:id - Get one
   - PUT /api/stock-counts/:id/items - Record counted quantities
   - POST /api/stock-counts/:id/approve - Approve and create adjustments
   - DELETE /api/stock-counts/:id - Cancel count

#### Create Routes
- [ ] warehouse.routes.ts
- [ ] stockLevel.routes.ts
- [ ] stockMovement.routes.ts
- [ ] stockCount.routes.ts
- [ ] Register all routes in app.ts

---

## 🎨 Frontend Implementation Plan

### Session 3: Frontend Pages & Components (3-4 hours)

#### Pages to Create

1. **WarehouseList.tsx**
   - List all warehouses
   - Filter by type, location
   - Create/Edit modal
   - Export functionality

2. **StockDashboard.tsx** (NEW - Main View)
   - Stock summary cards (total value, low stock alerts)
   - Stock by warehouse chart
   - Recent movements table
   - Quick actions (stock in, stock out, transfer)

3. **StockLevelsList.tsx**
   - Current stock levels by material
   - Filter by warehouse, material category
   - Low stock highlighting
   - Stock value calculation
   - Export functionality

4. **StockMovementForm.tsx**
   - Stock In form
   - Stock Out form
   - Transfer form
   - Adjustment form
   - Material selection with autocomplete
   - Quantity validation

5. **StockMovementList.tsx**
   - Transaction history
   - Filter by type, date range, warehouse
   - Export functionality

6. **StockCountForm.tsx**
   - Create new count
   - Select warehouse and items
   - Record counted quantities
   - View variances

7. **StockCountList.tsx**
   - List all counts
   - Filter by status, warehouse
   - Approve/complete counts

#### Components to Create

1. **StockLevelCard.tsx**
   - Display material stock info
   - Warehouse breakdown
   - Visual stock level indicator

2. **MaterialStockSelector.tsx**
   - Search and select material
   - Show available stock
   - Warehouse selection

3. **StockMovementHistory.tsx**
   - Timeline view of movements
   - Filterable by date range

---

## 📋 Features & Business Logic

### Stock Movement Rules

**Stock In (Receipt):**
- Increases stock in target warehouse
- Creates RECEIPT transaction
- Updates average cost (weighted average)
- Can link to purchase order

**Stock Out (Issue):**
- Decreases stock from warehouse
- Creates ISSUE transaction
- Validates sufficient stock available
- Can link to production/sales order
- Uses FIFO/LIFO for costing

**Transfer:**
- Decreases stock from source warehouse
- Increases stock in destination warehouse
- Creates TRANSFER_OUT and TRANSFER_IN transactions
- Atomic operation (both or neither)

**Adjustment:**
- Can increase or decrease stock
- Requires reason
- Creates ADJUSTMENT transaction
- Updates stock level directly

### Stock Valuation Methods

**Weighted Average (Default):**
```
New Average Cost = (Old Stock Value + New Receipt Value) / (Old Qty + New Qty)
```

**FIFO (First In First Out):**
- Issues consume oldest stock first
- Requires detailed lot tracking (future enhancement)

**LIFO (Last In First Out):**
- Issues consume newest stock first
- Requires detailed lot tracking (future enhancement)

### Reorder Logic
```
if (quantityAvailable <= reorderPoint) {
  triggerReorderAlert();
  suggestedOrderQty = reorderQuantity;
}
```

---

## 🔐 Security & Validation

### Permissions
- **View Stock**: All authenticated users
- **Stock Movements**: ADMIN, STORE_MANAGER, PRODUCTION_MANAGER
- **Stock Counts**: ADMIN, STORE_MANAGER
- **Adjustments**: ADMIN only (high-risk operation)

### Validation Rules
1. **Stock Out**: Cannot issue more than available quantity
2. **Transfer**: Source and destination must be different
3. **Negative Stock**: Prevented (unless configured otherwise)
4. **Reservation**: Cannot reserve more than available
5. **Count Approval**: Only ADMIN can approve counts with variances > 5%

---

## 📊 Reports & Analytics

### Standard Reports
1. **Stock Valuation Report** - Total value by warehouse
2. **Low Stock Report** - Items below reorder point
3. **Stock Movement Register** - All movements by period
4. **Aging Analysis** - Stock by receipt date (future)
5. **Variance Report** - Stock count variances
6. **ABC Analysis** - Classify materials by value/usage (future)

---

## ✅ Testing Checklist

### Backend Testing
- [ ] Create warehouse
- [ ] Stock In creates correct transactions
- [ ] Stock Out validates available quantity
- [ ] Transfer updates both warehouses
- [ ] Adjustment updates stock level
- [ ] Weighted average calculation correct
- [ ] Low stock alerts working
- [ ] Stock count creates adjustments
- [ ] Concurrent movements handled correctly

### Frontend Testing
- [ ] Create warehouse flow
- [ ] Stock In form submission
- [ ] Stock Out with validation
- [ ] Transfer between warehouses
- [ ] Stock count workflow
- [ ] Low stock alerts visible
- [ ] Stock level display accurate
- [ ] Movement history filterable

---

## 🚀 Go-Live Checklist

### Pre-Production
1. [ ] Create initial warehouses (Main, Production units)
2. [ ] Import current stock levels
3. [ ] Set reorder points for critical materials
4. [ ] Train users on stock movements
5. [ ] Test backup and restore

### Post-Production
1. [ ] Monitor stock accuracy
2. [ ] Conduct first physical count within 1 week
3. [ ] Review and adjust reorder points
4. [ ] Generate initial reports

---

## 📈 Success Criteria

Phase 3 will be considered complete when:

1. ✅ All 7 database tables created and migrated
2. ✅ Users can perform stock movements (In, Out, Transfer, Adjustment)
3. ✅ Stock levels update correctly in real-time
4. ✅ Stock valuation calculates using weighted average
5. ✅ Low stock alerts functional
6. ✅ Physical stock count workflow operational
7. ✅ Multi-warehouse support working
8. ✅ Stock movement history viewable
9. ✅ All validations preventing invalid operations
10. ✅ Export functionality for all lists
11. ✅ User acceptance testing passed

---

## 🔄 Integration Points

### Current System Integration
- **Materials**: Stock levels per material
- **Suppliers**: Link receipts to purchase orders (future)
- **Production**: Issue materials to production orders (Phase 4)
- **Sales**: Reserve stock for sales orders (Phase 4)

### Future Enhancements (Post Phase 3)
- Barcode scanning for stock movements
- Lot/batch tracking
- Serial number tracking
- Min-max inventory levels
- Automated reorder generation
- Integration with supplier portals
- Mobile app for stock counts
- RFID integration

---

**Phase 3 Status:** Ready to Start
**Next Step:** Create database schema
**Estimated Completion:** 2-3 sessions

---

**Document Created:** 2025-11-15
**For:** Garment ERP - Phase 3 Implementation
**Owner:** Development Team
