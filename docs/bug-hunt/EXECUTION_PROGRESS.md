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

   - ✅ **T1-6 direct-stock batch #6-9** — merged 562aa76b. embroidery.receive (ensureMaterialRecord on tx),
     fabric.createStyleStock (create+sync wrapped in one $transaction), trim.createTrimStock + thread.createThreadStock
     (body → run(tx); `data.tx ? run(data.tx) : prisma.$transaction(run)` so standalone is atomic and a caller tx
     is joined; helpers threaded; skipMaterialSync + re-throw preserved). 2-lens review PASS (all callers grepped).

   - ✅ **T1-7 remaining F4** — merged 93952fb4. (a) createStyleStock now takes optional outerTx + joins receiveChallan's
     tx; (b) #13 external-process send-out OUTWARD challan created INSIDE the send-out tx (createChallan made tx-aware) —
     no more shipped-without-challan; (c) #12 grn→MRP: updateReceivedQuantity made tx-aware + folded into the approval
     tx (replaces the T1-1 post-commit collector) — closes over-procurement. 2-lens review PASS (all callers grepped,
     zero dangling mrpUpdates). TWO intended behavior changes: send-out rolls back if its challan fails; GRN approval
     rolls back if the MRP update fails.

   ### ✅ Tier 1 F4 atomicity: COMPLETE (T1-1..T1-7 all merged). All critical/high/medium ranked write-paths closed.

   **Known siblings / follow-ups (not blocking):** the INWARD receive challan in external-process.service.ts:~478 is
   the same post-tx/swallowed pattern as #13 but on the receive side (material back from vendor recorded with no
   inward challan on failure) — sibling of #13, left intentionally for now.

   ### ✅ Pre-existing tsc-hidden type errors: FIXED (merged 62d3fbf9)
   The backend `tsc` was OOM-crashing before finishing (default heap) → exited "clean" while 7 real errors hid.
   Fixed all 7: laceCostingCalculation LaceCostOptions.wastagePercent→optional (runtime already validates);
   server.ts `app.listen(Number(PORT))`; stockMovement.service.ts movement-report GRN branch read non-existent
   `item.unitPrice`/`totalPrice` (so rate/totalValue were ALWAYS null) → now includes purchase_order_items,
   totalValue = unitPrice×receivedQuantity (real bug fix). Raised heap: backend `type-check`/`build` now
   `--max-old-space-size=8192`; CI test.yml backend TS step runs `npm run type-check` so an OOM can't masquerade
   as clean again. `tsc --noEmit` now reports **0 errors**.

   <!-- superseded ranked list below (kept for provenance) -->
   Old #6 embroidery-stock.receive (ensureMaterialRecord
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

---

## 📦 T2-1 progress (derived on-hand inventory) — see `T2-1_DERIVED_STOCK_PLAN.md` for the full staged plan

- **Stage A** (build derived source) — DONE. `stock_settings` + `derived_stock_view`; drift report = derived==ledger
  for 43/44 (material,warehouse) pairs; 1 genuine drift (BTN-0001 ledger 75 vs physical 300).
