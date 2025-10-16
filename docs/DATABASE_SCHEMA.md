# 🗄️ KASHAYA FABS ERP - DATABASE SCHEMA

## OVERVIEW

This document describes all database tables (entities) for the complete ERP system. Think of each table as a **filing cabinet drawer** where specific types of information are stored.

**Database:** PostgreSQL  
**ORM:** Prisma  
**Total Tables:** 35+ tables

---

## 📊 ENTITY RELATIONSHIP DIAGRAM (Simplified)

```
USERS → manages → CUSTOMERS
USERS → manages → SUPPLIERS
USERS → creates → ORDERS
ORDERS → contains → ORDER_ITEMS
ORDER_ITEMS → references → STYLES
STYLES → has → SIZE_MATRIX
STYLES → has → COLOR_OPTIONS
STYLES → has → BOM (Bill of Materials)
BOM → contains → MATERIALS
MATERIALS → tracked in → INVENTORY
ORDERS → generates → WORK_ORDERS
WORK_ORDERS → tracked in → PRODUCTION_TRACKING
WORK_ORDERS → issues → MATERIAL_REQUISITIONS
PRODUCTION_TRACKING → creates → FINISHED_GOODS
FINISHED_GOODS → dispatched via → DELIVERY_NOTES
ORDERS → invoiced via → INVOICES
SUPPLIERS → receives → PURCHASE_ORDERS
PURCHASE_ORDERS → received via → GRN
```

---

## 🔐 AUTHENTICATION & USER MANAGEMENT

### Table: `users`
**Purpose:** All people who can login to the system

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| email | String | Login email (unique) |
| password | String | Hashed password (bcrypt) |
| firstName | String | User's first name |
| lastName | String | User's last name |
| phone | String | Contact number |
| role | Enum | ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE |
| department | String | Department name |
| isActive | Boolean | Can this user login? |
| lastLogin | DateTime | Last login timestamp |
| createdAt | DateTime | Account creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One user creates many orders
- One user creates many work orders
- One user performs many quality checks

---

### Table: `roles`
**Purpose:** Define what each role can do

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | String | Role name (Admin, Manager, etc.) |
| permissions | JSON | List of allowed actions |
| description | String | What this role does |
| createdAt | DateTime | Creation date |

---

## 👥 MASTER DATA - RELATIONSHIPS

### Table: `customers`
**Purpose:** All buyers/clients

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| code | String | Customer code (unique, e.g., CUST001) |
| name | String | Customer company name |
| type | Enum | DOMESTIC, EXPORT |
| category | Enum | SMALL, MEDIUM, LARGE |
| contactPerson | String | Primary contact name |
| email | String | Contact email |
| phone | String | Contact phone |
| billingAddress | Text | Billing address |
| shippingAddress | Text | Shipping address |
| gstNumber | String | GST registration number |
| creditLimit | Decimal | Maximum credit allowed |
| creditDays | Integer | Payment terms in days |
| isActive | Boolean | Active customer? |
| createdBy | UUID | User who created (FK) |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One customer has many orders
- One customer has many quotations
- One customer has many invoices

---

### Table: `suppliers`
**Purpose:** Material vendors

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| code | String | Supplier code (unique, e.g., SUPP001) |
| name | String | Supplier company name |
| materialCategory | String | What they supply (Fabric/Trims/etc.) |
| contactPerson | String | Primary contact name |
| email | String | Contact email |
| phone | String | Contact phone |
| address | Text | Supplier address |
| gstNumber | String | GST registration |
| paymentTerms | String | Payment terms description |
| rating | Integer | Supplier rating (1-5) |
| isActive | Boolean | Active supplier? |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One supplier receives many purchase orders
- One supplier has many material deliveries

---

## 📦 INVENTORY MANAGEMENT

### Table: `material_categories`
**Purpose:** Types of materials

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | String | Category name (Fabric, Trims, Accessories, Packaging) |
| description | String | Category description |
| createdAt | DateTime | Creation date |

---

