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

## ✅ Phase 3 — system-wide architecture review: DONE → [ARCHITECTURE_ROADMAP.md](ARCHITECTURE_ROADMAP.md)

Verdict: the material module's flaws are **system-wide**. F1 (hand-maintained totals that should be derived) is
the dominant disease — ~23 instances across all 6 areas (stock was just the first). F4 (half-done saves, hidden
errors — e.g. GRN approval accepts a receipt while stock silently fails) is the engine. F5 ~13 (invoice files
wrong GST; ASN/DN 500s). F2 ~11 — **our materials uniqueness fix is only 9 of ~27 columns; finish it**. F3 contained (2 spots).

## ⏭️ NEXT (roadmap order — see ARCHITECTURE_ROADMAP.md)

1. **Tier 0 quick wins: DONE.** ✅ invoice GST/items (723a3fff), ✅ ASN + delivery-note 500s (ec229372),
   ✅ materials type-FK uniqueness now 27/28 (b98e74dc — closed the "9 of 27" gap; labelId excluded for size variants),
   ✅ order-creation breakup alignment (8fe8f216 — orderItemSchema now carries `breakup`/`totalQuantity`),
   ✅ greige-lace sourcing enum + wastage (337586cb — `GREIGE_LACE_PROCESSED`→`GREIGE_PROCESSED` so the PO
   generator's `=== 'GREIGE_PROCESSED'` check fires and greige/dyeing POs generate; added `wastagePercent` the
   controller reads).
   **DEFERRED to T2-1 (deliberately, not skipped):** stock-table uniqueness. 5 per-lot tables lack `@@unique`
   (lace_stock, button_stock, zipper_stock, elastic_stock, packaging_stock); greige/fabric/thread already have
   composite uniqueness (greige's is the user's in-flight `sourceChallanId` WIP migration). This is NOT a clean
   quick win: each table needs its own correct natural key, and any existing duplicate lots would make the
   `CREATE UNIQUE INDEX` migration FAIL → each needs live-data dedup verification first (a per-table repair like
   materials was). It also edits WIP `schema.prisma` at the exact greige_stock uniqueness the user is changing,
   and overlaps the T2-1 derived-inventory redesign where per-lot dedup is designed properly. The uniqueness gap
   that actually corrupted the ledger (the `materials` table) is already closed.
2. **Tier 1 atomicity:** ✅ **GRN approval all-or-nothing (T1-1) — DONE** (merged 095c4ceb). All 11 specialized
   *_stock creation paths moved INSIDE the approval `$transaction` (was: committed ACCEPTED, then created
   stock after-commit on the global client with 13 swallowed catches → accepted-with-no-stock). Every in-tx
   call threads `tx` (ensureMaterialRecord/createFromMaster/getOrCreateCategory made tx-aware; greige path uses
   skipMaterialSync + re-syncs on tx with the fold-adjusted qty; findFabricForGreige/validateSourceMismatchOverride/
   executeSourceMismatchCleanup on tx). Non-critical cascades (processing-PO status, cost-sheet sourcing, MRP
   received-qty which opens its own nested tx) moved to post-commit best-effort. `{ timeout:30000, maxWait:10000 }`.
   **Live-proven** on the real DB: injected a stock failure mid-approval → GRN stayed PENDING_QC, 0 stock, 0
   movements (full rollback); 3-agent adversarial review clean after 2 rounds.

   **Tier 1 F4 discovery (workflow) ranked 20 non-atomic write paths.** Fixed since:
   - ✅ **T1-2 recordPayment** (invoice.service.ts) — merged b1c87d0f. payment insert + invoice balance/status now
     one $transaction with atomic increment/decrement (race-safe). Live-proven 10/10; 2-lens adversarial review PASS.
   - ✅ **T1-3 processingDelivery** create/accept/delete — merged b7922008. Three two-write methods wrapped in
     $transaction; acceptDelivery uses conditional updateMany (no double-count); deleteDelivery guards the delete on
     status. 2-lens review PASS. (No live test — 0 processing rows to seed; same proven pattern + typecheck.)

   - ✅ **T1-4 mrp.allocateStock** — merged b01cbcda. requirement status update + FIFO lot reservations +
     stock_reservations audit now one $transaction (all writes on tx). Prevents double-reserve/oversell on partial
     failure. 1-agent adversarial review PASS. (Review flagged a PRE-EXISTING, out-of-scope over-reserve bug:
     `toReserve = min(remaining, quantityAvailable)` ignores existing `quantityReserved`, so a lot can be reserved
     past capacity — fix separately when reworking reservation logic.)

   - ✅ **T1-5 challan.issueChallan** — merged 3b8cbfab. issueChallan already ran in a $transaction, but two writes
     escaped: `consumeGreigeStock` (global client) + `createStockOut` (own nested $transaction). Both now take an
     optional tx and participate in the challan tx (backward-compatible for their other callers: dyeing/printing
     controllers, stockMovement.controller). Prevents stock-deducted-with-no-challan + double-deduct on retry.
     2-lens adversarial review PASS (atomicity + all-callers backward-compat).

   **Ranked REMAINING F4 targets (top-first):** #6 embroidery-stock.receive (ensureMaterialRecord
   w/o tx — 1-line); #7 fabric-stock.createStyleStock, #8 trim-stock.createTrimStock, #9 thread-stock.createThreadStock
   (specialized create + sync not atomic → silent under-report); #12 grn approveGRN MRP post-commit (best-effort by
   design; over-procurement if it fails); #13 external-process.createSendOut (outward challan after tx, swallowed → GST gap).

   ⚠️ **New finding while testing T1-1:** the backend has **pre-existing type errors** (server.ts env typing;
   stockMovement.service.ts:1252-1253 `unitPrice`/`totalPrice` don't exist on the selected type; laceCosting.controller.ts:31/70
   `wastagePercent` optional-vs-required) that were HIDDEN because `tsc` OOM-crashed before finishing (false "clean").
   Run tsc with `NODE_OPTIONS=--max-old-space-size=8192`. These are unrelated to our fixes (their files don't import
   ours) but they block ts-node type-checked runs of the GRN module graph. Fix separately + raise the CI tsc heap.
3. **Tier 2 redesigns:** make inventory a derived view (T2-1 — the deferred `stock_levels`/`unified_stock_view`
   redesign, now confirmed the top structural change), cost-sheet totals, production completed-qty, invoice paid/balance.
4. **Cross-cutting:** burn down the guardrail baselines (~243); remaining ARMED bugs (GSTR-1 BH-0208, etc.).

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
