# Phase 3 Remediation Roadmap — Garment ERP System Architecture Review

> **EXECUTION STATUS (2026-07-22):**
> ✅ **R1a done** — financial-gst-1: GSTR-1 OVERDUE filter removed; shared `reportableInvoicesWhere` now used by
> BOTH GSTR-1 and GSTR-3B (structurally cannot diverge). Deployed + live-verified.
> ✅ **Quick-wins batch done (15 fixes, deployed + probe-verified):** financial-gst-4 (invoice create/update/query
> dates → `z.coerce.date()` — invoicing revived), costing-8 (Decimal string-compare → `Number()`), orders-1 (body
> `id` removed from update/status schemas), orders-3 (status route now delegates to `orderService.updateStatus` —
> state machine enforced), dispatch-10 (delete guard uses real `IN_TRANSIT`/`DELIVERED` values), s-e-1/-3 (Sample
> type/status enums mirror Prisma; feedback subset fixed; query accepts arrays), financial-gst-2/-3 (TDS schemas
> rewritten to mirror `tds_entries` + `TDSStatus`; certificateNo passes; consistency refines added), dispatch-6
> (datetime sweep across dispatch.schema.ts with null-safe `nullableDate`), production-2 (`returnedQuantity` name
> aligned), production-3 (record-output/issue-to-stitching schemas match real payloads; silent `if (sku.id)` skip →
> resolve-or-throw), s-e-4 (embroidery routes accept cuid via `flexIdParamSchema`/fixed `embroideryIdParamSchema`),
> financial-gst-5 (chart-of-accounts update no longer always-409), costing-5 (`versionReason` declared).
> Live probes: orders PUT → 404-not-400; invoice accepts `YYYY-MM-DD`; embroidery accepts cuid; TDS/sample errors
> now cite the real model fields/enum values. NOTE: `z.coerce.date()` was used with a null-safe union for nullable
> fields (bare coerce turns `null` into 1970-01-01).
> ✅ **All 3 remaining CRITICALs done (2026-07-22, deployed)** — implemented, adversarially reviewed (5 lenses, all
> SOUND_WITH_NITS, 4 IMPORTANT findings fixed before deploy), built + smoke-verified:
> • **production-1**: `completedQuantity` now DERIVED = SUM of completion-stage tracking rows **(PACKING + READY_TO_SHIP
>   — review caught that the real finishing flow writes READY_TO_SHIP and nothing writes PACKING, so PACKING-only would
>   have been dead code)**, recomputed in the same tx as the insert, WO row locked FOR UPDATE first (serializes
>   concurrent entries), never demotes DISPATCHED/CANCELLED, preserves actualEndDate; `completedQuantity` removed from
>   updateWorkOrderSchema (derived-only).
> • **costing-2**: PUT /style-costing/:id validates with the ONE UpdateCostSheetSchema (utils); controller re-parse
>   removed; divergent schema deleted. **Review caught: Zod 4 `.partial()` does NOT suppress `.default()`** — the update
>   schema now strips ZodDefault wrappers (empirically verified truly-partial against dist: no injected
>   purpose/markupPercent/valueLoss; real edits flow through).
> • **dispatch-1**: delivery-note create + FG deductions in ONE tx; per-row atomic take-min via row-locked CTE (review
>   caught the snapshot+guard version under-deducted when a concurrent note partially consumed a row); deterministic
>   lock ordering (qty desc, id asc) against deadlocks; tx timeout 15s; exact-SKU only (no wrong-color deductions);
>   shortfalls logged + returned as `fgShortfalls` (explicit, never silent).
> Review NITs logged for follow-up: legacy cumulative-PACKING backfill semantics; internal callers can still hand-set
> completedQuantity via service DTO (route-blocked only); POST /:id/tracking lacks validateBody; packing-driven
> completion doesn't auto-push CMT actuals (pre-existing); POST /style-costing still on the legacy create schema
> (→ T3-A); deleteDeliveryNote doesn't restore FG stock (→ T3-C/R5); frontend discards fgShortfalls (create page not
> routed — dispatch UI gap).
> ✅ **R1b done (2026-07-22, deployed + rollback-verified):**
> • **financial-gst-6**: credit-note `approve()` is now one tx — guarded DRAFT→APPROVED flip (double-approve gets
>   count 0, cannot double-credit) + atomic `balanceAmount: { decrement }` on the invoice + PAID flip when settled.
>   Reversal path note: cancel/delete are DRAFT-only, so approval is one-way; any future APPROVED-reversal must
>   re-increment. Verified via scratch invoice + CN in a rolled-back tx: 2100→1785, double-approve blocked, 0 residue.
> • **financial-gst-8**: `updateInvoice` is now one tx; on any money edit, tax/total/cgst/sgst/igst/balance are
>   recomputed SERVER-SIDE from subtotal (effective rate + GST split preserved; sgst takes the rounding remainder so
>   the split sums exactly; balance derived from the row read inside the tx). Due-date-only edits recompute status.
>   Verified: subtotal 1000→2000 ⇒ tax 100/total 2100/split 50+50+0 exact.
> ✅ **§5 guardrails (2026-07-22): 5 of 9 landed** — new baseline-ratchet detectors in `smart-check.js` /
> `drift-detectors.js`, self-tested (each fires on synthetic bad code, silent on the fixed form), full `--all` run
> green: **#1 controller-reparse** (found 29 existing dual-schema re-parses — that baseline IS the T3-A worklist),
> **#3 global-prisma-in-tx** (0 direct instances left — Tier-1 tx-threading cleaned them; cross-FUNCTION escapes,
> e.g. a helper using the global client, are a known detector limitation), **#5 decimal-compare** (4 existing),
> **#6 count-numbering** (41 existing generators — the F2 sequence-table migration worklist), **#8 enum-drift
> hardened** (the <50%-overlap skip that let zero-overlap SampleTypeEnum ship is gone; name-matched enums always
> compared, zero overlap = one loud violation; baseline regenerated, 44 keys). Baseline regenerator:
> `scripts/hooks/generate-new-baselines.js`. Remaining §5 items (future): #2 schema↔frontend payload parity,
> #4 assign-where-increment-expected, #7 swallowed-write-errors, #9 burn down datetime/currency baselines.
> ✅ **T3-B receiving-pipeline atomicity DONE (2026-07-22, deployed)** — procurement-3/4/5/7 + 9 adversarial-review
> findings fixed pre-deploy (the review caught a real BLOCKER in the first implementation):
> • `createStockIn(data, outerTx?)` tx-threaded (run(tx) dispatch); receiveChallan passes its tx.
> • receiveChallan: challan row-locked FOR UPDATE at tx start (serializes double-clicked receives — review catch:
>   the snapshot alone raced), status guard (throws on RECEIVED/CANCELLED), item-ownership validation (foreign
>   challanItemIds rejected — review catch), and DELTA crediting in **BOTH** INWARD branches (general AND the
>   processing-linked createStyleStock branch — review BLOCKER: the second branch still credited full cumulative);
>   service-requirement completion re-uses CUMULATIVE received (review catch: delta broke COMPLETED detection).
> • createGRN PROCESSING: job validated PRE-tx (no more reject-after-booking); fabric/challan/job writes in-tx;
>   challan failure aborts the receive (no more swallowing); job receive guarded on receivedDate:null AND status
>   in AT_MILL/SENT_TO_MILL; tx timeout 15s. Printing-module receive got the same guarded updateMany (review
>   catch: the competing path could silently overwrite a GRN receive).
> • approveGRN nets rejectedQuantity out of PO receivedQuantity in-tx; approve/reject status flips are GUARDED
>   updateMany on PENDING_QC (review catch: concurrent approve+reject could double-net → negative counters);
>   post-commit PO-status recompute SKIPS PROCESSING POs (review catch: shrinkage semantics — received<ordered is
>   normal) and updateReceivingStatus now RE-OPENS a 100%-rejected PO (RECEIVED/PARTIALLY_RECEIVED → ACKNOWLEDGED).
> Deployed: build clean, challans/GRN/PO endpoints 200, error log clean. Known residuals (baselined/deferred):
> challan-number count-generation P2002 under concurrency (count-numbering baseline → T3-F), routing-helper
> swallow message cosmetics, createStockOut `any` typing.
> ✅ **T3-A single-schema sweep DONE (2026-07-22, deployed, commit 5ccea8b5)** — all 29 re-parse sites analyzed
> (per-endpoint: route schema vs controller schema vs real frontend payload) then fixed by 8 parallel
> implementation agents + central build/verify. Classification: 12 DIVERGENT (7 HIGH — including POST
> /style-costing, whose legacy route schema killed every UI cost-sheet CREATE; pattern-parts ×3; service-PO
> generate-po/bulk; fabric-procurement create), 7 UNVALIDATED, 10 REDUNDANT. controller-reparse baseline
> **29 → 0**; enum-drift 44 → 42 (service enums realigned). Live-verified: formerly-dead POSTs return correct
> field-level validation, touched list endpoints 200. Net −229 lines.
> ✅ **T3-C FG-ledger completion DONE (2026-07-22, deployed, commit ddf4a08a)** — migration
> 20260722150000 (additive, pre-verified safe): `delivery_note_fg_allocations` records every FG deduction inside
> the create tx → deleting a PENDING note restores stock EXACTLY (dispatch-2 closed); over-dispatch validation
> moved in-tx with order row-lock + PER-SKU caps from order_item_breakup (dispatch-3); deliveryNumber +
> slipNumber UNIQUE + partial uniques = one slip per cutting batch/stitching issue/finishing issue
> (dispatch-5/production-8); finishing slip+FG credit is one tx with existing-slip guard + upsert-increment
> (production-9); cutting/stitching guards added; frontend service surfaces fgShortfalls.
> **⚠ Flagged missing FEATURE (not built):** the "Create Delivery Note" buttons link to
> /manufacturing/dispatch/delivery/new — no page/route exists; needs a product pass to build the form.
> ✅ **BACKLOG FULLY VERIFIED + 5 HIGHs fixed (2026-07-22, commit 1ea3c2f2, deployed + pushed).** All 87
> MEDIUM/LOW findings verified against CURRENT code (docs/bug-hunt/BACKLOG_VERIFICATION.json): 75 CONFIRMED,
> 9 PLAUSIBLE, 3 ALREADY_FIXED, 0 REFUTED. The 5 severity-upgrades all fixed: procurement-21 (bulk MRP
> under-buying on shared fabrics), production-11 (damaged double-count falsely completing send-outs),
> procurement-13 (cancelChallan orphaning issued stock — now DRAFT-only), financial-gst-10 (STATUTORY:
> GSTR-3B ITC now from ACCEPTED GRN receipts pro-rated, carry-forward no longer clamped), dispatch-12
> (REJECTED/PARTIAL PODs restore FG stock + net the dispatch cap).
> **Every one of the original 145 audit findings is now fixed, verified-and-queued, or closed.**
> ~~⏳ Open queue: 69 CONFIRMED/PLAUSIBLE MEDIUMs + 19 LOWs...~~ **STALE — all subsequently closed:**
> the usability wave (2026-07-23) burned the CONFIRMED MEDIUMs/LOWs; the 9 PLAUSIBLEs + 2 deferred
> migrations landed 2026-07-23 (74c141a8/e7b92e96); T3-F numbering fully closed incl. 11 detector-blind
> stragglers (c7b2d9e1, 92ae9d85); §5 detectors #2/#4/#7 live with their cleanup lists driven to ZERO
> (92ae9d85); delivery-note page shipped + ASN prefill. As of 2026-07-26 the audit queue is EMPTY —
> remaining risk lives only in the grandfathered ratchet baselines (fix-when-touched) and real-use feedback.

