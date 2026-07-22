# T2-1 — Derived On-Hand Inventory: Staged Migration Plan

> Produced by the T2-1 discovery workflow (5 parallel readers + synthesis). This is the durable fix for the
> whole stock-drift bug class: make on-hand inventory a **derived** value from the per-lot tables instead of
> the hand-maintained `stock_levels.quantity`. **Awaiting user approval before any implementation.**

## 1. Current state
`stock_levels` (schema.prisma:3358-3377, `@@unique([materialId, warehouseId])`) is a hand-maintained aggregate
whose single `quantity` column is the system-wide on-hand figure (no reserved/available split). It **drifts**
because on-hand is written by **five uncoordinated paths** (material-sync.helper `syncStockLevelQuantity`,
grn.service:847, stockMovement.service `increase/decreaseStockInTx`, stockLevel.service `increase/decreaseStock`)
while the real per-lot truth lives in 11 specialized tables — which is exactly why `repair-stock-ledger.ts` /
`reconcile-stock-levels.ts` exist to periodically rebuild it. `unified_stock_view` does **not** aggregate the
per-lot tables despite its comment — it's just `stock_levels JOIN materials JOIN warehouses`.

## 2. Target design
On-hand becomes **derived** from a DB view that UNION-ALLs the 11 per-lot tables grouped by `(materialId, warehouseId)`,
reproducing the canonical exclusions from `repair-stock-ledger.ts`:
- `warehouseId IS NOT NULL`; greige only: `processorId IS NULL` AND `sourceType <> 'TRANSFER'`
- fabric: exclude RAW/generic (finishType='RAW' / isGeneric / code LIKE '%-RAW')
- **thread: SUM `metersAvailable`** (not quantityAvailable); all others SUM `quantityAvailable`
- resolve each per-lot masterId → canonical `materials.id` (createFromMaster convention)

