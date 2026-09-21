# Tally Integration Reference (Lessons from B2B App)

> **Read before ANY Tally-touching change.** This doc distills months of debugging from the B2B app
> so we don't repeat the same mistakes. Every gotcha here cost real time to discover.

---

## 1. Environment Facts (This Install)

| Fact | Value | Why it matters |
|------|-------|----------------|
| **Gateway** | `192.168.1.22:9000` (HTTP XML) | IP is DHCP-reserved. "Could not reach Tally" is usually IP drift, not Tally down. |
| **Company is PINNED** | Always send `<SVCURRENTCOMPANY>` | Multiple companies may be open. Blank = "whichever is active" = wrong books. |
| **Gateway is single-threaded** | One request per company at a time | All traffic serializes through `gatewayMutex`. Never bypass it; never parallelise pushes. |
| **Read vs write timeouts** | Default 15s; heavy reads need 60s | A full voucher export hangs >90s. Use light `<FETCH>` field lists. |

---

## 2. Sign Convention (THE table to remember)

| Posting | `<AMOUNT>` | `<ISDEEMEDPOSITIVE>` |
|---------|------------|----------------------|
| **Debit** (party owes us; input GST; purchases) | **negative** (`-1234.00`) | `Yes` |
| **Credit** (sales income; output GST; supplier) | **positive** (`1234.00`) | `No` |

- **Sales voucher**: party Dr the grand total; sales Cr nested in each item's `ACCOUNTINGALLOCATIONS.LIST`; Output GST Cr; round-off Dr/Cr by sign.
- **Credit note**: party Cr (reduces outstanding); sales Dr; Output GST Dr; stock returns (ISDEEMEDPOSITIVE=Yes).

---

## 3. The Tag Names That Bit Us (Use X, NOT Y)

| Use this (correct) | NOT this (silently blank/ignored) |
|-------------------|-----------------------------------|
| `<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>` | `<COUNTRYNAME>` |
| `<LEDMAILINGDETAILS.LIST>` (dated block) | `<LEDGERMAILINGDETAILS.LIST>` |
| `<LEDGSTREGDETAILS.LIST>` (dated block with `APPLICABLEFROM` + `GSTIN`) | flat `<GSTIN>` on ledger |
| `<PARTYGSTIN>` (on voucher) | `<GSTIN>` (wrong context) |
| `<PARTYPINCODE>` (on voucher) | `<PINCODE>` |
| `<BILLTOPLACE>` / `<SHIPTOPLACE>` (e-invoice places) | `…CITY` or `…TOWN` tags |
| `<IMPORTRESULT>` (response tag) | `<RESPONSE>` |
| `<EXCEPTIONS>` (error count) | Just checking `<ERRORS>` |

### Ledger collection name trap

A custom export collection **must NOT be named `List of Ledgers`** — that name collides with a reserved
TallyPrime collection and Tally silently ignores your `<NATIVEMETHOD>` field list, returning NAME-ONLY
(no `PARENT`, no `PARTYGSTIN`, no `CLOSINGBALANCE`). **Use a custom name** like `KF Party Ledgers`.

---

## 4. REMOTEID Idempotency (CRITICAL)

Every voucher/master we import **MUST** carry a stable `REMOTEID`. Re-pushing then does `ACTION=Alter`
on the SAME Tally object instead of spawning a duplicate (a duplicate sales voucher overstates revenue).

```typescript
// Namespace by entity type
const REMOTE_ID_PREFIX = {
  invoice: 'KF-INV-',      // Sales invoice
  creditNote: 'KF-CN-',    // Credit note
  debitNote: 'KF-DN-',     // Debit note
  payment: 'KF-PMT-',      // Payment receipt
};
```

**Rule:** Never hand-format a REMOTEID at a call site. Use the prefix functions.

---

## 5. Import Response Parsing

```typescript
function parseImportResponse(xml: string): { ok: boolean; created: number; altered: number; errors: number; lineError: string | null } {
  const created = Number(firstTag(xml, 'CREATED') ?? 0) || 0;
  const altered = Number(firstTag(xml, 'ALTERED') ?? 0) || 0;
  const errors = (Number(firstTag(xml, 'ERRORS') ?? 0) || 0) + 
                 (Number(firstTag(xml, 'EXCEPTIONS') ?? 0) || 0);
  const lineError = firstTag(xml, 'LINEERROR') || null;
  
  // CRITICAL: EXCEPTIONS>0 with CREATED=0/ALTERED=0 means Tally did NOT apply
  const ok = errors === 0 && (created > 0 || altered > 0);
  return { ok, created, altered, errors, lineError };
}
```

