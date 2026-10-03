# Allocate a sent PO to running orders — design (2026-09-28)

Owner-approved plan: see the Owner decisions below (D1–D14 in the approved plan, summarised in section 2). This is the
final design from two read-only design rounds (maps, two designers, two adversarial critics). Line numbers are
from 2026-09-28 working copies — grep again before editing.

Owner decisions added after this design was written (they override it where they differ):
- Issuing goods held for another order: WARN and allow after confirmation (not a hard block). Taking them shrinks
  the losing order's link by that quantity and reopens its need as a PO_REQUIRED balance row (MRP-12 shape), audit-logged.
- Order COMPLETED / DISPATCHED releases its remaining receipt holds automatically.
- A part-arrived line can still be linked; arrived goods are held at once (those links cannot be undone).
- Dyer changed after greige arrived: the hold moves at the next recompute, with a warning on the PO card.

---

# Critic round 2: final design for allocating a sent PO to running orders (D1–D4)

The revised design mostly holds up. I found five sequences that go wrong and one planning fact that has changed, and fixed them below:
- **Reversal on a cancelled PO** is still allowed and would undo credits whose balance was already re-ordered.
- **Order cancel after short-close or cancel** can push a link's credit above the shortfall that short-close wrote.
- **Re-ranking** can demote an earlier-dated order on lines that deliver to more than one dyer.
- **A part-delivered line with surplus** could never be linked again under the old rule.
- **Job-work cancel** gives the cloth back without giving the order its hold back.
- **Git state:** `schema.prisma` is now clean, but `grn.service.ts`, `challan.service.ts`, `mrp.service.ts` and `UnifiedRequirementsPage.tsx` are now being edited by another terminal.

