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

## 6. Risks + safest first stage
Top risks: a missed on-hand reader silently reading 0 (mitigated by shadow-run diff); ORM-level breakage of
`where quantity <op> N` filters; master-id resolution correctness; fabric RAW/thread-meters mistakes mis-valuing
costing; UNION-view performance under MRP. **Safest first stage: Stage A** — purely additive, DROP to roll back,
and its reconciliation immediately shows whether the per-lot aggregation reproduces today's numbers and exactly
where the ledger has already drifted.