**Trap:** `EXCEPTIONS=1, ALTERED=0` is a silent failure. Always check BOTH error count AND created/altered count.

---

## 6. GST Rate Routing

Lines ≥ ₹2,500/piece → **18%**, else **5%**. Route to the correct ledger set.

**Always compare the FULL rate against the full threshold.** Resolve the full rate first, because
which rate column is populated depends on intra vs inter state:

```typescript
const itemGstRate = (item) => {
  if (item.gstRate != null) return item.gstRate;          // full rate when present
  return isInterstate ? (item.igstRate ?? 0)              // IGST carries the full rate
                      : (item.cgstRate ?? 0) * 2;         // CGST is half — double it
};

const is18 = itemGstRate(item) >= GST_RATE_HIGH;          // 18, not 9
```

**Bug we fixed:** the old heuristic tested `cgstRate >= 9`, which is **null** on interstate (IGST)
invoices. Every 18% IGST line landed in the 5% bucket and posted to the wrong ledger.

**Do not mix the two conventions.** The credit-note builder was comparing a full rate against the
half threshold (`>= GST_RATE_HIGH / 2`). It happened to give the right answer for the only two rates
in use, but it is the same confusion that produced the bug above — aligned 2026-09-21.

---

## 7. Inventory Nesting (Bug-Prone Part)

The sales ledger lives **inside** `ALLINVENTORYENTRIES.LIST → ACCOUNTINGALLOCATIONS.LIST`, NOT at voucher top level.

Read parsers must strip inventory before scanning top-level `LEDGERENTRIES` or they double-count.

---

## 8. Balance Assertion — and the two traps around it

**Every voucher builder MUST assert balance before returning.** Tally rejects an unbalanced voucher
with only a generic failure, so we refuse to send one. Both builders in `tally.service.ts` do this.

### Trap A — assert against what is EMITTED, not the header

The obvious version compares invoice header fields to each other and is near-tautological. The
assertion must sum the amounts **actually written into the XML**:

```typescript
// salesTotal accumulates each emitted (2dp-rounded) inventory line
// gstTotal accumulates each emitted (2dp-rounded) per-bucket tax line
const emittedCredits = round2(salesTotal + gstTotal + emittedRoundOff);
if (Math.abs(actualTotal - emittedCredits) >= 0.01) throw ...
```

This is what catches per-line and per-bucket rounding drift, and any header-vs-lines disagreement.

### Trap B — round-off is a RESIDUAL, so bound it

`roundOff` is computed as `billedTotal - calculatedTotal`. That means it silently absorbs **any**
discrepancy and the voucher balances anyway: a ₹9,999 invoice backed by ₹1,050 of lines posts an
₹8,949 "round-off" and passes every balance check.

```typescript
const MAX_ROUND_OFF = 1; // an invoice rounds to the nearest rupee — never more
if (Math.abs(roundOff) > MAX_ROUND_OFF) throw ...
```

**Both guards are needed.** The bound catches gross header/line disagreement; the balance assertion
catches drift the round-off does not absorb (see §8.1).

### 8.1 Zero-quantity lines must not contribute tax

The inventory loop filters `quantity > 0`, so a zero-qty line posts no stock and no sales credit.
If the GST bucket loop does **not** apply the same filter, that line's tax is still posted — an
unbalanced voucher. Build both loops from one `postedItems` array:

```typescript
const postedItems = items.filter((item) => item.quantity > 0);
// inventory AND gst buckets both iterate postedItems
```

Found and fixed in garment-erp on 2026-09-21; covered by `tally.voucher.test.ts`.

---

## 9. e-Invoice (IRN) Integration

When the ERP generates an IRN, embed it in the voucher so Tally shows it as already IRN-registered:

```xml
<IRN>${irn}</IRN>
<IRNACKNO>${ackNo}</IRNACKNO>
<IRNACKDATE>${ackDate}</IRNACKDATE>
```

**Never-alter guard:** A voucher with an IRN is frozen. Do NOT `ACTION=Alter` an IRN'd voucher —
the figures are frozen against the signed IRP payload.

---

## 10. Stock Item HSN + Taxability

