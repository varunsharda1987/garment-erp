# Job Work Consolidation — migration spec

**Repo:** `varunsharda1987/garment-erp` · **Target:** `backend/prisma/schema.prisma`
**Context:** development stage, no production data. Destructive migrations are acceptable; `prisma migrate reset` is on the table. Single entity — Kashaya Fabs only.

**Goal:** collapse five parallel "send goods out for a process" implementations into one, and make the challan the sole movement primitive with line-level order attribution.

Work the phases in order. Each ends at a compiling, migratable state — do not batch them into one migration.

---

## Preconditions

1. `ts-errors.txt` currently lists ~971 lines. Clear or triage these first. Do not start a 5-model consolidation with an unclear type baseline.
2. Branch: `feat/job-work-consolidation`.
3. Confirm no seed data or fixtures depend on the models being deleted in Phase 4.

---

## Phase 0 — Company profile singleton

Replaces the multi-entity design that is no longer needed, and gives documents a source for the firm's own identity.

```prisma
model company_profile {
  id           String   @id @default("KF")
  legalName    String   // Kashaya Fabs
  constitution String   // PROPRIETORSHIP
  gstin        String
  stateCode    String   // "08"
  addressLine1 String
  addressLine2 String?
  city         String
  pincode      String
  updatedAt    DateTime @updatedAt
}
```

Seed one row. Then:

- **Derive `isInterstate`, don't store it.** `purchase_orders.isInterstate` is currently a stored boolean, which means it is being set by hand or in code and can be wrong. Replace reads with `supplier.billing_state.code !== companyProfile.stateCode`. Keep the column only if an existing query depends on it, and if so make it a generated/derived write on save rather than user input.
- House of Kasya Pvt Ltd is now an ordinary `customers` row with its own `customer_gst_numbers` entry. The cost-plus-10% transfer is a normal outbound sale.

---

## Phase 1 — `process_type_master`

Four enums currently describe the same domain: `ProcessType` (10), `ServiceType` (same 10 + OTHER), `ExternalProcessType` (3), and the `*_SERVICE` members of `POCategory`. None carries a SAC code or GST rate, so tax cannot be driven from data.

```prisma
model process_type_master {
  id                  String   @id @default(uuid())
  code                String   @unique  // DYEING, PRINTING, EMBROIDERY, STITCHING, SMOCKING, CUTTING, WASHING, FINISHING, HANDWORK
  name                String
  sacCode             String            // 998821 fabric-stage | 998822 garment-stage
  gstRate             Decimal? @db.Decimal(5,2)  // NULL = unresolved, blocks document generation
  rateNote            String?           // cite the notification
  stageLevel          String            // FABRIC | GARMENT
  defaultUom          String            // MTR | PCS | KG
  defaultTolerancePct Decimal  @db.Decimal(5,2) @default(0)
  allowsInHouse       Boolean  @default(false)   // true for CUTTING, STITCHING, FINISHING
  isActive            Boolean  @default(true)

  jobWorkOrders job_work_orders[]
  rateCards     processor_rate_card[]
}
```

**`gstRate` is nullable on purpose.** DYEING and PRINTING seed as `NULL` pending CA confirmation (see `kf-documents/references/gst-job-work.md` §3). A null rate must **block** document generation with a visible message — never silently print zero. `job_work_orders.isRateTbd` already implements this idea; reuse the pattern.

Seed values: EMBROIDERY / STITCHING / SMOCKING / CUTTING / WASHING / FINISHING / HANDWORK at 5% with the notified textile job-work entry cited in `rateNote`. DYEING and PRINTING at `NULL`.

**Enum handling.** Keep `ProcessType` and `ServiceType` as-is for now — deleting them touches too much at once. Add `processTypeId` FKs alongside, migrate reads, then drop the enums in a follow-up. Delete `ExternalProcessType` in Phase 4 when its owning model goes.

Also add `processTypeId` to `processor_rate_card` (currently `processingType String`).

---

## Phase 2 — Generalise `job_work_orders`

Currently fabric-only: `fabricId` + `fabricStockLotId` + scalar `qtySentMeters`. Cannot express "issue cut panels + lining + thread", which is why `external_process_send_outs` had to exist.