### Table: `materials`
**Purpose:** All raw materials

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| code | String | Material code (unique, e.g., FAB001) |
| name | String | Material name |
| categoryId | UUID | Category (FK) |
| description | Text | Detailed description |
| specifications | Text | Technical specifications |
| unit | Enum | METER, PIECE, KILOGRAM, SET |
| costPrice | Decimal | Purchase cost per unit |
| reorderLevel | Integer | Alert when stock below this |
| supplierId | UUID | Primary supplier (FK) |
| image | String | Image URL (optional) |
| isActive | Boolean | Still in use? |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One material belongs to one category
- One material has one primary supplier
- One material used in many BOMs
- One material has many stock transactions

---

### Table: `inventory_stock`
**Purpose:** Current stock of raw materials

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| materialId | UUID | Material (FK) |
| locationId | UUID | Warehouse/factory location (FK) |
| quantity | Decimal | Current stock quantity |
| unit | Enum | Unit of measurement |
| lastUpdated | DateTime | Last stock change |

**Note:** This is a SUMMARY table. Details in stock_transactions.

**Relationships:**
- One material has stock in multiple locations
- Stock updated via stock transactions

---

### Table: `stock_transactions`
**Purpose:** Every stock movement (in/out)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| transactionType | Enum | STOCK_IN, STOCK_OUT, ADJUSTMENT, TRANSFER |
| materialId | UUID | Material (FK) |
| quantity | Decimal | Quantity moved |
| unit | Enum | Unit of measurement |
| fromLocationId | UUID | Source location (FK, nullable) |
| toLocationId | UUID | Destination location (FK, nullable) |
| referenceType | String | GRN, Material Requisition, Adjustment, etc. |
| referenceId | UUID | ID of source document |
| remarks | Text | Why this transaction happened |
| performedBy | UUID | User (FK) |
| transactionDate | DateTime | When it happened |
| createdAt | DateTime | Record creation |

**Relationships:**
- Each transaction links to one material
- Each transaction performed by one user
- Transactions update inventory_stock automatically

---

### Table: `finished_goods_stock`
**Purpose:** Completed garments in warehouse

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| styleId | UUID | Garment style (FK) |
| colorId | UUID | Color variant (FK) |
| sizeId | UUID | Size variant (FK) |
| quantity | Integer | Pieces in stock |
| locationId | UUID | Warehouse location (FK) |
| workOrderId | UUID | Which production created this (FK) |
| receivedDate | DateTime | When received from production |
| lastUpdated | DateTime | Last change |

**Relationships:**
- Stock created by production completion
- Stock reduced by order dispatch

---

## 👕 PRODUCT MASTER

### Table: `style_categories`
**Purpose:** Types of garments

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | String | Category name (Ethnic Wear, Western Wear, Uniforms) |
| description | String | Category description |
| createdAt | DateTime | Creation date |

---

### Table: `styles`
**Purpose:** Garment designs (the heart of manufacturing)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| styleCode | String | Unique style code (e.g., ETH-MEN-001) |
| styleName | String | Style name/description |
| categoryId | UUID | Style category (FK) |
| gender | Enum | MEN, WOMEN, KIDS, UNISEX |
| ageGroup | Enum | ADULT, KIDS_1_3Y, KIDS_4_7Y, KIDS_8_14Y |
| description | Text | Detailed description |
| specifications | Text | Technical specs |
| image | String | Primary image URL |
| isActive | Boolean | Currently in production? |
| costPrice | Decimal | Estimated cost |
| sellingPrice | Decimal | Base selling price |
| createdBy | UUID | User (FK) |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One style has many size options
- One style has many color options
- One style has one BOM
- One style used in many orders

---

### Table: `size_options`
**Purpose:** Sizes available for each style (flexible)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| styleId | UUID | Style (FK) |
| sizeName | String | Size label (S, M, L, XL, 32, 34, 2Y, 4Y, etc.) |
| sizeCode | String | Internal code |
| sortOrder | Integer | Display order |
| isActive | Boolean | Still available? |

**Example Data:**
- Style: Men's Shirt → S, M, L, XL, XXL, 3XL
- Style: Kids T-Shirt → 1Y, 2Y, 3Y, 4Y, 6Y, 8Y, 10Y, 12Y, 14Y
- Style: Trousers → 28, 30, 32, 34, 36, 38, 40, 42

---

### Table: `color_options`
**Purpose:** Colors available for each style

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| styleId | UUID | Style (FK) |
| colorName | String | Color name (Red, Blue, Navy, etc.) |
| colorCode | String | Hex code or Pantone code |
| sortOrder | Integer | Display order |
| isActive | Boolean | Still available? |