Everything was checked read-only on 2026-09-28: code reads, SELECT queries, `git status` and `git diff`. Paths are relative to `C:\Users\NEW\garment-erp\`. Line numbers are from the current working copy. `grn.service.ts`, `challan.service.ts` and `mrp.service.ts` are being edited in another terminal, so grep again after it commits.

## 0. The five riskiest claims, checked again

| # | Claim | Evidence | Verdict |
|---|---|---|---|
| R1 | On approval, links are credited before the lots exist; the GRN is ACCEPTED before its item loop | Status set to ACCEPTED at `grn.service.ts:1212-1219`; `stockQuantity` written at :1700; link credit at :1750-1752; QC-reject decrement after the credit at :1762-1772; lots created at :1805-1807 | Holds. The recompute and the holds go after :1807 |
| R2 | Reversal takes back exactly what approval booked, and closed POs are protected | Status set to REVERSED at :2806-2817; delta credit at :2841; lots reversed afterwards at :2877. **SHORT_CLOSED is refused (:2793-2799) but a CANCELLED PO is not.** The greige used-lot guard (:4003-4010) ignores `quantityReserved`. A lace lot is deleted at zero (:4158) | Partly holds. Fixed in change C2 |
| R3 | The hold lifecycle can be reused as it is | Trim rows with no lot are written only when a warehouse is given (`stock-reservation.helper.ts:124`). `activeRows` filters by requirement only (:145-160). Consumption takes issued lots first, then newest (:226-230). Job work consumes through `linkedRequirementId` (`job-work-issuance.service.ts:1130-1142`), but the pre-checks read only `quantityAvailable` (greige :537-543, lace :343-348). Order cancel skips rows in PO statuses (`order.service.ts:744-759`). Reconcile touches only unlinked families (`requirement-reconcile.helper.ts:207-212, 238-248, 304-305`). `reserveGreigeStock` has no callers, so there is no greige clash between the two meanings of "reserved" | Holds, with the hooks in §6.7 |
| R4 | An "either permission" check needs its own router | `requireAnyPermission` is at `auth.middleware.ts:146-173`. Router-level write gates: `purchaseOrder.routes.ts:52-53`, `mrp.routes.ts:41-42`. Mount points: `routes/index.ts:290-295` | Holds |
| R5 | Close paths and link writers | Short-close keeps the link's allocation and sets `shortfall := received` (`purchaseOrder.service.ts:1668-1686`). Cancel keeps part-received links and creates a balance child (:1495-1517). Unified PO gives every requirement the whole line (`unified-po-creation.service.ts:637-647`). The only link creators are unified :637, MRP generate `mrp.service.ts:4612` and `linkRequirementToPO` :4800 | Holds. Fixed in change C3 |

**Live data (SELECT only):**
- 0 rows in `requirement_po_links`; it has no `fillOrder` column.
- `stock_reservations`: 2 ACTIVE greige rows (7,107.733 reserved, 4,021.74 consumed), 5 CONSUMED rows, and 0 ACTIVE rows without a lot.
- GRNs: 17 ACCEPTED, 5 REVERSED, 0 PARTIALLY_ACCEPTED. Approval only ever sets ACCEPTED (:1215).
- Open POs: PO2609-0004 and PO2609-0008 (GREIGE, SENT) and PO2609-0231 (ACCESSORIES, SENT).
- No greige lot has more reserved than available.
- The last applied migration is `20260928180000_fabric_lot_pieces`, now committed in `e1026d7d`.

---

## 1. Context

**PO2609-0231** (ACCESSORIES, SENT):
- 6 lines, LBL-0004-XS…XXL, in PIECE, no conversion factor, nothing received.
- 54 PO_REQUIRED size rows across 9 running orders need 21,201 pieces. The PO has 32,530, so 11,329 are free:

  | XS | S | M | L | XL | XXL |
  |---|---|---|---|---|---|
  | 1,589 | 2,369 | 2,495 | 2,269 | 1,701 | 906 |

**The two greige POs** (GRG-0072 and GRG-0009, 10,000 m each) have no open demand. So the greige note shows nothing live. Open greige MATERIAL demand is on GRG-0039 (Shree Bhavya) and GRG-0042 (Mangal):

| Requirement | Status | Shortfall (m) | Order | Delivery date |
|---|---|---|---|---|
| MR2608-0133 | PARTIAL_STOCK | 1.533 | ORD…029 | 10-10 |
| MR2608-0157 | PO_REQUIRED | 3,823.529 | ORD…030 | 11-05 |
| MR2608-0141 | PO_REQUIRED | 3,823.529 | ORD…031 | 11-05 |

**Permissions:** all 9 roles hold both `mrp` and `purchaseOrders`.

**Git (changed since round 2):**
- `backend/prisma/schema.prisma` is **clean**: commit `e1026d7d` includes the fabric-pieces migration.
- **Now dirty in another terminal** (fabric-lot-pieces step 1b, plus list-search work):
  - `grn.service.ts` (fabric lots now get `grnItemId`, and reversing a used fabric lot is refused);
  - `challan.service.ts` (`settleLotOut` / `settleLotBack`);
  - `mrp.service.ts` (search fields at :2673-2683);
  - `greige-stock.service.ts`, `work-order-service-requirement.service.ts`, `stockLevel.service.ts`;
  - `frontend/src/pages/UnifiedRequirementsPage.tsx`;
  - new untracked files `fabric-lot-pieces.service.ts` and `helpers/lot-pieces.helper.ts`.

## 2. Owner decisions and how the design meets them

| Decision | How it is met |
|---|---|
| Only a sent PO can be linked | `LINKABLE_PO_STATUSES = SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED` |
| Default split: every running order's full need, earliest delivery first, and the user can edit it | `suggestAllocations` / `walkDefaultSplit` using `compareFillPriority` |
| MRP only suggests | The note on the Requirements page is read-only. Nothing is linked without a POST |
| Undo before goods arrive | Allowed only while **this link** has received 0 and issued 0, and no GRN on the line awaits QC |
| No placeholder requirements | Quantity nobody linked stays free on the line, then becomes plain stock |
| **D1** Part delivery fills the earliest orders first; reversal is exact | Each link gets a frozen `fillOrder`. A greedy fill is **recomputed from the line total** on every approve, reverse, order cancel and link |
| **D2** Received goods are held for the linked orders | `stock_reservations` rows tagged with `poLinkId`, rebuilt by the same recompute. The stock readers net them out |
| **D3** Lace, greige and greige lace are in scope | GREIGE, LACE and GREIGE_LACE are linkable. Receipts fill by location pool. Fabric and thread stay out (§6.8) |
| **D4** Either the MRP or the PO permission | A new router, `/api/po-allocations`, using `requireAnyPermission('mrp','purchaseOrders')` |

**The owner's D1 idea works.** The state is a pure function of three things: the approved GRN quantities, the links in `fillOrder`, and which links are eligible. Recomputing on every event is therefore idempotent and exact. It needs these refinements:
1. The line total comes from the sum of approved `grn_items.stockQuantity`, not the PO line's counter.
2. Greige and lace fill by **location pool** (which dyer or store holds the goods).
3. **Goods already issued are never un-credited:** each link's issued quantity is a floor on its credit.
4. When links change, only the **zero-credit tail after the last credited link** is re-sorted (change C4).
5. Links of cancelled orders are left out of the fill.
6. Link sizes are capped at each requirement's need.
7. Closing a PO freezes its links (change C3).

## 3. Data model and migration (additive)

**`requirement_po_links`** (`schema.prisma:4136-4151`):
```prisma
fillOrder          Int?                  // earliest-delivery rank on its PO line; frozen once credited
stockReservations  stock_reservations[]
@@index([purchaseOrderItemId, fillOrder])
```

**`stock_reservations`** (`schema.prisma:3955-3993`):
```prisma
poLinkId  String?   /// set = receipt hold for this PO link (D2); null = Use Stock
poLink    requirement_po_links? @relation(fields: [poLinkId], references: [id], onDelete: SetNull)
@@index([poLinkId])
```

**New migration** `backend/prisma/migrations/20260929090000_po_link_fill_order_receipt_holds/migration.sql`:
- `ALTER TABLE "requirement_po_links" ADD COLUMN "fillOrder" INTEGER;`
- index `requirement_po_links_purchaseOrderItemId_fillOrder_idx`;
- `ALTER TABLE "stock_reservations" ADD COLUMN "poLinkId" TEXT;`
- FK `stock_reservations_poLinkId_fkey` → `requirement_po_links(id)`, ON DELETE SET NULL, ON UPDATE CASCADE;
- index `stock_reservations_poLinkId_idx`.

Notes:
- **No backfill is needed:** there are 0 links and 0 ACTIVE rows without a lot.
- **Apply it by hand before the commit** (CLAUDE.md): `ship pause` → `pm2 stop garment-erp-api` → `npx prisma migrate deploy && npx prisma generate` → `pm2 start` → `ship resume`. There are no enum changes.
- **Code rule:** always release a link's holds before deleting the link. The SET NULL only keeps history on closed rows.

## 4. Unit and fill rules

**Units**
- A link, its credit and its holds are all in the **stock unit**, which is the requirement's unit.
- Line stock = `toStockQty(orderedQuantity, stockUnitsPerUnit)`.
- A PO quantity is in **actual** metres (commit `89e4d745`). Receipts are fold-aware (`grnLineActualQty`, `grn-line-value.helper.ts:44`).
- `materials.unit` must normalise to `requirement.unit`.

**Line total**
- Sum over `grn_items` for this line whose GRN is ACCEPTED or PARTIALLY_ACCEPTED.
- Use `stockQuantity`. When it is NULL, use `grnLineStockQty(gi) = toStockQty(grnLineActualQty(gi), spu)`. This is a new pure helper in `grn-line-value.helper.ts`; `grnLineStock` is private to `grn.service.ts:150-173`.
- The GRN's status changes before its loop runs on both approve and reverse. So inside the transaction the sum is already the total after the event.

**Pools**
- GREIGE, GREIGE_LACE and LACE lines: the pool is `greigeHolderId({warehouse})` of the GRN's warehouse (`lot-location.helper.ts:134-137`).
  - A processor's JOB_WORK unit → that processor's pool.
  - A JOB_WORK unit linked to no supplier → `UNPLACED`. It fills nobody, matching `greigeCountsForPlanning` at :171-175 (change C7).
  - Otherwise → `STORE`.
- Every other category has a single `STORE` pool.

**The dyer of a link** (located categories only), from `requirementDyers`, in this order:
1. the processor of a live job on the PROCESSING child;
2. the child's `processorId`;
3. the row's own `processorId` (convert-to-greige rows);
4. otherwise null.

This mirrors `mrp.service.ts:3447-3470`, plus fallback 3. The dyer is read live (see change C10).

**Eligible link:** neither the requirement nor its order is CANCELLED.

**Floor(link, pool):** the sum of `consumedQuantity` on the link's receipt holds on lots of that pool. Holds without a lot (trims) count in STORE.

**Fill order:** `fillOrder ASC NULLS LAST, id ASC`.

**`compareFillPriority`:**
1. `orders.expectedDeliveryDate` ascending, nulls last;
2. `requiredDate` ascending, nulls last;
3. `orderNumber`;
4. `requirementNumber`.

**Greedy fill** (pure; each take rounded to 3 dp, down):
1. `remaining[pool] = total[pool] − Σ floors[pool]`. Anything below −ε is a deficit.
2. Start with `credit = floors`.
3. **Pass A:** each dyer's pool fills its own eligible dyer links, in fill order, up to `allocated`.
4. **Pass B:** the leftover of the dyer pools, in pool-id order, fills links whose dyer is null.
5. **Pass C:** STORE fills every eligible link, in fill order.
6. Whatever is left in each pool is **plain stock**.

For trims this is simply Pass C.

**Assigning ranks** (`assignLineFillOrder`, run after every change to the links; change C4):
- Let k be the rank of the **last** link with credit (received or issued > ε).
- Ranks 1..k are kept as they are, including zero-credit links sitting among them.
- Every link after k, including new links, is sorted by `compareFillPriority` and numbered k+1..n.
- **Why no current credit changes:** the links after k all have zero credit and use nothing. In each pass, the pool left over at any position after k is the same, so moving one of them can never give it credit.
- **Why future priority is kept:** an earlier-dated link to another dyer that sits before k keeps its place.

**Line figures:**
- `arrived` = the line total;
- `credited` = Σ link credit;
- `allocated` = Σ allocated on eligible links;
- `plain` = Σ plain stock across pools;
- `toCome = max(0, orderedStock − arrived)`;
- `uncredited = Σ(allocated − credit)` over eligible links;
- `freeToLink(dyer?) = max(0, plainReachable(dyer) + toCome − uncredited)`, where `plainReachable` = plain stock in the pools that dyer's link may use. For trims this reduces to `orderedStock − allocated` (change C6);
- `held` = Σ ACTIVE receipt holds, net of what has been consumed.

**Precision:** holds on lots are placed at 2 dp (the lot columns are Decimal(10,2)). Holds without a lot are kept at 3 dp.

## 5. Invariants
1. A requirement is in a PO status (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED, RECEIVED) **if and only if** it has a live link.
2. This feature creates at most one live link per requirement. Partial cover is a split child (the MRP-12 shape). Older rows with several links are tolerated.
3. Σ allocated on a line ≤ line stock + ε.
4. `link.receivedQuantity` = the greedy fill (§4). It is recomputed on approve, reverse, order cancel and link. 0 ≤ credit ≤ allocated, and Σ credit + Σ plain = the line total.
5. A link's ACTIVE receipt hold = credit − issued, as far as the pool's lots allow. It is 0 for an ineligible link.
6. Receipt holds never change `allocatedFromStock` or `shortfall`. Reconcile counts only Use Stock holds (`poLinkId IS NULL`).
7. No reversal takes a link's credit below what it has issued. Such a reversal is refused.
8. No lot is reversed while any hold remains on it after the line's link holds have been moved off it.
9. `fillOrder` changes only when links change, and only for links ranked after the last credited one.
10. **(C3)** On a CANCELLED or SHORT_CLOSED PO, every kept link has `allocated = received`, and reversal is refused while the line has credited links.

## 6. Backend

### 6.1 `helpers/receipt-split.helper.ts`
- Keep `splitReceiptAcrossLinks` exactly as it is: job-work and service links still split pro-rata.
- Add:
  ```ts
  STORE_POOL='STORE'; UNPLACED_POOL='UNPLACED'
  FillLink {id, allocated, fillOrder, dyer, eligible, floors: Record<pool,number>}
  FillResult {credit, creditByPool, plainStock, deficits}
  sortByFillOrder(links); fillLineReceipts(links, poolTotals); rankTail(links, credit, compare) -> Map<id,rank>
  ```
- Update the file header: PO links now fill in order; job-work and service links stay pro-rata.

### 6.2 `helpers/stock-reservation.helper.ts`
- `adjustLotReserved` becomes one atomic statement: `UPDATE … SET "quantityReserved" = GREATEST(0, "quantityReserved" + $delta)`. Today it reads and then writes (:41-57).
- `reserveOnLots(…, {poLinkId?})` stamps `poLinkId` on every row it writes. Rows without a lot are allowed when `poLinkId` is set.
- `activeRows(tx, ids, kind: 'stock'|'receipt'|'all')`; `heldForRequirement(…, kind)`; `releaseReservations(…, {kind})`.
- New:
  - `releaseLinkHolds(tx, linkIds)`;
  - `consumedByLinkPool(tx, linkIds)` (all statuses);
  - `untrackedHeldByMaterial(client, materialIds, {excludeOrderId?})`;
  - `receiptHeldByRequirement(client, ids)`.
- **(C8)** `consumeReservations` order: rows on issued lots first, then Use Stock rows, then receipt rows, newest first. Using the order's own stock first keeps receipt floors low, so fewer reversals are refused later.
- **(C9)** New `unconsumeReservations(tx, reqIds, qty, returnedLotIds)`. It works from the newest consumed rows (returned lots first). Each row's `consumedQuantity` goes down by the amount given back; a CONSUMED row becomes ACTIVE again, and its own lot's reserved goes back up.
- Silence the "no lot" warning (:188-192) for rows with `poLinkId` and for trim materials.

### 6.3 New `helpers/receipt-allocation.helper.ts`: the D1 and D2 engine
It must not import the mrp, grn, purchaseOrder or order services.
```ts
type ReceiptEvent = 'approve'|'reverse'|'order-cancel'|'link';
applyLineReceipts(tx, poItemIds, {event, userId}) -> LineReceiptOutcome[];
computeLineCredits(client, poItemId, {withLinks?}) -> LineCredits;   // read-only, also used by the dry run
lineCreditDeltasForGrn(client, grnId) -> Map<linkId, number>;       // cost only
requirementDyers(client, reqIds) -> Map<id, string|null>;
physicallyFreeForLine(client, poItemId, pool) -> number;            // C5
assertTrimHoldsCovered(tx, materialIds);
```

**`applyLineReceipts`** runs for each line, in id order:
1. **Lock:** `SELECT … FROM purchase_orders WHERE id IN (…) ORDER BY id FOR UPDATE`, then lock the line's link rows `ORDER BY id FOR UPDATE`.
2. **Load** the line and its links, with each requirement and order. If there are no links, stop.
3. **Pools** come from the approved GRN lines and their GRN warehouses.
4. **Dyers:** `requirementDyers`.
5. **Floors:** `consumedByLinkPool`. A lot's pool is the pool of the GRN whose line booked it.
6. **Fill.** If a deficit remains and the event is `reverse`, throw `GRN_REVERSAL_ISSUED`, naming the orders that issued the goods.
7. **Write** `receivedQuantity` only where it changed.
8. **Statuses**, per affected requirement, over all its links:
   - A link is complete when `isReceiptComplete(recv, alloc, tol)`, **or** the line is complete and the link's gap ≤ the line's gap + ε.
   - All complete → RECEIVED; received > ε → PARTIALLY_RECEIVED; otherwise PO_SENT.
   - The write is a guarded `updateMany` with status IN (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED, RECEIVED), skipping rows of cancelled orders.
   - The tolerance is `GRN_UNDER_RECEIPT_TOLERANCE_PERCENT` (as `mrp.service.ts:5031-5033`).
9. **Holds.** Run `releaseLinkHolds` on all the line's links. Then, per eligible link and pool, `want = creditByPool − consumed`:

   | Line kind | Where the hold goes |
   |---|---|
   | `lot-greige` | `greige_stock` with `grnItemId` among the pool's approved GRN lines, AVAILABLE, `greigeCountsForPlanning(lot, dyer)`, FIFO. Free = available − reserved, read after the release |
   | `lot-lace` | The same on `lace_stock`, using `laceCountsForPlanning` |
   | `untracked` (trim categories) | One row without a lot. Warehouse = that of the line's most recent approved GRN |
   | `none` (FABRIC, THREAD, "received as ready fabric") | Credits only, no holds |

   Never throw on approve or link: hold what the lots have and log the rest.
10. **Return** each link's before, after and held, the plain stock, and any hold shortfalls.

**Helper edits:**
- `derived-stock.helper.ts`: `getDerivedOnHandMap(ids, client = prisma)` so it can read inside a transaction.
- `grn-line-value.helper.ts`: add `grnLineStockQty`.

### 6.4 New `helpers/po-allocation.helper.ts`: the only place that creates or removes links on a sent PO
```ts
LINKABLE_PO_STATUSES = ['SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED'];
LINKABLE_PO_CATEGORIES = ['TRIMS','ACCESSORIES','GENERAL','BUTTON','ZIPPER','ELASTIC','LABEL','PACKAGING','OTHER_MATERIAL','GREIGE','LACE','GREIGE_LACE'];
NON_LINKABLE_MATERIAL_TYPES = ['THREAD','FABRIC','SERVICE','MACHINE_PART'];
LOCATED_CATEGORIES = ['GREIGE','GREIGE_LACE','LACE'];
LINKABLE_REQUIREMENT_STATUSES = ['PO_REQUIRED','PARTIAL_STOCK'];
RUNNING_ORDER_STATUSES = ['PENDING','IN_PRODUCTION'];   // rows with no order are allowed
// pure
compareFillPriority, suggestAllocations, lineFigures, sizeLinksForLine, lineLinkBlock, requirementLinkBlock, lineDeliveryHolders
// DB
getPoAllocation, allocatePoLines, allocatePoLinesInTx, undoPoAllocation, returnDemandAfterUnlink,
mintBalanceChild, assignLineFillOrder, releaseCancelledOrderLinks, freezeClosedPoLinks, batchGetOpenPOSupply
```

**`allocatePoLinesInTx`** runs with `{timeout: 30000, maxWait: 10000}`:
1. Lock the PO row, then re-check its status, category and `isActive`.
2. Load the items of this PO only. Each line must have a `materialId`, a linkable material type that fits the category (`po-line-category.helper.ts:51-68`), and no GRN on the line waiting for QC.
3. Collect every refusal reason into one `PO_ALLOCATION_REFUSED`:
   - status not allowlisted (SIZE_PENDING keeps its wording);
   - `requirementType ≠ MATERIAL` (this keeps out greige PROCESSING rows);
   - material mismatch;
   - colour mismatch, **skipped for GREIGE and GREIGE_LACE**;
   - unit mismatch;
   - a live PO or job-work link already exists;
   - the order is not running;
   - the same requirement twice in the request;
   - quantity above the shortfall (`qtyExceeds`, else `snapToLimit`);
   - located lines only: the dyer is not served by `lineDeliveryHolders` (the line's delivery points) or by the store.
4. Per line: `qtyExceeds(Σ requested, freeToLink)` → `PO_LINE_OVER_ALLOCATED`.
5. Guarded status change to PO_SENT. If the count differs, throw `PO_ALLOCATION_CHANGED`.
6. `createMany` the links at 3 dp. A P2002 becomes a BusinessError.
7. Where `qty < shortfall − 0.01`: `mintBalanceChild`, then set the parent's `shortfall := qty`.
8. `assignLineFillOrder`.
9. **(C5) Dry run** with `computeLineCredits`: for each pool, the new links' combined credit must be ≤ `physicallyFreeForLine(pool)`:
   - lots: Σ (available − reserved) over the line's own lots in that pool;
   - trims: derived on-hand − `untrackedHeldByMaterial`.

   Otherwise refuse: "Only N of the M that arrived on this line are still free — Use Stock for them". If any new link does get credit, call `applyLineReceipts(tx, lines, {event:'link'})` so those goods are held at once. Such links cannot be undone.
10. Re-sum each line: Σ allocated ≤ line stock + ε.
11. After commit: an audit log on `purchase_order` / UPDATE.

**`undoPoAllocation`:**
- Lock the PO. The link must belong to it.
- Refuse unless all of these hold:
  - the link's credit ≈ 0 and issued ≈ 0, with no ACTIVE holds;
  - no GRN on the line waiting for QC;
  - the requirement is PO_GENERATED or PO_SENT;
  - the requirement has no other live link.
- Then: delete the link; fold back untouched split children as plain CANCELLED (never `NOT_ORDERED`), adding their shortfall to the parent; run `returnDemandAfterUnlink`, then `assignLineFillOrder`, then write an audit log.

**`returnDemandAfterUnlink`** (shared by Undo, cancel, short-close and order cancel):
- It acts only on rows with no live link left, in PO_GENERATED, PO_SENT or PARTIALLY_RECEIVED (guarded).
- It first applies `surplusQty`.
- Then it picks the status:
  - order cancelled → CANCELLED, plus `releaseReservations`;
  - nothing left → FULFILLED_STOCK when `allocatedFromStock` > ε, else CANCELLED;
  - `allocatedFromStock` > ε → PARTIAL_STOCK;
  - otherwise PO_REQUIRED.

**`freezeClosedPoLinks(tx, poId)`** (C3): for every link kept by cancel or short-close, set `allocatedQuantity := receivedQuantity`.

**`releaseCancelledOrderLinks(tx, orderId, userId)`:**
1. Run `applyLineReceipts(event:'order-cancel')` on the order's linked lines.
2. Delete that order's links that now have zero credit and zero issued, then `returnDemandAfterUnlink` (the rows become CANCELLED).
3. `assignLineFillOrder`.

On a closed PO, every other link is frozen, so freed goods become plain stock.

**`batchGetOpenPOSupply(reqs)`** makes three batched queries and attaches supply only to allowlisted, unlinked MATERIAL rows. Each entry is:
```
{purchaseOrderId, poNumber, poStatus, poCategory, supplierName, expectedDeliveryDate, purchaseOrderItemId, lineUnit,
 stockUnitsPerUnit, orderedStockQty, arrivedQty, allocatedQty, freeToLink, arrivedFree, toCome, unlinkedDemandQty,
 deliversTo[], linkable, blockedReason, arrivesLate}