**Make optional:** `fabricId`, `fabricStockLotId`, `fabricType`, `sentWidthInches`, `styleId`. These are dyeing-specific and meaningless for a stitching order.

**Add:**

```prisma
  processTypeId    String
  processType      process_type_master @relation(fields: [processTypeId], references: [id])

  tolerancePct     Decimal  @db.Decimal(5,2)   // snapshot at order time, not live
  statutoryDueDate DateTime                     // = sentDate + 1 year. IMMUTABLE.
  uom              String                       // MTR | PCS | KG

  components       job_work_order_components[]
```

Drop the old string `processType` field once `processTypeId` is populated.

**New child table:**

```prisma
model job_work_order_components {
  id             String @id @default(uuid())
  jobWorkOrderId String
  jobWorkOrder   job_work_orders @relation(fields: [jobWorkOrderId], references: [id], onDelete: Cascade)

  itemType       String   // GREIGE | FABRIC | CUT_PIECE | LACE | THREAD | TRIM
  materialId     String?
  fabricId       String?
  greigeStockId  String?
  fabricStockId  String?
  laceStockId    String?
  threadStockId  String?
  description    String
  hsnCode        String?

  uom            String
  qtyIssued      Decimal  @db.Decimal(14,3)
  rateAtIssue    Decimal  @db.Decimal(12,4)   // OUR cost, SNAPSHOTTED
  isChargeable   Boolean  @default(true)      // false = free issue (thread, packing)
  isReturnable   Boolean  @default(false)     // cones, poly rolls

  @@index([jobWorkOrderId])
}
```

`rateAtIssue` must be a snapshot, not a live moving-average read. Reprinting a six-month-old challan has to reproduce the value the e-way bill was raised on.

**Remove:** `outwardChallanId` and `inwardChallanId`. These 1:1 FKs are what prevent partial movements. Phase 3 replaces them.

---

## Phase 3 — Challan becomes the sole movement primitive

`challans` already has the right shape: `ChallanType` (OUTWARD/INWARD/INTERNAL), from/to, transport, status. Keep it. Three changes.

**3a. Move order linkage to the line.** One vehicle to one dyer can carry material for three orders — one physical movement, one e-way bill, one challan.

On `challan_items`:
```prisma
  jobWorkOrderId          String?
  jobWorkOrder            job_work_orders? @relation(fields: [jobWorkOrderId], references: [id])
  jobWorkOrderComponentId String?
  declaredValue           Decimal? @db.Decimal(14,2)  // per line, for e-way bill

  @@index([jobWorkOrderId])
```

`challan_items.serviceRequirementId` already exists — the hook is there, it just points at the orchestration layer instead of the order. Keep both during transition; `serviceRequirementId` becomes redundant once Phase 4 lands.

Drop `challans.purchaseOrderId` as the job-work link (keep it if genuine goods POs use it).

**3b. Add statutory fields to `challans`.** Currently no value and no e-way bill — an OUTWARD challan cannot legally leave the gate as-is.

```prisma
  ewayBillNumber String?
  ewayBillDate   DateTime?
  totalDeclaredValue Decimal? @db.Decimal(14,2)  // sum of item declaredValue
  reasonForTransport String?  // "JOB WORK — NOT A SUPPLY"
```

**3c. Fix the unit problem.** `challans.totalQuantity` + a single `unit` breaks on a mixed MTR + PCS movement. Either drop the header rollup and aggregate from items, or make it `Json` keyed by unit. Prefer dropping it — it is a denormalisation that buys little.

**Obligations by `challanType`** (enforce in service layer, not schema):

| Type | Value required | E-way bill | Starts Sec 143 clock |
|---|---|---|---|
| `INTERNAL` | No | No | No |
| `OUTWARD` to job worker | Yes | Yes | **Yes** |
| `INWARD` from job worker | Yes | Yes | Stops it |

---

## Phase 4 — Delete the redundant models

No production data, so these are drops, not migrations.

**Delete outright:**
- `external_process_send_outs` + `external_process_send_out_skus`
- `embroidery_send_out`
- enums `ExternalProcessType`, `ExternalProcessSourceType`, `ExternalProcessStatus`