*Synthesized from 57 verified CRITICAL/HIGH findings + 60 unverified MEDIUM/LOW backlog items across 7 modules (orders, procurement, production, costing, financial-gst, dispatch, samples-embroidery). Every claim cites a finding id. Static code audit only — live-DB drift magnitudes unmeasured except where noted.*

---

## 1. Executive Summary

**How healthy is the system?** The read side of the ERP is broadly functional; the **write side is in far worse shape than the material-module template suggested**. This audit found two distinct disease patterns:

1. **Dead or lying endpoints (F3).** A remarkable number of write endpoints fail on 100% of calls or silently do nothing while returning success. Entire workflows are unreachable from the UI today: editing any order (orders-1), creating/editing/versioning cost sheets (costing-2, costing-4, costing-5), approving cost variance (costing-6 — which in turn **blocks order creation** for affected styles), creating/editing invoices from the UI (financial-gst-4), recording proof of delivery (dispatch-6), issuing cut pieces to stitching (production-3), completing a cutting batch with fabric returns (production-2), creating samples (samples-embroidery-1), embroidery send-out/receive (samples-embroidery-2), TDS entry (financial-gst-2). The most dangerous variant is the **silent no-op**: costing-2 returns "Cost sheet updated successfully" while discarding every edit — users believe data is saved when it is not.

