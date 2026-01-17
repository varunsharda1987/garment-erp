# Dispatch & Logistics Guide

> **Complete Shipping, Delivery & Transport Documentation**
> **Last Updated:** January 12, 2026
> **Version:** 1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Delivery Notes (Dispatch)](#2-delivery-notes-dispatch)
3. [Advanced Shipping Notice (ASN)](#3-advanced-shipping-notice-asn)
4. [Proof of Delivery (POD)](#4-proof-of-delivery-pod)
5. [Transport Management](#5-transport-management)
6. [Transfer Slips](#6-transfer-slips)
7. [API Reference](#7-api-reference)
8. [Workflow Diagrams](#8-workflow-diagrams)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The Dispatch & Logistics module handles the complete shipment lifecycle from finished goods to customer delivery.

### Key Components

| Component | Purpose | Table |
|-----------|---------|-------|
| Delivery Notes | Dispatch instructions | `delivery_notes` |
| ASN | Advance shipping notification | `advanced_shipping_notices` |
| POD | Delivery confirmation | `proof_of_delivery` |
| Transport | Carrier management | `transporters`, `vehicles` |
| Transfer Slips | Inter-location transfers | `transfer_slips` |

### Key Files

| Type | Path |
|------|------|
| Routes | `backend/src/routes/deliveryNote.routes.ts` |
| Routes | `backend/src/routes/asn.routes.ts` |
| Routes | `backend/src/routes/pod.routes.ts` |
| Routes | `backend/src/routes/transport.routes.ts` |
| Routes | `backend/src/routes/transferSlip.routes.ts` |
| Controller | `backend/src/controllers/deliveryNote.controller.ts` |
| Controller | `backend/src/controllers/asn.controller.ts` |
| Controller | `backend/src/controllers/pod.controller.ts` |
| Pages | `frontend/src/pages/DeliveryNoteList.tsx` |
| Pages | `frontend/src/pages/DeliveryNoteForm.tsx` |
| Pages | `frontend/src/pages/ASNList.tsx` |
| Pages | `frontend/src/pages/PODCapture.tsx` |

### Workflow Overview

```
Finished Goods → Delivery Note → ASN → Shipment → POD → Complete
       ↓
  Pack List Generation
       ↓
  Invoice Attachment
       ↓
  Transporter Assignment
```

---

## 2. Delivery Notes (Dispatch)

### Purpose
Create dispatch instructions for shipping finished goods to customers.

### Database Model: `delivery_notes`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| deliveryNoteNumber | String | Auto-generated (DN-YYYY-NNNNN) |
| orderId | UUID | Reference to sales order |
| customerId | UUID | Customer receiving goods |
| warehouseId | UUID | Source warehouse |
| dispatchDate | DateTime | Planned dispatch date |
| status | Enum | DRAFT, CONFIRMED, DISPATCHED, DELIVERED, CANCELLED |
| totalQuantity | Int | Total pieces being shipped |
| totalCartons | Int | Number of cartons |
| grossWeight | Decimal | Total weight (kg) |
| netWeight | Decimal | Net weight (kg) |
| remarks | String | Dispatch notes |

### Delivery Note Items: `delivery_note_items`

| Field | Type | Description |
|-------|------|-------------|
| deliveryNoteId | UUID | Parent delivery note |
| styleId | UUID | Style being shipped |
| colorId | UUID | Color variant |
| sizeId | UUID | Size variant |
| quantity | Int | Pieces in this line |
| cartonNumber | String | Carton identification |

### Status Flow

```
DRAFT → CONFIRMED → DISPATCHED → DELIVERED
                         ↓
                    CANCELLED (if issues)
```

### API Endpoints

```
POST   /api/delivery-notes              - Create delivery note
GET    /api/delivery-notes              - List all delivery notes
GET    /api/delivery-notes/:id          - Get delivery note details
PUT    /api/delivery-notes/:id          - Update delivery note
DELETE /api/delivery-notes/:id          - Delete delivery note (draft only)
POST   /api/delivery-notes/:id/confirm  - Confirm delivery note
POST   /api/delivery-notes/:id/dispatch - Mark as dispatched
POST   /api/delivery-notes/:id/deliver  - Mark as delivered
GET    /api/delivery-notes/by-order/:orderId - Get by order
GET    /api/delivery-notes/pending      - Pending dispatches
```

### Packing List Generation

When a delivery note is confirmed, the system generates:
- Carton-wise packing list
- Style/color/size breakdown per carton
- Weight and dimension details
- Barcode labels for tracking

### Invoice Integration

Delivery notes can be linked to:
- Proforma invoices (before dispatch)
- Commercial invoices (at dispatch)
- GST invoices (with tax calculations)

---

## 3. Advanced Shipping Notice (ASN)

### Purpose
Notify customers about incoming shipments before arrival.

### Database Model: `advanced_shipping_notices`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| asnNumber | String | Auto-generated (ASN-YYYY-NNNNN) |
| deliveryNoteId | UUID | Reference to delivery note |
| customerId | UUID | Receiving customer |
| expectedDeliveryDate | DateTime | Expected arrival |
| transporterId | UUID | Carrier handling shipment |
| trackingNumber | String | Carrier tracking ID |
| status | Enum | DRAFT, SENT, ACKNOWLEDGED, IN_TRANSIT, DELIVERED |
| sentAt | DateTime | When ASN was sent |
| acknowledgedAt | DateTime | When customer acknowledged |

### ASN Items

Inherited from delivery note items with additional tracking:
- Serial numbers
- Batch/lot numbers
- Expiry dates (if applicable)

### Status Flow

```
DRAFT → SENT → ACKNOWLEDGED → IN_TRANSIT → DELIVERED
```

### API Endpoints

```
POST   /api/asn                    - Create ASN
GET    /api/asn                    - List all ASNs
GET    /api/asn/:id                - Get ASN details
PUT    /api/asn/:id                - Update ASN
POST   /api/asn/:id/send           - Send ASN to customer
POST   /api/asn/:id/acknowledge    - Customer acknowledges
POST   /api/asn/:id/in-transit     - Mark in transit
GET    /api/asn/by-customer/:customerId - ASNs by customer
GET    /api/asn/pending            - Pending ASNs
```

### Customer Notification

When ASN is sent:
- Email notification with shipment details
- PDF attachment with packing list
- Tracking link for shipment status
- Expected delivery date

---

## 4. Proof of Delivery (POD)

### Purpose
Capture delivery confirmation with signatures and photos.

### Database Model: `proof_of_delivery`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| deliveryNoteId | UUID | Reference to delivery note |
| asnId | UUID | Reference to ASN (optional) |
| receivedBy | String | Name of receiver |
| receivedAt | DateTime | Actual delivery time |
| signatureUrl | String | Digital signature image |
| photoUrls | String[] | Delivery photos |
| condition | Enum | GOOD, DAMAGED, PARTIAL |
| damageNotes | String | Damage description |
| shortageNotes | String | Shortage details |
| customerRemarks | String | Customer feedback |
| latitude | Decimal | GPS latitude |
| longitude | Decimal | GPS longitude |
| status | Enum | PENDING, CAPTURED, VERIFIED, DISPUTED |

### POD Items

| Field | Type | Description |
|-------|------|-------------|
| podId | UUID | Parent POD |
| deliveryNoteItemId | UUID | Line item reference |
| receivedQuantity | Int | Quantity received |
| damagedQuantity | Int | Damaged pieces |
| shortageQuantity | Int | Missing pieces |
| remarks | String | Item-specific notes |

### Status Flow

```
PENDING → CAPTURED → VERIFIED
                ↓
            DISPUTED (if issues)
```

### API Endpoints

```
POST   /api/pod                    - Create POD
GET    /api/pod                    - List all PODs
GET    /api/pod/:id                - Get POD details
PUT    /api/pod/:id                - Update POD
POST   /api/pod/:id/capture        - Capture POD (mobile)
POST   /api/pod/:id/verify         - Verify POD
POST   /api/pod/:id/dispute        - Raise dispute
GET    /api/pod/by-delivery-note/:dnId - Get POD by delivery note
GET    /api/pod/pending            - Pending POD captures
```

### Mobile POD Capture

The POD capture interface supports:
- Digital signature capture
- Photo upload (multiple)
- GPS location auto-capture
- Offline mode with sync
- Quantity verification per item
- Damage/shortage reporting

---

## 5. Transport Management

### Purpose
Manage transporters, vehicles, and shipment assignments.

### Database Model: `transporters`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Transporter company name |
| code | String | Short code (e.g., "DHL", "BLUEDART") |
| type | Enum | COURIER, FREIGHT, LOCAL, OWN |
| contactPerson | String | Primary contact |
| phone | String | Contact number |
| email | String | Contact email |
| gstNumber | String | GST registration |
| panNumber | String | PAN number |
| address | String | Business address |
| serviceAreas | String[] | Areas serviced |
| isActive | Boolean | Active status |

### Transporter Types

| Type | Description | Use Case |
|------|-------------|----------|
| COURIER | Express delivery services | Small parcels, urgent |
| FREIGHT | Bulk cargo carriers | Large shipments |
| LOCAL | Local delivery | Same-city dispatch |
| OWN | Company-owned vehicles | Regular routes |

### Vehicles: `vehicles`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| transporterId | UUID | Owner transporter |
| vehicleNumber | String | Registration number |
| vehicleType | Enum | TRUCK, VAN, TEMPO, BIKE |
| capacity | Decimal | Load capacity (kg) |
| driverName | String | Assigned driver |
| driverPhone | String | Driver contact |
| isAvailable | Boolean | Availability status |

### API Endpoints

```
# Transporters
POST   /api/transporters           - Create transporter
GET    /api/transporters           - List transporters
GET    /api/transporters/:id       - Get transporter details
PUT    /api/transporters/:id       - Update transporter
DELETE /api/transporters/:id       - Delete transporter
GET    /api/transporters/active    - Active transporters

# Vehicles
POST   /api/vehicles               - Create vehicle
GET    /api/vehicles               - List vehicles
GET    /api/vehicles/:id           - Get vehicle details
PUT    /api/vehicles/:id           - Update vehicle
GET    /api/vehicles/available     - Available vehicles
GET    /api/vehicles/by-transporter/:id - Vehicles by transporter
```

### Shipment Assignment

When assigning transport:
1. Select transporter based on service area
2. Assign available vehicle
3. Generate loading sheet
4. Update delivery note with transport details
5. Create ASN with tracking info

---

## 6. Transfer Slips

### Purpose
Handle inter-location inventory transfers (warehouse to warehouse).

### Database Model: `transfer_slips`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| transferNumber | String | Auto-generated (TRF-YYYY-NNNNN) |
| fromWarehouseId | UUID | Source warehouse |
| toWarehouseId | UUID | Destination warehouse |
| transferDate | DateTime | Transfer date |
| status | Enum | DRAFT, APPROVED, IN_TRANSIT, RECEIVED, CANCELLED |
| approvedBy | UUID | Approver user |
| approvedAt | DateTime | Approval timestamp |
| receivedBy | UUID | Receiver user |
| receivedAt | DateTime | Receipt timestamp |
| remarks | String | Transfer notes |

### Transfer Slip Items: `transfer_slip_items`

| Field | Type | Description |
|-------|------|-------------|
| transferSlipId | UUID | Parent transfer |
| materialType | Enum | FABRIC, TRIM, FINISHED_GOODS |
| materialId | UUID | Material/fabric/goods ID |
| quantity | Decimal | Quantity transferred |
| receivedQuantity | Decimal | Quantity received |
| unit | String | Unit of measure |
| remarks | String | Item notes |

### Status Flow

```
DRAFT → APPROVED → IN_TRANSIT → RECEIVED
                        ↓
                   CANCELLED
```

### API Endpoints

```
POST   /api/transfer-slips              - Create transfer
GET    /api/transfer-slips              - List transfers
GET    /api/transfer-slips/:id          - Get transfer details
PUT    /api/transfer-slips/:id          - Update transfer
POST   /api/transfer-slips/:id/approve  - Approve transfer
POST   /api/transfer-slips/:id/dispatch - Mark in transit
POST   /api/transfer-slips/:id/receive  - Confirm receipt
POST   /api/transfer-slips/:id/cancel   - Cancel transfer
GET    /api/transfer-slips/pending      - Pending transfers
GET    /api/transfer-slips/by-warehouse/:id - By warehouse
```

### Gate Pass Integration

Transfer slips generate gate passes for:
- Security verification at source
- Material exit documentation
- Receipt confirmation at destination
- Inventory reconciliation

---

## 7. API Reference

### Complete Endpoint Summary

| Module | Endpoints | Methods |
|--------|-----------|---------|
| Delivery Notes | 10 | GET, POST, PUT, DELETE |
| ASN | 8 | GET, POST, PUT |
| POD | 8 | GET, POST, PUT |
| Transporters | 6 | GET, POST, PUT, DELETE |
| Vehicles | 6 | GET, POST, PUT, DELETE |
| Transfer Slips | 9 | GET, POST, PUT |

### Common Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Int | Page number (pagination) |
| limit | Int | Items per page |
| status | String | Filter by status |
| fromDate | Date | Date range start |
| toDate | Date | Date range end |
| customerId | UUID | Filter by customer |
| warehouseId | UUID | Filter by warehouse |

### Response Format

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## 8. Workflow Diagrams

### Complete Dispatch Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISPATCH WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Finished Goods Stock                                           │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ Create       │                                              │
│   │ Delivery Note│ ─────────────────────────┐                   │
│   └──────┬───────┘                          │                   │
│          │                                   ▼                   │
│          ▼                          ┌───────────────┐           │
│   ┌──────────────┐                  │ Generate      │           │
│   │ Pack Items   │                  │ Packing List  │           │
│   │ into Cartons │                  └───────────────┘           │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐     ┌──────────────┐                         │
│   │ Assign       │────▶│ Create ASN   │                         │
│   │ Transporter  │     │ & Notify     │                         │
│   └──────┬───────┘     └──────────────┘                         │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ Dispatch     │                                              │
│   │ Shipment     │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ Capture POD  │──────▶ Signature + Photos + GPS              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ Verify &     │                                              │
│   │ Close        │                                              │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Transfer Slip Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSFER WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Source Warehouse                    Destination Warehouse      │
│          │                                    ▲                  │
│          ▼                                    │                  │
│   ┌──────────────┐                           │                  │
│   │ Create       │                           │                  │
│   │ Transfer Slip│                           │                  │
│   └──────┬───────┘                           │                  │
│          │                                    │                  │
│          ▼                                    │                  │
│   ┌──────────────┐                           │                  │
│   │ Approve      │                           │                  │
│   │ Transfer     │                           │                  │
│   └──────┬───────┘                           │                  │
│          │                                    │                  │
│          ▼                                    │                  │
│   ┌──────────────┐     ┌──────────────┐      │                  │
│   │ Generate     │────▶│ In Transit   │──────┘                  │
│   │ Gate Pass    │     └──────────────┘                         │
│   └──────────────┘            │                                 │
│                               ▼                                 │
│                        ┌──────────────┐                         │
│                        │ Receive &    │                         │
│                        │ Verify       │                         │
│                        └──────────────┘                         │
│                               │                                 │
│                               ▼                                 │
│                        Stock Updated at                         │
│                        Both Locations                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Troubleshooting

### Delivery Note Won't Confirm

**Cause:** Insufficient stock or pending approvals
**Solution:**
- Check finished goods stock availability
- Verify all line items have adequate quantity
- Check for pending order approvals

### ASN Not Sending

**Cause:** Missing customer email or transporter details
**Solution:**
- Verify customer has valid email address
- Ensure transporter is assigned with tracking number
- Check email service configuration

### POD Capture Failing

**Cause:** Mobile sync issues or GPS disabled
**Solution:**
- Check device internet connectivity
- Enable GPS/location services
- Try offline capture and sync later

### Transfer Slip Variance

**Cause:** Received quantity doesn't match sent quantity
**Solution:**
- Document variance in remarks
- Create adjustment entries
- Investigate during transit damage/loss

### Transporter Not Available

**Cause:** All vehicles busy or inactive transporter
**Solution:**
- Check vehicle availability status
- Activate additional vehicles
- Contact transporter for emergency allocation

---

## Integration Points

### With Other Modules

| Module | Integration |
|--------|-------------|
| Orders | Delivery notes linked to sales orders |
| Finished Goods | Stock reduction on dispatch |
| Invoicing | Invoice generation with delivery note |
| Accounting | AR entries on delivery confirmation |
| Quality | QC clearance before dispatch |

### External Integrations

| System | Purpose |
|--------|---------|
| Courier APIs | Tracking number generation |
| SMS Gateway | Delivery notifications |
| Email Service | ASN and POD documents |
| GPS Tracking | Real-time shipment tracking |

---

## Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) - Production workflow
- [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) - Inventory management
- [GST_GUIDE.md](GST_GUIDE.md) - Invoice GST calculations

---

**Maintained By:** Kashaya Fabs Development Team
