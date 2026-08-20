---
name: kf-documents
description: Generate every printable business document for Kashaya Fabs — job work orders, delivery challans (Rule 55), purchase orders, GRN, tax invoices, packing lists, and job cards. Use this skill whenever the user asks to create, redesign, or wire up any document that leaves the factory or goes to a vendor/buyer, and whenever building document rendering into the garment ERP. Trigger it even for casual asks like "make a challan", "print the job card", "design the invoice", or "what fields go on a GRN". Covers the shared visual system, the exact field list per document type, the Prisma data model each document reads from, and Indian GST/SAC classification for textile job work. Do NOT use for Kasya or NIHSAMAH marketing graphics — those have their own skills.
---

# Kashaya Fabs — Document System

Every document this firm issues shares one visual language and one data model. This skill defines both, so a challan printed in the cutting room and an invoice emailed to a buyer look like they came from the same company and read from the same tables.

## Entity constants — never hardcode variants of these

```
KASHAYA FABS                      (proprietorship — NOT "Pvt Ltd", NOT "House of Kasya")
H1-51, Riico Industrial Area, Mansarovar, Jaipur – 302020
GSTIN  08DCDPS0146D1ZU
State  Rajasthan (08)
```

House of Kasya Pvt Ltd (GSTIN 08AAGCH8378B1ZE) is a **separate legal entity**. If a document is being raised by House of Kasya, swap the whole block — never mix the two on one sheet. Inter-company movement between them is a genuine sale (cost + 10%), not a stock transfer, and needs a tax invoice.

## Document types

| Document | Raised when | Legal basis | Money moves? |
|---|---|---|---|
| Job Work Order | Sending material out for a process | Commercial (PO variant) | Committed, not booked |
| Delivery Challan | Material physically leaves | Rule 55, CGST Rules | No |
| Job Card | Shop-floor traveller with the goods | Internal | No |
| Purchase Order | Buying goods | Commercial | Committed |
| GRN | Goods received back / in | Internal | Booked |
| Tax Invoice | Selling goods | Sec 31, CGST Act | Booked |
| Packing List | Despatch to buyer | Commercial / export | No |

**The one rule people get wrong:** a Job Work Order *is* the PO. Do not raise a separate purchase order alongside it. The challan is the movement document; the order is the commercial document. Two documents, one transaction.

Read `references/document-fields.md` for the exact field list of whichever document you're building.

Reference implementations live in `assets/`: `job-work-order.html` (resolved + blocked-rate states), `challan.html`, `grn.html`, `purchase-order.html`, `tax-invoice.html`, `packing-list.html`. Start from these rather than from scratch.

## Data model

Documents render from the garment ERP (PostgreSQL + Prisma). Read `references/data-model.md` before writing any query or template binding. It gives the models, the fields each document pulls, and the computed values that must **not** be stored (they're derived at render time).

Two things that are load-bearing:

1. **Material issued carries value but no tax.** The value on a job work challan is for e-way bill and insurance only. It is not revenue, not expense, not a taxable supply. Never let a tax column appear against issued material.
2. **Only job charges carry GST.** And that GST is input credit, never product cost. FG valuation = material cost + job charges + freight, all tax-exclusive.

## GST classification

Read `references/gst-job-work.md` before putting any rate on any document, and `references/service-rules.md` for the validation invariants that govern when a document may be generated at all. It covers dyeing, printing, embroidery, stitching, smocking, and cutting, plus the registered/unregistered branches and the one live ambiguity that must be resolved with a CA rather than guessed.

Do not hardcode a GST rate into a template. Rates come from the `ProcessType` table so a rate change is one UPDATE, not a redeploy.

## Visual system

Read `assets/base.css` and import it. Every document uses it. The system:

**Paper.** A4 portrait, 13mm side margins, 14mm top. `#fbfaf7` stock, `#1a1a17` ink. Print styles strip the background and shadow.

**Type.** IBM Plex Sans for content, IBM Plex Mono for anything a human reads as data — document numbers, field labels, quantities, GSTINs, footers. Tabular numerals on every numeric column, no exceptions; misaligned digits are how quantity errors get missed on a shop floor.

**Hierarchy.** Section headers are 8.5px mono, uppercase, 1.8px tracking, on a hard 1px rule. Numbered `01 —`, `02 —` because these documents *are* a sequence: who, what went out, what's expected back, what actually came back. The numbering encodes the workflow, so keep it.

**The signature device.** Fields that get filled by hand after printing carry a diagonal hatch (`.open`). This is the one memorable element — a glance tells you whether a document is a commitment or a record. Never hatch a field the system populates; never leave a hand-filled field flat.

**Restraint.** One accent colour (`--stamp`, `#8a3a2a`) and it is used for exactly two things: the "not a sale" pill and the costing callout border. Nothing else gets colour. If a third use appears, remove it.

## Reports use the same system

Reports are not a separate visual language. They import `assets/reports.css`, which imports `base.css` — same paper, same ink, same type pairing, same rules and tracking. A report and a challan sitting side by side must read as one company.

What reports add, and nothing more:

- **Screen shell** (`.report`) — fills the viewport instead of A4-fixed, but still prints. An ITC-04 extract gets filed; an ageing report gets emailed as PDF. Both, always.
- **KPI strip** — four at most. A fifth means the report is answering two questions and should be two reports.
- **Filter bar** — hidden on print.
- **Severity ramp** — the single permitted extension to the palette. Documents get one accent used twice; reports genuinely need an ordered scale. It is a warm monochromatic ramp within the same earth family (`--sev-ok` → `--sev-warning` ochre → `--sev-critical` terracotta → `--sev-breached` deepest), so it reads as **intensity**, not as traffic lights. **Never introduce green, blue, or a saturated red.** OK state gets no colour at all — absence means fine.
- **Inline bars** — plain CSS, no chart library. Reports must print and must not need a build step.

Row emphasis stays subtle: the chip carries the signal, the row only reinforces it with a 3px inset edge. Never fill a whole row with colour.

Reference implementations: `report-job-work-ageing.html`, `report-itc-04.html`, `report-vendor-performance.html`.

**Density.** These are working documents, not brochures. 9–10.5px body, 3.5px row padding. A job work order with six components must fit one page or the reconciliation gets separated from the issue list.

## Build rules

- One HTML file per document or report. No build step, no framework — these get printed from a browser on a factory PC.
- Documents import `base.css`; reports import `reports.css` (which imports `base.css`). Never fork the stylesheet per file.
- Every document renders from a single object. If the template needs a second fetch, the query is wrong.
- Amounts: `Intl.NumberFormat('en-IN')`. Indian grouping (1,07,540) not international (107,540).
- Dates: `DD MMM YYYY`. Never numeric-only — 07/08/2026 is ambiguous to a buyer in the EU.
- Quantities to 2 decimals for metres and kilos, 0 for pieces.
- Every document footer carries: document number, page x of y, and distribution list.
- Responsive down to 380px and printable. Both, always.

## Related references

- `INSTRUCTIONS.md` — order of work, open items, and the traps worth naming
- `references/migration-spec.md` — six-phase schema consolidation
- `references/service-rules.md` — R1–R7 blocking, D1–D5 derivation, RT1–RT3 routing
- `references/statutory-reports.md` — ITC-04 extract and Section 143 ageing

## Before finishing any document

Check these four, in order:

1. Correct legal entity block, with matching GSTIN
2. No tax column anywhere near issued material
3. Every hand-filled field hatched, every system field not
4. Rate pulled from `process_type_master`, not typed into the HTML
5. Stylesheet imported, not inlined — and no colour outside the tokens in `base.css` / `reports.css`
