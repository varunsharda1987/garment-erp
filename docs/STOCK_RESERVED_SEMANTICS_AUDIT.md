# Stock "reserved" semantics — observations for independent review

**Author:** Claude (Opus 4.5) · **Date:** 2026-09-02 · **Repo:** garment-erp @ commit `4993610e`
**Purpose:** hand-off for independent review. Everything below is classified by how it was established.

---

## 0. Read this first — errors I made

The reviewer should know where I was unreliable, because it affects how much weight to give the rest.

1. **I said "the stock tables are empty / you don't have stock."** That was wrong and alarming.
   The truth: **~40,566 m of greige fabric across 12 lots.** What I should have said is that greige
   is the *only* material type with stock; every other stock table has 0 rows. See §2.
2. **I said the lace issue-note bug was "happening today, independent of anything I've built."**
   Overstated. It is a real code defect but is **not reachable**: `lace_issue_note` has 0 rows, no
   frontend code calls it, and the repo's own bug-hunt doc lists its routes as removal candidates.
3. **I initially mis-read a `grep -c` count** while checking whether a schema change was staged,
   and briefly acted on it (staged a migration, then reverted). Corrected within the same turn.

Given the above, **§4 (second-hand claims) deserves the most scepticism** — it is the part I did
not personally verify.

---

## 1. Evidence tiers used below

| Tier | Meaning |
|---|---|
| **[V]** | I ran the query or read the code myself in this session; raw output reproduced |
| **[A]** | Reported by a sub-agent with a file:line, **not** independently verified by me |
| **[I]** | My inference, opinion or recommendation — not a fact |

---

## 2. [V] Live database state

Connection used: `postgresql://postgres:****@localhost:5432/garment_erp`
This matches the API's own startup log, so it is the database the running app uses.

### Row counts
```
greige_stock: 12        fabric_stock: 0        lace_stock: 0
thread_stock: 0         button_stock: 0        zipper_stock: 0
elastic_stock: 0        label_stock: 0         packaging_stock: 0
machine_part_stock: 0   other_material_stock: 0
finished_goods_stock: 0 fg_stock_allocations: 0
fabric_stock_allocation: 0  lace_stock_allocation: 0  lace_issue_note: 0
stock_levels: 9 rows, total 40,066.73
orders: 8   purchase_orders: 6   grn_items: 6   materials: 349
```

### Greige lots (the only real stock)
```
Viscose Staple 30×30/68×64/63"     10,536.00   consumed 0     reserved 0
Viscose Crepe  30×30/68×46/71"      6,706.00   consumed 0     reserved 3,058.82
Cambric        60×60/92×88/48"      4,883.14   consumed 500   reserved 0
Viscose Moss   1×1/1×1/63"          4,088.00
Viscose Crepe  (2nd lot)            3,808.00
Viscose Crepe  (3rd lot)            3,778.00
Viscose Crepe  (4th lot)            2,338.00
Lurex Silver   60×60/92×88/48"      2,077.11
Viscose Chanderi 1×1/1×1/48"        1,047.00
Viscose Chanderi 1×1/1×1/63"          633.00
Cambric        (2nd lot)              500.00
Lurex Gold     60×60/92×88/48"        172.48
TOTAL available 40,566.73 · consumed 500 · reserved 3,058.82
```

### [V] Discrepancy found — needs a human decision
Lot table vs `stock_levels`, per greige. Every material reconciles **except Cambric**:

| Greige | lot table | stock_levels | delta |
|---|---|---|---|
| Cambric 60×60/92×88/48" | 5,383.14 | 4,883.14 | **500.00** |
| all others | — | — | 0 |

The 500 delta equals that lot's `quantityConsumed`. **I did not determine which figure is correct
or which layer failed to update.** Requires checking physical stock. Reviewer: this is the single
most business-relevant item in this document.

---

## 3. [V] Code facts I verified personally

### 3.1 Two conventions for `quantityReserved` coexist

**Convention A — "reserved has already left available"** (writer decrements available AND
increments reserved in the same update):
- `src/services/laceStock.service.ts:499-501` (allocate; also flips status→RESERVED at zero)
- `src/services/laceStock.service.ts:575-577` (transfer)
- `src/services/laceIssueNote.service.ts:122-128` (issue to floor)

