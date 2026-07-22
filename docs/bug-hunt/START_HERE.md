# START HERE — Bug Hunt, 5-day autonomous run

**Read this page. It is the whole thing in five minutes.**

| File | What it's for |
|---|---|
| **START_HERE.md** *(this page)* | The verdict and the ordered fix plan |
| **[REPAIR_PLAN.md](REPAIR_PLAN.md)** | 🔧 **How to fix the 71,089 m of corrupt stock data** — written against your actual rows |
| [FINDINGS_INDEX.md](FINDINGS_INDEX.md) | **All 420 findings** in one table, by severity, each marked LIVE or DORMANT |
| [BUG_HUNT_REPORT.md](BUG_HUNT_REPORT.md) | The narrative evidence behind the major findings (1,100 lines) |
| `findings.jsonl` | Machine-readable source of truth — full trace + quoted evidence per finding |
| `iterations.log` · `state.json` | Run pacing and progress |

**420 findings · 404 confirmed · 136 S1** — but **the raw count is misleading, and I want to defuse it immediately.**

I re-classified every S1 by what it *actually does to you today*:

| | S1s | What it means |
|---|---|---|
| 🔴 **Corrupting data RIGHT NOW** | **4** | The stock-ledger corruption and its root causes. **This is the only genuine emergency.** |
| 🟠 **Armed** — live data, one action away | **39** | Real data, real risk, but it hasn't fired. A code fix prevents it; **no cleanup needed.** |
| ⚪ **Broken feature** — 400s, corrupts nothing | **37** | Orders, invoices, cost sheets, dispatch… They simply **don't work**. Frustrating, but they destroy nothing — the tables are empty *because* of these bugs. |
| ⚫ Dormant | 2 | Unreachable code. |

**So: 4 things are actively hurting you. 37 "S1s" are features that just don't function.** Those are very different problems, and conflating them would have you firefighting the wrong ones.

**Nothing in your code was changed.** This run was read-only by your instruction: the only files written are in `docs/bug-hunt/`. `git status` shows the same 43 files you left dirty, plus this folder.

---

## 🚨 STOP — your stock data is already corrupt. This is not a prediction.

On the last day I stopped hunting for bugs and went looking for **damage that has already happened** — querying your live database for the specific fingerprints of the bugs I'd documented. I found them.

**Your `stock_levels` table — what the Stock Levels page shows, and what every purchasing decision reads — cannot account for 71,089 metres of stock.** It disagrees with your real greige stock by **68,013 m across 6 materials**, and with your real fabric stock by a further **3,076 m across 2 fabrics**.

> ### 🔁 I had this number wrong, and the reason is almost too perfect
>
> I originally reported **95,727 m**. **The real figure is 71,089 m — I over-counted by 24,638 metres.**
>
> **And I did it by committing the exact bug I was diagnosing.** My central finding below is that a phantom master gets minted per greige, so **"one lot of cloth ends up with two ledgers."** Then, in my own arithmetic, **I counted one lot's discrepancy twice — because it has two ledgers.** GRG-0009 has a real row and a `-RAW` phantom, and I measured each against the full lot total as if they were different materials.
>
> **What doesn't change:** every individual row below is still correct. The negatives are still impossible. **The emergency is still an emergency**, and the repair plan is unaffected — it already merges the phantoms first, which is precisely *why* the number comes down.
>
> **What does change:** the headline was **35% too high**, and you would have quoted it.

| Greige | System says | You actually have | Error |
|---|---|---|---|
| **GRG-0034** Viscose Dobby | **26,153 m** | **9,073 m** | 🔴 **OVERSTATED by 17,080 m** |
| **GRG-0017** Poplin 63″ | **−7,589.6 m** | 23,389.5 m | 🔴 **NEGATIVE** |
| **GRG-0009** Poplin 48″ | **−5,869.5** *(and the unit says PIECE, for a fabric measured in metres)* | 24,637.5 m | 🔴 **NEGATIVE** |
| GRG-0018 / GRG-0042 / GRG-0038 | understated | — | 1,492 / 1,416 / 1,011 m |

**A negative stock level is physically impossible.** You cannot hold minus 7,589 metres of cloth. Those two rows need no interpretation and no business context — they are self-evident proof that the writes are broken.

**GRG-0034 is the one that will cost you money.** The system says you have 26,153 m; you have 9,073 m. Plan a production run against that and you are **17,080 metres short**.

**The mechanism (BH-0296):** `fabric-stock.service.ts:196` mints a **virtual "fabric master"** for each raw greige — a phantom that gets its *own* `materials` row, so **one lot of cloth ends up with two ledgers** (`GRG-0009` and `GRG-0009-RAW`). Receipts credit one; consumption deducts the other; the deducted-only ledger marches past zero into negative.

