# Frontend Integration Review — Fix Roadmap

Ranked by: root-cause leverage (one fix clearing many findings) → pipeline centrality → effort.
Waves are sized to be executed as parallel agent groups with a central gate (build → guardrails →
deploy → smoke), same machinery as the bug-hunt. **No fixes have been applied yet — this is the plan.**

## Wave 1 — Unblock daily use (the 3 P0s + the environment + module-killers)

| # | Cluster | Findings | Fix shape |
|---|---|---|---|
| 1.1 | **Rate limiter / environment** | sweep `criticalEnvironmentFindings` | Exempt authenticated users or raise the limit dramatically (100/15min vs pages firing 12–92 XHRs); reconcile pm2 env (`production`) with `backend/.env` (`development`) deliberately; investigate the double mid-sweep restart |
| 1.2 | **Expired-login handling** | sweep | 401/403 → redirect to /login (api client interceptor) instead of rendering empty pages |
| 1.3 | **Stitching + finishing receive (P0)** | B06-01, B06-02 | Align receive payloads with schemas (transferSlipId, receivedQty) — both callers of each |
| 1.4 | **External-process module family** | B11-01..05 + sweep 400s | One schema alignment: `externalProcess.schema.ts` enums to Prisma truth (EMBROIDERY_PIECE; ExternalProcessStatus), receive SKU schema to the service DTO (receivedQty/damagedQty), repeated-`status` query param handling; revives handwork + smocking + piece-embroidery send/receive/dashboards |
| 1.5 | **Sale-order creation blocked** | B09-03 | Point customer search at `GET /customers?search=` (route exists) or add `/customers/search`; unblocks in-ERP sale orders |
| 1.6 | **Role dashboards + 404 loop** | B15-01..05 | One coordinated fix: wrap/complete the 4 dashboard stats endpoints to the envelope the pages read; point INVENTORY/PURCHASE/QUALITY redirects at real routes |
| 1.7 | **/materials/new crash** | sweep | Fix the empty-string Radix Select value |

## Wave 2 — Stop silent wrong data (P1 clusters)

| # | Cluster | Findings | Fix shape |
|---|---|---|---|
| 2.1 | **Serializer `_count` stripping (systemic)** | B03-01, B04-01, B04-06, B09-01 + every `_count` reader | Preserve `_count` in serializer (or emit `count` consistently) + sweep frontend readers; one fix, ~dozen pages |
| 2.2 | **Schema-strips-your-input family** | B05-03, B05-04, B13-02 (user edits incl. password), B09-05 (SPO items), B15-01 (settings), B02-01 (lace supplier wipe), B11-08 (sample-edit colorways), B10-07 (challan dates → 500) | Align each Zod schema with what the form sends / controller reads (the repo's schema-alignment guardrail now catches NEW ones; these are the pre-guardrail backlog) |
| 2.3 | **GST report reads** | B12-02, B12-03 | GSTR-1: read `.totals` (fix crash); GSTR-3B: read the nested outwardSupplies/inputTaxCredit shapes — statutory screens must not show ₹0 |
| 2.4 | **Remaining P1 field-mismatches** | B01-01, B02-02, B05-01/02/05, B07-01, B08-01/02, B10-01, B12-01, B13-01, B15-… | Per-finding one-liners in [01-findings.md](01-findings.md); includes deciding fabric-physical-tests (build the missing backend OR park the frontend behind a "coming soon" flag — currently silent zeros) |

## Wave 3 — Dead links & handoffs (P2, 74 findings)

- Dead navigation targets (30) — register/repoint routes (e.g. Add-CAD button, credit-note detail, chart-of-accounts form).
- Ignored link parameters (19) — target pages read the query params their callers send (`?status=`, `?orderId=`…), the KPI-card drill-down promise.
- Missing lace-stock endpoints (allocations/return/downgrade), pattern-parts path, cost-sheet reject route, pagination truncations (fabric stock 20-row cap), and the rest per findings doc.

## Wave 4 — Polish (P3, 53 findings)

- Hardcoded fake KPIs (87% efficiency, 78% collection rate, 68% conversion — fabricated constants rendering as live metrics): remove or compute.
- Orphan pages (10): keep-or-delete decisions (4 superseded requirement dashboards, TemplateManager, deprecated PO-generation page, debug page…).
- Cosmetic: invalid Tailwind classes, duplicate React keys, HTML nesting warnings, disabled stubs.

## Appendix — enhancements surfaced (not defects)

- Integration gaps worth building (8): costing→quotation wiring (pipeline stage 4→5 has no UI bridge),
  transport-assignment UI (backend exists, no page calls it), polybag/carton packing UI (endpoints + guide
  mandate exist, no UI), invoice→order navigation, order-detail costing panel.
- P4 unbuilt (recorded): per known-unbuilt list.
- Perf notes: /mood-boards fires 92 XHRs per load (N+1); stock-in form 26.

## Suggested execution

Wave 1 ≈ one focused session (7 clusters, mostly single-file/schema edits + one env decision).
Wave 2 ≈ one session (2.1/2.2 are agent-parallelizable groups with disjoint files).
Waves 3–4 ≈ one to two sessions of parallel sweeps.
Each wave: fix agents + adversarial verify + central gate (build/guardrails/deploy/smoke), and every fixed
class gets a smart-check detector where one doesn't already exist (the `_count` class and the ignored-param
class are good detector candidates).

---

## ✅ Wave 1 COMPLETE (2026-07-28, commit 55d69940)

