# Complete Findings Index — all 326 findings

> Generated from `findings.jsonl`. **[START_HERE.md](START_HERE.md)** has the priority-ordered fix plan.
>
> **24 are CLEAN BILLS** — things verified *correct*. They tell you where **not** to spend time.
>
> ⚠️ **Several findings were CORRECTED DOWNWARD after I attacked my own work** (BH-0267, BH-0268, BH-0300). Where a severity looks surprising, read the `skeptic_verdict` — it says what I got wrong.


## 🚦 S1 TRIAGE — what each S1 actually does to you TODAY

**"82 S1s" is misleading.** Re-classified against live row counts:

### 🔴 CORRUPTING DATA RIGHT NOW (4) — the only real emergency

- **BH-0294** — PROOF: the stock bugs have ALREADY corrupted your live data — your Stock Levels page is wrong by 92,650 metres across 7 materials, including TWO NEGATIVE stock levels
- **BH-0296** — ROOT CAUSE FOUND: a 'virtual fabric master' is minted for every raw greige, giving ONE physical lot TWO materials rows — receipts credit one, consumption deducts the other, and the stock goes negative
- **BH-0304** — ROOT CAUSE of the wrong-unit corruption: syncStockLevelQuantity defaults the unit to 'PIECE' — so any caller that forgets to pass one records fabric in pieces
- **BH-0305** — The OTHER direction: processor consumption never syncs at all — which is why GRG-0034 OVERSTATES stock by 17,080 m

### 🟠 ARMED (39) — real data at stake, but it has NOT fired. Fix the code; **no data cleanup needed.**

