# Sample Management & Embroidery Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Sample Management System](#2-sample-management-system)
3. [Sample Types & Workflow](#3-sample-types--workflow)
4. [Sample Measurements](#4-sample-measurements)
5. [Sample Colorways (PP Samples)](#5-sample-colorways-pp-samples)
6. [Sample Size Sets](#6-sample-size-sets)
7. [Order Samples Linking](#7-order-samples-linking)
8. [Sequential Sample Approval Gates](#8-sequential-sample-approval-gates)
9. [Embroidery Master Setup](#9-embroidery-master-setup)
10. [Embroidery Send-Out Process](#10-embroidery-send-out-process)
11. [Embroidery Stock Management](#11-embroidery-stock-management)
12. [CAD Embroidery Placement](#12-cad-embroidery-placement)
13. [Lab Dips Process](#13-lab-dips-process)
14. [API Reference](#14-api-reference)
15. [Frontend Integration](#15-frontend-integration)
16. [Best Practices](#16-best-practices)

---

## 1. Overview

### Purpose

The Sample Management & Embroidery system handles:

- **5 Sample Types**: FIT, PP (Pre-Production), Size Set, Shipment, Photoshoot
- **Sequential Approval Gates**: Enforce FIT → PP → Size Set workflow
- **Measurement Tracking**: Spec vs actual with tolerance validation
- **Embroidery Workflow**: Design master → Send-out → Receipt → Stock creation
- **Lab Dips**: Color/print approval before bulk production
- **CAD Integration**: Embroidery placement with size-wise breakdown

### Key Models

```prisma
// Core sample model
model samples {
  id               String       @id
  sampleNumber     String       // FIT-STY2024-0001-v1, PP-202512-0001
  customerId       String
  styleId          String?
  sampleType       SampleType   // FIT_SAMPLE, PP_SAMPLE, SIZE_SET_SAMPLE, etc.
  status           SampleStatus // REQUESTED → IN_PROGRESS → SENT → APPROVED
  requestDate      DateTime
  requiredDate     DateTime
  completionDate   DateTime?
  version          Int          // For FIT revision tracking

  // Relations
  measurements     sample_measurements[]
  colorways        sample_colorways[]    // For PP samples
  sizeSets         sample_size_sets[]    // For Size Set samples
}

// Embroidery design master
model embroidery_master {
  id             String  @id
  embroideryCode String  // EMB-202512-0001
  designName     String
  stitchCount    Int?
  threadColors   Int?
  cutableWidth   Decimal // Width after embroidery
  costPerMeter   Decimal?

  // Send-out tracking
  embroidery_send_outs embroidery_send_out[]
}

// Embroidery send-out tracking
model embroidery_send_out {
  id                   String  @id
  sourceFabricStockId  String  // Plain fabric sent
  embroideryId         String
  quantitySent         Decimal
  quantityReceived     Decimal?
  status               String  // SENT, IN_PROGRESS, RECEIVED
  resultFabricStockId  String? // Created embroidered stock
}
```

### Sample Lifecycle

```
REQUESTED → IN_PROGRESS → SUBMITTED → SENT →
FEEDBACK_PENDING → APPROVED/REJECTED/REVISION_NEEDED
```

### Embroidery Lifecycle

```
Design Master → Send-Out (deduct stock) →
In Progress → Receive (create new embroidered stock) → Available
```

---

## 2. Sample Management System

### Sample Number Generation

**Format by Type:**

```typescript
// FIT Sample (with revision versioning)
FIT-STY2024-0001-v1
FIT-STY2024-0001-v2  // Revision

// PP Sample (pre-production)
PP-202512-0001
PP-202512-0002

// Size Set Sample
SIZE-SET-202512-0001

// Shipment Sample
SHIPMENT-202512-0001

// Photoshoot Sample
PHOTOSHOOT-202512-0001
```

**Generation Logic:**

```typescript
async function generateSampleNumber(
  sampleType: string,
  styleCode?: string,
  version: number = 1
): Promise<string> {
  const typePrefix = sampleType.replace('_SAMPLE', '').replace('_', '-');
  const styleRef = styleCode || 'GEN';
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (sampleType === 'FIT_SAMPLE') {
    return `${typePrefix}-${styleRef}-v${version}`;
  }

  // For other types, use sequential numbering
  const existingCount = await prisma.samples.count({
    where: {
      sampleType: sampleType as any,
      sampleNumber: { startsWith: `${typePrefix}-` },
      isActive: true,
    },
  });

  const seq = String(existingCount + 1).padStart(4, '0');
  return `${typePrefix}-${yearMonth}-${seq}`;
}
```

### Sample Enums

**SampleType:**
- `FIT_SAMPLE` - Initial fit approval (can have multiple revisions v1, v2, v3...)
- `PP_SAMPLE` - Pre-production sample (multiple colorways)
- `SIZE_SET_SAMPLE` - All sizes in jumping sizes (S, M, L, XL, XXL)
- `SHIPMENT_SAMPLE` - Sample from actual shipment batch
- `PHOTOSHOOT_SAMPLE` - Sample for marketing/photography

**SampleStatus:**
- `REQUESTED` - Initial creation
- `IN_PROGRESS` - Being manufactured
- `SUBMITTED` - Completed internally, ready to send
- `SENT` - Sent to buyer
- `FEEDBACK_PENDING` - Buyer received, awaiting feedback
- `APPROVED` - Buyer approved
- `APPROVED_WITH_COMMENTS` - Approved with minor notes
- `REJECTED` - Buyer rejected
- `REVISION_NEEDED` - Needs revision (for FIT samples)

---

## 3. Sample Types & Workflow

### 3.1 FIT Sample

**Purpose:** Verify garment fit and measurements before bulk production.

**Characteristics:**
- Usually 1 piece per size
- Focus on measurements (chest, length, sleeve, etc.)
- Can have multiple revisions (v1, v2, v3...)
- Blocks PP sample creation until approved

**Workflow:**

```
1. Request FIT sample
   └─ Create sample with measurements

2. Manufacture sample
   └─ Update status: IN_PROGRESS → SUBMITTED

3. Send to buyer
   └─ Update status: SENT
   └─ Record: sentDate, courierMode, trackingNumber

4. Buyer receives
   └─ Update status: FEEDBACK_PENDING
   └─ Record: receivedDate

5. Buyer provides feedback
   └─ Record actual measurements
   └─ Status: APPROVED / REJECTED / REVISION_NEEDED

6. If REJECTED → Create Revision (v2)
   └─ Copy measurements from v1
   └─ New sample: FIT-STY2024-0001-v2
```

**Example API Call:**

```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "cust-123",
    "styleId": "style-456",
    "sampleType": "FIT_SAMPLE",
    "requiredDate": "2025-01-20",
    "measurements": [
      {
        "measurementPoint": "Chest",
        "specValue": 40.0,
        "tolerance": 0.5
      },
      {
        "measurementPoint": "Length",
        "specValue": 28.0,
        "tolerance": 0.5
      },
      {
        "measurementPoint": "Sleeve",
        "specValue": 24.0,
        "tolerance": 0.3
      }
    ]
  }'
```

### 3.2 PP Sample (Pre-Production)

**Purpose:** Verify all colorways before bulk production.

**Characteristics:**
- Multiple colorways (1 piece per color)
- Optional: include multiple sizes per colorway
- Fabric lot tracking (which fabric lot was used)
- Blocks Size Set sample until approved

**Workflow:**

```
1. FIT must be APPROVED first (blocking gate)
   └─ System validates: Cannot create PP without approved FIT

2. Request PP sample with colorways
   └─ List all colors to be sampled

3. Manufacture samples
   └─ Track fabric lot used for each colorway

4. Send to buyer
   └─ All colorways sent together

5. Buyer feedback
   └─ Approve/reject per colorway
   └─ Overall status: APPROVED if all colorways approved
```

**Example API Call:**

```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "cust-123",
    "styleId": "style-456",
    "sampleType": "PP_SAMPLE",
    "requiredDate": "2025-01-25",
    "colorways": [
      {
        "colorId": "color-red",
        "sizeId": "size-m",
        "fabricLot": "LOT-12345",
        "qtySent": 1
      },
      {
        "colorId": "color-blue",
        "sizeId": "size-m",
        "fabricLot": "LOT-12346",
        "qtySent": 1
      },
      {
        "colorId": "color-black",
        "sizeId": "size-m",
        "fabricLot": "LOT-12347",
        "qtySent": 1
      }
    ]
  }'
```

### 3.3 Size Set Sample

**Purpose:** Verify all sizes in jumping sizes (S, M, L, XL, XXL).

**Characteristics:**
- All sizes with jumping (not every size)
- One colorway or specific color per size
- Final approval gate before bulk production
- Blocks work order creation until approved

**Workflow:**

```
1. PP must be APPROVED first (blocking gate)
   └─ System validates: Cannot create Size Set without approved PP

2. Request Size Set sample
   └─ Specify sizes and colors

3. Manufacture all sizes

4. Send to buyer

5. Buyer feedback on each size
   └─ Approve/reject per size

6. Once APPROVED → Unlock work order creation
```

**Example API Call:**

```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "cust-123",
    "styleId": "style-456",
    "sampleType": "SIZE_SET_SAMPLE",
    "requiredDate": "2025-02-01",
    "sizeSets": [
      { "sizeId": "size-s", "colorId": "color-red", "qty": 1 },
      { "sizeId": "size-m", "colorId": "color-red", "qty": 1 },
      { "sizeId": "size-l", "colorId": "color-red", "qty": 1 },
      { "sizeId": "size-xl", "colorId": "color-red", "qty": 1 },
      { "sizeId": "size-xxl", "colorId": "color-red", "qty": 1 }
    ]
  }'
```

### 3.4 Shipment Sample

**Purpose:** Sample taken from actual production shipment.

**Characteristics:**
- Taken from finished goods carton
- Linked to specific dispatch
- Linked to production lot
- No measurement validation (just reference)

**Fields:**
- `linkedDispatchId` - Dispatch this sample was taken from
- `productionLot` - Production lot reference

### 3.5 Photoshoot Sample

**Purpose:** Sample used for marketing, catalog, or photoshoot.

**Characteristics:**
- May or may not be production-grade
- Tracked separately for return/inventory
- No measurement validation

**Fields:**
- `sentTo` - Studio/agency name
- `purpose` - "Catalog Photoshoot", "Social Media Campaign", etc.

---

## 4. Sample Measurements

### Database Schema

```prisma
model sample_measurements {
  id               String   @id
  sampleId         String
  sizeId           String?  // Optional: for size-specific measurements
  measurementPoint String   // "Chest", "Length", "Sleeve", etc.
  specValue        Decimal  // Specification value
  actualValue      Decimal? // Measured value (QC)
  tolerance        Decimal  // Allowed deviation (e.g., 0.5)
  status           String?  // PASS, FAIL (auto-calculated)

  sample samples       @relation(...)
  size   size_options? @relation(...)
}
```

### Measurement Workflow

```
1. Define Spec Measurements (at sample creation)
   └─ measurementPoint: "Chest"
   └─ specValue: 40.0
   └─ tolerance: 0.5
   └─ actualValue: NULL

2. QC Records Actual Measurements
   └─ actualValue: 40.3
   └─ System auto-calculates status:
       diff = |40.3 - 40.0| = 0.3
       tolerance = 0.5
       0.3 <= 0.5 → status = PASS

3. Summary Report
   └─ All PASS → Sample measurements approved
   └─ Any FAIL → Requires review/revision
```

### Recording Actual Measurements (API)

```bash
curl -X POST http://localhost:5000/api/samples/{sampleId}/measurements/actual \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "measurements": [
      { "id": "meas-1", "actualValue": 40.3 },
      { "id": "meas-2", "actualValue": 28.2 },
      { "id": "meas-3", "actualValue": 24.1 }
    ]
  }'
```

**Response:**

```json
{
  "data": {
    "id": "sample-123",
    "measurements": [
      {
        "measurementPoint": "Chest",
        "specValue": 40.0,
        "actualValue": 40.3,
        "tolerance": 0.5,
        "status": "PASS"
      },
      {
        "measurementPoint": "Length",
        "specValue": 28.0,
        "actualValue": 28.2,
        "tolerance": 0.5,
        "status": "PASS"
      },
      {
        "measurementPoint": "Sleeve",
        "specValue": 24.0,
        "actualValue": 24.1,
        "tolerance": 0.3,
        "status": "PASS"
      }
    ]
  }
}
```

### Common Measurement Points

**Tops/Shirts:**
- Chest/Bust, Shoulder, Sleeve, Length, Neck, Armhole, Cuff

**Bottoms/Pants:**
- Waist, Hip, Inseam, Outseam, Thigh, Knee, Leg Opening, Rise

**Dresses:**
- Bust, Waist, Hip, Shoulder, Sleeve, Length, Armhole

---

## 5. Sample Colorways (PP Samples)

### Database Schema

```prisma
model sample_colorways {
  id        String  @id
  sampleId  String
  colorId   String
  sizeId    String?  // Optional: if multiple sizes per colorway
  fabricLot String?  // Which fabric lot was used
  qtySent   Int      @default(1)
  status    String   @default("PENDING") // PENDING, APPROVED, REJECTED

  sample samples       @relation(...)
  color  color_options @relation(...)
  size   size_options? @relation(...)
}
```

### Workflow

```
1. Create PP Sample with Colorways
   └─ List all colors to be sampled

2. Manufacture Each Colorway
   └─ Track which fabric lot used
   └─ Optional: track size per colorway

3. Send All Colorways Together

4. Buyer Feedback Per Colorway
   └─ Approve Color A → status: APPROVED
   └─ Reject Color B → status: REJECTED
   └─ Pending Color C → status: PENDING

5. Overall Sample Status
   └─ All APPROVED → Sample status: APPROVED
   └─ Any REJECTED → Sample status: APPROVED_WITH_COMMENTS or needs action
```

### Example: Update Colorway Status

```bash
curl -X PATCH http://localhost:5000/api/samples/{sampleId}/colorways/{colorwayId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "APPROVED",
    "remarks": "Color matches Pantone 18-1664 TPG perfectly"
  }'
```

---

## 6. Sample Size Sets

### Database Schema

```prisma
model sample_size_sets {
  id       String @id
  sampleId String
  sizeId   String
  colorId  String
  qty      Int    @default(1)
  status   String @default("PENDING") // PENDING, APPROVED, REJECTED

  sample samples       @relation(...)
  size   size_options  @relation(...)
  color  color_options @relation(...)
}
```

### Jumping Sizes

**Full Range:** XS, S, M, L, XL, XXL, 3XL, 4XL
**Jumping Sizes:** S, M, L, XL, XXL (skip XS, 3XL, 4XL)

**Rationale:** Cost-effective way to verify fit across size range without manufacturing every size.

### Workflow

```
1. Create Size Set Sample
   └─ Select jumping sizes: S, M, L, XL, XXL
   └─ Assign color per size (usually same color)

2. Manufacture Each Size

3. Send All Sizes Together

4. Buyer Feedback Per Size
   └─ Check fit, measurements, construction
   └─ Approve/reject per size

5. Overall Approval
   └─ All sizes APPROVED → Unlock work order creation
```

### Example: Create Size Set Sample

```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "cust-123",
    "styleId": "style-456",
    "sampleType": "SIZE_SET_SAMPLE",
    "requiredDate": "2025-02-01",
    "sizeSets": [
      { "sizeId": "size-s", "colorId": "color-navy", "qty": 1 },
      { "sizeId": "size-m", "colorId": "color-navy", "qty": 1 },
      { "sizeId": "size-l", "colorId": "color-navy", "qty": 1 },
      { "sizeId": "size-xl", "colorId": "color-navy", "qty": 1 },
      { "sizeId": "size-xxl", "colorId": "color-navy", "qty": 1 }
    ]
  }'
```

---

## 7. Order Samples Linking

### Database Schema

```prisma
model order_samples {
  id          String       @id
  orderItemId String
  sampleType  SampleType   // Which sample type is linked
  status      SampleStatus
  quantity    Int          @default(1)

  // Dates
  requestDate    DateTime  @default(now())
  sentDate       DateTime?
  feedbackDate   DateTime?
  completionDate DateTime?

  // Details
  remarks      String?
  feedbackNote String?
  courierInfo  String?

  orderItem order_items @relation(...)
}
```

### Purpose

Track which samples were created for specific order items (not just generic style samples).

### Workflow

```
1. Order Created
   └─ Order Item 1: Style ABC, Color Red, 1000 pcs

2. Request Order-Specific Sample
   └─ Create order_sample record
   └─ Link to orderItemId
   └─ sampleType: FIT_SAMPLE

3. Manufacture Sample
   └─ Update status

4. Buyer Approval
   └─ Update status: APPROVED
   └─ Linked to order item for traceability
```

---

## 8. Sequential Sample Approval Gates

### Gate Enforcement Logic

**Service: `productionBlockingValidation.service.ts`**

```typescript
export class ProductionBlockingValidationService {
  /**
   * Validate PP sample creation (requires approved FIT)
   */
  async validatePPSampleCreation(styleId: string) {
    const fitApproved = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE',
        status: { in: ['APPROVED', 'APPROVED_WITH_COMMENTS'] },
      },
    });

    if (fitApproved === 0) {
      return {
        canCreate: false,
        blocker: {
          prerequisiteType: 'FIT_SAMPLE',
          message: 'FIT Sample must be approved before creating PP Sample',
        },
      };
    }

    return { canCreate: true };
  }

  /**
   * Validate Size Set sample creation (requires approved PP)
   */
  async validateSizeSetSampleCreation(styleId: string) {
    const ppApproved = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'PP_SAMPLE',
        status: { in: ['APPROVED', 'APPROVED_WITH_COMMENTS'] },
      },
    });

    if (ppApproved === 0) {
      return {
        canCreate: false,
        blocker: {
          prerequisiteType: 'PP_SAMPLE',
          message: 'PP Sample must be approved before creating Size Set Sample',
        },
      };
    }

    return { canCreate: true };
  }
}
```

### Admin Override

**When to Use:**
- Urgent orders that need to skip sample stages
- Repeat styles with known fit
- Special buyer arrangements

**How it Works:**

```typescript
// Admin override request
{
  "adminOverride": true,
  "overrideReason": "Repeat order for buyer XYZ, fit already approved in previous season"
}

// System creates override log
await prisma.stage_transition_overrides.create({
  data: {
    blockType: 'SAMPLE_CREATION',
    sampleId: sample.id,
    overrideReason: "Repeat order for buyer XYZ...",
    overriddenById: userId,
  },
});
```

### Gate Status API

```bash
# Check sample approval gates for a style
curl http://localhost:5000/api/samples/style/{styleId}/approval-gate \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "data": {
    "fitApproved": true,
    "ppApproved": true,
    "sizeSetApproved": false,
    "canCreateWorkOrder": false
  }
}
```

---

## 9. Embroidery Master Setup

### Database Schema

```prisma
model embroidery_master {
  id             String  @id
  embroideryCode String  // EMB-202512-0001
  designName     String  // "Floral Border 3"", "Logo Chest Placement"

  // Design Files
  designFile   String? // URL to .EMB, .DST file
  designImage  String? // Preview image URL

  // Specifications
  stitchCount  Int?    // Total stitches
  threadColors Int?    // Number of thread colors
  repeatWidth  Decimal? // Pattern repeat width (inches)
  repeatHeight Decimal? // Pattern repeat height (inches)

  // Width Impact
  cutableWidth Decimal  // Cuttable width after embroidery (inches)

  // Costing
  costPerMeter Decimal? // Embroidery cost per meter

  // Supplier
  supplierId   String?
  leadTimeDays Int?

  // Origin
  originalStyleId String? // Style this was originally created for

  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### Code Generation

**Format:** `EMB-YYYYMM-XXXX`

**Example:** `EMB-202512-0001`

```typescript
async function generateEmbroideryCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `EMB-${yearMonth}`;

  const lastEmbroidery = await prisma.embroidery_master.findFirst({
    where: { embroideryCode: { startsWith: prefix } },
    orderBy: { embroideryCode: 'desc' },
  });

  let nextNumber = 1;
  if (lastEmbroidery?.embroideryCode) {
    const match = lastEmbroidery.embroideryCode.match(/-(\d{4})$/);
    if (match && match[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}
```

### Creating Embroidery Design

```bash
curl -X POST http://localhost:5000/api/embroidery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "designName": "Floral Border V3",
    "description": "3-inch floral border for collar and sleeves",
    "designFile": "https://cdn.example.com/emb/floral-v3.dst",
    "designImage": "https://cdn.example.com/emb/floral-v3-preview.jpg",
    "stitchCount": 12500,
    "threadColors": 4,
    "repeatWidth": 3.0,
    "repeatHeight": 2.5,
    "cutableWidth": 42.0,
    "costPerMeter": 25.00,
    "supplierId": "supplier-xyz",
    "leadTimeDays": 7,
    "originalStyleId": "style-abc"
  }'
```

**Response:**

```json
{
  "data": {
    "id": "emb-uuid",
    "embroideryCode": "EMB-202512-0023",
    "designName": "Floral Border V3",
    "cutableWidth": 42.0,
    "costPerMeter": 25.0,
    "supplier": {
      "id": "supplier-xyz",
      "code": "SUPP-001",
      "name": "ABC Embroidery Works"
    }
  }
}
```

### Width Impact

**Key Concept:** Embroidery reduces cuttable width.

**Example:**
- Plain Fabric: 44" finished width → 42" cuttable (2" shrinkage buffer)
- With Embroidery: 42" → 40" cuttable (2" lost to embroidery margins)

**Field Mapping:**
- `finishedWidth` (fabric_stock) - Full fabric width before cutting
- `cutableWidth` (embroidery_master) - Width available for pattern placement after embroidery
- CAD planning uses `cutableWidth` for marker efficiency

---

## 10. Embroidery Send-Out Process

### Database Schema

```prisma
model embroidery_send_out {
  id String @id

  // Source
  sourceFabricStockId  String       // Plain fabric being sent
  sourceFabricStock    fabric_stock @relation("EmbroiderySourceStock", ...)

  // Embroidery Design
  embroideryId String
  embroidery   embroidery_master @relation(...)

  // Supplier (embroidery vendor)
  supplierId String
  supplier   suppliers @relation(...)

  // Quantity Tracking
  quantitySent     Decimal  // Meters sent
  quantityReceived Decimal? // Meters received back
  quantityDamaged  Decimal? // Meters damaged/rejected
  unit             String   @default("meters")

  // Width Tracking
  sentFinishedWidth    Decimal  // Finished width when sent
  receivedCutableWidth Decimal? // Cuttable width after embroidery

  // Dates
  sendDate           DateTime
  expectedReturnDate DateTime?
  actualReturnDate   DateTime?

  // Cost
  agreedRate    Decimal   // Agreed rate per meter
  actualCost    Decimal?  // Final cost after receipt
  invoiceNumber String?
  invoiceDate   DateTime?

  // Status
  status  String  @default("SENT") // SENT, IN_PROGRESS, RECEIVED, CANCELLED
  remarks String?

  // Result Stock (created when received)
  resultFabricStockId String?       @unique
  resultFabricStock   fabric_stock? @relation("EmbroideryResultStock", ...)

  // Context
  forStyleId String?
  forOrderId String?
}
```

### Workflow: Send Out

```typescript
// Service: embroidery-stock.service.ts

async sendOut(data: SendOutDTO) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify source stock exists and has enough quantity
    const sourceStock = await tx.fabric_stock.findUnique({
      where: { id: data.sourceFabricStockId },
    });

    const availableQty = parseFloat(sourceStock.quantityAvailable.toString());
    if (availableQty < data.quantitySent) {
      throw new Error(`Insufficient stock. Available: ${availableQty}`);
    }

    // 2. Deduct from source stock
    await tx.fabric_stock.update({
      where: { id: data.sourceFabricStockId },
      data: {
        quantityAvailable: { decrement: data.quantitySent },
      },
    });

    // 3. Create stock transaction (deduction)
    await tx.fabric_stock_transaction.create({
      data: {
        stockId: data.sourceFabricStockId,
        transactionType: 'EMBROIDERY_SEND_OUT',
        quantity: new Decimal(data.quantitySent),
        costPerUnit: sourceStock.weightedAvgCost,
        notes: `Sent for embroidery: ${embroidery.designName}`,
        createdById: data.createdById,
      },
    });

    // 4. Create send-out record
    const sendOut = await tx.embroidery_send_out.create({
      data: {
        sourceFabricStockId: data.sourceFabricStockId,
        embroideryId: data.embroideryId,
        supplierId: data.supplierId,
        quantitySent: data.quantitySent,
        sentFinishedWidth: data.sentWidth,
        sendDate: data.sendDate,
        expectedReturnDate: data.expectedReturnDate,
        agreedRate: data.agreedRate,
        forStyleId: data.forStyleId,
        forOrderId: data.forOrderId,
        status: 'SENT',
        createdById: data.createdById,
      },
    });

    return sendOut;
  });
}
```

### API: Send Out for Embroidery

```bash
curl -X POST http://localhost:5000/api/embroidery-stock/send-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sourceFabricStockId": "stock-123",
    "embroideryId": "emb-456",
    "supplierId": "supplier-789",
    "quantitySent": 100.0,
    "sentWidth": 44.0,
    "sendDate": "2025-01-12",
    "expectedReturnDate": "2025-01-19",
    "agreedRate": 25.00,
    "forStyleId": "style-abc",
    "forOrderId": "order-xyz",
    "remarks": "Rush order - 7 day turnaround"
  }'
```

**Response:**

```json
{
  "id": "send-out-uuid",
  "sourceFabricStock": {
    "id": "stock-123",
    "fabricMaster": {
      "fabricName": "Cotton Poplin White",
      "finishedWidth": 44.0
    },
    "quantityAvailable": 400.0
  },
  "embroidery": {
    "embroideryCode": "EMB-202512-0023",
    "designName": "Floral Border V3"
  },
  "quantitySent": 100.0,
  "sentFinishedWidth": 44.0,
  "agreedRate": 25.0,
  "status": "SENT"
}
```

---

## 11. Embroidery Stock Management

### Workflow: Receive Back

```typescript
// Service: embroidery-stock.service.ts

async receive(data: ReceiveDTO) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get send-out record
    const sendOut = await tx.embroidery_send_out.findUnique({
      where: { id: data.sendOutId },
      include: { sourceFabricStock: true, embroidery: true },
    });

    if (sendOut.status === 'RECEIVED' || sendOut.status === 'CANCELLED') {
      throw new Error(`Send-out is already ${sendOut.status.toLowerCase()}`);
    }

    // 2. Calculate costs
    const fabricCostPerMeter = parseFloat(sourceStock.weightedAvgCost.toString());
    const embroideryCostPerMeter = data.actualCost
      ? data.actualCost / data.quantityReceived
      : parseFloat(sendOut.agreedRate.toString());
    const totalCostPerMeter = fabricCostPerMeter + embroideryCostPerMeter;

    // 3. Create NEW embroidered fabric stock
    const embroideredStock = await tx.fabric_stock.create({
      data: {
        fabricId: sourceStock.fabricId,
        finishedWidth: parseFloat(sendOut.sentFinishedWidth.toString()),
        cutableWidth: data.receivedWidth,
        embroideryId: sendOut.embroideryId,
        quantityAvailable: data.quantityReceived,
        quantityReserved: 0,
        quantityConsumed: 0,
        unit: sourceStock.unit,
        procurementId: sourceStock.procurementId,
        originStyleId: sendOut.forStyleId || sourceStock.originStyleId,
        originOrderId: sendOut.forOrderId || sourceStock.originOrderId,
        status: 'AVAILABLE',
        stockType: 'EMBROIDERED',
        weightedAvgCost: totalCostPerMeter,
        purchaseCost: totalCostPerMeter,
        qualityGrade: data.qualityGrade || 'A',
        warehouseLocation: data.warehouseLocation,
        receivedDate: data.actualReturnDate,
        createdById: data.createdById,
      },
    });

    // 4. Create stock transaction (receipt)
    await tx.fabric_stock_transaction.create({
      data: {
        stockId: embroideredStock.id,
        transactionType: 'EMBROIDERY_RECEIPT',
        quantity: new Decimal(data.quantityReceived),
        referenceType: 'EMBROIDERY_SEND_OUT',
        referenceId: sendOut.id,
        costPerUnit: new Decimal(totalCostPerMeter),
        notes: `Received from embroidery: ${embroidery.designName}`,
        createdById: data.createdById,
      },
    });

    // 5. Update send-out record
    const totalReceived = data.quantityReceived + (data.quantityDamaged || 0);
    const newStatus = totalReceived >= quantitySent ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

    await tx.embroidery_send_out.update({
      where: { id: data.sendOutId },
      data: {
        quantityReceived: data.quantityReceived,
        quantityDamaged: data.quantityDamaged || 0,
        receivedCutableWidth: data.receivedWidth,
        actualReturnDate: data.actualReturnDate,
        actualCost: data.actualCost || data.quantityReceived * embroideryCostPerMeter,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        status: newStatus,
        resultFabricStockId: embroideredStock.id,
      },
    });

    return updatedSendOut;
  });
}
```

### API: Receive Embroidered Fabric

```bash
curl -X POST http://localhost:5000/api/embroidery-stock/receive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sendOutId": "send-out-uuid",
    "quantityReceived": 98.0,
    "quantityDamaged": 2.0,
    "receivedWidth": 40.0,
    "actualReturnDate": "2025-01-19",
    "actualCost": 2450.00,
    "invoiceNumber": "INV-2025-001",
    "invoiceDate": "2025-01-19",
    "qualityGrade": "A",
    "warehouseLocation": "WH-A-RACK-12",
    "remarks": "Good quality embroidery, 2m damaged during transport"
  }'
```

**Response:**

```json
{
  "id": "send-out-uuid",
  "sourceFabricStock": {
    "fabricName": "Cotton Poplin White",
    "finishedWidth": 44.0
  },
  "resultFabricStock": {
    "id": "stock-new-uuid",
    "fabricName": "Cotton Poplin White",
    "finishedWidth": 44.0,
    "cutableWidth": 40.0,
    "stockType": "EMBROIDERED",
    "quantityAvailable": 98.0,
    "weightedAvgCost": 85.0,
    "embroidery": {
      "embroideryCode": "EMB-202512-0023",
      "designName": "Floral Border V3"
    }
  },
  "quantitySent": 100.0,
  "quantityReceived": 98.0,
  "quantityDamaged": 2.0,
  "status": "RECEIVED"
}
```

### Stock Costing

**Embroidered Fabric Cost = Plain Fabric Cost + Embroidery Cost**

**Example:**
- Plain fabric cost: ₹60/meter
- Embroidery cost: ₹25/meter
- **Total embroidered fabric cost: ₹85/meter**

This cost is stored in `fabric_stock.weightedAvgCost` for the new embroidered stock record.

---

## 12. CAD Embroidery Placement

### Database Schema

```prisma
/// CAD for embroidery parts (separate from main body CAD)
model embroidery_part_cad {
  id               String  @id
  styleFabricId    String  // Which style fabric has embroidery
  fabricWidthCadId String? // Selected width for embroidery calculation
  embroideryId     String? // Which embroidery design

  // CAD Values
  cadMeters         Decimal? // Embroidery fabric consumption per piece
  cadYards          Decimal?
  cadWastagePercent Decimal  @default(5)
  layerMarginMeters Decimal?
  piecesPerMarker   Int?
  markerEfficiency  Decimal?
  printDirection    PrintDirection @default(TWO_WAY)

  isApproved Boolean @default(false)
  notes      String?

  // Relations
  styleFabric    style_fabrics @relation(...)
  fabricWidthCad fabric_width_cad? @relation(...)
  embroidery     embroidery_master? @relation(...)
  sizeBreakdowns embroidery_cad_size_breakdown[]
}

/// Size-wise piece counts for embroidery CAD
model embroidery_cad_size_breakdown {
  id              String @id
  embroideryCadId String
  sizeName        String // "S", "M", "L"
  sizeId          String?
  quantity        Int    // Pieces of this size

  embroideryCad embroidery_part_cad @relation(...)
}
```

### Use Case

**Scenario:** Shirt with embroidered collar and cuffs.

**Setup:**
1. Main Body: Plain fabric, standard CAD (e.g., 1.2m per piece)
2. Collar & Cuffs: Embroidered fabric, separate CAD (e.g., 0.3m per piece)

**Workflow:**

```
1. Create Style Fabric for Main Body
   └─ fabricId: Cotton Poplin White
   └─ embroideryId: NULL
   └─ Standard CAD: 1.2m per piece

2. Create Style Fabric for Collar & Cuffs
   └─ fabricId: Same fabric (Cotton Poplin White)
   └─ embroideryId: EMB-202512-0023 (Floral Border)
   └─ Embroidery CAD: 0.3m per piece

3. CAD Calculation for Embroidered Parts
   └─ Uses fabricWidthCad with cutableWidth from embroidery_master
   └─ Separate size breakdown for embroidered parts
```

### API: Create Embroidery CAD

```bash
curl -X POST http://localhost:5000/api/styles/{styleId}/fabrics/{styleFabricId}/embroidery-cad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fabricWidthCadId": "cad-width-uuid",
    "embroideryId": "emb-456",
    "cadMeters": 0.3,
    "cadWastagePercent": 5.0,
    "piecesPerMarker": 50,
    "markerEfficiency": 85.0,
    "printDirection": "TWO_WAY",
    "sizeBreakdowns": [
      { "sizeName": "S", "sizeId": "size-s", "quantity": 200 },
      { "sizeName": "M", "sizeId": "size-m", "quantity": 300 },
      { "sizeName": "L", "sizeId": "size-l", "quantity": 250 },
      { "sizeName": "XL", "sizeId": "size-xl", "quantity": 150 },
      { "sizeName": "XXL", "sizeId": "size-xxl", "quantity": 100 }
    ],
    "notes": "Collar and cuffs only"
  }'
```

---

## 13. Lab Dips Process

### Database Schema

```prisma
model lab_dips {
  id           String @id
  labDipNumber String // LD-PRINT-202512-0001, LD-DYE-202512-0001
  processType  String // PRINTING or DYEING

  styleId  String
  fabricId String

  // For Printing
  designArtwork  String?
  printMethod    PrintMethod?     // ROTARY, FLATBELT, TABLE
  printChemistry PrintChemistry?  // PIGMENT, PROCIAN, DISCHARGE

  // For Dyeing
  targetColorId  String?
  colorReference String? // Pantone code

  millId String // Supplier/processor

  submissionDate DateTime
  expectedDate   DateTime?
  receivedDate   DateTime?

  status LabDipStatus @default(PENDING) // PENDING, SUBMITTED, APPROVED, REJECTED

  // Approval
  approvedById     String?
  approvalDate     DateTime?
  approvedSampleNo String?  // Which sample number was approved (e.g., "Sample 3")
  rejectionReason  String?
  colorMatchRating String?  // Excellent, Good, Acceptable

  remarks String?

  // Relations
  style       styles        @relation(...)
  fabric      fabric_master @relation(...)
  targetColor color_master? @relation(...)
  mill        suppliers     @relation(...)
  jobWorkOrders job_work_orders[] // Link to actual job work
}
```

### Workflow

```
1. Request Lab Dip
   └─ Submit fabric swatch to mill/processor
   └─ For DYEING: provide Pantone color reference
   └─ For PRINTING: provide design artwork

2. Mill Submits Samples
   └─ Usually 3-5 samples with slight variations
   └─ Each sample numbered (Sample 1, Sample 2, etc.)

3. Internal Review
   └─ Check color match, print quality
   └─ Update status: SUBMITTED

4. Buyer Approval
   └─ Buyer selects approved sample number
   └─ colorMatchRating: "Excellent", "Good", "Acceptable"
   └─ Status: APPROVED or REJECTED

5. If APPROVED → Create Job Work Order
   └─ Use approved lab dip for bulk production
   └─ Link job_work_order to lab_dip

6. If REJECTED → Request New Lab Dip
   └─ Create new lab_dip record
   └─ Provide feedback/corrections to mill
```

### API: Create Lab Dip Request

**For Dyeing:**

```bash
curl -X POST http://localhost:5000/api/lab-dips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "processType": "DYEING",
    "styleId": "style-abc",
    "fabricId": "fabric-xyz",
    "targetColorId": "color-navy",
    "colorReference": "Pantone 19-4028 TPG",
    "millId": "supplier-mill-123",
    "submissionDate": "2025-01-12",
    "expectedDate": "2025-01-16",
    "remarks": "Navy color for summer collection"
  }'
```

**For Printing:**

```bash
curl -X POST http://localhost:5000/api/lab-dips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "processType": "PRINTING",
    "styleId": "style-abc",
    "fabricId": "fabric-xyz",
    "designArtwork": "https://cdn.example.com/artwork/floral-print.pdf",
    "printMethod": "ROTARY",
    "printChemistry": "PIGMENT",
    "millId": "supplier-print-456",
    "submissionDate": "2025-01-12",
    "expectedDate": "2025-01-18",
    "remarks": "4-color floral print, rotary screen"
  }'
```

### API: Approve Lab Dip

```bash
curl -X PATCH http://localhost:5000/api/lab-dips/{labDipId}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "approvedSampleNo": "Sample 3",
    "colorMatchRating": "Excellent",
    "remarks": "Perfect match to Pantone reference. Proceed with bulk."
  }'
```

---

## 14. API Reference

### Samples Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/samples` | Create new sample |
| GET | `/api/samples` | Get all samples (paginated, filtered) |
| GET | `/api/samples/{id}` | Get sample by ID |
| PATCH | `/api/samples/{id}` | Update sample |
| DELETE | `/api/samples/{id}` | Delete sample |
| POST | `/api/samples/{id}/measurements/actual` | Record actual measurements |
| POST | `/api/samples/{id}/send` | Mark sample as sent |
| POST | `/api/samples/{id}/receive` | Record buyer receipt |
| POST | `/api/samples/{id}/feedback` | Record buyer feedback |
| POST | `/api/samples/{id}/revision` | Create FIT sample revision |
| GET | `/api/samples/summary` | Get samples summary/stats |
| GET | `/api/samples/style/{styleId}/approval-gate` | Check approval gates |
| GET | `/api/samples/search` | Search samples (picker) |

### Embroidery Master Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/embroidery` | Create embroidery design |
| GET | `/api/embroidery` | Get all embroidery designs |
| GET | `/api/embroidery/{id}` | Get embroidery by ID |
| PATCH | `/api/embroidery/{id}` | Update embroidery design |
| DELETE | `/api/embroidery/{id}` | Delete embroidery design |
| GET | `/api/embroidery/search` | Search embroidery (picker) |

### Embroidery Stock Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/embroidery-stock/send-out` | Send fabric for embroidery |
| POST | `/api/embroidery-stock/receive` | Receive embroidered fabric |
| GET | `/api/embroidery-stock/send-outs` | Get all send-outs (filtered) |
| GET | `/api/embroidery-stock/send-outs/{id}` | Get send-out by ID |
| GET | `/api/embroidery-stock/style/{styleId}` | Get embroidered stock for style |
| GET | `/api/embroidery-stock/embroidery/{embroideryId}` | Get stock by embroidery design |
| POST | `/api/embroidery-stock/send-outs/{id}/cancel` | Cancel send-out (return to stock) |
| GET | `/api/embroidery-stock/pending` | Get overdue send-outs |
| GET | `/api/embroidery-stock/summary` | Get embroidery stock summary |

### Lab Dips Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lab-dips` | Create lab dip request |
| GET | `/api/lab-dips` | Get all lab dips (filtered) |
| GET | `/api/lab-dips/{id}` | Get lab dip by ID |
| PATCH | `/api/lab-dips/{id}` | Update lab dip |
| PATCH | `/api/lab-dips/{id}/approve` | Approve lab dip |
| PATCH | `/api/lab-dips/{id}/reject` | Reject lab dip |
| GET | `/api/lab-dips/style/{styleId}` | Get lab dips for style |

---

## 15. Frontend Integration

### Sample List Page

**Component:** `SampleListPage.tsx`

```typescript
const fetchSamples = async (filters: SampleFilters) => {
  const response = await fetch(
    `/api/samples?${new URLSearchParams({
      page: filters.page.toString(),
      limit: filters.limit.toString(),
      search: filters.search || '',
      sampleType: filters.sampleType || '',
      status: filters.status || '',
      customerId: filters.customerId || '',
      styleId: filters.styleId || '',
    })}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  return data; // { data: Sample[], pagination: { ... } }
};
```

### Sample Detail Page

**Component:** `SampleDetailPage.tsx`

```typescript
// Fetch sample with all nested data
const fetchSample = async (sampleId: string) => {
  const response = await fetch(`/api/samples/${sampleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { data } = await response.json();

  return {
    ...data,
    // Access nested data using camelCase (serialized by backend)
    customer: data.customer,
    style: data.style,
    measurements: data.measurements,
    colorways: data.colorways,
    sizeSets: data.sizeSets,
    relatedSamples: data.relatedSamples,
  };
};
```

### Record Actual Measurements

**Component:** `MeasurementForm.tsx`

```typescript
const recordActualMeasurements = async (
  sampleId: string,
  measurements: { id: string; actualValue: number }[]
) => {
  const response = await fetch(`/api/samples/${sampleId}/measurements/actual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ measurements }),
  });

  const { data } = await response.json();

  // Backend auto-calculates PASS/FAIL status
  return data.measurements; // Each has status: "PASS" or "FAIL"
};
```

### Embroidery Send-Out Form

**Component:** `EmbroiderySendOutForm.tsx`

```typescript
const sendForEmbroidery = async (formData: SendOutFormData) => {
  const response = await fetch('/api/embroidery-stock/send-out', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sourceFabricStockId: formData.stockId,
      embroideryId: formData.embroideryId,
      supplierId: formData.supplierId,
      quantitySent: formData.quantity,
      sentWidth: formData.width,
      sendDate: formData.sendDate,
      expectedReturnDate: formData.expectedReturnDate,
      agreedRate: formData.rate,
      forStyleId: formData.styleId,
      forOrderId: formData.orderId,
      remarks: formData.remarks,
    }),
  });

  const { data } = await response.json();
  return data; // Send-out record with status: "SENT"
};
```

---

## 16. Best Practices

### Sample Management

#### 1. Enforce Sequential Approval Gates

**Why:** Prevents bulk production with unapproved fit or colors.

**How:**
```typescript
// Frontend: Disable PP sample button until FIT approved
const canCreatePP = sampleApprovalGate.fitApproved;