**Convention B — "reserved is a claim against available"** (increments reserved only):
- `src/services/mrp.service.ts:2833-2836` (lace branch)
- `src/services/mrp.service.ts:2818-2821` (greige branch)

Under A, free = `available`. Under B, free = `available − reserved`. Both are self-consistent;
mixing them is not.

### 3.2 A reader that contradicts its own writer
`src/services/laceIssueNote.service.ts:90`
```js
const available = Number(stock.quantityAvailable) - Number(stock.quantityReserved);
```
…in the same file that writes convention A at :122-128. Worked example: lot of 100, issue 40 →
available 60 / reserved 40 → next issue computes free = 20 while 60 is physically present.
**Not reachable today** (see §0 item 2).

### 3.3 Releases exist and are symmetric with their writers
Exhaustive grep of `quantityReserved: { decrement` over `backend/src` returns exactly six sites:
```
job-work-issuance.service.ts:557   (greige)
laceIssueNote.service.ts:210, :317 (lace)
laceStock.service.ts:646, :728     (lace)
order.service.ts:793               (lace — verified it targets tx.lace_stock)
```
**There is no fabric_stock release anywhere.** This confirms the strongest second-hand claim.
Corrects an earlier statement of mine that reserved might inflate forever for lace — for lace it
does not; for **fabric** it does, because nothing ever releases it.

### 3.4 The greige physical-issue gate ignores reservations
`src/services/greige-stock.service.ts:538-545`
```js
const consumeResult = await client.greige_stock.updateMany({
  where: { id: stockId, quantityAvailable: { gte: quantity } },   // <-- ignores quantityReserved
  data: { quantityAvailable: { decrement: quantity },
          quantityConsumed:  { increment: quantity }, ... },
});
```
Combined with the convention-B writer at `mrp.service.ts:2818-2821`, greige reserved for one order
can be issued to another. **This is the only affected family that currently holds stock**, and
3,058.82 m is reserved on a 6,706 m lot right now.

### 3.5 Trim/thread reserved columns are written once, at zero, and never again
`trim-stock.service.ts:153`, `thread-stock.service.ts:89`, `stock-routing.helper.ts:139` all create
`quantityReserved: new Prisma.Decimal(0)`; every other occurrence in those files is a read. So the
eight trim/thread families are self-consistent **only because reservation was never implemented**.

### 3.6 Money bugs I found, fixed and shipped (commit `4993610e`)
Both in `src/services/laceCostingCalculation.service.ts`, both verified before and after:
- Dyeing **rate band chosen on finished metres** while the dyer processes greige metres
  (finished ÷ (1−shrinkage)) → frozen rate could be a whole band too cheap.
- When an approved lab dip **fixed** the dyer but that dyer had no rate card, the cheapest-rate
  scan still ran and took **another dyer's rate and shrinkage** while keeping the fixed
  `processorId` → dyer A's work priced at dyer B's card.
Two tests added (`lace-processing-rate.test.ts`), both pass; 12 pre-existing lace tests still pass.

### 3.7 Earlier verified fix (commit `4f815c0d`, merged `8b1dc5c7`)
`order_bom_items.greigeId` is an FK to `greige_master` (fabric), but order-BOM generation wrote a
**lace** id into it. Confirmed by a test that asserts the FK still rejects it. Would have failed the
first order placed against a cost sheet with a Greige+Dyeing lace line. 0 such rows existed.
Also fixed: lace `greigeCost`/`processingCost` were stored as **order totals** in columns MRP and
the PO rate resolver read as **per-metre rates** (≈1000× on a 1000 m line). 0 rows affected.

---

## 4. [A] Second-hand claims — NOT verified by me

These come from sub-agents with file:line references. **Treat as leads to check, not findings.**
An adversarial reviewer agent already rejected parts of the surrounding analysis, so scepticism is
warranted.

### Fabric
- `cad-approval.controller.ts:63-71` reserves via `currentReserved + quantityNeeded` with no
  reservation key → **non-idempotent**; reject writes no release, so approve→reject→re-approve
  double-reserves. *(Consistent with my §3.3 finding of zero releases, but I did not read this file.)*