**Example Data:**
- Style: Ethnic Kurta → White, Cream, Navy, Black, Maroon
- Style: School Uniform → Blue, Navy

---

### Table: `bill_of_materials` (BOM)
**Purpose:** Recipe for each style - materials needed

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| styleId | UUID | Style (FK) |
| version | Integer | BOM version (for changes over time) |
| isActive | Boolean | Currently used? |
| totalCost | Decimal | Sum of all material costs |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| approvedAt | DateTime | Approval date |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One BOM belongs to one style
- One BOM has many BOM items

---

### Table: `bom_items`
**Purpose:** Individual materials in a BOM

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| bomId | UUID | BOM (FK) |
| materialId | UUID | Material (FK) |
| quantityPerUnit | Decimal | How much needed per 1 garment |
| unit | Enum | Unit of measurement |
| wastagePercent | Decimal | Expected wastage % |
| costPerUnit | Decimal | Material cost |
| notes | Text | Special instructions |

**Example Data:**
- BOM for Men's Shirt:
  - Fabric: 2.5 meters per piece, 5% wastage
  - Buttons: 8 pieces per garment, 10% wastage
  - Thread: 50 meters per piece, 15% wastage
  - Interlining: 0.3 meters per piece, 5% wastage

---

## 📋 SALES & ORDERS

### Table: `quotations`
**Purpose:** Price quotes sent to customers

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| quotationNumber | String | Unique quote number (e.g., QT-2025-001) |
| customerId | UUID | Customer (FK) |
| quotationDate | DateTime | Quote date |
| validUntil | DateTime | Expiry date |
| status | Enum | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED |
| totalAmount | Decimal | Total quote value |
| remarks | Text | Additional notes |
| termsAndConditions | Text | Quote T&C |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One quotation for one customer
- One quotation has many quotation items
- One quotation can convert to one order

---

### Table: `quotation_items`
**Purpose:** Individual items in a quotation

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| quotationId | UUID | Quotation (FK) |
| styleId | UUID | Style (FK) |
| description | Text | Item description |
| totalQuantity | Integer | Total pieces |
| unitPrice | Decimal | Price per piece |
| totalPrice | Decimal | Line total |
| deliveryDays | Integer | Lead time in days |
| remarks | Text | Item-specific notes |

---

### Table: `orders`
**Purpose:** **CRITICAL TABLE** - Customer orders

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| orderNumber | String | Unique order number (e.g., ORD-2025-001) |
| customerId | UUID | Customer (FK) |
| orderDate | DateTime | Order date |
| expectedDeliveryDate | DateTime | Delivery deadline |
| status | Enum | PENDING, IN_PRODUCTION, COMPLETED, DISPATCHED, CANCELLED |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| totalQuantity | Integer | Total pieces across all items |
| totalAmount | Decimal | Total order value |
| paymentTerms | String | Payment conditions |
| shippingAddress | Text | Delivery address |
| remarks | Text | Order notes |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One order from one customer
- One order has many order items
- One order generates many work orders
- One order has many invoices

---

### Table: `order_items`
**Purpose:** Individual styles in an order with size/color breakup

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| orderId | UUID | Order (FK) |
| styleId | UUID | Style (FK) |
| itemDescription | Text | Item description |
| totalQuantity | Integer | Total pieces for this style |
| unitPrice | Decimal | Price per piece |
| totalPrice | Decimal | Line total |
| deliveryDate | DateTime | Item-specific delivery date |
| status | Enum | PENDING, IN_PRODUCTION, COMPLETED |
| remarks | Text | Item-specific notes |

**Relationships:**
- One order item has many size/color combinations
- Order item generates work orders

---

### Table: `order_item_breakup`
**Purpose:** Size and color wise quantity matrix

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| orderItemId | UUID | Order item (FK) |
| colorId | UUID | Color option (FK) |
| sizeId | UUID | Size option (FK) |
| quantity | Integer | Pieces for this size/color combo |

**Example Data:**
- Order Item: Men's Shirt Style ETH-001
  - Red, Size M: 100 pieces
  - Red, Size L: 150 pieces
  - Blue, Size M: 80 pieces
  - Blue, Size L: 120 pieces

---