Policy + valuation config moves to a slim **`stock_settings`** table keyed `(materialId, warehouseId)` holding
`reorderLevel/minLevel/maxLevel/valuationRate`. **`stockValue` is dropped** (fully derived = quantity×rate).
Create a **new** `derived_stock_view` (don't silently repoint `unified_stock_view`, which has its own stockValue bug).

## 3. Blast radius
- **On-hand `quantity` readers — 20 sites** that must repoint or silently read 0/stale: MRP/allocation, production
  blocking, availability checks (workOrder/thread/costSheetPOGen), stock pages/reports, dashboard KPI
  (`where quantity < 10` — must become a view query, not a column filter), stock counts, movement pre-checks.
- **Policy readers** (reorder/min/max): reorder alerts, reports — the `quantity ≤ reorderLevel` comparison must join derived qty.
- **Valuation readers**: fabric costing (critical), warehouse valuation, stats, cycle-count ordering.
- **Frontend**: StockLevelList + 11 trim `*List` pages + StockOut/Adjust/Count/Transfer forms + StockDashboard.
- **Writers (retired last):** the 5 quantity writers + the smart-check.js stock-sync guardrail + baseline.

## 4. Staged rollout (each stage independently shippable + reversible)
- **Stage A — Build the derived source (additive, ZERO behavior change).** New `stock_settings` table (backfilled
  1:1 from current columns) + `derived_stock_view` + a reconciliation report (derived vs current per material+warehouse).
  Nothing reads the view yet. **Verify:** reconciliation should equal `stock_levels.quantity` everywhere; non-zero
  deltas = pre-existing drift (finding them is a benefit). **Roll back:** DROP the view + table.
- **Stage B — Repoint readers, one group at a time** (behind a compatibility helper, shadow-run so both can be
  diffed): B1 policy/reorder → B2 valuation (fabric costing first) → B3 on-hand quantity (MRP, production, movements)
  → B4 dashboard filter rewrite → B5 frontend. Each PR reversible independently.
- **Stage C — Stop writing `stock_levels.quantity`.** Retire the 5 writers (redirect WAC to `stock_settings`),
  retire the guardrail + baseline, make `stock_levels` a derived shim. Highest-risk stage; only after B soaks.
- **Stage D — Cleanup.** Repoint/drop `unified_stock_view`, fix its stockValue bug, demote repair/reconcile scripts
  to diagnostics, resolve dual reorder-level source.

## 5. Key decisions for the user
1. **DB view vs app-layer aggregation** — rec: DB view first (fewer reader rewrites).
2. **Keep `stock_levels` as a derived shim vs remove** — rec: keep as shim (minimal reader change, far safer on live DB).
3. **Cutover-all-at-once vs parallel/shadow run** — rec: shadow run (keep writing the old column through Stage B so every repointed reader is numerically diffed).
4. **Thread meters vs spools/cones** on stock pages (ledger aggregates meters today).
5. **Processor/in-transit stock** — confirm it should never show as warehouse on-hand (it won't in the derived view).
6. **Reorder-level source of truth** — `materials.reorderLevel` (Int) vs `stock_settings.reorderLevel` (Decimal/warehouse).
7. **Valuation authority** — `stock_settings` becomes the single WAC home; unify the two duplicate WAC engines.

## ✅ Stage A — DONE (additive, reversible; nothing reads it yet)
Migration `20260719000000_t2_1_stock_settings_and_derived_view` (applied + resolved; `migrate status` up to date).
- `stock_settings` created + backfilled 1:1 from `stock_levels` (42 rows).
- `derived_stock_view` = UNION-ALL of the 11 per-lot tables, master-FK **resolved to `materials.id` via the
  materials type-FK join** (the Stage A reconciliation caught that a plain equality mis-keys trims, which use
  `mat-<code>` ids while greige/fabric use `materials.id===masterId`).
- **Reconciliation: derived == current ledger for 43/44 (material,warehouse) pairs** → the aggregation is a
  faithful reproduction. **One genuine drift:** button `BTN-0001` ledger=75 vs physical lots=200 (understated by
  125 — a sync that fell behind; F1/F4 class). Data-quality note: a 100-unit `BTN-0001` lot has **no warehouse**
  assigned (so it counts as on-hand nowhere).
- Rollback if ever needed: `DROP VIEW derived_stock_view; DROP TABLE stock_settings;`.

**Decisions confirmed by the data:** thread aggregated on `quantityAvailable` matched the ledger (no meters
mismatch in current data — meters vs cones can be revisited later); processor/transfer/no-warehouse stock is
correctly excluded from on-hand (the 100-unit no-warehouse button lot demonstrates this).

## ✅ Stage B3 — DONE (on-hand DECISION readers repointed; parallel-run diffed + live)
The readers that drive **procurement and production decisions** now read derived on-hand via
`getDerivedOnHand(materialId)` (helper `backend/src/services/helpers/derived-stock.helper.ts`):
- `mrp.service.ts:~1021` — generic trim on-hand in requirement calc (was `stock_levels.aggregate _sum.quantity`).
- `material-requirement.service.ts:getAvailableStock` — MRP availability (across warehouses).
- `productionBlockingValidation.service.ts` ×2 — trim shortfall blockers (start-production + stage gates).
- `dashboard.controller.ts` low-stock KPI — `countDerivedBelowThreshold(10)` (a view COUNT, since a
  `where quantity < 10` column filter can't run against a view).

**Parallel-run diff before repointing** (`backend/scripts/diff-derived-onhand.ts`, total-across-warehouses —
the exact figure these readers compute): **43/44 materials identical; only BTN-0001 changes (ledger 75 →
derived 300)** — the same genuine drift Stage A found, and the correct physical figure. So the only decision
that changes is MRP/production now sees BTN-0001's true 300 (procures less / blocks less). **Live-verified:**
dashboard KPI 5→4 (dropped a phantom zero-qty ledger row); build clean; `pm2 reload garment-erp-api` OK.

**Deferred within B3 (still read `stock_levels`, which is safe during the parallel run):**
- `stockMovement.service.ts` reads (97/148/388/475/819/898) — these are the **ledger writers'** own
  pre-checks; they maintain `stock_levels` and are retired in **Stage C**, not repointed.
- `stockCount.service.ts` (82/92/102) — cycle-count worksheet builder; reads on-hand as the "system
  quantity" baseline inside a `tx`, plus a `stockValue`-ordered CYCLE branch. Lower-stakes (not a
  procurement/production decision); folded into the later B5 frontend/worksheet pass.

## ✅ Stage B3-extended — remaining on-hand QUANTITY readers repointed (safe, live)
The valuation workflow's exhaustive sweep surfaced more on-hand QUANTITY readers still on `stock_levels.quantity`
(distinct from valuation — safe to move now, same as B3). Repointed via `getDerivedOnHand` / new batch
`getDerivedOnHandMap(materialIds)` / `getDerivedStockDetailed`:
- `workOrder.controller.ts:~630` — BOM shortage stock map for a work order → `getDerivedOnHandMap` (one grouped
  query over the BOM's materialIds; `ANY($1::text[])` binding verified live).
- `thread.controller.ts:~840` — thread stock + per-warehouse breakdown → `getDerivedStockDetailed({materialId, warehouseId})`.
- `costSheetPOGeneration.service.ts:~493` — `getStockInfoForMaterial` on-hand (the `stock_levels` sum only;
  fabric_stock/reservations legs untouched) → `getDerivedOnHand`.
**Diff:** `backend/scripts/verify-onhand-batch.ts` — batch === per-material lookup; only BTN-0001 changes (75→300).
Build clean, `pm2 reload` OK, error log clean.
**Now DONE (via the lastUpdated enabler below):** both `report-generator.service.ts` inventory reports
(`generateInventorySummary` 126, `generateStockLevels` 164) → `getDerivedStockDetailed()`.

## ✅ lastUpdated enabler — derived_stock_view gains a real last-movement timestamp
Migration `20260720120000_t2_1_derived_view_last_updated` (applied + resolved). `CREATE OR REPLACE VIEW`
**appends** `lastUpdated = MAX(per-lot updatedAt)` as the trailing column — Postgres guarantees columns 1-8 stay
byte-identical, so every already-repointed reader is untouched (verified: 41 rows, quantity 124992.65,
stockValue 902137.46 — unchanged; all 41 rows now carry a timestamp).
**Finding:** derived `lastUpdated` (real last lot-modification, ~May 1) is **~77 days older** than
`stock_levels.lastUpdated` (~Jul 18) — the ledger timestamp was bumped by reconcile/sync runs *without the stock
actually moving*. So the derived value is the truthful "last actually moved" date; the ledger's was misleading.
**Repointed:** the two inventory reports (consistent quantities, phantom/RAW rows gone, truthful timestamp).
**`getStockAgingReport` (stockLevel.service:466) — REPOINTED (for completeness).** Investigation found it is
**dead code**: no frontend page calls `stockLevelService.getAgingReport`, and its response shape never matched
the frontend `StockAgingReport` type (`daysSinceUpdate` vs `daysSinceLastMovement`). So there was no user-visible
change to worry about — repointed to derived (keeping the "days since last movement" semantic, now truthful, with
a null-`lastUpdated` guard) so that Stage C (which stops writing `stock_levels.quantity`) can't silently break it.
**Future (optional):** a proper batch/received-date aging redesign + reconciling it with the frontend type, or
delete the unused endpoint. Not urgent — flagged for the user.

### On-hand QUANTITY reader migration: COMPLETE
Every non-writer-internal `stock_levels.quantity` reader now reads the derived source (reorder alerts, Stock
Levels page, MRP, material-requirement, production-blocking ×2, dashboard low-stock KPI, work-order BOM, thread
stock, cost-sheet PO-gen, both inventory reports, summary-by-type, aging). Remaining `stock_levels` reads are
either **writer-internal** (`stockMovement.service` — retired in Stage C) or **valuation** (deferred to Stage C
pending the re-backfill), plus the `stockCount` CYCLE worksheet (valuation-ordered, Stage C).

## ✅ Stage B-valuation — WRITE HALF DONE (dual-write); READ HALF deferred to Stage C
Verified by a 9-agent workflow (exhaustive reader/writer sweep + 4 adversarial checks, all SAFE). Verdict:
**write-to-both / read-from-old** — ship the dual-write now, repoint ZERO valuation readers.

**Why valuation ≠ on-hand:** on-hand quantity is derivable from the per-lot tables, but the valuation RATE (WAC)
is computed by two engines and stored in `stock_levels.valuationRate`. `stock_settings.valuationRate` was a
one-time backfill, so the next rated receipt would strand it. Fix = make `stock_settings` a LIVE WAC target first.

**Done (deployed + verified live):** dual-write the recomputed WAC rate into `stock_settings.valuationRate`
(update-only, never clobbers reorder/min/max) from all three write sites —
- `stockMovement.service.ts` `increaseStockInTx` (WAC engine #1, in-tx),
- `stockLevel.service.ts` `increaseStock` (WAC engine #2, threads `db=tx||prisma`),
- `stockLevel.service.ts` `updateStockLevel` (manual admin rate, guarded on `data.valuationRate !== undefined`).
Guarded on `if (rate)` so rate-less receipts never touch the rate. Verified non-destructively
(`backend/scripts/verify-valuation-dualwrite.ts`): mirror-integrity 0 divergent; SUM(stock_levels.stockValue)
still 872137.46 (no reader moved); a real in-tx `increaseStock` mirrored settings↔ledger (both → same WAC) then
rolled back clean.

**Deferred to Stage C (all valuation READERS — `repointNow=false` for every one):** `getStockValuationReport`
(stockLevel.service:509), `getWarehouseStockSummary` (warehouse.service:332), `getStockLevelsByWarehouse`/
`ByMaterial` (260/221), `getStockSummaryByType` (82), the fabric-costing STOCK_WAC branch
(fabric-cost-calculation.service:434), the CYCLE-count worksheet (stockCount.service:108). Frontend needs NO
edits — the same camelCase keys flow through when the backend endpoints eventually repoint.

**⛔ Stage-C sequencing gate (the one thing that must not go wrong):** repointing any `stockValue` reader
BEFORE `stock_settings.valuationRate` is populated for every rated material would report ZERO valuation for
real stock (`stockValue = qty × COALESCE(rate,0)`). Order for Stage C: dual-write soaks in prod → one-time
re-backfill of `stock_settings.valuationRate` from `stock_levels` for all rated materials → THEN repoint the
valuation readers as one atomic set. Two readers can't use the view as-is (no `lastUpdated`/`id` column):
`getStockAgingReport` (keyed on lastUpdated — never a repoint target) and the fabric-costing STOCK_WAC branch
(needs a dedicated `getGreigeWAC(greigeId)` helper: derived_qty>0 gate, `stock_settings.valuationRate`,
`ORDER BY rate ASC LIMIT 1`, `asOf = stock_settings.updatedAt`).

**Pre-existing bugs surfaced:** (1) ✅ **FIXED** — `getStockSummaryByType` read `SUM("stockValue") FROM
unified_stock_view`, but that view has NO `stockValue` column → the endpoint **500'd** (Postgres 42703). Now
sources per-type on-hand + valuation from `derived_stock_view` (joined to materials.id); the Stock Dashboard's
by-type panel works again, with accurate counts (phantom/RAW/zero rows excluded). `totalValue` is returned but
not surfaced in the UI, so no premature valuation change is shown. Verified: crash reproduced, derived query
returns 5 clean per-type rows, built + deployed. (2) ⏳ `mat-pkg-0001` has `stockValue ≠ quantity ×
valuationRate` (classic F1 drift) — visible when its WAC recomputed to 0.69; a candidate for the repair pass.

## ✅ Stage C (partial) — valuation READERS repointed; writer-retirement deliberately deferred
After the dual-write soaked, executed the read-side cutover for the SAFE valuation readers.
- **C1 re-backfill** (`backend/scripts/rebackfill-valuation.ts`, idempotent): mirror every rated `stock_levels`
  row into `stock_settings` before repointing. Result: created=0 updated=0 unchanged=5 — already complete.
- **Blast radius (per-material valuation diff, `diff-valuation-per-material.ts`):** exactly ONE material changes
  on repoint — `PKG-0001` valuation 1500 → 31500 (the derived view recomputes qty×rate, auto-correcting the
  stored-stockValue drift). Every other material identical. BTN-0001 has no rate → no valuation change.
- **New helpers** (`derived-stock.helper.ts`): `getDerivedValuation({warehouseId?,materialId?})` (qty>0, sorted
  stockValue desc, + totals) and `getGreigeWAC(greigeId)` (in-stock gate from derived qty, rate+asOf from
  stock_settings, ORDER BY rate ASC — **verified to pick the same rate as the old code for all rated greige**).
- **Repointed (deployed + verified):** `getStockValuationReport` (→902137.46, was 872137.46),
  `getWarehouseStockSummary`, and the fabric-cost `STOCK_WAC` fallback (→ `getGreigeWAC`).

### ✅ Form endpoints — RESOLVED (+ fixed a pre-existing crash)
`getStockLevelsByWarehouse` / `getStockLevelsByMaterial` repointed to derived. A 4-agent verification workflow
(checked live against the running server) found the real picture: **no write path uses a `stock_levels` row id**
(all key on materialId+warehouse), `getByMaterial` has **zero** frontend callers, and the 4 transaction forms
were **already broken since the first commit** — the endpoints returned a wrapper `{stockLevels, totals}` but the
frontend service returns `response.data.data` and the forms call `.filter`/`.map` on it → `data.filter is not a
function`. Fix: return a **bare `StockLevel[]`** (matches the declared `Promise<StockLevel[]>` + sibling
`getStockLevelsByMaterialType`; the wrapper totals were consumed by nobody) with a **synthetic composite id**
`${materialId}_${warehouseId}` (stable/unique for React keys + StockCountForm's `material-${id}` checkbox DOM ids;
no consumer POSTs it). This repoints to derived (BTN-0001 now shows 300, not 75) AND fixes the long-broken forms
with zero frontend edits. Verified live: both return `isArray=true`, synthetic ids present, BTN qty 300.
**⚠ The 4 transaction forms (Stock-Out/Adjustment/Transfer/Count) will now RENDER for the first time — worth a
manual test since their write paths have never run.**
- `stockCount.service` CYCLE worksheet — still on `stock_levels` (creates `stock_count_items`; valuation-ordered).
  Low-stakes, still deferred; repoint alongside a future stock-count review.
### ✅ Writer retirement — RESOLVED (decision: keep as internal shim, + shim repaired to consistency)
**Decision:** do NOT retire the writers. They form a read-write loop (READ `stock_levels` for insufficient-stock
checks + WAC deltas), so stopping the writes would require redirecting that internal logic to derived — intricate,
with ZERO user-facing benefit now that every external reader is derived. Keep `stock_levels` as an **internal
shim** the writers maintain for their own delta math, and keep the material-sync guardrail (it keeps the shim in
sync — still useful). **Latent bug found + fixed:** because the writers READ `stock_levels.quantity` for
insufficient-stock checks, the one residual drift (BTN-0001 ledger 75 vs real 300, from the Kashaya lot
assignment) could have wrongly blocked a >75 button issue. Repaired it (`backend/scripts/repair-quantity-drift.ts`,
update-in-place, dry-run-first). **Result: `stock_levels` now == `derived_stock_view` for ALL 44 materials — zero
quantity drift, zero valuation drift, totals 902137.46.** The shim is clean and the writers' internal checks are correct.

### T2-1 status: COMPLETE for all practical purposes
Every external reader (dashboards, MRP, production, reports, costing, valuation, stock pages, transaction forms) is
on the derived source; the WAC dual-write keeps valuation live; the ledger is repaired to full consistency and kept
as a maintained internal shim. Remaining is optional: the `stockCount` CYCLE worksheet (low-stakes), a future
`unified_stock_view` cleanup (Stage D), and manual testing of the 4 now-unbroken transaction forms.

## 6. Risks + safest first stage
Top risks: a missed on-hand reader silently reading 0 (mitigated by shadow-run diff); ORM-level breakage of
`where quantity <op> N` filters; master-id resolution correctness; fabric RAW/thread-meters mistakes mis-valuing
costing; UNION-view performance under MRP. **Safest first stage: Stage A** — purely additive, DROP to roll back,
and its reconciliation immediately shows whether the per-lot aggregation reproduces today's numbers and exactly
where the ledger has already drifted.