On this TallyPrime build, HSN code AND description live in a **dated `<HSNDETAILS.LIST>`** sub-list,
NOT in flat tags. A flat `<HSNCODE>` write leaves the details **empty**.

```xml
<HSNDETAILS.LIST>
  <APPLICABLEFROM>20260401</APPLICABLEFROM>
  <HSNCODE>62081910</HSNCODE>
  <HSN>Ladies Nightwear</HSN>  <!-- This is the DESCRIPTION, tag literally named <HSN> -->
  <SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS>
</HSNDETAILS.LIST>
```

Similarly for GST taxability (Exempt items):
```xml
<GSTDETAILS.LIST>
  <APPLICABLEFROM>20260401</APPLICABLEFROM>
  <TAXABILITY>Exempt</TAXABILITY>
  <SRCOFGSTDETAILS>Specify Details Here</SRCOFGSTDETAILS>
</GSTDETAILS.LIST>
```

---

## 11. Failure-Mode Playbook

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| "unknown error", no UI block | Voucher already exists (no `REMOTEID`); Tally ignores dup | Reconcile by voucherNo + total-match guard; don't re-push |
| Wrong party on invoice | Two customers share one GSTIN (data error) | Fix wrong GSTIN; new ledger for displaced customer |
| Need to re-push already-pushed | Short-circuits when `tallyPushedRev == revision` | Set `tallyPushedRev = null`, then push → `ACTION=Alter` rewrites |
| `EXCEPTIONS=1, ALTERED=0` | Two identical stock-item lines; OR target voucher not found | Delete in Tally manually, then re-push (Create) |
| Blank ledger created | Wrong master tag names | Use the §3 table above |
| Outstanding all parse to 0 | Collection name `List of Ledgers` (reserved) | Use custom collection name |
| "Could not reach Tally" | DHCP drift | Re-check IP; router reservation |

---

## 12. Read Performance Rules

**The read costs the same whether it answers for 1 voucher or 400.**

| Approach | Cost |
|----------|------|
| Per-voucher lookup × 120 | 25 minutes |
| One type read + match in code | 42 seconds |

**Rule:** Before adding any per-record Tally read to a loop, ask what one read of the whole
type/party would give you, and cache that for the run.

**Writes are the opposite:** Stay one-at-a-time through the mutex. Never parallelise pushes.

---

## 13. XML Helpers (Already Ported)

Located in `backend/src/utils/tally-xml.ts`:

- `xmlEscape(v)` — Escapes XML entities AND strips C0 control chars (paste artifacts crash the envelope)
- `xmlUnescape(v)` — Reverses escaping
- `firstTag(xml, tag)` — Extracts first tag value, handles `TYPE="..."` attributes
- `fmtDate(d)` — Formats as `YYYYMMDD`
- `fyStartYyyymmdd()` — Financial year start (1-Apr)
- `amt(n)` — Formats to 2 decimals, handles `-0`

---

## 14. Parser Fragility Rule

Anchor on **opening tags**, read each entry from the slice up to the *next* opening tag.

A paired-tag regex (`<LEDGER>…</LEDGER>`) mis-pairs on self-closing/unclosed blocks, drops one entry
and shifts name↔parent for the rest.

---

## 15. Standing Decisions (Do NOT "Fix")

1. **Payment receipts are entered in Tally directly** and READ back by receipt import. Outstanding
   difference column detects divergence.
2. **Never read stock quantities back** from Tally to drive allocation (one allocation source only).
3. **The app NEVER sends delete requests** to Tally — `assertNoDeleteRequest()` guardrail.
   Delete in Tally directly.

---

## 16. Test Connection Checklist

Before any push, verify:
1. Company is open and name matches exactly
2. All configured ledgers exist (use "did you mean" suggestions)
3. Party group is correct (e.g., `Sundry Debtors`)
4. Voucher type exists

---

## Code Map

| File | Purpose |
|------|---------|
| `backend/src/services/tally.service.ts` | Gateway comm, XML build/parse, push functions |
| `backend/src/services/tally-settings.service.ts` | Settings management |
| `backend/src/utils/tally-xml.ts` | XML helpers |
| `backend/src/controllers/tally.controller.ts` | API endpoints |
| `backend/src/routes/tally.routes.ts` | Route definitions |

---

*Source: Distilled from kasya-b2b-sales `docs/HOK-B2B-TALLY-REFERENCE.md` (615 lines of battle-tested learnings)*