### Table: `invoices`
**Purpose:** Bills sent to customers

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| invoiceNumber | String | Unique invoice number |
| orderId | UUID | Order (FK) |
| customerId | UUID | Customer (FK) |
| invoiceDate | DateTime | Invoice date |
| dueDate | DateTime | Payment due date |
| status | Enum | PENDING, PARTIALLY_PAID, PAID, OVERDUE |
| subtotal | Decimal | Amount before tax |
| taxAmount | Decimal | GST/tax amount |
| totalAmount | Decimal | Final amount |
| paidAmount | Decimal | Amount received |
| balanceAmount | Decimal | Outstanding amount |
| remarks | Text | Invoice notes |
| createdBy | UUID | User (FK) |
| createdAt | DateTime | Creation date |

**Relationships:**
- One invoice for one order
- One invoice has many payments

---

### Table: `payments`
**Purpose:** Payment receipts

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| invoiceId | UUID | Invoice (FK) |
| paymentDate | DateTime | Payment date |
| amount | Decimal | Amount received |
| paymentMethod | Enum | CASH, CHEQUE, BANK_TRANSFER, UPI |
| referenceNumber | String | Transaction reference |
| remarks | Text | Payment notes |
| receivedBy | UUID | User (FK) |
| createdAt | DateTime | Record creation |

---

## 🏭 PRODUCTION MANAGEMENT

### Table: `production_plans`
**Purpose:** High-level production planning

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| planNumber | String | Plan number (e.g., PLAN-2025-W42) |
| planDate | DateTime | Plan creation date |
| startDate | DateTime | Plan start date |
| endDate | DateTime | Plan end date |
| status | Enum | DRAFT, APPROVED, IN_PROGRESS, COMPLETED |
| remarks | Text | Planning notes |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |

---

### Table: `work_orders`
**Purpose:** **CRITICAL** - Instructions to factory floor

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workOrderNumber | String | Unique WO number (e.g., WO-2025-001) |
| orderId | UUID | Source order (FK) |
| orderItemId | UUID | Order item (FK) |
| styleId | UUID | Style (FK) |
| locationId | UUID | Production location (FK) |
| plannedStartDate | DateTime | When to start |
| plannedEndDate | DateTime | Target completion |
| actualStartDate | DateTime | Actual start (nullable) |
| actualEndDate | DateTime | Actual completion (nullable) |
| totalQuantity | Integer | Total pieces to produce |
| completedQuantity | Integer | Pieces completed so far |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| remarks | Text | Work order notes |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |
| updatedAt | DateTime | Last update |

**Relationships:**
- One work order from one order item
- One work order has size/color breakup
- One work order has many production updates
- One work order has material requisitions

---

### Table: `work_order_breakup`
**Purpose:** Size/color wise production targets

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workOrderId | UUID | Work order (FK) |
| colorId | UUID | Color (FK) |
| sizeId | UUID | Size (FK) |
| plannedQuantity | Integer | Target to produce |
| completedQuantity | Integer | Actually produced |

---

### Table: `material_requisitions`
**Purpose:** Materials issued to production

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| requisitionNumber | String | Unique MR number |
| workOrderId | UUID | Work order (FK) |
| requisitionDate | DateTime | Issue date |
| issuedBy | UUID | User (FK) |
| receivedBy | UUID | Production person (FK) |
| status | Enum | PENDING, ISSUED, RECEIVED |
| remarks | Text | Requisition notes |
| createdAt | DateTime | Creation date |

**Relationships:**
- One MR for one work order
- One MR has many material items

---

### Table: `material_requisition_items`
**Purpose:** Individual materials issued

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| requisitionId | UUID | Material requisition (FK) |
| materialId | UUID | Material (FK) |
| requiredQuantity | Decimal | Quantity needed |
| issuedQuantity | Decimal | Quantity actually issued |
| unit | Enum | Unit of measurement |
| remarks | Text | Item notes |

---

### Table: `production_tracking`
**Purpose:** **SOLVES MAIN PROBLEM** - Real-time production progress

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| workOrderId | UUID | Work order (FK) |
| productionStage | Enum | CUTTING, STITCHING, FINISHING, CHECKING, PACKING |
| updateDate | DateTime | When update made |
| quantityCompleted | Integer | Pieces completed in this stage |
| remarks | Text | Update notes |
| updatedBy | UUID | User (FK) |
| createdAt | DateTime | Record creation |

