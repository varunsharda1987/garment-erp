---
Reference for: kf-documents skill
Verified against: varunsharda1987/garment-erp @ backend/prisma/schema.prisma, Aug 2026
---

# Data model — what documents read from

**These are the real model names in the repo.** Where a field is marked *(planned)* it does not exist yet and is specified in `migration-spec.md`. Do not invent parallel tables — everything below either exists or is scheduled.

Single entity: **Kashaya Fabs only**. There is no `entityId` on any table and none is needed. Firm identity comes from `company_profile` *(planned, Phase 0)*.

## Contents

1. Model map
2. What each document pulls
3. Computed at render — never stored
4. Stock movement semantics
5. Numbering

---

## 1. Model map

| Concept | Real model | State |
|---|---|---|
| Firm identity | `company_profile` | *planned — Phase 0* |
| Process + SAC + GST rate | `process_type_master` | *planned — Phase 1* |
| Job worker / processor | `suppliers` | exists |
| Job worker GSTIN | `supplier_gst_numbers` | exists |
| Job work order | `job_work_orders` | exists, fabric-only until Phase 2 |
| Material issued | `job_work_order_components` | *planned — Phase 2* |
| Movement document | `challans` + `challan_items` | exists |
| Goods receipt | `goods_receiving_notes` + `grn_items` | exists |
| Purchase order | `purchase_orders` + `purchase_order_items` | exists |
| Vendor rates | `processor_rate_card` | exists — has proper effective-dating |
| Debit note | `debit_notes` + `debit_note_items` | exists |
| Vendor warehouse | `warehouses` (`WarehouseType.JOB_WORK`, `isVirtual`, `supplierId`) | exists |
| HSN/SAC + default rate | `hsn_sac_masters` | exists |

### `job_work_orders` — key fields for documents

Existing: `jobWorkNumber`, `processorId` → `suppliers`, `qtySentMeters`, `sentDate`, `expectedReturnDate`, `agreedRatePerMeter`, `isRateTbd`, `qtyReceivedMeters`, `receivedDate`, `status` (`JobWorkStatus`), `defectMeters`, `expectedShrinkage` / `actualShrinkage`, `workOrderId`, `purchaseOrderId`.

Planned (Phase 2): `processTypeId`, `tolerancePct`, `statutoryDueDate`, `uom`, `components[]`.

Being removed (Phase 2/3): `outwardChallanId`, `inwardChallanId` — 1:1 FKs that block partial movements. Order↔challan linkage moves to `challan_items.jobWorkOrderId`.

`isRateTbd` is the existing blocked-rate flag. Reuse it — when `process_type_master.gstRate IS NULL` (DYEING, PRINTING), documents must render the blocked state rather than print a rate.

### `challans` — the single movement primitive

`challanNumber`, `challanType` (`OUTWARD` / `INWARD` / `INTERNAL`), `challanDate`, `fromType`/`fromId`/`fromName`, `toType`/`toId`/`toName`, `vehicleNumber`, `driverName`, `lrNumber`, `status` (`ChallanStatus`), `issuedDate`/`expectedDate`/`receivedDate`, `totalQuantity`, `unit`, `items[]`.

Planned (Phase 3): `ewayBillNumber`, `ewayBillDate`, `totalDeclaredValue`, `reasonForTransport`. The header `totalQuantity` + single `unit` breaks on mixed MTR/PCS movements — aggregate from items instead.

`challan_items` already has `serviceRequirementId`, `greigeStockId`, `fabricStockId`, `laceStockId`, `threadStockId`, `foldLengthCm`, `thanCount`, `componentName`, `colorName`. Phase 3 adds `jobWorkOrderId`, `jobWorkOrderComponentId`, `declaredValue`.

**Obligations by `challanType`** — enforce in the service layer:

| Type | Value | E-way bill | Sec 143 clock |
|---|---|---|---|
| `INTERNAL` | No | No | No |
| `OUTWARD` to job worker | Yes | Yes | **Starts** |
| `INWARD` from job worker | Yes | Yes | Stops |

## 2. What each document pulls

| Document | Root | Includes |
|---|---|---|
| Job Work Order / Job Card | `job_work_orders` | `processor` → `gst_numbers`, `processType`, `components`, `challan_items` (both directions) |
| Delivery Challan | `challans` | `items` → stock refs, `items.jobWorkOrder` → `processor` |
| GRN | `goods_receiving_notes` | `grn_items`, `purchaseOrder`, related job work order |
| Purchase Order | `purchase_orders` | `purchase_order_items`, `suppliers` |

Single query, `include` all the way down. If a template needs a second fetch, the query is wrong.

## 3. Computed at render — never stored

```ts
// Material issued — from snapshotted rates, not live valuation
const materialValue = components
  .filter(c => c.isChargeable)
  .reduce((s, c) => s + Number(c.qtyIssued) * Number(c.rateAtIssue), 0);

const jobCharges   = Number(order.expectedQty) * Number(order.agreedRatePerMeter);
const taxableValue = jobCharges;   // freight is OUR cost, NOT vendor's taxable value

// Interstate is DERIVED, never stored:
const isInterstate = supplier.billing_state.code !== companyProfile.stateCode;
const gstAmount    = taxableValue * (processType.gstRate / 100);
// intra-state → split CGST/SGST equally; otherwise IGST

// FG valuation — strictly TAX-EXCLUSIVE
const fgValue = materialValue + jobCharges + freightAmount;
const fgRate  = fgValue / actualQtyReceived;

// Tolerance
const lossQty      = qtyIssued - qtyReceivedTotal;
const normalLoss   = Math.min(lossQty, qtyIssued * tolerancePct / 100);
const abnormalLoss = lossQty - normalLoss;   // → debit_notes at rateAtIssue

// Statutory
const statutoryDue = addYears(order.sentDate, 1);   // immutable once issued
const daysToDeemed = differenceInDays(statutoryDue, new Date());
```

Two errors to guard against:

1. `fgValue` picking up `gstAmount`. GST on job charges is recoverable input credit, not inventory cost. Loading it overstates stock and understates credit simultaneously.
2. `abnormalLoss` absorbed into `fgRate`. It goes to P&L or a vendor debit note. Otherwise poor vendor performance hides inside product cost permanently.

`purchase_orders.isInterstate` is currently a **stored** boolean. Treat it as untrusted and derive.

## 4. Stock movement semantics

Material at a job worker has left the building but not the balance sheet. `warehouses` already supports this: `WarehouseType.JOB_WORK` + `isVirtual` + `supplierId`. Use it.

```
MAIN warehouse  →  JOB_WORK warehouse (supplierId = processor)
```

Same valuation carried across. No P&L impact. On receipt, components consume out of the vendor warehouse and FG lands in MAIN at `fgValue`.

**Ageing report:** quantity by job worker by days since issue, from challan lines out minus challan lines back. Hard flag at 300 days — 65 days of runway before the Section 143 deemed-supply date.

## 5. Numbering

`code_sequences` exists — use it. Gapless per series per financial year, allocated **on commit**, never on form-open. Statutory documents cannot have holes.

```
KF/JW/2026-27/0147     job_work_orders.jobWorkNumber
KF/DC/2026-27/0311     challans.challanNumber
KF/GRN/2026-27/0288    goods_receiving_notes
KF/PO/2026-27/0092     purchase_orders.poNumber
KF/INV/2026-27/1204    invoices
```
