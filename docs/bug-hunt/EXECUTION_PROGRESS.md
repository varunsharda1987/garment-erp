# Bug-Hunt — EXECUTION Progress

> The diagnosis lives in [START_HERE.md](START_HERE.md) / [FINDINGS_INDEX.md](FINDINGS_INDEX.md) / [REPAIR_PLAN.md](REPAIR_PLAN.md).
> **This file tracks what has actually been fixed, merged, and what's next** — so any session can resume.
> Last updated: 2026-07-18. Integration branch: **`main`** (pushed to origin).

---

## ✅ DONE — fixed, committed, on `main` (pushed)

**Individual fixes (each verified, own branch, merged to main):**
- CAD planning actions (approve/link/copy) — BH-0353
- Amount-in-words paise on invoices — BH-0070
- Fabric supplier-link wipe on save — BH-0207
- Customer accessory-preset clear — BH-0143
- Trim-master delete guards (checked empty table) — BH-0286
- Proforma GST rate label vs amount — BH-0071
- Bulk style import: CSV quoting + buyer scoping — BH-0262 / BH-0261
- Rate card save (schema drift + shrinkage divide-by-zero + slow save) — BH-0322/0366/0312
- Rate-slab boundary coin-flip — BH-0329
- (uncommitted, in the user's `api.ts` WIP) retry-POST-3x guard — BH-0280

**Guardrails (block regressions at commit + CI) — branch merged to main:**
- `scripts/hooks/smart-check.js` + `drift-detectors.js` + `ratchet.js` enforce, with baselines:
  schema↔controller alignment, routes-without-validateBody, enum-vs-Prisma drift, `z.string().datetime()`,
  divide-by-shrinkage, en-IN currency `maximumFractionDigits`. CI job in `.github/workflows/test.yml`.
- Baselines = grandfathered debt lists in `scripts/hooks/*-baseline.json` (burn these down over time).

**Stock data corruption + material module (the "only emergency") — DONE:**
- Root code fixes: `syncStockLevelQuantity` records real unit not PIECE (BH-0304) + defaults no-warehouse
  stock to Kashaya Fabs (BH-0310); `greige-stock.service` processor consume/receive now sync ledger (BH-0305).
- Data backfill: all no-warehouse stock rows → Kashaya Fabs (snapshots in `backend/scripts/*-snapshot.json`).
- **Ledger repair** (`backend/scripts/repair-stock-ledger.ts`, dry-run default): greige+fabric `stock_levels`
  rebuilt from per-lot tables. Ledger now == owned in-warehouse stock (greige 92,981.65, fabric 10,296);
  0 negatives; 5 FAB-RAW phantom split-ledgers consolidated; 6 missing materials created. Idempotent.
- **Recurrence prevented:** `@unique` on 8 materials type-FKs (all but labelId — size variants). Enforced (P2002).
  Migration `20260518000000_add_materials_type_fk_unique`.
- Migration state cleaned (removed 2 failed records; `migrate status` = up to date). Backup: `backend/prisma-migrations-backup.json`.

---

## 🎯 DESIGN VERDICT (material module) — NOT soundly designed

Two independent reviews agreed the corruption is a **design consequence**:
1. `stock_levels` is a **stored aggregate that should be DERIVED** (it's `SUM(quantityAvailable)` of the per-lot
   tables) but is maintained by error-swallowing, off-transaction manual `syncStockLevelQuantity` calls → drift.
2. `materials` had **no uniqueness** on its 28 type-FKs → phantom split-ledgers (now fixed with @unique).
3. App **mints phantom masters** (`FAB-RAW` fabric_master for raw greige) — root generator, still in code.
The correct fix is **~80% pre-built**: `unified_stock_view` exists but wrongly reads `stock_levels`; repoint it to
aggregate the per-lot tables. See the deferred item below.

---

## ⏭️ NEXT (in priority order)

1. **Phase 3 — system-wide architecture review** *(IN PROGRESS / approved)*: use the material module as the
   template; find where the same "dual-write aggregate + manual sync + missing uniqueness + contract drift"
   patterns repeat across orders/procurement, production, costing. Deliverable = prioritized remediation roadmap.
2. **Deferred redesign — make `stock_levels` derived**: rewrite `unified_stock_view` to `UNION ALL`-aggregate the
   per-lot tables (thread uses `metersAvailable`); serve on-hand from it; move policy cols (reorder/min/max/
   valuationRate/stockValue) to a settings table; retire `material-sync.helper` + the stock-sync guardrail + baseline
   + `reconcile-stock-levels.ts`. Eliminates the whole drift bug-class. Also: stop `fabric-stock.service` minting FAB-RAW.
3. **Burn down the guardrail baselines** (~243 grandfathered items) in impact order: currency-format (wrong money on
   docs), schema-alignment, shrinkage, datetime, enum, then route-validation.
4. **Remaining ARMED bugs** from FINDINGS_INDEX (e.g. GSTR-1 drops overdue invoices BH-0208; shrinkage-cost formula).

---

## ⚠️ KEY CONTEXT / gotchas for the next session

- **Owned vs processor stock:** the ledger shows **in-warehouse** stock only; ~52,870m of greige is *at processors*
  (`sourceType=TRANSFER`, off-ledger by design, BH-0305). The "60k understated" headline was misleading — real
  net error was ~7,740m. Do NOT re-inflate the ledger with processor stock.
- **The repair excludes** processor/transfer/null-warehouse rows and is scoped to GREIGE+FABRIC (thread=metersAvailable;
  button understated 225 pending unit-basis check).
- **Pre-existing schema↔migration drift** exists (unrelated to our work) — next `migrate dev` will fold it in; benign.
- **Guardrail is file-level** (misses unsynced write paths inside an otherwise-synced file) — the derived-view redesign removes the need for it.
- **Don't run `prisma migrate dev` casually** — it created a "modified/reset" scare from stale failed records (now cleaned).
- User is **non-technical** — explain fixes in plain terms; commit only the assistant's own files; never touch the user's WIP files or `.env`.
