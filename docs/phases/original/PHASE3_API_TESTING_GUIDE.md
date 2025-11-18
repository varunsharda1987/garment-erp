# Phase 3: Inventory & Warehouse Management - API Testing Guide

**Quick Reference for Testing the 35 API Endpoints**

---

## Prerequisites

### 1. Start the Backend Server
```bash
cd backend
npm run dev
```

### 2. Get Authentication Token
```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@kashayafabs.com",
  "password": "Admin@123"
}
```

**Copy the `token` from the response and use it in all subsequent requests:**
```
Authorization: Bearer <your-token-here>
```

---

## API Endpoints by Module

### 1. Warehouse Management (9 endpoints)

#### Create Warehouse
```http
POST http://localhost:5000/api/warehouses
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseCode": "WH-RM-0001",
  "warehouseName": "Main Raw Material Warehouse",
  "warehouseType": "RAW_MATERIAL",
  "address": "Plot 101, Industrial Area",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "country": "India",
  "contactPerson": "Rajesh Kumar",
  "contactPhone": "+91-9876543210",
  "isActive": true
}
```

**Warehouse Types**: `RAW_MATERIAL`, `FINISHED_GOODS`, `WORK_IN_PROGRESS`, `GENERAL`, `TRANSIT`

#### Get All Warehouses
```http
GET http://localhost:5000/api/warehouses
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseType=RAW_MATERIAL`
- `?isActive=true`
- `?search=Mumbai`

#### Get Warehouse by ID
```http
GET http://localhost:5000/api/warehouses/:id
Authorization: Bearer <token>
```

#### Get Warehouse by Code
```http
GET http://localhost:5000/api/warehouses/code/WH-RM-0001
Authorization: Bearer <token>
```

#### Get Warehouses by Type
```http
GET http://localhost:5000/api/warehouses/by-type/RAW_MATERIAL
Authorization: Bearer <token>
```

#### Generate Warehouse Code
```http
GET http://localhost:5000/api/warehouses/generate-code/RAW_MATERIAL
Authorization: Bearer <token>
```

Returns: `{ code: "WH-RM-0001" }` (auto-incremented)

#### Get Warehouse Stock Summary
```http
GET http://localhost:5000/api/warehouses/:id/stock-summary
Authorization: Bearer <token>
```

Returns: Total materials count and total stock value

#### Update Warehouse
```http
PUT http://localhost:5000/api/warehouses/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseName": "Updated Warehouse Name",
  "contactPerson": "New Contact Person"
}
```

#### Delete Warehouse (Soft Delete)
```http
DELETE http://localhost:5000/api/warehouses/:id
Authorization: Bearer <token>
```

**Note**: Will fail if warehouse has stock

---

### 2. Stock Level Management (8 endpoints)

#### Get All Stock Levels
```http
GET http://localhost:5000/api/stock-levels
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`
- `?materialId=material-uuid`
- `?belowReorderLevel=true`
- `?search=fabric`

#### Get Stock Level by ID
```http
GET http://localhost:5000/api/stock-levels/:id
Authorization: Bearer <token>
```

#### Get Stock by Material (All Warehouses)
```http
GET http://localhost:5000/api/stock-levels/material/:materialId
Authorization: Bearer <token>
```

Returns stock across all warehouses for a material

#### Get Stock by Warehouse
```http
GET http://localhost:5000/api/stock-levels/warehouse/:warehouseId
Authorization: Bearer <token>
```

Returns all stock in a specific warehouse

#### Get Materials Below Reorder Level
```http
GET http://localhost:5000/api/stock-levels/below-reorder
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`

Returns materials that need reordering

#### Get Stock Aging Report
```http
GET http://localhost:5000/api/stock-levels/aging/:warehouseId
Authorization: Bearer <token>
```

Returns materials with days since last movement

#### Get Stock Valuation Report
```http
GET http://localhost:5000/api/stock-levels/valuation
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`
- `?materialId=material-uuid`

Returns total inventory value