**Key Feature:** Each stage tracked separately for visibility

**Example:**
- WO-001 for 500 pieces:
  - Cutting: 500 done (100%)
  - Stitching: 350 done (70%)
  - Finishing: 180 done (36%)
  - Checking: 100 done (20%)
  - Packing: 0 done (0%)

---

## ✅ QUALITY CONTROL

### Table: `quality_inspections`
**Purpose:** Quality check records

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| inspectionNumber | String | Unique inspection number |
| inspectionType | Enum | INLINE, FINAL, AQL, RANDOM |
| workOrderId | UUID | Work order (FK, nullable) |
| styleId | UUID | Style (FK) |
| inspectionDate | DateTime | Inspection date |
| inspectedQuantity | Integer | Pieces inspected |
| passedQuantity | Integer | Pieces passed |
| failedQuantity | Integer | Pieces failed |
| reworkQuantity | Integer | Pieces need rework |
| status | Enum | PASS, FAIL, CONDITIONAL_PASS |
| remarks | Text | Inspection notes |
| inspectedBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |

---

### Table: `quality_defects`
**Purpose:** Defects found during inspection

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| inspectionId | UUID | Quality inspection (FK) |
| defectType | String | Type of defect (Stitching, Fabric, Measurement, etc.) |
| defectDescription | Text | Detailed description |
| severity | Enum | MINOR, MAJOR, CRITICAL |
| quantity | Integer | How many pieces affected |
| image | String | Image URL (optional) |
| actionTaken | Text | Corrective action |

---

### Table: `samples`
**Purpose:** Pre-production sample tracking

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| sampleNumber | String | Unique sample number |
| customerId | UUID | Customer (FK) |
| styleId | UUID | Style (FK, nullable if new style) |
| sampleType | Enum | FIT_SAMPLE, PHOTO_SAMPLE, PRODUCTION_SAMPLE |
| requestDate | DateTime | When requested |
| requiredDate | DateTime | When needed |
| completionDate | DateTime | When completed (nullable) |
| status | Enum | REQUESTED, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED |
| customerFeedback | Text | Customer comments |
| remarks | Text | Sample notes |
| createdBy | UUID | User (FK) |
| createdAt | DateTime | Creation date |

---

## 🛒 PURCHASING

### Table: `purchase_orders`
**Purpose:** Material orders to suppliers

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| poNumber | String | Unique PO number |
| supplierId | UUID | Supplier (FK) |
| poDate | DateTime | PO date |
| expectedDeliveryDate | DateTime | Expected delivery |
| status | Enum | DRAFT, SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED |
| totalAmount | Decimal | PO total value |
| paymentTerms | String | Payment conditions |
| remarks | Text | PO notes |
| createdBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |

---

### Table: `purchase_order_items`
**Purpose:** Individual materials in PO

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| poId | UUID | Purchase order (FK) |
| materialId | UUID | Material (FK) |
| orderedQuantity | Decimal | Quantity ordered |
| receivedQuantity | Decimal | Quantity received so far |
| unit | Enum | Unit of measurement |
| unitPrice | Decimal | Price per unit |
| totalPrice | Decimal | Line total |
| remarks | Text | Item notes |

---

### Table: `goods_receiving_notes` (GRN)
**Purpose:** Material delivery records

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| grnNumber | String | Unique GRN number |
| poId | UUID | Purchase order (FK) |
| supplierId | UUID | Supplier (FK) |
| receivingDate | DateTime | Date received |
| invoiceNumber | String | Supplier invoice number |
| invoiceDate | DateTime | Supplier invoice date |
| status | Enum | PENDING_QC, ACCEPTED, REJECTED, PARTIALLY_ACCEPTED |
| remarks | Text | Receiving notes |
| receivedBy | UUID | User (FK) |
| approvedBy | UUID | User (FK, nullable) |
| createdAt | DateTime | Creation date |

---

### Table: `grn_items`
**Purpose:** Individual materials received

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| grnId | UUID | GRN (FK) |
| poItemId | UUID | PO item (FK) |
| materialId | UUID | Material (FK) |
| orderedQuantity | Decimal | What was ordered |
| receivedQuantity | Decimal | What actually arrived |
| acceptedQuantity | Decimal | What passed QC |
| rejectedQuantity | Decimal | What failed QC |
| unit | Enum | Unit of measurement |
| remarks | Text | Item notes |