// Backend: Validation service blocks creation
if (sampleType === 'PP_SAMPLE' && !fitApproved) {
  throw new Error('FIT Sample must be approved first');
}
```

#### 2. Track Measurement Tolerance

**Why:** Ensures samples meet specifications.

**How:**
- Define tolerance per measurement point (e.g., ±0.5 cm for chest, ±0.3 cm for sleeve)
- Auto-calculate PASS/FAIL status
- Generate measurement report: "12/15 measurements PASS"

#### 3. Version Control for FIT Samples

**Why:** Track revisions clearly (v1, v2, v3...).

**How:**
```typescript
// Generate versioned sample number
const version = existingFitSamples.length + 1;
const sampleNumber = `FIT-${styleCode}-v${version}`;

// Link revisions
const revisionOf = originalSampleId;
```

#### 4. Link Samples to Orders

**Why:** Trace which sample was approved for which order.

**How:**
- Use `order_samples` table for order-specific samples
- Link generic samples to style (for reuse across orders)

### Embroidery Management

#### 5. Track Width Impact

**Why:** Embroidery reduces cuttable width, affecting CAD efficiency.

**How:**
```typescript
// Store cutable width in embroidery master
embroideryMaster.cutableWidth = 40.0; // inches

// Use in CAD calculation
const availableWidth = embroidery
  ? embroideryMaster.cutableWidth
  : fabricStock.cutableWidth;