#### Update Stock Level (Manual)
```http
PUT http://localhost:5000/api/stock-levels/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "reorderLevel": 100,
  "minStockLevel": 50,
  "maxStockLevel": 500
}
```

**Note**: Use stock movements to change actual quantities

---

### 3. Stock Movement Management (9 endpoints)

#### Create Stock IN (Receipt)
```http
POST http://localhost:5000/api/stock-movements/stock-in
Authorization: Bearer <token>
Content-Type: application/json

{
  "materialId": "material-uuid",
  "warehouseId": "warehouse-uuid",
  "quantity": 100,
  "unit": "METER",
  "rate": 150.50,
  "referenceType": "GRN",
  "referenceNumber": "GRN-001",
  "remarks": "Received from supplier ABC"
}
```

**Units**: `PIECE`, `METER`, `KILOGRAM`, `GRAM`, `LITER`, `BOX`, `SET`, `DOZEN`, `YARD`, `ROLL`

#### Create Stock OUT (Issue)
```http
POST http://localhost:5000/api/stock-movements/stock-out
Authorization: Bearer <token>
Content-Type: application/json

{
  "materialId": "material-uuid",
  "warehouseId": "warehouse-uuid",
  "quantity": 50,
  "unit": "METER",
  "referenceType": "REQUISITION",
  "referenceNumber": "REQ-001",
  "remarks": "Issued for production order PO-001"
}
```

**Note**: Will fail if insufficient stock

#### Create Stock Transfer
```http
POST http://localhost:5000/api/stock-movements/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "materialId": "material-uuid",
  "fromWarehouseId": "warehouse-1-uuid",
  "toWarehouseId": "warehouse-2-uuid",
  "quantity": 25,
  "unit": "METER",
  "remarks": "Transfer to production warehouse"
}
```

Creates 2 movements: TRANSFER_OUT and TRANSFER_IN

#### Create Stock Adjustment
```http
POST http://localhost:5000/api/stock-movements/adjustment
Authorization: Bearer <token>
Content-Type: application/json

{
  "materialId": "material-uuid",
  "warehouseId": "warehouse-uuid",
  "quantity": -5,
  "unit": "METER",
  "reason": "DAMAGED",
  "remarks": "Material damaged during handling"
}
```

**Adjustment Reasons**: `DAMAGED`, `EXPIRED`, `LOST`, `FOUND`, `CORRECTION`, `OTHER`

**Note**: Negative quantity for decrease, positive for increase

#### Get All Movements
```http
GET http://localhost:5000/api/stock-movements
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`
- `?materialId=material-uuid`
- `?movementType=STOCK_IN`
- `?startDate=2025-11-01`
- `?endDate=2025-11-30`

**Movement Types**: `STOCK_IN`, `STOCK_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`

#### Get Movement by ID
```http
GET http://localhost:5000/api/stock-movements/:id
Authorization: Bearer <token>
```

#### Get Material Movement History
```http
GET http://localhost:5000/api/stock-movements/material/:materialId/history
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`
- `?startDate=2025-11-01`
- `?endDate=2025-11-30`

#### Get Movement Summary
```http
GET http://localhost:5000/api/stock-movements/summary/:warehouseId
Authorization: Bearer <token>
```

**Query Parameters**:
- `?startDate=2025-11-01` (required)
- `?endDate=2025-11-30` (required)

Returns totals for IN, OUT, TRANSFER

#### Get Stock Ledger
```http
GET http://localhost:5000/api/stock-movements/ledger/:materialId/:warehouseId
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?startDate=2025-11-01`
- `?endDate=2025-11-30`

Returns detailed transaction ledger with running balance

---

### 4. Stock Count Management (9 endpoints)

#### Create Stock Count
```http
POST http://localhost:5000/api/stock-counts
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": "warehouse-uuid",
  "countType": "FULL",
  "countDate": "2025-11-15",
  "remarks": "Monthly stock count"
}
```

