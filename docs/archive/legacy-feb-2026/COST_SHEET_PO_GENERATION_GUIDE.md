# Cost Sheet PO Generation Guide

> **Direct Purchase Order Generation from Approved Cost Sheets**
> **Last Updated:** February 6, 2026
> **Coverage:** Fabric, Greige, Processing, Trims PO Generation with Allowance Calculations

---

## Table of Contents

1. [Overview](#1-overview)
2. [Workflow](#2-workflow)
3. [Quantity Calculation Logic](#3-quantity-calculation-logic)
4. [API Reference](#4-api-reference)
5. [Integration with Procurement](#5-integration-with-procurement)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Comparison with MRP-based PO Generation](#7-comparison-with-mrp-based-po-generation)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

### 1.1 What is Cost Sheet PO Generation?

Cost Sheet PO Generation is a direct procurement workflow that generates Purchase Orders directly from approved cost sheets, bypassing the MRP (Material Requirement Planning) module. This is ideal for quick order fulfillment where material requirements are pre-calculated in the cost sheet.

### 1.2 Key Features

- ✅ **Direct PO Generation:** Fabric, Greige, Processing, and Trims POs from cost sheet
- ✅ **Automatic Quantity Calculation:** Based on cost sheet consumption + order quantity
- ✅ **Allowance System:** Configurable wastage allowance (default 3%)
- ✅ **Stock Awareness:** Shows available stock and shortfall
- ✅ **Multi-Category Support:** Separate POs for different material types
- ✅ **Approval Requirement:** Only works with approved cost sheets
- ✅ **Audit Trail:** Generation history and status tracking

### 1.3 When to Use This Workflow

**✅ Use Cost Sheet PO Generation when:**
- Cost sheet is already approved
- Order quantity is known
- Quick procurement needed (bypass MRP)
- Direct supplier relationship exists
- Simple material requirements (no complex BOM)

**❌ Use MRP Workflow instead when:**
- Multiple orders share materials (consolidation needed)
- Complex BOM with vendor suggestions
- Bulk PO generation across suppliers
- Stock allocation and reservation required

---

## 2. Workflow

### 2.1 Complete Cost Sheet → PO Flow

```
1. Create Style
   └─> Define fabric, trims, processing requirements
       └─> Create Cost Sheet
           └─> Calculate material consumption (CAD, per-garment)
               └─> Approve Cost Sheet
                   └─> Generate PO from Cost Sheet
                       ├─> Calculate Requirements (order qty × consumption)
                       ├─> Add Allowance (default 3%)
                       ├─> Check Stock Availability
                       └─> Generate PO by Category
                           ├─> Fabric PO
                           ├─> Greige PO
                           ├─> Processing PO
                           └─> Trims PO
```

### 2.2 Step-by-Step Process

**Step 1: Approve Cost Sheet**
- Navigate to Cost Sheet Detail page
- Review material costs and consumption
- Click "Approve" (requires approval permission)
- Status changes to APPROVED

**Step 2: Calculate Requirements**
- Click "Generate PO" button
- Enter total order quantity (e.g., 1000 pieces)
- System calculates:
  - Required quantity = Order Qty × Consumption per unit
  - Available stock (from inventory)
  - Shortfall = Required - Available

**Step 3: Review Calculated Requirements**
- View breakdown by category:
  - Fabric items with CAD consumption
  - Greige items (if applicable)
  - Trims items (buttons, zippers, etc.)
  - Processing items (dyeing, printing)
- Review allowance-adjusted order quantities

**Step 4: Generate PO**
- Select category (Fabric, Greige, Processing, or Trims)
- Choose supplier
- Review items and quantities
- Add delivery date and notes
- Click "Generate PO"
- System creates PO with status PENDING

**Step 5: Track Generation Status**
- View generation history
- See which POs have been created
- Track remaining items needing POs

---

## 3. Quantity Calculation Logic

### 3.1 Basic Formula

```
Required Quantity = Total Order Qty × Consumption per Unit
Order Quantity = Required Quantity × (1 + Allowance %)
Shortfall = Required Quantity - Available Stock
```

### 3.2 Allowance System

**Default Allowance:** 3% for all material types

**Purpose:**
- Account for wastage during cutting
- Compensate for fabric width variations
- Cover rejections and defects
- Ensure sufficient material for full order

**Calculation:**
```javascript
// Example: 1000 pieces, 1.5 meters per piece, 3% allowance
const requiredQty = 1000 × 1.5 = 1500 meters
const orderQty = 1500 × 1.03 = 1545 meters (with allowance)
```

**Configurable Allowance:**
```json
{
  "fabricItems": [
    {
      "fabricId": "fab-001",
      "requiredQty": 1500,
      "allowancePercent": 5,  // Custom allowance
      "orderQty": 1575  // 1500 × 1.05
    }
  ]
}
```

### 3.3 Fabric-Specific Calculations

**CAD (Consumption per Dozen):**
```
Consumption per Unit = CAD / 12
Required Quantity = (Order Qty / 12) × CAD

Example:
  CAD = 18 meters per dozen
  Order Qty = 1000 pieces
  Consumption per unit = 18 / 12 = 1.5 meters
  Required Qty = (1000 / 12) × 18 = 1500 meters
```

**Effective CAD (with wastage):**
```
Effective CAD = CAD × (1 + Wastage %)

Example:
  CAD = 18 meters
  Wastage = 2%
  Effective CAD = 18 × 1.02 = 18.36 meters
  Required Qty = (1000 / 12) × 18.36 = 1530 meters
```

### 3.4 Trims Calculations

**Size-Independent Trims (Buttons, Zippers):**
```
Required Quantity = Total Order Qty × Quantity per Garment

Example:
  Buttons: 6 per garment × 1000 pieces = 6000 buttons
```

**Size-Dependent Trims (Labels, Packaging):**
```
Required Quantity = Σ(Size Qty × Quantity per Garment)

Example:
  Size S: 300 pieces × 1 label = 300 labels
  Size M: 400 pieces × 1 label = 400 labels
  Size L: 300 pieces × 1 label = 300 labels
  Total = 1000 labels
```

### 3.5 Stock Awareness

**Available Stock Check:**
```sql
SELECT SUM(quantity) as available
FROM inventory_stock
WHERE materialId = 'mat-001'
  AND warehouseId IN (user_accessible_warehouses)
  AND isActive = true
```

**Shortfall Calculation:**
```javascript
const shortfall = Math.max(0, requiredQty - availableStock);

// If shortfall > 0, highlight in UI
if (shortfall > 0) {
  showWarning(`Need to order ${shortfall} ${unit}`);
}
```

---

## 4. API Reference

### Base URL
```
http://localhost:5000/api/cost-sheet-po
```

### 4.1 Calculate Requirements

**Endpoint:** `GET /api/cost-sheet-po/calculate`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `costSheetId` | String | Yes | UUID of approved cost sheet |
| `totalOrderQty` | Number | Yes | Total order quantity (pieces) |

**Example Request:**
```http
GET /api/cost-sheet-po/calculate?costSheetId=cs-001&totalOrderQty=1000
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "costSheet": {
      "id": "cs-001",
      "styleCode": "ST-001",
      "styleName": "Denim Jacket",
      "approvalStatus": "APPROVED"
    },
    "totalOrderQty": 1000,
    "fabricItems": [
      {
        "materialId": "fab-001",
        "materialCode": "FAB-DENIM-001",
        "materialName": "12oz Denim Blue",
        "materialType": "FABRIC",
        "consumptionPerUnit": 1.5,
        "unit": "METERS",
        "requiredQty": 1500,
        "availableStock": 800,
        "shortfall": 700,
        "unitPrice": 250,
        "totalCost": 375000,
        "supplierId": "sup-001",
        "supplierName": "Fabric Supplier Ltd"
      }
    ],
    "fabricOrderQtys": [
      {
        "materialId": "fab-001",
        "requiredQty": 1500,
        "allowancePercent": 3,
        "orderQty": 1545,
        "totalCost": 386250
      }
    ],
    "greigeItems": [],
    "greigeOrderQtys": [],
    "trimsItems": [
      {
        "materialId": "btn-001",
        "materialCode": "BTN-METAL-001",
        "materialName": "Metal Button 20mm",
        "materialType": "BUTTON",
        "consumptionPerUnit": 6,
        "unit": "PIECES",
        "requiredQty": 6000,
        "availableStock": 3000,
        "shortfall": 3000,
        "unitPrice": 5,
        "totalCost": 30000
      }
    ],
    "trimsOrderQtys": [
      {
        "materialId": "btn-001",
        "requiredQty": 6000,
        "allowancePercent": 3,
        "orderQty": 6180,
        "totalCost": 30900
      }
    ],
    "summary": {
      "totalFabricCost": 386250,
      "totalGreigeCost": 0,
      "totalTrimsCost": 30900,
      "totalProcessingCost": 0,
      "grandTotal": 417150
    }
  }
}
```

---

### 4.2 Generate Fabric PO

**Endpoint:** `POST /api/cost-sheet-po/generate/fabric`

**Request Body:**
```json
{
  "costSheetId": "cs-001",
  "totalOrderQty": 1000,
  "supplierId": "sup-001",
  "items": [
    {
      "fabricId": "fab-001",
      "quantity": 1545,
      "unitPrice": 250,
      "notes": "12oz Denim Blue for Order #12345"
    }
  ],
  "expectedDeliveryDate": "2026-03-15",
  "notes": "Urgent order - expedite delivery"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "po-001",
    "poNumber": "PO2602-0001",
    "supplierId": "sup-001",
    "category": "FABRIC",
    "status": "PENDING",
    "totalAmount": 386250,
    "items": [
      {
        "fabricId": "fab-001",
        "fabricCode": "FAB-DENIM-001",
        "fabricName": "12oz Denim Blue",
        "quantity": 1545,
        "unit": "METERS",
        "unitPrice": 250,
        "totalPrice": 386250
      }
    ],
    "expectedDeliveryDate": "2026-03-15",
    "createdAt": "2026-02-06T10:00:00Z"
  },
  "message": "Fabric PO generated successfully"
}
```

---

### 4.3 Generate Greige PO

**Endpoint:** `POST /api/cost-sheet-po/generate/greige`

**Request Body:**
```json
{
  "costSheetId": "cs-001",
  "totalOrderQty": 1000,
  "supplierId": "sup-002",
  "items": [
    {
      "greigeId": "grg-001",
      "quantity": 1600,
      "unitPrice": 180,
      "notes": "Raw cotton greige for processing"
    }
  ],
  "expectedDeliveryDate": "2026-03-10",
  "notes": "To be sent for dyeing"
}
```

**Response:** Similar to Fabric PO with `category: "GREIGE"`

---

### 4.4 Generate Processing PO

**Endpoint:** `POST /api/cost-sheet-po/generate/processing`

**Request Body:**
```json
{
  "costSheetId": "cs-001",
  "totalOrderQty": 1000,
  "processorId": "proc-001",
  "items": [
    {
      "processingType": "DYEING",
      "fabricId": "fab-001",
      "quantity": 1600,
      "unitPrice": 50,
      "color": "Navy Blue",
      "notes": "Standard dyeing process"
    }
  ],
  "linkedGreigePOId": "po-002",  // Optional: link to greige PO
  "expectedDeliveryDate": "2026-03-20",
  "notes": "Process after greige delivery"
}
```

**Response:** Similar to Fabric PO with `category: "PROCESSING"`

---

### 4.5 Generate Trims PO

**Endpoint:** `POST /api/cost-sheet-po/generate/trims`

**Request Body:**
```json
{
  "costSheetId": "cs-001",
  "totalOrderQty": 1000,
  "supplierId": "sup-003",
  "items": [
    {
      "materialId": "btn-001",
      "materialType": "BUTTON",
      "quantity": 6180,
      "unitPrice": 5,
      "notes": "Metal buttons 20mm"
    },
    {
      "materialId": "zip-001",
      "materialType": "ZIPPER",
      "quantity": 1030,
      "unitPrice": 15,
      "notes": "YKK Zipper 18cm"
    }
  ],
  "expectedDeliveryDate": "2026-03-12",
  "notes": "Multiple trims in one PO"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "po-003",
    "poNumber": "PO2602-0003",
    "supplierId": "sup-003",
    "category": "TRIMS",
    "status": "PENDING",
    "totalAmount": 46350,
    "items": [
      {
        "materialId": "btn-001",
        "materialCode": "BTN-METAL-001",
        "materialName": "Metal Button 20mm",
        "quantity": 6180,
        "unit": "PIECES",
        "unitPrice": 5,
        "totalPrice": 30900
      },
      {
        "materialId": "zip-001",
        "materialCode": "ZIP-YKK-18",
        "materialName": "YKK Zipper 18cm",
        "quantity": 1030,
        "unit": "PIECES",
        "unitPrice": 15,
        "totalPrice": 15450
      }
    ],
    "expectedDeliveryDate": "2026-03-12",
    "createdAt": "2026-02-06T10:00:00Z"
  },
  "message": "Trims PO generated successfully"
}
```

---

### 4.6 Get Generation Status

**Endpoint:** `GET /api/cost-sheet-po/status/:costSheetId`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "costSheetId": "cs-001",
    "totalOrderQty": 1000,
    "generatedPOs": [
      {
        "category": "FABRIC",
        "poId": "po-001",
        "poNumber": "PO2602-0001",
        "itemsCount": 1,
        "totalAmount": 386250,
        "generatedAt": "2026-02-06T10:00:00Z"
      },
      {
        "category": "TRIMS",
        "poId": "po-003",
        "poNumber": "PO2602-0003",
        "itemsCount": 2,
        "totalAmount": 46350,
        "generatedAt": "2026-02-06T10:05:00Z"
      }
    ],
    "pending": {
      "greige": false,
      "fabric": false,
      "processing": true,
      "trims": false
    },
    "summary": {
      "totalPOsGenerated": 2,
      "totalAmount": 432600,
      "completionPercent": 75
    }
  }
}
```

---

### 4.7 Get Generation History

**Endpoint:** `GET /api/cost-sheet-po/history/:costSheetId`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "gen-001",
      "costSheetId": "cs-001",
      "category": "FABRIC",
      "poId": "po-001",
      "poNumber": "PO2602-0001",
      "supplierId": "sup-001",
      "supplierName": "Fabric Supplier Ltd",
      "itemsCount": 1,
      "totalQuantity": 1545,
      "totalAmount": 386250,
      "generatedBy": "user-001",
      "generatedAt": "2026-02-06T10:00:00Z",
      "status": "PENDING"
    },
    {
      "id": "gen-002",
      "costSheetId": "cs-001",
      "category": "TRIMS",
      "poId": "po-003",
      "poNumber": "PO2602-0003",
      "supplierId": "sup-003",
      "supplierName": "Trims Supplier Co",
      "itemsCount": 2,
      "totalQuantity": 7210,
      "totalAmount": 46350,
      "generatedBy": "user-001",
      "generatedAt": "2026-02-06T10:05:00Z",
      "status": "PENDING"
    }
  ]
}
```

---

## 5. Integration with Procurement

### 5.1 Integration with Purchase Order Module

**Data Flow:**
```
Cost Sheet PO Generation → purchase_orders table
                         → purchase_order_items table
                         → Links to material masters
                         → Tracked in PO workflow
```

**PO Categories:**
- FABRIC
- GREIGE
- PROCESSING
- TRIMS

### 5.2 Integration with Fabric Costing

**Connection:**
- Cost sheet includes fabric costing calculations
- CAD (Consumption per Dozen) drives quantity calculations
- Processor rate cards used for processing PO pricing

### 5.3 Integration with Inventory

**Stock Checking:**
```typescript
// Check available stock before generating PO
const stock = await checkInventoryStock(materialId);
const shortfall = requiredQty - stock.available;

if (shortfall > 0) {
  showWarning(`Need to order ${shortfall} ${unit}`);
}
```

---

## 6. UI Walkthrough

### 6.1 Cost Sheet Detail Page

**Location:** `/cost-sheets/:id`

**Actions:**
1. **Approve Cost Sheet** (if not approved)
2. **Generate PO** button (appears after approval)

### 6.2 PO Generation Dialog

**Step 1: Calculate Requirements**
- Input: Total Order Quantity
- Click "Calculate"
- View calculated requirements by category

**Step 2: Review Requirements**
- Fabric items table (Code, Name, Required Qty, Stock, Shortfall)
- Greige items table
- Trims items table
- Processing items table

**Step 3: Generate PO**
- Select category tab (Fabric / Greige / Processing / Trims)
- Choose supplier from dropdown
- Review items with allowance-adjusted quantities
- Set delivery date
- Add notes
- Click "Generate PO"

### 6.3 Generation Status View

**Shows:**
- Generated POs (category, PO number, amount, date)
- Pending categories (greyed out if not generated)
- Completion percentage
- Total amount spent

---

## 7. Comparison with MRP-based PO Generation

| Feature | Cost Sheet PO | MRP-based PO |
|---------|---------------|--------------|
| **Input** | Approved cost sheet | BOM (Bill of Materials) |
| **Workflow** | Direct: Cost Sheet → PO | Multi-step: BOM → MRP → PO |
| **Use Case** | Single order, quick fulfillment | Multiple orders, consolidated procurement |
| **Vendor Selection** | Manual selection | Intelligent vendor suggestions (3-tier) |
| **Stock Awareness** | Shows stock, manual decision | Auto-calculates shortfall |
| **Bulk Generation** | One PO at a time | Bulk PO grouped by supplier |
| **Complexity** | Simple, fast | Complex, comprehensive |
| **Time Savings** | Moderate | High (70% reduction) |
| **Best For** | Simple orders, direct suppliers | Complex orders, multiple suppliers |

**Recommendation:**
- **Use Cost Sheet PO:** Small batches, urgent orders, simple materials
- **Use MRP Workflow:** Large batches, multiple orders, vendor optimization

---

## 8. Best Practices

### 8.1 Cost Sheet Preparation

**✅ DO:**
- Approve cost sheet before generating POs
- Verify material consumption rates (CAD, per-garment)
- Update supplier pricing in cost sheet
- Include processing costs if applicable

**❌ DON'T:**
- Generate POs from unapproved cost sheets (system blocks this)
- Skip stock check (may over-order)
- Use outdated cost sheets (verify pricing)

### 8.2 Quantity Calculations

**✅ DO:**
- Use realistic allowance percentages (3-5%)
- Account for wastage in CAD calculations
- Round up to supplier minimum order quantities
- Check stock before finalizing quantities

**❌ DON'T:**
- Set allowance too low (risk of shortage)
- Forget to add processing wastage
- Order exact required quantity (no buffer)

### 8.3 Supplier Selection

**✅ DO:**
- Choose suppliers based on cost sheet rates
- Verify supplier lead times
- Consolidate trims into single PO per supplier
- Set realistic delivery dates

**❌ DON'T:**
- Split orders unnecessarily (increases admin)
- Ignore supplier minimums
- Set unrealistic delivery dates

### 8.4 PO Management

**✅ DO:**
- Generate all POs before production starts
- Track generation status regularly
- Link processing PO to greige PO
- Add detailed notes for clarity

**❌ DON'T:**
- Generate partial POs (complete all categories)
- Forget to set delivery dates
- Skip linking related POs (greige → processing)

---

## 9. Troubleshooting

### 9.1 Cost Sheet Not Approved

**Error:** `Cost sheet must be approved before generating POs`

**Solution:**
1. Navigate to Cost Sheet Detail page
2. Review all items and costs
3. Click "Approve" button
4. Retry PO generation

### 9.2 Missing Supplier Information

**Error:** `Supplier not found or invalid`

**Solution:**
- Verify supplier exists in system
- Check supplier is linked to material in cost sheet
- Add supplier if missing: `/suppliers/new`

### 9.3 Stock Shortfall Too High

**Warning:** `Shortfall: 5000 meters (need to order)`

**Options:**
1. **Generate PO for shortfall:** Order missing quantity
2. **Reduce order quantity:** Lower total order qty
3. **Check other warehouses:** Stock may exist elsewhere
4. **Use alternative material:** Find substitute with stock

### 9.4 Allowance Calculation Issues

**Issue:** Order quantity seems too high

**Check:**
- Allowance percentage (default 3%)
- Effective CAD (may include wastage)
- Consumption per unit calculation

**Example Debug:**
```
Required: 1500 meters
Allowance: 3%
Order Qty: 1500 × 1.03 = 1545 meters ✅ Correct

If order qty is 1600:
  Check if cost sheet has built-in wastage
  Effective CAD may already include allowance
```

### 9.5 PO Number Generation Failure

**Error:** `Failed to generate PO number`

**Cause:** Database sequence issue or duplicate detection

**Solution:**
- Retry (system auto-increments)
- Check last PO number: `GET /api/purchase-orders?sort=desc&limit=1`
- Manual override: Contact admin to reset sequence

---

## Related Documentation

- [FABRIC_COSTING_GUIDE.md](./FABRIC_COSTING_GUIDE.md) - Fabric costing and CAD calculations
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) - Standard PO workflow
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) - Alternative MRP-based PO generation (Section 13)
- [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) - Inventory stock levels
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) - Main system documentation

---

**Last Updated:** February 6, 2026
**Version:** 1.0
**Maintained By:** Development Team

---

## Changelog

### v1.0 (2026-02-06)
- Initial documentation
- Covered all 7 API endpoints
- Documented quantity calculation logic with allowance system
- Added integration patterns with fabric costing and procurement
- Included comparison with MRP-based workflow
- Added troubleshooting guide
