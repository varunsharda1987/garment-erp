# Garment-ERP — System Architecture Roadmap

> Output of the Phase-3 system-wide review (6 module reviewers + synthesis, 2026-07-18).
> The **material module** is the proven template: same problems, already fixed there with (a) database
> uniqueness rules (cheap structural win) and (b) safe stock-sync. Those two moves apply almost everywhere.
> Companion: [EXECUTION_PROGRESS.md](EXECUTION_PROGRESS.md).

## The five flaw types (plain terms)
- **F1** — a running total is *stored and edited by hand* instead of *added up fresh from the real records*. It drifts.
- **F2** — the database lets two records secretly be "the same thing" because no uniqueness rule forbids it.
- **F3** — the code invents a fake second copy of a master record (a "phantom") to make something fit.
- **F4** — an all-or-nothing save is done in loose separate steps; a mid-step failure is hidden and left half-done.
- **F5** — the data-entry validation doesn't match what the code reads, so real data users type is silently dropped.

---

## The systemic story

**F1 (hand-maintained totals) is the architecture-wide disease — ~23 instances across all 6 areas.** `stock_levels` was just the *first* one. It's the codebase's default habit:
- **Inventory (worst):** one quantity is stored **four times** — the lot table, its ledger, `stock_levels`, and an orphaned `inventory_stock`.
- **Procurement:** `receivedQuantity` (3 divergent writers), PO money/GST totals (3 inconsistent formulas), order totals, challan totals.
- **Production:** `completedQuantity` never synced (dashboards read 0% until a jump to 100%), processing-batch running totals never maintained.
- **Costing:** ~40 money rollups written by **3 contradictory calculators**; cost lines stored twice (JSON + tables).
- **Finance:** `paidAmount`/`balanceAmount` (ignores credit notes), invoice `status` (only right if a cron ran), `bank_accounts.currentBalance`.
- **Dispatch:** ASN/delivery-note totals declared but never written; carton status never set.

**F4 (half-done saves, hidden errors) — ~16 instances.** This is the *engine* that turns F1 into live corruption — the exact mechanism that corrupted the material module. Worst: **GRN approval** — a goods receipt can be marked ACCEPTED while the stock it should create silently fails (errors logged and ignored).

**F5 (validation ≠ code) — ~13 instances, cheap but several are live breaks.** Standouts: every API-created **invoice files the wrong GST** (compliance); **ASN & delivery-note creation 500-error**; greige-lace **never generates its dyeing POs**; order creation **drops the size/colour breakup**.

**F2 (missing uniqueness) — ~11 instances.** The material fix is **incomplete**: only 9 of ~27 identity columns are protected, **18 newer trim/accessory types are still open**, 8 of 11 stock tables have no uniqueness, and the greige lot-uniqueness is *illusory* (nullable columns mean it never fires for manual entries). Delivery-note/ASN numbers also race.

**F3 (phantom masters) — only 2 spots, CONTAINED.** Good news: does **not** recur system-wide; lives only in the greige↔fabric↔MRP corner.

**Bottom line:** the system *stores numbers it should calculate*, *saves them unsafely*, and *half-guards duplicates*. The material module already proved the cure — it just wasn't finished or applied elsewhere.

---

## Prioritized roadmap
*Ranked by (live-corruption risk × blast-radius) ÷ fix-cost. Effort: S = days, M = a week or two, L = weeks–months.*

### Tier 0 — Quick wins (do first)
- **QW-1 · Finish the database uniqueness rules** (S, batched): the 18 remaining material types + the 8 unguarded stock tables; fix the *illusory* greige/fabric/thread lot-uniqueness so manual entries de-dupe; add uniqueness to delivery-note/ASN numbers. **Prereq:** run the existing duplicate-cleanup scripts first.
- **QW-2 · Fix validation-vs-code mismatches (F5)** (S each): **invoice line-items + tax rate first (compliance)**, then ASN/delivery-note field fixes, order breakup, lace option-name/wastage (unblocks greige-lace POs).

### Tier 1 — Stop the active bleeding (make unsafe saves all-or-nothing)
- **T1-1 · GRN approval atomic + stop hiding stock errors** (M) — **highest priority after quick wins**; the front door where all inventory enters. Closes the exact hole that corrupted the material module.
- **T1-2 · Greige/fabric stock write paths** (consume/reserve/raw-greige-in) — one transaction, atomic, no swallowed sync errors (M).
- **T1-3 · Dispatch finished-goods decrement** — transaction, allocate across locations, hard-stop on insufficient stock, call the sync helper (M).
- **T1-4 · Payment recording** — one transaction; recompute "paid" from actual payments (M).
- **T1-5 · `receivedQuantity`** — recompute from actual receipts, not 3 competing writers (M).

### Tier 2 — Structural redesigns (the real cure for F1; after Tier 1)
- **T2-1 · Make inventory a *calculated* view, not hand-kept copies** (L) — the single most valuable change: lot tables become the one source of truth, `stock_levels` becomes a rollup, retire `inventory_stock`, delete the hand-sync (and the `FAB-RAW` phantom). Stage: Tier 1 → reconciliation checks → switch reads to calculated → remove manual copies. **This is the deferred redesign already identified for the material module.**
- **T2-2 · Cost-sheet totals calculated from line items** (M–L) — one calculator; fixes lace silently vanishing from per-piece cost.
- **T2-3 · Production "completed" quantities calculated from actual output** (M) — every production dashboard is wrong today.
- **T2-4 · Invoice paid/balance/status calculated** (payments − credit notes) + **one** GST calc everywhere (M).

---

## Explicitly NOT worth doing (honest calls)
- Rebuilding the polymorphic **BOM / cost / challan line tables** — huge migration, little payoff (repeating a material there is legitimate). A cheap "exactly one identity filled in" check suffices.
- Syncing `inventory_stock` (the 4th copy) — just retire it inside T2-1.
- The `"meters"` vs `"METER"` unit mismatch — harmless for now; fold into T2-1.
- **F3 phantom masters** — 2 contained spots; fix opportunistically during T2-1.

## One caution (owning it)
The material module is the right template, but it was left **half-finished**: 9 of ~27 identity columns protected, and its sync helper still swallows its own errors. **Completing that template (QW-1 + removing the error-swallowing) is itself part of the fix** — not just a model to copy.