Everything they did is now `job_work_orders` + components + challans. The SKU breakdown on `external_process_send_out_skus` needs an equivalent — add `job_work_order_skus` (colorId, sizeId, qty) if per-size tracking is needed for garment-stage job work. It is.

**Keep and rewire:**
- `processing_batch` / `_stage` / `_movement` / `_delivery` — these do something genuinely different: multi-stage chains where output of stage 1 feeds stage 2 at a different processor. Change `processing_stage` to reference `jobWorkOrderId` rather than duplicating processor/rate/quantity fields. A batch becomes an ordered sequence of job work orders.
- `fabric_processing` — audit whether it is now fully subsumed. If yes, delete; if it holds greige→fabric identity transformation logic not present elsewhere, keep and point it at `job_work_orders`.

**Simplify `work_order_service_requirements`.** Its four nullable FKs (`jobWorkOrderId`, `embroiderySendOutId`, `processingBatchId`, `purchaseOrderId`) collapse to one: `jobWorkOrderId`. That table becomes a genuine planning layer — "this work order needs 600 pcs stitched" — rather than a router over five implementations.

**`JobWorkStatus` needs replacing.** Current values are lab-dip specific (`LAB_DIP_PENDING`, `SENT_TO_MILL`, `AT_MILL`) and meaningless for stitching. Replace with: `DRAFT`, `APPROVED`, `ISSUED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`, `CANCELLED`. Lab-dip state belongs on `lab_dips`, where it already lives.

---

## Phase 5 — Section 143 and ITC-04

Currently zero coverage in the schema. Nothing computes the 1-year clock, nothing can produce an ITC-04 return.

`statutoryDueDate` from Phase 2 is the anchor. Set it on issue as `sentDate + 1 year` and never allow it to be edited — the commercial `expectedReturnDate` is renegotiable, this is not.

**Ageing view.** Quantity still with each job worker by days since issue, computed from challan lines out minus challan lines back. Hard flag at 300 days — 65 days of runway before deemed supply.

**ITC-04 extract.** A query, not a table: goods sent to and received from job workers in a period, grouped by job worker GSTIN, with challan references. Confirm current filing frequency with the CA before wiring a schedule.

---

## Phase 6 — Tolerance and loss

`expectedShrinkage`/`actualShrinkage` is fabric-specific and does not generalise to pieces. `defectMeters` exists but routes nowhere.

On the receipt side, split loss explicitly:

```prisma
  qtyReceivedA       Decimal @db.Decimal(14,3)
  qtyReceivedB       Decimal @db.Decimal(14,3)   // seconds / shade variation
  qtyRejected        Decimal @db.Decimal(14,3)
  qtyNormalLoss      Decimal @db.Decimal(14,3)   // within tolerancePct → absorbed into FG cost
  qtyAbnormalLoss    Decimal @db.Decimal(14,3)   // beyond → debit note
  debitNoteId        String?
```

`debit_notes` already exists and links to PO — extend it to link to `job_work_orders`.

**The costing rule this enforces:** FG value = material at `rateAtIssue` + job charges + freight, all tax-exclusive. GST on job charges is input credit and must never enter inventory valuation. Abnormal loss must never inflate the FG rate — otherwise poor vendor performance hides inside product cost permanently.

---

## Verification

After each phase: `npx prisma migrate dev`, `npx prisma generate`, `npm run build` clean.

After Phase 4, these must all hold:

- [ ] Exactly one model represents "goods sent to a processor"
- [ ] A job work order can carry ≥2 components of different item types
- [ ] Three partial return challans against one order reconcile correctly
- [ ] One challan can serve lines from two different job work orders
- [ ] A `process_type_master` row with `gstRate = NULL` blocks document generation
- [ ] `statutoryDueDate` is not writable after issue
- [ ] In-house cutting produces no challan, no job work order, no ITC-04 row
- [ ] FG valuation query returns a tax-exclusive figure
- [ ] Abnormal loss appears in a debit note, never in FG rate

---

## Related

`kf-documents` skill — `references/gst-job-work.md` for rates and the unresolved dyeing/printing question, `references/document-fields.md` for what prints on each document, `assets/base.css` for the shared document design system.