**Count Types**:
- `FULL` - All materials in warehouse (materialIds not required)
- `PARTIAL` - Specific materials (materialIds required)
- `CYCLE` - Specific materials (materialIds required)
- `SPOT_CHECK` - Specific materials (materialIds required)

**For PARTIAL/CYCLE/SPOT_CHECK**:
```json
{
  "warehouseId": "warehouse-uuid",
  "countType": "PARTIAL",
  "materialIds": ["material-1-uuid", "material-2-uuid"],
  "remarks": "Monthly cycle count"
}
```

#### Start Counting
```http
POST http://localhost:5000/api/stock-counts/:id/start
Authorization: Bearer <token>
```

Changes status from DRAFT → IN_PROGRESS

#### Update Count Item
```http
PUT http://localhost:5000/api/stock-counts/:countId/items/:itemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "physicalQuantity": 95.5,
  "remarks": "Counted and verified"
}
```

**Note**: System quantity is auto-populated on count creation

#### Verify Stock Count
```http
POST http://localhost:5000/api/stock-counts/:id/verify
Authorization: Bearer <token>
```

Changes status from COUNTED → VERIFIED (supervisor verification)

#### Approve Stock Count
```http
POST http://localhost:5000/api/stock-counts/:id/approve
Authorization: Bearer <token>
```

Changes status from VERIFIED → APPROVED

**Auto-creates stock adjustments** for all items with variance

#### Cancel Stock Count
```http
POST http://localhost:5000/api/stock-counts/:id/cancel
Authorization: Bearer <token>
```

Can cancel from any status except APPROVED

#### Get All Stock Counts
```http
GET http://localhost:5000/api/stock-counts
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?warehouseId=warehouse-uuid`
- `?countType=FULL`
- `?status=APPROVED`
- `?startDate=2025-11-01`
- `?endDate=2025-11-30`

**Status Values**: `DRAFT`, `IN_PROGRESS`, `COUNTED`, `VERIFIED`, `APPROVED`, `CANCELLED`

#### Get Stock Count by ID
```http
GET http://localhost:5000/api/stock-counts/:id
Authorization: Bearer <token>
```

Returns count with all items and their variance

#### Get Variance Report
```http
GET http://localhost:5000/api/stock-counts/:id/variance
Authorization: Bearer <token>
```

Returns only items with variance (positive or negative)

#### Get Count Summary
```http
GET http://localhost:5000/api/stock-counts/summary/:warehouseId
Authorization: Bearer <token>
```

**Query Parameters** (optional):
- `?startDate=2025-11-01`
- `?endDate=2025-11-30`

Returns count statistics and total variance

---

## Testing Workflow

### Complete End-to-End Test

#### 1. Setup (Create Warehouse & Material)
```bash
# Assuming you already have materials from Phase 3.1
# Create a warehouse
POST /api/warehouses
```

#### 2. Stock IN (Receipt)
```bash
POST /api/stock-movements/stock-in
{
  "materialId": "<material-id>",
  "warehouseId": "<warehouse-id>",
  "quantity": 1000,
  "unit": "METER",
  "rate": 100.00,
  "referenceType": "GRN",
  "referenceNumber": "GRN-TEST-001"
}
```

#### 3. Check Stock Level
```bash
GET /api/stock-levels/warehouse/<warehouse-id>
```

**Expected**: quantity = 1000, valuationRate = 100.00, stockValue = 100000.00

#### 4. Stock OUT (Issue)
```bash
POST /api/stock-movements/stock-out
{
  "materialId": "<material-id>",
  "warehouseId": "<warehouse-id>",
  "quantity": 300,
  "unit": "METER",
  "referenceType": "REQUISITION",
  "referenceNumber": "REQ-TEST-001"
}
```

#### 5. Check Stock Level Again
```bash
GET /api/stock-levels/warehouse/<warehouse-id>
```

**Expected**: quantity = 700, valuationRate = 100.00 (unchanged), stockValue = 70000.00