```
When `arrivedFree > ε` but none of it is still free, the reason is "N arrived as stock — Use Stock".

### 6.5 Endpoints and permissions (D4)
- New `routes/po-allocation.routes.ts`, following `weaver.routes.ts:14-22`:
  - `authenticateToken`;
  - `GET /:poId` for any signed-in user;
  - `POST /:poId` and `DELETE /:poId/links/:linkId`, each with `requireAnyPermission('mrp','purchaseOrders')`.
  - Mount with `router.use('/po-allocations', …)` next to `routes/index.ts:290-295`.
- New `controllers/po-allocation.controller.ts` and `schemas/po-allocation.schema.ts`: `{allocations: [{purchaseOrderItemId, requirementId, quantity}] .min(1).max(500)}`.
- `POST /mrp/requirements/:id/link-po` stays behind the `mrp` gate. Its pre-checks stay first (`mrp.service.ts:4760-4795`), so the dirty sizes-later test passes unedited. It then delegates to `allocatePoLinesInTx`.
- Tests: `route-write-guard` already accepts `requireAnyPermission`.

### 6.6 Receipt crediting (D1): `grn.service.ts` (WP-D, after the other terminal commits)
- **Approve:**
  - In the generic loop, collect `poItemId` instead of the credit call at :1750-1752.
  - After :1807, call `applyLineReceipts(tx, sortedIds, {event:'approve'})`.
  - Pre-check: refuse "received as ready fabric" on a line that has links (`GRN_READY_FABRIC_LINKED`).
- **Reverse:**
  - **(C2)** Next to the SHORT_CLOSED guard (:2793-2799), refuse when the PO is CANCELLED and any of the GRN's lines has a link with credit > ε: "`GRN_PO_CLOSED_LINKED` … administrator correction".
  - Keep the delta call at :2841 **only for PROCESSING**.
  - For other categories: collect the items, then call `applyLineReceipts(…, 'reverse')` after the loop (:2874) and before :2877.
  - After :2877, call `assertTrimHoldsCovered` for trim lines.
- **PROCESSING** stays pro-rata and unchanged (:1672). Fix the doc comments at `mrp.service.ts:5007` and `po-status-manager.service.ts:54,61`.
- **Lot guards** in `reverseSpecializedStockInTx`, after the used checks for greige (:4003-4010) and lace (~:4146-4152): refuse with `GRN_LOT_HELD` when `quantityReserved > ε`, naming who holds it.
- **Lace unit:** book the lace lot at `grnLineActualQty(item)` instead of `Number(item.acceptedQuantity)` (:2303 and its uses).
- **Cost** (`grn.controller.ts:260-289`): `actualCost × delta / stockQuantity` per link, using `lineCreditDeltasForGrn`. Plain stock is charged to no style. Credits made at link time (C5) carry no GRN cost; this is FYI.

### 6.7 Holds (D2)

| Type | Held on | Readers that net it | What consumes it / gives it back | Reversal |
|---|---|---|---|---|
| GREIGE | The line's `greige_stock` lots, per pool | Already net: `netFreeGreige` (`mrp.service.ts:847-853`), MRP calculation, Use Stock `freeOf` (:3102-3103) | Job-work issue (`job-work-issuance.service.ts:1130-1142`). **(C9)** Job-work cancel (~:1659-1730) calls `unconsumeReservations` for the returned lots | Holds moved before :2877; `GRN_LOT_HELD` |
| LACE / GREIGE_LACE | `lace_stock` lots | `netFreeLace` (:875-881); greige-lace MATERIAL rows are never netted | Job work; **new** challan lace branch (`challan.service.ts:478+`) | The same |
| Trims | ACTIVE row without a lot | **New:** `batchGetCurrentStock` generic branch (:960, batched), MRP calculation (:1636), a trims cap in `allocateStock` (:3172-3189), the work-order issue data (`workOrder.controller.ts:798`) | **New:** challan trim branch (:605-637) consumes the holds of `challan.orderId`'s MATERIAL rows for `item.materialId`. **(C9)** Challan receive-back (:1047-1088) calls `unconsumeReservations` | `assertTrimHoldsCovered` |

- **Issue gates** (hard block, Q2):
  - challan trim branch: `qty ≤ onHand − untrackedHeld(excludeOrderId)`;
  - challan lace branch and job-work pre-checks (greige :537-543, lace :343-348): `qty ≤ available − (reserved − this job's own holds)`.
- **Order cancel** (`order.service.ts:744-759`): after the existing release, call `releaseCancelledOrderLinks`.
- **Reconcile** (`requirement-reconcile.helper.ts:245-247, 304-305`) uses `kind:'stock'`.
- **(C13) Lace allocation guard:** `laceStock.service.ts:589/688` (`lace_stock_allocation`) refuses a lot that has ACTIVE `stock_reservations`. The two meanings of "reserved" would otherwise subtract twice. Live: 0 lace lots.
- **Challan receive** (:1083-1087): skip the forced FULFILLED_STOCK when the requirement has a live PO link.

### 6.8 Greige, lace and greige lace (D3)
- **Demand is `requirementType='MATERIAL'` only.** PROCESSING rows share the `materialId`. Do not exclude rows by `linkedRequirementId`: convert-to-greige rows have it set.
- **Dyer:** use `requirementDyers`. `allocateStock` for greige and lace (:3137, :3150) switches to it too. Today it uses the row's own `processorId`, which is null live.
- **Delivery check at link time:** `po_delivery_point_lines` or the header `deliveryLocationId`.
  - A delivery plan amended after linking (`purchaseOrder.service.ts:2220, 2235`) shows `deliveryMismatch` on the card. At receipt, the pools decide.
- **(C10) The dyer changes after the cloth arrives:** the next recompute moves the credit and hold off cloth now at the wrong dyer (planning's rule). The card shows "at Mangal — order now dyed at Aryan: transfer or change dyer".
- **Greige lace:** there is only a greige-lace MATERIAL row plus a PROCESSING row (`mrp.service.ts:1936-1960`), so a LACE PO cannot double-cover it. Planning is unchanged; the holds show only in Use Stock.
- **Fabric: not in this change.** The other terminal's uncommitted `grn.service.ts` work now writes `fabric_stock.grnItemId`, and reversal finds the lot by it and refuses used lots. Once that lands, two blockers are gone. Still blocking:
  - cutting and challan issue never consume holds (the batch keeps its own `fabric_stock_allocation`);
  - MRP nets fabric at the BOM width;
  - fabric in a processor's unit is not usable;
  - the lot-pieces work is still in flight.
- **Thread: no.**
  - A requirement counts garments, while thread is stocked in cones or tubes on a separate pack row (`grn.service.ts:184-208`).
  - MRP refuses to buy thread from requirements (`mrp.service.ts:3546-3554`).
  - The reservation helper has no thread lot table.

### 6.9 Guards on other paths
- **`mrp.service.ts`:**
  - `allocateStock` (:3039): allowlist PENDING, PO_REQUIRED and PARTIAL_STOCK; refuse a row with a live link; guarded write; trims cap.
  - `updateRequirementStatus` (:4829): refuse to leave a PO status while a live link exists, and refuse to enter one without a link.
  - `cancelRequirement` (:4881): new message.
  - `generatePOFromRequirements` (link at :4612): `alloc = min(shortfall, pro-rata share)`, then `assignLineFillOrder`.
  - `linkRequirementToPO` (:4760) delegates to `allocatePoLinesInTx`.
  - `greigeRequirementProcessors` delegates to `requirementDyers`.
- **`purchaseOrder.service.ts`:**
  - `freeUndeliveredRequirements` (:204-225): delete the links, then `returnDemandAfterUnlink`.
  - Cancel (:1487-1517) and short-close (:1653-1695): call **`freezeClosedPoLinks`** (C3). Cancel with part received also sets RECEIVED.
  - `mintBalanceRequirement` delegates to `mintBalanceChild`.
- **`unified-po-creation.service.ts`:** a live link becomes an error (:276-281); sizes come from `sizeLinksForLine` (:637-647); the status change happens inside the transaction.

### 6.10 Status transitions
There are no new state-machine edges, and every write is a guarded `updateMany`.

| Event | Transition |
|---|---|
| Link | PO_REQUIRED or PARTIAL_STOCK → PO_SENT. With C5, it can go straight to RECEIVED or PARTIALLY_RECEIVED |
| Approve, reverse, order cancel, link recompute | RECEIVED / PARTIALLY_RECEIVED / PO_SENT |
| Undo, freed zero-credit links | Through `returnDemandAfterUnlink` |
| Short-close | RECEIVED, `shortfall := received`, links frozen |

## 7. Frontend

**PO page** (`PurchaseOrderDetail.tsx`, clean)
- An "Allocate to orders" button. It is shown when the PO can receive goods, the user has `canAny('mrp','purchaseOrders')`, and some line has candidates.
- A banner for running orders that are not linked.
- New `PoAllocationCard`:
  - per line: Ordered / Arrived / Linked / Received for orders / Held / Free to link / Arrived free / To come;
  - greige lines show "Delivers to", each link's dyer, and the dyer-moved flag;
  - links in `fillOrder`; Undo with a reason shown when it is not allowed.
- New `AllocateToOrdersDialog`: rows in server order with a Late badge; live "left free" figures. Rows that would be credited from goods already here get the badge "N already here — held at once, can't be undone" (C5).
- `lib/po-allocation-split.ts`, `services/poAllocation.service.ts`, `types/po-allocation.types.ts`, and `queryKeys.poAllocation`.
- Tidy-ups at :675 and :684-685.

**Requirements page** (run `npm run notice` first)
- New `OpenPOSupplyNote`, for example "PO2609-0231 · 4,530 free · not linked (unlinked orders need 2,941)".
  - With goods already in: "559 here + 1,030 to come".
  - Greige lines add "delivers to …".
- A Link button, behind `canAny`.
- `OrderStyleLabelView.tsx`: an `onLinkPO` prop, size-row notes, a Link button, the heading "Open PO covers 6/6 sizes", and "on PO…" for linked rows.
- `UnifiedRequirementsPage.tsx`: the note and Link, a group header, a selection-bar hint, and the stat card renamed "On PO / JWO". **This waits for the other terminal.**
- `order-style-groups.ts`: fix the doubled parent-plus-child total.
- `BulkPOGenerationDialog.tsx`: a warning at step 1.
- `types/mrp.types.ts`: `openPOSupply`, `poLinks[].fillOrder/heldQuantity/issuedQuantity`, `receiptHeldQty`.

## 8. Edge cases (the critic's rows are marked ★)

| Case | Behaviour |
|---|---|
| PO is not SENT, ACKNOWLEDGED or PARTIALLY_RECEIVED | Not linkable |
| Part delivery | 1,000 XS → 350 / 322 / 253 / 75 / 0 … |
| More arrives than Σ allocated | Plain stock |
| GRN waiting for QC | Not counted; Link and Undo refused on that line |
| Partial QC reject | Only the accepted stock quantity counts (:1700) |
| Two approvals on one line at once | PO and link row locks, then a recompute from committed totals |
| Reversal that would un-credit issued goods | `GRN_REVERSAL_ISSUED` |
| ★ Reversal on a CANCELLED PO whose line has credited links | `GRN_PO_CLOSED_LINKED` (short-close is already refused) |
| ★ Order cancelled after short-close or cancel | Links are frozen, so its credit becomes plain stock. No other row goes above its shortfall |
| Reversing a lot another requirement holds | `GRN_LOT_HELD` |
| ★ Linking a line whose goods partly arrived, surplus still free | Allowed. New links take the arrived goods first and hold them. Undo is refused for those links |
| ★ The same, but the surplus has been used or held elsewhere | Refused: "only N of M arrived are free — Use Stock" |
| ★ A zero-credit link to dyer B ranked before a credited link to dyer A | Keeps its rank. Only the tail is re-sorted |
| ★ The dyer changes after arrival | Credit and hold move at the next recompute; the card flags it |
| ★ A JOB_WORK unit linked to no supplier receives greige | UNPLACED pool; plain stock |
| ★ Job-work cancel or challan receive-back | The hold is restored (`unconsumeReservations`) |
| ★ Lace allocation on a held lot | Refused |
| Order date changes after arrival | No credit moves |
| Cancelled order | Its credit above what it issued passes on; its zero-credit links are released (Q1) |
| Greige received at dyer A | Fills A's links, then links with no dyer; the store fills anyone |
| Colour | Skipped for GREIGE and GREIGE_LACE |
| "Received as ready fabric" on a linked line | Refused |
| FABRIC, THREAD, SERVICE, MACHINE_PART, PROCESSING | Not linkable; PROCESSING stays pro-rata |
| MRP or Unified PO line above the need | Links capped; the excess is free (16 gross for 2,300 → 4 free) |
| Size labels issued under the base LBL-0004 | Holds are not consumed (Q3) |
| Manual stock-out or Stock-Out TRANSFER of a held lot | Not order-bound; the hold stays on the source lot (known gap) |
| ★ PO print/list "for buyer" | Now resolved from the linked orders (`po-for-buyer.helper.ts:48-63`). FYI |

## 9. Tests
All earlier tests stay. Add:

**Unit**
- `receipt-fill.test.ts`: the XS and reversal tables; pools A/B/C; UNPLACED; floors and deficits; the tail-only re-rank is neutral, **including the pooled case where a zero-credit dyer-B link sits before a credited dyer-A link**.
- `po-allocation.helper.test.ts`: the `freeToLink` formula for trims and for pooled lines.
- `stock-reservation.helper` unit tests: the consume order (C8) and `unconsumeReservations`.

**Integration**
- `receipt-allocation.test.ts`: A → B → reverse, in every order.
- `po-allocation-lifecycle.test.ts`:
  - ★ cancel after GRN-A, then reverse GRN-A → refused;
  - ★ short-close, then cancel order 2 → link 4 stays at its received amount, and plain stock rises;
  - ★ freeze on close.
- `po-allocation.test.ts`:
  - ★ a line with 3,500 arrived and 2,941 linked: link 400 more → credited and held at once, Undo refused;
  - ★ Use Stock takes 300 of the surplus first → linking 400 is refused (259 free).
- `po-allocation-holds.test.ts`:
  - ★ a job-work cancel restores the greige hold;
  - ★ a challan trim receive-back restores the hold;
  - ★ lace allocation on a held lot is refused.
- `po-allocation-receipts.test.ts`: ★ a GRN into a JOB_WORK unit with no supplier leaves plain stock.

**Re-run** the earlier list.

**Every work package:** `npm run type-check`, `npx tsc -b`, and jest on the touched tests. No builds.

## 10. Work packages
`git commit -- <own files>` only. **Other terminals are editing:** `grn.service.ts`, `challan.service.ts`, `mrp.service.ts`, `greige-stock.service.ts`, `work-order-service-requirement.service.ts`, `stockLevel.service.ts`, `UnifiedRequirementsPage.tsx`, `fabric-lot-pieces.service.ts`, `lot-pieces.helper.ts`, and the files listed in round 2.

| WP | Needs | Files |
|---|---|---|
| **A: engine** | Nothing: the schema is clean now. Apply the migration first | `schema.prisma`; the migration; `receipt-split.helper.ts`; `stock-reservation.helper.ts`; `grn-line-value.helper.ts`; `derived-stock.helper.ts`; NEW `receipt-allocation.helper.ts`; `receipt-fill.test.ts`; `receipt-allocation.test.ts` |
| **B: links** | A | NEW `po-allocation.helper.ts` and its tests |
| **F1: PO lifecycle** | B | `purchaseOrder.service.ts`; `unified-po-creation.service.ts`; lifecycle test |
| **F2a: holds (clean files)** | B | `order.service.ts`; `job-work-issuance.service.ts` (gates and the C9 un-consume; do not touch its dirty unit test); `requirement-reconcile.helper.ts`; `workOrder.controller.ts`; `laceStock.service.ts` (C13); holds test |
| **D: GRN** | A, and the **other terminal has committed `grn.service.ts`** | `grn.service.ts`; `grn.controller.ts`; `po-status-manager.service.ts` comments; receipts test |
| **E: MRP** | B, and **`mrp.service.ts` committed** | `mrp.service.ts`; `types/mrp.types.ts`; `mrp-buttons-by-gross.test.ts` (2304 → 2300); requirements test |
| **F2b: challan** | B, and **`challan.service.ts` committed** | `challan.service.ts`: trim and lace consumption, gates, C9 receive-back, the FULFILLED_STOCK skip |
| **C: API** | B; committed after D, E, F1, F2a and F2b | routes, controller, schema, `routes/index.ts`, API test |
| **G: PO page** | C | frontend PO files |
| **H: Requirements page** | G, E, and **`UnifiedRequirementsPage.tsx` committed** | requirements UI files |
| **I: docs** | H | `/update-ai-guides` (coordinate on `manifest.json`, which is dirty) |
| **J: deferred** | the trim controllers are committed | "Held for orders" on the stock pages; size-wise label issue |

**Order:** A → (B ∥ F1-prep) → (F1 ∥ F2a) → D → E → F2b → C → G → H → I.
- A, B, F1 and F2a can start now.
- Shipping D before C is safe: nothing changes until links exist.

## 11. Verification walks
Unchanged from round 2 (XS table; greige fixture on GRG-0042 at Mangal), plus:
- **Walk A, step 7 (★):** cancel the PO after GRN-A, then try to reverse GRN-A → refused. SELECT shows links 1–3 frozen at their received amount and link 4 at 75.
- **Walk A, step 8 (★):** on a fresh fixture, 3,500 arrive (559 plain). Link one new requirement for 400 → PO_SENT goes straight to RECEIVED, with 400 held; the XS free figure falls from 559 to 159.
- **Walk B (★):** cancel the ORD…030 dyeing job after issuing 2,000 m → MR…0157's hold is back to 3,823.53 on the Mangal lot.

---

## Changes made by the critic
- **C1 Git and planning:**
  - `schema.prisma` is clean now (`e1026d7d`), so WP-A is unblocked.
  - `grn.service.ts`, `challan.service.ts`, `mrp.service.ts`, `greige-stock.service.ts`, `stockLevel.service.ts`, `work-order-service-requirement.service.ts` and `UnifiedRequirementsPage.tsx` are newly dirty. D, E, the challan part of F2 (split out as F2b) and H now wait for that terminal. Line numbers were re-based on the working copy.
- **C2** Reversal on a CANCELLED PO whose lines have credited links is refused. Today only SHORT_CLOSED is refused (`grn.service.ts:2793`). Otherwise credits fall under a balance child that was already created, and rows show PO_SENT on a dead PO.
- **C3** Cancel and short-close set `allocated := received` on kept links. Without this, a later order cancel pushes credit above `shortfall := received` (`purchaseOrder.service.ts:1680`).
- **C4** Only the zero-credit tail after the last credited link is re-sorted. Re-sorting every zero-credit link demoted earlier-dated orders to another dyer on lines delivered to several dyers. Neutrality is proved in §4.
- **C5** A line with arrived surplus can now be linked. New links take the free arrived goods first, and a dry run checks those goods are physically free. The old rule blocked the still-to-come part for ever.
- **C6** `freeToLink = max(0, plainReachable + toCome − uncredited)`. The old `ordered − max(allocated, arrived)` over-promised on lines split across dyers.
- **C7** A JOB_WORK unit linked to no supplier is the UNPLACED pool, matching `lot-location.helper.ts:171-175`. It was STORE.
- **C8** Consumption uses the order's own stock (Use Stock) holds before receipt holds, so fewer reversals are refused.
- **C9** New `unconsumeReservations`: job-work cancel and challan receive-back give the order's hold back. Before, returned cloth came back free (`job-work-issuance.service.ts` ~1659-1730).
- **C10** A dyer change after arrival moves credit at the next recompute. This is documented and flagged on the card. A delivery plan amended after linking shows a warning.
- **C11** Fabric: the other terminal's uncommitted change adds `grnItemId` to fabric lots and a used-lot refusal. Fabric stays out for the other reasons listed in §6.8.
- **C12** FYI: linking changes a manual PO's derived buyer (`po-for-buyer.helper.ts:48-63`).
- **C13** Lace allocation (`laceStock.service.ts:589/688`) refuses lots that carry holds, because the two meanings of "reserved" would subtract twice. `reserveGreigeStock` has no callers, so there is no greige clash.

## Remaining owner questions
1. **Cancelled order after goods arrived.** Default: its goods pass to the next linked order, the rest becomes free stock, and goods it already issued stay credited. On a closed PO they become free stock straight away. Confirm?
2. **Issuing goods held for another order.** Default: a hard block that names the order. Or offer a "take them anyway" confirmation? This also applies to today's 2 greige Use Stock holds.
3. **Size labels.** Work orders issue the base LBL-0004, so size holds are only released when the order is cancelled. Build size-wise label issue next (WP-J)?
4. **Completed or dispatched orders still holding received goods.** Release them automatically? That touches `order-status.helper.ts`, which another terminal is editing.
5. **★ Linking a part-delivered line.** Goods that have already arrived are held at once for the newly linked orders, and those links can't be undone. Or should arrived surplus only ever be taken through Use Stock, so a line with surplus can't be linked at all?
6. **★ Dyer changed after the cloth arrived.** Move the credit and hold automatically (default), or keep it and just warn?
7. **FYI:**
   - cost-sheet actuals replace instead of adding (`costSheet.service.ts:265-270`);
   - credits made at link time carry no GRN cost;
   - linked manual POs now show a buyer.

### Critical Files for Implementation
- C:\Users\NEW\garment-erp\backend\src\services\helpers\receipt-allocation.helper.ts (new: D1 recompute, pools, floors, D2 holds, the link-time dry run)
- C:\Users\NEW\garment-erp\backend\src\services\helpers\po-allocation.helper.ts (new: link, undo, tail re-ranking, `freezeClosedPoLinks`, open-PO supply)
- C:\Users\NEW\garment-erp\backend\src\services\helpers\stock-reservation.helper.ts (`poLinkId`, hold kinds, atomic lot update, consume order, `unconsumeReservations`, trim netting)
- C:\Users\NEW\garment-erp\backend\src\services\grn.service.ts (approve :1750-1807, reverse :2793-2877 including the C2 guard, lot guards :4003/:4146, lace :2303; wait for the other terminal)
- C:\Users\NEW\garment-erp\backend\src\services\purchaseOrder.service.ts (cancel :1487-1517 and short-close :1653-1695 with the freeze, `freeUndeliveredRequirements` :204-225)

---

# Appendix — round-1 synthesis (superseded where round 2 differs)

**Pick.** Design B is the base. It sets the helper contract up front, puts the endpoints on the PO router with the `purchaseOrders` permission, takes a PO-row lock, and checks colour and unit. It is also the only design that guards `allocateStock`, the status PATCH and the cancel path. Four things come from Design A:
- The receipt split stays as it is, with one fix: link credit is capped at the allocation in `loadRequirementShares`. B's phantom "free share" is dropped.
- Cost apportioning is a pure `linkCostShare` function in the helper. No new cost helper file.
- The dialog's default split is recomputed on the client (`walkDefaultSplit`) when the user unticks or edits a row.
- A smaller scope: B's rewrite of `po-item-link-release.helper.ts` is left out. That helper only runs on pre-send POs (purchaseOrder.service.ts:687-694, 971-997, 1247-1268), so it can never touch a link to a sent PO.

**Why receipts stay unchanged.** The owner's priority is running orders first. The current uncapped split gives every delivered piece to the linked orders, and only what arrives beyond their total is left over (receipt-split.helper.ts:101-136). With B's free share, a partial delivery of 2,941 XS would leave all 9 orders at 65% received. The other 1,031 pieces would sit as unclaimed stock that MRP then offers to future styles. That is the opposite of the owner's priority. It would also touch a helper whose "split is its own inverse" rule is load-bearing (receipt-split.helper.ts:25-39).

## What both designs missed (checked read-only)

| # | Finding | Evidence | Effect on the design |
|---|---|---|---|
| M1 | `updateCostSheetActuals` **replaces** the style's actual cost instead of adding to it. So a style's "actual" is always just the last GRN's cost. This bug is already there. | costSheet.service.ts:265-270; called per style from grn.controller.ts:291+ | Still apportion by `linkCostShare`: otherwise each of the 9 styles is charged the whole order, about ₹19.5k instead of its own ≈₹1.4k. Walk and test assertions must be about one GRN only. The replace bug goes to the owner as FYI. |
| M2 | The "PO / JWO Generated" stat card counts only PO_GENERATED. Rows linked to a sent PO (PO_SENT) would disappear from every card except Total. | UnifiedRequirementsPage.tsx:243-244; mrp.service.ts:2911-2917 | WP-F: the card adds `awaitingReceipt` and is renamed "On PO / JWO". |
| M3 | B's undo would clear `surplusQty` and return the row to PO_REQUIRED at its old, larger quantity. Reconcile only resizes open rows on the next recalculation. | requirement-reconcile.helper.ts:259-268, 380-389 | Undo **applies** the surplus instead: the row shrinks by surplusQty, then surplusQty is cleared. If nothing is left the row goes to CANCELLED. |
| M4 | Undoing one link on a requirement that still has another live link would lose the undone quantity from the plan. Neither design handles this. | purchaseOrder.service.ts:177-183 says several links per requirement are possible | Undo refuses in that case: "covered by several PO lines — cancel or short-close instead". This feature itself only ever makes one link per requirement. |
| M5 | The existing link-po endpoint sits on the `mrp` permission, which INVENTORY and PRODUCTION_MANAGER hold. `purchaseOrders` is only ADMIN, PURCHASE and MERCHANDISER. A's note that "every PO role has mrp" is true, but the reverse is not. | permissions.config.ts:63, 87; mrp.routes.ts:42, 174-179 | New endpoints go on the PO router (purchaseOrder.routes.ts:53). Also add `requirePermission('purchaseOrders')` (auth.middleware.ts:113) to `/mrp/requirements/:id/link-po`. |
| M6 | No extra lock is needed on cancel. Cancel first claims the PO row with a conditional `updateMany`, then reads links in a later statement. A `SELECT … FOR UPDATE` held by the allocation therefore serialises the two correctly. **Do not also lock item rows**: createGRN updates items before the PO row, so that lock order could deadlock. The race with an unlocked item is harmless, because the link set is fixed before approval. | purchaseOrder.service.ts:1451-1487; grn.service.ts:584-595 | Lock the PO row only. |
| M7 | "The line has received nothing" is the right freeze rule. createGRN increments before QC, QC rejects decrement at approval, and reversal decrements. | grn.service.ts:584-595, 1764-1766, 2818-2820 | Also refuse when a PENDING_QC GRN touches the item. This is cheap and a safety net. |
| M8 | Unguarded side doors. Challan receive sets FULFILLED_STOCK without any guard. Unified PO with source MRP only **warns** on a non-orderable requirement, so a linked row could go on a second PO through the API (no frontend caller found). | challan.service.ts:1061-1065; unified-po-creation.service.ts:276-281 | Make the unified-PO warning an error when a live link exists (WP-D). Leave challan as is (low risk; note it). |
| M9 | Linking makes all 9 orders impossible to delete; they can only be cancelled. | order.service.ts:961-981 | Tell the owner. No code change. |
| M10 | Order & Style view: when a requirement is split, the row adds parent and child `totalRequired` together, so "Required" is doubled in the All / On order views. Already true for MRP-12 splits; partial links make it more common. | order-style-groups.ts:73-77; mrp.service.ts:4709-4713 | Small fix in WP-F: in a merged row, don't add a child's `totalRequired` when its parent is in the same row. |
| M11 | The sizes-later test is currently modified by another terminal. It calls the service with random PO ids and expects the "size breakdown" error. | git status `MM`; sizes-later-workflow.test.ts:205-227 | Keep the SIZE_PENDING check before any PO lookup. Do not touch that file. |
| M12 | PO_SENT is the intended status for a requirement on a sent PO. | backend/scripts/recompute-requirement-statuses.ts:75-91 | Confirms the choice. |

**Claims re-checked and holding:**
- `linkRequirementToPO` uses a denylist and checks no PO, line or quantity (mrp.service.ts:4749-4813).
- `updateReceivedQuantity` writes the status with no guard (5077-5080). This matters only if a linked row gets CANCELLED; the new status guard prevents that.
- `allocateStock` has no status guard and works from `totalRequired − allocatedFromStock` (3040-3059), which would erase a split parent.
- `loadRequirementShares` does not cap received at allocated (purchaseOrder.service.ts:190-194), and short-close sets `shortfall := received` (1680).
- Live DB, re-checked today: PO2609-0231 is SENT with 0 links and 0 GRN lines. 9 PO_REQUIRED rows per size with shortfalls 2941 / 4301 / 4695 / 4281 / 3179 / 1804. There are 8 CANCELLED base LBL-0004 rows (not 7).

---

# FINAL DESIGN: allocate a sent PO to running orders

## Context
- PO2609-0231 (NRM, ACCESSORIES, SENT, MANUAL) has 6 LBL-0004 size lines in PIECE with no factor. Nothing is linked and nothing received.
- 54 PO_REQUIRED requirements across 9 running Easybuy orders need 21,201 pieces. The PO holds 32,530, leaving 11,329 free.
- `requirement_po_links` (schema.prisma:4133-4148) is enough. **There is no schema change.**
- Owner rules:
  - only sent POs can be linked;
  - the default gives every order its full shortfall, earliest first, and the user can untick or edit;
  - MRP only suggests, never links on its own;
  - a link can be undone before goods arrive;
  - styles with no order get nothing, and their share stays free on the PO.

## Data and unit rules
- **Link quantity is in the stock unit** (the requirement's unit). Line stock quantity = `toStockQty(orderedQuantity, stockUnitsPerUnit)` (purchase-unit.helper.ts:46-49), so 16 GROSS is 2,304 pieces.
- **Free on a line** = line stock quantity − Σ `allocatedQuantity` on that line. It is computed, never stored.
- **Units must match:** the line's stock unit is `materials.unit` (every PO writer resolves it that way, purchase-unit.helper.ts:129-156), and `requirement.unit` must normalise to the same unit.
- **Invariants:**
  - I1: a requirement is in a PO status if and only if it has a live link.
  - I2: at most one live PO link per requirement. A partial cover becomes a split child (the MRP-12 shape), never a second link.
  - I3: Σ links on a line ≤ line stock quantity + ε.
  - I4: a line's links are frozen once the line has any receipt, or has a GRN waiting for QC.
  - I5: receipts use the existing uncapped pro-rata split over links, so linked orders fill first. Every reader caps link credit at the allocation.
  - I6: `shortfall` means "what was bought for this row". Linking does not change it except when splitting.

## Backend

### New `backend/src/services/helpers/po-allocation.helper.ts` (the only place that creates or removes links on an existing PO)
It must not import `mrp.service` or `purchaseOrder.service`.
```ts
export const LINKABLE_PO_STATUSES = ['SENT','ACKNOWLEDGED','PARTIALLY_RECEIVED'] as const;          // = purchaseOrder.service.ts:2089
export const LINKABLE_PO_CATEGORIES = ['TRIMS','ACCESSORIES','GENERAL','BUTTON','ZIPPER','ELASTIC','LABEL','PACKAGING','OTHER_MATERIAL'] as const; // allowlist (enum schema.prisma:9973)
export const NON_LINKABLE_MATERIAL_TYPES = ['THREAD','GREIGE','FABRIC','LACE','SERVICE','MACHINE_PART'] as const;
export const LINKABLE_REQUIREMENT_STATUSES = ['PO_REQUIRED','PARTIAL_STOCK'] as const;              // = NEEDS_PO_WHERE mrp.service.ts:127-132
export const RUNNING_ORDER_STATUSES = ['PENDING','IN_PRODUCTION'] as const;                         // orderless (manual) requirement allowed
// pure
lineFree(item, links) -> {orderedStock, allocated, free}
lineLinkBlock(po, item, hasPendingQcGrn) -> string|null
requirementLinkBlock(req, item, material, order) -> string|null
sortCandidates(cands)       // orders.expectedDeliveryDate asc nulls last, requiredDate, orderNumber, requirementNumber
suggestAllocations(lines, cands) -> Map<reqId,{itemId,qty}>   // lines in PO_LINE_ORDER; a requirement suggested on ≤1 line
linkCostShare(allocated, sumAllocatedOnLine, lineStockQty) = allocated / max(sumAllocated, lineStockQty)
// DB
getPoAllocation(poId, {itemIds?}) ; allocatePoLines(poId, allocs, userId) ; allocatePoLinesInTx(tx, …)
undoPoAllocation(poId, linkId, userId) ; returnDemandAfterUnlink(tx, rows, ctx) ; mintBalanceChild(tx, req, balance, userId)
batchGetOpenPOSupply(reqs) -> Map<reqId, OpenPOSupplyLine[]>
```
`mintBalanceChild` is the merge of the fields copied at mrp.service.ts:4665-4706 and purchaseOrder.service.ts:238-272. It numbers the child with `generateAtomicDocNumber('MR', tx)`.

**`allocatePoLinesInTx`** runs with `{timeout: 30000, maxWait: 10000}`:
1. `SELECT id FROM purchase_orders WHERE id=$1 FOR UPDATE` (the pattern at po-delivery-plan.helper.ts:264). Then re-read the PO: its status must be linkable, its category allowlisted, and `isActive` true.
2. Load the items, filtered by `poId`, so a line from another PO is refused. For each line check:
   - `materialId` is not null;
   - the material type is linkable;
   - `receivedQuantity` ≈ 0;
   - no PENDING_QC GRN touches the item.
3. Load the requirements with their order status, live PO/JWO links and children. Refuse when any of these holds:
   - status is not allowlisted. SIZE_PENDING keeps the wording "awaiting the order's size breakdown".
   - `requirementType` ≠ MATERIAL;
   - `materialId` ≠ the line's material, or the colours differ when both sides have one (case- and space-insensitive);
   - the units don't match;
   - the requirement already has a live link (PO or JWO);
   - the order status is not running;
   - the requirement appears twice in the request;
   - `qtyExceeds(qty, shortfall)`. Otherwise `snapToLimit`.

   Collect every reason and throw a single `BusinessError('PO_ALLOCATION_REFUSED', {rows})`.
4. For each line, if `qtyExceeds(Σrequested, free)`, throw `PO_LINE_OVER_ALLOCATED {itemId, free, requested}`.
5. Guarded flip: `updateMany({id in ids, status in allowlist}) → PO_SENT`. If the count doesn't match, throw `PO_ALLOCATION_CHANGED`.
6. `createMany` the links at 3 dp. Turn a P2002 into a BusinessError.
7. Where `qty < shortfall − 0.01`: `mintBalanceChild(shortfall − qty)`, then set the parent's `shortfall := qty`. This is exactly MRP-12 (mrp.service.ts:4649-4716).
8. Re-sum each line's links and check Σ ≤ line stock quantity + ε.
9. After commit, write `createAuditLog` (audit.service.ts:65): entity `purchase_order`, action UPDATE, with `{allocations:[{requirementNumber, orderNumber, qty}], splits}`.

**`undoPoAllocation`:**
1. Lock the PO. The link must belong to this PO and the PO must be open.
2. Refuse unless all of these hold:
   - line received ≈ 0 and link received ≈ 0;
   - no PENDING_QC GRN on the item;
   - the requirement is PO_GENERATED or PO_SENT;
   - **no other live link** on the requirement (M4).
   
   MRP-generated links can be undone under the same rules, which frees their quantity for someone else.
3. Delete the link.
4. Fold back untouched split children. A child qualifies when:
   - `splitFromId` = this requirement and status is PO_REQUIRED;
   - `allocatedFromStock` ≈ 0;
   - it has no links, no challan items and no children of its own.

   Qualifying children become CANCELLED, with a plain CANCELLED and **never** `shortCloseReason=NOT_ORDERED`, which reconcile would read as "declined" (reconcile.helper.ts:201-203). Their shortfall is added back to the parent.
5. Call `returnDemandAfterUnlink`.
6. Write an audit log.

**`returnDemandAfterUnlink(tx, rows:{id, addShortfall?}[], ctx)`** is shared by Undo and PO cancel:
- It only touches rows with no remaining live link, and only while status is PO_GENERATED, PO_SENT or PARTIALLY_RECEIVED (guarded write).
- It first applies `surplusQty` if set: `totalRequired` and `shortfall` each drop by the surplus, never below 0, and surplusQty becomes null (M3).
- Then it picks the status:
  - order CANCELLED → CANCELLED, plus `releaseReservations`;
  - nothing left after the surplus → FULFILLED_STOCK if `allocatedFromStock` > ε, else CANCELLED;
  - `allocatedFromStock` > ε → PARTIAL_STOCK;
  - otherwise PO_REQUIRED.
- It logs a count mismatch the same way purchaseOrder.service.ts:218-223 does.

**`batchGetOpenPOSupply(reqs)`** makes three batched queries:
1. open lines (linkable status and category, `isActive`) whose `materialId` is among the page's materials;
2. links grouped by item;
3. the unlinked demand per material, which is Σ shortfall of allowlisted, unlinked rows across **all** filters.

It is attached only to allowlisted, unlinked, linkable-type MATERIAL rows. Each entry is:
`{purchaseOrderId, poNumber, poStatus, supplierName, expectedDeliveryDate, purchaseOrderItemId, lineUnit, stockUnitsPerUnit, orderedStockQty, linkedQty, freeQty, unlinkedDemandQty, linkable, blockedReason, arrivesLate}`.
- A line that has started receiving shows `freeQty = max(0, toStockQty(ordered−received) − Σmax(0, allocated−linkReceived))`, with `linkable=false` and the reason "goods have started arriving — use Use Stock for what arrived".
- Lines with nothing free are dropped.

### Endpoints
New files: `controllers/po-allocation.controller.ts` and `schemas/po-allocation.schema.ts`. Routes are registered after purchaseOrder.routes.ts:245, under `requirePermissionForWrites('purchaseOrders')`.
- **`GET /api/purchase-orders/:id/allocation?itemIds=`** returns:
  - `po{id, poNumber, status, expectedDeliveryDate, linkable, blockedReason}`;
  - `lines[{itemId, materials (LABEL_LINE_MATERIAL_SELECT), unit, stockUnitsPerUnit, stockUnit, orderedStockQty, receivedStockQty, allocatedQty, freeQty, linkable, blockedReason, links[…, canUndo, undoBlockedReason, orderStatus, surplusQty], candidates[…, suggestedQty, arrivesLate]}]`.
  - `arrivesLate` = PO expected date > min(requiredDate, order delivery date).
- **`POST /api/purchase-orders/:id/allocate`** takes `{allocations: [{purchaseOrderItemId, requirementId, quantity: formNumberRequired(z.number().positive())}] .min(1).max(500)}` (common.schema.ts:46). It returns `{linked, splits[{requirementNumber, childNumber, balance}], allocation}`.
- **`DELETE /api/purchase-orders/:id/allocations/:linkId`** returns `{requirementNumber, newStatus, allocation}`.
- **Existing `POST /api/mrp/requirements/:id/link-po`:**
  - keep the pre-checks at mrp.service.ts:4755-4784 first, so the SIZE_PENDING test stays green;
  - then delegate to `allocatePoLinesInTx` and return `mapToResponse`;
  - on the route, add `requirePermission('purchaseOrders')` after `validateBody`.

### Guards on other paths (mrp.service.ts unless noted)
- `allocateStock` (3028): allowlist PENDING, PO_REQUIRED, PARTIAL_STOCK, refuse when a live link exists, and make the write guarded.
- `updateRequirementStatus` (4818):
  - refuse to leave PO_GENERATED or PO_SENT while a live link exists, with "undo it on {PO}";
  - refuse to move into PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED or RECEIVED without a link. This closes the stranding at stateMachine.ts:133-134.
- `cancelRequirement` message (4891-4894): add "…or undo its allocation on the PO".
- purchaseOrder.service.ts:
  - `loadRequirementShares`: credit per link = `min(max(0, received), allocated)`;
  - `freeUndeliveredRequirements`: delete the links, then call `returnDemandAfterUnlink`;
  - `mintBalanceRequirement` delegates to `mintBalanceChild`.
- grn.controller.ts:266-286: per link, `actualCost × linkCostShare(...)`. The include adds the item's `orderedQuantity` and `stockUnitsPerUnit`, plus the links' `allocatedQuantity`.
- unified-po-creation.service.ts:276-281: a requirement with a live link becomes an **error**, not a warning.

### Requirement API (mrp.service.ts)
- `getRequirements` (2688-2694): attach `openPOSupply` next to `currentStock`.
- `getRequirementIncludes` (5224-5231) and `mapToResponse` (5399-5405): add `unit` and `stockUnitsPerUnit` to `poLinks.purchaseOrderItem`.
- Backend `types/mrp.types.ts`: add the `openPOSupply?` field and the unit fields.

### Status transitions (no `validateTransition` and no new state-machine edges; every write is a guarded `updateMany`)
- **Link:** PO_REQUIRED or PARTIAL_STOCK → **PO_SENT**. It stays PO_SENT on ACKNOWLEDGED, and when the PO is PARTIALLY_RECEIVED but the linked line has received nothing.
- **GRN approve / reverse:** unchanged (5063-5080) → RECEIVED, PARTIALLY_RECEIVED or PO_SENT.
- **Undo, or PO cancel with nothing received:** through `returnDemandAfterUnlink`, to PO_REQUIRED, PARTIAL_STOCK, CANCELLED (order cancelled) or the surplus-applied result.
- **Short-close:** unchanged apart from the cap.
- **Not changed:** `sendPurchaseOrder` still doesn't move MRP-generated POs from PO_GENERATED to PO_SENT (pre-existing).

## Frontend

### PO page (`PurchaseOrderDetail.tsx`)
- **"Allocate to orders" button** next to Receive Goods (:563-568). Shown when `canReceive` (:502), `can('purchaseOrders')`, and the allocation has linkable free quantity.
- **Banner** when candidates exist: "N running orders need these materials and are not linked".
- **New `components/purchase-orders/PoAllocationCard.tsx`** between Order Items and Receiving History (:870-872):
  - lines grouped by label with `groupLabelLines` + `poItemLabelKey` (lib/label-line-keys.ts:31);
  - Ordered / Received / Allocated / Free per size, with "16 gross = 2,304 pcs" on purchase-unit lines;
  - link rows show order, style, date, allocated, `min(received, allocated)` and a status chip;
  - flags "Order cancelled — undo to free N" and "BOM now needs N less";
  - Undo sits behind an AlertDialog; when it's disabled, a tooltip gives the reason.
- **New `AllocateToOrdersDialog.tsx`**, props `{poId, itemIds?, focusRequirementIds?, open, onOpenChange, onDone}`:
  - rows come in server order; each has a tick box, a quantity (`step="any"`, `prefillQty`) and a Late badge;
  - a requirement ticked on one line is disabled on the others;
  - "left free" is shown live per line and in total;
  - Save is disabled while any line is over;
  - on a 409: toast, then refetch;
  - on success: invalidate `queryKeys.mrp.all` and `purchaseOrders.all`, then `fetchPurchaseOrder()`.
- **New `lib/po-allocation-split.ts`** with `walkDefaultSplit`:
  - it re-walks the ticked rows the user hasn't edited;
  - with focus ids, only those rows are ticked.
- **Tidy-up:** fix the stray "0" by changing :684-685 to `…poSourceLinks?.length ? (…) : null`, and give the Style(s) badges `flex flex-wrap gap-1` (:675).

### Requirements page
Tell the other terminal first with `npm run notice`.
- **New `components/requirements/OpenPOSupplyNote.tsx`**: an amber line reading "PO2609-0231 · 4,530 free · not linked (unlinked orders need 2,941)", or "N open POs · X free" when there are several.
- **Link** opens the shared dialog with `{poId, itemIds, focusRequirementIds}`. It is hidden without `can('purchaseOrders')`; the note itself shows for everyone.
- **`OrderStyleLabelView.tsx`:**
  - new prop `onLinkPO(reqs, supply)` beside `onUseStock` (:38-39);
  - the size row's PO cell (:243) shows the note when unlinked, or "PO2609-0231 · 350 pcs" when linked;
  - a Link button in `renderActions` (:167-176);
  - the label heading (:308-309) shows "Open PO covers 6/6 sizes · Link sizes";
  - a set header badge next to StatusChips (:354);
  - the Shortfall cell shows "on PO…" in muted text for linked rows.
- **`UnifiedRequirementsPage.tsx`:**
  - in the Material/Vendor views (:1369-1396) and the List view (:1580-1605), show the note and Link under the status chip and next to Use Stock, and show linked PO numbers the same way (no colSpan change);
  - the Material group header (:1237-1249) shows the shared free figure once;
  - the selection bar (:1016-1037) gets an advisory line: "n selected could be linked to open POs instead";
  - fix the stat card (M2).
- **`order-style-groups.ts`:** stop the double-counted Required (M10).
- **`BulkPOGenerationDialog.tsx`:** a step-1 warning only.

## Edge cases

| Case | Behaviour |
|---|---|
| PO is DRAFT, CANCELLED, RECEIVED, SHORT_CLOSED, PENDING_GREIGE or READY_FOR_PROCESSING | Not linkable; the button is hidden and the API gives `PO_ALLOCATION_REFUSED` |
| PARTIALLY_RECEIVED PO | Only lines that have received nothing can be linked. Lines that have started receiving show a read-only free figure and the Use Stock hint |
| GRN waiting for QC on a line | Link and Undo are refused on that line |
| Requirement partly from stock (PARTIAL_STOCK) | Candidate quantity is `shortfall`; the row goes to PO_SENT with `allocatedFromStock` and its reservations kept; Undo returns it to PARTIAL_STOCK |
| Partial cover | Split child (PO_REQUIRED) created; the child gets its own hint; Undo folds it back |
| DECISION_PENDING | Note shown, no Link: "Order the extra" first, then Link |
| SIZE_PENDING | Refused (different base material). Optional: a label-level note "enter sizes to link" |
| Order cancelled before linking | Not a candidate |
| Order cancelled after linking | Link kept (order.service.ts:744-756); card flag; Undo sends the row to CANCELLED and frees the quantity |
| Order COMPLETED, DISPATCHED or SPLIT | Not a candidate |
| Requirement on a DRAFT MRP PO | Already covered, so not a candidate. Delete that line first (release helper) |
| Requirement with several live links (legacy) | Undo refused (M4) |
| BOM needs more later | DECISION_PENDING row, as now |
| BOM needs less later | **Since 2026-10-03 the row shrinks at once** (`shrinkRequirementToNeed`, called by MRP's reconcile): its link's allocation comes down — unreceived part first, then its Use Stock, then received goods, never below what it issued — and the line is recomputed, so the freed goods fill the next order in line or become free stock. `surplusQty` is kept only for what cannot come down (issued, on job work / a challan, split, PROCESSING); Undo still applies that (M3). Existing rows: `scripts/repair-unshrunk-holds.ts` |
| THREAD, greige, fabric, lace, service | Excluded |
| Buttons in GROSS | Free and allocation in pieces; a 2,300-piece need on a 16-gross line leaves 4 free |
| Two tabs over-allocating | PO row lock, re-check, then 409 |
| Linking races MRP Generate PO | The guarded flip leaves exactly one winner |
| Linking races PO cancel | Serialised (M6) |
| Use Stock or status PATCH on a linked row | Refused |
| Delivery beyond the linked total | Links over-credited, capped on read; the extra is plain stock |
| Stale `requiredDate` (ORD…025 / 026) | Sort by the order's live delivery date; Late uses the earlier of the two dates |
| Linked orders | Can no longer be deleted, only cancelled (M9) |

## Tests
**Unit (backend):**
- `po-allocation.helper.test.ts`: lineFree for GROSS and for no factor; every block reason; sort order with nulls last and tie-breaks; suggest with a partial last row, dust, and one line per requirement; linkCostShare for a full MRP line, a partly linked line and an over-allocated line.

**Unit (frontend):**
- `lib/__tests__/po-allocation-split.test.ts`.
- `AllocateToOrdersDialog.test.tsx`: prefill, unticking recalculates free, Save disabled when over.
- `OpenPOSupplyNote.test.tsx`.

**Integration** (tagged `RUN` fixtures with `only()` cleanup, as in mrp-buttons-by-gross.test.ts:17-80):
- `po-allocation.test.ts`:
  - happy path to PO_SENT with an audit row;
  - every refusal: DRAFT / CANCELLED / RECEIVED PO, line from another PO, material, colour or unit mismatch, SIZE_PENDING, DECISION_PENDING, PO_GENERATED, cancelled order, THREAD, GREIGE category, quantity over shortfall, over free, a line with a receipt, a PENDING_QC GRN, a requirement with another link;
  - parallel over-allocation (`Promise.allSettled`, exactly one succeeds);
  - the same requirement on two POs at once;
  - partial split, then Undo merges it back;
  - PARTIAL_STOCK round trip;
  - Undo on a cancelled order goes to CANCELLED;
  - Undo with a surplus shrinks the row.
- `po-allocation-api.test.ts`: Zod 400s, 403 for INVENTORY, the 409 shape, and link-po now needing `purchaseOrders`.
- `po-allocation-requirements.test.ts`:
  - `openPOSupply` appears on unlinked rows and disappears once linked; DRAFT lines never appear;
  - the Use Stock and PATCH guards;
  - the sizes-later SIZE_PENDING test still passes.
- `po-allocation-lifecycle.test.ts`:
  - full GRN → all links RECEIVED; partial GRN → pro-rata; reversal restores exactly;
  - short-close after a part receipt keeps shortfall ≤ allocated;
  - PO cancel with nothing received → PO_REQUIRED / PARTIAL_STOCK / CANCELLED correctly;
  - cost actuals: each style is charged only its share;
  - MRP recalculation after linking creates no duplicate.
- **Re-run:** po-cancel-requirement-revert, po-short-close, po-edit-preserves-links, mrp-buttons-by-gross, receipt-split, grn-trims-label-sizes, bom-reversion-requirements, sizes-later-workflow.
- **For every work package:** `npm run type-check` in backend and frontend, and jest on the touched tests.

## Work packages (file sets don't overlap; A first, then B, C, D in parallel, then E, then F, then G; commit with `git commit -- <own files>`)

| WP | Files |
|---|---|
| **A: core** | NEW `backend/src/services/helpers/po-allocation.helper.ts`; NEW `backend/src/__tests__/unit/po-allocation.helper.test.ts`; NEW `backend/src/__tests__/integration/po-allocation.test.ts` |
| **B: API** | NEW `backend/src/schemas/po-allocation.schema.ts`; NEW `backend/src/controllers/po-allocation.controller.ts`; `backend/src/routes/purchaseOrder.routes.ts`; NEW `backend/src/__tests__/integration/po-allocation-api.test.ts` |
| **C: MRP** | `backend/src/services/mrp.service.ts`; `backend/src/types/mrp.types.ts`; `backend/src/routes/mrp.routes.ts`; NEW `backend/src/__tests__/integration/po-allocation-requirements.test.ts` |
| **D: lifecycle and cost** | `backend/src/services/purchaseOrder.service.ts`; `backend/src/controllers/grn.controller.ts`; `backend/src/services/unified-po-creation.service.ts`; NEW `backend/src/__tests__/integration/po-allocation-lifecycle.test.ts` |
| **E: PO page** | NEW `frontend/src/types/po-allocation.types.ts`; `frontend/src/services/purchaseOrder.service.ts`; NEW `frontend/src/lib/po-allocation-split.ts` and its test; NEW `frontend/src/components/purchase-orders/AllocateToOrdersDialog.tsx` and `.test.tsx`; NEW `frontend/src/components/purchase-orders/PoAllocationCard.tsx`; `frontend/src/pages/PurchaseOrderDetail.tsx`; `frontend/src/lib/query-client.ts` |
| **F: Requirements page** | `frontend/src/types/mrp.types.ts`; NEW `frontend/src/components/requirements/OpenPOSupplyNote.tsx` and its `__tests__` file; `frontend/src/components/requirements/OrderStyleLabelView.tsx`; `frontend/src/components/requirements/order-style-groups.ts`; `frontend/src/pages/UnifiedRequirementsPage.tsx`; `frontend/src/components/BulkPOGenerationDialog.tsx` |
| **G: docs and ship** | `docs/ai-guides/*` via `/update-ai-guides` (a new guide "Allocate a sent PO to orders" plus the Requirements guide; keywords in English, Hinglish and Devanagari); then `npm run ship:wait` |

**Files other terminals have open (don't touch):** `sizes-later-workflow.test.ts`, `OrderDetail.tsx`, `GRNForm.tsx`, `OrderList.tsx`, `helpers/order-status.helper.ts`, `helpers/sale-order-sizes.helper.ts`, `docs/ai-guides/*.md`, `manifest.json`. For G, coordinate on `manifest.json` first. None of these is in A–F.

## Verification walk on PO2609-0231 (shared live DB; clicking Allocate is the owner's action or needs their go-ahead)
1. **SELECT before:** SENT, 0 links, 0 GRN lines, 54 PO_REQUIRED (9 per size).
2. **Requirements page, Order & Style, ESSKY085LS:** each size row shows "PO2609-0231 · 4,530 free · not linked (unlinked orders need 2,941)" with Link, and the set header shows the "Open PO not linked" badge.
3. **PO page → Allocate to orders:**
   - 6 size lines with 9 ticked rows each, in the order 033, 132, 029, 025, 032, 026, 027, 030, 031;
   - left free XS 1,589 / S 2,369 / M 2,495 / L 2,269 / XL 1,701 / XXL 906 = 11,329;
   - Late on ORD…033, 025 and 026. Save.
4. **SELECT after:**
   - 54 links, with Σ per line 2,941 / 4,301 / 4,695 / 4,281 / 3,179 / 1,804;
   - 54 requirements PO_SENT;
   - 0 new `splitFromId` rows;
   - no requirement with more than 1 live link;
   - 1 audit row.
5. **PO page:** the card matches; the header shows 9 wrapping style badges; the list shows "For Easybuy".
6. **Requirements page:**
   - "Needs action" no longer shows LBL-0004;
   - "On order" shows "PO2609-0231 · 350 pcs";
   - the stat cards: needing PO −54, "On PO / JWO" +54.
7. **Undo MR2609-0679 (XS, ORD…033):**
   - it goes to PO_REQUIRED and the note reads "1,939 free";
   - link it again from the Requirements page → PO_SENT, and free is back to 1,589.
8. **GRN:** tested in the test suite only. On the real delivery: 54 RECEIVED, and each style's trims actual is ₹0.60 × its own quantities for that GRN.

## Open questions for the owner
1. **Stock after the labels arrive.** Stock will show all 4,530 XS as available (derived-stock.helper.ts:76-88 doesn't subtract what was received for linked orders). So a future style sees "Use Stock 4,530", not 1,589. Accept this for now, or add a follow-up that subtracts "received for linked running orders but not yet issued"?
2. **Partial deliveries.** A partial delivery is shared pro-rata across the linked orders on that size, not earliest-order-first. That keeps receipt and reversal exact. Is that acceptable?
3. **Lines that have started receiving.** Once goods start arriving on a PO line, that line can't be linked or undone. What already arrived goes through Use Stock. Do you need to link the still-to-come balance of a part-delivered line?
4. **Who may link.** Linking and undoing are limited to the purchase-order permission (Admin, Purchase, Merchandiser). Inventory and Production Manager see the note but get no Link button. Confirm.
5. **Cost sheet actuals (FYI).** They are replaced on each GRN approval instead of added up (costSheet.service.ts:265-270), so a style's "actual" is only its latest GRN. Fix this separately?

### Critical Files for Implementation
- C:\Users\NEW\garment-erp\backend\src\services\helpers\po-allocation.helper.ts (new)
- C:\Users\NEW\garment-erp\backend\src\services\mrp.service.ts
- C:\Users\NEW\garment-erp\backend\src\services\purchaseOrder.service.ts
- C:\Users\NEW\garment-erp\frontend\src\components\purchase-orders\AllocateToOrdersDialog.tsx (new)
- C:\Users\NEW\garment-erp\frontend\src\components\requirements\OrderStyleLabelView.tsx