```

#### 6. Separate Stock for Embroidered Fabric

**Why:** Different cost, different width, different usage.

**How:**
- Plain fabric: `stock-123`, stockType: `PLAIN`, cutableWidth: 42"
- Embroidered fabric: `stock-456`, stockType: `EMBROIDERED`, cutableWidth: 40", embroideryId: `emb-789`

#### 7. Cost Accumulation

**Why:** Embroidered fabric cost = plain fabric + embroidery.

**How:**
```typescript
const fabricCost = 60; // ₹/meter
const embroideryCost = 25; // ₹/meter
const totalCost = fabricCost + embroideryCost; // ₹85/meter

// Store in new embroidered stock
embroideredStock.weightedAvgCost = totalCost;
```

#### 8. Track Damaged Quantities

**Why:** Monitor quality and losses.

**How:**
```typescript
// Record damaged quantity on receipt
receiveDTO.quantityDamaged = 2.0; // meters

// Calculate recovery rate
const recoveryRate = (quantityReceived / quantitySent) * 100; // 98%
```

### Lab Dips

#### 9. Link Lab Dips to Job Work

**Why:** Ensure bulk production uses approved color/print.

**How:**
```prisma
model job_work_orders {
  labDipId String // Link to approved lab dip
  labDip   lab_dips @relation(...)
}
```

#### 10. Sample Numbering for Lab Dips

**Why:** Track which sample was approved (e.g., "Sample 3 of 5").

**How:**
```typescript
// Approval record
labDip.approvedSampleNo = "Sample 3";
labDip.colorMatchRating = "Excellent";
```

### General

#### 11. Admin Override Logging

**Why:** Audit trail for bypassed gates.

**How:**
```typescript
// Log every override
await prisma.stage_transition_overrides.create({
  data: {
    blockType: 'SAMPLE_CREATION',
    sampleId: sample.id,
    overrideReason: reason,
    overriddenById: userId,
  },
});
```

#### 12. Soft Deletion for Samples

**Why:** Preserve history, prevent conflicts in numbering.

**How:**
```prisma
model samples {
  isActive Boolean @default(true)
}