---

## 🏢 LOCATIONS & SETTINGS

### Table: `locations`
**Purpose:** Factory/warehouse locations

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| locationCode | String | Location code (e.g., FAC-01) |
| locationName | String | Location name |
| locationType | Enum | FACTORY, WAREHOUSE, OFFICE |
| address | Text | Location address |
| capacity | Integer | Production capacity (machines/space) |
| isActive | Boolean | Currently operating? |
| createdAt | DateTime | Creation date |

---

### Table: `delivery_notes`
**Purpose:** Shipment/dispatch records

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| deliveryNumber | String | Unique delivery note number |
| orderId | UUID | Order (FK) |
| customerId | UUID | Customer (FK) |
| deliveryDate | DateTime | Shipment date |
| vehicleNumber | String | Transport vehicle |
| driverName | String | Driver name |
| driverPhone | String | Driver contact |
| status | Enum | PENDING, IN_TRANSIT, DELIVERED |
| remarks | Text | Delivery notes |
| createdBy | UUID | User (FK) |
| createdAt | DateTime | Creation date |

---

### Table: `delivery_note_items`
**Purpose:** Items in each shipment

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| deliveryNoteId | UUID | Delivery note (FK) |
| orderItemId | UUID | Order item (FK) |
| styleId | UUID | Style (FK) |
| colorId | UUID | Color (FK) |
| sizeId | UUID | Size (FK) |
| quantity | Integer | Pieces dispatched |
| cartons | Integer | Number of cartons |
| remarks | Text | Item notes |

---

## 📊 REPORTING & ANALYTICS

### Table: `notifications`
**Purpose:** System alerts and notifications

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| userId | UUID | User (FK) |
| notificationType | Enum | INFO, WARNING, ALERT, SUCCESS |
| title | String | Notification title |
| message | Text | Notification content |
| referenceType | String | Related entity type |
| referenceId | UUID | Related entity ID |
| isRead | Boolean | Has user seen it? |
| sentAt | DateTime | When sent |
| readAt | DateTime | When read (nullable) |

---

### Table: `audit_logs`
**Purpose:** Track all important changes

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| userId | UUID | User (FK) |
| action | String | What was done (CREATE, UPDATE, DELETE) |
| entityType | String | What was changed (Order, WorkOrder, etc.) |
| entityId | UUID | ID of changed record |
| oldValues | JSON | Before change |
| newValues | JSON | After change |
| ipAddress | String | User's IP |
| timestamp | DateTime | When it happened |

---

## 🔑 KEY DESIGN DECISIONS

### 1. **Flexible Size/Color System**
- Sizes stored as separate table per style (not hardcoded)
- Supports both alphanumeric (S,M,L) and numeric (28,30,32) sizes
- Kids and adults have different size ranges per style

### 2. **Multi-Location Support**
- Every stock record has locationId
- Work orders assigned to specific locations
- Location-wise reporting supported

### 3. **Real-Time Production Tracking**
- Stage-wise tracking (Cutting→Stitching→Finishing→etc.)
- Each stage can be updated independently
- Dashboard calculates completion % automatically

### 4. **Audit Trail**
- Critical tables have audit_logs entries
- Track who changed what and when
- Supports compliance and debugging

### 5. **Status Enums**
- Clear workflow states for orders, work orders, production
- Easy to query (e.g., "show all IN_PROGRESS work orders")

---

## 📈 INDEXES FOR PERFORMANCE

Key indexes to be created:
- `users.email` (unique)
- `customers.code` (unique)
- `orders.orderNumber` (unique)
- `orders.customerId` + `orders.status`
- `work_orders.status` + `work_orders.locationId`
- `materials.code` (unique)
- `styles.styleCode` (unique)
- `inventory_stock.materialId` + `inventory_stock.locationId`

---

## 🔐 DATA SECURITY

- Passwords hashed with bcrypt (never stored plain)
- Sensitive fields encrypted (future: card details, personal data)
- Row-level security via role-based access
- Audit logs for compliance
- Regular automated backups

---

**Document Version:** 1.0  
**Last Updated:** October 16, 2025  
**Schema Changes:** Require approval before migration