2. **Ledger drift by construction (F1 + F4 + F5).** The exact stock_levels template (hand-maintained counters, off-transaction writes, swallowed errors) recurs in every quantity ledger downstream of materials: finished-goods stock (dispatch-1/2, production-9), challan receiving (procurement-3/4), PO received quantities (procurement-7), work-order completion (production-1), cutting fabric issuance (production-4/5/6/7), external-process and embroidery receipts (production-10, samples-embroidery-5), cost-sheet actuals (costing-3), and invoice balances (financial-gst-6). Without intervention these will drift exactly as stock_levels drifted ~60k.

**Most pervasive class: F3 (contract drift)** — 23 of 57 verified findings including 3 of 6 CRITICALs, plus ~20 more in the backlog. Root cause is architectural, not carelessness: **the same request is routinely validated twice by two independently-maintained schemas** (route `validateBody` + controller-local `.parse`), and Zod enums are hand-copied from Prisma enums. Two schemas that must agree, maintained separately, will always drift.

**Most dangerous class: F1/F4 combined (stored aggregates + non-atomic writes)** — these corrupt data permanently and invisibly (phantom stock, double credits, unrecoverable costing baselines), where F3 bugs at least fail loudly or are recoverable once fixed.

**Standalone statutory risk:** financial-gst-1 (CRITICAL) — GSTR-1 silently drops all OVERDUE invoices, under-reporting GST liability and contradicting GSTR-3B for the same period. This is a compliance exposure, not just a bug.

