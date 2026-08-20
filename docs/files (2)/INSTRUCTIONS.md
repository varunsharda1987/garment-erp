# Instructions — handing this to Claude Code

**Repo:** `varunsharda1987/garment-erp` · **Scope:** job work consolidation + document generation
**Entity:** Kashaya Fabs only (single entity) · **Data:** development stage, destructive migrations acceptable

---

## Install

```bash
unzip kf-documents.zip -d .claude/skills/
```

Claude Code loads `SKILL.md` automatically when you mention documents, challans, job work, or invoices. The reference files load on demand.

---

## What's in here

| File | Read when |
|---|---|
| `SKILL.md` | Always — entry point, entity constants, design system, build rules |
| `references/migration-spec.md` | Doing the schema work. Six phases, in order. |
| `references/data-model.md` | Writing any query or template binding. Real model names, marked *exists* / *planned*. |
| `references/service-rules.md` | Writing endpoints or validation. Numbered invariants R1–R7, D1–D5, RT1–RT3. |
| `references/gst-job-work.md` | Any question about rates, SAC, or compliance |
| `references/statutory-reports.md` | Building ITC-04 or the ageing report |
| `references/document-fields.md` | Field list for a document not yet templated |
| `assets/base.css` | Every document. Import it — do not fork per document. |
| `assets/*.html` | Reference implementations. Six built. |

---

## Order of work

**Do not skip the precondition.** `ts-errors.txt` currently lists ~971 lines. Clear or triage first — you do not want to be guessing whether an error is pre-existing or something the migration just broke.

### Stage 1 — Schema (migration-spec.md, Phases 0–3)

Phase 0 company profile → Phase 1 `process_type_master` → Phase 2 generalise `job_work_orders` + components → Phase 3 challan line-level linkage.

Each phase gets its own migration and must end compiling. Run `npx prisma migrate dev && npx prisma generate && npm run build` between phases.

At the end of Stage 1, this must hold: **a job work order can carry two components of different item types, issued across three partial challans, and reconcile correctly.**

### Stage 2 — Delete the duplicates (Phase 4)

`external_process_send_outs`, `external_process_send_out_skus`, `embroidery_send_out` and their three enums are dropped, not migrated. No production data exists.

Keep `processing_batch` and rewire it to reference `jobWorkOrderId`. Replace `JobWorkStatus` — its current values are lab-dip specific and meaningless for stitching.

Collapse the four nullable FKs on `work_order_service_requirements` to one.

### Stage 3 — Service layer (service-rules.md)

Implement R1–R7, D1–D5, RT1–RT3 as guards, then the endpoints in §5. `/issue` and `/receive` must be single database transactions — challan creation, stock movement, and status change together or not at all.

Write the eleven test cases in §6 first if you work test-first; they encode the invariants more precisely than the prose does.

### Stage 4 — Documents

Six templates exist in `assets/`. Wire them to real queries:

| Template | Root model |
|---|---|
| `job-work-order.html` | `job_work_orders` |
| `challan.html` | `challans` — **render three times**, one per Rule 55 copy |
| `grn.html` | `goods_receiving_notes` |
| `purchase-order.html` | `purchase_orders` |
| `tax-invoice.html` | `invoices` |
| `packing-list.html` | despatch |

Single query per document with `include` all the way down. If a template needs a second fetch, the query is wrong.

`job-work-order.html` contains **two sheets**: a resolved-rate render and a blocked-rate render. Both are required — the second is what shows when `gstRate IS NULL`.

### Stage 5 — Statutory reports (statutory-reports.md)

Ageing first — it has a real deadline. Surface it on the dashboard, not as a report someone must remember to run. ITC-04 second, with all four guards, and the reconciliation assertion before filing.

### Stage 6 — Phases 5–6 of the migration spec

Section 143 fields and the tolerance/loss split. These can trail the first working end-to-end process type.

---

## Open items — not decided in code

**1. Dyeing and printing GST rate.** Unresolved. Notification 15/2021 removed both from the 5% textile job-work entry; the 12% slab they landed in was abolished on 22 Sep 2025. Whether they are now 5% or 18% has not been verified against consolidated notification text. Seed `gstRate = NULL` for both, which blocks their documents by design. Resolve with the CA, then one UPDATE.

Full reasoning in `gst-job-work.md` §3.

**2. ITC-04 filing frequency.** Turnover-slab dependent, amended more than once. Confirm before scheduling.

**3. Garment per-piece GST threshold.** The rate turns on the value of each individual piece, not the invoice. The threshold moved at the September 2025 rationalisation. Confirm before hardcoding — `tax-invoice.html` deliberately shows two different rates on one invoice to make the point.

---

## Out of scope

**Frontend.** 435 `.tsx` files in the repo; nothing here specifies them. The templates are print documents, not UI. Screens for creating and reconciling job work orders are a separate piece of work.

**Migrating `fabric_processing`.** Audit whether it is fully subsumed by the consolidated model. If it holds greige→fabric identity transformation logic not present elsewhere, keep it and point it at `job_work_orders`. That call needs someone who knows what it currently does in practice.

---

## Things that will be tempting and are wrong

- **Building a sixth implementation.** The problem was never a missing model. It was five of them.
- **Storing `isInterstate`.** It is derived. The stored column exists and is untrusted.
- **Putting GST in `fgValue`.** Input credit, not inventory cost. There is a test for this — case 7.
- **Absorbing abnormal loss into FG rate.** Hides vendor performance permanently.
- **Header-level challan↔order linkage.** One truck can carry three orders' material.
- **Applying Rule 55 validation to internal movements.** Same table, different obligations.
- **Filtering unregistered job workers out of ITC-04.** No GSTIN does not mean no reporting obligation.
- **Adding a tax column to `challans`.** The absence is the safeguard.