*(I first blamed `ensureMaterialRecord`, the helper your CLAUDE.md mandates. **I was wrong and I checked** — that helper is sound; it keys on the master's own id and is protected by the primary key. **The fault is entirely in its caller.** So the fix is one file, not a refactor of every stock service.)*

**➡️ [REPAIR_PLAN.md](REPAIR_PLAN.md) has the step-by-step fix**, written against your actual corrupt rows — including the root cause I traced (BH-0296: a *virtual fabric master* is minted per raw greige, giving one lot TWO ledgers; receipts credit one, consumption deducts the other, so it goes negative).

**Two one-line root causes, both in `material-sync.helper.ts`:** it defaults the unit to **`PIECE`** (line 109) in a system measured in metres — that is how a poplin became `-5,869.5 PIECE`. And it decrements with **no floor check**, while `decreaseStock()` *in the same file* validates properly — that is how the quantity went negative. **The correct guard is ten lines away.**

**Also: your database has ZERO check constraints** across 576 money and quantity columns (BH-0301). It should have refused these writes and had no rule telling it to.

✅ **The good news from the same audit:** I also checked for the fingerprints of the *delete*-related bugs — orphaned styles, orphaned BOM lines, phantom stock lots. **All clean.** Nobody has clicked those buttons yet. Those bugs need a code fix but **no data repair**.

---

## 🧩 Why 420 bugs accumulated: **your quality gates are decorative**

This is the single most useful thing I found, because it explains all the rest. Your `CLAUDE.md` describes an automated safety net — a pre-commit hook enforcing the mandatory stock-sync rule, schema-controller alignment, serializer checks. **I audited it. It cannot fail a commit.** Three independent failures, any one of which alone would defeat it:

**1. The documented hook never runs.** `core.hooksPath` points at `.husky/_`, so `.git/hooks/pre-commit` is bypassed. `.husky/pre-commit` runs only `lint-staged` and `smart-check.js`. **Nothing anywhere invokes `scripts/hooks/pre-commit.js`** — the file CLAUDE.md calls the pre-commit hook, the one holding the stock guardrail. It is dead code the team believes is protecting them.

**2. The hook that does run has the same blind spot** — the identical `*stock*.service.ts` filter that skips every controller (see 1c above).

**3. Six of its nine checks return "pass" even when they fail.** They're marked *"Warning only."* And the six that can't block are **exactly** the ones matching this audit's biggest bug classes: stock-sync, schema-controller alignment, serializer mismatches, response structure, type sync, console.log.

Here is the comment that explains everything, sitting in `smart-check.js:119`:

```js
// Return true (warning only) - don't block commits for now since there are legacy mismatches
// Once all mismatches are fixed, change this to return false to enforce
return true;
```

**Enforcement was switched off because violations already existed — and then the violations multiplied.** That's a ratchet failing open. It is the mechanism by which a codebase accumulates 420 bugs while appearing to have guardrails.

> ### 🎯 And here's the proof, in one bug
> I ran your *own* schema-controller checker. It printed **one CRITICAL mismatch** — and it's real: **"Calculate lace options" can never work.** The schema declares `{laceId, quantity}`; the controller needs `quantityPerGarment`, which Zod deletes; the controller then throws *"Missing required fields"* on every single call.
>
> **Your tooling has been reporting this bug all along.** Nobody acted, because a red line that never fails a build is a red line nobody reads.

> ### 🔁 But don't over-read this — I nearly did
> The satisfying conclusion is *"just turn the checker on and it would have caught the Zod-drift bugs."* **I ran it to check, and that's false.** It covers **76 of your 528** mutating routes, and it only compares the schema against the **controller** — so it is structurally blind to **nested item schemas** (where the delivery-note and cutting crashes live) and to **form-vs-schema mismatches** (the rate card, where the schema and controller agree with each other perfectly). It catches **1 of my ~15** Zod-drift findings.
>
> **Turn it on anyway** — it's free and it already finds a real bug. But **the check that would actually have saved you doesn't exist**: a diff of *what each form POSTs* against *the Zod schema on that route*. That one check would have caught **all five** of your broken features.

---

## ⚠️ READ THIS BEFORE YOU FIX ANY 400: **your broken validation is load-bearing**

This is the most important sequencing instruction in the report, and it's the **opposite** of the obvious advice.

Most of this report is broken features that return a 400 and do nothing. The natural reading — **and the one my own fix plan encouraged** — is *"harmless; they corrupt nothing; just fix the schema and the feature comes back."*

**That reading is dangerous. I've now hit it three separate times:**

| The 400 that looks harmless | What it's actually holding back |
|---|---|
| **Stock Adjustment** — form says `quantity`, schema says `adjustmentQuantity`. *Looks like a one-word rename.* | The service behind it **writes `stock_levels` without touching your specialized stock tables.** The 400 is the only thing preventing a live stock desync. |
| **Rate card** — schema says `rate`, page sends `ratePerMeter`. *I called fixing this "the highest-value 15 minutes in this report."* | **Two** bugs: a save loop firing **~1,460 sequential database queries**, and a **completely unbounded shrinkage divisor** that divides by zero. Fix the schema alone and you ship a ten-second save that can write `Infinity` into a cost. |
| **Cost sheets** — creation is broken. | A version-comparison that divides by a field whose **database default is `0`**. |

### A 400 is not a wall. It's a fuse.

**Before you clear one, look at what it has been holding back.**

And here's the deeper point, which explains a pattern you'd otherwise find puzzling: **your broken validation layer has, entirely by accident, been protecting your data.** That is precisely why your transactional tables are **empty *and* uncorrupted** — while the tables that actually *work* (greige stock, fabric stock, rate cards) are **the corrupted ones**.

**The empty tables aren't good luck. They're evidence the 400s did their job.**

### 🗺️ The fuse map — I went and traced the rest

#### ✅ START HERE — but only THREE are genuinely free. I re-checked, and two of my original five weren't.

> **I audited my own "safe to fix" list adversarially — because it's the one you'd act on first — and caught two hidden fuses.** Three held up; they're below. The two that didn't are in the co-fix table.

| Fix | Why it's genuinely safe *(re-verified)* |
|---|---|
| **Quotations** | The tax-estimation branch is *opt-in* and the form never sends the flag, so the billing-state gate that kills invoices is **never even entered**. No division by zero, reads `.items` correctly, accepting a quote touches no stock. **Truly free.** |
| **Stitching / Finishing "Receive"** | Pure status flips. **Zero stock writes.** The empty `transferSlipId` is falsy, so its branch correctly skips. |
| **Embroidery Stock** | The **service is already correct** — it syncs on send, receive *and* cancel, and its one division is guarded twice. Only the schema needs replacing. |

> ### 🛑 Two fixes I had wrongly called "free" — they belong in the co-fix column
>
> **Samples needs *three* coordinated fixes, not one.** Align the enums (as I said) — **but `requiredDate` is `z.string().datetime()` and your date picker sends a plain date, so it still 400s after the enum fix**, six lines away in the same file. Plus the colour/size pickers are empty (the serializer-key bug). Do all three together, or a developer fixes the enum, retests, hits a fresh 400, and concludes their fix failed.
>
> **Cutting "add lay" silently breaks multi-colour batches.** Its `skuOutputs` schema omits `colorId` and has no `.passthrough()` — so validation **silently strips the colour** the form sends. The lay saves and looks fine, but the batch's cut-quantity tally keys on colour, so for any multi-colour batch that colour's count **stays at zero forever, with no error.** Add `colorId` to the schema. *(Issue-to-stitching, by contrast, is fine — it has `.passthrough()`.)*

#### 🔴 These have something behind them. Fix the co-fix in the same commit.

| Fix this… | …and this fires |
|---|---|
| **Smocking / Handwork / Piece-Embroidery** *(a **transposed** enum — `PIECE_EMBROIDERY` vs `EMBROIDERY_PIECE`)* | **The biggest fuse.** Six live pages start writing `fabric_stock` with **no ledger sync and no audit rows** — silent *and* untraceable. *(The correct version sits next door in `embroidery-stock.service.ts`.)* |
| **Purchase Orders** *(the unit list omits `PAIR` and `PACK` — which the database has and the form offers; **this is probably why you have zero POs**, since buttons are bought per pair and packaging per pack)* | GSTR-3B begins **claiming input tax credit on POs before the goods arrive** — a false claim filed with the GST portal. |
| **Orders** | The **MRP greige under-buy** — there is **no shrinkage multiplier anywhere** in the BOM→MRP chain, so you'd under-purchase raw greige on every order. *(And a cost-sheet gate still blocks you regardless.)* |
| **Invoices** | **Three** at once: GSTR-1 silently drops overdue invoices from the return, GSTR-3B claims tax credit early, and **amount-in-words disagrees with the printed numeral** on the document you send the customer. |
| **Delivery Notes** | Deleting a pending note **permanently destroys finished-goods stock** — it's deducted at creation and never restored. |
| **Credit Notes** | **Approving one never reduces what the customer owes.** The invoice still shows the full amount — feeding your aging reports and the GSTR-1 CDNR section. |
| **User creation** | The role enum is **also** stale: **3 of the 9 roles still 400.** ⚠️ But `ADMIN` is the one value both enums share **and the first option in the dropdown** — so it will *look* fixed in testing while staying broken for a third of real roles. |

> ## 🛑 And one where **my own advice was wrong** — the fourth time
>
> I told you to fix Stock IN's "Roll" rejection by **adding `ROLL` and `GRAM` to the unit enum.**
>
> **Don't.** I checked the *database* enum: it has thirteen values, and **`ROLL` and `GRAM` aren't among them either.** So adding them to the schema alone turns a clean 400 into an **unhandled 500**. And if you also migrated the database — **there is no roll-to-metre conversion anywhere in the codebase.** The routing helper writes the quantity verbatim, so **"5 rolls" would be stored as 5 metres.** Five 100-metre rolls would land as five metres of cloth.
>
> **My fix would have corrupted your stock.** The correct fix is the opposite: **remove Roll and Gram from the dropdown** (it's a hand-maintained list that drifted), or build a real conversion.

---

## 🔑 The single most useful thing in this report

I traced ~25 broken features to their root, and they all have **the same shape**:

> **The form sends X. The controller reads X. The service expects X. The database column is X.**
> **And the Zod schema — sitting between the form and the controller — demands Y.**

**The schema is the only component that disagrees with everything else.** Users (`firstName` vs `name`), orders (`totalQuantity` vs `quantity`), samples (`FIT_SAMPLE` vs `FIT`), rate cards (`ratePerMeter` vs `rate`), greige stock (`purchaseCost` vs `rate`), CAD (`cadRowId` vs `cadId`), external process (`sentQty` vs `quantity`)…

**⚠️ So fix the SCHEMA, never the form.** If you "fix" a form to match its schema, you'll break the controller behind it — because the controller already agrees with the form.

And these schemas have **demonstrably never validated a single real request.** One of them has an enum with the words transposed (`PIECE_EMBROIDERY` where everything else says `EMBROIDERY_PIECE`). Another shares **zero** values with the database it's supposed to describe. They were written from a design document and never run.

### Which means ~25 broken features collapse into **three mechanical changes**

> **I then spent an iteration attacking these three fixes**, because my last three plans were all wrong and I didn't want these to be. **Fix 1 survived with one gotcha. Fix 3 was wrong in a way that would have wasted your week.** Both are corrected below.

**1. Replace `z.string().datetime()` with a validator that accepts a date.** *(The biggest single win in the report.)*

Every `<input type="date">` produces `"2026-07-15"`. I ran your actual Zod (4.1.12):

```
z.string().datetime() on "2026-07-15"  →  REJECTED
.optional() still rejects it           →  REJECTED   ← optional does NOT save you
```

**Proof it's an accident, not a policy:** *Dyeing* uses a plain `z.string()` and **works**. *Printing* uses `.datetime()` and **400s**. Same UI, same action — one functions, one doesn't.

**✅ I stress-tested the fix and it holds.** `z.coerce.date()` accepts *both* date-only and full-ISO strings. It returns a `Date` object rather than a string — the obvious way this could break things — so I checked: **no controller or service anywhere does a string operation on a date field**, and the 29 `new Date(x)` calls behind these schemas are safe with a `Date`.

> **⚠️ But don't do the naive find-and-replace.** `z.coerce.date().optional()` **still rejects `""`** — *optional* permits `undefined`, not a present-but-empty value. **Four of your forms send `''` for an optional date**, so they'd keep 400-ing and you'd conclude the fix didn't work. Use:
> ```ts
> z.preprocess(v => v === '' ? undefined : v, z.coerce.date().optional())
> ```
>
> **🔁 And a correction to my own number.** I said *"131 validators — every one a 400."* **131 is the validator count, not the bug count** — 12 places in your frontend send full-ISO strings and already pass. The class is large and real (55 date truncations + 43 files with date pickers, vs 12 full-ISO senders), but I've *confirmed* a specific set, not all 131. **Fix the class; don't quote 131 as a bug tally.**

**2. Generate the enums from Prisma instead of hand-writing them.** That single change kills the sample module's death (a zero-overlap enum), the whole Smocking/Handwork/Embroidery family (a *transposed* enum, plus a status enum that leaves the dropdown permanently empty), and the defect-disposal bug — outright.

**3. Make the schema-controller checker enforce — but as a RATCHET, not a switch.**

> ## 🛑 My first version of this advice would have recreated the exact failure I diagnosed.
>
> I wrote: *"extend it to all routes and make it block."* Then I read the comment that disabled it in the first place:
>
> ```js
> // don't block commits for now since there are legacy mismatches
> ```
>
> **They didn't disable it out of laziness. They disabled it because turning it on blocked every commit** until a pile of pre-existing violations was cleared. Extend coverage from 76 to the **~411 validated routes** and flip it to blocking, and you get the same outcome: nobody can commit, someone flips it back to warning-only *"for now"*, and **you are exactly where you started.**

**Do this instead:**
1. Extend coverage to all ~411 validated routes, in **report mode**.
2. **Write the current violations to a baseline file.**
3. Block **only violations that aren't in the baseline** — new or newly-touched mismatches fail the commit; the legacy pile is tolerated.
4. Burn the baseline down over time. It can shrink; it can never grow.

**A blocking check that can't be satisfied gets disabled. One that only catches *new* mistakes gets kept** — and this one would have caught every Zod-drift bug in this report *as it was written*.

**That's three changes, not twenty-five tickets.**

---

## The one-paragraph verdict

Your **master data is healthy** (1,040 styles, 184 materials, 82 suppliers, real stock, 23 challans). Your **transactional spine is empty** — zero orders, zero work orders, zero invoices, zero GRNs — **because it cannot save.** A validation layer rejects or silently strips the payloads those screens send. So the good news is that most of the scary money bugs I found in MRP, costing and production **have never had the chance to cost you anything.** They are landmines, not fires. The bad news is that a handful of bugs are **destroying real data on ordinary saves, today.**

---

## 🔧 Do these four things first — about a morning's work

### 1. Three one-line changes — **two of which I had wrong**

> ## 🛑 I audited my own advice. Two of these three fixes were wrong, and one would have created a new bug.

| Change | File | Stops |
|---|---|---|
| **Never retry a `POST`** — a method guard, **not** deleting the `>= 500` clause | `frontend/src/lib/api.ts:18` | Every non-idempotent POST being **silently applied up to 4×** (BH-0280) |
| **Delete the line `processes: []`** — in the **frontend**, not the 10 backend files I originally named | `StyleFormRedesigned.tsx:2139` | The **style-process wipe** (BH-0275) |
| `throw` if `JWT_SECRET` is unset ✅ *(this one was right)* | `backend/src/utils/jwt.utils.ts:5` | Silent fallback to a **public, well-known signing key** (BH-0252) |

**🔁 Why the retry fix changed.** I said "delete the `status >= 500` clause." **That leaves the dangerous half in place.** The first condition — `isNetworkOrIdempotentRequestError` — **doesn't check the HTTP method**, so it retries POSTs whenever there's *no response at all*: a dropped connection, a timeout. **That's exactly the case where the server already processed your write and only the reply got lost** — and retrying it creates a second challan, a second payment. Guard on the method instead: **never retry a POST.**

**🔁 Why the wipe fix changed — and this is the one that would have bitten you.** I told you to change `!== undefined` → `?.length` across ten files. **The form genuinely manages your trims, accessories and SKU variants.** So when a user removes their **last trim** and the form correctly sends `[]`, `!== undefined` reads that as *"delete them all"* — **which is right.** My `?.length` version reads it as *"do nothing"* — **so the deletion is silently ignored and the trim comes back.** I'd have created *"you can never delete the last one"* across three fields.

**The real culprit is one line.** `StyleFormRedesigned.tsx:2139` hardcodes `processes: []`, with a comment explaining that processes are "assumed for all styles" — **the form doesn't manage them at all.** The backend faithfully sees an empty array, deletes all 21 real process rows, and creates nothing. **`!== undefined` was correct the whole time. The form is sending a field it doesn't own.** Delete that line. *(Then check the other 8 controllers the same way: does the form actually manage this field? If yes, leave the backend alone.)*

### 🆕 1b. Fix your rate cards — 15 minutes, and it gives you back a screen you actually use (BH-0322)

**You cannot edit a processor rate card. At all. Every Save returns a 400.**

The schema calls the field **`rate`**. The page sends **`ratePerMeter`**. Validation rejects it before the request reaches the server logic. There are **three** independent causes, any one of which alone would be fatal:

| # | Cause |
|---|---|
| 1 | `RateCellSchema` requires `rate`; the page only ever sends `ratePerMeter` |
| 2 | `slabId` must be a UUID — but the page sends its own placeholder `temp-1` for any newly-added slab |
| 3 | `shrinkages` expects a map; the page sends an array of objects |

You have **956 live rate rows** and a screen that can't save. Renaming one field, relaxing one validator and fixing one shape is **the highest-value 15 minutes in this entire report.**

> ## ⚠️ DO NOT make this fix on its own. It arms two other bugs.
>
> This 400 is a **fuse**, and two things sit behind it:
>
> **1. The save loop fires ~1,460 sequential database queries** (BH-0312). It has never been slow because *it has never run*. Fix the schema alone and you convert a dead screen into a **ten-second** one.
>
> **2. The shrinkage divisor has no validation at all** (BH-0366) — `z.record(z.string(), z.number())`, a bare number: no minimum, no maximum, **not even non-negative**. It feeds `quantity ÷ (1 − shrinkage/100)`. A value of `100` divides by zero and writes **`Infinity` into a cost**.
>
> **Fix BH-0312 and BH-0366 in the same commit.** Otherwise the "highest-value 15 minutes in this report" ships a slow screen that can produce infinite costs — and that would be my fault, not yours.
>
> *(Also worth one query first: your 956 rate-card rows were created through some other path, so one of them may already carry an out-of-range shrinkage.)*

> **🔁 And a claim I killed.** My own reviewer told me this bug means **every Save deletes your rates** — the service does call `deleteMany` when the rate looks empty. That would be catastrophic, and **it's false**: `rate` is a *required* field, so validation rejects the request *before* that code runs. **I checked your database: all 956 rate rows are intact, every one with a real rate.** Nothing has been deleted. **Broken, not destructive** — and I'd rather tell you the boring true version than the alarming false one.

### 🆕 1a. Two things you'll want to know today

**🔐 You cannot create a user — and admin password resets silently do nothing (BH-0341).**

The form sends `firstName`/`lastName`. The controller reads `firstName`/`lastName`. **They agree perfectly.** But the Zod schema sits between them demanding a field called `name`, and declaring neither — so every "Create User" returns 400.

The **edit** path is the one that matters more, because it fails *quietly*: `updateUserSchema` declares **no `password` field at all**, so Zod deletes it before the controller sees it. **An admin who resets a compromised user's password gets a success message, and the password does not change.** That's the one field where silent failure is dangerous. *(The schema is the sole odd one out — fix it, not the form.)*

**⚠️ Stock Adjustment is dead — and the obvious fix arms a data-corruption bug (BH-0342).**

The form sends `quantity`; the schema requires `adjustmentQuantity`. Every adjustment 400s. It looks like a one-word rename.

**Do not make that rename on its own.** The service behind it (`createStockAdjustment`) writes `stock_levels` **without touching the specialized stock tables** — so the 400 is currently the only thing preventing a corruption bug from firing. **Rename the field and you silently open that door.** Fix **BH-0335** in the same commit.

*(This also corrects my own earlier claim that the Adjustment form was actively desyncing stock. It never has — it has never successfully submitted. But **Stock Transfer** and **stock-count approval** reach the same broken code by other routes, and those two **do** work.)*

### 🆕 1c. Fix the guardrail that was supposed to prevent all of this (BH-0333)

**Your CLAUDE.md mandates that every stock service sync the ledger, and says a pre-commit hook enforces it. That hook checks 6 of the 24 files that write stock — and 11 of the 18 it skips have no sync at all.**

Its filter is `f.includes('stock') && f.endsWith('.service.ts')`. So it **skips every controller** — including `fabric-stock.controller.ts`, which holds the bug that caused your **entire 3,076 m fabric gap**, despite having *"stock"* right there in its filename. It is also **case-sensitive** (so `laceStock.service.ts` slips through), and it only **warns** — it never blocks.

**Eleven live corruption sources hid behind that hole**, including `printing.controller.ts` and `dyeing.controller.ts` — your two core production workflows, which make **seven stock writes each and import the sync helper zero times.**

**The rule was right. The enforcement was never looking.** Fix that one line — match any file that writes a stock table, case-insensitively, controllers included, and make it block. **Otherwise every fix in the repair plan gets quietly reintroduced by the next stock feature someone writes.**

> **✅ Have these eleven already made things worse? No — and I checked rather than assuming.** All 9 of your stock movements are `STOCK_IN`. **Zero adjustments, zero transfers, zero stock counts, zero send-outs have ever been recorded.** So these eleven paths are **armed, not fired** — they have added nothing to your existing 71,089 m.
>
> **But that is exactly the point.** They fire the moment you start using the system properly — the first printing job, the first stock adjustment, the first physical count. **So if you repair the data and then start operating, it corrupts again immediately.** That's why Step 1 comes before Step 3.

### 2. Rotate your secrets (BH-0251) — the only genuinely urgent security item

`backend/.env` is **committed to git** with a real `JWT_SECRET` and `DATABASE_URL`. The repo is private, so this is not an internet leak — but anyone who has ever cloned it holds the key that authenticates every user, and **rotating on the server does not remove it from git history.** Rotate the secret and DB password, then `git rm --cached` the `.env` files.

### 3. Hide the Cancel button on issued challans (BH-0214)

`cancelChallan` flips a status and **never returns the stock** it deducted. You have **22 ISSUED challans** and the Cancel button is live on all of them. Nobody has clicked it yet. The next person who does silently corrupts your stock. Hide the button today; fix the reversal properly later.

### 4. Two things to actually avoid — and two I'm retracting

> ### 🔁 I attacked my own six headline claims before you acted on them. **Two were overstated. Here is the correction.**
>
> I had cited **table-wide row counts** as "data at risk" without checking how much of that data was actually distinctive. That inflated two findings badly:
>
> | What I said | What's actually true |
> |---|---|
> | *"Saving a style destroys 1,442 SKU variants — every size, SKU code and barcode"* | **Wrong.** Those 1,442 rows span **241 styles, not 1,040**. There are **ZERO barcodes** in the table, zero inactive rows, and only **6** hand-customised SKUs. The form doesn't send an empty array — it regenerates the same standard sizes. **~99.6% of rows come back byte-identical.** |
> | *"Saving a supplier wipes city/PIN from 39 GST registrations"* | **Wrong.** Only **2 of the 39** rows have a city, and **1** has a pincode. The rest have nothing to lose. And all 39 have `createdAt = updatedAt` — **it has never once fired.** |
>
> **Both are still real bugs worth fixing. Neither is an emergency, and I am retracting the advice to stop saving styles and suppliers.** *(The style bug's genuine risk is narrower and different: delete-and-recreate assigns **new row IDs**, silently nulling `variantId` references from any order or delivery note — quiet FK orphaning, not mass data loss.)*

**These survived hostile re-verification and the caution stands:**

| Avoid this | Because |
|---|---|
| **Deleting a trim master** | **~247 style BOM lines** silently orphaned. The guard checks `order_bom_items` — a table with **zero rows** — and never checks `style_material_bom`, which has 311. **7 handlers affected** (BH-0286). |
| **Cancelling an issued challan** | The stock is **never returned**. 22 ISSUED challans, Cancel button live on all of them, nobody has clicked it yet (BH-0214). |
| **🆕 Approving a stock count** | **It writes only half your stock ledger.** `approveStockCount` applies the counted variance straight to `stock_levels` and **never calls the specialized-stock router** — so `greige_stock`, `fabric_stock` and `lace_stock` go stale while the central ledger moves. **~97% of your stock rows are specialized materials**, so the very first approval desyncs them — on top of data that is *already* corrupt. It returns 200 OK and says nothing. The correct routing call sits **in the same file**, in `createStockIn` (BH-0318). |

> **The stock-count one is new, and it's the kind I nearly missed.** I had assumed Stock Counts was one of the dead, unreachable modules. **It isn't** — the page exists, it's routed, and anyone can use it this afternoon.

#### 🆕 And one more, which is the most serious integrity hole I found (BH-0360)

**Your Stock OUT endpoint can create stock out of nothing.** Three things line up:

1. **`POST /challans` is validated** — its schema requires `quantity: z.number().positive()`.
2. **`POST /challans/quick-issue` is not validated at all** — no schema, and it spreads the raw request body. **It calls the exact same service.** And it's the endpoint the **Stock OUT form actually uses.**
3. **The safety net faces the wrong way.** The stock deduction is `newAvailable = quantityAvailable − qty`, guarded by `if (newAvailable < 0) throw "Insufficient stock"`.

**Feed it a negative quantity and `newAvailable` *grows*.** `available − (−500) = available + 500`. **The guard passes, and the inflated number is written** — through the stock *deduction* path, so it looks like ordinary activity. Your database has **zero check constraints**, so nothing below the app layer refuses it.

✅ **It hasn't happened.** The form sends positive numbers and your 23 live challans look normal. **It's armed, not fired.** But any authenticated caller — or one frontend bug — is all it takes.

**The real lesson is architectural:** every safety rule in this codebase is enforced at the *route*, so it's only as strong as the set of routes reaching the protected code — **and nobody maintains that set.** The same shape shows up three times in this report. **Put invariants in the service and in the database, where every caller has to pass through them.** Schema validation is a good front door; it is not a lock on the safe.

**And saving a style still deletes its process costs** (BH-0275) — that one held up completely: 21 real rows across 9 styles, the form hardcodes `processes: []`, and the backend's `!== undefined` guard lets it through.

---

## 📋 Then, in order

### Stage 1 — Bring the dead features back

> ## 🛑 I HAD THIS BADLY WRONG. Read this before you start.
>
> I originally wrote: *"Fix ~15 schemas. One day. ~20 features come back."*
>
> **That is false for 4 of the 5 headline features.** I tested it by mentally fixing each schema and tracing what happens **next** — and there are more bugs waiting immediately behind each 400. **The 400 means the service code has never run against a real payload, so nobody has ever discovered what's behind it.**
>
> **There is also a hard dependency chain nobody could see:**
>
> ```
> COST SHEETS  ──must work first──▶  ORDERS  ──must work first──▶  INVOICES
> ```
>
> **`order.controller.ts:94-105` refuses to create an order unless an approved cost sheet exists for the style** (`MISSING_PROCUREMENT_COSTING`). Your database has **zero cost sheets**. So "fix orders" actually means *"fix cost sheets completely, create and approve one per style, then fix orders."*

| Feature | Schema fix enough? | Bugs deep | The wall you hit next |
|---|---|---|---|
| **Quotations** | ✅ **YES** | **1** | **Nothing. ~30 minutes.** The one genuine quick win — do it first. |
| **Cost sheets** | ❌ No | **4** | The controller **re-parses with a SECOND, DIFFERENT Zod schema** hidden in `style-costing.utils.ts` — and the route schema strips the fields *before* that parse runs. Plus a **3-way purpose-enum mismatch**. |
| **Orders** | ❌ No | **3** | **Blocked on cost sheets.** Requires an approved cost sheet per style; you have **0**. |
| **Invoices** | ❌ No | **4** | **All 5 of your customers have `billingStateId = null`**, and `createInvoice` throws without a place of supply. **Every invoice fails regardless of the schema.** Also blocked on Orders. |
| **Sale orders** | ❌ **Not a schema bug at all** | **4** | The form hardcodes `items: []` and **there is no UI anywhere to add items.** This needs new frontend work, not a Zod patch. |

**The honest sequence — budget 3–4 days, not 1:**

1. **Quotations** *(30 min)* — swap `.datetime()` for a date-safe validator. Real, immediate win.
2. **Cost sheets** *(0.5–1 day)* — fix all four bugs. **Verify by creating AND editing one and confirming the database row actually changed** — not just that the API returned 200 (it lies today).
3. **Orders** *(hours, but only after step 2 ships and a cost sheet is approved)*.
4. **Invoices** *(0.5–1 day, after Orders)* — and decide separately how to handle place-of-supply: add a field, or backfill `billingStateId` on your 5 customers.
5. **Sale orders** — a separate, larger ticket. It needs an "add items" screen built.

**Then re-arm your own guard (this is the part that stops it recurring).** You already own `check-schema-controller-alignment.js`, built for exactly this. It fails for two fixable reasons: it only recognises `const {a,b} = req.body` — with **no pattern for `Schema.parse(req.body)`**, which is how every broken controller reads the body — and it was **deliberately disconnected** from the commit gate at `pre-commit.js:257` with a `// TODO`. Teach it the regex, delete the carve-out. *It will go red immediately. That red list is your real to-do list.*

**Verify:** `SELECT COUNT(*) FROM style_costing;` then `FROM orders;` — they must move off zero **in that order**.

### Stage 2 — The money bugs. **Fix these BEFORE Stage 1, and here's the proof why.**

I asked of every money bug: **can this code actually run today?** The answer re-orders everything. **Only two of the seven can execute.** The other five are gated behind a table with zero rows — they have *never run* and cannot cost you a rupee today.

**The five dormant ones detonate at the exact moment Stage 1 succeeds.** Your first real order fires the MRP under-buy. Your first invoice fires the GSTR-1 drop and the words/numeral mismatch. Your first purchase order fires the false tax claim. **Restore the features first and your very first real transactions carry wrong numbers — onto documents you've already sent to customers and to the GST portal.** Fix these first and none of that ever happens.

#### 🔴 Live today — 2, both in Fabric Costing *(which needs no order, and has 149 real rows)*

**Rate slabs overlap, and a 500 m job bills at a coin-flip (BH-0122).** *I tried to disprove this one; your data confirmed it.* Your live slabs are literally `0–500`, `500–1000`, `1000–5000` — **500 is in both.** There are **11 overlapping pairs**, the lookup asks for `min ≤ q ≤ max` with **no tie-break**, and the overlap points — **500, 1000, 5000 metres** — are the exact round numbers people order. It's reachable from two live screens (the costing page and the PO form), and the rate it picks is **saved** — 22 rows already have one. *(This lookup is **not** behind the broken rate-card 400; it uses a different, correctly-matching schema.)*

**🆕 A shrinkage typo can order infinite fabric — and your validation explicitly allows it (BH-0364).**

The formula is `greigeRequired = fabricRequired ÷ (1 − shrinkage/100)`. The validator is `z.number().min(0).max(100)`.

**`.max(100)` permits exactly the value that divides by zero.** I ran it:

| Shrinkage | 1,000 m of fabric needs… |
|---|---|
| 10% | 1,111 m |
| 50% | 2,000 m |
| **99%** | **100,000 m** ← a 100× blowup |
| **100%** | **Infinity** |

**And the live guard checks the wrong end.** `FabricCostingPage.tsx:1231` reads `shrinkage > 0 ? fabricReq / (1 - shrinkage/100) : fabricReq` — it protects against **0** (which is harmless) and permits **100** (which is catastrophic).

**The realistic trigger isn't an attack — it's a keystroke.** Real shrinkage is 3–10%. Typing **`100` instead of `10`** is one extra zero, and there is **no sanity ceiling anywhere**. The `Infinity` then propagates into a purchase-order line and dies as an ORM error rather than a clear "shrinkage can't be 100%". **149 live rows on that screen.** Fix: `.lt(100)`, and move the guard to the upper bound.

**The shrinkage *cost* formula is also wrong (BH-0145)** — it treats shrinkage as a surcharge (`× s`) when shrinkage means you must **buy more greige** (`÷(1−s)`). **The same page already uses the correct formula ten lines away**, for quantities. It's live, and it's saved into 27 rows.

> **🔁 But I'm downgrading my own S1 here.** I said "every approved fabric cost is understated," which implied a margin-killer. **I measured it:** the error averages **₹0.26/m — 0.37% of fabric cost**, worst case 0.79%. Real, worth fixing, **not an emergency.** And **nothing is approved yet** (`isLocked = 0` on all 149 rows). *It does grow with the square of the shrinkage rate, so fix the formula before you start costing high-shrinkage fabric.*

#### 🟠 Dormant — 5. Fix before go-live, not today

| Bug | Why it can't fire yet |
|---|---|
| **MRP under-buys greige** (BH-0078) | MRP requires an `orderId` and throws before reaching the bug — **orders = 0** |
| **GSTR-1 drops overdue invoices** (BH-0208) | Reads `invoices` — **0 rows.** The return is simply empty |
| **GSTR-3B claims tax credit off POs, not goods received** (BH-0260) | Reads `purchase_orders` — **0 rows.** *(I checked whether it reads your 23 live challans instead. It doesn't.)* |
| **Service PO: per-metre rate × piece count** (BH-0126) | Needs a work order — **work_orders = 0**, no caller bypasses it |
| **Amount-in-words ≠ the printed total** (BH-0070) | Only used on invoice and proforma PDFs — **invoices = 0, quotations = 0.** *(Your 23 live challans never call it — they have no amount-in-words line.)* |

#### ✅ Retracted — 1

> **The "weighted average cost isn't weighted" bug (BH-0288) is dead code, and I withdraw it.** I told you stock valuation "can be wildly wrong." **It can't** — that method has **zero callers**. The one your app actually uses (`getStockValuation`) is **correctly weighted**. **Your stock valuation is fine.** I criticised the code without checking whether anything calls it.

### Stage 3 — Recover the modules that were never wired up

> ## 🛑 I GOT THIS WRONG TOO. Same mistake as Stage 1.
>
> I wrote: *"the backend sits finished and working — the hard half is already done and tested."*
>
> **It is not tested. It has never run.** No page calls these endpoints and every one of these tables is empty, so **not one line of that backend code has ever executed against a real request.** When I actually traced each create path, the "finished" backends turned out to be broken in **four different ways** — and one of them is the exact opposite of what I claimed.

**What's actually behind each door:**

| Module | Reality |
|---|---|
| **Fabric Physical Tests** | 🔄 **The exact inverse of my claim.** The page, the service layer, the Zod schema and the database model all exist — and **the backend was never written.** Zero route registrations; the frontend calls `/fabric-physical-tests` in five places. **The page fires a request on mount, so it 404s the moment you open it.** |
| **Delivery Notes** | 💥 **A guaranteed crash on every single create.** Not sometimes — *always*. The nested Zod item schema doesn't declare `colorId`/`sizeId`, so it **silently deletes them**, and the database requires both. Also: **no create page exists at all.** |
| **ASN** | Same stripping bug on `plannedQty`, **plus** a hard gate requiring an order (you have zero). |
| **GPT (Garment tests)** | Requires a **work order** — you have zero. Plus a dead Create button. |
| **Credit Notes / Payments** | Require an **invoice** — you have zero. Both are stuck behind the Stage-1 chain. |
| **Chart of Accounts** | ✅ **Backend is genuinely clean.** The *only* module where "just build the form page" is literally true. |
| **Debit Notes** | ✅ **Already works, today.** No gate, no drift, page built, 82 suppliers to pick from. Nobody has ever clicked it. |
| **Stock Counts** | ⚠️ **Not dead at all — it's live, and it corrupts stock.** See the warning above. |

**Two new failure shapes worth knowing, because they'll bite you again:**

**1. Dead Create buttons.** Chart of Accounts' *"New Account"*, GPT's *"Create GPT"*, FPT's *"New Test"*, Dispatch's *"New Delivery Note"* and *"New ASN"* — **all five navigate to routes that were never registered.** You get a working list page, click the big button, and land on **Not Found**. A page that promises a feature it doesn't have is worse than no page.

**2. The `.passthrough()` trap** *(BH-0320 — this one is subtle and it's worth understanding)*. Several schemas end with `.passthrough()`, which preserves unknown fields and *looks* like it makes the whole request safe. **It doesn't propagate to nested schemas.** So the outer object is protected while every nested item underneath it is still silently deleting fields nobody declared. That's precisely how the Delivery Note crash happens. **19 schema files use `.passthrough()`** — audit **`grn.schema.ts` first**, because GRN item quantities become stock.

**Revised effort:** this is *not* the cheap win I called it. It's **build the pages *and* fix the backends**. Chart of Accounts and Debit Notes are the only quick ones. ⚠️ Still fix **BH-0222** in the same pass, or the day you build the Process PO screen you ship an S1.

### Stage 4 — The stock-sync layer

**Cheapest first step:** make the Stock IN form display the server's own reply (BH-0164). It already returns *"Received X. Remaining at processor: Y"* — and the form throws it away. Show it, and **two silent S1 stock bugs become visible immediately.**

---

## 🧭 How to read the 420 findings

**A bug in an empty table cannot hurt you yet.** Every finding is labelled `LIVE` or `DORMANT` against real row counts.

- **LIVE (act now):** styles · style_variants · style BOM · materials · suppliers · greige/fabric/lace stock · stock_levels · challans
- **DORMANT (fix before the data flows):** orders · work orders · production · invoices · GRNs · quotations · samples · dispatch · cost sheets

## 🔬 How much to trust this — measured, not asserted

This is **419 findings across 95 iterations over 6 days**, and I corrected my own work **repeatedly** along the way. So you're entitled to ask how much is sound. Here's the actual audit, not a reassurance — including a précis of the run and exactly where I was wrong.

### What was swept

| Coverage | Result |
|---|---|
| **403 of 419 findings CONFIRMED** (16 plausible) · **111 verified against your live database** · **41 clean bills** | The clean bills are load-bearing: they bound each class instead of implying everything is broken |
| **25 bug classes** swept — Zod-drift (78), money-math (57), race/atomicity (73), material-sync (30), serializer (14), dead-stub (20), reversal, cascade, auth… | The two biggest — schema/form drift and stock-sync — are the ones your guardrails don't check |
| **1,205 routes** checked for auth (0 unauthenticated) · **528 mutating routes** (119 unvalidated) · **every stock-write path** · **every published number re-derived** | Breadth on the mechanical classes; depth on the stock corruption |

### Every finding you'll act on has been independently verified

"Verified" means one of: **executed** the real code against the real payload, **queried your live database** (111 findings), **re-checked at source**, or **a hostile skeptic tried to kill it and failed**. Every S1 and S2 has at least one. The handful resting on a single agent's word are all S3/S4 — nothing urgent.

### Where I was actually wrong — the honest ledger

I published **8 numbered self-corrections and one full retraction.** That's not a disclaimer; **it's the most important quality signal in the report**, because I found them by attacking my own work before you could act on it. The pattern is sharp and worth internalising:

- **My measurements held. My *derived* claims and my *fix advice* did not.**
- Two of my recommended fixes **would have destroyed data** (delete the phantom rows that held the only correct figures; add `ROLL` to an enum with no metre conversion → "5 rolls" stored as 5 m).
- My **headline number was 35% too high** — I counted one lot's discrepancy twice, committing the exact double-ledger bug I was diagnosing.
- I **reassured you a repair rested on evidence** when the check I'd run was vacuous (the field was null on 60 of 61 rows).
- Two of my **five "start here, free" fixes had hidden second bugs.**

**Every existence claim held at 100% under adversarial testing.** Every failure was an *aggregate I computed*, an *assurance I gave*, or a *fix I proposed* — never "the bug isn't real."

> ## 🧭 The rule for reading this report
> **Trust the diagnosis. Verify the prescription.** The individual bugs, the row counts, the corrupt stock — all re-checked and real. But before you act on any *fix* or quote any *aggregate*, run it once yourself. I've been reliable where I measured and unreliable where I derived, and you can't tell which is which from the prose alone.

## 🔬 (Earlier note) The false-positive audit

I ran a **false-positive audit on my own work**: I sampled 12 findings from my *earliest, least-disciplined* iterations and told a hostile skeptic to destroy them.

**Zero were false.** Every file, line and technical claim held up.

**But it caught me twice on severity** — I'd graded from *code shape* ("this pattern is dangerous") rather than *current exposure* ("is this path actually hit?"). Both were corrected.

> **So: trust the existence claims. Sanity-check the severity labels** against live row counts before you triage. I have overruled my own reviewers' `LIVE` calls **five times** when the database disagreed with them.

## 💡 The one thing that should give you confidence

**These bugs are inconsistency, not incompetence.** Again and again, the *correct* implementation already exists in your codebase, one file away from the broken one:

- `cancelSendOut()` reverses stock properly — `cancelChallan()` doesn't.
- `deleteFabricMaster()` checks six dependencies — `deleteGreigeMaster()` checks one.
- `CustomerForm` loads GST city/PIN correctly — `SupplierForm` hardcodes blanks.
- `calculateWeightedAverageCost()` is properly quantity-weighted — the code calls the `_avg` one instead.
- `processor-rate-v2` uses safe **diff-based** updates — the wipe-prone forms don't.

**You are not missing knowledge. You are missing consistency — and a commit gate that enforces it.** That's why Stage 1, step 3 matters more than any single bug fix in this report.
