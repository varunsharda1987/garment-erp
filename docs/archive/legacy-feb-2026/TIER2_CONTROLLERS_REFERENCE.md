# Tier 2 Controllers Reference

**Version:** 1.0
**Last Updated:** February 6, 2026

Medium-impact controllers for specialized operations.

---

## Table of Contents

1. [Processing Controllers](#1-processing-controllers)
2. [Stock Management Controllers](#2-stock-management-controllers)
3. [Sample Controller](#3-sample-controller)
4. [Trim Master Controllers](#4-trim-master-controllers)

---

## 1. Processing Controllers

External processing services: printing, dyeing, embroidery, etc.

### 1.1 Printing Controller

**Controller:** `backend/src/controllers/printing.controller.ts`
**Routes:** `backend/src/routes/printing.routes.ts`

**Key Endpoints:**
- `GET /api/printing/batches` - Get all printing batches
- `POST /api/printing/batches` - Create printing batch
- `POST /api/printing/batches/:id/send-out` - Send to printer
- `POST /api/printing/batches/:id/receive` - Receive from printer
- `GET /api/printing/processors` - Get available printers

**Workflow:** Create batch → Send to processor → Track status → Receive & QC

### 1.2 Dyeing Controller

**Controller:** `backend/src/controllers/dyeing.controller.ts`
**Routes:** `backend/src/routes/dyeing.routes.ts`

**Key Endpoints:**
- `GET /api/dyeing/batches` - Get all dyeing batches
- `POST /api/dyeing/batches` - Create dyeing batch
- `POST /api/dyeing/batches/:id/send-out` - Send to dyer
- `POST /api/dyeing/batches/:id/receive` - Receive from dyer
- `POST /api/dyeing/batches/:id/lab-dip` - Create lab dip request

**Workflow:** Lab dip approval → Create batch → Send fabric → Dyeing → Receive & match color

### 1.3 Embroidery Controller

**Controller:** `backend/src/controllers/embroidery.controller.ts`
**Routes:** `backend/src/routes/embroidery.routes.ts`

**Key Endpoints:**
- `GET /api/embroidery/send-out` - Get all embroidery send-outs
- `POST /api/embroidery/send-out` - Create send-out
- `POST /api/embroidery/send-out/:id/dispatch` - Send to embroiderer
- `POST /api/embroidery/send-out/:id/receive` - Receive from embroiderer
- `GET /api/embroidery/processors` - Get embroidery processors

**Workflow:** Send garments → Embroidery → Receive → QC → Update stock

### 1.4 Processing Batch Controller

**Controller:** `backend/src/controllers/processingBatch.controller.ts`
**Routes:** `backend/src/routes/processingBatch.routes.ts`

**Unified processing workflow for all external services**

**Key Endpoints:**
- `GET /api/processing-batches` - Get all batches (any type)
- `POST /api/processing-batches` - Create batch
- `PATCH /api/processing-batches/:id/status` - Update status
- `GET /api/processing-batches/summary` - Processing summary

**Status Flow:**
```
PENDING → SENT_TO_PROCESSOR → IN_PROCESS → RECEIVED → COMPLETED
```

---

## 2. Stock Management Controllers

### 2.1 Material Stock Controller

**Controller:** `backend/src/controllers/material-stock.controller.ts`
**Routes:** Backend routes handle material stock CRUD

**Key Operations:**
- View stock levels by material + warehouse
- Stock adjustments (add, remove, transfer)
- Low stock alerts
- Stock valuation (FIFO/LIFO/Weighted Average)

**Schema:**
```prisma
model material_stock {
  materialId   String
  warehouseId  String
  quantity     Decimal
  unit         String
  lastUpdated  DateTime
}
```

### 2.2 Fabric Stock Controller

**Controller:** `backend/src/controllers/fabric-stock.controller.ts`
**Routes:** `backend/src/routes/fabric-stock.routes.ts`

**Key Endpoints:**
- `GET /api/fabric-stock` - Get all fabric stock
- `GET /api/fabric-stock/:id` - Get fabric stock details
- `POST /api/fabric-stock` - Add fabric stock (from GRN)
- `PATCH /api/fabric-stock/:id` - Update stock quantity
- `POST /api/fabric-stock/:id/allocate` - Reserve for cutting

**Features:**
- Width-based stock matching (±0.5" tolerance)
- Roll tracking with roll numbers
- Color and finish variants
- Fabric aging alerts

### 2.3 Embroidery Stock Controller

**Controller:** `backend/src/controllers/embroidery-stock.controller.ts`
**Routes:** `backend/src/routes/embroidery-stock.routes.ts`

**Key Endpoints:**
- `GET /api/embroidery-stock` - Get embroidery stock
- `POST /api/embroidery-stock/receive` - Receive from embroiderer
- `POST /api/embroidery-stock/issue` - Issue for stitching

**Workflow:** Receive embroidered pieces → Store → Issue to stitching line

### 2.4 Lace Stock Controller

**Controller:** `backend/src/controllers/laceStock.controller.ts`
**Routes:** Backend routes handle lace stock operations

**Key Operations:**
- Lace roll tracking
- Color and width variants
- Issue to cutting/stitching
- Wastage tracking

---

## 3. Sample Controller

**Controller:** `backend/src/controllers/sample.controller.ts`
**Routes:** `backend/src/routes/sample.routes.ts`

### Sample Types

| Type | Purpose | Approval Required |
|------|---------|-------------------|
| FIT | Size and fit approval | Yes (before production) |
| SIZE_SET | Complete size range | Yes |
| PROTO | Initial prototype | Optional |
| PRODUCTION | Pre-production sample | Yes (quality gate) |
| SHIPMENT | Final shipping sample | Optional |

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/samples` | Get all samples (filterable by type, style, status) |
| GET | `/api/samples/:id` | Get sample by ID |
| POST | `/api/samples` | Create sample request |
| PATCH | `/api/samples/:id/status` | Update status |
| POST | `/api/samples/:id/approve` | Approve sample |
| POST | `/api/samples/:id/reject` | Reject with comments |
| GET | `/api/samples/approval-gate/:styleId` | Check if style has approved samples |

### Sample Approval Gate

**Critical for production:**
```typescript
// Before starting production
const approvalGate = await checkSampleApprovalGate(styleId);

if (!approvalGate.fitSampleApproved) {
  throw new Error('FIT sample not approved - cannot start production');
}

if (!approvalGate.productionSampleApproved) {
  throw new Error('PRODUCTION sample not approved - cannot start bulk');
}
```

### Status Flow

```
REQUESTED → IN_PROGRESS → SENT → RECEIVED
         → APPROVED | REJECTED | MODIFICATION_REQUIRED
         → PRODUCTION_READY
```

### Use Cases

**1. Sample Request Workflow:**
```typescript
// Create FIT sample request
const sample = await createSample({
  styleId: style.id,
  sampleType: 'FIT',
  quantity: 1,
  sizeId: 'M-size-uuid',
  requestedBy: merchandiserId,
  requiredDate: addDays(new Date(), 7),
  remarks: 'Please check sleeve length and shoulder width',
});

// Production creates sample
await updateSampleStatus(sample.id, {
  status: 'IN_PROGRESS',
  assignedTo: sampleMakerId,
});

// Send to customer
await updateSampleStatus(sample.id, {
  status: 'SENT',
  sentDate: new Date(),
  courierDetails: 'DHL - AWB123456',
});

// Customer feedback
await approveSample(sample.id, {
  approvedBy: customerId,
  approvedDate: new Date(),
  comments: 'Approved - proceed with production',
});
```

**2. Size Set Approval:**
```typescript
// Create size set (all sizes)
const sizeSet = await createSample({
  styleId: style.id,
  sampleType: 'SIZE_SET',
  quantity: 5,  // S, M, L, XL, XXL
  sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  requestedBy: merchandiserId,
});

// All sizes must be approved
for (const size of sizeSet.sizes) {
  await approveSampleSize(sizeSet.id, size);
}

// Once all approved, mark as production ready
await markProductionReady(sizeSet.id);
```

---

## 4. Trim Master Controllers

Standard CRUD operations for trim materials.

### Common Pattern

All trim controllers follow this structure:

**Endpoints:**
- `POST /api/{trim-type}` - Create trim
- `GET /api/{trim-type}` - Get all (paginated, searchable)
- `GET /api/{trim-type}/:id` - Get by ID
- `PUT /api/{trim-type}/:id` - Update trim
- `DELETE /api/{trim-type}/:id` - Delete/deactivate trim

### 4.1 Button Controller

**Routes:** `backend/src/routes/button.routes.ts`

**Fields:**
- Button code, name, description
- Size (mm or line)
- Material (plastic, metal, wood, etc.)
- Color, finish
- Supplier, unit price
- Minimum order quantity

### 4.2 Zipper Controller

**Routes:** `backend/src/routes/zipper.routes.ts`

**Fields:**
- Zipper code, name
- Type (metal, plastic, coil, invisible)
- Length (inches)
- Teeth size
- Color, finish
- Open-end vs closed-end

### 4.3 Label Controller

**Routes:** `backend/src/routes/label.routes.ts`

**Types:**
- Main label (brand tag)
- Care label (washing instructions)
- Size label
- Hang tag
- Price tag

**Fields:**
- Label code, description
- Type, material (woven, printed, etc.)
- Dimensions
- Print type, colors
- Supplier

### 4.4 Thread Controller

**Routes:** `backend/src/routes/thread.routes.ts`

**Fields:**
- Thread code, name
- Material (polyester, cotton, nylon)
- Ply (2-ply, 3-ply, etc.)
- Color, shade
- Cone size (grams)
- Tex/denier count

**Features:**
- Ply conversion (2-ply → 3-ply)
- Cone to meter conversion
- Color matching with fabric

### 4.5 Elastic Controller

**Routes:** `backend/src/routes/elastic.routes.ts`

**Fields:**
- Elastic code, name
- Width (mm)
- Type (woven, knitted, rubber)
- Stretch percentage
- Color
- Application (waistband, sleeve, etc.)

### 4.6 Packaging Controller

**Routes:** `backend/src/routes/packaging.routes.ts`

**Types:**
- Poly bags
- Cartons
- Inner boxes
- Hangers
- Tissue paper
- Stickers/barcodes

**Fields:**
- Packaging code, description
- Type, material
- Dimensions
- Weight capacity
- Unit price

### 4.7 Machine Part Controller

**Routes:** `backend/src/routes/machine-part.routes.ts`

**Categories:**
- Sewing machine parts (needles, bobbins, presser feet)
- Cutting machine parts (blades, belts)
- Pressing equipment parts
- Maintenance items (oil, grease)

### 4.8 Generic Trim Controller

**Routes:** `backend/src/routes/generic-trim.routes.ts`

**Purpose:** Catch-all for miscellaneous trims not fitting other categories

**Examples:**
- Ribbons
- Buckles
- Drawstrings
- Eyelets
- Velcro
- Shoulder pads
- Interfacing

---

## Quick Reference

### Processing Status Codes

| Status | Description |
|--------|-------------|
| PENDING | Batch created, not yet sent |
| SENT_TO_PROCESSOR | Material sent to external processor |
| IN_PROCESS | Processing in progress |
| RECEIVED | Processed material received back |
| QC_PENDING | Quality check pending |
| QC_PASSED | Quality check passed |
| QC_FAILED | Quality issues found |
| COMPLETED | Batch complete and accepted |

### Stock Alert Thresholds

| Material Type | Alert Level | Critical Level |
|---------------|-------------|----------------|
| Fabric | < 100m | < 50m |
| Thread | < 10 cones | < 5 cones |
| Buttons | < 1000 pcs | < 500 pcs |
| Zippers | < 100 pcs | < 50 pcs |
| Labels | < 500 pcs | < 200 pcs |

### Sample Approval Requirements

| Sample Type | Required For | Approver |
|-------------|-------------|----------|
| FIT | Production start | Customer + Merchandiser |
| SIZE_SET | Full size range | Customer |
| PRODUCTION | Bulk production | Customer + QC |
| PROTO | Concept approval | Internal team |
| SHIPMENT | Final reference | Customer (optional) |

---

## Related Documentation

- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Main production workflow
- [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) - Detailed stock operations
- [MATERIALS_MASTER_GUIDE.md](MATERIALS_MASTER_GUIDE.md) - Material master data
- [SAMPLE_EMBROIDERY_GUIDE.md](SAMPLE_EMBROIDERY_GUIDE.md) - Detailed sample workflow

---

**Maintained By:** Kashaya Fabs Development Team