**One positive:** `recordPayment` was already hardened (single transaction, atomic increment, post-decrement guard) — proof the correct pattern exists in-repo and just needs to be propagated.

---

## 2. Top 10 Ranked Remediation Actions

Ranked by (business damage × certainty × reach). Effort: S <1 day, M 1–3 days, L 1–2 weeks for a competent AI-assisted engineer.

**R1. Fix the statutory GST reporting filter + credit-note balance effect.**
Fixes: financial-gst-1, financial-gst-6, financial-gst-8. What: remove the status filter from the GSTR-1 invoice query; introduce one shared "reportable invoices" query used by GSTR-1 AND GSTR-3B; on credit-note approval atomically decrement `invoices.balanceAmount` (or better, derive effective balance = total − payments − approved CNs everywhere); recompute tax/total columns server-side on invoice update. Blast radius: GST filings, receivables dashboard, dunning. Effort: **S** (gst-1) + **M** (gst-6/8). Point fixes, with one small structural element (shared query). **Do this first — it is a legal exposure and the cheapest CRITICAL to fix.**

**R2. Kill dual-schema validation everywhere (the F3 structural fix).**
Fixes: costing-1, costing-2, costing-4, costing-6, costing-7, procurement-2, orders-15, procurement-12, costing-22. What: adopt one rule — *exactly one Zod schema per endpoint, living in `backend/src/schemas/`, imported by both the route's `validateBody` and (for types only) the controller; delete every controller-local `.parse()` re-validation*. Start with style-costing (its entire write surface is dead: create 400s, update no-ops, versioning and variance-approval 400) and fabric-procurement. Blast radius: the whole costing module becomes usable again; unblocks order creation for variance-flagged styles (costing-6 → order.controller VARIANCE_PENDING). Effort: **M–L** across all endpoints. **Structural redesign** (the T2-1 of this roadmap) — plus the smart-check guardrail in §5 to keep it fixed.