#### 6. Stock IN with Different Rate (Test Weighted Average)
```bash
POST /api/stock-movements/stock-in
{
  "materialId": "<material-id>",
  "warehouseId": "<warehouse-id>",
  "quantity": 500,
  "unit": "METER",
  "rate": 120.00,
  "referenceType": "GRN",
  "referenceNumber": "GRN-TEST-002"
}
```

#### 7. Check Weighted Average Calculation
```bash
GET /api/stock-levels/warehouse/<warehouse-id>
```

**Expected**:
- quantity = 1200 (700 + 500)
- valuationRate = ~108.33 [(700×100 + 500×120) / 1200]
- stockValue = 130000.00 (70000 + 60000)

#### 8. Create Physical Count
```bash
POST /api/stock-counts
{
  "warehouseId": "<warehouse-id>",
  "countType": "FULL",
  "remarks": "Test physical count"
}
```

#### 9. Start Counting
```bash
POST /api/stock-counts/<count-id>/start
```

#### 10. Get Count Items
```bash
GET /api/stock-counts/<count-id>
```

**Expected**: systemQuantity = 1200

#### 11. Enter Physical Count
```bash
PUT /api/stock-counts/<count-id>/items/<item-id>
{
  "physicalQuantity": 1195
}
```

**Expected**: variance = -5 (shortage)

#### 12. Verify Count
```bash
POST /api/stock-counts/<count-id>/verify
```

#### 13. Approve Count
```bash
POST /api/stock-counts/<count-id>/approve
```

**Expected**: Auto-creates adjustment movement for -5 quantity

#### 14. Check Final Stock Level
```bash
GET /api/stock-levels/warehouse/<warehouse-id>
```

**Expected**: quantity = 1195 (adjusted)

#### 15. View Stock Ledger
```bash
GET /api/stock-movements/ledger/<material-id>/<warehouse-id>
```

**Expected**: All transactions with running balance

---

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Material, warehouse, quantity, and unit are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Warehouse not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Insufficient stock. Available: 100, Requested: 150"
}
```

---

## Testing Checklist

### Warehouse Management
- [ ] Create warehouse (all types)
- [ ] Get all warehouses
- [ ] Get warehouse by ID
- [ ] Get warehouse by code
- [ ] Get warehouses by type
- [ ] Generate warehouse code
- [ ] Get warehouse stock summary
- [ ] Update warehouse
- [ ] Delete warehouse (with stock - should fail)
- [ ] Delete warehouse (without stock - should succeed)

### Stock Movements
- [ ] Stock IN with rate
- [ ] Stock OUT (sufficient stock)
- [ ] Stock OUT (insufficient stock - should fail)
- [ ] Stock TRANSFER between warehouses
- [ ] Stock ADJUSTMENT (positive)
- [ ] Stock ADJUSTMENT (negative)
- [ ] Weighted average calculation
- [ ] View movement history
- [ ] View movement summary
- [ ] View stock ledger

### Stock Levels
- [ ] View all stock levels
- [ ] View stock by material
- [ ] View stock by warehouse
- [ ] Materials below reorder level
- [ ] Stock aging report
- [ ] Stock valuation report
- [ ] Update reorder levels

### Stock Counts
- [ ] Create FULL count
- [ ] Create PARTIAL count
- [ ] Start counting
- [ ] Update count items
- [ ] Calculate variance
- [ ] Verify count
- [ ] Approve count (auto-adjustments)
- [ ] Cancel count
- [ ] Variance report
- [ ] Count summary

---

## Notes

1. **Always use the Authorization header** with a valid JWT token
2. **UUIDs**: Replace `<material-id>`, `<warehouse-id>`, etc. with actual UUIDs from your database
3. **Dates**: Use ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`
4. **Decimal Values**: Can be sent as numbers or strings (both work)
5. **Enums**: Must use exact values (case-sensitive)

---

**For detailed API documentation and business logic, see [PHASE3_BACKEND_COMPLETE.md](./PHASE3_BACKEND_COMPLETE.md)**
