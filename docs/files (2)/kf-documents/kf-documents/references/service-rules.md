# Service-layer rules

The schema shapes the data; these rules decide whether an operation is allowed. Enforce them in the service layer, not in the UI — the UI can be bypassed and a second client will eventually exist.

Each rule states the **invariant**, **where it fires**, and **what happens on violation**. Violations return `422` with a machine-readable code, never a silent correction.

## Contents

1. Blocking rules — reject the operation
2. Derivation rules — never trust stored values
3. Routing rules — which path a process takes
4. Lifecycle rules — legal state transitions
5. Endpoints
6. Test cases

---

## 1. Blocking rules

### R1 — Unresolved GST rate blocks document generation

**Invariant:** a job work order whose `process_type_master.gstRate IS NULL` cannot produce a printed document carrying a tax figure.

**Fires on:** `POST /job-work-orders/:id/documents/*`, and on approval.

**On violation:** `422 GST_RATE_UNRESOLVED`, with `processTypeCode` in the payload. The order may still be created and material may still be issued — the *document* is what blocks, because that is what carries a number someone will act on.

Applies today to `DYEING` and `PRINTING` (see `gst-job-work.md` §3). The existing `job_work_orders.isRateTbd` flag expresses the same idea for rates; keep both — `isRateTbd` is a commercial unknown, `gstRate IS NULL` is a statutory one.

### R2 — `statutoryDueDate` is immutable after issue

**Invariant:** once a job work order reaches `ISSUED`, `statutoryDueDate` cannot change.

**Fires on:** any `PATCH` touching the field.

**On violation:** `422 STATUTORY_DATE_IMMUTABLE`.

`expectedReturnDate` remains freely editable — that is the commercial date and it is renegotiable. Section 143 is not. If the two are ever set from the same form field, that is a bug.

### R3 — Job work order requires at least one chargeable component

**Invariant:** an order of type job work cannot be approved with zero `job_work_order_components` where `isChargeable = true`.

**On violation:** `422 NO_MATERIAL_ISSUED`. An order with only free-issue items means someone forgot the material.

### R4 — Challan lines cannot exceed order quantity

**Invariant:** for any component, `SUM(outward challan lines) <= qtyIssued` on the order.

**Fires on:** challan issue.

**On violation:** `422 OVER_ISSUE`, with the remaining quantity. Over-issue is nearly always a data entry error, but when it is genuine the order should be amended first — silently allowing it destroys reconciliation.

### R5 — Inward challan cannot exceed outward, plus tolerance

**Invariant:** `SUM(inward) <= SUM(outward) * (1 + overReceiptAllowancePct)`, default 0.

**On violation:** `422 OVER_RECEIPT`. Receiving more than you sent means the job worker mixed lots — a real and expensive problem, and worth stopping at the gate.

### R6 — Purchased goods cannot enter a job work order

**Invariant:** `job_work_order_components` may only reference stock we already own. An item sourced from a `purchase_orders` line against the same supplier must not appear as an issued component.

**On violation:** `422 PURCHASED_ITEM_AS_COMPONENT`.

This is the trap named in the PO template: if a job worker also sells you thread, that is a separate PO. Mixing corrupts reconciliation because the ERP treats bought-in items as material we issued.

### R7 — Tax never touches material movement

**Invariant:** no tax field may be populated on `challans` or `challan_items` where `challanType` relates to job work.

Structural, not just procedural — the tables have no tax columns and must not gain any. If a future ticket asks for "tax on the challan," the answer is that the tax belongs on the job worker's invoice.

---

## 2. Derivation rules

### D1 — `isInterstate` is derived

```ts
const isInterstate = supplier.billing_state.code !== companyProfile.stateCode;
```

`purchase_orders.isInterstate` currently exists as a stored boolean. Treat every stored value as untrusted; recompute on read and on save. A wrong value books CGST+SGST on an interstate purchase and the credit is wrong.

### D2 — FG valuation is tax-exclusive

```ts
const fgValue = materialValue + jobCharges + freightAmount;
```

`gstAmount` must never appear in this expression. GST on job charges is recoverable input credit. Loading it into inventory overstates stock and understates credit simultaneously.

**Add a unit test asserting `fgValue` is unchanged when `gstRate` changes.** This is the single easiest error to reintroduce during a refactor.

### D3 — Abnormal loss never enters FG rate

```ts
const normalLoss   = Math.min(lossQty, qtyIssued * tolerancePct / 100);
const abnormalLoss = lossQty - normalLoss;
```