// Soft delete
await prisma.samples.update({
  where: { id },
  data: { isActive: false },
});
```

#### 13. Date Tracking

**Why:** Monitor lead times and delays.

**Key Dates:**
- `requestDate` - When sample was requested
- `requiredDate` - Deadline
- `sentDate` - When sent to buyer
- `receivedDate` - When buyer received
- `feedbackDate` - When buyer provided feedback
- `completionDate` - When sample was completed internally

#### 14. Search & Filtering

**Why:** Quickly find samples by multiple criteria.

**Common Filters:**
- Sample type (FIT, PP, Size Set)
- Status (APPROVED, PENDING, REJECTED)
- Customer
- Style
- Date range
- Pending approval (SUBMITTED, SENT, FEEDBACK_PENDING)

#### 15. Notifications & Alerts

**Why:** Proactive management of overdue samples.

**Examples:**
- Sample overdue (requiredDate passed, not approved)
- Embroidery send-out overdue (expectedReturnDate passed, not received)
- Lab dip pending approval (submitted > 3 days ago)

---

## Summary

The Sample Management & Embroidery system provides:

✅ **5 Sample Types** with sequential approval gates (FIT → PP → Size Set)
✅ **Measurement Tracking** with tolerance validation (PASS/FAIL)
✅ **Embroidery Workflow** from design to send-out to stock creation
✅ **Lab Dips** for color/print approval before bulk
✅ **CAD Integration** for embroidery placement and consumption
✅ **Stock Management** with separate embroidered fabric stock
✅ **Cost Tracking** with accumulation (fabric + embroidery)
✅ **Admin Overrides** with audit logging
✅ **Complete API** for all workflows

**Cross-References:**
- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Work order creation after sample approval
- [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) - Fabric stock for embroidery send-out
- [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) - Embroidery cost in costing calculations
- [ORDER_PROCUREMENT_GUIDE.md](ORDER_PROCUREMENT_GUIDE.md) - Order samples linking

For questions or issues, refer to [PROJECT_BIBLE.md](PROJECT_BIBLE.md) or contact the development team.
