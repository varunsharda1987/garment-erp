# Order & Procurement Management Guide

## Table of Contents

1. [Overview](#overview)
2. [Order Creation & Management](#order-creation--management)
3. [Order Item Breakup](#order-item-breakup)
4. [Order Item Costing](#order-item-costing)
5. [Order Production Status Tracking](#order-production-status-tracking)
6. [Order Label Overrides](#order-label-overrides)
7. [Purchase Order Workflow](#purchase-order-workflow)
8. [PO Approval Process](#po-approval-process)
9. [Goods Receiving Note (GRN)](#goods-receiving-note-grn)
10. [GRN to Stock Linking](#grn-to-stock-linking)
11. [Order to Work Order Conversion](#order-to-work-order-conversion)
12. [API Reference](#api-reference)
13. [Frontend Integration](#frontend-integration)
14. [Best Practices](#best-practices)

---

## 1. Overview

The Order & Procurement system manages the complete lifecycle from customer order receipt through material procurement and goods receiving.

### Key Workflows

**Sales Order Flow:**
```
Customer Order → Order Items → Item Breakup (Color/Size)
    → Work Orders → Production → Dispatch
```

**Procurement Flow:**
```
Material Requirement → Purchase Order → Supplier Acknowledgment
    → Goods Receipt → Quality Check → Stock Update
```

### Integration Points

- **MRP System**: Auto-generates material requirements from orders
- **Stock Management**: GRN updates stock levels automatically
- **Production Pipeline**: Orders auto-create work orders
- **Costing System**: Order-specific cost calculations
- **Testing Module**: Order-level sample and inspection tracking

---

## 2. Order Creation & Management

### 2.1 Order Data Model

```prisma
model orders {
  id                   String      @id
  orderNumber          String      // Unique: ORD-202506-0001
  customerId           String
  orderDate            DateTime    @default(now())
  expectedDeliveryDate DateTime
  status               OrderStatus @default(PENDING)
  priority             Priority    @default(MEDIUM)
  totalQuantity        Int
  totalAmount          Decimal     @db.Decimal(12, 2)
  paymentTerms         String?
  shippingAddress      String?
  remarks              String?
  isActive             Boolean     @default(true)
  createdById          String
  approvedById         String?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  // Relations
  customers            customers
  createdBy            users
  approvedBy           users?
  order_items          order_items[]
  work_orders          work_orders[]
  delivery_notes       delivery_notes[]
  invoices             invoices[]
  material_requirements material_requirements[]
  fabric_procurement   fabric_procurement[]
  fabric_stock         fabric_stock[]
  embroidery_send_out  embroidery_send_out[]
  asn_applications     asn_applications[]
}
```

### 2.2 Order Status Flow

```prisma
enum OrderStatus {
  PENDING        // Order created, not yet approved
  APPROVED       // Order approved, ready for production
  IN_PRODUCTION  // Production started
  COMPLETED      // Production finished
  DISPATCHED     // Shipped to customer
  CANCELLED      // Order cancelled
}
```

**Status Transitions:**
```
PENDING → APPROVED → IN_PRODUCTION → COMPLETED → DISPATCHED
  ↓
CANCELLED (from any status)
```

### 2.3 Priority Levels

```prisma
enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

**Priority Impact:**
- Work order scheduling
- Material procurement prioritization
- Production floor allocation

### 2.4 Creating an Order

**POST /api/orders**

```typescript
{
  "customerId": "uuid",
  "expectedDeliveryDate": "2024-12-31",
  "priority": "HIGH",
  "paymentTerms": "Net 30",
  "shippingAddress": "123 Customer Street",
  "remarks": "Rush order for holiday season",
  "items": [
    {
      "styleId": "uuid",
      "unitPrice": 450.00,
      "deliveryDate": "2024-12-20",
      "itemDescription": "Men's T-Shirt - Basic Tee",
      "remarks": "Premium quality required",
      "breakup": [
        { "colorId": "uuid", "sizeId": "uuid", "quantity": 100 },
        { "colorId": "uuid", "sizeId": "uuid", "quantity": 150 },
        { "colorId": "uuid", "sizeId": "uuid", "quantity": 200 }
      ]
    }
  ]
}
```

**Backend Logic ([order.service.ts:97-183](backend/src/services/order.service.ts#L97-L183)):**

1. **Generate Order Number:**
```typescript
private async generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const prefix = `ORD-${year}${month}`;

  const lastOrder = await prisma.orders.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' }
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2] || '0');
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  // Example: ORD-2506-0001
}
```

2. **Calculate Totals:**
```typescript
let totalQuantity = 0;
let totalAmount = 0;

for (const item of data.items) {
  const itemTotalQty = item.breakup.reduce((sum, b) => sum + b.quantity, 0);
  const itemTotal = itemTotalQty * parseFloat(item.unitPrice);

  totalQuantity += itemTotalQty;
  totalAmount += itemTotal;
}
```

3. **Create Order in Transaction:**
```typescript
const order = await prisma.$transaction(async (tx) => {
  // Create order
  const createdOrder = await tx.orders.create({
    data: {
      id: orderId,
      orderNumber,
      customerId: data.customerId,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(data.expectedDeliveryDate),
      priority: data.priority || 'MEDIUM',
      totalQuantity,
      totalAmount,
      paymentTerms: data.paymentTerms,
      shippingAddress: data.shippingAddress,
      remarks: data.remarks,
      createdById: userId,
    },
  });

  // Create order items with breakups
  for (const itemData of orderItemsData) {
    await tx.order_items.create({
      data: {
        id: itemData.id,
        orderId: createdOrder.id,
        styleId: itemData.styleId,
        totalQuantity: itemData.totalQuantity,
        unitPrice: itemData.unitPrice,
        totalPrice: itemData.totalPrice,
        order_item_breakup: {
          create: itemData.breakup.map((b) => ({
            colorId: b.colorId,
            sizeId: b.sizeId,
            quantity: b.quantity,
          })),
        },
      },
    });
  }

  return createdOrder;
});
```

4. **Auto-Create Work Orders:**
```typescript
for (const itemData of orderItemsData) {
  await workOrderService.createFromOrderItem(
    itemData.id,
    order.id,
    {
      plannedStartDate: orderDate,
      plannedEndDate: expectedDeliveryDate,
      priority,
      createdById: userId,
    }
  );
}
```

---

## 3. Order Item Breakup

### 3.1 Breakup Structure

Order items are broken down by **color and size** combinations:

```prisma
model order_items {
  id              String   @id
  orderId         String
  styleId         String
  totalQuantity   Int
  unitPrice       Decimal  @db.Decimal(10, 2)
  totalPrice      Decimal  @db.Decimal(12, 2)
  deliveryDate    DateTime?
  status          OrderStatus @default(PENDING)
  remarks         String?

  order_item_breakup  order_item_breakup[]
  orders              orders
  styles              styles
  work_orders         work_orders[]
}

model order_item_breakup {
  id          String   @id
  orderItemId String
  colorId     String?  // Null for size-only orders
  sizeId      String
  variantId   String?
  quantity    Int

  order_items   order_items
  color_options color_options?
  size_options  size_options
  style_variants style_variants?

  @@unique([orderItemId, colorId, sizeId])
}
```

### 3.2 Size-Only Orders

Some orders may not have color variations (e.g., white shirts only):

```typescript
{
  "breakup": [
    { "colorId": null, "sizeId": "uuid-S", "quantity": 100 },
    { "colorId": null, "sizeId": "uuid-M", "quantity": 150 },
    { "colorId": null, "sizeId": "uuid-L", "quantity": 200 }
  ]
}
```

**Note:** `colorId` is optional; `sizeId` is required.

### 3.3 Variant Support

For styles with variants (e.g., "V-Neck" vs "Round Neck"):

```typescript
{
  "breakup": [
    {
      "colorId": "uuid-Navy",
      "sizeId": "uuid-M",
      "variantId": "uuid-VNeck",
      "quantity": 50
    },
    {
      "colorId": "uuid-Navy",
      "sizeId": "uuid-M",
      "variantId": "uuid-RoundNeck",
      "quantity": 50
    }
  ]
}
```

### 3.4 Breakup Validation

**Business Rules:**
- Total breakup quantity must equal `order_item.totalQuantity`
- Each (orderItemId, colorId, sizeId) combination must be unique
- Size must belong to style's size category
- Color must be defined in style's color options

**Validation Logic:**
```typescript
const breakupTotal = item.breakup.reduce((sum, b) => sum + b.quantity, 0);
if (breakupTotal !== item.totalQuantity) {
  throw new Error('Breakup quantities do not match total quantity');
}
```

---

## 4. Order Item Costing

### 4.1 Costing Model

Orders can have **order-specific costing** that differs from the base style costing:

```prisma
model order_item_costing {
  id            String  @id @default(uuid())
  orderItemId   String  @unique
  selectedCadId String?

  // Snapshot of CAD data
  cadMeters Decimal? @db.Decimal(10, 4)
  cadWidth  Decimal? @db.Decimal(10, 2)

  // Cost breakdown
  fabricTotal       Decimal @default(0) @db.Decimal(15, 2)
  trimsTotal        Decimal @default(0) @db.Decimal(10, 2)
  cmtTotal          Decimal @default(0) @db.Decimal(10, 2)
  embroideryTotal   Decimal @default(0) @db.Decimal(10, 2)
  accessoriesTotal  Decimal @default(0) @db.Decimal(10, 2)
  processingTotal   Decimal @default(0) @db.Decimal(10, 2)
  overheadsTotal    Decimal @default(0) @db.Decimal(10, 2)
  totalCostPerPiece Decimal @default(0) @db.Decimal(15, 2)

  // Margin & Pricing
  profitMargin         Decimal? @db.Decimal(5, 2)
  sellingPricePerPiece Decimal? @db.Decimal(15, 2)

  // Reference to base costing
  baseCostingId String?

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  recalculatedAt DateTime?

  // Relations
  order_item  order_items
  selectedCad fabric_width_cad?
  baseCosting style_costing?
}
```

### 4.2 CAD Selection Impact

Orders can select a **specific CAD width** different from the style default:

```typescript
// POST /api/orders/:orderId/items/:itemId/costing
{
  "selectedCadId": "uuid",
  "profitMargin": 20.00
}
```

**Recalculation Logic:**
1. Fetch selected CAD meters and width
2. Recalculate fabric cost based on new CAD
3. Fetch base style costing for other components
4. Calculate total cost per piece
5. Apply profit margin for selling price

### 4.3 Costing Inheritance

**Two Modes:**
1. **Inherit from Style**: Use `style_costing` as-is
2. **Order-Specific**: Create `order_item_costing` with custom CAD/pricing

**When to Use Order-Specific Costing:**
- Customer negotiates special pricing
- Different fabric width selected
- Order-specific material suppliers
- Custom processing requirements

---

## 5. Order Production Status Tracking

### 5.1 Status Tracking Model

Track order fulfillment at the item level:

```typescript
// GET /api/orders/:orderId/production-status
{
  "orderId": "uuid",
  "orderNumber": "ORD-2506-0001",
  "totalQuantity": 1000,
  "items": [
    {
      "orderItemId": "uuid",
      "styleCode": "ST-001",
      "totalQuantity": 500,
      "workOrders": [
        {
          "workOrderNumber": "WO-2506-0001",
          "status": "IN_PRODUCTION",
          "cuttingCompleted": 500,
          "stitchingCompleted": 350,
          "finishingCompleted": 200,
          "readyForDispatch": 0
        }
      ]
    }
  ]
}
```

### 5.2 Stage-Level Tracking

Production stages from [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md):

- **Cutting**: Fabric cut into pattern pieces
- **Stitching**: Garments sewn
- **Finishing**: Buttons, labels, pressing
- **Quality Control**: Inspection
- **Packing**: Ready for dispatch

**Progress Calculation:**
```typescript
const progress = {
  cutting: (cuttingCompleted / totalQuantity) * 100,
  stitching: (stitchingCompleted / totalQuantity) * 100,
  finishing: (finishingCompleted / totalQuantity) * 100,
  overallProgress: (readyForDispatch / totalQuantity) * 100,
};
```

---

## 6. Order Label Overrides

### 6.1 Label Override Model

Orders can override style-level label configurations:

```prisma
model order_label_override {
  id                 String   @id @default(uuid())
  orderItemId        String
  styleLabelConfigId String
  extraPercentage    Decimal? @db.Decimal(5, 2) // Override buffer %
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  orderItem        order_items
  styleLabelConfig style_label_config
  sizeOverrides    order_label_size_override[]

  @@unique([orderItemId, styleLabelConfigId])
}

model order_label_size_override {
  id                   String   @id @default(uuid())
  orderLabelOverrideId String
  size                 String
  barcodeValue         String?  // Override barcode
  mrp                  Decimal? @db.Decimal(10, 2) // Override MRP
  createdAt            DateTime @default(now())

  orderLabelOverride order_label_override

  @@unique([orderLabelOverrideId, size])
}
```

### 6.2 Use Cases

**Scenario 1: Order-Specific Barcodes**
```typescript
// POST /api/orders/:orderId/items/:itemId/label-overrides
{
  "styleLabelConfigId": "uuid",
  "sizeOverrides": [
    { "size": "S", "barcodeValue": "5901234123457", "mrp": 599.00 },
    { "size": "M", "barcodeValue": "5901234123464", "mrp": 599.00 },
    { "size": "L", "barcodeValue": "5901234123471", "mrp": 649.00 }
  ]
}
```

**Scenario 2: Export Order with Different MRP**
```typescript
{
  "styleLabelConfigId": "uuid",
  "sizeOverrides": [
    { "size": "S", "mrp": 25.00 },  // USD pricing
    { "size": "M", "mrp": 28.00 },
    { "size": "L", "mrp": 30.00 }
  ],
  "notes": "Export order - USD pricing"
}
```

**Scenario 3: Higher Buffer for Large Order**
```typescript
{
  "styleLabelConfigId": "uuid",
  "extraPercentage": 10.00,  // 10% buffer instead of default 5%
  "notes": "Large order - extra labels for potential rework"
}
```

---

## 7. Purchase Order Workflow

### 7.1 Purchase Order Model

```prisma
model purchase_orders {
  id                   String              @id
  poNumber             String              // Unique: PO2511-0001
  supplierId           String
  poDate               DateTime            @default(now())
  expectedDeliveryDate DateTime
  status               PurchaseOrderStatus @default(DRAFT)
  totalAmount          Decimal?            @db.Decimal(12, 2)
  paymentTerms         String?
  remarks              String?
  isActive             Boolean             @default(true)
  createdById          String
  approvedById         String?
  createdAt            DateTime            @default(now())

  // Relations
  suppliers             suppliers
  createdBy             users
  approvedBy            users?
  purchase_order_items  purchase_order_items[]
  goods_receiving_notes goods_receiving_notes[]
  requirement_po_links  requirement_po_links[]
}

model purchase_order_items {
  id               String  @id
  poId             String
  materialId       String
  orderedQuantity  Decimal @db.Decimal(10, 3)
  receivedQuantity Decimal @default(0) @db.Decimal(10, 3)
  unit             Unit
  unitPrice        Decimal @db.Decimal(10, 2)
  totalPrice       Decimal @db.Decimal(12, 2)
  remarks          String?

  materials            materials
  purchase_orders      purchase_orders
  grn_items            grn_items[]
  requirement_po_links requirement_po_links[]
}
```

### 7.2 PO Status Flow

```prisma
enum PurchaseOrderStatus {
  DRAFT              // Created, not sent
  SENT               // Sent to supplier
  ACKNOWLEDGED       // Supplier confirmed
  PARTIALLY_RECEIVED // Some items received
  RECEIVED           // All items received
  CANCELLED          // PO cancelled
}
```

**Status Transitions:**
```
DRAFT → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED
  ↓
CANCELLED (from DRAFT/SENT only)
```

### 7.3 Creating Purchase Order

**POST /api/purchase-orders**

```typescript
{
  "supplierId": "uuid",
  "expectedDeliveryDate": "2024-12-15",
  "paymentTerms": "Net 30",
  "remarks": "Urgent requirement for ORD-2506-0001",
  "items": [
    {
      "materialId": "uuid",
      "orderedQuantity": 2500,
      "unit": "METERS",
      "unitPrice": 150.00,
      "remarks": "Cotton Twill - Blue"
    },
    {
      "materialId": "uuid",
      "orderedQuantity": 5000,
      "unit": "PIECES",
      "unitPrice": 2.50,
      "remarks": "15mm Plastic Buttons"
    }
  ]
}
```

**Backend Logic ([purchaseOrder.service.ts:79-138](backend/src/services/purchaseOrder.service.ts#L79-L138)):**

1. **Generate PO Number:**
```typescript
private async generatePONumber(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const prefix = `PO${year}${month}`;

  const lastPO = await prisma.purchase_orders.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: 'desc' }
  });

  let sequence = 1;
  if (lastPO) {
    const lastSequence = parseInt(lastPO.poNumber.split('-')[1] || '0');
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
  // Example: PO2511-0001
}
```

2. **Validate Supplier and Materials:**
```typescript
const supplier = await prisma.suppliers.findUnique({
  where: { id: data.supplierId }
});
if (!supplier) throw new Error('Supplier not found');

for (const item of data.items) {
  const material = await prisma.materials.findUnique({
    where: { id: item.materialId }
  });
  if (!material) throw new Error(`Material ${item.materialId} not found`);
}
```

3. **Calculate Totals:**
```typescript
let totalAmount = 0;
const itemsWithTotals = data.items.map((item) => {
  const totalPrice = item.orderedQuantity * item.unitPrice;
  totalAmount += totalPrice;
  return {
    id: randomUUID(),
    materialId: item.materialId,
    orderedQuantity: item.orderedQuantity,
    receivedQuantity: 0,
    unit: item.unit,
    unitPrice: item.unitPrice,
    totalPrice,
    remarks: item.remarks || null,
  };
});
```

4. **Create PO:**
```typescript
const purchaseOrder = await prisma.purchase_orders.create({
  data: {
    id: randomUUID(),
    poNumber,
    supplierId: data.supplierId,
    expectedDeliveryDate: new Date(data.expectedDeliveryDate),
    status: 'DRAFT',
    totalAmount,
    paymentTerms: data.paymentTerms || supplier.paymentTerms,
    remarks: data.remarks,
    createdById: userId,
    purchase_order_items: {
      create: itemsWithTotals,
    },
  },
  include: {
    suppliers: true,
    purchase_order_items: {
      include: { materials: true }
    }
  },
});
```

### 7.4 Updating Purchase Order

**PATCH /api/purchase-orders/:id**

**Rules:**
- Can only update POs in `DRAFT` status
- Cannot modify once sent to supplier
- Recalculates total on item changes

```typescript
async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderDTO) {
  const existingPO = await prisma.purchase_orders.findUnique({
    where: { id },
  });

  if (!existingPO) throw new Error('Purchase order not found');

  if (existingPO.status !== 'DRAFT') {
    throw new Error('Can only update POs in DRAFT status');
  }

  // Update PO
  const updatedPO = await prisma.purchase_orders.update({
    where: { id },
    data: {
      expectedDeliveryDate: data.expectedDeliveryDate
        ? new Date(data.expectedDeliveryDate)
        : undefined,
      paymentTerms: data.paymentTerms,
      remarks: data.remarks,
    },
  });

  // Recalculate total if items changed
  await this.recalculatePOTotal(id);

  return updatedPO;
}
```

---

## 8. PO Approval Process

### 8.1 Approval Workflow

**Steps:**
1. PO created in `DRAFT` status
2. Approver reviews PO details
3. Approve → Status changes to `SENT`
4. Reject → Remains in `DRAFT` for corrections

**POST /api/purchase-orders/:id/approve**

```typescript
{
  "approved": true,
  "remarks": "Approved for procurement"
}
```

**Backend Logic:**
```typescript
async approvePurchaseOrder(id: string, userId: string) {
  const po = await prisma.purchase_orders.findUnique({
    where: { id },
  });

  if (!po) throw new Error('Purchase order not found');

  if (po.status !== 'DRAFT') {
    throw new Error('Can only approve POs in DRAFT status');
  }

  const updatedPO = await prisma.purchase_orders.update({
    where: { id },
    data: {
      status: 'SENT',
      approvedById: userId,
    },
  });

  return updatedPO;
}
```

### 8.2 Sending to Supplier

**POST /api/purchase-orders/:id/send**

Actions:
- Generate PO PDF
- Email to supplier
- Update status to `SENT`
- Record sent timestamp

```typescript
async sendToSupplier(id: string) {
  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      suppliers: true,
      purchase_order_items: {
        include: { materials: true }
      }
    }
  });

  if (po.status !== 'SENT') {
    throw new Error('PO must be approved before sending');
  }

  // Generate PDF
  const pdfBuffer = await generatePOPDF(po);

  // Send email
  await sendEmail({
    to: po.suppliers.email,
    subject: `Purchase Order ${po.poNumber}`,
    body: `Please find attached PO ${po.poNumber}`,
    attachments: [{ filename: `${po.poNumber}.pdf`, content: pdfBuffer }]
  });

  return { success: true };
}
```

---

## 9. Goods Receiving Note (GRN)

### 9.1 GRN Model

```prisma
model goods_receiving_notes {
  id            String    @id
  grnNumber     String    // Unique: GRN2511-0001
  poId          String
  supplierId    String
  warehouseId   String?   // Target warehouse
  receivingDate DateTime  @default(now())
  invoiceNumber String?
  invoiceDate   DateTime?
  status        GRNStatus @default(PENDING_QC)
  remarks       String?
  receivedById  String
  approvedById  String?
  createdAt     DateTime  @default(now())

  // Relations
  purchase_orders purchase_orders
  suppliers       suppliers
  warehouses      warehouses?
  receivedBy      users
  approvedBy      users?
  grn_items       grn_items[]
}

model grn_items {
  id               String  @id
  grnId            String
  poItemId         String
  materialId       String
  orderedQuantity  Decimal @db.Decimal(10, 3)
  receivedQuantity Decimal @db.Decimal(10, 3)
  acceptedQuantity Decimal @default(0) @db.Decimal(10, 3)
  rejectedQuantity Decimal @default(0) @db.Decimal(10, 3)
  unit             Unit
  remarks          String?

  goods_receiving_notes goods_receiving_notes
  materials             materials
  purchase_order_items  purchase_order_items
}
```

### 9.2 GRN Status Flow

```prisma
enum GRNStatus {
  PENDING_QC // Created, awaiting quality check
  APPROVED   // QC passed, stock updated
  REJECTED   // QC failed
  PARTIAL    // Partially accepted
}
```

### 9.3 Creating GRN

**POST /api/grn**

```typescript
{
  "poId": "uuid",
  "warehouseId": "uuid",
  "receivingDate": "2024-12-01",
  "invoiceNumber": "INV-2024-001",
  "invoiceDate": "2024-11-30",
  "remarks": "Partial delivery - remaining expected Dec 10",
  "items": [
    {
      "poItemId": "uuid",
      "materialId": "uuid",
      "receivedQuantity": 2000,   // Out of 2500 ordered
      "acceptedQuantity": 1950,   // 50 rejected
      "rejectedQuantity": 50,
      "unit": "METERS",
      "remarks": "50 meters damaged in transit"
    }
  ]
}
```

**Backend Logic ([grn.service.ts:54-156](backend/src/services/grn.service.ts#L54-L156)):**

1. **Validate PO Status:**
```typescript
const po = await prisma.purchase_orders.findUnique({
  where: { id: data.poId },
  include: { purchase_order_items: true },
});

if (!po) throw new Error('Purchase order not found');

const receivableStatuses = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'];
if (!receivableStatuses.includes(po.status)) {
  throw new Error(`Cannot receive goods for PO in ${po.status} status`);
}
```

2. **Validate Quantities:**
```typescript
for (const item of data.items) {
  const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
  if (!poItem) throw new Error(`PO item ${item.poItemId} not found`);

  // Check over-receiving
  const pendingQty = poItem.orderedQuantity - poItem.receivedQuantity;
  if (item.receivedQuantity > pendingQty) {
    throw new Error(
      `Cannot receive ${item.receivedQuantity}. Only ${pendingQty} pending`
    );
  }

  // Validate accepted + rejected = received
  if (item.acceptedQuantity + item.rejectedQuantity !== item.receivedQuantity) {
    throw new Error(
      `Accepted + Rejected must equal Received for item ${item.poItemId}`
    );
  }
}
```

3. **Create GRN and Update PO:**
```typescript
const grn = await prisma.$transaction(async (tx) => {
  // Create GRN
  const newGRN = await tx.goods_receiving_notes.create({
    data: {
      id: randomUUID(),
      grnNumber: await generateGRNNumber(),
      poId: data.poId,
      supplierId: po.supplierId,
      warehouseId: data.warehouseId,
      receivingDate: new Date(data.receivingDate),
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
      status: 'PENDING_QC',
      remarks: data.remarks,
      receivedById: userId,
      grn_items: {
        create: data.items.map((item) => ({
          id: randomUUID(),
          poItemId: item.poItemId,
          materialId: item.materialId,
          orderedQuantity: poItem.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          acceptedQuantity: item.acceptedQuantity,
          rejectedQuantity: item.rejectedQuantity,
          unit: item.unit,
          remarks: item.remarks,
        })),
      },
    },
  });

  // Update PO item received quantities
  for (const item of data.items) {
    await tx.purchase_order_items.update({
      where: { id: item.poItemId },
      data: {
        receivedQuantity: {
          increment: item.receivedQuantity,
        },
      },
    });
  }

  return newGRN;
});

// Update PO status (PARTIALLY_RECEIVED or RECEIVED)
await updatePOReceivingStatus(data.poId);
```

### 9.4 GRN Approval & QC

**POST /api/grn/:id/approve**

```typescript
{
  "approved": true,
  "remarks": "Quality check passed"
}
```

**Backend Logic:**
```typescript
async approveGRN(id: string, userId: string, approved: boolean) {
  const grn = await prisma.goods_receiving_notes.findUnique({
    where: { id },
    include: { grn_items: true }
  });

  if (!grn) throw new Error('GRN not found');

  if (grn.status !== 'PENDING_QC') {
    throw new Error('Can only approve GRNs in PENDING_QC status');
  }

  const updatedGRN = await prisma.goods_receiving_notes.update({
    where: { id },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      approvedById: userId,
    },
  });

  // If approved, update stock
  if (approved) {
    for (const item of grn.grn_items) {
      await updateStockOnGRN(item);
    }
  }

  return updatedGRN;
}
```

---

## 10. GRN to Stock Linking

### 10.1 Stock Update on GRN Approval

When GRN is approved, stock levels are automatically updated:

```typescript
async function updateStockOnGRN(grnItem: GRNItem) {
  const grn = await prisma.goods_receiving_notes.findUnique({
    where: { id: grnItem.grnId },
  });

  if (!grn.warehouseId) {
    throw new Error('GRN must have a warehouse to update stock');
  }

  // Create stock movement
  await prisma.stock_movements.create({
    data: {
      id: randomUUID(),
      materialId: grnItem.materialId,
      warehouseId: grn.warehouseId,
      quantity: grnItem.acceptedQuantity,
      movementType: 'GOODS_RECEIPT',
      referenceType: 'GRN',
      referenceId: grn.id,
      movementDate: new Date(),
    },
  });

  // Update stock level
  const existingStock = await prisma.stock_levels.findUnique({
    where: {
      materialId_warehouseId: {
        materialId: grnItem.materialId,
        warehouseId: grn.warehouseId,
      },
    },
  });

  if (existingStock) {
    await prisma.stock_levels.update({
      where: { id: existingStock.id },
      data: {
        quantity: {
          increment: grnItem.acceptedQuantity,
        },
        lastUpdated: new Date(),
      },
    });
  } else {
    await prisma.stock_levels.create({
      data: {
        id: randomUUID(),
        materialId: grnItem.materialId,
        warehouseId: grn.warehouseId,
        quantity: grnItem.acceptedQuantity,
        unit: grnItem.unit,
      },
    });
  }
}
```

### 10.2 Stock Movement Types

From [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md):

```prisma
enum MovementType {
  GOODS_RECEIPT      // GRN approved
  PRODUCTION_ISSUE   // Issued to production
  PRODUCTION_RETURN  // Returned from production
  TRANSFER           // Inter-warehouse transfer
  ADJUSTMENT         // Stock adjustment
  DAMAGE             // Damaged goods write-off
  LOST               // Lost inventory
}
```

### 10.3 MRP Update on GRN

Update material requirements when GRN is received:

```typescript
// In GRN service
async function updateRequirementOnGRN(grnItem: GRNItem) {
  const links = await prisma.requirement_po_links.findMany({
    where: { purchaseOrderItemId: grnItem.poItemId },
  });

  for (const link of links) {
    await prisma.requirement_po_links.update({
      where: { id: link.id },
      data: {
        receivedQuantity: { increment: grnItem.acceptedQuantity },
      },
    });

    // Check if fully received
    const updatedLink = await prisma.requirement_po_links.findUnique({
      where: { id: link.id },
    });

    const fullyReceived =
      updatedLink.receivedQuantity >= updatedLink.allocatedQuantity;

    await prisma.material_requirements.update({
      where: { id: link.requirementId },
      data: {
        receivedQuantity: { increment: grnItem.acceptedQuantity },
        status: fullyReceived ? 'RECEIVED' : 'PO_PARTIAL',
      },
    });
  }
}
```

---

## 11. Order to Work Order Conversion

### 11.1 Auto-Creation Logic

When an order is created, work orders are **automatically generated** for each order item.

**From [order.service.ts:186-204](backend/src/services/order.service.ts#L186-L204):**

```typescript
// After order creation
for (const itemData of orderItemsData) {
  await workOrderService.createFromOrderItem(
    itemData.id,
    order.id,
    {
      plannedStartDate: orderDate,
      plannedEndDate: expectedDeliveryDate,
      priority,
      createdById: userId,
    }
  );
}
```

### 11.2 Work Order Structure

```prisma
model work_orders {
  id               String      @id
  workOrderNumber  String      // WO-2506-0001
  orderItemId      String
  orderId          String
  styleId          String
  plannedQuantity  Int
  completedQuantity Int        @default(0)
  status           OrderStatus @default(PENDING)
  priority         Priority    @default(MEDIUM)
  plannedStartDate DateTime
  plannedEndDate   DateTime
  actualStartDate  DateTime?
  actualEndDate    DateTime?
  locationId       String?
  remarks          String?
  createdById      String
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  // Relations
  orders               orders
  order_items          order_items
  styles               styles
  locations            locations?
  createdBy            users
  material_requisitions material_requisitions[]
  production_tracking  production_tracking[]
}
```

### 11.3 Work Order Creation from Order Item

```typescript
async createFromOrderItem(
  orderItemId: string,
  orderId: string,
  options: {
    plannedStartDate: Date;
    plannedEndDate: Date;
    priority: Priority;
    createdById: string;
  }
): Promise<WorkOrder> {
  const orderItem = await prisma.order_items.findUnique({
    where: { id: orderItemId },
    include: { styles: true },
  });

  if (!orderItem) throw new Error('Order item not found');

  const workOrderNumber = await this.generateWorkOrderNumber();

  const workOrder = await prisma.work_orders.create({
    data: {
      id: randomUUID(),
      workOrderNumber,
      orderItemId,
      orderId,
      styleId: orderItem.styleId,
      plannedQuantity: orderItem.totalQuantity,
      completedQuantity: 0,
      status: 'PENDING',
      priority: options.priority,
      plannedStartDate: options.plannedStartDate,
      plannedEndDate: options.plannedEndDate,
      createdById: options.createdById,
    },
  });

  return workOrder;
}
```

### 11.4 Work Order vs Order Item

**Key Differences:**
- **Order Item**: Customer-facing, tracks sales
- **Work Order**: Production-facing, tracks manufacturing

**Mapping:**
- 1 Order Item = 1 Work Order (typically)
- Work Order inherits priority from Order
- Work Order quantity = Order Item total quantity

---

## 12. API Reference

### 12.1 Order Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order with items |
| GET | `/api/orders` | Get all orders (filterable) |
| GET | `/api/orders/:id` | Get order by ID |
| PATCH | `/api/orders/:id` | Update order |
| DELETE | `/api/orders/:id` | Soft delete order |
| GET | `/api/orders/:id/production-status` | Get production status |
| POST | `/api/orders/:orderId/items/:itemId/costing` | Set order-specific costing |
| POST | `/api/orders/:orderId/items/:itemId/label-overrides` | Set label overrides |

### 12.2 Purchase Order Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/purchase-orders` | Create PO |
| GET | `/api/purchase-orders` | Get all POs (filterable) |
| GET | `/api/purchase-orders/:id` | Get PO by ID |
| PATCH | `/api/purchase-orders/:id` | Update PO (DRAFT only) |
| POST | `/api/purchase-orders/:id/approve` | Approve PO |
| POST | `/api/purchase-orders/:id/send` | Send PO to supplier |
| DELETE | `/api/purchase-orders/:id` | Cancel PO |
| GET | `/api/purchase-orders/supplier/:supplierId` | Get POs by supplier |

### 12.3 GRN Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/grn` | Create GRN |
| GET | `/api/grn` | Get all GRNs (filterable) |
| GET | `/api/grn/:id` | Get GRN by ID |
| POST | `/api/grn/:id/approve` | Approve/reject GRN |
| GET | `/api/grn/po/:poId` | Get GRNs for PO |
| GET | `/api/grn/pending-pos` | Get POs pending receipt |

---

## 13. Frontend Integration

### 13.1 Order Form Component

```tsx
// frontend/src/pages/OrderForm.tsx
import { useState } from 'react';
import { orderService } from '@/services/order.service';

interface OrderItem {
  styleId: string;
  unitPrice: number;
  breakup: Array<{
    colorId: string | null;
    sizeId: string;
    quantity: number;
  }>;
}

export default function OrderForm() {
  const [customerId, setCustomerId] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);

  const handleSubmit = async () => {
    const response = await orderService.create({
      customerId,
      expectedDeliveryDate: deliveryDate.toISOString(),
      priority: 'HIGH',
      items,
    });

    if (response.success) {
      alert(`Order ${response.data.orderNumber} created`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CustomerCombobox value={customerId} onChange={setCustomerId} />

      {items.map((item, index) => (
        <OrderItemRow
          key={index}
          item={item}
          onChange={(updated) => updateItem(index, updated)}
        />
      ))}

      <button type="submit">Create Order</button>
    </form>
  );
}
```

### 13.2 Purchase Order Dashboard

```tsx
// frontend/src/pages/PurchaseOrderDashboard.tsx
import { useEffect, useState } from 'react';
import { purchaseOrderService } from '@/services/purchaseOrder.service';

export default function PurchaseOrderDashboard() {
  const [pos, setPOs] = useState([]);
  const [filters, setFilters] = useState({
    status: 'SENT',
    supplierId: null,
  });

  useEffect(() => {
    loadPOs();
  }, [filters]);

  const loadPOs = async () => {
    const response = await purchaseOrderService.getAll(filters);
    setPOs(response.data);
  };

  const handleApprove = async (poId: string) => {
    await purchaseOrderService.approve(poId);
    loadPOs();
  };

  return (
    <div className="po-dashboard">
      <h1>Purchase Orders</h1>

      <POFilters filters={filters} onChange={setFilters} />

      <POTable data={pos} onApprove={handleApprove} />
    </div>
  );
}
```

### 13.3 GRN Creation Form

```tsx
// frontend/src/components/GRNForm.tsx
import { useState } from 'react';
import { grnService } from '@/services/grn.service';

interface GRNItem {
  poItemId: string;
  materialId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: string;
  remarks?: string;
}

export default function GRNForm({ poId }: { poId: string }) {
  const [items, setItems] = useState<GRNItem[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  const handleSubmit = async () => {
    const response = await grnService.create({
      poId,
      warehouseId,
      invoiceNumber,
      items,
    });

    if (response.success) {
      alert(`GRN ${response.data.grnNumber} created`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Goods Receiving Note</h2>

      <WarehouseCombobox value={warehouseId} onChange={setWarehouseId} />
      <Input
        placeholder="Invoice Number"
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
      />

      {items.map((item, index) => (
        <GRNItemRow
          key={index}
          item={item}
          onChange={(updated) => updateItem(index, updated)}
        />
      ))}

      <button type="submit">Create GRN</button>
    </form>
  );
}
```

---

## 14. Controller Reference

This section provides comprehensive documentation for all controllers managing orders, customers, purchase orders, and goods receiving.

### 14.1 Order Controller

**Controller:** [backend/src/controllers/order.controller.ts](../backend/src/controllers/order.controller.ts:1)
**Routes:** [backend/src/routes/order.routes.ts](../backend/src/routes/order.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/orders/statistics/by-customer` | Required | Get order statistics grouped by customer |
| POST | `/api/orders` | Required | Create new order with items and breakup |
| GET | `/api/orders` | Required | Get all orders (paginated, filterable) |
| GET | `/api/orders/:id` | Required | Get order by ID with full details |
| PUT | `/api/orders/:id` | Required | Update order (PENDING status only) |
| PATCH | `/api/orders/:id/status` | Required | Update order status |
| DELETE | `/api/orders/:id` | Required | Soft delete order (sets isActive = false) |
| GET | `/api/orders/:id/can-delete` | Required | Check if order can be deleted |
| DELETE | `/api/orders/:id/hard-delete` | Admin | Permanently delete order |
| POST | `/api/orders/:id/cancel` | Required | Cancel order with optional reason |
| GET | `/api/orders/:id/lace-allocations` | Required | Get lace allocations for order |

#### Request/Response Examples

**Create Order:**
```typescript
POST /api/orders
{
  customerId: string;
  expectedDeliveryDate: string;  // ISO 8601
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  paymentTerms?: string;
  shippingAddress?: string;
  remarks?: string;
  items: [
    {
      styleId: string;
      unitPrice: number;
      breakup: [
        {
          colorId: string | null;
          sizeId: string;
          variantId?: string;
          quantity: number;
        }
      ]
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    orderNumber: string;  // ORD-202506-0001
    status: "PENDING";
    totalQuantity: number;
    totalAmount: number;
    // ... full order object
  }
}
```

**Get Orders (Filtered):**
```typescript
GET /api/orders?page=1&limit=20&status=APPROVED&customerId=uuid&startDate=2026-01-01&endDate=2026-12-31

Response:
{
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Order Statistics by Customer:**
```typescript
GET /api/orders/statistics/by-customer

Response:
{
  data: [
    {
      customerId: string;
      customerName: string;
      totalOrders: number;
      totalQuantity: number;
      totalAmount: number;
      pendingOrders: number;
      completedOrders: number;
    }
  ]
}
```

#### Use Cases

1. **Order Creation Workflow**
   - Sales team creates order with customer and delivery date
   - Adds multiple order items (styles) with quantity breakup
   - System auto-calculates totals and generates order number
   - Triggers MRP calculation (if BOM exists)

2. **Order Status Management**
   - PENDING → APPROVED (after review)
   - APPROVED → IN_PRODUCTION (when work order created)
   - IN_PRODUCTION → COMPLETED (all production stages done)
   - COMPLETED → DISPATCHED (shipped to customer)
   - Any status → CANCELLED (with reason)

3. **Order Deletion Safety**
   - `GET /api/orders/:id/can-delete` checks for dependencies
   - Soft delete preserves data for reporting
   - Hard delete only allowed for admins (removes all traces)

### 14.2 Customer Controller

**Controller:** [backend/src/controllers/customer.controller.ts](../backend/src/controllers/customer.controller.ts:1)
**Routes:** [backend/src/routes/customer.routes.ts](../backend/src/routes/customer.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/customers` | ADMIN/SALES/MERCHANDISER | Create new customer |
| GET | `/api/customers` | Required | Get all customers (paginated, searchable) |
| GET | `/api/customers/:id` | Required | Get customer by ID |
| PUT | `/api/customers/:id` | ADMIN/SALES/MERCHANDISER | Update customer details |
| DELETE | `/api/customers/:id` | Admin | Deactivate customer |
| GET | `/api/customers/:id/can-deactivate` | ADMIN/SALES/MERCHANDISER | Check if customer can be deactivated |
| GET | `/api/customers/:id/accessory-presets` | Required | Get customer's accessory presets |
| POST | `/api/customers/:id/accessory-presets` | ADMIN/SALES/MERCHANDISER | Create accessory preset for customer |
| PUT | `/api/customers/:id/accessory-presets/:presetId` | ADMIN/SALES/MERCHANDISER | Update accessory preset |
| DELETE | `/api/customers/:id/accessory-presets/:presetId` | Admin | Delete accessory preset |

#### Request/Response Examples

**Create Customer:**
```typescript
POST /api/customers
{
  name: string;
  code: string;              // Unique customer code
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;     // "Net 30", "50% advance", etc.
  creditLimit?: number;
  taxId?: string;
  isActive?: boolean;        // Default: true
}

Response:
{
  success: true;
  data: {
    id: string;
    name: string;
    code: string;
    // ... full customer object
  }
}
```

**Customer Accessory Presets:**
```typescript
POST /api/customers/:id/accessory-presets
{
  name: string;              // "Standard Hang Tag Set"
  accessories: [
    {
      accessoryId: string;   // UUID of button/label/zipper/etc.
      quantity: number;      // Qty per garment
      unit: string;
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    customerId: string;
    name: string;
    accessories: CustomerAccessory[];
  }
}
```

#### Use Cases

1. **Customer Management**
   - Sales team creates customer profiles
   - Tracks payment terms and credit limits
   - Manages contact information
   - Links customers to orders and quotations

2. **Accessory Preset System**
   - Define standard accessory sets per customer
   - E.g., "Customer A always uses brass buttons and satin labels"
   - Auto-populate accessories when creating orders for this customer
   - Reduce data entry errors

3. **Customer Deactivation Safety**
   - `GET /api/customers/:id/can-deactivate` checks for active orders
   - Cannot deactivate customer with pending/in-production orders
   - Soft delete preserves historical data

### 14.3 Purchase Order Controller

**Controller:** [backend/src/controllers/purchaseOrder.controller.ts](../backend/src/controllers/purchaseOrder.controller.ts:1)
**Routes:** [backend/src/routes/purchaseOrder.routes.ts](../backend/src/routes/purchaseOrder.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/purchase-orders` | Required | Get all POs (paginated, filterable) |
| GET | `/api/purchase-orders/receivable` | Required | Get POs ready for goods receipt |
| GET | `/api/purchase-orders/supplier/:supplierId` | Required | Get POs for specific supplier |
| GET | `/api/purchase-orders/:id` | Required | Get PO by ID with items |
| GET | `/api/purchase-orders/:id/pending-items` | Required | Get items pending receipt |
| POST | `/api/purchase-orders` | Required | Create new PO |
| PUT | `/api/purchase-orders/:id` | Required | Update PO (DRAFT status only) |
| DELETE | `/api/purchase-orders/:id` | Required | Delete PO (DRAFT only) |
| POST | `/api/purchase-orders/:id/items` | Required | Add item to existing PO |
| PUT | `/api/purchase-orders/:id/items/:itemId` | Required | Update PO item |
| DELETE | `/api/purchase-orders/:id/items/:itemId` | Required | Remove PO item |
| PATCH | `/api/purchase-orders/:id/send` | Required | Send PO to supplier (DRAFT → SENT) |
| PATCH | `/api/purchase-orders/:id/acknowledge` | Required | Mark PO acknowledged by supplier |
| PATCH | `/api/purchase-orders/:id/cancel` | Required | Cancel PO |

#### Request/Response Examples

**Create Purchase Order:**
```typescript
POST /api/purchase-orders
{
  supplierId: string;
  expectedDeliveryDate: string;  // ISO 8601
  paymentTerms?: string;
  remarks?: string;
  items: [
    {
      materialId: string;
      quantity: number;
      unit: string;            // "meters", "pieces", "kg"
      unitPrice: number;
      requirementId?: string;  // Link to MRP requirement
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    poNumber: string;        // PO-202506-0001
    status: "DRAFT";
    totalAmount: number;
    // ... full PO object
  }
}
```

**Get Receivable POs:**
```typescript
GET /api/purchase-orders/receivable

Response:
{
  data: [
    {
      id: string;
      poNumber: string;
      supplierId: string;
      status: "SENT" | "ACKNOWLEDGED";
      totalAmount: number;
      expectedDeliveryDate: string;
      items: POItem[];
      receivedQuantities: { [itemId: string]: number };  // Already received
    }
  ]
}
```

**PO Status Flow:**
```
DRAFT → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → FULLY_RECEIVED
  ↓
CANCELLED (any stage)
```

#### Use Cases

1. **Manual PO Creation**
   - Purchase team creates PO for ad-hoc requirements
   - Adds items manually with quantities and prices
   - Sends to supplier for confirmation

2. **MRP-Generated POs**
   - MRP system auto-creates POs from material requirements
   - Links `requirementId` to track which order needs which material
   - Bulk PO generation groups by supplier

3. **PO Lifecycle Management**
   - Draft: Internal creation, can be edited/deleted
   - Sent: Transmitted to supplier, awaiting confirmation
   - Acknowledged: Supplier confirmed, production started
   - Received: Goods received via GRN
   - Cancelled: PO void (requires all items un-received)

4. **Partial Receipts**
   - `GET /api/purchase-orders/:id/pending-items` shows outstanding quantities
   - Multiple GRNs can be created against one PO
   - PO status updates automatically based on received vs ordered quantities

### 14.4 GRN Controller

**Controller:** [backend/src/controllers/grn.controller.ts](../backend/src/controllers/grn.controller.ts:1)
**Routes:** [backend/src/routes/grn.routes.ts](../backend/src/routes/grn.routes.ts:1)

#### Complete Endpoint List

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/grn` | Required | Create new GRN |
| GET | `/api/grn` | Required | Get all GRNs (paginated, filterable) |
| GET | `/api/grn/:id` | Required | Get GRN by ID with items |
| POST | `/api/grn/:id/approve` | Required | Approve/reject GRN (quality check) |
| GET | `/api/grn/po/:poId` | Required | Get all GRNs for a specific PO |
| GET | `/api/grn/pending-pos` | Required | Get POs pending goods receipt |

#### Request/Response Examples

**Create GRN:**
```typescript
POST /api/grn
{
  poId: string;
  warehouseId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  vehicleNumber?: string;
  driverName?: string;
  remarks?: string;
  items: [
    {
      poItemId: string;
      materialId: string;
      receivedQuantity: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      unit: string;
      remarks?: string;
    }
  ]
}

Response:
{
  success: true;
  data: {
    id: string;
    grnNumber: string;       // GRN-202506-0001
    status: "PENDING";       // Awaiting approval
    totalItems: number;
    totalReceivedQty: number;
    totalAcceptedQty: number;
    totalRejectedQty: number;
    // ... full GRN object
  }
}
```

**Approve/Reject GRN:**
```typescript
POST /api/grn/:id/approve
{
  approved: boolean;
  remarks?: string;
  approvedBy?: string;
}

Response:
{
  success: true;
  data: {
    id: string;
    status: "APPROVED" | "REJECTED";
    approvedAt: string;
    approvedBy: string;
    stockUpdates: [
      {
        materialId: string;
        warehouseId: string;
        quantityAdded: number;
      }
    ]
  }
}
```

#### Use Cases

1. **Goods Receipt Process**
   - Warehouse receives materials from supplier
   - Creates GRN linked to PO
   - Records received vs accepted vs rejected quantities
   - Attaches supplier invoice details

2. **Quality Inspection**
   - GRN created with initial received quantities
   - Quality team inspects goods
   - Approves GRN → stock updated automatically
   - Rejects GRN → no stock update, supplier notification

3. **Partial Receipts**
   - Single PO can have multiple GRNs
   - `GET /api/grn/po/:poId` tracks all receipts for a PO
   - Each GRN updates PO status (PARTIALLY_RECEIVED or FULLY_RECEIVED)

4. **Stock Linkage**
   - Approved GRN automatically creates `material_stock` entries
   - Links material to warehouse
   - Updates available quantities
   - Tracks GRN reference for traceability

---

## 15. Best Practices

### 14.1 Order Management

1. **Always Validate Stock Before Confirming Orders**
   - Run MRP calculation
   - Identify material shortfalls
   - Communicate lead times to customer

2. **Set Realistic Delivery Dates**
   - Factor in production time
   - Include buffer for delays
   - Coordinate with production team

3. **Use Order Priority Correctly**
   - URGENT: Rush orders, penalties for delays
   - HIGH: Important customer, tight deadline
   - MEDIUM: Standard orders
   - LOW: Stock/buffer orders

4. **Track Order Progress**
   - Monitor work order status
   - Update customers on delays
   - Proactively manage issues

### 14.2 Purchase Order Best Practices

1. **Consolidate POs When Possible**
   - Group materials by supplier
   - Reduce administrative overhead
   - Better pricing through volume

2. **Always Get Supplier Confirmation**
   - Don't assume `SENT` means `ACKNOWLEDGED`
   - Follow up on pending confirmations
   - Record supplier responses

3. **Set Expected Delivery Dates Realistically**
   - Add lead time buffer
   - Factor in supplier reliability
   - Coordinate with production schedule

4. **Maintain Accurate Payment Terms**
   - Use supplier default terms
   - Negotiate for important orders
   - Track payment due dates

### 14.3 GRN Best Practices

1. **Inspect Before Accepting**
   - Check quantities match PO
   - Verify quality standards
   - Document any discrepancies

2. **Segregate Rejected Materials**
   - Physical separation from accepted stock
   - Tag with rejection reason
   - Initiate return process

3. **Update Stock Immediately**
   - Don't delay GRN approval
   - Ensure accurate inventory
   - Enable MRP updates

4. **Match Invoice with GRN**
   - Verify invoice quantities
   - Check pricing matches PO
   - Record invoice details

### 14.4 Common Pitfalls to Avoid

1. **Creating Orders Without Checking Stock**
   - Leads to production delays
   - Customer dissatisfaction
   - Rush procurement costs

2. **Not Updating Order Status**
   - Loses visibility
   - Confuses production team
   - Inaccurate reporting

3. **Approving GRNs Without Quality Check**
   - Poor quality stock enters inventory
   - Production issues
   - Customer complaints

4. **Forgetting to Link Requirements to POs**
   - Loses traceability
   - Difficult to track fulfillment
   - MRP inaccuracies

5. **Over-receiving on GRNs**
   - Inventory bloat
   - Ties up capital
   - Storage issues

---

## Related Documentation

- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) - Material requirement planning
- [STOCK_MANAGEMENT_GUIDE.md](./STOCK_MANAGEMENT_GUIDE.md) - Stock levels & movements
- [PRODUCTION_PIPELINE_GUIDE.md](./PRODUCTION_PIPELINE_GUIDE.md) - Work orders & production
- [DISPATCH_LOGISTICS_GUIDE.md](./DISPATCH_LOGISTICS_GUIDE.md) - Delivery notes & shipping
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) - Main system documentation

---

**Last Updated:** 2026-01-12
**Version:** 1.0
**Maintained By:** Development Team
