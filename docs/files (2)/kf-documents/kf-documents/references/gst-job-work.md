# GST on textile job work — Kashaya Fabs

Position as at August 2026. Rates live in the `ProcessType` table; this file explains *why* each value is what it is, so a future change can be reasoned about rather than guessed.

## Contents

1. The structural change of 22 Sep 2025
2. Rate table by process
3. The dyeing/printing ambiguity — unresolved, needs CA sign-off
4. Registered vs unregistered branches
5. In-house cutting is not job work
6. Compliance the documents must support

---

## 1. The structural change of 22 Sep 2025

The 56th GST Council (3 Sep 2025) collapsed the slab structure. The 12% and 28% slabs were abolished, leaving 5% / 18% with a 40% demerit rate. Service rate changes took effect 22 Sep 2025.

This matters enormously for job work, because the old residual job-work entry — 26(id) of Notification 11/2017 — sat at 12%. With that slab gone, residual job work moved **up to 18%**, while notified concessional categories sit at **5%**.

So the question for every process is binary: is it inside the notified textile job-work entry (5%) or outside it (18%)?

## 2. Rate table by process

Base entry: **SAC 9988**, "manufacturing services on physical inputs owned by others". Sub-codes: `998821` textile manufacturing services (fabric-stage), `998822` wearing apparel manufacturing services (garment-stage).

| Process | SAC | Rate | Confidence |
|---|---|---|---|
| Dyeing (fabric) | 998821 | **See §3** | ⚠️ Contested |
| Printing (fabric) | 998821 | **See §3** | ⚠️ Contested |
| Embroidery | 998821 / 998822 | 5% | High |
| Stitching / tailoring | 998822 | 5% | High |
| Smocking | 998822 | 5% | Medium-high |
| Cutting — contractor | 998822 | 5% | High |
| Cutting — in-house | — | No GST | Certain, see §5 |
| Washing, bleaching, finishing | 998821 | 5% standalone — but see §3 bundling trap | Medium |

**Embroidery, stitching, smocking, cutting** all sit inside entry 26(i)(b): job work in relation to textiles and textile products of Chapters 50–63. None was carved out by any amendment. 5% with ITC.

**Smocking** has no dedicated entry anywhere. It's a garment-construction process on Chapter 61/62 goods, so it falls in the same textile job-work entry as stitching. Nothing transformative happens to the fabric's character. Low risk, but it's a classification by analogy rather than by name — worth one line in a CA note if volumes get material.

## 3. The dyeing/printing ambiguity ⚠️

**Do not put a number on a dyeing or printing challan until this is settled with your CA.**

The history:

- Notification 15/2021-CT(R), effective 1 Jan 2022, amended entry 26(i)(b) to read "...except services by way of dyeing or printing of the said textile and textile products". Dyeing and printing were deliberately pushed **out** of the 5% textile job-work slab.
- They landed in residual entry 26(id) at 12% (registered principal), or 18% (unregistered principal).
- On 22 Sep 2025 the 12% slab ceased to exist.

**The strict reading:** the carve-out was never deleted, so dyeing and printing remain outside 5%, and with 12% abolished they now sit at **18%**.

**The competing reading:** several 2026 commentaries assert textile job work including dyeing is uniformly 5% post-rationalisation, some quoting entry 26(i)(b) *without* the carve-out clause. The 56th Council press release does not mention restoring dyeing/printing to 5%.

These cannot both be right, and the sources asserting 5% are mostly SEO content rather than notification text. The spread is 13 percentage points on your single largest job-work spend line.

**Action required:** have your CA pull the current consolidated text of entry 26 from Notification 11/2017 as amended, and confirm whether the "except dyeing or printing" clause survives. Then set `ProcessType.gstRate` for DYEING and PRINTING once. Until then, flag those documents rather than printing a rate.

**The bundling trap.** If one processor does dyeing *and* bleaching *and* finishing under a single contract, it becomes a composite supply and the whole invoice takes the rate of the principal service (dyeing) — the 5% ancillaries get dragged up. If you want the ancillaries at 5%, they must be separately contracted and separately invoiced, and genuinely so. Splitting one job across two invoices to arbitrage the rate will not survive scrutiny.

## 4. Registered vs unregistered

Two different tests, frequently conflated:

**Is the principal registered?** Kashaya Fabs is (08DCDPS0146D1ZU). This is what makes the transaction "job work" under Sec 2(68) at all, and what qualifies it for the concessional job-work entries. Always satisfied for us.

**Is the job worker registered?**
- *Registered* → he charges GST on his invoice; we take ITC. Normal case.
- *Unregistered* → he charges nothing. Job work is not on the reverse-charge list, so no RCM liability arises for us on the service. But there is no ITC either, and the full charge becomes cost.

The practical consequence: an unregistered contractor at ₹22/m is cheaper than a registered one at ₹22/m + 5%, but only until you compare against a registered one at ₹21/m whose tax you recover. Document templates must show the job worker's registration status so whoever approves the order can see which case they're in.

Small unregistered contractors are common for cutting and smocking. That's fine — just capture it as a field, not an assumption.

## 5. In-house cutting is not job work

This is a modelling decision, not a tax one, and getting it wrong pollutes the whole system.

Cutting done on our own floor by our own staff is an **internal production step**. There is no supply, no job worker, no challan, no GST, no ITC-04 entry. It generates a work order and consumes labour and overhead into WIP.

Cutting sent to a contractor is job work: challan out, challan back, 5% on his charges, ITC-04 reporting.

The same physical operation, two entirely different document paths. In the schema this is `WorkOrder.executionMode ∈ {IN_HOUSE, JOB_WORK}` — and when it's `IN_HOUSE`, the job work document generators must not fire at all. If in-house cutting ever appears in an ITC-04 return, something is badly wired.

## 6. Compliance the documents must support

**Delivery challan — Rule 55 CGST Rules.** Triplicate: original for consignee, duplicate for transporter, triplicate retained. Must carry: date and serial number, consignor and consignee details with GSTIN, HSN and description, quantity, taxable value, tax rate and amount *where the movement is for supply* (nil for job work), place of supply, and signature. Job work challans state the reason for transportation.

**Section 143 time limits.** Inputs back within **1 year**, capital goods within **3 years**. Miss it and the original despatch is deemed a supply *from the despatch date* — with interest running from then, not from the breach. Moulds, dies, jigs, fixtures and tools are outside the 3-year limit.

The Job Work Order template's "Due Back" field and the reconciliation block exist precisely to make this visible. A material-lying-with-vendor ageing report is not optional.

**ITC-04.** Quarterly or half-yearly depending on turnover slab, reporting goods sent to and received from job workers. Confirm your current frequency with your CA — the thresholds have moved more than once.

**E-way bill.** Required on inter-state job work movement regardless of value in most cases, and above the state threshold intra-state. The declared value on the challan is what populates it — which is why issued material carries a value even though no sale occurs.

---

## Sources

Rates and structure verified against public commentary in Aug 2026. Notification text for the dyeing/printing carve-out (§3) was **not** verified against the consolidated statute and is the one open item. Everything else in this file is consistent across independent sources.
