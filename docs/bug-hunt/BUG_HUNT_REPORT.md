# Bug Hunt Report — garment-erp

> # 👉 **[READ START_HERE.md FIRST](START_HERE.md)**
> **This file is the 1,100-line detailed reference.** `START_HERE.md` is the whole thing in five minutes: the ordered fix plan, what's being destroyed today, and what to do this morning.
> Come here for the evidence behind any individual finding.

> ## ⚠️ CORRECTIONS — read before you act on anything below
>
> This report was written across 74 iterations. **I later attacked my own findings and found four of them overstated.** The sections below were written *before* those corrections. Where a claim here conflicts with `START_HERE.md` or `findings.jsonl`, **the correction wins.**
>
> | Claim you may read below | The truth |
> |---|---|
> | *"Saving a style destroys 1,442 SKU variants, every size, SKU code and barcode"* | **Overstated.** 1,442 rows span **241 styles, not 1,040**. **Zero barcodes** exist. Only **6** custom SKUs. ~99.6% regenerate identically. **S1 → S2.** |
> | *"Saving a supplier wipes 39 GST registrations"* | **Overstated ~19×.** Only **2** rows have a city, **1** a pincode. It **has never fired.** **S1 → S3.** |
> | *"`ensureMaterialRecord` creates duplicate materials rows"* | **Wrong.** That helper is **sound** (PK-protected). The fault is its **caller**, `fabric-stock.service.ts:196`. |
> | *"Duplicate greige stock lots the DB should have rejected"* | **Wrong.** Those are **legitimate separate rolls**. `greige_stock` is per-receipt. **Do not merge them.** |
>
> **The existence claims held at 100%** under a formal false-positive audit and adversarial re-verification. **My errors were consistently about blast radius** — inflating impact from table-wide row counts. Trust *what* is broken; verify *how much* against your own data.
>
> ⚠️ **`REPAIR_PLAN.md` also had three destructive flaws that I found and fixed.** Use the current version, and **dry-run it yourself before committing.**

Run: 2026-07-11 → 2026-07-16 · Autonomous (Fable orchestrator / Sonnet reviewers) · **READ-ONLY — no fixes applied**
Source of truth: `docs/bug-hunt/findings.jsonl` · Progress: `docs/bug-hunt/state.json` · Log: `docs/bug-hunt/iterations.log`

**Note on structure:** the sections below accumulated across 55 iterations in *discovery* order, not priority order. `START_HERE.md` is the priority-ordered view. Use `Ctrl+F` on a finding ID (e.g. `BH-0267`) to jump to its evidence.

## 🔴 Read this first — the live database confirms two features have never worked

I ran read-only counts against your actual database. The result independently confirms the two schema-drift bugs (BH-0149, BH-0165) and resolves the caveat I'd flagged on the second:

| Table | Rows |
|---|---|
| styles | **1,040** |
| suppliers | 82 |
| customers | 5 |
| challans | 23 |
| greige_stock / fabric_stock / stock_levels | 61 / 12 / 34 |
| purchase_orders | 1 |
| **orders** | **0** |
| **style_costing (cost sheets)** | **0** |
| goods_receiving_notes | 0 |

You have **1,040 styles** and a working stock/challan operation — but **zero orders and zero cost sheets**. Those are *exactly* the two features I proved broken by validation-schema mismatch, found independently by reading the code. This is not a coincidence; it's the fingerprint of two features that reject every save.

**So: nobody can create an order or a cost sheet, and nobody ever could.** The "success" message on the cost-sheet edit screen (BH-0149) is why this may have gone unnoticed — the app tells users it saved.

These two are the first things to fix, and they're the same root cause: **the route validates with a different schema than the controller parses with**, so the payload is stripped before it arrives. Your own CLAUDE.md documents this exact pitfall.

### It is not two features. Most of the transactional app cannot save.

A systematic audit of every mutation route (iteration 36, eight parallel agents) found the same defect **everywhere**. **Nearly all of the following were proved by *executing* the real schemas against the real payloads** — not by reading code:

| What's broken | What actually happens |
|---|---|
| **Orders** (BH-0165) | Create + edit both 400. **DB: 0 rows.** |
| **Cost sheets** (BH-0149) | Create 400s; **edit silently saves nothing and says "success"**. **DB: 0 rows.** |
| **Sale orders** (BH-0186) | Creation **100% broken** — the dialog always sends an empty items list the schema forbids. |
| **Invoices** (BH-0187) | Creation always 400s — **and even once fixed, no invoice line item could ever be created.** |
| **Quotations** (BH-0188) | Creation always 400s. |
| **Record Proof of Delivery** (BH-0189) | 400s on every use — deliveries can't be closed out. |
| **Embroidery send-out AND receive** (BH-0180) | **Both 400 on every request — the entire embroidery workflow is unusable.** |
| **Thread requirements** (BH-0169) | All four endpoints broken. **Edit returns "saved" and writes nothing.** |
| **Thread quantity conversion** (BH-0182) | 400s on every call. |
| **Lace defect logging** (BH-0183) | 400s on every call — the claims workflow can't start. |
| **"Receive from Stitching"** (BH-0176) | **400s on every click — the finishing stage is blocked.** |
| **Cutting "Complete Batch"** (BH-0177) | 400s whenever fabric is returned — **leftover fabric can never go back into stock.** |
| **Greige stock edit** (BH-0181) | Saves **only the quality grade** — cost, location and roll numbers silently discarded. |
| **Bulk PO generation** (BH-0170) | **The prices you type are silently discarded** — the PO is raised at a different price. |
| **"Calculate Services"** (BH-0171) | 400s every click — it reads a browser key the app never sets. |
| **Stock production orders** (BH-0184) | Create 400s; edit silently drops the quantity and the size breakdown. |
| **Credit notes** (BH-0190) | Permanently lose the link back to the invoice line they credit. |
| **"Approve CAD Plan"** (BH-0192) | **Always fails — and it's the gate into costing**, sitting directly upstream of the zero cost sheets. |
| **"Recalculate costing"** (BH-0193) | **Silently never runs — while the UI tells you it did.** |
| **CAD "Copy as Draft" / "Link to Stock"** (BH-0194) | Both 400 on every click. |
| **Cost-sheet PO gen, unified PO, fabric procurement** (BH-0114/0172/0173) | All broken. |

### ⚡ One fix unblocks several of these at a stroke (BH-0191)

Three independent audits converged on the same cross-cutting cause: **every schema field declared `z.string().datetime()` that is filled by an HTML `<input type="date">` is a guaranteed 400.** Date inputs emit `2026-07-11`; `.datetime()` demands a full timestamp and rejects it outright.

That single mismatch alone breaks **quotations, invoices, Record POD, service-PO generation, thread-requirement POs, lab dips and fabric procurement.** Replacing `.datetime()` with a coercing date schema across the schema files fixes all of them in one change.

### 🔑 The root cause — and it's fixable in an afternoon (BH-0175)

**You already own a tool built to catch exactly this.** `scripts/hooks/check-schema-controller-alignment.js` exists precisely to detect schema-vs-controller drift. It failed for two specific, fixable reasons:

1. **It's blind to the pattern your code actually uses.** It only recognises `const { a, b } = req.body`. It has **no pattern for `SomeSchema.parse(req.body)`** — which is how every one of the affected controllers reads the body. It literally prints a hint that the controller "uses internal validation", and then declines to look inside.
2. **It was deliberately disconnected from the commit gate.** `scripts/hooks/pre-commit.js:257` contains:
   ```js
   // TODO: Add schemaAlignmentPassed to allPassed once legacy mismatches are fixed
   ```
   So even if it *had* seen the drift, it could never have blocked the commit.

A sibling tool (`check-schema-field-sync.js`) is gated behind a 12-entry allowlist that excludes every affected entity — and is never invoked by anything at all.

**Recommended fix (in priority order):**
1. **Global date fix (BH-0191)** — replace `z.string().datetime()` with a coercing date schema wherever a date-picker feeds it. Biggest win per line changed; unblocks quotations, invoices, POD, service POs and more at once.
2. **Teach the hook one more regex** — `(\w+Schema)\.(?:parse|safeParse)\(\s*req\.body` — and pull that schema's fields as the controller's requirements.
3. **Delete the `TODO` carve-out at pre-commit.js:257** so a critical mismatch actually blocks the commit. *It will immediately go red across the app — that's the point; it's the map of what to fix.*
4. Fix the headline schemas one by one, aligning each with what the form actually sends. Then verify: `SELECT COUNT(*) FROM orders;` and `FROM style_costing;` should move off zero after a manual test create.

**A note on what this means for the rest of this report.** Many of the money bugs I documented in MRP, BOM and costing (wrong shrinkage formula, double-buying, unit mismatches) sit *downstream* of these broken screens. With zero orders and zero cost sheets in the database, most of them **have not yet had the chance to cost you anything** — they are landmines, not active fires. Fix the schema layer first, and fix those money bugs *before* the data starts flowing through them.

The deeper lesson: **7 controllers define a second, competing copy of their Zod schema and re-parse the body after the route already validated it.** Two sources of truth, drifting apart. That duplication is the disease; the stripped fields are the symptom.

**Two of these are one-word fixes.** Cutting's fabric return is broken because the schema says `returnQuantity` while the frontend *and the controller* both say `returned`Quantity — a single letter, and leftover fabric can't go back into stock. That's the flavour of most of these.

**✅ Bounded — it is not everywhere.** I explicitly verified these as **schema-sound**, so you don't waste time on them: **styles, order-BOM, fabric costing, lace costing, greige/fabric masters, stitching, dyeing, printing, work orders, purchase orders**, and all of cutting/finishing except the two actions named above. Your master-data and BOM layers are fine. The damage is concentrated in the *transactional* layer.

**⚠️ One thing to fix even though it isn't broken yet:** the order-BOM controller re-validates with its **own duplicated copy** of the schema instead of importing the shared one. It's identical today — but that is precisely the two-sources-of-truth pattern that caused the cost-sheet outage. Consolidate it before it drifts.

## 💥 TWO MORE SILENT DATA-LOSS BUGS — on tables that have real data right now

Both verified by me at source. Both destroy data on an ordinary save, with a success toast.

### Editing a style DESTROYS its SKU variants (BH-0267) — you have 1,040 styles

The style edit form reads `styleData.variants`. But `serializer.ts:239` declares `styleVariants: 'styleVariants'` — an **identity mapping**. The response key is `styleVariants`. There is no `variants` key, ever. So the read is always `undefined`, and `|| []` quietly turns that into an empty list.

Two consequences, and the second is the killer:
1. Open any style to edit it and the **SKU Variants tab appears empty**. *(Correction: there are ZERO barcodes in the table, and the form regenerates the standard sizes on save — so ~99.6% of rows come back identical. See the retraction above.)*
2. **Save the style — for any reason, even a typo in the name — and that empty array is submitted, deleting the real `style_variants` rows.**

This is your single most valuable table, and every edit is a coin-flip on the SKU/barcode data. The same bug sits in two places: the main edit page and the shared `useStyleFormData` hook.

### Editing any supplier WIPES the city and PIN from every GST registration (BH-0268) — you have 82 suppliers

`SupplierForm` **hardcodes** `billingCityId: ''` and `billingPincode: ''` when it loads an existing supplier, instead of reading what the API returned. On save, `updateSupplier` deletes all `supplier_gst_numbers` rows and recreates them from the form — so the blanks overwrite the real values. Open a supplier to change its **phone number**, save, and Mumbai / 400001 are gone.

**The proof it's a bug, not a design choice:** `CustomerForm.tsx` uses the *same* `GSTNumberInput` component for the *same* shape and hydrates it correctly at line 370. The supplier side simply was never finished. GST billing city and PIN feed your tax documents.

### And one that quietly costs money (BH-0269)

`serializer.ts:320` maps `laceSuppliers → suppliers`. Three places read `laceSuppliers`, so all three get `undefined`. Two are cosmetic (Lace Detail always says "Suppliers (0)"; the Lace list column shows "-"). **The third prices your stock:**

```ts
const lacePrice = lace.laceSuppliers?.find(s => s.isPreferred)?.pricePerMeter
                  || lace.costPerMeterGreige;
```
The preferred-supplier lookup is always undefined, so **Stock IN silently books lace at the raw greige cost** instead of the finished-lace price — systematically **under-valuing your lace stock**, confidently, with no error. The backend controller even carries a comment saying the serializer will rename this field. The backend knew; the frontend never got the message.

### ✅ But this class is CONTAINED — that's the important bounding result (BH-CLEAN-13)

Four parallel tracers plus my own greps checked **~130 fallback sites (`?? 0`, `|| []`) across 60+ files**, tracing each to the controller's actual `res.json` keys. **Only 7 are real mismatches.** The overwhelming majority are legitimate optional-field handling. This is *not* a systemic epidemic like the schema drift — it's a handful of specific wrong-key reads.

**And your own code shows the right pattern:** `Dashboard.tsx` (the main pipeline board) passes `undefined` through to a loading-aware card rather than defaulting to 0. That's the fix for this entire class — **distinguish "no data yet" from "zero."** Every bug here comes from collapsing those two into a confident 0.

## 📉 Your dashboards show zeros and invented growth — and that's worse than showing an error

I verified this myself at both ends. **All four role dashboards are structurally broken (BH-0257).**

The backend returns a flat object — `res.json({ data: { monthlyCollections, totalReceivables, totalPayables } })`. Every dashboard reads `dashboardData?.stats?.X ?? 0`. **There is no `stats` key in the response.** So every tile falls back to zero — *including the values the backend correctly calculated and sent*.

| Dashboard | What's permanently zero/empty |
|---|---|
| **Accounts** | Outstanding Invoices, Overdue Amount, GST Payable, Monthly Collections, all four aging buckets, Recent Invoices |
| **Sales** | Active Orders, Monthly Revenue, Recent Orders, Pending Quotations |
| **Production** | Cutting / Stitching / Finishing queues, active work orders — *the backend computes these correctly and they never arrive* |
| **General** (default for every role) | Total Orders, Active Work Orders, Active Customers — never computed at all, sitting next to tiles that *are* real |

**And then it invents the trend (BH-0258).** Every dashboard glues a hardcoded growth badge onto its tiles — `trend={{ value: 12, direction: 'up', label: 'vs last month' }}` is a **literal in the JSX**. No period-over-period comparison exists anywhere in the codebase. Several tiles are fabricated end to end: *Production Efficiency = "87%"*, *Conversion Rate = "68%"*, *Collection Rate = "78%"*, *Avg. Payment Days = "32"*.

So your Accounts dashboard displays **₹0 outstanding** with a confident green **"+8% vs last month"** beside it.

**This is why it's S1, not cosmetic.** A dashboard that *errors* makes you distrust it. A dashboard that calmly reports ₹0 receivables makes you **stop chasing money that is genuinely owed**. The fix for BH-0257 is one line per endpoint.

**The irony:** the AI layer — the one place you'd expect hand-waving — is scrupulously honest. It returns a proper 503 when it can't answer and never fabricates a result (BH-CLEAN-12). The dashboards invent both the number *and* its growth rate.

Two more that will bite once the zeros are fixed: **Monthly Revenue filters on when the invoice was *created*, not when it was *paid*** (BH-0259) — so an invoice raised in June and paid in July never appears in *either* month's revenue. And **GSTR-3B claims Input Tax Credit from purchase-order status, not from goods actually received** (BH-0260) — a PO merely *emailed* to a supplier already counts. Paired with BH-0208 (GSTR-1 dropping overdue invoices), your two GST returns are wrong in *opposite* directions on the same filing.

## 📥 Two S1s in the style importer — the path into your most valuable table

You have **1,040 styles**. Both bugs are on the road in.

**Bulk import merges two customers' styles into one (BH-0261).** Rows are grouped by `styleCode` *alone* — no customer scoping. Two different buyers reusing code `COS009` (routine — buyers each have their own numbering) get silently merged: the style is built from the first row's customer, and the second customer's variants are attached to it. No error. The lookup has no `customerId`, and `styleCode` has no unique constraint, so nothing stops it.

**The CSV parser splits on every comma (BH-0262).** It's `lines[i].split(',')` with no quote awareness. A style named `"Kurta Set, Blue With Piping"` gets cut at the internal comma, and **every subsequent column shifts**. Because styleName is optional, no validation fires — the row imports "successfully" with silently wrong data. Any quoted field containing a comma corrupts its row. Swapping in a real CSV parser is a five-minute change.

## 🔐 SECURITY — do this today: your JWT signing key is in git (BH-0251)

I verified this myself rather than taking the agent's word, and I never printed the values.

`git ls-files` shows **`backend/.env` is tracked** — along with `.env`, `backend/.env.local`, `frontend/.env`, and a `.env.backup.*`. The committed `backend/.env` contains a **populated `JWT_SECRET` (65 chars) and `DATABASE_URL` (59 chars, with the DB password)**. Your `.gitignore` *does* list `.env` — but `.gitignore` has no effect on files already tracked. The rule was added too late and nobody untracked the files.

**Calibrating this honestly, because it matters:** the repo is **PRIVATE** (verified), so this is *not* an internet-exposed leak, and I'm not going to alarm you as though it were. Also, I initially misread the `AI_API_KEY` as exposed — it's a **2-character placeholder**, not a real key. No billable credential is out.

What genuinely stands: **the JWT secret is the key that proves a token is real.** Anyone who has ever had read access to this repo — a former collaborator, anyone who cloned it, any CI tool you granted access — holds it permanently and could mint a valid token for any user, including ADMIN. And because it lives in git *history*, changing it on the server doesn't remove it.

**Do this in order:**
1. **Rotate the JWT secret and the DB password now.** This is the step that actually protects you — it makes the committed values worthless.
2. `git rm --cached backend/.env .env backend/.env.local frontend/.env backend/.env.backup.*` and commit, so they stop being tracked.
3. Only *then* consider rewriting history (BFG / git-filter-repo), and only if the repo has been shared beyond people you'd trust with the credentials anyway.

**And a one-line fix while you're there (BH-0252):**
```ts
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
```
If `JWT_SECRET` is ever unset — a fresh clone, CI, a container missing the var — the server *silently* signs every token with that well-known placeholder, and anyone who knows it can forge an ADMIN token. Replace it with a startup check that **throws**. A server that refuses to boot beats one that boots with a public key.

### ✅ But the front door is locked — and that's the bigger news (BH-CLEAN-11)

A script checked **all 1,205 route registrations across 127 route files**. Exactly **7 are reachable without a token, and all 7 should be**: login and register (both rate-limited), four health checks, and an AI-status ping that returns no ERP data. **There is no unauthenticated data access or mutation anywhere in the API.** Passwords use bcrypt(10) consistently, no endpoint leaks a password hash, CORS is a real whitelist, helmet/CSP/HSTS are configured, and production errors don't leak stack traces. The app is single-tenant by design, so there's no cross-tenant IDOR to worry about.

**So the problem isn't an open door — it's the key being in git, plus missing role checks inside the building.**

### ⚠️ Missing role checks on approvals and pricing (BH-0254)

Authentication is enforced everywhere; **authorization barely exists** — only 18 of 127 route files call `authorize()` at all. So **any authenticated employee, of any role, can:**

| Action | The route's own comment says |
|---|---|
| **Approve/reject a GRN** | `@access Private (QC, ADMIN)` — but no check exists |
| **Approve, cancel or delete a credit/debit note** | *(financial documents that adjust customer balances)* |
| **Create, send, cancel or delete a purchase order** | `@access Private (PURCHASE, ADMIN)` — but no check exists |
| **Change processor rate cards** | *(the rates that feed every cost sheet and PO price)* |