- **BH-0010** — consumeGreigeStock escapes the challan-issue transaction — rollback double-deducts greige on retry
- **BH-0011** — Processor returns vanish: receiveFromProcessor drops the destination warehouse and never creates/syncs destina
- **BH-0015** — consumeGreigeStock lost-update race on quantityReserved/quantityAvailable — reachable from challan issue, prin
- **BH-0023** — transferStock TOCTOU — LIVE UI path (LaceStockDetail transfer action) can oversell the same lace lot
- **BH-0029** — Thread deduction on challan issue: blind absolute write inside READ COMMITTED tx — lost update under concurren
- **BH-0030** — Challan-issue stock_levels sync unscoped to warehouse — deterministically corrupts every warehouse's rows for 
- **BH-0048** — GRN identity assumption (materials.id === master.id) broken for 8 material types — stock_levels permanently mi
- **BH-0049** — Challan INWARD receive credit (fabric :642, lace :675) unscoped to warehouse — over-credits every warehouse or
- **BH-0050** — Embroidery sendOut/receive/cancel sync stock_levels with warehouseId=undefined despite knowing the warehouse —
- **BH-0070** — Amount-in-words on every invoice/proforma disagrees with the printed numeral — amountToWords() rounds paise aw
- **BH-0071** — Proforma invoice prints a GST rate label that contradicts its own tax amount (stale flat taxRate vs blended pe
- **BH-0100** — ANY style edit orphans the approved CAD data while the style still claims 'CAD Approved' — costing silently dr
- **BH-0122** — A job at exactly 500m (or 1000m, or 5000m) matches TWO rate slabs and the winner is non-deterministic — the sa
- **BH-0123** — Duplicate ACTIVE rate rows can coexist permanently — and every later rate lookup resolves to an arbitrary one 
- **BH-0130** — Stock-OUT and TRANSFER never touch the specialized stock tables — a warehouse transfer moves stock in one laye
- **BH-0139** — Merely clicking 'Continue' between wizard tabs orphans a style's approved CAD data — no fabric edit required
- **BH-0143** — Clearing a customer accessory preset never sticks — the deleted accessories RESURRECT on the next edit and are
- **BH-0145** — Shrinkage cost uses the WRONG formula — every approved fabric cost is understated, and the same page uses the 
- **BH-0146** — An APPROVED printed-fabric cost can be silently overwritten with a hardcoded default screen rate — just by ope
- **BH-0175** — ROOT CAUSE: you HAVE a tool built to catch this exact bug class — it can't see the codebase's most common patt
- **BH-0191** — CROSS-CUTTING: every `z.string().datetime()` paired with an <input type="date"> is a guaranteed 400 — this one
- **BH-0207** — SILENT DATA LOSS: saving any existing fabric DELETES all of its supplier links
- **BH-0208** — GSTR-1 silently DROPS every overdue invoice from the GST return — and GSTR-3B includes them, so the two filing
- **BH-0214** — LIVE LANDMINE: cancelling an issued challan NEVER returns the stock — the goods are back in the warehouse but 
- **BH-0251** — Your real JWT signing key and database password are committed to git — and rotating them in place will NOT rem
- **BH-0252** — The JWT secret falls back to a hardcoded string — if the env var is ever missing, anyone can forge an ADMIN to
- **BH-0257** — ALL FOUR dashboards are structurally broken — every KPI reads zero, including money the backend correctly calc
- **BH-0259** — 'Monthly Revenue' can never see a late payment — it filters on when the INVOICE was created, not when the mone
- **BH-0260** — GSTR-3B claims Input Tax Credit from PURCHASE ORDERS, not from goods actually received — you can claim ITC on 
- **BH-0261** — Bulk style import merges two different customers' styles into one if they happen to reuse a style code
- **BH-0262** — The CSV importer splits on every comma — one comma inside a style name silently shifts every column after it
- **BH-0275** — A FIFTH DATA WIPE: saving any style DELETES its process costs — 21 real rows with real money are sitting there
- **BH-0276** — Deleting a fabric stock lot leaves its quantity in stock_levels forever — the Stock Levels page permanently ov
- **BH-0280** — SYSTEMIC AMPLIFIER: your API client silently RETRIES POSTs up to 3 times on any server error — so one click ca
- **BH-0283** — NEW CLASS — deleting a greige master silently orphans its stock and erases its procurement links (the fabric d
- **BH-0286** — SYSTEMIC: all SIX trim-master deletes guard the EMPTY table and ignore the FULL one — 244 live BOM lines can b
- **BH-0287** — 'Permanently delete' a style performs ZERO dependency checks — it orphans 111 live CAD records and 10 fabric s
- **BH-0291** — When fabric arrives at a different width than planned, the CAD updates the width but KEEPS the old marker leng
- **BH-0292** — The 'Link CAD to Stock' path has the identical defect — it swaps in the real width and leaves the consumption 

### ⚪ BROKEN FEATURE (37) — these 400 or silently no-op. **They corrupt nothing.**

Orders, invoices, cost sheets, quotations, dispatch, embroidery, thread, cutting/stitching/finishing. The tables are empty *because* of these bugs. Real, worth fixing, **not urgent**.

- **BH-0041** — approveStockCount's transaction is illusory — per-item adjustments commit independently; failure mid-loop leav
- **BH-0078** — MRP systematically UNDER-BUYS greige: the GREIGE_PROCESSED requirement uses the finished-fabric quantity with 
- **BH-0079** — Re-running MRP after a PO exists RE-ORDERS the same material — the cancel-all pre-pass ignores requirement_po_
- **BH-0080** — Stock allocated to one order still counts as available to every other order — allocateStock increments quantit
- **BH-0084** — A PO can be raised on the WRONG supplier at another supplier's negotiated price — no supplier check, and the c
- **BH-0085** — Bulk PO preview merges the same material across different orders but keeps only ONE rate — the merged quantity
- **BH-0093** — Trims/accessories marked 'Not Applicable' on the cost sheet are still exploded into the BOM and PURCHASED
- **BH-0094** — The 'Calculate MRP' button is the sanctioned, always-available trigger for the duplicate-PO bug — no guard aga
- **BH-0107** — Double-clicking Approve on a GRN creates the stock TWICE — no atomic status guard
- **BH-0114** — Cost-sheet PO generation is 100% BROKEN — the Zod schema strips every field the code uses, so every Fabric/Gre
- **BH-0126** — Service cost = piece count × per-METRE rate — no unit conversion, and the wrong number becomes the real PO amo
- **BH-0127** — 8 of 10 service types can NEVER be priced or ordered — no rate card can exist for them, and nothing can set a 
- **BH-0128** — Two concurrent generate-PO calls create TWO real purchase orders for the SAME service requirement — one is sil
- **BH-0149** — COST SHEETS ARE BROKEN: creates always fail, and EDITS SILENTLY SAVE NOTHING while reporting success
- **BH-0150** — Smocking cost is counted once, then permanently lost — it's summed into the CMT total but never written to its
- **BH-0157** — A job-work PO can be issued in one processor's NAME while priced at another processor's RATE — the Processing/
- **BH-0158** — 'Re-calculate MRP' feeds orders whose material is ALREADY on a live PO straight into the unguarded backend rec
- **BH-0165** — ORDER CREATION AND EDITING BOTH 400 — the schema demands fields the form never sends (VERIFY AGAINST REALITY, 
- **BH-0169** — ALL FOUR thread-requirement endpoints are broken — create 400s, EDIT SILENTLY SAVES NOTHING, generate-PO 400s,
- **BH-0170** — Bulk PO generation SILENTLY DISCARDS the prices and quantities the user typed — the PO is created at a differe
- **BH-0171** — 'Calculate Services' 400s on EVERY click, and every service-PO generation 400s on the date format
- **BH-0176** — 'Receive from Stitching' 400s on EVERY click — the finishing stage of the production pipeline is entirely bloc
- **BH-0177** — Cutting 'Complete Batch' 400s whenever fabric is actually returned — so leftover fabric can never be booked ba
- **BH-0180** — Embroidery send-out AND receive are BOTH completely broken — every request 400s
- **BH-0182** — Thread quantity conversion (boxes ↔ cones ↔ metres) always 400s — which is why thread requirements can't be en
- **BH-0183** — Logging a lace defect always 400s — the schema's defect types and date field don't match the app at all
- **BH-0186** — Sale order creation is 100% broken — the dialog always sends an empty items array that the schema forbids
- **BH-0187** — Invoice creation always 400s — and even if fixed, line items would be silently discarded and no invoice_items 
- **BH-0188** — Quotation creation always 400s — the date picker's format is rejected
- **BH-0189** — 'Record Proof of Delivery' 400s on every use
- **BH-0193** — 'Recalculate costing' silently never happens — the UI says it did
- **BH-0222** — DORMANT LANDMINE: sending fabric for RE-processing never deducts it from stock — the same lot can be sold twic
- **BH-0236** — DORMANT: deleting a pending delivery note destroys the finished goods — stock is deducted at creation and neve
- **BH-0237** — DORMANT: embroidery receipt has no upper bound and partial receipts OVERWRITE each other instead of adding up
- **BH-0242** — The FIRST cutting batch anyone creates will deduct the ENTIRE fabric lot, not the amount needed
- **BH-0243** — Fabric issued to a cutting batch can NEVER be released — the restore code is dead, and 'Cancel' doesn't cancel
- **BH-0244** — Clicking 'Generate Transfer Slip' twice in Finishing DOUBLES your finished-goods stock — and the button stays 

---

## S1 — Data / money corruption / security  (82)

| ID | Status | File | Finding |
|---|---|---|---|
| **BH-0010** | CONFIRMED | `backend/src/services/greige-stock.service.ts:441` | consumeGreigeStock escapes the challan-issue transaction — rollback double-deducts greige on retry |
| **BH-0011** | CONFIRMED | `backend/src/services/greige-stock.service.ts:903` | Processor returns vanish: receiveFromProcessor drops the destination warehouse and never creates/syncs destination stock |
| **BH-0015** | CONFIRMED | `backend/src/services/greige-stock.service.ts:470` | consumeGreigeStock lost-update race on quantityReserved/quantityAvailable — reachable from challan issue, printing, dyeing |
| **BH-0023** | LIVE | `backend/src/services/laceStock.service.ts:538` | transferStock TOCTOU — LIVE UI path (LaceStockDetail transfer action) can oversell the same lace lot |
| **BH-0029** | CONFIRMED | `backend/src/services/challan.service.ts:348` | Thread deduction on challan issue: blind absolute write inside READ COMMITTED tx — lost update under concurrency |
| **BH-0030** | CONFIRMED | `backend/src/services/challan.service.ts:392` | Challan-issue stock_levels sync unscoped to warehouse — deterministically corrupts every warehouse's rows for the material (systemic: thread :392, fabric :301, lace :339) |
| **BH-0041** | CONFIRMED | `backend/src/services/stockCount.service.ts:335` | approveStockCount's transaction is illusory — per-item adjustments commit independently; failure mid-loop leaves half-applied count and retry DOUBLE-APPLIES |
| **BH-0048** | CONFIRMED | `backend/src/services/grn.service.ts:1263` | GRN identity assumption (materials.id === master.id) broken for 8 material types — stock_levels permanently misses GRN receipts (generalizes BH-0033) |
| **BH-0049** | CONFIRMED | `backend/src/services/challan.service.ts:642` | Challan INWARD receive credit (fabric :642, lace :675) unscoped to warehouse — over-credits every warehouse or no-ops on first receipt |
| **BH-0050** | LIVE | `backend/src/services/embroidery-stock.service.ts:143` | Embroidery sendOut/receive/cancel sync stock_levels with warehouseId=undefined despite knowing the warehouse — cross-warehouse corruption on every embroidery movement |
| **BH-0070** | CONFIRMED | `backend/src/config/company.config.ts:121` | Amount-in-words on every invoice/proforma disagrees with the printed numeral — amountToWords() rounds paise away, and there is no Round-Off line |
| **BH-0071** | LIVE | `backend/src/services/document-generator.service.ts:1231` | Proforma invoice prints a GST rate label that contradicts its own tax amount (stale flat taxRate vs blended per-item slabs) |
| **BH-0078** | CONFIRMED | `backend/src/services/mrp.service.ts:1197` | MRP systematically UNDER-BUYS greige: the GREIGE_PROCESSED requirement uses the finished-fabric quantity with no shrinkage inflation |
| **BH-0079** | LIVE | `backend/src/services/mrp.service.ts:704` | Re-running MRP after a PO exists RE-ORDERS the same material — the cancel-all pre-pass ignores requirement_po_links and PO generation selects by status alone |
| **BH-0080** | LIVE | `backend/src/services/mrp.service.ts:1850` | Stock allocated to one order still counts as available to every other order — allocateStock increments quantityReserved but never decrements quantityAvailable, and MRP never subtracts reserved |
| **BH-0084** | CONFIRMED | `backend/src/services/mrp.service.ts:1933` | A PO can be raised on the WRONG supplier at another supplier's negotiated price — no supplier check, and the cost-sheet rate lookup ignores supplier entirely |
| **BH-0085** | CONFIRMED | `backend/src/services/mrp.service.ts:3142` | Bulk PO preview merges the same material across different orders but keeps only ONE rate — the merged quantity is priced at whichever rate resolved last, and the UI submits it |
| **BH-0093** | CONFIRMED | `backend/src/services/order-bom.service.ts:384` | Trims/accessories marked 'Not Applicable' on the cost sheet are still exploded into the BOM and PURCHASED |
| **BH-0094** | LIVE | `backend/src/controllers/order-bom.controller.ts:498` | The 'Calculate MRP' button is the sanctioned, always-available trigger for the duplicate-PO bug — no guard against re-running MRP after POs exist |
| **BH-0100** | LIVE | `backend/src/services/style.service.ts:899` | ANY style edit orphans the approved CAD data while the style still claims 'CAD Approved' — costing silently drops that fabric, and the production dashboard hides the blocker |
| **BH-0107** | CONFIRMED | `backend/src/services/grn.service.ts:565` | Double-clicking Approve on a GRN creates the stock TWICE — no atomic status guard |
| **BH-0114** | CONFIRMED | `backend/src/schemas/costSheetPOGeneration.schema.ts:17` | Cost-sheet PO generation is 100% BROKEN — the Zod schema strips every field the code uses, so every Fabric/Greige/Trims/Processing PO attempt fails |
| **BH-0122** | CONFIRMED | `backend/src/services/processor-rate-v2.service.ts:928` | A job at exactly 500m (or 1000m, or 5000m) matches TWO rate slabs and the winner is non-deterministic — the same job can cost ₹30,000 or ₹32,500 |
| **BH-0123** | LIVE | `backend/src/services/processor-rate-v2.service.ts:590` | Duplicate ACTIVE rate rows can coexist permanently — and every later rate lookup resolves to an arbitrary one of them |
| **BH-0126** | CONFIRMED | `backend/src/services/work-order-service-requirement.service.ts:373` | Service cost = piece count × per-METRE rate — no unit conversion, and the wrong number becomes the real PO amount |
| **BH-0127** | CONFIRMED | `backend/src/services/work-order-service-requirement.service.ts:372` | 8 of 10 service types can NEVER be priced or ordered — no rate card can exist for them, and nothing can set a rate by hand |
| **BH-0128** | LIVE | `backend/src/services/work-order-service-requirement.service.ts:1103` | Two concurrent generate-PO calls create TWO real purchase orders for the SAME service requirement — one is silently orphaned money |
| **BH-0130** | CONFIRMED | `backend/src/services/stockMovement.service.ts:525` | Stock-OUT and TRANSFER never touch the specialized stock tables — a warehouse transfer moves stock in one layer while the other still says it never left |
| **BH-0139** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:1969` | Merely clicking 'Continue' between wizard tabs orphans a style's approved CAD data — no fabric edit required |
| **BH-0143** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:2162` | Clearing a customer accessory preset never sticks — the deleted accessories RESURRECT on the next edit and are permanently restored on the next save |
| **BH-0145** | LIVE | `frontend/src/pages/FabricCostingPage.tsx:698` | Shrinkage cost uses the WRONG formula — every approved fabric cost is understated, and the same page uses the RIGHT formula for quantities |
| **BH-0146** | CONFIRMED | `frontend/src/pages/FabricCostingPage.tsx:447` | An APPROVED printed-fabric cost can be silently overwritten with a hardcoded default screen rate — just by opening the page |
| **BH-0149** | CONFIRMED | `backend/src/schemas/styleCosting.schema.ts:1` | COST SHEETS ARE BROKEN: creates always fail, and EDITS SILENTLY SAVE NOTHING while reporting success |
| **BH-0150** | CONFIRMED | `backend/src/controllers/styleCosting.controller.ts:165` | Smocking cost is counted once, then permanently lost — it's summed into the CMT total but never written to its own column |
| **BH-0157** | CONFIRMED | `frontend/src/pages/UnifiedRequirementsPage.tsx:2012` | A job-work PO can be issued in one processor's NAME while priced at another processor's RATE — the Processing/Service manual dialogs are the unguarded entry point |
| **BH-0158** | LIVE | `frontend/src/pages/UnifiedRequirementsPage.tsx:512` | 'Re-calculate MRP' feeds orders whose material is ALREADY on a live PO straight into the unguarded backend recalculation |
| **BH-0165** | CONFIRMED | `backend/src/schemas/order.schema.ts:16` | ORDER CREATION AND EDITING BOTH 400 — the schema demands fields the form never sends (VERIFY AGAINST REALITY, see caveat) |
| **BH-0169** | CONFIRMED | `backend/src/schemas/orderThreadRequirement.schema.ts:18` | ALL FOUR thread-requirement endpoints are broken — create 400s, EDIT SILENTLY SAVES NOTHING, generate-PO 400s, supplier lookup 400s |
| **BH-0170** | CONFIRMED | `backend/src/schemas/mrp.schema.ts:149` | Bulk PO generation SILENTLY DISCARDS the prices and quantities the user typed — the PO is created at a different price |
| **BH-0171** | CONFIRMED | `backend/src/schemas/serviceRequirement.schema.ts:44` | 'Calculate Services' 400s on EVERY click, and every service-PO generation 400s on the date format |
| **BH-0175** | CONFIRMED | `scripts/hooks/check-schema-controller-alignment.js:354` | ROOT CAUSE: you HAVE a tool built to catch this exact bug class — it can't see the codebase's most common pattern, and it was deliberately disconnected from the commit gate |
| **BH-0176** | LIVE | `backend/src/schemas/production.schema.ts:331` | 'Receive from Stitching' 400s on EVERY click — the finishing stage of the production pipeline is entirely blocked |
| **BH-0177** | LIVE | `backend/src/schemas/production.schema.ts:183` | Cutting 'Complete Batch' 400s whenever fabric is actually returned — so leftover fabric can never be booked back in |
| **BH-0180** | LIVE | `backend/src/schemas/embroideryStock.schema.ts:36` | Embroidery send-out AND receive are BOTH completely broken — every request 400s |
| **BH-0181** | LIVE | `backend/src/schemas/fabricStock.schema.ts:173` | Editing a greige stock entry saves ONLY the quality grade — purchase cost, location and roll numbers are silently discarded |
| **BH-0182** | LIVE | `backend/src/schemas/trimMasters.schema.ts:178` | Thread quantity conversion (boxes ↔ cones ↔ metres) always 400s — which is why thread requirements can't be entered |
| **BH-0183** | LIVE | `backend/src/schemas/laceDefect.schema.ts:34` | Logging a lace defect always 400s — the schema's defect types and date field don't match the app at all |
| **BH-0186** | LIVE | `backend/src/schemas/saleOrder.schema.ts:45` | Sale order creation is 100% broken — the dialog always sends an empty items array that the schema forbids |
| **BH-0187** | LIVE | `backend/src/schemas/invoice.schema.ts:12` | Invoice creation always 400s — and even if fixed, line items would be silently discarded and no invoice_items row could ever be created |
| **BH-0188** | LIVE | `backend/src/schemas/quotation.schema.ts:46` | Quotation creation always 400s — the date picker's format is rejected |
| **BH-0189** | LIVE | `backend/src/schemas/dispatch.schema.ts:253` | 'Record Proof of Delivery' 400s on every use |
| **BH-0191** | CONFIRMED | `backend/src/schemas:1` | CROSS-CUTTING: every `z.string().datetime()` paired with an <input type="date"> is a guaranteed 400 — this one mismatch breaks quotations, invoices, POD, service POs and lab dips |
| **BH-0192** | LIVE | `backend/src/schemas/cadPlanning.schema.ts:277` | 'Approve CAD Plan' always fails — the CAD→cost-sheet gate is blocked, which is upstream of the dead cost sheets |
| **BH-0193** | LIVE | `backend/src/schemas/orderItems.schema.ts:18` | 'Recalculate costing' silently never happens — the UI says it did |
| **BH-0207** | LIVE | `frontend/src/pages/FabricForm.tsx:489` | SILENT DATA LOSS: saving any existing fabric DELETES all of its supplier links |
| **BH-0208** | LIVE | `backend/src/services/gstReport.service.ts:102` | GSTR-1 silently DROPS every overdue invoice from the GST return — and GSTR-3B includes them, so the two filings cannot reconcile |
| **BH-0214** | LIVE | `backend/src/services/challan.service.ts:827` | LIVE LANDMINE: cancelling an issued challan NEVER returns the stock — the goods are back in the warehouse but the system still counts them as consumed |
| **BH-0222** | DORMANT | `backend/src/controllers/dyeing.controller.ts:1668` | DORMANT LANDMINE: sending fabric for RE-processing never deducts it from stock — the same lot can be sold twice while it sits at the mill |
| **BH-0236** | DORMANT | `backend/src/controllers/dispatch.controller.ts:390` | DORMANT: deleting a pending delivery note destroys the finished goods — stock is deducted at creation and never given back |
| **BH-0237** | DORMANT | `backend/src/services/embroidery-stock.service.ts:306` | DORMANT: embroidery receipt has no upper bound and partial receipts OVERWRITE each other instead of adding up |
| **BH-0242** | DORMANT | `backend/src/controllers/cutting.controller.ts:282` | The FIRST cutting batch anyone creates will deduct the ENTIRE fabric lot, not the amount needed |
| **BH-0243** | DORMANT | `backend/src/controllers/cutting.controller.ts:414` | Fabric issued to a cutting batch can NEVER be released — the restore code is dead, and 'Cancel' doesn't cancel |
| **BH-0244** | DORMANT | `backend/src/controllers/finishing.controller.ts:613` | Clicking 'Generate Transfer Slip' twice in Finishing DOUBLES your finished-goods stock — and the button stays clickable forever |
| **BH-0251** | LIVE | `backend/.env:1` | Your real JWT signing key and database password are committed to git — and rotating them in place will NOT remove them |
| **BH-0252** | CONFIRMED | `backend/src/utils/jwt.utils.ts:5` | The JWT secret falls back to a hardcoded string — if the env var is ever missing, anyone can forge an ADMIN token |
| **BH-0257** | CONFIRMED | `frontend/src/pages/dashboards/AccountsDashboard.tsx:71` | ALL FOUR dashboards are structurally broken — every KPI reads zero, including money the backend correctly calculated |
| **BH-0259** | LIVE | `backend/src/controllers/dashboard.controller.ts:424` | 'Monthly Revenue' can never see a late payment — it filters on when the INVOICE was created, not when the money arrived |
| **BH-0260** | CONFIRMED | `backend/src/services/gstReport.service.ts:285` | GSTR-3B claims Input Tax Credit from PURCHASE ORDERS, not from goods actually received — you can claim ITC on goods that haven't arrived |
| **BH-0261** | LIVE | `backend/src/services/style-import.service.ts:558` | Bulk style import merges two different customers' styles into one if they happen to reuse a style code |
| **BH-0262** | CONFIRMED | `backend/src/controllers/style-import.controller.ts:308` | The CSV importer splits on every comma — one comma inside a style name silently shifts every column after it |
| **BH-0275** | LIVE | `frontend/src/pages/StyleFormRedesigned.tsx:2139` | A FIFTH DATA WIPE: saving any style DELETES its process costs — 21 real rows with real money are sitting there right now |
| **BH-0276** | LIVE | `backend/src/controllers/fabric-stock.controller.ts:1223` | Deleting a fabric stock lot leaves its quantity in stock_levels forever — the Stock Levels page permanently overstates what you have |
| **BH-0280** | CONFIRMED | `frontend/src/lib/api.ts:18` | SYSTEMIC AMPLIFIER: your API client silently RETRIES POSTs up to 3 times on any server error — so one click can apply a stock change FOUR times |
| **BH-0283** | LIVE | `backend/src/controllers/greige.controller.ts:459` | NEW CLASS — deleting a greige master silently orphans its stock and erases its procurement links (the fabric delete is guarded; the greige one isn't) |
| **BH-0286** | LIVE | `backend/src/controllers/label.controller.ts:758` | SYSTEMIC: all SIX trim-master deletes guard the EMPTY table and ignore the FULL one — 244 live BOM lines can be silently orphaned |
| **BH-0287** | LIVE | `backend/src/controllers/style.controller.ts:281` | 'Permanently delete' a style performs ZERO dependency checks — it orphans 111 live CAD records and 10 fabric stock lots |
| **BH-0291** | LIVE | `backend/src/controllers/cad-embroidery.controller.ts:578` | When fabric arrives at a different width than planned, the CAD updates the width but KEEPS the old marker length — so you reserve the wrong amount of fabric |
| **BH-0292** | LIVE | `backend/src/controllers/cad-approval.controller.ts:686` | The 'Link CAD to Stock' path has the identical defect — it swaps in the real width and leaves the consumption figure untouched |
| **BH-0294** | LIVE | `backend/src/services/helpers/material-sync.helper.ts:1` | PROOF: the stock bugs have ALREADY corrupted your live data — your Stock Levels page is wrong by 92,650 metres across 7 materials, including TWO NEGATIVE stock levels |
| **BH-0296** | LIVE | `backend/src/services/fabric-stock.service.ts:196` | ROOT CAUSE FOUND: a 'virtual fabric master' is minted for every raw greige, giving ONE physical lot TWO materials rows — receipts credit one, consumption deducts the other, and the stock goes negative |
| **BH-0304** | CONFIRMED | `backend/src/services/helpers/material-sync.helper.ts:109` | ROOT CAUSE of the wrong-unit corruption: syncStockLevelQuantity defaults the unit to 'PIECE' — so any caller that forgets to pass one records fabric in pieces |
| **BH-0305** | LIVE | `backend/src/services/greige-stock.service.ts:1` | The OTHER direction: processor consumption never syncs at all — which is why GRG-0034 OVERSTATES stock by 17,080 m |

## S2 — Wrong results / broken features  (112)

| ID | Status | File | Finding |
|---|---|---|---|
| **BH-0001** | CONFIRMED | `backend/src/services/fabric-stock.service.ts:81` | createStyleStock writes escape the caller's prisma.$transaction (challan receipt rollback leaves phantom stock) |
| **BH-0003** | LIVE | `backend/src/controllers/fabric-stock.controller.ts:136` | POST /api/stock (createFabricStock) never calls ensureMaterialRecord or syncStockLevelQuantity |
| **BH-0004** | LIVE | `backend/src/controllers/fabric-stock.controller.ts:1030` | POST /api/stock/adjust silently skips stock_levels sync when materials record is missing |
| **BH-0005** | CONFIRMED | `backend/src/controllers/fabric-stock.controller.ts:1328` | DELETE /api/stock/:id hard-deletes lots with positive quantityAvailable without reversing stock_levels |
| **BH-0012** | CONFIRMED | `backend/src/services/greige-stock.service.ts:125` | createGreigeStock: procurement + stock + sync non-atomic on the direct-create path — FK failure orphans procurement row |
| **BH-0016** | CONFIRMED | `backend/src/services/greige-stock.service.ts:682` | adjustGreigeStock lost-update race — audit rows both written, one balance change lost |
| **BH-0018** | CONFIRMED | `backend/src/services/greige-stock.service.ts:937` | receiveFromProcessor check-then-write race, compounded by controller's own stale pre-check |
| **BH-0026** | CONFIRMED | `backend/src/services/laceStock.service.ts:599` | consumeStock lost-update on allocation.quantityConsumed defeats over-consumption guard |
| **BH-0027** | CONFIRMED | `backend/src/services/laceStock.service.ts:664` | returnStock lost-update on allocation.quantityReturned — physical stock credited twice, ledger undercounts |
| **BH-0031** | CONFIRMED | `backend/src/routes/thread-stock.routes.ts:96` | POST /api/thread-stock never reads warehouseId — row stored with null warehouse, sync unscoped or skipped |
| **BH-0033** | CONFIRMED | `backend/src/services/grn.service.ts:1384` | GRN thread auto-create syncs with thread.id while bulk-imported threads have materials.id='mat-<code>' — silent FK failure, stock_levels never updated |
| **BH-0034** | CONFIRMED | `backend/src/services/grn.service.ts:1391` | ALL specialized-stock auto-creation on GRN approval runs AFTER the approval tx commits, failures only logged — applies to all 10 material categories |
| **BH-0036** | CONFIRMED | `backend/src/services/trim-stock.service.ts:184` | Trim stock-in: optional/unvalidated warehouseId → unscoped cross-warehouse sync or silent skip for new materials |
| **BH-0037** | CONFIRMED | `backend/src/routes/trim-stock.routes.ts:102` | Trim stock-in: unvalidated unit persists garbage in trim table and silently breaks stock_levels creation (enum cast throw swallowed) |
| **BH-0040** | LIVE | `backend/src/services/stockMovement.service.ts:547` | Stock-count approvals and manual adjustments update ONLY stock_levels — pages reading specialized tables directly (e.g. GreigeAvailableStock) never see corrections |
| **BH-0042** | CONFIRMED | `backend/src/services/stockMovement.service.ts:89` | increaseStockInTx/decreaseStockInTx: read-then-absolute-write on stock_levels — lost updates across ALL generic stock movements |
| **BH-0043** | CONFIRMED | `backend/src/controllers/stockCount.controller.ts:123` | PUT /api/stock-counts/:countId/items/:itemId: physicalQuantity completely unvalidated — unbounded phantom stock via count approval |
| **BH-0046** | LIVE | `backend/src/services/helpers/stock-routing.helper.ts:215` | routeToSpecializedStock swallows errors and its return is ignored — manual Stock IN can commit movements/stock_levels while the specialized row is never created |
| **BH-0047** | CONFIRMED | `backend/src/services/helpers/material-sync.helper.ts:109` | Helper's default unit 'PIECE' permanently mislabels first-created stock_levels rows for METER-based materials |
| **BH-0052** | CONFIRMED | `backend/src/services/embroidery-stock.service.ts:323` | Embroidery receive: non-cumulative partial tracking + resultFabricStockId overwrite; UI has NO path to complete a partial receipt |
| **BH-0058** | LIVE | `backend/src/services/stockCount.service.ts:293` | startCounting has no status guard — APPROVED counts can be reopened and re-approved, double-applying all adjustments |
| **BH-0062** | CONFIRMED | `backend/src/controllers/export.controller.ts:106` | BROKEN ACCESS CONTROL: POST /api/export/:module spreads unvalidated req.body.filters into the Prisma where — any authenticated user can exfiltrate bank account numbers/IFSC/GST data and pull soft-deleted rows |
| **BH-0066** | CONFIRMED | `backend/src/routes/style-material-bom.routes.ts:32` | BOM create/update/delete routes have NO role guard — any authenticated role can rewrite style BOM quantities/costs |
| **BH-0072** | CONFIRMED | `backend/src/services/document-generator.service.ts:364` | Tax invoice line rows don't add up: Amount/CGST/SGST cells printed with toFixed(0) while the row Total uses the unrounded sum |
| **BH-0073** | CONFIRMED | `backend/src/services/document-generator.service.ts:59` | Invoices silently print hardcoded ICICI bank details when no primary bank account is active — customers could pay the wrong account |
| **BH-0075** | CONFIRMED | `backend/src/services/document-generator.service.ts:3970` | Challan prints impossible 3-decimal rupee amounts (missing maximumFractionDigits) — line amounts and the challan TOTAL both wrong |
| **BH-0081** | CONFIRMED | `backend/src/services/mrp.service.ts:963` | Fabric stock at an INCOMPATIBLE WIDTH is credited 1:1 against the requirement, shrinking the PO — the code's own comment admits the intended split was never implemented |
| **BH-0082** | CONFIRMED | `backend/src/services/mrp.service.ts:900` | MRP availability is not scoped by warehouse — stock at a processor/job-worker or another facility counts as on-hand |
| **BH-0086** | LIVE | `backend/src/services/mrp.service.ts:2172` | PO numbers are generated on a separate Prisma client outside the transaction (SELECT-max + 1, no lock) — concurrent PO generation collides and rolls back the second user's whole PO |
| **BH-0087** | CONFIRMED | `backend/src/services/mrp.service.ts:2410` | Concurrent GRNs against the same PO item lose a receipt — updateReceivedQuantity does read-then-absolute-write instead of an atomic increment |
| **BH-0088** | LIVE | `backend/src/services/mrp.service.ts:2924` | convertToGreigeProcessing: four un-transacted writes mark the original requirement FULFILLED before creating its replacements — a mid-way failure makes the demand vanish |
| **BH-0095** | CONFIRMED | `backend/src/services/order-bom.service.ts:1815` | BOM approve() is a check-then-write with no compare-and-swap — a double-click fires MRP twice concurrently |
| **BH-0096** | LIVE | `backend/src/services/order-bom.service.ts:321` | A partially-populated style BOM is PERMANENTLY stuck incomplete — the auto-populate loop isn't transactional and its idempotency check treats a partial result as 'done' |
| **BH-0101** | CONFIRMED | `backend/src/services/style.service.ts:848` | Two people editing the same style: the second save silently deletes the first's additions (no version check) |
| **BH-0102** | LIVE | `backend/src/services/style.service.ts:487` | SKU variant creation runs OUTSIDE the style's transaction — a failure mid-loop leaves a style missing some of its sizes |
| **BH-0108** | LIVE | `backend/src/services/grn.service.ts:95` | Valid GRN quantities are REJECTED by float equality — clerks are forced to fudge numbers that then persist into stock valuation |
| **BH-0109** | CONFIRMED | `backend/src/services/grn.service.ts:1012` | Specialized stock is created with the STALE pre-approval warehouse — the GRN and audit trail say one warehouse, the physical lot says another (or none) |
| **BH-0110** | LIVE | `backend/src/services/grn.service.ts:1788` | Double-clicking Reject drives the PO's received quantity NEGATIVE — which then inflates the over-receipt allowance on the next GRN |
| **BH-0111** | LIVE | `backend/src/services/grn.service.ts:85` | Over-receipt tolerance is checked against a stale snapshot — two concurrent GRNs jointly blow past the cap |
| **BH-0115** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:99` | The two PO paths can both buy the same material — the schema HAS a table designed to prevent this, and neither mainline path writes it |
| **BH-0116** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:179` | Greige shrinkage never applied for GREIGE_PROCESSED fabric here either — same defect as MRP (BH-0078), in the second PO path |
| **BH-0117** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:397` | Greige-lace shortfall subtracts the FINISHED lace's stock instead of the greige lace's own — wrong stock pool, under-ordering |
| **BH-0118** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:886` | Processor rate-drift check validates the cost sheet's ORIGINAL processor, not the one the PO is actually raised for — switching processors bypasses the price guard |
| **BH-0119** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:657` | Re-submitting cost-sheet PO generation creates a DUPLICATE PO — the reuse lookup only matches rows whose PO id is still null |
| **BH-0120** | CONFIRMED | `backend/src/services/costSheetPOGeneration.service.ts:41` | PO numbers generated outside the transaction with no lock — same collision pattern as MRP (BH-0086), across all 7 generate* methods, plus an orphaned generation row |
| **BH-0124** | CONFIRMED | `backend/src/services/processor-rate-v2.service.ts:933` | A quantity falling in a GAP between slabs silently gets the cheapest bulk rate — the fallback grabs the globally-highest slab, not the nearest |
| **BH-0125** | CONFIRMED | `backend/src/services/processor-rate-validation.service.ts:107` | The rate-drift guard compares against the WRONG quantity tier — `slabId: slabId || undefined` drops the filter instead of matching NULL |
| **BH-0129** | CONFIRMED | `backend/src/services/work-order-service-requirement.service.ts:297` | Service requirements can be created twice for one work order — check-then-insert with no unique constraint and no transaction |
| **BH-0131** | CONFIRMED | `backend/src/services/stockMovement.service.ts:104` | Stock adjustments never recompute stockValue — the valuation report drifts permanently below reality |
| **BH-0132** | CONFIRMED | `backend/src/services/stockMovement.service.ts:398` | 'Insufficient stock' returns a generic HTTP 500 — the user never sees the real reason, and it fires false alerts |
| **BH-0133** | LIVE | `backend/src/services/stockMovement.service.ts:1252` | Every GRN row in the Unified Movements ledger shows a blank rate and value — the code reads columns that don't exist on grn_items |
| **BH-0135** | LIVE | `backend/src/routes/index.ts:267` | ROUTE SHADOWING: the TESTED purchase-order status handlers are dead code — an untested duplicate silently wins |
| **BH-0136** | CONFIRMED | `backend/src/services/purchaseOrder.service.ts:819` | A purchase order that just finished receiving can be silently flipped to CANCELLED (stale read, unconditional write) |
| **BH-0137** | LIVE | `backend/src/services/purchaseOrder.service.ts:386` | Item quantities and prices can be changed on a PO that was concurrently SENT to the supplier |
| **BH-0138** | CONFIRMED | `backend/src/services/gst.service.ts:352` | An interstate PO can be silently taxed as intrastate — isInterstatePO swallows lookup errors and defaults to false |
| **BH-0140** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:2171` | The style form has ZERO stale-data protection — an older tab silently clobbers a newer save |
| **BH-0144** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:2072` | Reducing 'Number of Components' leaves an invisible GHOST component that still gets saved with its fabric |
| **BH-0151** | CONFIRMED | `frontend/src/pages/CostSheetForm.tsx:2867` | The variance badge computes MARKUP but labels it 'margin' — overstating profitability by ~7 points |
| **BH-0152** | CONFIRMED | `frontend/src/pages/CostSheetForm.tsx:151` | An APPROVED cost sheet looks fully editable — the lock only fires on Save, after all the work is lost |
| **BH-0154** | CONFIRMED | `frontend/src/pages/PurchaseOrderForm.tsx:923` | The GST% the buyer edits — and the grand total they confirm — is NEVER SENT; the saved PO carries a different total |
| **BH-0159** | CONFIRMED | `frontend/src/pages/UnifiedRequirementsPage.tsx:890` | The Manual PO dialog has no price preview and no supplier-mismatch warning — the Bulk dialog has both |
| **BH-0160** | CONFIRMED | `frontend/src/pages/UnifiedRequirementsPage.tsx:400` | Select-All groups by status only — a mixed-supplier selection can be submitted as ONE purchase order |
| **BH-0162** | CONFIRMED | `frontend/src/pages/StockInForm.tsx:766` | The unit dropdown offers 'Roll' — a unit the backend doesn't have — so picking it fails the stock-in, and in a bulk receipt it kills every other line too |
| **BH-0166** | CONFIRMED | `frontend/src/pages/OrderForm.tsx:321` | Editing an order shows ZERO quantities for any size whose id changed — the name-fallback reads keys the serializer no longer produces |
| **BH-0172** | LIVE | `backend/src/schemas/unifiedPo.schema.ts:32` | The unified-PO schema's enums don't match the database's — most real PO categories, units and service types are rejected outright |
| **BH-0173** | DORMANT | `backend/src/controllers/fabric-procurement.controller.ts:39` | Fabric procurement has TWO irreconcilable schemas — no payload can satisfy both, and invoice fields are silently stripped |
| **BH-0174** | CONFIRMED | `backend/src/services/purchaseOrder.service.ts:142` | Fold length is silently dropped when CREATING a purchase order (but saved correctly on update) |
| **BH-0184** | CONFIRMED | `backend/src/schemas/stockProductionOrder.schema.ts:31` | Stock production orders: create always 400s, and edit silently discards the quantity and the size/colour breakdown |
| **BH-0190** | DORMANT | `backend/src/schemas/creditNote.schema.ts:22` | Credit notes permanently lose their link back to the invoice line they credit |
| **BH-0194** | LIVE | `backend/src/schemas/cadPlanning.schema.ts:249` | CAD 'Copy as Draft' and 'Link CAD to Stock' both 400 on every click |
| **BH-0201** | CONFIRMED | `frontend/src/pages/PurchaseOrderDetail.tsx:227` | PO 'Linked Styles' badges are silently always empty for MRP- and production-sourced POs — and the compiler CANNOT see this bug |
| **BH-0205** | CONFIRMED | `docs/bug-hunt/checker-output/frontend-tsc.txt:1` | KEY INSIGHT: the TypeScript errors are mostly NOISE — and the real serializer bugs are INVISIBLE to the compiler |
| **BH-0206** | CONFIRMED | `backend/src/utils/serializer.ts:138` | SYSTEMIC: the serializer renames `_count` to `count` on EVERY response — so every record-count badge and Stats column in the app is silently blank or shows 0 |
| **BH-0209** | LIVE | `backend/src/services/invoice.service.ts:658` | Recording a customer payment is not atomic — a crash mid-way leaves the payment recorded but the invoice still showing unpaid |
| **BH-0215** | CONFIRMED | `backend/src/services/challan.service.ts:280` | Issuing fabric on two challans from the same lot at once silently loses one of the deductions |
| **BH-0216** | DORMANT | `backend/src/services/workOrder.service.ts:604` | A work order can NEVER be completed — the completion check waits for a production stage the app never sends |
| **BH-0221** | LIVE | `frontend/src/pages/DyeingList.tsx:738` | The entire Dyeing/Printing 'Process PO' workflow is unreachable — every button lands on the 404 page, because the pages were never built |
| **BH-0223** | DORMANT | `backend/src/controllers/dyeing.controller.ts:1659` | 'Send to Mill' consumes stock first and flips the status LAST, with no transaction — a mid-way failure lets a retry consume the stock twice |
| **BH-0226** | LIVE | `frontend/src/pages/StockCountList.tsx:159` | A stock count can be created and listed — but never actually PERFORMED. The whole execution workflow is behind a 404 |
| **BH-0227** | CONFIRMED | `frontend/src/pages/DispatchList.tsx:185` | The entire Dispatch module — ASNs and Delivery Notes — cannot be created or opened. Every button 404s |
| **BH-0228** | CONFIRMED | `frontend/src/pages/GarmentPhysicalTests.tsx:115` | The whole Testing module (FPT, GPT, Testing Labs, Test Templates) has no working create, view or edit — only the lists render |
| **BH-0229** | CONFIRMED | `frontend/src/pages/DyeingList.tsx:414` | Lab Dips on Dyeing AND Printing: New / View / Edit all 404 — a SECOND dead-route cluster on the same two pages |
| **BH-0230** | CONFIRMED | `frontend/src/pages/ChartOfAccountsList.tsx:137` | Chart of Accounts cannot be created or edited, and no credit note can ever be opened — all 404 |
| **BH-0234** | LIVE | `backend/src/schemas/sample.schema.ts:14` | A sample can NEVER be created — the Zod enum and the database enum have ZERO values in common |
| **BH-0235** | CONFIRMED | `backend/src/schemas/sample.schema.ts:126` | Sample status changes 400 for four of the five real statuses — including the buyer's approval-with-comments |
| **BH-0238** | DORMANT | `backend/src/controllers/dispatch.controller.ts:641` | DORMANT: a customer can REJECT an entire shipment and the system still records it as DELIVERED |
| **BH-0239** | DORMANT | `backend/src/controllers/dispatch.controller.ts:268` | DORMANT: the over-dispatch guard is computed per-SKU and then thrown away — you can ship 200 Smalls against an order for 100 S + 100 M |
| **BH-0245** | DORMANT | `backend/src/controllers/stitching.controller.ts:491` | NOTHING on the production floor bounds a quantity — you can cut, stitch and finish more pieces than were ever issued |
| **BH-0246** | DORMANT | `backend/src/controllers/stitching.controller.ts:406` | 'Receive from Cutting' and 'Receive from Stitching' are rubber stamps — any shortage you report is silently thrown away |
| **BH-0247** | DORMANT | `backend/src/jobs/handlers.ts:76` | The import, export and email job handlers are stubs that report SUCCESS while doing nothing at all |
| **BH-0253** | LIVE | `backend/src/middleware/auth.middleware.ts:24` | Firing someone doesn't lock them out — deactivating or demoting a user does not revoke their existing token |
| **BH-0254** | LIVE | `backend/src/routes/grn.routes.ts:95` | The approval routes have no role checks — and their own comments claim they do |
| **BH-0258** | CONFIRMED | `frontend/src/pages/dashboards/GeneralDashboard.tsx:124` | The dashboards display FABRICATED growth percentages — '+12% vs last month' is a hardcoded literal, computed from nothing |
| **BH-0263** | LIVE | `backend/src/controllers/dashboard.controller.ts:407` | 'Low Stock Items' uses a hardcoded quantity < 10 for every material and every unit — ignoring each material's own reorder level |
| **BH-0264** | CONFIRMED | `backend/src/controllers/export.controller.ts:106` | The export endpoint lets the caller override its own filter — export deactivated suppliers by just asking |
| **BH-0267** | LIVE | `frontend/src/pages/StyleFormRedesigned.tsx:1126` | Saving a style DELETES AND RECREATES its SKU variants with new row IDs — real, but I OVERSTATED the damage and am correcting it |
| **BH-0269** | CONFIRMED | `frontend/src/pages/StockInForm.tsx:872` | Lace suppliers never appear anywhere — and Stock IN silently prices lace at the RAW GREIGE cost instead of the supplier's actual price |
| **BH-0270** | LIVE | `frontend/src/pages/StockAdjustmentForm.tsx:109` | Stock adjustments are 100% broken — the form sends `quantity`, the schema demands `adjustmentQuantity` |
| **BH-0271** | CONFIRMED | `backend/src/schemas/material.schema.ts:11` | Material supplier price, lead time and MOQ are silently thrown away on every save — and the controller is sitting there ready to store them |
| **BH-0272** | CONFIRMED | `frontend/src/pages/dashboards/AccountsDashboard.tsx:79` | The dashboard lists are broken INDEPENDENTLY of the `stats` bug — fixing BH-0257 will not bring them back |
| **BH-0274** | CONFIRMED | `frontend/src/pages/ServiceRequirementsDashboard.tsx:141` | Three more wrong-key dashboards: the Service Requirements stat cards, the Order BOM item count, and the Dispatch cartons column are all permanently zero |
| **BH-0277** | DORMANT | `backend/src/services/purchaseOrder.service.ts:804` | DORMANT: the generic 'Cancel PO' button strands consumed greige and leaves the mill job stuck at AT_MILL forever |
| **BH-0278** | DORMANT | `frontend/src/pages/StyleFormRedesigned.tsx:1379` | The style form silently drops any BOM line it doesn't recognise — then deletes it on save |
| **BH-0281** | LIVE | `backend/src/services/greige-stock.service.ts:682` | Manual stock adjustment is a read-then-absolute-write — the endpoint the retry bug (BH-0280) turns into silent corruption |
| **BH-0284** | DORMANT | `backend/src/controllers/lace.controller.ts:789` | DORMANT: deleting a greige lace silently strips it out of any cost sheet that referenced it |
| **BH-0288** | LIVE | `backend/src/services/WeightedAverageCostService.ts:88` | Your 'weighted average cost' is not weighted — it averages the lots, ignoring their sizes, so stock valuation can be wildly wrong |
| **BH-0289** | LIVE | `backend/src/services/greige-stock.service.ts:477` | A fully-consumed greige lot can stay 'AVAILABLE' forever — the status is decided on an unrounded float, then the quantity is silently rounded to zero |
| **BH-0295** | CONFIRMED | `backend/src/services/helpers/material-sync.helper.ts:1` | PROOF: ensureMaterialRecord is creating DUPLICATE materials rows — 5 greige masters already have two each |
| **BH-0298** | LIVE | `backend/prisma/schema.prisma:456` | A unique constraint that protects NOTHING: all 11 brand_categories rows are exempt from it, because Postgres treats NULLs as distinct |
| **BH-0300** | LIVE | `backend/prisma/schema.prisma:1` | 16 of 77 composite unique constraints silently DO NOT ENFORCE (nullable columns) — a real hole, but NOT yet breached (I corrected my own over-claim) |
| **BH-0301** | LIVE | `backend/prisma/schema.prisma:1` | Your database enforces NOTHING about values: ZERO check constraints across 576 money and quantity columns — which is why the impossible negative stock was allowed in |
| **BH-0302** | CONFIRMED | `backend/src/services/stockLevel.service.ts:551` | The Stock Dashboard HIDES the corrupt ledger rows instead of surfacing them — it filters out negative quantities, so a broken ledger looks perfectly healthy |

## S3 — Wrong display / audit trail / narrow races  (75)

| ID | Status | File | Finding |
|---|---|---|---|
| **BH-0002** | CONFIRMED | `backend/src/services/fabric-stock.service.ts:110` | createStyleStock: create + ensureMaterialRecord non-atomic; failure orphans committed stock row |
| **BH-0007** | CONFIRMED | `backend/src/controllers/fabric-stock.controller.ts:1001` | adjustStock: quantity update, audit row, and sync are three independent non-transactional writes |
| **BH-0009** | CONFIRMED | `backend/src/services/helpers/material-sync.helper.ts:105` | syncStockLevelQuantity swallows ALL its own errors by design — silent stock_levels drift with no retry/reconciliation |
| **BH-0032** | CONFIRMED | `backend/src/routes/thread-stock.routes.ts:86` | POST /api/thread-stock has no validateBody — unit and other fields flow unchecked into thread_stock.create |
| **BH-0039** | CONFIRMED | `backend/src/services/helpers/material-sync.helper.ts:124` | Concurrent FIRST stock-in for same material+warehouse: loser's stock_levels increment silently lost (P2002 swallowed) |
| **BH-0044** | CONFIRMED | `backend/src/services/stockCount.service.ts:268` | updateCountProgress absolute-writes count status from unlocked snapshot — concurrent counters can revert COUNTED to IN_PROGRESS |
| **BH-0051** | CONFIRMED | `backend/src/services/embroidery-stock.service.ts:303` | ensureMaterialRecord escapes the receive() transaction (helper takes no tx) |
| **BH-0059** | CONFIRMED | `backend/src/services/processingBatch.service.ts:369` | PUT /processing-batches/:id: raw req.body into prisma.update — every real processing_batch column is client-settable |
| **BH-0060** | CONFIRMED | `backend/src/services/processingBatch.service.ts:72` | POST /processing-batches unvalidated: mismatched materialType skips existence checks; negative quantities corrupt job-work totals |
| **BH-0061** | LIVE | `backend/src/services/processingBatch.service.ts:506` | Processing batches have NO working stock-reconciliation path: complete/cancel lack status guards, and the only stock-creating method (receiveProcessedLace) is unrouted — frontend's call 404s |
| **BH-0063** | CONFIRMED | `backend/src/controllers/customer-size-presets.controller.ts:122` | Customer size preset create: unvalidated isDefault + non-atomic unset-then-create can strip a customer of all default presets |
| **BH-0065** | CONFIRMED | `backend/src/controllers/laceLabDip.controller.ts:35` | Lace lab dip create/update accept negative sampleQuantity and labDipCost — negative cost reachable through the real UI form |
| **BH-0067** | CONFIRMED | `backend/src/controllers/style-material-bom.controller.ts:900` | updateBOMItem accepts negative quantityPerGarment into Decimal columns feeding MRP (no schema, falsy-only guard) |
| **BH-0069** | LIVE | `backend/src/services/report-generator.service.ts:387` | listReports(userId) ignores its userId argument — every authorized role can list and download every other user's generated reports, including financial ones |
| **BH-0074** | CONFIRMED | `backend/src/services/document-generator.service.ts:219` | Tax invoice renders 'N/A' as the billed-to name and leaves the items-table TOTAL row's tax columns blank |
| **BH-0077** | CONFIRMED | `backend/src/services/document-generator.service.ts:2737` | Purchase Order silently omits the 'Deliver To' address block and the supplier GSTIN line when those fields are empty |
| **BH-0083** | CONFIRMED | `backend/src/services/mrp.service.ts:704` | Concurrent MRP recalculations duplicate active requirement rows (cancel runs outside the transaction; reuse matches only CANCELLED; no unique constraint) |
| **BH-0089** | CONFIRMED | `backend/src/services/mrp.service.ts:2891` | convertToGreigeProcessing has no status guard — a CANCELLED requirement can be resurrected into new procurement |
| **BH-0090** | CONFIRMED | `backend/src/services/mrp.service.ts:2927` | convertToGreigeProcessing breaks the totalRequired = allocated + shortfall invariant — the order's requirement summary double-counts the converted quantity |
| **BH-0091** | LIVE | `backend/src/services/mrp.service.ts:1950` | Requirements dropped from a PO batch are never reported — the user gets a success message for a partial order |
| **BH-0092** | PLAUSIBLE | `backend/src/services/mrp.service.ts:2145` | A PROCESSING requirement batched with a non-PROCESSING one skips the 'wait for greige' gating — job-work PO can be sent before its fabric arrives |
| **BH-0097** | LIVE | `backend/src/services/order-bom.service.ts:1120` | BOM regeneration paths deactivate the active BOM with no status check — the old BOM's PO-linked requirements are orphaned (never cancelled) |
| **BH-0098** | LIVE | `backend/src/services/order-bom.service.ts:469` | orderItemId is accepted by the API but ignored — the BOM uses the first order_item matching the style, and falls back to the WHOLE order's quantity if none matches |
| **BH-0099** | CONFIRMED | `backend/src/services/order-bom.service.ts:710` | Cost-sheet rows with a blank name are silently dropped from the BOM — no log, no requirement, material never bought |
| **BH-0103** | CONFIRMED | `backend/src/services/style.service.ts:233` | styleCode and internalCode have NO unique constraint — duplicate codes can be created and are then resolved arbitrarily |
| **BH-0104** | CONFIRMED | `backend/src/controllers/style.controller.ts:204` | Cost Sheet shows fabric width 0 — the controller falls back to a Prisma column that doesn't exist (fab.usableWidth) |
| **BH-0105** | CONFIRMED | `backend/src/services/style.service.ts:2037` | loadPresetAccessories swallows all errors and returns [] — a style is created missing its customer's mandated packaging/labels, reported as success |
| **BH-0112** | PLAUSIBLE | `backend/src/services/grn.service.ts:769` | PROCESSING GRN approval force-sets the job's total received metres onto only the FIRST PO item (absolute set, not increment) |
| **BH-0113** | PLAUSIBLE | `backend/src/services/grn.service.ts:238` | Concurrent GRNs can both 'receive' the same processing job (receivedDate guard checked outside any transaction) |
| **BH-0141** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:1807` | Deleting two fabrics quickly makes the first one reappear — handleRemoveFabric is the one handler using a stale closure |
| **BH-0147** | CONFIRMED | `frontend/src/pages/FabricCostingPage.tsx:637` | Switching the Purpose tab or style silently discards recalculated (unsaved) costs with no warning |
| **BH-0148** | PLAUSIBLE | `frontend/src/pages/FabricCostingPage.tsx:2834` | The same row shows a different fabric requirement depending on unrelated UI grouping state (?? vs ||) |
| **BH-0155** | CONFIRMED | `frontend/src/pages/PurchaseOrderForm.tsx:971` | After creating or sending a PO, the list and dashboard show stale data for up to a minute |
| **BH-0156** | PLAUSIBLE | `frontend/src/pages/PurchaseOrderForm.tsx:553` | A non-editable PO opens fully editable via direct URL — the save then fails with a masked 500 |
| **BH-0161** | PLAUSIBLE | `frontend/src/pages/UnifiedRequirementsPage.tsx:413` | Generating a PO here never invalidates the Purchase Orders list — it can lag for 30s |
| **BH-0163** | CONFIRMED | `frontend/src/pages/StockInForm.tsx:550` | The batch 'Total Qty' sums nominal quantities while the system commits FOLD-ADJUSTED ones — the clerk commits believing more arrived than is recorded |
| **BH-0164** | CONFIRMED | `frontend/src/pages/StockInForm.tsx:641` | The form throws away the API response and always shows the same generic success — which is why the processor-return bug stayed invisible |
| **BH-0167** | PLAUSIBLE | `frontend/src/pages/OrderForm.tsx:1606` | The banner promises the typed total will be saved, but the backend silently substitutes the size-breakdown SUM instead |
| **BH-0178** | CONFIRMED | `backend/src/schemas/processing.schema.ts:30` | The whole processing-stage/movement/delivery module is schema-broken end to end (latent — no UI wired to it) |
| **BH-0185** | DORMANT | `backend/src/schemas/stockLevel.schema.ts:18` | PUT /api/stock-levels/:id silently discards quantity and valuation rate — the very fields it exists to adjust |
| **BH-0196** | CONFIRMED | `frontend/src/pages/GRNForm.tsx:536` | A GRN's than/roll breakdown can permanently contradict its own header quantity |
| **BH-0197** | CONFIRMED | `frontend/src/pages/GRNForm.tsx:401` | A mistyped negative quantity SILENTLY DROPS that whole line from the GRN — the clerk is told it saved |
| **BH-0198** | CONFIRMED | `frontend/src/pages/CuttingDetail.tsx:1262` | Cutting's fabric-return box has no lower bound — the consumption preview shows MORE fabric consumed than was ever issued, and the saved figure differs from the preview |
| **BH-0199** | CONFIRMED | `frontend/src/pages/CuttingDetail.tsx:838` | A mistyped negative Pcs/Layer silently omits that size from the lay — the rest saves and reports success |
| **BH-0202** | CONFIRMED | `frontend/src/pages/DyeingList.tsx:376` | The Mill column on the Dyeing and Printing lab-dip lists is ALWAYS blank |
| **BH-0203** | CONFIRMED | `frontend/src/pages/OrderDetail.tsx:991` | Work orders on the Order Detail page ALWAYS show 'Not Assigned' for location — even when a warehouse is assigned |
| **BH-0210** | CONFIRMED | `backend/src/services/invoice.service.ts:681` | Two payments recorded on the same invoice at once: one silently vanishes from the invoice balance |
| **BH-0211** | CONFIRMED | `backend/src/services/debitNote.service.ts:138` | The 'debit notes must not exceed the PO total' check runs OUTSIDE the transaction that inserts them |
| **BH-0212** | LIVE | `backend/src/services/creditNote.service.ts:331` | Credit/debit note approve, cancel and delete all check the status and then write without re-checking it |
| **BH-0217** | DORMANT | `backend/src/services/workOrder.service.ts:74` | Work-order numbers can silently duplicate — no unique constraint backs the generator |
| **BH-0218** | DORMANT | `backend/src/services/workOrder.service.ts:559` | Production tracking writes the audit row and the work-order status update as two unwrapped statements |
| **BH-0219** | CONFIRMED | `backend/src/services/workOrder.service.ts:479` | PUT /work-orders/:id accepts ANY status with zero transition validation — bypassing the blocking checks the tracking endpoint enforces |
| **BH-0224** | CONFIRMED | `backend/src/controllers/dyeing.controller.ts:1892` | You can receive MORE fabric back from the mill than you ever sent — and it becomes real stock |
| **BH-0225** | CONFIRMED | `frontend/src/pages/ProcessingBatchDetail.tsx:1` | The Processing Batch module is a shell — 'New Batch' 404s and the detail page is a hardcoded 'Loading…' stub that never loads anything |
| **BH-0231** | CONFIRMED | `frontend/src/pages/InvoiceDetail.tsx:207` | The Edit button on an invoice and on a quotation both 404 — so a draft can never be corrected |
| **BH-0232** | LIVE | `frontend/src/pages/JobWorkDashboard.tsx:10` | The Job Work Dashboard is a fake — it fakes a loading spinner, then displays hardcoded zeros forever |
| **BH-0233** | LIVE | `frontend/src/pages/StyleDetail.tsx:291` | Six more dead buttons scattered across the app (costing, CAD, import, transfer, warehouse view, inventory reports) |
| **BH-0240** | DORMANT | `backend/src/controllers/dispatch.controller.ts:115` | DORMANT: delivery-note and ASN numbers can silently duplicate — no unique constraint backs either |
| **BH-0241** | DORMANT | `backend/src/controllers/dispatch.controller.ts:382` | DORMANT: if marking the work orders SHIPPED fails, the dispatch still reports success |
| **BH-0248** | LIVE | `backend/src/services/orderProductionStatus.service.ts:184` | QC status on the Order Production Status page is permanently 'not done' — the table it reads is never written by anything |
| **BH-0249** | CONFIRMED | `backend/prisma/schema.prisma:1` | AQL is decorative, and four quality-control tables are pure vaporware with no code behind them at all |
| **BH-0250** | DORMANT | `backend/src/controllers/cutting.controller.ts:257` | Production-history writes fail silently across cutting, stitching and finishing — and the API still returns success |
| **BH-0255** | LIVE | `backend/src/schemas/auth.schema.ts:36` | Anyone registering can request the ADMIN role for themselves — bounded, but a social-engineering foothold |
| **BH-0256** | LIVE | `backend/src/app.ts:148` | Uploaded files are served to anyone with the URL, and /uploads reflects any Origin with credentials |
| **BH-0265** | DORMANT | `backend/src/services/report-generator.service.ts:82` | Three of the eight advertised report types are accepted by validation and then always fail |
| **BH-0266** | CONFIRMED | `backend/src/services/ai/erp-context.service.ts:310` | The AI assistant loads customer and supplier email + phone into its prompt with no redaction — safe today ONLY because the provider is local |
| **BH-0268** | LIVE | `frontend/src/pages/SupplierForm.tsx:163` | Saving a supplier nulls billingCity/PIN on its GST rows — real, but only 2 city values and 1 pincode exist in the whole system (I overstated this) |
| **BH-0273** | DORMANT | `frontend/src/pages/WorkOrderDetail.tsx:143` | DORMANT: the work order's 'Cut' progress is permanently 0, and a split run reports 'split into 0 child runs' |
| **BH-0279** | LIVE | `backend/src/controllers/label.controller.ts:549` | LATENT: eight more supplier tables sit behind the same `!== undefined` landmine — safe today only by luck |
| **BH-0282** | DORMANT | `backend/src/services/stockCount.service.ts:334` | DORMANT: approving a stock count applies its adjustments OUTSIDE the transaction, and the approval isn't guarded — a double-approve double-adjusts every material |
| **BH-0285** | DORMANT | `backend/src/services/agency.service.ts:187` | DORMANT: deleting an agency silently unassigns any customer attached directly to it |
| **BH-0290** | DORMANT | `backend/src/services/laceStock.service.ts:468` | DORMANT: lace allocation uses a strict float equality (=== 0) to decide when a lot is fully reserved |
| **BH-0297** | PLAUSIBLE | `backend/src/controllers/cad-planning.controller.ts:1` | AMBIGUOUS (reported honestly, NOT confirmed): 2 costing CADs have no size breakdown, so cadAverage was stored equal to the raw marker length |
| **BH-0299** | DORMANT | `backend/src/services/style-variant.service.ts:84` | DORMANT: size and colour options are minted by find-then-create with no unique constraint — a retried CSV import can split a style's SKUs across two ids |
| **BH-0303** | DORMANT | `frontend/src/pages/FabricAvailableStock.tsx:184` | DORMANT: the fabric stock KPI tiles sum only the FIRST PAGE of results — they will start undercounting the moment you have more than 20 lots |

## S4 — Latent + CLEAN BILLS  (57)

| ID | Status | File | Finding |
|---|---|---|---|
| **BH-0006** | CONFIRMED | `backend/src/services/fabric-stock.service.ts:213` | createGenericGreigeStock (dead but exported) creates fabric_stock with zero material-sync calls |
| **BH-0008** | CONFIRMED | `backend/src/services/fabric-stock.service.ts:186` | findFirst-then-create race for virtual RAW fabric_master (latent — method has no callers) |
| **BH-0013** | CONFIRMED | `backend/src/services/greige-stock.service.ts:651` | deleteGreigeStock never reverses stock_levels (latent — controller method not wired to any route) |
| **BH-0014** | CONFIRMED | `backend/src/services/greige-stock.service.ts:413` | reserveGreigeStock lost-update race (latent — zero callers repo-wide) |
| **BH-0017** | PLAUSIBLE | `backend/src/services/greige-stock.service.ts:846` | consumeFromProcessor check-then-write race (latent — zero callers) |
| **BH-0019** | LIVE | `backend/src/services/greige-stock.service.ts:651` | deleteGreigeStock TOCTOU + challan_items FK is ON DELETE SET NULL — code's guard intent contradicted by schema (latent) |
| **BH-0020** | PLAUSIBLE | `backend/src/services/greige-stock.service.ts:590` | updateAgingDays swallows write-loop errors AND has no callers — aging feature silently dead |
| **BH-0021** | LIVE | `backend/src/controllers/laceStock.controller.ts:63` | POST /api/lace-stock controller never forwards warehouseId — sync unscoped or silently skipped (endpoint unused by UI) |
| **BH-0022** | LIVE | `backend/src/services/laceStock.service.ts:462` | allocateStock TOCTOU: stale read outside $transaction, absolute write inside (no live callers) |
| **BH-0024** | CONFIRMED | `backend/src/services/laceStock.service.ts:166` | createLaceStock discards ensureMaterialRecord's returned id and syncs with raw laceId — breaks under bulkImportLace's mat-<code> id convention |
| **BH-0025** | CONFIRMED | `backend/src/services/laceStock.service.ts:101` | createLaceStock non-atomic without external tx (live Stock-In path IS transactional; only unused endpoints affected) |
| **BH-0028** | LIVE | `backend/src/services/laceStock.service.ts:423` | allocate/transfer/consume/return hardcode their own $transaction with no tx passthrough (composability defect) |
| **BH-0035** | CONFIRMED | `backend/src/services/thread-stock.service.ts:141` | createThreadStock: material-sync calls ignore data.tx (latent tx-escape) |
| **BH-0038** | CONFIRMED | `backend/src/services/trim-stock.service.ts:184` | createTrimStock material-sync calls never receive data.tx (latent split-transaction, same family as BH-0035) |
| **BH-0045** | CONFIRMED | `backend/src/schemas/stockLevel.schema.ts:18` | updateStockLevelSchema strips quantity/valuationRate — controller's quantity-adjustment logic is dead code (no UI caller today) |
| **BH-0053** | CONFIRMED | `backend/src/services/WeightedAverageCostService.ts:93` | calculateWeightedAverage uses unweighted _avg of per-lot costs (latent — zero callers) |
| **BH-0054** | CONFIRMED | `backend/src/services/WeightedAverageCostService.ts:230` | WAC consumeStock: read-JS-math-absolute-write, no tx (latent — zero callers) |
| **BH-0055** | CONFIRMED | `backend/src/services/WeightedAverageCostService.ts:362` | WAC recalculateAll folds CONSUMED/DAMAGED lots into WAC and updates per-row without a transaction (latent admin utility) |
| **BH-0056** | CONFIRMED | `backend/src/services/thread-stock.service.ts:142` | Unvalidated metersPerUnit sign can invert thread stock_levels sync direction (direct API only) |
| **BH-0057** | CONFIRMED | `backend/src/services/stockCount.service.ts:248` | countId in PUT /api/stock-counts/:countId/items/:itemId is validated but never used — URL/count mismatch accepted |
| **BH-0064** | CONFIRMED | `backend/src/controllers/fabric-processing.controller.ts:201` | Orphaned /api/processing endpoints: sendForProcessing never debits greige stock, receiveFinishedFabric never credits fabric stock (contradicting its own JSDoc), and receive has no status guard |
| **BH-0068** | LIVE | `backend/src/controllers/style-material-bom.controller.ts:708` | addMaterialToBOM is 100% non-functional — always 400s, never creates a BOM row |
| **BH-0076** | PLAUSIBLE | `backend/src/services/document-generator.service.ts:2790` | PO totals block would hide CGST+SGST on a PO that mixes tax types (isIgst = totalIgst>0 gate has no mixed branch) — latent |
| **BH-0106** | CONFIRMED | `backend/src/services/style.service.ts:1139` | Sending `trims` without `accessories` WIPES all packaging/label BOM rows (latent — the shipped UI always sends both) |
| **BH-0121** | LIVE | `backend/src/services/costSheetPOGeneration.service.ts:550` | getStockInfoForLace computes total as available+reserved (should be minus) and MOQ is never applied |
| **BH-0134** | PLAUSIBLE | `backend/src/services/stockMovement.service.ts:402` | No idempotency on referenceId — a retried stock-movement request double-applies the quantity change |
| **BH-0142** | CONFIRMED | `frontend/src/pages/StyleFormRedesigned.tsx:2920` | A price of zero can never be entered or saved — `parseFloat(x) || ''` blanks it |
| **BH-0153** | LIVE | `backend/src/controllers/styleCosting.controller.ts:120` | The saved subtotal has no lace term at all (latent behind BH-0149) |
| **BH-0168** | LIVE | `frontend/src/pages/OrderForm.tsx:82` | BOUNDED: the order form is strictly single-style, so BH-0098's 5x-overbuy fallback is NOT reachable from it |
| **BH-0204** | CONFIRMED | `frontend/src/pages/StyleList.tsx:323` | The Style List's Fabric column silently drops the finish type — the list endpoint never selects it |
| **BH-0213** | PLAUSIBLE | `backend/src/services/creditNote.service.ts:141` | Credit-note total check is inside a transaction, but READ COMMITTED still lets two concurrent notes jointly exceed the invoice |
| **BH-0220** | LIVE | `backend/src/services/workOrder.service.ts:1092` | The actual-CMT recalculation is not idempotent — running it twice inflates the cost, and again on every repeat |
| **BH-0293** | DORMANT | `backend/src/controllers/cad-embroidery.controller.ts:384` | DORMANT: getTotalFabricCad adds two marker LENGTHS as if they were per-piece figures |

**✅ Clean bills (verified CORRECT — do not spend time here):**

- **BH-CLEAN-01** — CLEAN: the PO create/update path is FREE of the schema-drift disease that killed cost sheets and cost-sheet PO generation
- **BH-CLEAN-02** — CLEAN: cutting (except fabric returns), stitching, finishing (except receive), dyeing, printing, work orders and embroidery are schema-sound
- **BH-CLEAN-03** — CLEAN: styles, order-BOM, fabric costing, lace costing and fabric/greige masters are all schema-sound
- **BH-CLEAN-04** — CLEAN: the GRN backend DOES reject negative quantities — no stock can be fabricated from the form
- **BH-CLEAN-05** — CLEAN: the GST arithmetic itself is sound — the tax bugs are all in reporting and atomicity, not in the math
- **BH-CLEAN-06** — CLEAN: four plausible challan/work-order bugs were investigated and KILLED — don't spend time on them
- **BH-CLEAN-07** — CLEAN: the processing guards that DO exist are sound, and two more orphaned endpoints were identified and set aside
- **BH-CLEAN-08** — CLEAN: the sidebar and nav config are 100% sound — every menu item points at a real route
- **BH-CLEAN-09** — CLEAN — and IMPORTANT: embroidery sendOut/cancelSendOut is EXEMPLARY. It is the model the broken code should copy
- **BH-CLEAN-10** — CLEAN: several plausible production-floor bugs were investigated and KILLED — and one anti-pattern is genuinely absent
- **BH-CLEAN-11** — CLEAN AND IMPORTANT: your AUTHENTICATION is genuinely solid — 1,198 of 1,205 routes require a valid token, and the 7 that don't are correctly public
- **BH-CLEAN-12** — CLEAN: the AI layer fails honestly, the generic importer is properly atomic, and the main dashboard summary has no double-counting
- **BH-CLEAN-13** — CLEAN: the silent-default bug class is CONTAINED — ~130 fallback sites traced, only 7 are real. And the main pipeline board does it RIGHT
- **BH-CLEAN-14** — CLEAN: 42 reversals and 47 delete-recreate sites audited — the vast majority are CORRECT. The two worst classes are bounded
- **BH-CLEAN-15** — CLEAN: 30 check-then-write sites audited — only 4 are dangerous. Most double-clicks are genuinely harmless
- **BH-CLEAN-16** — CLEAN: the master-data layer is largely SOUND — and it contains the reference implementation for the cascade fix
- **BH-CLEAN-17** — CLEAN: 132 delete handlers and 622 cascading FKs audited — only 7 are broken, and MOST deletes are safe soft-deletes
- **BH-CLEAN-18** — CLEAN: float precision is NOT a widespread problem here — the core stock ledger uses Decimal arithmetic correctly
- **BH-CLEAN-19** — CLEAN — and genuinely important: the CORE fabric-consumption formula is CORRECT, verified against all 149 live CAD rows
- **BH-CLEAN-20** — CLEAN: the forensic audit also CLEARED four predicted corruptions — they have not fired
- **BH-CLEAN-21** — CLEAN — and it VALIDATES the repair plan: greige_stock's per-lot ledger is internally PERFECT (61/61), so it is safe to rebuild stock_levels from it
- **BH-CLEAN-22** — CLEAN — and it EXONERATES your mandated helper: ensureMaterialRecord is SOUND. The corruption came from its caller, not from it
- **BH-CLEAN-23** — CLEAN — and it KILLED two of my own S1 claims: the stock pages do NOT double-count, and one page is admirably honest
- **BH-CLEAN-24** — THE CENTREPIECE SURVIVED ADVERSARIAL ATTACK — but my REPAIR PLAN would have destroyed data a SECOND time. Caught and fixed.