- Most fabric readers use plain `available`: `challan.service.ts:316-320`,
  `job-work-issuance.service.ts:460-462`, `external-process.service.ts:225-230`,
  `embroidery-stock.service.ts:118-132`, `cutting.controller.ts:2088-2168`,
  `workOrder.controller.ts:505-514`, `fabric-stock.service.ts:284`,
  `productionBlockingValidation.service.ts:437-442`.

### Greige
- `stockMovement.service.ts:1133` sums `available + consumed + reserved` (convention-A arithmetic on
  convention-B data) → inflates the Stock Movement register's quantity and value.
- `greige-stock.service.ts:558-561` marks EXHAUSTED only when reserved is also 0 → emptied lots stay
  `AVAILABLE` and keep appearing in pickers.
- `greige-stock.service.ts:468-513` `reserveGreigeStock` is convention A and has **zero callers**;
  its paired release decrements reserved *without* crediting available.
- No order-cancel / re-plan release path for greige (contrast `order.service.ts:789-796` for lace).

### Two further conventions (side ledgers)
- `fabric_stock_allocation` (cutting, `cutting.controller.ts:331-345`) — reservations **no
  free-stock reader ever subtracts**, so a fully-reserved roll still looks free.
- `fg_stock_allocations` — `saleOrder.service.ts:755-760` nets them; `dispatch.controller.ts:1605-1633`
  and `:476-500` ignore them and drain any lot with quantity > 0.

### Design gap (not a convention bug)
- `mrp.service.ts:2794-2838` only reserves for FABRIC/GREIGE/LACE. For trims/thread it flips
  requirements to `FULFILLED_STOCK` while reserving nothing → two orders can both be told the same
  stock covers them. A code comment at `:2765-2768` reportedly warns about exactly this.

### Contested / likely wrong
- An agent claimed greige reservations are stranded forever. Another agent disputed the mechanism
  (`job-work-issuance.service.ts:548-560` decrements per consumed lot, not only per requirement).
  **Unresolved — do not rely on either version.**
- An agent flagged 16 "extended trim" types as invisible to stock views. Explicitly marked
  code-observed and **not** DB-confirmed.

---

## 5. [I] My opinions — lowest confidence, easiest to discard

- Standardise on **convention B** (available = physical on-hand; reserved = a claim against it),
  because the shared helper `mrp.service.ts:807-810` `netFreeStock` already assumes B and reports
  treat `SUM(quantityAvailable)` as on-hand.
- Any convention change needs **keyed, idempotent releases** and **settle-on-consume**, or it is
  worse than what exists.
- **Now is the cheap moment** to fix: with only greige holding stock, data repair is minimal.
- Suggested order: greige first (only family with real data and a live reservation) → fabric
  (worst code, no data) → guardrail check → lace last (unreachable today).
- The 500 m Cambric discrepancy should be resolved by a human against physical stock before any
  code change touches greige.

---

## 6. Reproduce everything here

```bash
# Row counts and greige detail (read-only)
cd backend && node -e "…"   # queries are inline in §2; all are plain SELECTs

# Verify the release-site claim (§3.3)
grep -rn "quantityReserved: { decrement" backend/src --include=*.ts

# Verify the two conventions (§3.1)
sed -n '495,505p' backend/src/services/laceStock.service.ts
sed -n '118,130p' backend/src/services/laceIssueNote.service.ts
sed -n '2815,2840p' backend/src/services/mrp.service.ts

# Verify the greige issue gate (§3.4)
sed -n '534,546p' backend/src/services/greige-stock.service.ts

# Tests referenced
cd backend && npx jest lace-processing-rate order-bom-greige-lace cost-sheet-lace-roundtrip
```

---

## 7. Open questions for the reviewer

1. Is the 500 m Cambric gap a lot-table error or a `stock_levels` error?
2. Are the §4 fabric claims accurate? Especially the non-idempotent CAD reservation.
3. Is convention B the right target, or should reserved mean "already moved out"?
4. Is the greige over-issue path (§3.4) actually reachable through the UI, or only via API?
5. Which of the two contradictory greige-release accounts in §4 is correct?