- **Stage B1** (reorder alerts) + **B2** (Stock Levels page) — DONE + live-verified via Playwright.
- **Stage B3** (on-hand DECISION readers) — DONE + live. Repointed MRP (`mrp.service`, `material-requirement.service`),
  production-blocking (×2), and the dashboard low-stock KPI to `getDerivedOnHand` / `countDerivedBelowThreshold`.
  Parallel-run diff (`backend/scripts/diff-derived-onhand.ts`): only BTN-0001 changes (75→300, correct physical);
  dashboard KPI 5→4 (dropped a phantom row). Build clean, `pm2 reload garment-erp-api` OK.
  **Deferred within B3:** `stockMovement.service` reads (they're the ledger *writers* → Stage C);
  `stockCount.service` worksheet builder (→ B5 frontend/worksheet pass).
- **Stage B-valuation** (WAC dual-write) — WRITE HALF DONE + live; READ half deferred to Stage C. A 9-agent
  verification workflow (reader/writer sweep + 4 adversarial checks, all SAFE) ruled: valuation rate is NOT
  derivable (it's a stored WAC), so make `stock_settings` a live WAC target FIRST, repoint zero readers.
  Dual-wrote the rate into `stock_settings` from all 3 write sites (both WAC engines + manual admin), guarded
  `if (rate)`, update-only (never clobbers reorder/min/max). Verified non-destructively: mirror in sync,
  SUM(stockValue) unchanged (no reader moved), real in-tx `increaseStock` mirrored settings↔ledger then rolled
  back. See `T2-1_DERIVED_STOCK_PLAN.md` for the deferred-reader list + the ⛔ Stage-C sequencing gate.
  Surfaced 2 pre-existing bugs (logged, not fixed): `getStockSummaryByType` 500s on `unified_stock_view`
  (no stockValue column); `mat-pkg-0001` has stockValue≠qty×rate drift.
- **Next:** B5 (frontend + stockCount worksheet) → Stage C (stop writing `stock_levels.quantity`; re-backfill
  `stock_settings.valuationRate`; repoint valuation readers as one atomic set; retire the 5 writers + guardrail)
  → Stage D (cleanup). Reminder: PM2 runs compiled `dist/`, so every backend repoint needs `npm run build` +
  `pm2 reload garment-erp-api` to go live.

---

## 🧹 2026-07-23 — Pending-items wave 1 (post-backlog cleanup)

**Commit e7b92e96** — deferred DB constraints, all pre-verified (0 violating rows) + negative-tested in rollback txns:
- `order_item_breakup` partial unique `(orderItemId, sizeId) WHERE colorId IS NULL` (NULL-color rows escaped the composite unique)
- `po_source_links`: 4 partial uniques (one link per PO-item+source) + CHECK ≤1 polymorphic source FK
- `style_costing_trim_items`: CHECK ≤1 of the 24 master FKs (costing-19 DB half)

**Commit 74c141a8** — 9 PLAUSIBLE backlog items (5 parallel agents + central gate), catalogue filter, WO completion gap:
- orders-19 (atomic quotation numbers — format now `QT2607-0001`, was `QT-2607-0001`), orders-21, production-22,
  costing-16 (+ deleted dead cost-sheet-versioning.service.ts), costing-19 Zod refine, costing-20,
  dispatch-8 (dead client methods), dispatch-14 (verified already fixed), samples-embroidery-15 (guarded decrement)
- Catalogue size filter: was dead (matched a field hard-set to undefined → any size selection emptied results);
  now styles list includes lean `size_options`, exact token matching (fixes S⊂XS), chips from live data
- **Upgraded find (item F):** finishing completion inserted READY_TO_SHIP tracking WITHOUT the WO rollup — finishing-driven
  completion never flipped WOs to COMPLETED. Extracted `recomputeWorkOrderCompletion` (same-tx, row-locked), wired both
  paths, CMT actuals auto-push post-commit, `completedQuantity` removed from UpdateWorkOrderDTO, zero-qty WO guard.
- Gate: backend+frontend builds clean, guardrails `--all` pass (generator baseline 37→36), PM2 deployed, auth smoke green
  (styles carry sizeOptions; embroidery send-out reachable & validating; ASN apply validates).

**Remaining queue:** D (36 count-based generators → sequences), E (detectors #2/#4/#7), G (delivery-note page feedback
+ ?asnId prefill), H (user decisions: quotation number format OK? api.ts keep/revert; error.middleware.ts WIP).

---

## ⏸️ 2026-07-23 — PAUSED mid-wave-2 (user request) — RESUME CHECKLIST

**State:** Generator migration (item D) + 3 new guardrail detectors (item E) are CODE-COMPLETE ON DISK but
**NOT built, NOT deployed, NOT committed**. The running backend (PM2 dist/) still runs the OLD code — the app
is safe to use as-is. ⚠️ Do NOT rebuild/restart the backend before running the seed step below.

**What's on disk (uncommitted, ~30 files):**
- All 40 generator sites migrated to atomic `code_sequences` (4 agents, all tsc-clean individually):
  GEN1 trim batch codes via rewritten shared `utils/code-generator.ts` (formats preserved; `generateBatchCodes`
  renamed `allocateBatchCodes`); GEN2 master codes (AGY/AGT/CLR/material/warehouse/GPT formats preserved;
  dead testingLabs generator deleted); GEN3 documents (SO/SC/SPO/WO/STY/samples unified format); GEN4
  (PO delegation, SM/HW/EP/MR unified, CH/PB/DEL/LIS series continued; 2 dead PO generators deleted;
  CN/DN/INV already atomic — baseline entries removed only).
- `backend/scripts/seed-code-sequences.ts` — COMPLETE with all 75 seed entries (KEEPER, idempotent).
- 3 new detectors in `scripts/hooks/drift-detectors.js` + smart-check wiring + baselines committed-ready:
  swallowedWriteErrors (60 baselined), assignNotIncrement (12), schemaFrontendParity (2); also fixed the
  latent opt-out-marker bug (blankComments erased `// allow-*` markers) and GEN agents hardened countNumbering.
- `count-numbering-baseline.json` now contains ONLY the stale quotation entry (already atomic).

**RESUME GATE (in this order):**
1. `cd backend && npx ts-node scripts/seed-code-sequences.ts` — MANDATORY FIRST (master-code formats are
   unchanged; unseeded sequences would mint colliding codes → P2002 on unique columns).
   Note: CH2607/PB2607/DEL2607/LIS2607/EMB-202607 entries are month-pinned — if resuming AFTER July 2026,
   they're harmless no-ops (fresh month = fresh series) EXCEPT re-check any docs created in the gap month.
2. `cd backend && npm run build` ; `cd frontend && npm run build`
3. `node scripts/hooks/smart-check.js --all` (count-numbering should show ~0-1 known; 3 new checks active)
4. `pm2 reload garment-erp-api` + poll /api/health + smoke: create a master (e.g. color) to prove seeding
   (new code continues after current max), list orders/quotations/challans.
5. Commit (exclude backend/.env + error.middleware.ts) + push.

**Known follow-ups from agent risk notes:** saleOrder format change is visible to the B2B consumer
(SO-2607-0001 → SO2607-0001 — opaque string, but flag it); stock-count numbers no longer embed warehouse code;
GPT test numbers now one global series; unused CHN wrapper in atomicCodeGenerator could fork the challan series
if ever called (consider deleting); docs/SAMPLE_EMBROIDERY_GUIDE.md still shows the old embroidery generator snippet.

---

## ✅ 2026-07-26 — RESUME GATE COMPLETE (wave 2 live)

Resumed per checklist; all steps green, pushed as **c7b2d9e1**:
1. Seed ran against live data — 19 prefixes continue existing series (CLR=194, GRG=57, LBL=20, WH-JW=8...);
   material_master "no match" results verified correct (its rows carry sync'd dashed codes; generator format unchanged).
2. Challan series verified continuous (live data CH2605-0009 ↔ migrated 'CH' key); unused CHN wrapper deleted
   + 2 stray CHN sequence rows purged + unit test updated to generateAtomicDocNumber.
3. Builds clean; smart-check --all green — **count-based numbering check now reports 0 (bug class closed, was 41)**;
   3 new detectors active (swallowed-write 60, assign-not-increment 12, parity 2 — all baselined cleanup lists).
4. PM2 deployed; smoke green on 8 migrated modules; END-TO-END SEEDING PROOF: created color minted **CLR195**
   (continues after existing CLR194), then deleted.
5. Follow-ups closed: B2B app verified display-only for saleOrderNumber (format change safe; guide annotated);
   embroidery guide snippet updated to the atomic implementation.

**Remaining:** G (delivery-note page — user feedback from real use + ?asnId prefill); detector cleanup lists
(60 swallow / 12 assign / 2 parity — fix-when-touched); user's error.middleware.ts WIP.

---

## ✅ 2026-07-26 — 74-spot cleanup COMPLETE (commit 92ae9d85) — all cleanup baselines at ZERO

5 fix agents + 5 adversarial reviewers (all verdicts CLEAN). Swallowed-write 60→0, assign-not-increment 12→0,
parity 2→0, count-numbering stays 0 under a hardened detector (arrow-fn + inline forms) that exposed and
closed 11 straggler generators (formats byte-identical, per-scope lazy seeding, P2002 retry on unique columns).

**Headline finds:** (1) TCS schema was a TDS copy-paste describing nonexistent columns — every TCS create
400'd since validation was added; rewritten to the real model, smoke-proved live. (2) Cost-sheet item
populations were logWarn-swallowed — silent data loss on any bad save; now atomic with the sheet.
(3) External-process dashboard rollups swallowed INSIDE Postgres txns (aborts poison the tx, 25P02) —
moved post-commit. (4) Master+materials creates made atomic (split-ledger root cause closed at every site).

Also shipped: delivery-note ?asnId prefill (order load + plan-narrowed rows + badge + payload link).

**Behavior changes to watch in real use:** generic-trim create fails loudly if its material category is
missing (was: silent no-materials-record); lookup bulk create 500s on genuine (non-duplicate) errors;
MRP reports unresolvable materials instead of silently skipping supplier links.

**Remaining:** G (delivery-note user feedback); H (user's error.middleware.ts WIP). Cleanup lists: none.