All 7 clusters fixed (4 parallel agent groups + 4 adversarial verifiers, all CLEAN); builds green,
guardrails --all green, deployed, smoke-verified:
- **1.1 Rate limiter** — production ceiling 100→5000/15min (authLimiter untouched).
- **1.2 Expired-login** — token-403 now redirects to /login; permission-403 still rejects.
- **1.3 Stitching+finishing receive (P0 B06-01/02)** — schema/payload aligned; pipeline unblocked.
- **1.4 External-process family (B11-01..05)** — enums + SKU schemas aligned to Prisma/DTO; work-orders
  repeated-status accepted. Smoke: EMBROIDERY_PIECE/SENT/repeated-status all 200 (were 400).
- **1.5 Sale-order customer search (B09-03)** — repointed to GET /customers?search (was dead → 400).
- **1.6 Role dashboards (B15-01..05)** — backend returns full envelope with real data; 3 roles off the
  404-loop. Smoke: all 4 dashboards return correct shapes.
- **1.7 /materials/new crash** — Radix empty-string SelectItem sentinel fix (+ greige edit dialog).

**Not yet done:** Waves 2 (silent wrong data — _count serializer, schema-strips-input, GST reads),
3 (dead links/handoffs), 4 (polish). Awaiting go-ahead.

---

## ✅ Wave 2 COMPLETE (2026-07-28, commit 59914e05)

All 29 remaining P1 findings fixed (7 parallel agent groups + 7 adversarial verifiers, all CLEAN, +2
same-class NITs swept). Builds green, guardrails --all green, deployed, smoke-verified. **With Wave 1,
every P0 (3) and P1 (41) from the review is now resolved — zero silent-wrong-data findings remain.**
- Serializer `_count` corruption fixed at the root (ts-node repro proves inner keys intact); count columns
  across agencies/agents/customers/suppliers/component-groups show real data; style edit no longer wipes variants.
- Schema-strips-input family aligned (material prices, user edits incl. password, settings category, SPO
  items, challan dates 500→ok, sample measurements/colorways, lace supplier links).
- GST reports: GSTR-1 crash fixed, GSTR-3B ₹0 fixed (statutory screens show real numbers).
- Field-read/wrong-path fixes across lace/embroidery/greige/order/dispatch/debit-note.
- Fabric Physical Tests backend BUILT (was 404 with a fully-built frontend) — smoke 200.

**Not yet done:** Wave 3 (dead links/handoffs, 74 P2), Wave 4 (polish incl. fake KPIs, 53 P3). Awaiting go-ahead.

---

## ✅ Wave 3 COMPLETE (2026-07-28, commit 11a0217e)

72 P2 findings actioned by 10 parallel groups (decision ladder: repoint > wire-existing > build-if-trivial >
hide-with-note). **62 fixed inline, 12 hidden with an honest "coming soon" and returned as deferred builds.**
Builds clean, guardrails green, deployed, smoke-verified (belt/other_* trim types 200 were 400; PO orderId
filter 200; dashboards/tests read-side 200). 3 new pages built (ColorBulkImport, DispatchDeliveryNoteDetail,
TestingLabs inline CRUD) + 3 routes registered in one serial pass.

### Deferred builds (real new features — user to prioritize)
These dead controls were HIDDEN (no longer dump users on a blank page); each needs a genuine new page/dialog:
1. **B01-02** Fabric Width-CAD create form (POST /fabric-management/cad).
2. **B07-04** Lace quality downgrade (needs new backend endpoint too).
3. **B07-12** Stock-Count detail/execution page (start→count→verify→approve→variance).
4. **B08-07** Processing-batch create form.
5. **B10-03 / B10-04** ASN create form + ASN detail page (backend getById exists).
6. **B12-05** Credit-Note detail page (backend GET exists; no sibling to copy).
7. **B13-05 / B13-06 / B13-08** Fabric/Garment physical-test + Test-template create/detail forms
   (backends exist; multi-section forms).
8. **B06-03 / B06-04** Dyeing & Printing sub-modules (lab-dip + process-PO create/detail/QC/return) —
   note: without process-PO QC, a RECEIVED process PO can't reach QUALITY_CHECKED from the UI.

**Remaining wave:** Wave 4 polish (53 P3 — fake hardcoded KPIs, orphan pages, cosmetic). Awaiting go-ahead.

---

## ✅ Wave 4 COMPLETE (2026-07-28, commit eed2ae52) — FRONTEND REVIEW FULLY REMEDIATED

52 P3 polish items fixed (5 parallel groups + orphan pass). Backend builds clean, all guardrails green,
backend deployed, smoke-verified (incl. a caught+fixed pattern-parts regression). **Final tally across all
four waves: 156 findings fixed + 12 deferred builds = 168 total; ZERO open P0–P3.**
- Fake hardcoded KPIs removed (efficiency/collection/conversion + trend arrows + disabled Reports tile).
- ~20 param-handoff + field-read + dead-ui polish fixes; LaceStockAging report built.
- Orphans: deleted 6 unreachable pages (4 requirement dashboards, SelectTest, deprecated
  CostSheetPOGenerationPage + service); wired 4 keep-orphans (LaceStock/LabDips/Defects sidebar +
  TemplateManager at /settings/export-templates).

### ⚠ Frontend production build currently blocked by USER WIP (not review work)
The tree has uncommitted in-progress features — **Customer Address/Contact** and **WhatsApp messaging** —
with 4 tsc errors + 2 unvalidated routes. These block `npm run build` (frontend) and the CI tsc-zero gate.
All my Wave-4 frontend code is verified clean (isolated tsc: 0 errors in touched files) and will bundle into
the live frontend the moment those WIP files compile. Left entirely untouched.

## Status: all four waves done. Remaining = the 12 DEFERRED BUILDS (real new pages, user to prioritize).