The doc comments are a map of the intent; the code never implemented it. The telling detail: `purchaseOrder.routes.ts` *does* call `authorize(...)` on its `/stats` route, and `unified-po.routes.ts` enforces it properly — **the pattern exists and is used elsewhere.** It was simply never applied to the mutations and approvals. Add `authorize(...)` using the roles the comments already name.

## ⚠️ The one bug to fix before you touch anything else (BH-0214)

Everything else in this report is either dormant (the feature can't save, so nothing flows through it) or already broken. **This one is a loaded gun in the module you actually use.**

**Cancelling an issued challan never returns the stock.**

`issueChallan` does real work: it deducts `fabric_stock.quantityAvailable`, increments `quantityConsumed`, syncs `stock_levels`, and flips `fabric_processing` to SENT. `cancelChallan` is four lines that flip a status field — **no stock re-credit, no reversal, no transaction, no status guard**:

```ts
export async function cancelChallan(id: string) {
  return prisma.challans.update({ where: { id }, data: { status: 'CANCELLED' } });
}
```

Issue a challan for 50 m, the truck doesn't leave, hit Cancel. The challan reads CANCELLED — implying nothing happened — but the fabric is *still* marked consumed. Those 50 m are physically on your shelf and invisible to the system, permanently, with no error and no audit trail pointing at the cause.

**Why this is the urgent one:** your live database has **22 ISSUED challans and 0 cancelled ones.** So it has *not fired yet* — but the Cancel button is rendered and enabled on every one of those 22 (`canCancel = !['RECEIVED','CANCELLED'].includes(status)`). The next person who clicks Cancel on an issued challan silently corrupts your stock.

**Interim mitigation (do this today):** hide or disable the Cancel button for any challan past DRAFT.
**Real fix:** make `cancelChallan` reverse exactly what `issueChallan` did, inside one `$transaction`, and guard the transition with `where: { id, status: { in: [...] } }`.

## 🧨 The second epidemic: the serializer silently renames keys, and your compiler cannot see it

Schema drift breaks *saving*. There is a second, independent class that breaks *reading* — and it is the more insidious of the two, because **TypeScript provably cannot detect it** (BH-0205).

Why the compiler is useless here: where the frontend code **and** its local type are *both* wrong, they agree with each other, so `tsc` reports nothing. It only complains when the code is **correct** and a stale type disagrees. In BH-0201 the compiler flags the one *correct* line and stays silent on the three broken ones. That is why 46 of your 50 "property does not exist" errors are noise — and why the real bugs aren't in that list at all.

I stopped trusting inference and **executed the real `serializer.ts`** against sample payloads. Two findings came out of that, and one is the most dangerous single bug in this report:

### 🔴 BH-0207 — Saving any fabric silently DELETES all of its supplier links

Open a fabric, change the *name*, hit Save — and every supplier association for that fabric is destroyed. Success toast, no warning. 100% reproduction, no concurrency needed.

The chain: the serializer maps `suppliers` → `supplier` **by key name, arrays included**. So `fabric.suppliers` is `undefined`, the form loads with zero suppliers, and on save it sends `suppliers: []`. The Zod schema allows an empty array, and the controller guards on `!== undefined` — *not* on `.length` — so it runs `deleteMany({ fabricId })` and then creates nothing.

**Proof it's real and already known-shaped:** `GreigeForm.tsx:122` reads the *singular* `greige.supplier` for the structurally identical junction. Someone already hit this remap on the greige side and worked around it. The fabric side was never fixed.
**Fix:** read `fabric.supplier` in FabricForm; and change the controller guard to `if (suppliers?.length)` so an empty array can never mean "delete everything."

### BH-0206 — Every record-count badge in the app is blank or shows zero

`serializer.ts` runs `humps.camelizeKeys` with a `process` hook that spares **only UUID keys**. Nothing exempts underscore-prefixed keys — and `humps.camelize('_count') === 'count'`. So Prisma's `_count` aggregate arrives at the frontend as `count`, and **every** `._count` read is `undefined`. Verified by executing the real serializer: `{_count:{customers:3}}` comes out as `{count:{customer:3}}`.

18 read-sites across 10 pages:
- **Shows a hard `0`** (actively wrong data): Agent List, Agency List, Component Group Master, Greige List, Sale Order List, Stock Production Order List.
- **Renders nothing at all** (the whole Stats column vanishes): Customer List, Customer Detail, Supplier List, Supplier Detail.

**Why this is worse than cosmetic:** a supplier with 12 open POs displays a blank or zero linkage count — and that count is exactly the signal someone would trust before deciding a master record is safe to deactivate.
**Fix (one line, fixes all 18 sites and prevents recurrence):** in the `process` hook, return the key untouched when it starts with `_`.

## 🏭 The production floor: three stages, and not one of them checks a quantity

Cutting → Stitching → Finishing. I reviewed all three service layers. **Every one of them is dormant** (the live DB has 0 cutting batches, 0 stitching issues, 0 finishing issues, 0 transfer slips — all downstream of the orders feature that can't save). But they're loaded and pointed at your fabric, which *is* real: `fabric_stock` has 12 rows.

**The one that will bite first (BH-0242).** The very first cutting batch anyone creates will deduct **the entire fabric lot**, not the amount needed. `createCuttingBatch` sums a field called `cutQuantity` — which nothing sends. The frontend sends `plannedQty`. So the total is always 0, the `totalPieces > 0` branch never runs, and the code falls through to a silent default: issue `stock.quantityAvailable` — everything. A roll with 850 m available, for a batch needing 250 m, issues all 850 m. **It fires on every single batch creation, from the first one.**

**And that fabric can never come back (BH-0243).** This is the *fourth* instance of the reverse-without-reversing pattern. Delete's restore logic reads `fabricIssued || fabricConsumed` — but under delete's own preconditions (no lays yet) both are always null, so it always restores **zero**. And `cancelCuttingBatch` is a byte-for-byte copy of `holdCuttingBatch`: it sets the status to `ON_HOLD` and writes the word "CANCELLED" into a *remarks string*. There is no CANCELLED state — the enum only has PENDING/IN_PROGRESS/COMPLETED/ON_HOLD. So a "cancelled" batch is indistinguishable from a held one, can be silently resumed, and its fabric is locked away permanently.

**Nothing bounds any quantity (BH-0245).** Not one of the three stages compares what you record against what was issued. Cut 150 pieces against a lay capped at 100 — accepted. Record 150 good pieces against 100 issued to stitching — accepted, and the inflated number flows downstream. Finishing is worse: its own "Remaining" figure ignores prior defects, so after 70 good + 20 defect on 100 issued, the page cheerfully invites you to enter 30 more. The only guards are cosmetic `max=` attributes on React inputs.

**The receive steps are rubber stamps (BH-0246).** `receiveFromCutting` destructures `skuReceived` — with shortage and excess quantities — and then **never reads it again**. It just flips a status. So if cutting sends 500 pieces and stitching receives 480, the 20 missing pieces are invisible. The one point in the chain where you'd catch loss or miscounting does nothing.

**And in Finishing, one extra click doubles your stock (BH-0244).** `generateTransferSlip`'s only guard is "status must be COMPLETED" — and it never changes the status, so the guard passes forever. The button is never disabled after success. Click it twice on a 500-piece run and you get two real dispatch slips and 1,000 units of finished-goods stock. (Tellingly, `reopenStitchingIssue` *does* check for an existing slip — the codebase knows the guard; it was just omitted here.)

**Also worth knowing:** QC is not implemented. **AQL is decorative** — a repo-wide grep finds the letters "AQL" in an enum value and one UI string, with no sample-size table and no accept/reject computation anywhere (BH-0249). Four `quality_*` Prisma models have **zero code references at all**. And the QC indicators on the Order Production Status page read a table that **nothing ever writes** (BH-0248) — so they will show "not done" forever, confidently and wrongly.

### 🔍 A correction I made to my own reviewer

The subagent marked most of the above **LIVE**. I checked the database myself and **downgraded them all to DORMANT** — cutting, stitching, finishing and tracking are all at 0 rows. It had reasoned "the route is registered and the page exists, therefore it's live"; the data says the production floor has never run. The bugs are real and deterministic, but they are **landmines, not active fires**. I'd rather tell you that accurately than inflate the severity.

## 🎯 You already have the correct code in your own repo — copy it (BH-CLEAN-09)

The single most useful thing I found. The two worst bug shapes in this report both have a **correct reference implementation already sitting in your codebase**, written by your own team:

`embroidery-stock.service.ts` → **`cancelSendOut()`** does the thing `cancelChallan` (BH-0214) and `deleteDeliveryNote` (BH-0236) fail to do: it **reverses the stock** with an atomic `{ increment }`, inside a `$transaction`, gated to the correct status.

`embroidery-stock.service.ts` → **`sendOut()`** does the thing `receive()` (BH-0237) and `createDeliveryNote` (BH-0239) fail to do: it **bound-checks the quantity** before moving it, uses atomic `{ decrement }` instead of read-then-absolute-write, and correctly calls `ensureMaterialRecord` + `syncStockLevelQuantity` per the rule in your own CLAUDE.md.

**So this isn't a knowledge problem — it's an inconsistency problem.** Point the fix pass at `cancelSendOut` and `sendOut` as the in-repo reference, rather than inventing a new pattern.

A structural note that explains a lot: **there is no dispatch service file at all.** Every bit of delivery-note/ASN/POD logic lives directly in `dispatch.controller.ts` — which is precisely why its stock handling never picked up the helpers the service layer uses.

## 💀 The Samples module cannot work, and mathematically never could (BH-0234)

I proved this by executing the real Zod schema. It isn't an ordinary field mismatch — it's **unsatisfiable**:

- Zod accepts `sampleType` ∈ [DEVELOPMENT, FIT, PRE_PRODUCTION, PRODUCTION, PHOTO_SHOOT]
- The database enum is [FIT_SAMPLE, PHOTO_SAMPLE, PRODUCTION_SAMPLE, PP_SAMPLE, SIZE_SET_SAMPLE, SHIPMENT_SAMPLE]

**The intersection is empty.** No string exists that satisfies both — anything Zod accepts, Prisma rejects. `POST /api/samples` cannot succeed for *any* input, ever. Executing the form's own default (`FIT_SAMPLE`) returns a 400. And the live database agrees: **`samples` = 0 rows.**

Status changes are broken the same way (BH-0235): of the five real statuses, **four return 400** — including `APPROVED_WITH_COMMENTS`, which the frontend explicitly sends. Only `APPROVED` passes. So even after you fix creation, the submit → feedback → revise loop that *is* the point of sampling stays dead.

Sample tracking is a core garment-industry workflow, and it has never recorded a single row.

## 🚪 A third pattern, and it's the biggest one: whole modules with no way in

Schema drift breaks *saving*. The serializer breaks *reading*. This one is different: **finished, working backend code that no user can reach, because the frontend page was never built or its route was never registered.**

I found one instance by accident, then swept the entire app with a script: **244 registered routes vs 822 navigation targets.** The result is 16 clusters of dead buttons. I verified the top eight myself by grepping `App.tsx` directly — the routes genuinely do not exist. Clicking these lands the user on the 404 page.

| Module | What's dead | Backend? |
|---|---|---|
| **Stock Counts** (BH-0226) | View, row-click, **and the auto-redirect after creating one**. You can create a count, then never open it. | ✅ **Complete** — start / verify / approve / cancel / variance all built, all uncalled |
| **Dispatch: ASNs + Delivery Notes** (BH-0227) | *New ASN*, *New Delivery Note*, both View icons, *Create DN from ASN*. **You cannot ship anything.** | ✅ **Complete** — full CRUD + approve/reject |
| **Testing: FPT, GPT, Labs, Templates** (BH-0228) | Every New / View / Edit across all four pages. Only empty lists render. | ✅ for GPT/Labs/Templates · ❌ **FPT has no backend at all** |
| **Dyeing + Printing Lab Dips** (BH-0229) | New / View / Edit — a *second* dead cluster on those pages | ✅ Complete, incl. approve/reject |
| **Dyeing + Printing Process POs** (BH-0221) | New / QC / Return Unprocessed | ✅ Complete |
| **Chart of Accounts** (BH-0230) | *New Account* and *Edit*. The accounting backbone is **read-only**. | ✅ Complete |
| **Credit Notes** (BH-0230) | Row-click and View — **no credit note can ever be opened** | ✅ Complete |
| **Invoice / Quotation edit** (BH-0231) | The *Edit* button on a draft. A mistake can't be corrected — only deleted and re-keyed. | ✅ Complete |
| **Processing Batches** (BH-0225) | *New Batch* 404s; detail page is a permanent `Loading…` stub | Partly |

**The database confirms it.** `job_work_orders` = 0. `fabric_processing` = 0. Not a coincidence — it's the fingerprint of a feature nobody can reach, the same signature as the zero orders and zero cost sheets.

**Worse than a 404, because it lies:** the **Job Work Dashboard** (BH-0232) is a registered, sidebar-reachable page whose entire body is theatre — a `setTimeout` fakes a loading spinner, then it renders **hardcoded zeros**: *Active Batches: 0, Quantity In Process: 0, Total Cost: ₹0*. No API call of any kind. It will show zeros forever regardless of what's happening in your business, and a manager glancing at it would conclude there's no job-work in progress. The backend endpoint built for exactly this page (`GET /processing-batches/summary/job-work`) is called by nothing.

**✅ The good news, and it's real.** The **sidebar and nav config are 100% sound** — every menu item resolves to a registered route (BH-CLEAN-08). Nobody gets lost from the main menu. The app's *skeleton* is fine; it's the leaf CRUD pages that were never finished. And because the hard, tested half — the backend — is already built for nearly all of these, **wiring up the missing pages is the cheapest large feature-recovery available to you.**

**One trap to avoid:** fix BH-0222 *in the same pass* as the Process PO screen. Sending fabric out for re-processing never deducts it from stock (only the greige path is handled), so the day you build that screen, an S1 goes live and the same lot can be sold twice while it sits at the mill.

## 📋 What to do, in order

196 findings is too many to act on as a list. Here is the actual sequence, ordered by *value per hour of developer time*. Everything in Stage 1 is a small, mechanical change.

### Stage 1 — Make the app able to save at all (a day's work, unblocks ~20 features)

| # | Do this | Unblocks |
|---|---|---|
| 1 | **Global date fix (BH-0191).** Replace `z.string().datetime()` with a coercing date schema everywhere a date-picker feeds it. | Quotations, invoices, Record POD, service POs, thread-requirement POs, lab dips, fabric procurement — *in one change* |
| 2 | **Fix the ~15 mismatched schemas** so each declares what its form actually sends. Each is a few lines. Start with: orders, cost sheets, sale orders, invoices, embroidery send/receive, "Approve CAD Plan", "Receive from Stitching", cutting fabric returns. | Orders, cost sheets, sale orders, invoices, embroidery, finishing, cutting returns |
| 3 | **Re-arm your own guard.** Teach `check-schema-controller-alignment.js` the regex `(\w+Schema)\.(?:parse\|safeParse)\(\s*req\.body`, then delete the `// TODO` carve-out at `pre-commit.js:257`. | Stops this whole class recurring. **It will go red immediately — that red list is your to-do list.** |
| 4 | **Verify:** `SELECT COUNT(*) FROM orders;` and `FROM style_costing;` should move off zero after one manual test create. | Proof it worked |

### Stage 2 — Fix the money bugs *before* data starts flowing (do this BEFORE Stage 1 goes live)

These are wrong-number bugs. They're currently dormant *only because* nothing can save. The moment Stage 1 lands, they start costing real money:

| Fix | Why it matters |
|---|---|
| **Shrinkage formula** (BH-0145) — it's `÷(1−s)`, not `×(1+s)` | Every fabric costed with shrinkage is **under-priced**; the same page already does it correctly for quantities |
| **MRP greige shrinkage** (BH-0078, BH-0116) — same maths, two more places | You'd **under-buy greige** on every processed-fabric order |
| **Service-PO unit mismatch** (BH-0126) — per-metre rate × piece count | Wrong amount committed to the job-worker |
| **Rate-slab boundaries** (BH-0122) — a 500 m job matches two slabs | The same job bills ₹30,000 or ₹32,500 **at random** |
| **Trims marked "Not Applicable" are still bought** (BH-0093) | You buy 2,040 zippers you explicitly excluded |
| **Amount-in-words ≠ printed total** (BH-0070) | Every invoice contradicts itself; the words are the legally controlling figure in India |
| **GSTR-1 drops every overdue invoice** (BH-0208) | Your filed GST return **under-reports turnover and tax** — and GSTR-3B *includes* those same invoices, so the two returns can't reconcile. This is the classic mismatch that draws a departmental notice. One-line fix: delete the status filter. |
| **Payment recording isn't atomic** (BH-0209) | A crash mid-way leaves the payment recorded but the invoice still marked unpaid — collections chases a customer who already paid |

✅ **Good news, and it bounds the work:** I sent a reviewer specifically to find errors in the **GST arithmetic** and it found **none** (BH-CLEAN-05). Rates are applied as `rate/100`, CGST/SGST split correctly, rounding is per-line and *consistent across all four callers* (invoice, credit note, debit note, PO), and the interstate test is right in both directions. Invoice numbering is protected by a DB `@unique`, which kills the duplicate-number race outright. **You do not need to re-audit the tax maths** — fix the GSTR-1 filter and the payment atomicity, and the money layer is in good shape.

### Stage 3 — Guards against silent corruption (a day)

Add the missing status/version guards: double-clicking Approve on a GRN creates the stock **twice** (BH-0107); re-running MRP re-orders material already on a PO (BH-0079/0094); two people editing a style silently overwrite each other (BH-0101/0140). The recurring shape is *check the status, then write unconditionally* — fix it by making the write conditional (`where: { id, status: 'X' }`).

### Stage 4 — The stock-sync layer

Warehouse transfers and issues never touch the specialized stock tables (BH-0130), stock adjustments never recompute value (BH-0131), and the sync helper swallows its own errors (BH-0009). **The cheapest first step:** make the stock-in form display the server's own reply (BH-0164) — it already returns *"Received X. Remaining at processor: Y"* — and two silent S1 bugs become visible immediately.

---

## Executive Summary

*(Counts computed from `findings.jsonl`, the source of truth — **305 findings** as of iteration 54. 290 CONFIRMED, 15 PLAUSIBLE.)*

| Severity | Count |
|---|---|
| S1 — data / money corruption / **security** | **78** |
| S2 — wrong results / unvalidated writes | **106** |
| S3 — user-visible errors / staleness | **71** |
| S4 — latent (dead code, dormant landmines) | **50** |

*(Two findings were downgraded S2→S3 by my own false-positive audit — see below.)*

### 💰 Your "weighted average cost" isn't weighted (BH-0288)

Stock valuation computes the existing average with Prisma's `_avg` — **a plain arithmetic mean of each lot's cost, ignoring how much is in each lot.**

Hold **1,000 m at ₹100/m** and **1 m at ₹500/m**. The true weighted average is **₹100.40**. This code returns **₹300** — three times the real cost. Every stock valuation, COGS figure and margin derived from it is wrong, and the error is worst exactly when it matters: one small expensive odd lot drags the valuation of a large cheap holding up with it.

**And the correct function is already in the same class** — `calculateWeightedAverageCost(transactions: { quantity, unitCost }[])`, ten lines up. It just isn't the one being called.

### 🧮 On floating-point precision: I checked, and it's *mostly fine* — don't over-react

I swept the ~500 `Decimal`→float conversions expecting carnage. **Only three real bugs exist** (BH-CLEAN-18), and all three share one narrow mechanism: **a status is decided from an unrounded float, and only afterwards does the database round the value.**

The sharpest is BH-0289. Consume a greige lot in three issues and the float residue is `+2.8e-14` — not zero. So `<= 0` is false, the status stays **AVAILABLE**, and the quantity is *then* rounded to **0.00** on write. You get a self-contradictory row — **0.00 metres, status AVAILABLE** — and because the availability query has no `quantity > 0` filter, that **phantom lot shows as usable stock forever.**

It hasn't fired yet for a lovely reason: every quantity booked so far happens to be a **multiple of 0.25**, which is exactly representable in binary. It fires the first time someone books an ordinary value like 66.3.

**The reassuring half:** `stockLevel.service.ts` — your central stock ledger — uses **Prisma Decimal arithmetic end to end** and is genuinely safe. **Do not undertake a codebase-wide Decimal migration.** Fix the three status comparisons and this class is closed.

### 🔬 How much should you trust this report? I audited it. Here's the honest answer.

You're about to spend real time on 279 "confirmed" findings, so I ran a **false-positive audit on my own work**. I sampled 12 S1/S2 findings from the **earliest iterations** — the ones written before I tightened my verification discipline, and therefore the most likely to be wrong — and gave them to a hostile skeptic whose only instruction was to **destroy** them.

**Result: 0 outright false positives.** All 12 cited files and lines were real, and every core technical claim held up under adversarial re-reading — including six where the skeptic actively hunted for a compensating `$transaction`, a Zod bound, or a DB constraint and confirmed there was genuinely none.

**But it caught me twice on severity**, and this is the part you should act on:

| Finding | Was | Now | Why |
|---|---|---|---|
| BH-0032 | S2 | **S3** | I claimed a missing validation would "mis-bucket downstream unit conversions." It won't — `thread_stock.unit` is **never used in arithmetic**, only stored and displayed. The gap is real; the consequence I extrapolated is not. |
| BH-0061 | S2 | **S3** | I described an active 404 in the Processing Batch module. **No frontend component actually calls it** — it's an orphaned service method, in a table with 0 rows. A defect in unshipped code, not a live break. |

**The pattern in my own errors, stated plainly:** I sometimes **assigned severity from code shape** ("this pattern is dangerous") **rather than from current exposure** ("is this path actually being hit?").

**So: trust the *existence* claims — every one I sampled was real. Sanity-check the *severity* labels** against live row counts and real call sites before you triage. That's exactly why every finding in this report now carries a `LIVE` or `DORMANT` label and a DB-verified row count where one exists — and why I've corrected my own reviewers' `LIVE` calls to `DORMANT` four separate times when the database disagreed with them.

### 🎯 THREE ONE-LINE FIXES, DO THESE FIRST

Before any individual bug, three single-line changes each neutralise an entire class:

| Fix | Where | What it stops |
|---|---|---|
| Drop the `status >= 500` retry clause | `frontend/src/lib/api.ts:18` | **Every non-idempotent POST being silently applied up to 4×** (BH-0280) |
| `!== undefined` → `?.length` on delete-then-recreate | 9 controllers + `style.service.ts` | **All 5 data-loss wipes**, and 8 more tables one mistake away (BH-0279) |
| Throw if `JWT_SECRET` is unset | `backend/src/utils/jwt.utils.ts:5` | A silent fallback to a **public, well-known signing key** (BH-0252) |

Then rotate the JWT secret and DB password (BH-0251), and hide the Cancel button on issued challans (BH-0214). That's a morning's work and it closes the sharpest edges in this report.

### 🔥 What is actually at risk RIGHT NOW — counted against your live database

I queried every relevant table. These are **real rows that a routine save will destroy**, ranked by how much you lose:

| # | Bug | **Rows genuinely at risk today** |
|---|---|---|
| 1 | ~~Saving a style destroys its SKU variants~~ (BH-0267) | ⚠️ **RETRACTED — I OVERSTATED THIS.** The 1,442 rows span **241 styles, not 1,040**; there are **ZERO barcodes** and only **6** custom SKUs; ~99.6% regenerate identically. Real risk is narrower: delete+recreate churns row IDs, nulling  references. **Downgraded to S2.** |
| 2 | ~~Saving a supplier wipes city/PIN from 39 GST registrations~~ (BH-0268) | ⚠️ **RETRACTED — I OVERSTATED THIS ~19x.** Only **2 of 39** rows have a city and **1** has a pincode. All 39 have  — **it has never fired.** **Downgraded to S3.** |
| 3 | **Saving a style DELETES its process costs** (BH-0275) | 🔴 **21 style_processes rows** (cutting ₹15, stitching ₹50…) |
| 4 | **Cancelling an issued challan never returns the stock** (BH-0214) | 🟠 **22 ISSUED challans — armed; the next Cancel click fires it** |
| 5 | **Deleting a fabric lot never decrements stock_levels** (BH-0276) | 🟠 12 fabric lots / 34 stock_levels rows — silently overstates stock |
| 6 | **Deleting any trim master orphans your style BOMs** (BH-0286) | 🔴 **244 live BOM lines** — the guard checks an *empty* table and misses the full one |
| 7 | **"Permanently delete" a style does ZERO dependency checks** (BH-0287) | 🔴 **111 CAD records · 10 fabric lots** silently orphaned |
| 8 | **Deleting a greige master orphans its stock and procurement links** (BH-0283) | 🟠 **24 greige with live stock · 36 procurement rows** |
| 9 | **Every non-idempotent POST can be silently applied 4×** (BH-0280) | 🟠 Amplifies *all* of the above |

#### The most precisely-wrong bug in the report (BH-0286)

All six trim-master deletes (label, packaging, elastic, button, zipper, thread) **do** have a guard. It runs. It passes. **It's pointed at the wrong table.**

They check `order_bom_items` — which has **0 rows**, because orders have never worked (BH-0165). So the check *always* passes. Meanwhile `style_material_bom` — **311 live rows**, the actual bill-of-materials for your 1,040 styles — is **never checked by any of the six** (grep-verified: zero references). The FK is `ON DELETE SET NULL`, so the delete succeeds and silently nulls the link.

Delete a label → up to **186 style BOM lines** silently orphaned. Packaging → 48. Elastic → 5. Button → 3. And note: `zipper_master` and `thread_master` each have **exactly one row**, each referenced by a live BOM line — so **the only zipper and the only thread in your system can each be deleted at any moment**, silently breaking the style that uses them.

**Correcting my own earlier claim:** I previously listed **BH-0207** (saving a fabric deletes its supplier links) in this table. `fabric_suppliers` has **0 rows** — so there is currently **nothing for it to destroy**. The bug is real and will fire the moment you link a supplier to a fabric, but it is **armed, not active**. Demoted, and flagged here rather than quietly dropped.

Four of the six are the same shape: **a form loads a field it can't see, then writes the blank back.**

### ⚡ ANOTHER ONE-LINE FIX, AND THIS ONE PROTECTS EVERY WRITE IN THE APP (BH-0280)

Your API client is configured to **silently retry POSTs**:

```ts
axiosRetry(api, {
  retries: 3,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429 ||
    (error.response?.status >= 500),   // ← no method check. This retries POST.
});
```

The library's own `isNetworkOrIdempotentRequestError` deliberately **excludes POST**, precisely because POST isn't safe to repeat. That last clause overrides the safety with a method-blind condition — and it also fires on a raw network drop, the classic killer: *the server commits the write, the connection dies before the response arrives, and the client resends.*

**What that does, concretely.** "Decrease this greige lot by 10 m" hits a transient 500. The retry fires. The endpoint is a read-modify-write (read current → compute → write absolute, BH-0281), so **the delta is applied again**. With `retries: 3`, one click can deduct **40 m instead of 10 m** — and the user sees only the final `200 OK` and a success toast.

It also defeats the UI's own protection: the *Apply Adjustment* button **is** correctly disabled during the request — but the retry happens inside the axios layer, **below the button**.

**This is why it's S1: it isn't a bug in one endpoint, it's a multiplier on every non-idempotent write in the system** — stock adjustments, GRN approvals, challan issues, payment recording. Drop the bare `>= 500` clause and let the library's method check do its job.

### 💊 ONE CHANGE IMMUNISES THE WHOLE CLASS (BH-0279)

Every one of these wipes gets through the same door. The backend guards its delete-then-recreate with:

```ts
if (suppliers !== undefined) { deleteMany({ parentId }); create(payload); }
```

**An empty array is not `undefined`.** So `[]` sails through the guard, deletes everything, and recreates nothing. Change it to:

```ts
if (suppliers?.length) { ... }
```

…and an empty payload becomes a harmless no-op instead of a deletion. **That single change turns this entire class — 5 confirmed data-loss bugs, plus 8 more tables sitting one mistake away (BH-0279) — from destruction into nothing.** Do this first; then fix the individual forms at your leisure.

### ✅ And both data-loss classes are now fully bounded (BH-CLEAN-14)

I swept them systematically rather than waiting to stumble on more. **42 reversal actions** enumerated (cancel/delete/reject/void); 19 have real side effects; **only 3 fail to reverse them.** **47 delete-then-recreate sites** found across 22 forms; **only 2 broken.**

Verified *correct*, and worth knowing: `processor-rate-v2` (956 live rows) and CAD planning (526 rows) both use **diff-based updates** — they compare old vs new and delete only what the caller actually removed. That's the right design, and it's already in your codebase. So is `cancelSendOut`, `returnUnprocessedProcessPO`, and `order.cancelOrder` (which correctly walks lace allocations and returns unconsumed quantity, idempotently, in a transaction).

**These bugs are inconsistency, not incompetence.** The codebase already contains a correct example of every pattern it gets wrong elsewhere.

Biggest classes: **zod-drift 41** · money-math 40 · race 38 · atomicity 25 · material-sync 20 · form-state 18.

### 📊 The exposure census — which findings can fire at all (full DB count, iteration 52)

The single most useful triage tool in this report. **A bug in an empty table cannot hurt you yet.** Here is every table I checked:

**🔴 TABLES WITH REAL DATA — bugs here are LIVE:**
`styles=1040` · `style_variants=1442` · `style_material_bom=311` · `style_components=255` · `style_fabrics=245` · `style_processes=21` · `suppliers=82` · `supplier_gst_numbers=39` · `materials=184` · `material_suppliers=11` · `greige_master=54` · `fabric_master=14` · `lace_master=13` · `challans=23` · `challan_items=32` · `greige_stock=61` · `fabric_stock=12` · `lace_stock=2` · `stock_levels=34` · `stock_movements=9` · `customers=5` · `material_requirements=9` · `purchase_orders=1` · `users=9`

**⚪ EMPTY TABLES — bugs here are DORMANT (real code defects, but nothing to corrupt yet):**
`orders` · `order_items` · `work_orders` · `production_tracking` · `cutting_batches` · `stitching_issues` · `finishing_issues` · `transfer_slips` · `finished_goods_stock` · `goods_receiving_notes` · `invoices` · `payments` · `credit_notes` · `debit_notes` · `quotations` · `sale_orders` · `samples` · `delivery_notes` · `asn_applications` · `style_costing` · `job_work_orders` · `fabric_processing` · `processing_batches` · `stock_counts` · `thread_stock` · `fabric_suppliers`

**How to read the report with this.** Your business today lives in **styles, materials, suppliers, stock and challans** — and those are exactly where the live data-loss bugs are. The entire order → work-order → production → invoice → dispatch spine is **empty**, so the ~150 findings there are **landmines, not fires.** That's genuinely good news: **you get to fix them before the data starts flowing through them.**

The one thing that should worry you in the dormant column: those features are empty *because they're broken*, not because you haven't gotten to them.

### 🧭 How much of this is on fire *right now*? (read-only DB, iteration 41)

This matters more than the raw count. I checked what actually exists in your database:

| Table | Rows | What it means |
|---|---|---|
| **challans** | **22 ISSUED**, 1 DRAFT, 0 cancelled | **The one module genuinely in use.** BH-0214 lives here and is armed. |
| styles / suppliers / customers | 1,040 / 82 / 5 | Master data is healthy |
| greige / fabric / stock_levels | 61 / 12 / 34 | Stock is in real use |
| **cutting_batches / stitching_issues / finishing_issues** | **0 / 0 / 0** | The **entire production floor** has never run — downstream of orders |
| **transfer_slips / production_tracking / order_inspections** | **0 / 0 / 0** | Same. (order_inspections is *never written by anything* — BH-0248) |
| **samples** | **0** | **Mathematically impossible to create** (BH-0234) — the Zod and DB enums are disjoint |
| **delivery_notes / asn_applications** | **0 / 0** | No UI to create them (BH-0227) |
| **finished_goods_stock** | **0** | Nothing has ever been produced into it |
| **orders** | **0** | Can't be created (BH-0165) |
| **work_orders** | **0** | Downstream of orders — so the *entire* work-order module has never run |
| **production_tracking** | **0** | Same |
| **job_work_orders** (Process POs) | **0** | **No UI exists to create one** (BH-0221) — the page was never built |
| **fabric_processing** | **0** | Same |
| style_costing / GRNs | 0 / 0 | Can't be created (BH-0149) |

**The honest read:** most of this report is a **minefield, not a fire.** The order → work-order → costing spine has never carried data, so the money bugs in MRP, BOM, costing and work orders **haven't cost you anything yet.** That is genuinely good news — you get to fix them *before* the data starts flowing.

The exceptions — the things that are live and can hurt you today — are exactly three: **BH-0214** (challan cancel, 22 armed rows), **BH-0207** (saving a fabric wipes its suppliers), and the stock-sync bugs in the greige/fabric tables that are already in use.

**41 of these are the schema-drift class** — one bug, repeated. Fixing the pattern (Stage 1 above) closes roughly a fifth of the entire report.

**Load-bearing discovery (iter 8):** `unified_stock_view` is defined **from stock_levels** (verified in migration SQL and live DB) — the comments in `stockLevel.service.ts` calling it "aggregated from all specialized tables / the true source of truth" are **false**. The two stock layers are: stock_levels (feeds the main Stock pages via the view) and the specialized tables (feed GreigeAvailableStock and the per-material list pages). Bugs BH-0040/BH-0046 desync the specialized side; the BH-0003/0004/0005/0011-family desyncs the stock_levels side.

Top must-read findings: **BH-0030** (challan-issue sync ignores warehouse — deterministically corrupts every warehouse's stock_levels; systemic across thread/fabric/lace branches), **BH-0011** (processor returns vanish from all stock tables), **BH-0010** (challan failure double-deducts greige on retry), **BH-0029** (concurrent challan/work-order thread issue loses deductions), **BH-0023** (live lace transfer UI can oversell a lot), **BH-0034** (ALL GRN specialized-stock creation runs after commit with swallowed failures), **BH-0009** (sync helper swallows all its own errors — systemic root).

**Systemic pattern (already clear after 2 of 5 stock batches):** the specialized stock services don't accept/thread a `tx` parameter, use read-then-write-absolute quantity math, and treat stock_levels sync as best-effort. Expect the same in laceStock/thread-stock/trim-stock (P1-B3/B4).

## S1 — Data / Money Corruption

### BH-0214 [S1][CONFIRMED] ⚠️ MOST URGENT — cancelling an issued challan never returns the stock (live module, 22 issued challans)
- **File:** [challan.service.ts:827](../../backend/src/services/challan.service.ts#L827) · **Class:** status-machine · **Found/verified:** iter 41 · **DB-checked**
- **Scenario:** `issueChallan` deducts `fabric_stock.quantityAvailable`, increments `quantityConsumed`, syncs `stock_levels` and sets `fabric_processing` to SENT. `cancelChallan` reverses **none** of it — it flips a status field and nothing else, with no transaction and no status guard. Issue 50 m, the truck doesn't leave, hit Cancel: the challan reads CANCELLED (implying nothing happened) while the fabric stays deducted forever. The goods are on your shelf and invisible to the system. Deterministic on every cancel-after-issue; no concurrency needed.
- **Live-data check:** challans = **22 ISSUED, 1 DRAFT, 0 CANCELLED**. It has **not fired yet** — but the Cancel button is rendered and enabled on all 22 (`canCancel = !['RECEIVED','CANCELLED'].includes(challan.status)`). The next Cancel click on an issued challan silently corrupts stock. This is the only bug in the report that sits in a module with real, active data.
- **Skeptic:** sent to kill it; checked all four escape routes (is the button really enabled for ISSUED? is the route wired and called? does the controller pre-check status? does *any* other path re-credit stock on cancel?). **All four held.** A hard grep found no reversal logic anywhere — the only code that ever credits `fabric_stock` back is `createFabricReturnChallan`, an unrelated cutting-return workflow not wired to cancel.
- **Interim mitigation:** hide/disable Cancel for any challan past DRAFT.
- **Fix direction (NOT applied):** make `cancelChallan` reverse exactly what `issueChallan` did, inside one `$transaction`, and put the allowed statuses in the where-clause.

### BH-0236 [S1][CONFIRMED — DORMANT] Deleting a pending delivery note destroys the finished goods — stock is deducted at creation and never given back
- **File:** [dispatch.controller.ts:390](../../backend/src/controllers/dispatch.controller.ts#L390) · **Class:** status-machine · **Found/verified:** iter 44 · **DB-checked**
- **Scenario:** the **exact shape of BH-0214** (cancelChallan), one module over — which is why the *pattern* matters more than any single instance. `createDeliveryNote` decrements `finished_goods_stock` immediately at creation, while the note is still PENDING and nothing has physically shipped. `deleteDeliveryNote` — allowed only while PENDING — deletes the row and its items and **never credits the stock back**. Create a note for 50 units, realise it's a mistake, delete it: the 50 units are gone from stock forever and nothing ever shipped.
- **Dormant** only because the dispatch pages 404 today (BH-0227). Fires on the first real create-then-delete once they're wired up.
- **Fix direction (NOT applied):** restore the stock inside the delete (atomic `{ increment }`, in a transaction) — or better, don't deduct at creation at all; deduct at dispatch. **Copy `cancelSendOut()` (BH-CLEAN-09), which already does this correctly.**

### BH-0237 [S1][CONFIRMED — DORMANT] Embroidery receipt has no upper bound, and partial receipts overwrite each other instead of adding up
- **File:** [embroidery-stock.service.ts:306](../../backend/src/services/embroidery-stock.service.ts#L306) · **Class:** quantity-math · **Found/verified:** iter 44
- **Scenario:** two bugs in one function. **(1) No upper bound:** nothing compares `quantityReceived` against `quantitySent`. Send 100 m out for embroidery, receive 1000 m, and `fabric_stock.create` cheerfully materialises 1000 m of new embroidered stock — **900 m conjured from a typo.** **(2) Partial receipts overwrite:** the re-entry guard blocks only RECEIVED and CANCELLED, so a PARTIALLY_RECEIVED send-out can be received repeatedly — and each call *sets* `quantityReceived` to that call's number rather than adding to the total. Two honest partial receipts of 50 m + 50 m against a 100 m send-out leave the record showing 50, stuck on PARTIALLY_RECEIVED forever.
- **Dormant behind BH-0180** (both endpoints 400 today) — **but the routes are registered and the pages do call them, so the day you fix that schema mismatch, this S1 goes live.** Fix them together.
- **Fix direction (NOT applied):** bound the receipt against `quantitySent` minus what's already received; use `{ increment }`, not an absolute set. **`sendOut()` in the same file already does the bound check correctly — copy it.**

### BH-0222 [S1][CONFIRMED — DORMANT] Sending fabric out for re-processing never deducts it from stock — the same lot can be sold twice while it sits at the mill
- **File:** [dyeing.controller.ts:1668](../../backend/src/controllers/dyeing.controller.ts#L1668) · **Class:** quantity-math · **Found/verified:** iter 42 · **DB-checked**
- **Scenario:** `sendProcessPO` consumes stock **only** on the greige path — `if (job.greigeStockLotId) { consumeGreigeStock(...) }` — with no matching branch for `fabricStockLotId`. But the create schema explicitly allows *either*: the re-dye/reprocess path sends an already-processed **fabric** lot back to the mill. On that path nothing decrements `fabric_stock`. Send a 500 m lot out for re-dyeing and it still reads **500 m AVAILABLE** — free to be cut, allocated or sold to another order while the goods are physically at the processor. The whole function body was grepped: zero references to `fabric_stock`. `printing.controller.ts` has the identical gap.
- **Status — DORMANT, and I want to be precise about why:** `job_work_orders` has **0 rows**, so this line has executed zero times; the feature is unreachable from the UI (BH-0221). **But dormant describes *usage*, not *reachability*** — the backend route is POST-able directly by a script or integration regardless of the missing page. **The day you build the Process PO screen, this S1 goes live.** Fix them in the same pass.
- **Fix direction (NOT applied):** add the `fabric_stock` decrement branch (atomic `{ decrement }`) alongside the greige one, inside a transaction.

### BH-0207 [S1][CONFIRMED] Saving any existing fabric silently DELETES all of its supplier links
- **File:** [FabricForm.tsx:489](../../frontend/src/pages/FabricForm.tsx#L489) · **Class:** serializer · **Found/verified:** iter 40 · **Proved by executing the real serializer**
- **Scenario:** The serializer maps `suppliers` → `supplier` unconditionally by key name (arrays included), so `fabric.suppliers` is `undefined`. The edit form therefore always opens showing **zero** suppliers — the user cannot even see the real links. On save it sends `suppliers: []`; the Zod schema declares the field `.optional()` with no `.min(1)` so the empty array passes untouched; and the controller guards on `!== undefined` rather than `.length`, so it runs `fabric_suppliers.deleteMany({ fabricId })` and creates nothing. **Open a fabric, change one unrelated field, hit Save → every supplier association is permanently destroyed, with a success toast.** No concurrency required; 100% reproduction.
- **Skeptic:** sent to KILL it. Checked all six escape hatches (a value-type guard in the mapper, a `KNOWN_SAFE_COLLISIONS` exemption, a frontend response adapter, empty-array stripping on save, a `.min(1)` in the schema, a `.length` guard in the controller) — **none present** — then settled it by importing the real `serializer.ts` and printing the output keys: `['id','fabricCode','supplier']`, with `suppliers` absent.
- **Corroboration:** `GreigeForm.tsx:122` reads the singular `greige.supplier` for the identical junction pattern. The greige side was already worked around; the fabric side never was.
- **Fix direction (NOT applied):** read `fabric.supplier` in FabricForm, **and** change the controller guard to `if (suppliers?.length)` so an empty array can never mean "delete everything".

### BH-0208 [S1][CONFIRMED] GSTR-1 silently drops every overdue invoice — and GSTR-3B includes them, so the two filings can't reconcile
- **File:** [gstReport.service.ts:102](../../backend/src/services/gstReport.service.ts#L102) · **Class:** money-math · **Found/verified:** iter 40
- **Scenario:** `generateGSTR1` filters with `status: { not: InvoiceStatus.OVERDUE }`. The enum is `PENDING / PARTIALLY_PAID / PAID / OVERDUE` — there is **no CANCELLED or VOID value**, so this filter can never exclude a voided invoice; it can only exclude legitimately-issued invoices the customer hasn't paid on time. A ₹1,00,000 interstate invoice (₹18,000 IGST) that goes unpaid is simply **omitted from the return** — b2b, HSN summary and totals all under-report. Meanwhile `generateGSTR3B` (same file, ~line 269) applies **no status filter** and does include it. The two returns for the same period disagree by exactly the overdue invoices.
- **Skeptic:** the severity hinged entirely on whether anything actually *sets* `OVERDUE`, and the skeptic was invited to kill it as dead code. It found the admin-only `POST /invoices/update-overdue` endpoint is indeed never called (no cron, no caller) — **but OVERDUE is set anyway by three live paths in the normal invoice lifecycle**: `createInvoice` (:277) sets it outright if the due date has passed, and both `recordPayment` (:685) and `updateInvoice` (:574) recalculate it via `calculateInvoiceStatus`. **Recording a partial payment on a late invoice — an everyday event — is enough to flip it.** Deterministic, not concurrency-gated.
- **Fix direction (NOT applied):** drop the status filter from `generateGSTR1` — payment status is irrelevant to outward-supply reporting; GST is due on the *invoice*, not on the collection. If voiding was the intent, add a real `CANCELLED` status.

### BH-0010 [S1][CONFIRMED] Greige consumption escapes the challan-issue transaction — retry double-deducts stock
- **File:** [greige-stock.service.ts:441](../../backend/src/services/greige-stock.service.ts#L441) · **Class:** atomicity · **Found/verified:** iter 5
- **Scenario:** `challan.service.ts` wraps challan issue in `$transaction` and calls `consumeGreigeStock` inside it, but the method takes no `tx` and writes through the module-level client. If a later item in the same challan fails, the challan rolls back to DRAFT but the greige deduction stays committed — reissuing the challan deducts the same lot **twice**. The fabric/lace/thread branches of the same function thread `tx` correctly; greige is the one that doesn't.
- **Fix direction (NOT applied):** add a `tx` parameter to `consumeGreigeStock` and pass the challan transaction through (mirror the fabric branch at challan.service.ts:286-301).

### BH-0011 [S1][CONFIRMED] Processor returns vanish — received quantity lands nowhere and stock_levels is never adjusted
- **File:** [greige-stock.service.ts:903](../../backend/src/services/greige-stock.service.ts#L903) · **Class:** material-sync · **Found/verified:** iter 5
- **Scenario:** `POST /api/stock-movements/processor-return` requires a destination `warehouseId`; the controller destructures it and then **never passes it** — `receiveFromProcessor` has no warehouse parameter. The function only decrements the processor's stock and writes an audit row: no destination stock row is created and `syncStockLevelQuantity` is never called. Every processor return makes the received goods disappear from all tracked stock.
- **Skeptic:** verified end-to-end including the frontend (StockInForm makes exactly one API call; no follow-up creates destination stock).
- **Fix direction (NOT applied):** pass `warehouseId` through and create/increment destination greige_stock + sync stock_levels inside one transaction.

### BH-0015 [S1][CONFIRMED] Lost-update race in consumeGreigeStock — reachable from challan issue, printing, and dyeing
- **File:** [greige-stock.service.ts:470](../../backend/src/services/greige-stock.service.ts#L470) · **Class:** race · **Found/verified:** iter 5
- **Scenario:** read → in-memory math → write of absolute values, with no transaction, WHERE-guard, or atomic decrement. Two users issuing challans against the same greige lot concurrently: the second write silently clobbers the first's deduction, so physical issue exceeds recorded consumption. Compounds BH-0010 (the caller's transaction gives zero protection since the method uses the global client).
- **Fix direction (NOT applied):** use atomic `{decrement:}`/`{increment:}` operators plus a `WHERE quantityAvailable >= qty` guard, or wrap read+write in a `$transaction` with the caller's tx.

### BH-0023 [S1][CONFIRMED] Live lace transfer action can oversell a lot (TOCTOU)
- **File:** [laceStock.service.ts:538](../../backend/src/services/laceStock.service.ts#L538) · **Class:** race · **Found/verified:** iter 7
- **Scenario:** availability is read and checked *before* the transaction opens, then written as an absolute value inside it. The transfer action on the LaceStockDetail page calls this directly — two users/tabs (or a retried submit) both pass the stale check and clobber each other, committing the same physical lace to two destinations.
- **Fix direction (NOT applied):** re-read inside the transaction with a `WHERE quantityAvailable >= qty` guard or atomic decrement.

### BH-0029 [S1][CONFIRMED] Thread deduction on challan issue loses updates under concurrency
- **File:** [challan.service.ts:348](../../backend/src/services/challan.service.ts#L348) · **Class:** race · **Found/verified:** iter 7
- **Scenario:** the read is inside the transaction but takes no row lock; the update writes a blind absolute value (no atomic decrement, no WHERE guard, default READ COMMITTED). Two concurrent issuances read the same balance; the second overwrites the first's deduction. Reachable from challan issue, three work-order call-sites, and cutting.
- **Fix direction (NOT applied):** `{ decrement: qty }` with a `quantityAvailable: { gte: qty }` where-guard.

### BH-0030 [S1][CONFIRMED] Challan-issue stock_levels sync ignores the warehouse — corrupts every warehouse's rows (systemic)
- **File:** [challan.service.ts:392](../../backend/src/services/challan.service.ts#L392) · **Class:** material-sync · **Found/verified:** iter 7
- **Scenario:** `syncStockLevelQuantity(threadId, -qty, undefined, 'METER', tx)` passes no warehouseId even though the stock row's warehouse is right there; the helper's updateMany then decrements **all** warehouses' stock_levels rows for that material — deterministic corruption whenever stock spans more than one warehouse. The skeptic confirmed the same pattern in the fabric (`:301`) and lace (`:339`) branches of the same function, and the helper's own comment warns about exactly this.
- **Fix direction (NOT applied):** pass the stock row's warehouseId at all three call-sites.

### BH-0041 [S1][CONFIRMED] Stock-count approval is not atomic — mid-loop failure half-applies the count, and retry double-applies it
- **File:** [stockCount.service.ts:335](../../backend/src/services/stockCount.service.ts#L335) · **Class:** atomicity · **Found/verified:** iter 8
- **Scenario:** the approval wraps everything in a transaction, but each variance item calls `createStockAdjustment`, which opens its **own** transaction and commits immediately. If a later item fails (e.g. insufficient stock — realistic, since counts span hours), the count stays VERIFIED while earlier adjustments are already committed; nothing marks variances as applied, so retrying approval applies them **again**.
- **Fix direction (NOT applied):** thread the outer `tx` into the adjustments and mark items applied idempotently.

### BH-0048 / BH-0049 / BH-0050 [S1][CONFIRMED] Stock-sync integrity, iteration-9 batch (helper call-site sweep)
- **BH-0048 — GRN receipts never reach stock_levels for 8 material types** ([grn.service.ts:1263+](../../backend/src/services/grn.service.ts#L1263)): the GRN sync uses the master's id, but the button/zipper/elastic/label/packaging/machine-part/other-material controllers mint `materials.id = 'mat-<code>'` even on single create (lace: bulk-import only). The sync's FK failure is doubly swallowed (BH-0009 + BH-0034) — GRN shows ACCEPTED, stock_levels permanently misses the receipt. Fix: use `ensureMaterialRecord`'s return value, as fabric-stock.service.ts:110 already does.
- **BH-0049 — Challan INWARD receive credits all warehouses** ([challan.service.ts:642](../../backend/src/services/challan.service.ts#L642), :675): receive-direction sibling of BH-0030; the stock lookups don't select warehouseId although it's on the rows, and the adjacent general-material branch does it correctly.
- **BH-0050 — Every embroidery movement syncs unscoped** ([embroidery-stock.service.ts:143](../../backend/src/services/embroidery-stock.service.ts#L143), :304, :517): sending 50m from Warehouse A also decrements Warehouse B's stock_levels.

### BH-0070 [S1][CONFIRMED] 💰 The amount-in-words on every invoice contradicts the printed total
- **File:** [company.config.ts:121](../../backend/src/config/company.config.ts#L121) · **Class:** money-math · **Found/verified:** iter 15
- **Scenario:** the Grand Total prints with paise (`₹1,050.50`), and directly beneath it `amountToWords()` prints "Rupees One Thousand Fifty One Only" — because the function does `Math.round(amount)` and has no paise vocabulary at all. There is **no Round-Off line** anywhere on the document to reconcile the gap. This isn't an edge case: invoice totals are stored unrounded and GST rates (2.5/6/9%) put paise on nearly every invoice. In India the words are the legally controlling figure on a tax invoice. Affects the invoice PDF, the Excel export, and the proforma.
- **Fix direction (NOT applied):** add paise handling to `amountToWords` ("…and Fifty Paise Only"), or add a Round-Off line and print the rounded figure in both places.

### BH-0071 [S1][CONFIRMED] 💰 Proforma invoices print a GST rate that contradicts their own tax amount
- **File:** [document-generator.service.ts:1231](../../backend/src/services/document-generator.service.ts#L1231) · **Class:** money-math · **Found/verified:** iter 15
- **Scenario:** quotations keep a flat header `taxRate` (default 5) but recalculate the tax amounts per item using the apparel price slab (over ₹2,500/piece → 18%, else 5%). The PDF derives the printed percentage from the stale header rate and never from the actual amount. A quotation of kurta sets at ₹3,500/pc with a ₹100,000 subtotal prints **"CGST @ 2.5% (Est.): ₹9,000.00"** — the stated rate is off by more than 3× from the stated amount, on a document you hand to the customer. Fires on any quotation containing apparel above the ₹2,500 slab.
- **Fix direction (NOT applied):** derive the displayed rate from the computed amounts (or store the blended rate on the quotation).

### BH-0078 [S1][CONFIRMED] 💰 MRP systematically under-buys greige — shrinkage is never applied
- **File:** [mrp.service.ts:1197](../../backend/src/services/mrp.service.ts#L1197) · **Class:** quantity-math · **Found/verified:** iter 17
- **Scenario:** for GREIGE_PROCESSED sourcing, MRP puts the **finished-fabric** quantity straight onto the **greige** purchase requirement. You must buy `finished ÷ (1 − shrinkage)`. With 1,000 garments × 2.0 m + 5% wastage = 2,100 m finished needed and 10% shrinkage, the correct greige buy is **2,333 m** — MRP asks for **2,100 m**. The processor returns ~1,890 m usable: 210 m short, emergency top-up PO, cutting stalls. The word "shrinkage" appears **nowhere** in mrp.service.ts. It's an omission, not a design choice: `costSheetPOGeneration.service.ts:378-387` does exactly this inflation for the *lace* path while the parallel fabric/greige block doesn't.
- **Fix direction (NOT applied):** divide by `(1 − averageShrinkagePercent/100)` when writing the greige requirement, mirroring the lace path.

### BH-0079 [S1][CONFIRMED] 💰 Re-running MRP re-orders material that's already on a purchase order
- **File:** [mrp.service.ts:704](../../backend/src/services/mrp.service.ts#L704) · **Class:** atomicity · **Found/verified:** iter 17
- **Scenario:** MRP's pre-pass cancels **every** requirement that isn't RECEIVED or CANCELLED — which includes ones already marked PO_GENERATED/PO_SENT — then recreates them as fresh "needs PO" rows from current stock, with no awareness of the `requirement_po_links` row still pointing at the PO you already raised. PO generation then picks candidates **by status alone**. So recalculating MRP after raising a PO makes the same shortfall eligible for purchase again: a duplicate PO for material already on order. Recalculation is reachable at any time from three entry points, with no guard.
- **Fix direction (NOT applied):** exclude requirements with active `requirement_po_links` from the cancel-all, and deduct on-order quantities in the availability math.

### BH-0080 [S1][CONFIRMED] 💰 Stock allocated to one order still counts as available to every other order
- **File:** [mrp.service.ts:1850](../../backend/src/services/mrp.service.ts#L1850) · **Class:** material-sync · **Found/verified:** iter 17
- **Scenario:** `allocateStock` reserves a lot by incrementing `quantityReserved` — it never decrements `quantityAvailable`. And MRP's availability math sums `quantityAvailable` and **never subtracts reserved** (its only uses in the file are the increments). So 700 m committed to Order A reads as fully available to Order B, which under-buys or is wrongly marked fully-stocked. `quantityReserved` is effectively a dead counter: physical consumption decrements `quantityAvailable` directly and ignores it.
- **Fix direction (NOT applied):** subtract `quantityReserved` in the availability aggregates (or decrement `quantityAvailable` on allocation) — pick one and make every reader agree.

### BH-0084 [S1][CONFIRMED] 💰 A purchase order can be raised on the wrong supplier at another supplier's negotiated price
- **File:** [mrp.service.ts:1933](../../backend/src/services/mrp.service.ts#L1933) · **Class:** money-math · **Found/verified:** iter 18
- **Scenario:** PO generation never checks that a requirement's `preferredSupplierId` matches the supplier you're raising the PO for — and the primary rate lookup queries the cost sheet by material alone, with **no supplier filter**. So it returns Supplier A's negotiated rate for a PO addressed to Supplier B. Since the rate isn't zero, the "no zero-price items" guard never fires. This is reachable from the UI: the Generate-PO dialog lists **all** suppliers, unfiltered by the requirement's preferred supplier, and submits with no price-review step. Pick the wrong one and you've committed a supplier to material they never quoted, at someone else's price.
- **Fix direction (NOT applied):** filter the supplier dropdown by the requirements' preferred supplier, validate the match server-side, and scope the rate lookup by supplier.

### BH-0085 [S1][CONFIRMED] 💰 Bulk PO consolidation prices merged material at one arbitrary rate
- **File:** [mrp.service.ts:3142](../../backend/src/services/mrp.service.ts#L3142) · **Class:** money-math · **Found/verified:** iter 18
- **Scenario:** when the same material is needed by two orders (exactly what consolidation is *for*), the preview stores the resolved rate in a map keyed only by material — so the second order's rate silently overwrites the first, and since the query has no ordering, *which* rate survives is arbitrary. The merged quantity is then priced entirely at that one rate: 50 m at ₹100 + 30 m at ₹120 becomes 80 m at ₹120. The dialog pre-fills that price for the user and submits it unedited — and on the backend, the frontend's price key **overrides** the backend's own correct per-order resolution. So the wrong price reaches the real PO.
- **Fix direction (NOT applied):** key the rate map per requirement (or per order + material + width), and price merged lines as a weighted blend rather than a single rate.

### BH-0093 [S1][CONFIRMED] 💰 Trims marked "Not Applicable" are still purchased
- **File:** [order-bom.service.ts:384](../../backend/src/services/order-bom.service.ts#L384) · **Class:** quantity-math · **Found/verified:** iter 19
- **Scenario:** ticking "Not Applicable" on a cost-sheet trim only flips a flag — it never clears the quantity/rate you already typed (the inputs are disabled, not cleared). The cost sheet correctly excludes the row from its *total*, but saves the row with its real quantity — and **order-bom.service.ts never checks that flag anywhere** (zero references, in three separate places that consume the data). A zipper entered at 2/garment and then marked N/A becomes **2,040 zippers purchased** on a 1,000-piece order. The correct quantity is zero. The bogus line also lands in the style's master BOM, so it poisons every future order for that style.
- **Fix direction (NOT applied):** filter `isNotApplicable` rows in all three consumers (and ideally clear the values on the frontend when the box is ticked).

### BH-0094 [S1][CONFIRMED] 💰 The "Calculate MRP" button is the live trigger for the duplicate-PO bug
- **File:** [order-bom.controller.ts:498](../../backend/src/controllers/order-bom.controller.ts#L498) · **Class:** money-math · **Found/verified:** iter 19
- **Scenario:** this endpoint only checks that the BOM is approved. There is **no field anywhere recording that MRP has already run**, and the button renders unconditionally on any approved BOM — with no check for whether its requirements already have purchase orders attached. Every click re-runs the calculation that cancels PO-linked requirements and recreates them as "needs PO" (BH-0079). This is the sanctioned, always-available path by which the same material gets ordered twice.
- **Fix direction (NOT applied):** add an `mrpCalculatedAt` marker and require an explicit confirmation (or block outright) when linked POs exist.

### BH-0100 [S1][CONFIRMED] Every style edit orphans the approved CAD data — while the style still says "CAD Approved"
- **File:** [style.service.ts:899](../../backend/src/services/style.service.ts#L899) · **Class:** atomicity · **Found/verified:** iter 20
- **Scenario:** saving a style deletes all its components/fabrics and recreates them with new IDs. The CAD records are **unlinked** (to dodge a cascade delete) but **never re-linked**, and `cadStatus` is never reset. The form sends `components` on every save — so fixing a typo in the style name is enough to trigger it. Consequences, both verified: `costing.service.ts:591` **skips any fabric whose CAD link is null** (logs a warning, nothing more) — that fabric's cost silently disappears from the cost sheet; and the production dashboard trusts `cadStatus === 'APPROVED'` with no link check, so it keeps showing CAD as approved and **suppresses the "CAD not approved" blocker**. Two other read paths already compute a compensating "effective CAD status" — so this staleness is known, the fix just wasn't applied everywhere.
- **Fix direction (NOT applied):** re-link `fabricCADId` to the recreated fabric rows (match on fabric + width), or reset `cadStatus` to PENDING when fabrics are rebuilt.

### BH-0107 [S1][CONFIRMED] Double-clicking "Approve" on a GRN creates the stock twice
- **File:** [grn.service.ts:565](../../backend/src/services/grn.service.ts#L565) · **Class:** race · **Found/verified:** iter 21
- **Scenario:** the approval checks the GRN's status against a snapshot taken *before* the transaction, and the update is keyed on id alone — no status condition, no version column. Two concurrent approvals both pass and both run the whole stock-creation path: a 100-unit receipt becomes **200 units on hand**, with two stock movements and two specialized stock lots. And the trigger is real: two of the three Approve buttons have **no disabled/loading state**, and the dialog only closes after the request returns — so one user double-clicking is enough. (The repo has retry-safe transaction helpers; this code doesn't use them.)
- **Fix direction (NOT applied):** make the update conditional (`where: { id, status: 'PENDING_QC' }`) and disable the button while the request is in flight.

### BH-0114 [S1][CONFIRMED] Cost-sheet PO generation is completely broken — every attempt fails
- **File:** [costSheetPOGeneration.schema.ts:17](../../backend/src/schemas/costSheetPOGeneration.schema.ts#L17) · **Class:** zod-drift · **Found/verified:** iter 22
- **Scenario:** the validation schema declares item fields (`styleFabricId`, `greigeId`, `quantity`, `rate`) that have **zero overlap** with what the page actually sends (`materialId`, `orderQty`, `unit`, `unitPrice`, `allowancePercent`) — and with what the service itself expects. Zod strips unknown keys, so **every item arrives as an empty object**. The "price must be positive" guard doesn't catch it (`undefined <= 0` is false), the total becomes `NaN`, and Prisma then rejects the missing required columns. Net result: the Cost-Sheet PO Generation page **fails on every invocation and has presumably never worked**. Nothing is corrupted — it just always errors. This is the project's own documented "Zod schema-controller drift" pitfall, at full scale.
- **Fix direction (NOT applied):** rewrite `costSheetPOItemSchema` to match the real payload (there are currently two different TypeScript types with the same name, which is how this hid).

### BH-0122 [S1][CONFIRMED] 💰 A 500-metre job matches two rate slabs — the price is non-deterministic
- **File:** [processor-rate-v2.service.ts:928](../../backend/src/services/processor-rate-v2.service.ts#L928) · **Class:** money-math · **Found/verified:** iter 23
- **Scenario:** the slab lookup is inclusive at **both** ends (`min <= qty AND max >= qty`) with **no ordering**, and the slab validator only rejects *overlapping* ranges — **touching** ones pass. Your shipped seed defaults are exactly that: 0–500 / 500–1000 / 1000–5000 at ₹65/₹60/₹55. So a **500 m dyeing job matches both the ₹65 and the ₹60 slab**, and which one wins depends on the database's scan order, not on any logic in your code. The same job can cost **₹32,500 or ₹30,000**. Round figures like 500/1000/5000 m are the most common order sizes there are.
- **Fix direction (NOT applied):** make slabs half-open (`min <= qty < max`), and add a deterministic `orderBy` (slabOrder) as a backstop.

### BH-0123 [S1][CONFIRMED] 💰 Duplicate "active" rate rows can coexist forever — lookups then pick one at random
- **File:** [processor-rate-v2.service.ts:590](../../backend/src/services/processor-rate-v2.service.ts#L590) · **Class:** race · **Found/verified:** iter 23
- **Scenario:** every rate-save path does find-then-write **outside a transaction**, and the unique constraint includes `effectiveFrom` (a fresh timestamp per insert) — so the database **cannot** block two concurrent saves. The history-closing update targets the old row **by id with no state guard**, so a second request re-closes an already-superseded row and orphans the first one as a permanently active duplicate. Since the lookup filters on "active" with no ordering, the same job then resolves to **either rate, at random, indefinitely**: a 5,000 m job totals ₹110,000 or ₹125,000 for identical input. Trigger: two people saving the rate matrix at once, or one double-click.
- **Fix direction (NOT applied):** wrap save in a transaction, guard the close with `where: { id, effectiveTo: null }`, and add a partial unique index on active rows.

### BH-0126 [S1][CONFIRMED] 💰 Service POs multiply a per-METRE rate by a PIECE count
- **File:** [work-order-service-requirement.service.ts:373](../../backend/src/services/work-order-service-requirement.service.ts#L373) · **Class:** money-math · **Found/verified:** iter 24
- **Scenario:** the work order's quantity is a count of **garments**; the processor rate is per **metre of fabric** (the rate engine's own lookup does `quantityMeters × ratePerMeter`, and the slabs are labelled 0–500m, 500–1000m…). This service multiplies them together with **no conversion**: 500 pieces at a ₹40/m dyeing rate is costed at ₹20,000, when 500 pieces × 2.5 m/piece = 1,250 m = **₹50,000**. And it isn't a display estimate — that figure is written straight into the purchase-order line as the amount committed to the job-worker.
- **Fix direction (NOT applied):** convert the work-order quantity into the rate's unit (pieces × consumption per piece) before multiplying, and stop hardcoding `unit = PIECE`.

### BH-0127 [S1][CONFIRMED] Eight of ten service types can never be priced or ordered — and there's no manual override
- **File:** [work-order-service-requirement.service.ts:372](../../backend/src/services/work-order-service-requirement.service.ts#L372) · **Found/verified:** iter 24
- **Scenario:** the rate-card type is literally `'DYEING' | 'PRINTING'` — every creation path, every controller (which explicitly rejects anything else), and the seed script only ever produce those two. So for **embroidery, washing, finishing, cutting, stitching, handwork, smocking and transportation**, the rate lookup always returns nothing. The requirement is still created, silently, with no warning (the UI just shows `--`). Later, generating the service PO throws "no valid pricing". There is no escape hatch: `estimatedRate` appears in **this one file only** — no endpoint, schema or UI control can set it by hand. Those eight services are permanently unorderable through this module.
- **Fix direction (NOT applied):** allow rate cards for all service types (or add a manual-rate field), and surface a warning at requirement-creation time rather than failing weeks later at PO generation.

### BH-0128 [S1][CONFIRMED] Two concurrent "generate PO" calls create two real POs for the same service — one is orphaned money
- **File:** [work-order-service-requirement.service.ts:1103](../../backend/src/services/work-order-service-requirement.service.ts#L1103) · **Class:** race · **Found/verified:** iter 24
- **Scenario:** the status check is a plain read outside the transaction. Both calls then create their own purchase order, both successfully link the same requirement (the link table's unique key includes the PO item, which is fresh each time), and both do an unconditional status update — last writer wins. Two genuine POs with real totals and GST now exist for one service requirement; the requirement points at one, and **the other is a live committed PO nobody is tracking**.

### BH-0130 [S1][CONFIRMED] Warehouse transfers and stock-outs never touch the specialized stock tables
- **File:** [stockMovement.service.ts:525](../../backend/src/services/stockMovement.service.ts#L525) · **Class:** atomicity · **Found/verified:** iter 25
- **Scenario:** the routing to specialized tables (greige_stock, fabric_stock, the trim tables…) is called **only on stock-in**. Transfers and issues touch `stock_levels` alone. So moving 100 m of greige from Warehouse A to B updates one layer while the greige_stock row still says the stock is sitting in A, untouched — and the transfer form's material picker has **no type filter**, so any greige/fabric/lace/trim material can be sent through it. The skeptic found it's wider still: challan issuance routes **trim materials** (button, zipper, elastic, label, packaging…) through this same stock-out path, so issuing them on a challan never decrements their specialized tables either.
- **Fix direction (NOT applied):** call `routeToSpecializedStock` (with a negative delta) from `createStockOut` and both legs of `createStockTransfer`.

### BH-0139 [S1][CONFIRMED] Clicking "Continue" between wizard tabs orphans the style's approved CAD data
- **File:** [StyleFormRedesigned.tsx:1969](../../frontend/src/pages/StyleFormRedesigned.tsx#L1969) · **Class:** form-state · **Found/verified:** iter 27
- **Scenario:** this is **how BH-0100 actually gets triggered in daily use.** Every "Continue" click auto-saves — unconditionally, with no dirty check — and the save always rebuilds and resends the full components tree. On an existing style that's a full update, so the backend deletes and recreates every fabric with new IDs, unlinks the CAD records, and leaves the status reading "CAD Approved". A merchandiser who simply *walks through the wizard tabs* on an approved style, changing nothing, silently detaches its CAD plan — after which costing skips those fabrics and the dashboard hides the CAD blocker.
- **Fix direction (NOT applied):** only include `components` in the payload when the fabrics/components actually changed (the `fabricsModifiedRef` already exists — it just isn't consulted for the payload, only for validation).

### BH-0143 [S1][CONFIRMED] Removing a customer's accessory preset doesn't stick — the accessories come back
- **File:** [StyleFormRedesigned.tsx:2162](../../frontend/src/pages/StyleFormRedesigned.tsx#L2162) · **Class:** form-state · **Found/verified:** iter 28
- **Scenario:** you pick "None (Clear Preset)", the accessories disappear from the screen, and the save says "Style updated successfully". But the payload sends the preset id as `undefined` rather than `null` — so the key is stripped from the request entirely and the database column is **never touched**. The old preset link survives. Next time anyone opens that style, the stale link is read and every accessory you deleted is quietly merged back into the form; the next save makes them permanent. So a customer's packaging and labels can't actually be removed. Every other nullable link in the same payload uses `|| null`, and the backend has a comment directly above warning *"Do NOT use ternary operators for nullable foreign keys"* — this field uses one anyway.
- **Fix direction (NOT applied):** send `|| null`, matching the sibling fields.

### BH-0145 [S1][CONFIRMED] 💰 Every fabric cost with shrinkage is understated — the formula is wrong
- **File:** [FabricCostingPage.tsx:698](../../frontend/src/pages/FabricCostingPage.tsx#L698) · **Class:** money-math · **Found/verified:** iter 29
- **Scenario:** shrinkage cost is computed as `greigeCost × shrinkage%` — an additive markup. But if greige shrinks by *s* during processing, 1 m of greige yields only (1−*s*) m of finished fabric, so the greige cost of 1 m of **finished** fabric is `greigeCost / (1 − s)`. At ₹100/m and 20% shrinkage the page says ₹120/m; the truth is **₹125/m**. At 30% it says ₹130 vs **₹142.86**; at 40%, ₹140 vs **₹166.67**. The understated figure is saved as-is (the backend does no recomputation), approved, and flows into cost sheets and PO prices — so every fabric you cost with a shrinkage percentage is priced too low, and the error grows with the shrinkage.
- **The tell:** this same page computes the greige *requirement* correctly as `fabricReq / (1 − shrinkage/100)`. The codebase already knows shrinkage compounds — it just doesn't apply that to the cost.

### BH-0146 [S1][CONFIRMED] 💰 An approved printed-fabric cost gets silently overwritten with a hardcoded default rate — just by opening the page
- **File:** [FabricCostingPage.tsx:447](../../frontend/src/pages/FabricCostingPage.tsx#L447) · **Found/verified:** iter 29
- **Scenario:** there is **no database column** for the per-screen rate, so the real negotiated rate (originally pulled from the processor's rate card) is never saved. On load the page nulls it and falls back to a **hardcoded default** (₹3,000 for rotary, ₹1,100 for flat-belt) instead of the true rate (say ₹2,200). And it recalculates automatically: an effect re-runs every row whenever the order quantity changes, and the quantity auto-populates from the last saved value on open. Save after that and the wrong total is written back to the **same approved row** — the backend never resets the approval status, and the page has no approval or lock guard anywhere. So a cost that's actively pricing your POs gets corrupted, and it still says "approved".

### BH-0149 [S1][CONFIRMED] 🚨 Cost sheets are broken — creates fail, and **edits silently save nothing while reporting success**
- **File:** [styleCosting.schema.ts](../../backend/src/schemas/styleCosting.schema.ts) · **Class:** zod-drift · **Found/verified:** iter 30
- **Scenario:** the routes validate with **a different schema than the controller parses with**. The validation layer strips unknown keys — so it **deletes `fabricDetails`, `trimsDetails`, `cmtCosts`, `laceDetails` and `accessoriesDetails` from the request** before the controller ever sees them. (Verified by *running the real schema*: a genuine form payload comes out as just `{styleId, purpose, fabricCost: 0, trimCost: 0, laborCost: 0, overheadCost: 0}`.) So **every create fails with a 400**, and — far worse — **every edit silently does nothing**: the update schema is partial, the emptied body passes, the controller falls back to the existing values, and the user gets a **"success" message while nothing they typed was saved**.
- **✅ Confirmed against the live database:** `style_costing` has **0 rows** despite 1,040 styles existing. No cost sheet has ever been saved.
- **Note:** this is the same schema-drift bug as BH-0114 (cost-sheet PO generation, also dead) and BH-0165 (orders). Three features, one root cause — the documented pitfall in your own CLAUDE.md.

### BH-0150 [S1][CONFIRMED] 💰 Smocking cost is counted once, then permanently lost
- **File:** [styleCosting.controller.ts:165](../../backend/src/controllers/styleCosting.controller.ts#L165) · **Found/verified:** iter 30
- **Scenario:** smocking is summed into the CMT total (and that total is saved) — but the smocking cost itself is **never written to its own column**, so it stays at zero. Reopen the sheet and the CMT total recomputes *lower*; any later save — even one that only touches the notes — makes the reduction permanent. The cost silently evaporates from the CMT total, subtotal and product cost, and work-order costing reads the always-zero column downstream.

### BH-0157 [S1][CONFIRMED] 💰 A job-work PO can go out in one processor's **name** while priced at another's **rate**
- **File:** [UnifiedRequirementsPage.tsx:2012](../../frontend/src/pages/UnifiedRequirementsPage.tsx#L2012) · **Class:** money-math · **Found/verified:** iter 32
- **Scenario:** the Processing and Service "Manual PO" dialogs list **every** processor with no check against the requirement's assigned one, and show **no rate, price or total** before you click Generate. The backend then makes it worse: for processing, the rate is resolved as `req.processorId || req.preferredSupplierId || supplierId` — it **prioritises the requirement's own processor's rate** — while the PO header is created with whoever you picked in the dialog. For service POs, the price comes from a rate card resolved earlier, independent of your choice. So the PO is addressed to Processor X and priced at Processor Y's rate, with nothing on screen to reveal it.
- **⚠️ This corrects BH-0084.** For plain *material* requirements the backend **does** price against the supplier you chose and blocks zero-price items — so there's no silent wrong price there. The genuine mismatch is in the **processing and service** paths. (Verification catching my own earlier over-claim.)

### BH-0158 [S1][CONFIRMED] "Re-calculate MRP" feeds orders that already have live POs into the unguarded recalculation
- **File:** [UnifiedRequirementsPage.tsx:512](../../frontend/src/pages/UnifiedRequirementsPage.tsx#L512) · **Found/verified:** iter 32
- **Scenario:** the button builds its order list from **every requirement on the page with no status filter** — so orders already marked PO_GENERATED go in with the pending ones. The backend cancels them all and then **reuses the cancelled row**, flipping a requirement that is still attached to an issued purchase order back to "needs PO". It reappears in the list asking to be bought again. The confirm dialog's reassuring wording ("existing non-final requirements will be refreshed") badly understates this.

### BH-0165 [S1][CONFIRMED — ⚠️ please sanity-check this one against reality] Order creation *and* editing both fail validation
- **File:** [order.schema.ts:16](../../backend/src/schemas/order.schema.ts#L16) · **Class:** zod-drift · **Found/verified:** iter 34
- **Scenario:** verified by **executing the real schemas** against the exact payloads the order form builds. **Create:** the item schema requires a `quantity` field; the form sends `{styleId, unitPrice, totalQuantity, breakup}` — no `quantity`. **Update:** the update schema requires `id` **in the request body**; the form only puts it in the URL. Validation runs before the controller in both cases, so both 400. The skeptic checked for route-shadowing (a real problem elsewhere here) and for alternate creation paths and found none.
- **✅ CAVEAT RESOLVED — confirmed against the live database.** I queried it read-only: the `orders` table has **0 rows**, while `styles` has 1,040 and suppliers/customers/challans/stock are all populated. Orders are **not** being created through any path. The earlier "but the business has orders" worry was wrong — it doesn't. This finding stands, and it explains why.
- **Fix direction (NOT applied):** align the schema with the payload (accept `totalQuantity`/`breakup`, drop the body-level `id` requirement).

## S2 — Wrong Results / Unvalidated Writes

### BH-0221 [S2][CONFIRMED] The entire Dyeing/Printing "Process PO" workflow is unreachable — every button 404s, because the pages were never built
- **File:** [DyeingList.tsx:738](../../frontend/src/pages/DyeingList.tsx#L738) · **Class:** dead-stub · **Found/verified:** iter 42 · **DB-checked**
- **Scenario:** *New Process PO*, *Quality Check*, *Return Unprocessed* and the row-click view all navigate to routes that **do not exist**. `App.tsx` registers only the two bare list pages, then a catch-all `*` → NotFound — so every click lands on the 404 page. Searching the whole frontend for a `ProcessPO*.tsx` component finds **nothing**: the pages were never written. `PrintingList` is identical.
- **The backend, meanwhile, is finished:** `POST /dyeing/process-pos` is registered and validated, and `createProcessPO` is a complete transactional handler. The frontend service function `dyeingService.createProcessPO` even exists — with **zero call sites**.
- **Live-data confirmation:** `job_work_orders` = **0 rows**, `fabric_processing` = **0 rows** — the fingerprint of a feature nobody can reach.
- **Skeptic:** searched exhaustively for an escape hatch — nested/index/wildcard routes, `lazy-routes.tsx`, any other route-config file, an inline dialog on the list pages, a JobWorkDashboard path, any call site of the create API. **All empty.**
- **Fix direction (NOT applied):** build the four missing pages (or at minimum wire creation to a dialog on the list page) and register the routes. **Cheapest large feature-recovery in the report — the hard half is already done.** Fix BH-0222 in the same pass, or you'll ship an S1 the day the screen goes live.

### BH-0223 [S2][CONFIRMED] "Send to Mill" consumes stock first and sets the status last — a mid-way failure lets a retry consume it twice
- **File:** [dyeing.controller.ts:1659](../../backend/src/controllers/dyeing.controller.ts#L1659) · **Class:** atomicity · **Found/verified:** iter 42
- **Scenario:** the handler checks `status !== 'READY_TO_SEND'`, then calls `consumeGreigeStock` — which **commits immediately**, outside any transaction — then does several more awaits (fabric-master create, challan create) and only at the very *end* sets `status = 'AT_MILL'`. If anything in between throws, the request 500s but the status is still `READY_TO_SEND`, because that update never ran. The user clicks *Send to Mill* again, passes the same guard, and **consumes the greige a second time for one physical dispatch.** Same shape as BH-0010. Dormant today; goes live with BH-0221.
- **Fix direction (NOT applied):** wrap the send in one `$transaction` and put the expected status in the update's where-clause.

### BH-0215 [S2][CONFIRMED] Issuing fabric on two challans from the same lot at once silently loses one deduction
- **File:** [challan.service.ts:280](../../backend/src/services/challan.service.ts#L280) · **Class:** race · **Found/verified:** iter 41
- **Scenario:** `issueChallan` reads `quantityAvailable`, does the maths in JS, and writes back an **absolute** value instead of using Prisma's atomic `{ decrement }`. Lot X has 500 m; two work orders draw from it at once (200 m and 150 m). Both read 500; one writes 300, the other overwrites with its stale 350. True consumption was 350 m but stock records only 150 m — **200 m of fabric silently un-consumes itself.**
- **Why this one isn't graded down like other races:** the enclosing transaction is *long* — it loops every challan item, calls `stockMovementService`, and updates `fabric_processing` and service requirements. The read-to-write window is wide, not a millisecond click race. (Distinct from BH-0015, which is the same anti-pattern in the *greige* branch.)
- **Fix direction (NOT applied):** `quantityAvailable: { decrement: qty }, quantityConsumed: { increment: qty }` — atomic, and it removes the read entirely.

### BH-0216 [S2][CONFIRMED] A work order can NEVER be completed — the check waits for a production stage the app never sends
- **File:** [workOrder.service.ts:604](../../backend/src/services/workOrder.service.ts#L604) · **Class:** status-machine · **Found/verified:** iter 41 · **DB-checked (dormant)**
- **Scenario:** the only code that sets a work order to COMPLETED fires when `productionStage === ProductionStage.PACKING`. But the app's only stage-tracking UI has **no PACKING option in its dropdown** — it goes … IN_FINISHING → READY_TO_SHIP → SHIPPED → COMPLETED. A repo-wide grep finds `ProductionStage.PACKING` referenced in exactly **one** place: that dead comparison. So no matter how a user records progress, `status` never flips to COMPLETED, `completedQuantity` and `actualEndDate` are never populated, and every dashboard keyed off work-order status permanently under-reports finished work. Selecting the literal `COMPLETED` stage doesn't satisfy `=== PACKING` either. Root cause is enum-name drift: the schema carries *both* CUTTING and IN_CUTTING, *both* PACKING and COMPLETED — the backend checks one member of each pair while the frontend sends the other.
- **Skeptic:** hunted for any other path that completes a work order. The generic `PUT /work-orders/:id` *would* accept `status`, but `WorkOrderForm` never sends one and refuses to render its edit form unless status is PENDING. **There is no UI path, automatic or manual, that completes a work order.**
- **Status:** dormant — 0 work orders exist (downstream of the dead orders feature). It bites the moment the module is used.

### BH-0206 [S2][CONFIRMED] SYSTEMIC — the serializer renames `_count` to `count`, so every record-count badge in the app is blank or zero
- **File:** [serializer.ts:138](../../backend/src/utils/serializer.ts#L138) · **Class:** serializer · **Found/verified:** iter 40 · **Proved by executing the real serializer**
- **Scenario:** `serializer.ts` calls `humps.camelizeKeys` with a `process` hook that spares **only UUID keys** — nothing exempts underscore-prefixed keys, and `humps.camelize('_count') === 'count'`. So Prisma's `_count` aggregate reaches the frontend as `count` (and its children are relation-mapped too: `_count.customers` → `count.customer`). **Every** frontend read of `._count` is `undefined`. Verified: `{id, name, _count:{customers:3}}` serializes to `{id, name, count:{customer:3}}` — the `_count` key is absent from the output.
- **Blast radius — 18 read-sites across 10 pages:**
  - **Displays a hard `0`** (actively wrong, not merely missing): Agent List (Customers), Agency List (Agents), Component Group Master (Components), Greige List (*N* fabrics), Sale Order List (Items), Stock Production Order List (Work Orders).
  - **Renders nothing — the whole Stats column silently vanishes** (these guard with `_count && …`): Customer List, Customer Detail (Orders/Quotations/Invoices), Supplier List, Supplier Detail (POs/Materials/GRNs).
- **Why it matters beyond cosmetics:** a supplier with 12 open POs shows a blank or zero linkage count — exactly the signal a user would rely on before deciding a master record is safe to deactivate.
- **Invisible to `tsc`:** every frontend type declares `_count?`, so the wrong code and the wrong type agree and the compiler stays silent. This is the class BH-0205 describes.
- **Fix direction (NOT applied):** in the `process` hook, return the key untouched when it starts with `_`. **One line fixes all 18 sites and prevents recurrence.**

### BH-0209 [S2][CONFIRMED] Recording a customer payment isn't atomic — a crash leaves the payment recorded but the invoice unpaid
- **File:** [invoice.service.ts:658](../../backend/src/services/invoice.service.ts#L658) · **Class:** atomicity · **Found/verified:** iter 40
- **Scenario:** `recordPayment` does `payments.create` and then `invoice.update` (paidAmount / balanceAmount / status) as two sequential awaits with **no `$transaction`**, and the catch block only logs and rethrows — it never deletes the payment row it just created. A connection drop, statement timeout, deadlock or deploy in between leaves the payments table permanently recording e.g. ₹25,000 received, while the invoice still reads `paidAmount = 0`, status PENDING/OVERDUE. Collections then chases a customer who has already paid, and (via BH-0208) that OVERDUE status also drops the invoice out of GSTR-1. Needs no second user — this is crash-consistency, not a race.
- **Fix direction (NOT applied):** wrap both writes in a single `prisma.$transaction`.

### BH-0205 [S2][CONFIRMED] ⚠️ Your TypeScript errors are 92% noise — and the real bugs are invisible to the compiler
- **File:** frontend typecheck snapshot · **Class:** process · **Found/verified:** iter 39
- **Scenario:** I triaged all 50 "property does not exist" errors. **Only 4 were real bugs.** The other 46 are code that works **correctly** against the true API shape, flagged only because a stale local TypeScript interface still declares the *pre-serializer* field name. That's why nobody triages this list — it cries wolf.
- **The dangerous part:** the genuinely broken code often **isn't flagged at all**, because the wrong code and the wrong type *agree with each other*. In BH-0201 the compiler flags the **one correct line** and stays silent on the **three broken ones**.
- **Consequence:** you cannot use `tsc` to find serializer bugs. Your stale frontend types are actively harmful — they hide real bugs and manufacture false ones. **Regenerating the frontend types from the actual serialized responses fixes both problems at once** (you already have a `/generate-types` skill for this).

### BH-0201 [S2][CONFIRMED] "Linked Styles" on a purchase order is always empty for MRP- and production-sourced POs
- **File:** [PurchaseOrderDetail.tsx:227](../../frontend/src/pages/PurchaseOrderDetail.tsx#L227) · **Found/verified:** iter 39
- **Scenario:** the badges that trace a PO back to its style are permanently empty for anything generated via MRP or a production run — the code reads `.styles` where the serializer renames the relation to `.style`. This is the exact bug described above: three broken lines the compiler can't see, and one correct line it flags.

### BH-0166 [S2][CONFIRMED] Editing an order shows **zero** quantities for any size whose id changed
- **File:** [OrderForm.tsx:321](../../frontend/src/pages/OrderForm.tsx#L321) · **Found/verified:** iter 34
- **Scenario:** the size grid matches saved quantities by id, then falls back to matching **by name** — but that fallback reads `b.sizes` / `b.colors`, and the serializer's mapping for those was **deliberately removed** (it now returns `sizeOptions`/`colorOptions`). So the fallback is always undefined and never fires: any row whose size id has changed silently loads as **0**. The frontend type still declares the old names, so TypeScript never flagged it. Today the harm stops at a misleading display because saving is blocked by BH-0165 — **the moment that's fixed, saving would overwrite the real historical quantities with zeros.** Fix both together.

**✅ Bounded:** the order form is strictly single-style (one item per order), so BH-0098's whole-order-total 5× overbuy is **not reachable** from it. It would only go live via a bulk import, a direct API call, or a future multi-line order UI.

### BH-0144 [S2][CONFIRMED] Reducing the component count leaves an invisible "ghost" component that still gets saved
- **File:** [StyleFormRedesigned.tsx:2072](../../frontend/src/pages/StyleFormRedesigned.tsx#L2072) · **Found/verified:** iter 28
- **Scenario:** the code that syncs the component list only **pads** when the count grows — it never trims when it shrinks. Drop from 3 components to 2 and the third vanishes from the screen, so it looks deleted. But the save maps over the *whole* array, so that invisible component **and its fabric** are still written — alongside a component count of 2 that contradicts them. The style ends up carrying fabric consumption nobody can see or edit.

### BH-0140 [S2][CONFIRMED] The style form has no stale-data protection at all
- **File:** [StyleFormRedesigned.tsx:2171](../../frontend/src/pages/StyleFormRedesigned.tsx#L2171) · **Found/verified:** iter 27
- **Scenario:** the form never records `updatedAt`, never sends a version header, and never refetches on focus. Two people open the same style; the one who saves *second* — from a tab loaded earlier and never refreshed — silently overwrites the other's work, and **both see "Style updated successfully"**. The backend has no version check either (BH-0101), so neither layer protects the other.

### BH-0131 · BH-0132 · BH-0133 [S2][CONFIRMED] (iter 25) Stock movement: valuation, errors, and the ledger
- **BH-0131** ([stockMovement.service.ts:104](../../backend/src/services/stockMovement.service.ts#L104)): stock **adjustments never recompute `stockValue`** (it's only updated when a rate is passed, and adjustments never pass one). A +50 correction on 100 units at ₹10 leaves the value at ₹1,000 while the quantity says 150. The valuation report drifts low, and the stale value becomes the baseline for the next weighted-average — so it compounds.
- **BH-0132** ([stockMovement.service.ts:398](../../backend/src/services/stockMovement.service.ts#L398)): "Insufficient stock" is thrown as a plain `Error`, so the middleware treats it as a crash — the user gets a generic **HTTP 500** ("An unexpected error occurred") instead of being told how much stock is actually available, and it fires false error alerts. The rest of the codebase uses proper error classes 128 times; this file is the outlier.
- **BH-0133** ([stockMovement.service.ts:1252](../../backend/src/services/stockMovement.service.ts#L1252)): every GRN row in the Unified Movements ledger shows a **blank rate and value** — the code reads `unitPrice`/`totalPrice` off `grn_items`, which has no such columns (they're one relation away, never included). This was the type error flagged in the very first checker snapshot; now confirmed as a real, user-visible defect.

### BH-0124 · BH-0125 [S2][CONFIRMED] (iter 23) Rate resolution edge cases
- **BH-0124** ([processor-rate-v2.service.ts:933](../../backend/src/services/processor-rate-v2.service.ts#L933)): slab **gaps** are never validated, and a quantity that falls in one gets the **globally cheapest bulk rate** (the fallback grabs the highest slab with no lower bound) — a 550 m job in a 500–600 gap is paid at the 2,000 m+ rate.
- **BH-0125** ([processor-rate-validation.service.ts:107](../../backend/src/services/processor-rate-validation.service.ts#L107)): `slabId: slabId || undefined` **drops the filter** rather than matching NULL (Prisma omits undefined keys), so the rate-drift guard compares your cost sheet against a **different quantity tier's** rate — which can mask a genuine rate rise and let a stale price through to a job-work PO.

### BH-0115 [S2][CONFIRMED] Both PO paths can buy the same material — the anti-duplicate table exists but nothing uses it
- **File:** [costSheetPOGeneration.service.ts:99](../../backend/src/services/costSheetPOGeneration.service.ts#L99) · **Found/verified:** iter 22
- **Scenario:** `po_source_links` exists in the schema *precisely* to unify PO provenance across the cost-sheet and MRP sources — and **neither mainline path writes it**. MRP uses an older separate table; the cost-sheet path references it zero times. There's even a working duplicate-detector (`checkForDuplicatePOs`, blocks unless explicitly overridden) in `unified-po-creation.service.ts` — which **neither flow calls**. So a merchandiser raising a fabric PO from the cost sheet and procurement running MRP for the same order both buy the same fabric, with no warning.

### BH-0116 · BH-0117 · BH-0118 · BH-0119 · BH-0120 [S2][CONFIRMED] (iter 22) Cost-sheet PO math and lifecycle
- **BH-0116**: greige shrinkage is missing here too (same as MRP) — the lace branch in the *same file* does it correctly and even throws if shrinkage is unset; the fabric branch doesn't query it at all.
- **BH-0117**: the greige-lace shortfall subtracts the **finished** lace's stock instead of the greige lace's own — 500 m of unrelated finished lace shrinks a 1,111 m greige order to 611 m.
- **BH-0118**: the processor rate-drift guard checks the cost sheet's **original** processor, not the one you're actually raising the PO for — so switching processors passes the price check with the old processor's rate.
- **BH-0119**: resubmitting (double-click, back-then-resubmit) creates a **second duplicate PO**; the reuse lookup can't find the first one once it's linked.
- **BH-0120**: PO numbers are generated outside the transaction with no lock (same as MRP), and a failed insert leaves an orphaned generation row.

### BH-0108 [S2][CONFIRMED] Valid GRN quantities are rejected by floating-point equality — clerks are pushed into fudging numbers
- **File:** [grn.service.ts:95](../../backend/src/services/grn.service.ts#L95) · **Class:** money-math · **Found/verified:** iter 21
- **Scenario:** quantities are stored with 3 decimals but validated as plain floats with `!==`. `499.007 + 161.519` evaluates to `660.5260000000001`, so a mathematically correct entry is rejected with "Accepted + Rejected must equal Received". The skeptic's Monte Carlo put the failure rate at roughly **20–25% of realistic entries** — not a rare edge case. The frontend already uses a tolerance-based check for the same rule, so entries that pass client validation get bounced by the server, and the clerk's only way through is to change a digit — which then persists into stock valuation and PO reconciliation.
- **Fix direction (NOT applied):** compare with an epsilon (or in Decimal), matching the frontend's existing check.

### BH-0109 · BH-0110 · BH-0111 [S2][CONFIRMED] (iter 21) More GRN integrity gaps
- **BH-0109** ([grn.service.ts:1012](../../backend/src/services/grn.service.ts#L1012)): specialized stock lots are created with the **stale pre-approval warehouse** (12 sites read the old snapshot), so the GRN and audit trail name one warehouse while the actual stock lot has none.
- **BH-0110** ([grn.service.ts:1788](../../backend/src/services/grn.service.ts#L1788)): double-clicking **Reject** decrements the PO's received quantity twice with no floor — it goes **negative**, which then *inflates* how much over-receipt the next GRN is allowed to accept.
- **BH-0111** ([grn.service.ts:85](../../backend/src/services/grn.service.ts#L85)): the over-receipt tolerance is checked against a stale snapshot, so two concurrent GRNs of 900 against a 1,000-unit order both pass a 10% cap and jointly book **1,800**.

### BH-0101 · BH-0102 [S2][CONFIRMED] (iter 20) Style edits lose data
- **BH-0101** ([style.service.ts:848](../../backend/src/services/style.service.ts#L848)): the update deletes all children and recreates from the payload with **no version check**. Two people editing the same style: the second save silently deletes the first's additions (and their CAD/fabric data). No conflict error to anyone.
- **BH-0102** ([style.service.ts:487](../../backend/src/services/style.service.ts#L487)): SKU variants are created in a loop **outside** the style's transaction — a collision on the unique SKU (copy-style flows, retries) leaves the style committed but permanently missing some of its sizes.

### BH-0095 · BH-0096 [S2][CONFIRMED] (iter 19) BOM approval race and permanently-stuck partial BOMs
- **BH-0095** ([order-bom.service.ts:1815](../../backend/src/services/order-bom.service.ts#L1815)): `approve()` checks the status in JavaScript and then updates by id only — no compare-and-swap — and the confirm dialog has no disabled state, so a **double-click fires MRP twice concurrently** and duplicates requirements.
- **BH-0096** ([order-bom.service.ts:321](../../backend/src/services/order-bom.service.ts#L321)): the style-BOM auto-populate loop isn't transactional, and its "have I run before?" check is a row count — so if it fails halfway, the partial rows persist and the population is **skipped forever**. That style keeps an incomplete trim BOM and quietly under-buys on every future order.

### BH-0086 · BH-0087 · BH-0088 [S2][CONFIRMED] (iter 18) MRP purchasing/receipt races
- **BH-0086** ([mrp.service.ts:2172](../../backend/src/services/mrp.service.ts#L2172)): PO numbers are generated on a **separate Prisma client outside the transaction** (select-max + 1, no lock), so two concurrent PO generations collide on the unique number and the second user's whole PO rolls back. A race-safe generator that accepts the transaction already exists in the repo — MRP just doesn't use it.
- **BH-0087** ([mrp.service.ts:2410](../../backend/src/services/mrp.service.ts#L2410)): concurrent GRNs against the same PO item lose a receipt (read-then-absolute-write instead of an atomic increment), so a fully-received requirement never flips to RECEIVED — and combined with BH-0079 becomes eligible to be **ordered again**.
- **BH-0088** ([mrp.service.ts:2924](../../backend/src/services/mrp.service.ts#L2924)): converting a requirement to greige+processing marks the original FULFILLED **before** creating its replacements, with no transaction — a mid-way failure makes the demand vanish entirely: never fulfilled, never re-created, never purchased, no error on the requirement.

### BH-0081 · BH-0082 [S2][CONFIRMED] (iter 17) MRP counts unusable stock as usable
- **BH-0081** ([mrp.service.ts:963](../../backend/src/services/mrp.service.ts#L963)): when no stock exists at the required fabric width, MRP credits stock at *any* width 1:1 against the requirement — 700 m of 44-inch fabric shrinks a 1,000 m requirement at 58 inches down to a 300 m purchase. That fabric can't be cut on the planned marker. The code's own comment says "create split requirement"; no split is ever created.
- **BH-0082** ([mrp.service.ts:900](../../backend/src/services/mrp.service.ts#L900)): availability is never scoped by warehouse, so stock physically sitting at a processor/job-worker or another facility counts as on-hand and suppresses the shortfall.

### BH-0072 · BH-0073 [S2][CONFIRMED] (iter 15) Invoice line rows don't add up; hardcoded bank details can print
- **BH-0072** ([document-generator.service.ts:364](../../backend/src/services/document-generator.service.ts#L364)): each row's Amount/CGST/SGST are rounded to whole rupees independently while the row Total is rounded from the unrounded sum — a row can print `133 + 3 + 3` with a Total of `140`. The TOTAL row likewise prints the exact subtotal while the lines above it were truncated. Grand total is correct; the printed lines just don't reconcile.
- **BH-0073** ([document-generator.service.ts:59](../../backend/src/services/document-generator.service.ts#L59)): if no active primary bank account exists, invoices silently print a **hardcoded ICICI account number**. Reachable through normal admin use — nothing stops you from unchecking "primary" on the only primary account. Customers could pay into the wrong account.

### BH-0062 [S2][CONFIRMED] 🔐 Export endpoint leaks bank account numbers and GST data to any logged-in user
- **File:** [export.controller.ts:106](../../backend/src/controllers/export.controller.ts#L106) · **Class:** zod-drift / access control · **Found/verified:** iter 12
- **Scenario:** `POST /api/export/:module` has **no role check** (only `authenticateToken`; the `authorize()` RBAC helper exists but isn't used) and **no body validation**. The where-clause is built as `{ isActive: true, ...filters }` with `filters` taken raw from the request body — because the spread comes last, a caller can set `isActive: false` to dump soft-deleted rows, or inject arbitrary Prisma operators (`OR`/`AND`/`NOT`, relation filters) with no allowlist. The default export columns for `bank_accounts` include **accountNumber, ifscCode, bankName, openingBalance**, and `customers` includes **gstNumber** — so `POST /api/export/bank_accounts` hands any authenticated user of any role a CSV of real bank details.
- **Fix direction (NOT applied):** allowlist permitted filter keys per module, put `isActive` last (or force it), and add `authorize()` role gating to the export routes. The same missing-role-check pattern exists on the bank-accounts listing route — worth a wider auth audit.

### BH-0047 · BH-0052 [S2][CONFIRMED] (iter 9) Helper default-unit mislabeling + embroidery partial-receive gap
- **BH-0047** ([material-sync.helper.ts:109](../../backend/src/services/helpers/material-sync.helper.ts#L109)): default `unit='PIECE'` stamps meter-based materials' stock_levels rows PIECE forever (most sync call-sites omit the unit argument).
- **BH-0052** ([embroidery-stock.service.ts:323](../../backend/src/services/embroidery-stock.service.ts#L323)): partial receive overwrites instead of accumulating, double-submit orphans the audit link, **and the UI offers no path to receive the balance of a partial receipt** (Receive button gated on SENT only, unlike the sibling handwork/smocking dashboards).

### BH-0036/0037 · BH-0040 · BH-0042 · BH-0043 · BH-0046 [S2][CONFIRMED] Stock-count / trim / movement layer (iter 8 batch)
- **Trim stock-in** ([trim-stock.service.ts:184](../../backend/src/services/trim-stock.service.ts#L184), routes): warehouseId optional+unvalidated → unscoped or skipped sync; `unit` unvalidated → garbage persists, stock_levels create silently fails (also via CSV import).
- **Count/adjustment corrections never reach specialized tables** ([stockMovement.service.ts:547](../../backend/src/services/stockMovement.service.ts#L547)): pages reading greige/trim/thread tables directly show pre-correction quantities forever (db-checked).
- **Lost-update stock math** ([stockMovement.service.ts:89](../../backend/src/services/stockMovement.service.ts#L89)): increase/decreaseStockInTx write absolute values — every generic stock movement can lose a concurrent change.
- **Unbounded phantom stock** ([stockCount.controller.ts:123](../../backend/src/controllers/stockCount.controller.ts#L123)): `physicalQuantity` unvalidated; ADJUSTMENT_IN has no upper bound.
- **Stock IN silently skips specialized row** ([stock-routing.helper.ts:215](../../backend/src/services/helpers/stock-routing.helper.ts#L215)): routing errors swallowed, return ignored — your scratch scripts (verify-unified-view.ts, check-greige-data.ts) exist to chase exactly this symptom.

### BH-0001 [S2][CONFIRMED] createStyleStock writes escape the caller's transaction — challan rollback leaves phantom stock
- **File:** [fabric-stock.service.ts:81](../../backend/src/services/fabric-stock.service.ts#L81) · **Class:** atomicity · **Found/verified:** iter 4
- **Scenario:** `challan.service.ts:558` wraps challan receipt in `prisma.$transaction`, but at `:779` it calls `fabricStockService.createStyleStock`, which uses the module-level prisma client (its signature takes no `tx`). The stock insert commits immediately; if the challan transaction later throws and rolls back, the fabric_stock row survives as a phantom lot, and re-receiving the challan double-creates stock.
- **Skeptic:** searched for a tx-forwarding overload in the call chain — none exists.
- **Fix direction (NOT applied):** add an optional `tx` parameter to `createStyleStock` (and the material-sync helpers) and thread the challan transaction through.

### BH-0003 [S2][CONFIRMED] POST /api/stock never calls ensureMaterialRecord or syncStockLevelQuantity
- **File:** [fabric-stock.controller.ts:136](../../backend/src/controllers/fabric-stock.controller.ts#L136) · **Class:** material-sync · **Found/verified:** iter 4
- **Scenario:** the live manual stock-entry endpoint creates `fabric_stock` + `fabric_stock_transaction` with zero sync calls — every entry via this endpoint is invisible on the Stock Levels page and has no `materials` row. Violates the mandatory Stock Service Pattern (CLAUDE.md).
- **Skeptic:** `syncStockLevelQuantity` is imported at `:23` but invoked only at `:1032` (adjustStock) in the whole file.
- **Fix direction (NOT applied):** call `ensureMaterialRecord` + `syncStockLevelQuantity` after the create, inside one `$transaction`.

### BH-0004 [S2][CONFIRMED] POST /api/stock/adjust silently skips stock_levels sync when materials record is missing
- **File:** [fabric-stock.controller.ts:1030](../../backend/src/controllers/fabric-stock.controller.ts#L1030) · **Class:** material-sync · **Found/verified:** iter 4
- **Scenario:** quantity update always runs (`:1001-1006`); the sync sits inside `if (material)` after a `materials.findFirst` — for stock created via the BH-0003 gap the guard silently no-ops, so fabric_stock and stock_levels drift permanently with no error or log.
- **Fix direction (NOT applied):** replace the guard with `ensureMaterialRecord` (creates the row if missing), then sync unconditionally.

### BH-0005 [S2][CONFIRMED] DELETE /api/stock/:id hard-deletes available lots without reversing stock_levels
- **File:** [fabric-stock.controller.ts:1328](../../backend/src/controllers/fabric-stock.controller.ts#L1328) · **Class:** material-sync · **Found/verified:** iter 4
- **Scenario:** the guard only blocks consumed/reserved stock (`:1310-1314`) — a lot with e.g. 500m *available* is hard-deleted with no `syncStockLevelQuantity` reversal, so stock_levels keeps the credited 500m forever and the Stock Levels page permanently overstates availability.
- **Skeptic:** no triggers, cascades, or soft-delete found in file or schema.
- **Fix direction (NOT applied):** before delete, sync `-quantityAvailable` for the material (or block deletion of lots with available stock).

### BH-0012 [S2][CONFIRMED] createGreigeStock: procurement + stock + sync non-atomic — FK failure orphans a costed procurement row
- **File:** [greige-stock.service.ts:125](../../backend/src/services/greige-stock.service.ts#L125) · **Class:** atomicity · **Found/verified:** iter 5
- **Scenario:** on the direct-create path (`data.tx` undefined) `fabric_procurement.create` commits first; the following `greige_stock.create` can fail on the warehouseId FK (zod validates uuid *format* only), leaving an orphaned procurement row with real costs. The ensure/sync steps afterwards are equally unprotected.
- **Fix direction (NOT applied):** wrap the whole method body in `$transaction` when no tx is supplied.

### BH-0016 [S2][CONFIRMED] adjustGreigeStock lost-update race — both audit rows written, one balance change lost
- **File:** [greige-stock.service.ts:682](../../backend/src/services/greige-stock.service.ts#L682) · **Class:** race · **Found/verified:** iter 5
- **Scenario:** concurrent manual adjustments read the same balance, each writes its own absolute result — one change is silently lost while *both* audit transactions record, making ledger and balance permanently inconsistent.
- **Fix direction (NOT applied):** atomic increment/decrement operators.

### BH-0018 [S2][CONFIRMED] receiveFromProcessor check-then-write race, widened by the controller's own stale pre-check
- **File:** [greige-stock.service.ts:937](../../backend/src/services/greige-stock.service.ts#L937) · **Class:** race · **Found/verified:** iter 5
- **Scenario:** double-submit or two users receiving from the same processor lot clobber each other's decrement (controller does its own read-then-check first, widening the window). Note this path also suffers BH-0011 regardless.
- **Fix direction (NOT applied):** same as BH-0015, single transaction + atomic ops.

### BH-0026 / BH-0027 [S2][CONFIRMED] Lace allocation consume/return ledgers lose concurrent updates
- **File:** [laceStock.service.ts:599](../../backend/src/services/laceStock.service.ts#L599), [:664](../../backend/src/services/laceStock.service.ts#L664) · **Class:** race · **Found/verified:** iter 7
- **Scenario:** allocation counters written as absolutes from stale pre-transaction reads while the physical stock fields update atomically — concurrent consumes/returns desynchronize ledger from stock; returns can double-credit physical stock.

### BH-0031 / BH-0032 [S2][CONFIRMED] POST /api/thread-stock: warehouseId never read + no validateBody at all
- **File:** [thread-stock.routes.ts:96](../../backend/src/routes/thread-stock.routes.ts#L96) · **Class:** material-sync / zod-drift · **Found/verified:** iter 7
- **Scenario:** manual thread stock is stored with `warehouseId: null` and synced unscoped (all-warehouse corruption or silent skip for new materials); the route has no zod schema so fields like `unit` persist any string, mis-bucketing downstream unit conversions.

### BH-0033 [S2][CONFIRMED] GRN thread sync targets the wrong materials.id for bulk-imported threads — silent FK failure
- **File:** [grn.service.ts:1384](../../backend/src/services/grn.service.ts#L1384) · **Class:** material-sync · **Found/verified:** iter 7
- **Scenario:** the sync uses `thread.id` while bulk-imported threads have `materials.id = 'mat-<code>'`; the helper's FK-violating insert is swallowed — GRN shows ACCEPTED, stock_levels permanently misses the quantity.

### BH-0034 [S2][CONFIRMED] All GRN specialized-stock creation happens after the approval transaction commits, failures swallowed
- **File:** [grn.service.ts:909-1757](../../backend/src/services/grn.service.ts#L909) · **Class:** error-swallow · **Found/verified:** iter 7
- **Scenario:** GRN status commits ACCEPTED first; then one giant post-commit try block creates specialized stock for **all 10 material categories** on the bare client, with a single catch that only logs. Any failure = accepted GRN with no stock anywhere and no operator signal or retry.
- **Fix direction (NOT applied):** move stock creation inside the transaction, or record failed items in a retry table surfaced in the UI.

### BH-0058 [S2][CONFIRMED] Approved stock counts can be reopened and re-approved — adjustments double-apply
- **File:** [stockCount.service.ts:293](../../backend/src/services/stockCount.service.ts#L293) · **Class:** zod-drift · **Found/verified:** iter 10
- **Scenario:** `startCounting` has no status guard (unlike `cancelStockCount`, which correctly treats APPROVED as terminal). Verified full cycle via ordinary endpoints: reopen an APPROVED count → resubmit any item (progress flips straight back to COUNTED since quantities persist) → verify → approve again → every variance adjustment re-applies. Compounds BH-0041.
- **Fix direction (NOT applied):** guard startCounting to DRAFT-only and add an already-approved check to approveStockCount.

### BH-0061 [S2][CONFIRMED] Processing batches have no working stock-reconciliation path — frontend's receive call 404s
- **File:** [processingBatch.service.ts:506](../../backend/src/services/processingBatch.service.ts#L506) · **Class:** atomicity · **Found/verified:** iter 11
- **Scenario:** `completeBatch`/`cancelBatch` have no status guards and complete leaves in-process quantity dangling. The only method that creates stock from a processed batch (`receiveProcessedLace`, transactional and correct) is wired to **no route** — the frontend calls `/receive-lace`, which doesn't exist, so it 404s. Deliveries only shuffle counters. Net: processed goods can never land in stock through this module.
- **Fix direction (NOT applied):** register the receive route (and generalize it beyond lace), add status-transition guards.

### BH-0066 [S2][CONFIRMED] 🔐 BOM write routes have no role guard — any authenticated user can rewrite costing/MRP data
- **File:** [style-material-bom.routes.ts:32](../../backend/src/routes/style-material-bom.routes.ts#L32) · **Class:** access control · **Found/verified:** iter 14
- **Scenario:** the BOM create/update/delete routes apply only `authenticateToken` — no `authorize()` — while the sibling `style.routes.ts` gates every equivalent write with `authorize(ADMIN, MERCHANDISER)`. BOM rows feed costing, MRP, order-BOM and material-requirement services, so any low-privileged role (sales, quality, floor supervisor) can silently corrupt company-wide cost and requirement data via a direct API call. Combined with BH-0067, they can write *negative* quantities. The shipped UI uses the properly-gated nested style endpoints, so this is an unguarded legacy/parallel endpoint.
- **Fix direction (NOT applied):** add `authorize(UserRole.ADMIN, UserRole.MERCHANDISER)` to match style.routes.ts, and add a zod schema with `nonnegative()`.

### BH-0075 [S2][CONFIRMED] Challans print impossible 3-decimal rupee amounts
- **File:** [document-generator.service.ts:3970](../../backend/src/services/document-generator.service.ts#L3970) · **Class:** money-math · **Found/verified:** iter 16
- **Scenario:** challan quantities are stored with 3 decimals (fold/metre-based fabric) so `qty × rate` genuinely produces more than 2 decimals — and the amount is formatted with `minimumFractionDigits: 2` but **no** `maximumFractionDigits`, which JavaScript defaults to 3. So 12.345 m × ₹45.67 prints as **₹563.796** instead of ₹563.80, and the challan TOTAL prints ₹606.986. Verified empirically. Every currency format call in this file omits the max setting; the challan is where it actually surfaces because its quantities carry 3 decimals.
- **Fix direction (NOT applied):** add `maximumFractionDigits: 2` to the currency formatters and round `qty × rate` to paise before summing.

### BH-0135 [S2][CONFIRMED] ⚠️ Route shadowing: your *tested* purchase-order handlers are dead code
- **File:** [routes/index.ts:267](../../backend/src/routes/index.ts#L267) · **Found/verified:** iter 26
- **Scenario:** two route files are both mounted at `/purchase-orders` and both define `PATCH /:id/send`, `/acknowledge` and `/cancel`. The first one registered wins, and its handlers respond directly — so Express **never reaches** the handlers backed by `po-status-manager.service.ts`. That shadowed service is **the one with unit tests**, and its guards are *stricter* (its cancel explicitly refuses a partially-received PO; the live one allows it). The tests import the functions directly, so they pass — giving confidence about code that never runs. Worth a repo-wide check for other duplicate mounts.
- **Fix direction (NOT applied):** decide which implementation is canonical, delete or re-path the other, and point the tests at the live one.

### BH-0136 · BH-0137 · BH-0138 [S2][CONFIRMED] (iter 26) PO lifecycle races and tax
- **BH-0136** ([purchaseOrder.service.ts:819](../../backend/src/services/purchaseOrder.service.ts#L819)): cancel reads the status, then writes **unconditionally** — a GRN that finishes receiving in between has its RECEIVED status silently overwritten to CANCELLED. Send has the same shape in reverse (a cancelled PO can be resurrected to SENT).
- **BH-0137** ([purchaseOrder.service.ts:386](../../backend/src/services/purchaseOrder.service.ts#L386)): the status is validated *outside* the transaction, so a concurrent send lets **quantities and prices change on a PO the supplier already has**.
- **BH-0138** ([gst.service.ts:352](../../backend/src/services/gst.service.ts#L352)): the interstate check **swallows any lookup error and defaults to "not interstate"** — so a transient failure taxes an interstate PO as CGST+SGST instead of IGST, on the supplier's document and in your GST filing, with nothing surfaced.

### BH-0154 [S2][CONFIRMED] 💰 The GST% you edit — and the total you confirm — is never sent to the server
- **File:** [PurchaseOrderForm.tsx:923](../../frontend/src/pages/PurchaseOrderForm.tsx#L923) · **Class:** money-math · **Found/verified:** iter 31
- **Scenario:** the PO form has an **editable per-item GST%** (defaulting to a hardcoded 5), and the items table, the tax summary *and the Confirm & Send preview* all compute the grand total from it. But the save payload omits it — and it's structurally impossible for it to ever reach the server: the request type, the validation schema and the backend DTO **all lack the field**. The server recomputes GST from the material master instead. So a buyer who sets 12% reviews and confirms **₹22,400**, while the purchase order is saved and sent to the supplier at **₹21,000**. The GST input is a control wired to nothing.
- **Fix direction (NOT applied):** either wire it through (`gst.service` already has a `gstRateOverride` parameter that nothing passes) or remove the input so the form stops promising a number it can't deliver.

**✅ Clean bill of health:** the PO create/update path was explicitly checked for the schema-drift disease that killed cost sheets (BH-0149) and cost-sheet PO generation (BH-0114) — all four layers line up and nothing is stripped. That pattern is bounded to those two known instances, not systemic.

### BH-0162 [S2][CONFIRMED] The stock-in unit dropdown offers "Roll" — a unit the system doesn't have
- **File:** [StockInForm.tsx:766](../../frontend/src/pages/StockInForm.tsx#L766) · **Found/verified:** iter 33
- **Scenario:** the unit list offers **Roll** for greige, fabric, lace and elastic — but `ROLL` exists in **neither** the validation enum **nor** the database enum, and nothing maps it to anything else. So picking it produces a 400, and because validation runs over the whole items array before anything is saved, **one "Roll" line rejects the entire bulk receipt** — every other valid line with it. Rolls are how fabric physically arrives, so this is exactly the unit a warehouse clerk reaches for.
- **Fix direction (NOT applied):** either add ROLL to the enums (with a conversion) or remove it from the dropdown.

## S3 — User-Visible Errors / Staleness

### BH-0224 [S3][CONFIRMED] You can receive more fabric back from the mill than you ever sent — and it becomes real stock
- **File:** [dyeing.controller.ts:1892](../../backend/src/controllers/dyeing.controller.ts#L1892) · **Class:** quantity-math · **Found/verified:** iter 42
- **Scenario:** nothing compares the received quantity against `qtySentMeters` — not the Zod schema (only `.nonnegative()`), not the controller. Fat-finger 5000 m instead of 500 m on a 500 m dispatch: it's accepted, records a nonsensical large *negative* shrinkage, and the update-stock step converts it 1:1 into a real `fabric_stock` lot production can consume. **4,500 m of fabric conjured from a typo.** S3 rather than S1 only because it needs a data-entry error and the module is currently unreachable.
- **Fix direction (NOT applied):** bound `qtyReceivedMeters` against `qtySentMeters` (allow a sane over-delivery tolerance) and reject negative computed shrinkage.

### BH-0225 [S3][CONFIRMED] The Processing Batch module is a shell — "New Batch" 404s and the detail page never loads
- **File:** [ProcessingBatchDetail.tsx:1](../../frontend/src/pages/ProcessingBatchDetail.tsx#L1) · **Class:** dead-stub · **Found/verified:** iter 42
- **Scenario:** *New Batch* navigates to an unregistered route (404). The `:id` route *is* registered, but the detail page's entire body is a hardcoded `<div>Loading batch details...</div>` — it never fetches anything, so it spins forever. The only working part of the module is the read-only list; every stage/movement/delivery/cancel/complete action the backend supports is unreachable. Stranded backend work: `receiveProcessedLace` is fully implemented (correct `$transaction`, creates `lace_stock`, computes shrinkage variance) with no controller and no route — while the frontend service calls a URL that would 404. Dead on both ends.
- **Fix direction (NOT applied):** decide if the module is wanted. If yes, finish the detail page and register the create route. If not, **remove the sidebar entry** so nobody walks into a dead end.

### BH-0217 [S3][CONFIRMED] Work-order numbers can silently duplicate — no unique constraint backs the generator
- **File:** [workOrder.service.ts:74](../../backend/src/services/workOrder.service.ts#L74) · **Class:** race · **Found/verified:** iter 41
- **Scenario:** the classic findFirst-max-then-+1, with the read and the create outside any transaction. Unlike `challanNumber` and `invoiceNumber` — both `@unique`, which is precisely why their identical races are **dead** — `work_orders.workOrderNumber` has only `@@index`, **no unique constraint**. So a duplicate insert succeeds *silently*: two different production runs share one work-order number, corrupting search, paperwork and every report that prints it. (The within-request loop is safe — `for…of` with `await` is sequential — so the race needs two separate concurrent order creations.)
- **Fix direction (NOT applied):** **add `@unique` to `workOrderNumber`.** That one word converts a silent corruption into a loud, retryable error — the same guard that already protects challans and invoices.

### BH-0219 [S3][CONFIRMED] `PUT /work-orders/:id` accepts any status with zero transition validation
- **File:** [workOrder.service.ts:479](../../backend/src/services/workOrder.service.ts#L479) · **Class:** status-machine · **Found/verified:** iter 41
- **Scenario:** the update schema declares `status: OrderStatusEnum.optional()` and the service spreads it straight into `prisma.update`. A caller can jump a work order to COMPLETED, or resurrect a CANCELLED one, **bypassing `productionBlockingValidationService.validateStageTransition`** — which the tracking endpoint enforces on every stage change. The controller also treats `status === COMPLETED` here as the trigger for the CMT-actuals recalculation, which is itself not idempotent (BH-0220). Graded S3 only because no shipped page sends `status` on this endpoint today — but it's registered, validated and widely used for legitimate edits, so any script or future page walks straight through.
- **Fix direction (NOT applied):** strip `status` from the update schema; force transitions through the validated path.

### BH-0218 [S3][CONFIRMED] Production tracking writes the audit row and the status update as two unwrapped statements
- **File:** [workOrder.service.ts:559](../../backend/src/services/workOrder.service.ts#L559) · **Class:** atomicity · **Found/verified:** iter 41
- **Scenario:** `production_tracking.create` then a separate `work_orders.update`, with no `$transaction` — even though `splitWorkOrder`, a few hundred lines down the same file, uses one correctly. A crash in between leaves an orphaned tracking row claiming a stage was reached while the work order's own status and dates never moved.

### BH-0210 [S3][CONFIRMED] Two payments recorded on the same invoice at once — one silently vanishes from the balance
- **File:** [invoice.service.ts:681](../../backend/src/services/invoice.service.ts#L681) · **Class:** race · **Found/verified:** iter 40
- **Scenario:** `recordPayment` reads `paidAmount`, adds the new amount in JS, and writes the result as an **absolute value** instead of using Prisma's atomic `{ increment }`. On a ₹50,000 invoice, two clerks recording ₹20,000 and ₹15,000 at the same moment both read `paidAmount = 0`; last writer wins. Both payment *rows* survive (₹35,000 genuinely collected), but the invoice says ₹15,000 paid / ₹35,000 outstanding — understating cash collected and overstating what the customer owes.
- **Skeptic:** **downgraded from the reported S1 to S3.** It's a genuine lost update, but the window is a single HTTP request on a manual, per-invoice action with no bulk or webhook caller — a real but rare collision for a small team. Reported honestly rather than inflated. (A 24h duplicate-amount check blocks *identical* amounts but does nothing for two different legitimate payments.)
- **Fix direction (NOT applied):** `paidAmount: { increment: data.amount }`, deriving balance and status from the post-write value, inside the same transaction as BH-0209.

### BH-0211 [S3][CONFIRMED] The "debit notes must not exceed the PO total" check runs outside the transaction that inserts them
- **File:** [debitNote.service.ts:138](../../backend/src/services/debitNote.service.ts#L138) · **Class:** race · **Found/verified:** iter 40
- **Scenario:** the aggregate check uses the plain client and completes **before** `$transaction` even opens (line 148) — check and write are in different transactions. On a ₹40,000 PO, two concurrent ₹25,000 debit notes both see `existingTotal = 0`, both pass, both insert: ₹50,000 of debit notes against a ₹40,000 PO. No DB check-constraint backs the rule up. Graded S3 (needs two finance users hitting the same PO simultaneously; no bulk path).
- **Fix direction (NOT applied):** move the aggregate inside the `$transaction` and take a row lock on the PO.

### BH-0212 [S3][CONFIRMED] Credit/debit note approve, cancel and delete check the status and then write without re-checking it
- **File:** [creditNote.service.ts:331](../../backend/src/services/creditNote.service.ts#L331) · **Class:** race · **Found/verified:** iter 40
- **Scenario:** the recurring check-then-write shape, in both services: `findUnique` → throw unless DRAFT → `update({ where: { id } })` with **no status in the where-clause**. Two staff act on the same draft moments apart (one approves, one cancels), both guards pass, the last write silently wins and the loser gets no error. A note the team believes was cancelled can end up APPROVED — and `gstReport`'s CDNR export pulls `status: 'APPROVED'` credit notes straight into the GST return. Same pattern at `debitNote.service.ts:342-452`. All three actions verified wired end-to-end (live Approve/Cancel buttons in both list pages).
- **Fix direction (NOT applied):** `where: { id, status: 'DRAFT' }` and treat a P2025 as a 409 — one line, and the database enforces the transition.

### BH-0197 [S3][CONFIRMED] A mistyped negative quantity silently drops that whole line from a GRN — and the clerk is told it saved
- **File:** [GRNForm.tsx:401](../../frontend/src/pages/GRNForm.tsx#L401) · **Found/verified:** iter 38
- **Scenario:** on a two-line receipt, entering 80 for fabric and mistyping **−10** for trims: the overall check passes (one line is positive), the per-item validation loop only examines lines **greater than zero** — so the bad one is never looked at — and the save then **filters it out entirely**. The trims line never reaches the server, the clerk gets a success message, and the trims' pending quantity sits untouched with nothing to indicate it was dropped. The same silent-drop pattern appears in cutting (a negative pieces-per-layer quietly omits that size from the lay).
- **✅ But no stock can be fabricated:** a reviewer claimed a negative *rejected* quantity could inflate *accepted* above what was received (booking 12 m against a 10 m receipt). The skeptic disproved it — the GRN schema declares all three quantities `nonnegative()` and the service re-checks the reconciliation. The form's preview misleads, then the save hard-fails. Guards are sound.

### BH-0164 [S3][CONFIRMED] The stock-in form throws away the server's reply — which is *why* the S1 stock bugs stayed invisible
- **File:** [StockInForm.tsx:641](../../frontend/src/pages/StockInForm.tsx#L641) · **Found/verified:** iter 33
- **Scenario:** the form discards the API response and always shows the same hardcoded "Stock IN created successfully!". The processor-return endpoint **already returns a reconciliation message** — *"Received X MTR from processor. Remaining at processor: Y MTR"* — which would have exposed BH-0011's vanishing quantity the very first time anyone used it. Same for the silent specialized-stock failures (BH-0046). On its own this is only a feedback gap, but it's strategically the most valuable small fix in the report: **display the server's own message and two S1 stock bugs become self-evident instead of silent.**

### BH-0002 [S3][CONFIRMED] createStyleStock create + ensureMaterialRecord are non-atomic — failure orphans a committed stock row
- **File:** [fabric-stock.service.ts:110](../../backend/src/services/fabric-stock.service.ts#L110) · **Class:** atomicity · **Found/verified:** iter 4
- **Scenario:** the `fabric_stock.create` at `:81` commits alone (file has zero `$transaction`); if `ensureMaterialRecord` (`:110`) throws, the catch rethrows without compensating delete — the row exists but stock_levels never counted it, and a user retry duplicates it (the `@@unique` at schema.prisma:4596 doesn't block because `procurementId` is null and NULLs are distinct).
- **Fix direction (NOT applied):** wrap create + ensure + sync in one `$transaction`.

### BH-0007 [S3][CONFIRMED] adjustStock: update, audit row, and sync are three independent writes
- **File:** [fabric-stock.controller.ts:1001](../../backend/src/controllers/fabric-stock.controller.ts#L1001) · **Class:** atomicity · **Found/verified:** iter 4
- **Scenario:** quantity update, `fabric_stock_transaction` audit create, and stock_levels sync each commit alone (no `$transaction` in the file). A crash between steps leaves the quantity changed with no audit trail and/or stale stock_levels.
- **Fix direction (NOT applied):** single `$transaction` around all three.

### BH-0009 [S3][CONFIRMED — upgraded iter 8] syncStockLevelQuantity swallows all its own errors — systemic silent drift
- **File:** [material-sync.helper.ts:105](../../backend/src/services/helpers/material-sync.helper.ts#L105) · **Class:** error-swallow · **Found:** iter 4 (by skeptic) · **Verification:** pending P1-B5 deep-dive
- **Scenario:** the helper's body is wrapped in try/catch that logs instead of throwing ("Don't throw — stock_levels sync failure shouldn't block the primary operation"). Every stock mutation in the system can silently fail to update stock_levels, with no retry queue or reconciliation job. This is the systemic root that makes BH-0003/0004/0005-style drift invisible.
- **Fix direction (NOT applied):** at minimum queue failed syncs for retry, or add a periodic reconciliation job comparing specialized tables vs stock_levels.

## S4 — Latent

### BH-0006 [S4][CONFIRMED] createGenericGreigeStock (dead but exported) creates stock with zero material-sync calls
- **File:** [fabric-stock.service.ts:213](../../backend/src/services/fabric-stock.service.ts#L213) · **Class:** material-sync · **Found/verified:** iter 4
- **Scenario:** no callers exist repo-wide (superseded by GreigeStockService), but the method is still exported and only `@deprecated` in a comment — any future caller silently reintroduces the stock_levels gap.
- **Fix direction (NOT applied):** delete the method or make it throw.

### BH-0008 [S4][CONFIRMED] findFirst-then-create race for virtual RAW fabric_master (unreachable today)
- **File:** [fabric-stock.service.ts:186](../../backend/src/services/fabric-stock.service.ts#L186) · **Class:** race · **Found/verified:** iter 4
- **Scenario:** concurrent calls both get null then both create — `fabric_master` has no `@@unique` on (greigeId, colorName, finishType), so duplicate virtual masters would fragment a greige's stock across two fabricIds. Latent-only: lives inside dead method BH-0006.
- **Fix direction (NOT applied):** add the unique constraint if the method is ever revived.

### BH-0013 / BH-0014 / BH-0017 / BH-0019 / BH-0020 [S4] Greige-stock latent defects (dead or unrouted code)
- **Files:** [greige-stock.service.ts](../../backend/src/services/greige-stock.service.ts) lines 651, 413, 846, 651, 590 · **Found/verified:** iter 5
- **Summary:** `deleteGreigeStock` never reverses stock_levels and its controller method is unrouted (BH-0013, plus TOCTOU with an ON DELETE SET NULL FK contradicting the guard's intent, BH-0019); `reserveGreigeStock` (BH-0014) and `consumeFromProcessor` (BH-0017) carry the same lost-update race but have zero callers; `updateAgingDays` (BH-0020) swallows errors AND is never invoked — no cron infrastructure exists, so greige aging data is permanently stale.
- **Fix direction (NOT applied):** delete or fix-before-wiring; add a scheduler if aging alerts are wanted.

### BH-0064 [S4][CONFIRMED] The `/api/processing` endpoints are orphaned — and carry three stock bugs if ever wired up
- **File:** [fabric-processing.controller.ts:201](../../backend/src/controllers/fabric-processing.controller.ts#L201) · **Found/verified:** iter 13
- **Scenario:** `sendForProcessing` records greige leaving for a mill but never debits greige stock; `receiveFinishedFabric` marks a batch COMPLETED without creating fabric stock (its own JSDoc says it should) and has no status guard, so re-receiving silently overwrites recorded actuals. All three are latent: the endpoints have **zero callers** — the app uses `/processing-batches`, `/dyeing`, `/printing` instead, and the real stock movements happen through the challan flow. Worth deleting or fixing before anyone wires them up.

### BH-0065 [S3][CONFIRMED] Negative lab-dip cost can be saved through the real UI form
- **File:** [laceLabDip.controller.ts:35](../../backend/src/controllers/laceLabDip.controller.ts#L35) · **Found/verified:** iter 13
- **Scenario:** lace lab dip create/update have no zod schema and only truthy checks, so negative `sampleQuantity`/`labDipCost` reach Decimal columns. The quantity field is protected by a browser `min` attribute, but the **cost field has none** — a negative lab-dip cost is genuinely enterable and flows into lace costing.

## Coverage

| Phase | Scope | Batches | Done | Findings |
|---|---|---|---|---|
| P0 | Setup + checker snapshots | 3 | 3 | 0 |
| P1 | Stock atomicity | 5 | 5 ✅ | 55 |
| P2 | Unvalidated routes | 5 | 5 ✅ | 14 |
| **P2-DRIFT** | **Systematic schema-drift audit — procurement, production, stock, finance, CAD** | 5 | **5 ✅** | **27** |
| P3 | Giant untested services | 12 | 12 ✅ | 69 |
| P4 | Giant frontend forms | 13 | 9 | 36 |
| P5 | Typecheck + tooling triage | 7 | 5 ✅ | 5 |
| **P6-SERIALIZER** | **Systematic serializer audit (the class `tsc` cannot see) + GST/tax/invoice money review** | 1 | **1 ✅** | **9** |
| **P6-GEN-SVC-1** | **Challan + work-order services (the live-data module)** | 1 | **1 ✅** | **8** |
| **P6-GEN-SVC-2** | **Processing domain: dyeing, printing, fabric-processing, processing batches** | 1 | **1 ✅** | **6** |
| P6 | Broad sweep (remaining services + pages) | ~42 (generated) | 0 | 0 |
| P7 | Wrap-up | 2 | 0 | 0 |

## Daily Digests

### Day 3 — 2026-07-13 *(the decisive day)*
- **Iterations 33–57** (25 iterations) · **111 new findings** (27× S1, 37× S2, 27× S3, 20× S4) · total 201 → 312.
- **The day's method changed, and that's why it worked.** After finding bugs one at a time, I started **sweeping each recurring class systematically** — enumerating every instance rather than waiting to stumble on the next. Seven classes, each swept end-to-end and *closed*:

| Sweep | Scale | Broken |
|---|---|---|
| Dead buttons / orphaned routes | 244 routes vs 822 nav targets | 16 clusters |
| Reversals that don't reverse | 42 reversal actions | 3 |
| Delete-then-recreate wipes | 47 sites, 22 forms | 2 |
| Double-click / crash safety | 30 check-then-write sites | 4 |
| Cascade danger (new class) | 622 cascading FKs, 132 delete handlers | 7 |
| Numeric precision | ~500 Decimal→float conversions | 3 |
| Auth / authorization | 1,205 routes | 0 unauthenticated |

  **Every sweep produced a bounding result** — the classes are enumerated and closed, not sampled. Several came back *mostly clean*, which is as valuable as the bugs: don't do a Decimal migration, don't fix the harmless idempotent status flips, the front door is locked.
- **The five things that matter most from Day 3:**
  1. **The forensic audit (BH-0294/0295)** — I stopped predicting corruption and found **95,727 metres already unaccounted for**, including **two physically-impossible negative stock levels**. The mechanism: `ensureMaterialRecord` creates **duplicate materials rows**.
  2. **Five data-loss wipes** — all curable with **one** guard change (`!== undefined` → `?.length`). *(Two of the five were later found to be OVERSTATED and were downgraded — see the retractions at the top. The genuinely destructive one is BH-0275: 21 real process-cost rows.)*
  3. **The axios-retry amplifier (BH-0280)** — a `status >= 500` retry condition with no method check silently re-sends POSTs **up to 4×**, multiplying every non-idempotent write in the app.
  4. **The JWT secret is in git** (BH-0251) — rotation alone doesn't remove it from history.
  5. **The dashboards are fabricating numbers** (BH-0257/0258) — every KPI reads zero, and the growth badges are hardcoded literals.
- **Self-correction is a first-class result.** I ran a **false-positive audit on my own report** (0 false positives, but 2 severity overstatements — corrected), and I **overruled my own reviewers' `LIVE` calls five times** when the database disagreed with them.
- **Budget:** no rate-limit backoffs. Git guard clean throughout (44 = 43 baseline + the report directory).


### Day 1 — 2026-07-11
- **Iterations 1–5** · Batches done: P0-B1..B3 (setup, 9 checker snapshots, 272-line grep harvest), P1-B1 (fabric-stock), P1-B2 (greige-stock).
- **New findings: 20** — 3× S1, 7× S2, 2× S3 confirmed; 1× S3 + 2× S4 plausible; 5× S4 confirmed.
- **Headline:** the specialized stock layer has a systemic defect family — services take no `tx` parameter (writes escape callers' transactions: BH-0001, BH-0010), quantity math is read-then-write-absolute (lost-update races: BH-0015, BH-0016, BH-0018), stock_levels sync is skipped or best-effort (BH-0003/0004/0005/0011), and the sync helper swallows its own errors (BH-0009). Worst single bug: **BH-0011 — processor returns vanish from every stock table**.
- **Checker snapshots:** backend tsc = 12 errors (leads for P5-B1: stockMovement.service.ts:1252 reads unitPrice/totalPrice that its Prisma query never selects → NaN at runtime; styleCosting.controller.ts:387 wastagePercent missing). Frontend tsc = 346 lines (down from stale 971-line ts-errors.txt). Backend tsc needed a 4GB-heap rerun (OOM on defaults).
- **Budget events:** none. No rate-limit backoffs. Git guard clean (44 = 43 baseline + docs/bug-hunt).

### Day 2 — 2026-07-12
- **Iterations 6–32** (27 iterations) · Phases **P1, P2 and P3 completed**; P4 (frontend forms) 6 of 13 done.
- **Findings: 142 added** (20 → 162). S1 count rose from 3 to 36.
- **The story of Day 2** is that the money layer is where the bugs live. Three themes:
  1. **Two entire features are dead** and appear never to have worked — cost sheets (creates fail; **edits silently save nothing while reporting success**) and cost-sheet PO generation. Both from the same cause: the route validates with a different schema than the controller parses with, so the payload is stripped. This is the exact "Zod schema-controller drift" pitfall documented in your own CLAUDE.md. A deliberate check confirmed purchase orders are **not** affected — the pattern is bounded to those two.
  2. **Systematically wrong money.** Fabric shrinkage cost uses the wrong formula (×(1+s) instead of ÷(1−s)) so every shrinkage-costed fabric is under-priced; MRP under-buys greige for the same reason; service POs multiply a per-metre rate by a piece count; a 500 m job matches two rate slabs and bills non-deterministically; the amount-in-words on every invoice contradicts the printed total.
  3. **Missing guards everywhere.** Double-clicking Approve on a GRN creates the stock twice; re-running MRP re-orders material already on a PO; two people editing a style silently overwrite each other. The recurring shape is *check the status, then write unconditionally*.
- **Verification did its job:** several plausible S1s were killed on inspection (dead endpoints, UI-gated paths), one skeptic **corrected my own earlier over-claim** (BH-0084 — the wrong-price risk is in processing/service, not materials), and one resolved a contradiction between two reviewers by *executing the real schema* — which is how the cost-sheet bug was found.
- **Budget:** no rate-limit backoffs. Git guard clean throughout (44 = 43 baseline + the report directory).

## Run Health

Limit backoffs: none · Failed batches: none · Git-drift alerts: none · Baseline dirty count: 43