**R3. Batch-fix the "always-400" field/enum drift endpoints.**
Fixes: orders-1, financial-gst-4, dispatch-6, production-2, production-3, samples-embroidery-1, samples-embroidery-2, samples-embroidery-3, samples-embroidery-4, samples-embroidery-6, financial-gst-2, financial-gst-3, costing-5, procurement-1. What: mechanical alignment — remove body `id` requirements, rename drifted fields (`returnQuantity`→`returnedQuantity`, `skuId`, `versionReason`, TDS fields), replace every `z.string().datetime()` with `z.coerce.date()`, mirror Prisma enums (SampleType/SampleStatus/TDSStatus) exactly, use cuid-tolerant param schemas for embroidery, add the three stripped GRN override fields. Each fix is trivially verifiable (the repro is "submit the form"). Blast radius: order editing, invoicing, POD, sampling, embroidery, TDS, GRN source-mismatch all come back to life. Effort: **M** total (each item S). Point fixes.

**R4. Make challan/GRN receiving atomic, idempotent, and delta-based.**
Fixes: procurement-3, procurement-4, procurement-5, procurement-7. What: (a) give `createStockIn` an outer-tx parameter (pattern already exists on `createStockOut`) and pass the receive transaction; (b) add a status guard to `receiveChallan` and credit only the delta (new − previous receivedQty) per item, never re-looping `allItems`; (c) validate job-work-order state *before* the GRN transaction and move job/challan/fabric writes inside it; (d) derive PO `receivedQuantity` from accepted grn_items of ACCEPTED GRNs so QC-rejected quantity re-opens the PO. Blast radius: every material receipt in the company — this is the #1 source of future stock_levels-style drift. Effort: **L**. **Structural redesign** of the receiving pipeline.

**R5. Rebuild the dispatch FG-stock ledger.**
Fixes: dispatch-1 (CRITICAL), dispatch-2, dispatch-3, dispatch-5, dispatch-10, plus production-8/production-9 (the inbound side). What: one `prisma.$transaction` wrapping delivery-note create + per-SKU `updateMany` guarded decrements (`quantity >= qty`), allocation across multiple location rows, hard failure instead of silent skip; restore stock on note delete; enforce per-SKU (not order-total) over-dispatch caps; `@unique` on deliveryNumber/asnNumber with sequence-based generation; fix the order-delete guard to `['IN_TRANSIT','DELIVERED']`; add partial unique indexes on transfer_slips + existing-slip guards and make FG receipt an upsert-with-increment inside the slip transaction. Blast radius: finished-goods inventory truth, customer shipments, legal dispatch documents. Effort: **L**. **Structural** (mirror of the greige/fabric stock repair already done in Phase 1–2).

**R6. Wrap order editing in one transaction and stop destroying costing baselines.**
Fixes: orders-2, orders-8, orders-10, orders-3 (partially). What: single `$transaction` for item delete/recreate + WO sync + header totals; upsert items by styleId instead of delete-and-recreate (preserving `order_item_costing` snapshots and `selectedCadId`); same nested-write fix for quotation update. Blast radius: every order/quotation edit; cost-variance tracking integrity. Effort: **M**. Point-fix-plus (contained redesign of two handlers).