Normal loss is absorbed — which is why the per-unit FG rate exceeds the sum of its inputs. Abnormal loss goes to `debit_notes` or P&L. If it is absorbed, poor vendor performance hides inside product cost permanently and no report will ever surface it.

### D4 — `rateAtIssue` is snapshotted, never live

Written once at issue from the then-current valuation. Never re-read from moving average. Reprinting a six-month-old challan must reproduce the value the e-way bill was raised on.

### D5 — Balance with vendor is computed, not stored

```
balance = SUM(outward challan lines) - SUM(inward challan lines)
```

Per order, per component. Storing it creates drift the moment a partial return is recorded out of order.

---

## 3. Routing rules

### RT1 — In-house execution fires no job work path

When `process_type_master.allowsInHouse = true` and the work order specifies in-house execution:

- No `job_work_orders` row
- No challan of any type
- No GST, no ITC-04 entry
- Labour and overhead consume into WIP via the existing production tracking

Applies to `CUTTING`, `STITCHING`, `FINISHING`. **If in-house cutting ever appears in an ITC-04 extract, this rule has been violated** — assert it in the report query as a guard, not just here.

### RT2 — Internal challans carry no statutory obligation

`challanType = INTERNAL` (cutting room → stitching floor): no declared value, no e-way bill, no Section 143 clock, no retention requirement. The same table, a different obligation set. Do not apply Rule 55 validation to internal movements.

### RT3 — Multi-stage chains reference orders, they don't replace them

`processing_batch` handles sequences where stage 1 output feeds stage 2 at a different processor. Each stage references a `jobWorkOrderId`. The batch is an ordering layer. It must not carry its own processor, rate, or quantity fields — that is what made it a parallel implementation.

---

## 4. Lifecycle

```
DRAFT → APPROVED → ISSUED → PARTIALLY_RECEIVED → RECEIVED → CLOSED
                      ↓             ↓                ↓
                  CANCELLED     CANCELLED        CANCELLED
```

| Transition | Guard |
|---|---|
| `DRAFT → APPROVED` | R1, R3 pass; approver has authority for the value |
| `APPROVED → ISSUED` | ≥1 outward challan issued; `statutoryDueDate` set and locked |
| `ISSUED → PARTIALLY_RECEIVED` | ≥1 inward challan; balance > 0 |
| `→ RECEIVED` | balance = 0, or shortfall accounted as normal/abnormal loss |
| `RECEIVED → CLOSED` | vendor invoice matched; debit note raised if abnormal loss > 0 |
| `→ CANCELLED` | only when no outward challan exists. After material has moved, reverse it — never cancel. |

`CANCELLED` after issue is the one to guard hardest. Material physically at a vendor with a cancelled order is stock that exists nowhere.

---

## 5. Endpoints

```
POST   /job-work-orders                     create (DRAFT)
POST   /job-work-orders/:id/components      add issued material
POST   /job-work-orders/:id/approve         R1, R3
POST   /job-work-orders/:id/issue           creates outward challan, locks statutoryDueDate
GET    /job-work-orders/:id/reconciliation   computed — D5
POST   /job-work-orders/:id/receive         inward challan + grading + loss split
POST   /job-work-orders/:id/close           requires invoice match

POST   /challans                            R4/R5 by type
GET    /challans/:id/print?copy=1|2|3        triplicate for Rule 55

GET    /reports/job-work-ageing              days outstanding by vendor
GET    /reports/itc-04?from=&to=             statutory extract
GET    /reports/sec-143-alerts               orders past 300 days
```

`/issue` and `/receive` are the transactional ones — challan creation, stock movement, and status change must be one database transaction. A challan without its stock movement is worse than neither.

---

## 6. Test cases

Assert these before considering the module done:

1. Order with `gstRate = NULL` → document generation returns `422 GST_RATE_UNRESOLVED`
2. `PATCH statutoryDueDate` on an `ISSUED` order → `422`
3. Three partial outward challans + two partial inward → balance correct
4. One challan carrying lines for two different orders → both reconcile independently
5. Loss of exactly `tolerancePct` → `abnormalLoss = 0`, no debit note
6. Loss of `tolerancePct + 0.1%` → debit note raised at `rateAtIssue`
7. `gstRate` changed from 5% to 18% → `fgValue` **unchanged**
8. In-house cutting work order → zero challans, zero ITC-04 rows
9. Interstate supplier → IGST, never CGST+SGST, regardless of the stored `isInterstate`
10. Cancel attempt on an issued order → `422`
11. Reprint a challan after the item's moving-average has moved → same value as original