**R7. Enforce the order state machine on the wired path.**
Fixes: orders-3, orders-4. What: make the status controller delegate to `orderService.updateStatus` (the validator already exists, it's just bypassed); add status guards to delete/cancelOrder (no cancelling DISPATCHED orders — currently releases lace allocations for shipped goods); fix the CAD-clone guard to filter `clonedFromOrderId: thisOrder` and wrap the clone loop in a transaction. Blast radius: order lifecycle integrity; stops duplicate RAW_MATERIAL_CALCULATION CAD sets that double-count fabric requirements → over-procurement. Effort: **S–M**. Point fixes (the correct code already exists unused — a recurring theme, see also orders-5, costing-11).

**R8. Fix cutting's fabric-issue lifecycle.**
Fixes: production-4, production-5, production-6, production-7 (+ production-2 from R3). What: compute `fabricNeeded` from plannedQty × CAD average (never default to issuing the whole lot); wrap batch + challan create/issue in one transaction (challan.service already accepts a tx); on batch delete, reverse the batch's own issue challans instead of trusting zeroed columns; attribute challans to batches (add `cuttingBatchId`) so completion doesn't double-count WO-wide issuance. Blast radius: fabric stock accuracy for all production, consumption/wastage/variance analytics. Effort: **L**. **Structural** (issue-challan ownership model).

**R9. Convert "receive" handlers to accumulate-not-assign with over-receipt guards.**
Fixes: production-10, samples-embroidery-5, procurement-4 (overlap with R4), backlog production-11. What: one shared pattern — `quantityReceived: { increment } `, status recomputed from cumulative totals, reject cumulative > sent, sum (don't overwrite) actualCost. Apply to external-process receiveSendOut and embroidery receive (do it together with R3's schema fix for samples-embroidery-2, which makes the embroidery path UI-reachable — fix the service *before* unblocking the endpoint). Blast radius: all outside-processing ledgers and vendor liability figures. Effort: **M**. Pattern fix.

**R10. Correct MRP allocation & fulfillment math + cost-sheet actuals accumulation.**
Fixes: procurement-6, procurement-11, costing-3, costing-9, costing-8, costing-12. What: distribute GRN-accepted qty across requirement_po_links proportionally (not full amount to each); compute reservable = available − reserved and fail if unfillable, set allocatedFromStock to actual; derive cost-sheet actuals as SUM over approved GRN items (not last-GRN-wins) inside the approval tx; query greige-lace stock for greige-lace shortfall; **fix the one-line Decimal string comparison** (`Number(received) >= Number(ordered)`) that lexicographically decides "fully received"; include laceTotal in order-item costing subtotal and extract the shared subtotal→valueLoss→markup pipeline (also fixes the 4-way duplication noted in costing-12). Blast radius: procurement planning accuracy, budget variance truth, processing-PO workflow unblocking. Effort: **M**. Mostly point fixes; the shared costing pipeline is a small structural extraction.

---

## 3. Per-Bug-Class Summary

**F3 — Contract drift: 23 verified (3 CRITICAL) + ~20 backlog. THE most pervasive class.**
Worst offenders: style-costing (5 dead endpoints — costing-1/2/4/5/6), samples-embroidery (5 — s-e-1/2/3/4/6), financial (gst-2/3/4/5). Three sub-patterns: (a) dual-schema validation where route and controller schemas share zero vocabulary (costing-2/4, procurement-2, s-e-2); (b) hand-copied Zod enums drifting from Prisma enums (s-e-1/3, financial-gst-3, backlog orders-14, production-13); (c) `z.string().datetime()` vs date-picker `YYYY-MM-DD` (financial-gst-4, dispatch-6, backlog orders-11, s-e-16). **Systemic fix:** one schema per endpoint (R2), enums generated/asserted from Prisma, `z.coerce.date()` everywhere — all three are already guardrailed patterns; the baselines must now be ratcheted to zero for touched files.

**F1 — Stored-not-derived aggregates: 10 verified (1 CRITICAL) + ~7 backlog. The template class, alive and well downstream.**
Worst offenders: production-1 (completedQuantity effectively never updates → CMT costs computed on 0), procurement-4/7 (receiving double-credits; rejected qty permanently closes POs), dispatch-2 (deleted delivery notes leak FG stock forever), financial-gst-6 (credit notes never touch balances), costing-3 (actuals last-GRN-wins). **Systemic fix:** the same doctrine applied to materials — *derive from line items at read time, or recompute inside the same transaction as the line-item write; never `{ increment }` from a fire-and-forget path; when a counter must be stored, make every mutation delta-based and idempotent* (R4, R5, R9).

**F4 — Non-atomic multi-write: 8 verified (1 CRITICAL) + ~10 backlog.**
Worst offenders: dispatch-1 (FG deduction race + silent skip), procurement-3 (global-client `createStockIn` inside the receive tx — the exact "escapes rollback" template), orders-2/10 (delete-commits-then-create-fails leaves orders/quotations itemless), production-5/9 (swallowed challan failure; FG read-modify-write). **Systemic fix:** every handler with 2+ dependent writes gets one `$transaction`; every stock helper accepts an optional `tx` (pattern already exists in createStockOut); ban swallowed catches around must-not-lose writes (R4, R5, R6, R8).

**F5 — Compute-twice / guard-the-wrong-thing: 12 verified (1 CRITICAL) + ~18 backlog.**
Worst offenders: financial-gst-1 (guard filters the statutory report itself), orders-3/4 (state machine bypassed; clone guard checks the wrong row), procurement-6/11 (fulfillment marked without verifying stock), production-4/7 (wrong field read → whole lot issued; WO-wide issuance attributed to one batch), dispatch-3/10 (order-total instead of per-SKU cap; guard checks a status value that doesn't exist in the enum). **Systemic fix:** single-source-of-truth functions for each business figure (state transitions, "received" definition, costing subtotal pipeline per costing-12), and guards asserted against the actual Prisma enum values (R1, R7, R10).

**F2 — Missing uniqueness: 2 verified + ~8 backlog. Smallest verified count, but the backlog is where it lives.**
Worst offenders: production-8 (transfer slips → FG double-count), dispatch-5 (duplicate legal delivery-note numbers), backlog: count()-based numbering across work orders/challans/samples/CN-DN (production-17, procurement-15, s-e-10, financial-gst-11 — which also wedges permanently at #999), nullable-colorId unique constraints that don't constrain (orders-16, production-18), polymorphic po_source_links and 24-FK trim items (procurement-16, costing-19). **Systemic fix:** one migration wave adding `@unique`/partial unique indexes + a shared sequence-table number generator with retry-on-P2002, replacing every count/max+1 generator.

**F6 — Money math on floats: 2 verified + ~7 backlog. Least urgent verified, but costing-8 proves the tail risk.**
Worst offender: costing-8 — Prisma Decimals compared as *strings*, so "95 >= 100" is true and "100 >= 20" is false; workflow gates flip on string length. Others: unweighted "weighted" average (costing-11, currently dead code), unguarded divides (production-20), float GST (financial-gst-13, procurement-10). **Systemic fix:** route all money/qty math through `utils/currency.ts` + `gst.service.ts` (both exist, both under-used), and add a Decimal-comparison guardrail (§5).

---

## 4. Quick Wins vs Deep Redesigns

**Quick wins (each ≤1 day, immediately user-visible):**
- GSTR-1 status filter removal (financial-gst-1) — one query change, closes a compliance hole.
- Decimal string comparison (costing-8) — one line.
- Order-edit body `id` (orders-1), versionReason (costing-5), returnedQuantity rename (production-2), cuid param schemas (samples-embroidery-4), chart-of-accounts 409 (financial-gst-5), order-delete guard values (dispatch-10) — each one line-ish.
- `z.coerce.date()` sweep (financial-gst-4, dispatch-6, backlog orders-11, s-e-16) — mechanical, already the guardrail's prescribed fix.
- Enum mirroring for SampleType/SampleStatus/TDSStatus (s-e-1/3, financial-gst-3).
- Delegate status controller to `orderService.updateStatus` (orders-3) — the validator already exists.

**Deep redesigns (structural, sequence-sensitive):**
- **T3-A: Single-schema validation architecture** (R2) — touches ~15 endpoints, prerequisite for trusting any future Zod fix.
- **T3-B: Receiving pipeline atomicity + idempotency** (R4) — challan/GRN/stock-in; highest data-corruption stakes.
- **T3-C: FG-stock ledger rebuild** (R5) — dispatch + finishing transfer slips; the "stock_levels repair, part 2."
- **T3-D: Cutting challan-ownership model** (R8).
- **T3-E: Derived work-order/PO progress quantities** (production-1, procurement-7) — decide once whether completed/received are views over line items, then delete the counters from update schemas.
- **T3-F: Uniqueness + sequence-generator migration wave** (F2 batch).

Recommended sequencing: R1 + quick wins immediately → R2/R3 (revive dead endpoints; note R9's service fixes must land *with* R3 for embroidery, since fixing the schema makes the broken accumulate logic reachable — samples-embroidery-5) → R4/R5 (ledgers) → R6–R8 → R10 → F2 migration wave.

---

## 5. Next Guardrails for smart-check.js

Each verified class maps to a mechanical detector; add as baseline-ratchet checks like the existing six:

1. **No controller re-parse:** flag any `Schema.parse(req.body|req.query)` or `z.object(...)` defined inside `controllers/` when the route already has `validateBody`/`validateQuery`. Catches the root cause of costing-1/2/4/6/7, procurement-2, s-e-2, and backlog orders-15/procurement-12. *Highest-value new check.*
2. **Schema↔frontend payload parity:** extend the existing alignment check (or `/sync-types`) to diff Zod schema keys against the frontend request-type keys for the same endpoint (catches orders-1, production-2/3, financial-gst-2, s-e-6 — cases where controller reads matched but the frontend never sends).
3. **Global-client-in-transaction:** flag `prisma.` (or `this.prisma.` global) usage inside a `$transaction(async (tx)` callback, and service methods with 2+ awaited writes and no `$transaction` (procurement-3/5, dispatch-1, orders-2/10, production-9).
4. **Assign-where-increment-expected:** in functions matching `receive|complete|approve`, flag `quantityReceived:`/`paidAmount:`/`receivedQty:` written by plain assignment rather than `{ increment }` (production-10, s-e-5, procurement-4, costing-3).
5. **Decimal relational comparison:** flag `>=|<=|>|<` between fields typed Decimal in schema.prisma (or any `item.*Quantity` pair) without `Number()`/`.gte()` (costing-8).
6. **count()/findFirst-max+1 numbering:** flag `count(` or `findFirst({...orderBy` feeding a `*Number`/`*Code` template string (dispatch-5, financial-gst-11, production-17, procurement-15, s-e-10) — prescribe the sequence-table generator.
7. **Swallowed write errors:** flag `catch` blocks containing only `console.*`/comment around awaited `prisma.*.create|update|delete` (production-5, dispatch-4, orders-7, costing-3).
8. **Enum-drift check hardening:** the existing check clearly missed SampleTypeEnum/TDSStatusEnum (zero-overlap drift shipped) — extend name-matching so `SampleTypeEnum`↔`SampleType` is compared even when values share nothing, and fail on <100% overlap, not just extra values.
9. **Ratchet existing baselines:** the `z.string().datetime()` entries for dispatch.schema.ts are baselined but caused a shipped CRITICAL-adjacent bug (dispatch-6) — baselined ≠ safe; burn down the datetime and currency-format baselines as part of R3.

---

## Honest Coverage Gaps

Per the module notes: **all findings are static-analysis; no live-DB drift measurement was done** (actual magnitudes of FG-stock/receivedQuantity drift unknown). Not deeply audited: mrp.service calculateRequirements internals (~1,500 lines), fabric-costing.controller approve/promote flows, finishing.controller CRUD + summary sections (patterns expected to mirror stitching's findings), processor-rate services, CAD module, order-thread/label sub-modules, the state-machine util itself, processingStage/productionStatus services, export.service beyond flagged lines. **Structurally absent, not verified-safe:** no journal-entry/ledger posting exists at all (chart_of_accounts has no balances), exchange rates are stored but never consumed, e-invoice/e-way-bill columns have no logic — these are functionality gaps outside the 6 bug classes but material to a finance roadmap. Frontend response-shape drift (F3-c) was only spot-checked outside orders/dispatch. Expect the MEDIUM/LOW backlog (60 items) to yield further HIGHs on verification — production-14 (received qty never stored), procurement-20 (GRN approval overwrites first PO item), and dispatch-12 (PARTIAL PODs marked DELIVERED) look most likely to upgrade.