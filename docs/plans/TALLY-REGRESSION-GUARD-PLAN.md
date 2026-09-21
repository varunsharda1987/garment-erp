# Tally Regression Guard Plan

> Prevent re-introducing the bugs that cost months to debug in the B2B app.

## Status — 2026-09-21: mostly DONE

| Phase | State |
|---|---|
| 1. Fixture infrastructure | **Done.** 3 sanitized live captures committed; mutation-tested |
| 1.3 Fixture export endpoint | **Not built.** Captured by hand this time — see the fixtures README |
| 2. Voucher builder tests | **Done.** 18 builder tests; balance assertion + round-off bound in both builders |
| 3. Import response tests | **Done** (hand-written XML; the live fixture needs a real push) |
| 4. Tag-name constants file | **Not done.** Tag names are still inline strings |

Writing these found two live bugs in the ported code — a round-off that absorbed any discrepancy,
and zero-qty lines posting tax with no sales line. Both fixed; both covered. Details in
`docs/TALLY_INTEGRATION_REFERENCE.md` §6 and §8.

Remaining, in value order: capture `voucher-import.response.xml` from the first real push; then
Phase 1.3 / Phase 4 if the integration gets heavier use.

## The Problem

The garment-erp Tally integration was ported from B2B but **without the test suite**. The B2B app has:
- 27 fixture files (real captured Tally responses)
- 16 test files
- Balance assertion in voucher builders
- `TALLY_READS_VERIFIED` flag

Garment-erp has **zero tests**. Any of these bugs can return:
1. Wrong tag name → silent parse failure
2. Collection name collision → fields return blank
3. GST rate routing error → posts to wrong ledger
4. Unbalanced voucher → Tally rejects silently

---

## Implementation Plan

### Phase 1: Core Test Infrastructure (1-2 hours)

**1.1 Create fixtures directory**
```
backend/src/services/__fixtures__/tally/
├── README.md
├── ledgers.response.xml        # Real captured response
├── ledger-balances.response.xml
├── companies.response.xml
└── voucher-import.response.xml
```

**1.2 Add `tally.fixtures.test.ts`**
- Pin each parser to a real Tally response
- Auto-skip if fixture not yet captured
- Fail loudly when tag names change

```typescript
// Key assertions from B2B:
expect(rows.some((r) => r.parent.length > 0)).toBe(true);  // Collection name bug
expect(rows.some((r) => r.gstin.length === 15)).toBe(true); // GSTIN parse bug
expect(rows.some((r) => r.closingBalance > 0)).toBe(true);  // Balance parse bug
```

**1.3 Add fixture export endpoint**
```
GET /api/tally/diagnostics/export-fixtures
```
- Captures real responses from live Tally
- Sanitizes sensitive data
- Saves to `__fixtures__/tally/`

### Phase 2: Voucher Builder Tests (1 hour)

**2.1 Add `tally.voucher.test.ts`**
- Test `buildSalesVoucherXml` with known inputs
- Verify sign convention (Dr = negative, Cr = positive)
- Verify inventory nesting (sales ledger inside ACCOUNTINGALLOCATIONS)

**2.2 Add balance assertion to builders**

⚠️ The obvious version of this — summing the invoice header fields — is **near-tautological and
does not work**, and a plain balance check is defeated by round-off being a residual. Do not copy a
snippet from here: see `docs/TALLY_INTEGRATION_REFERENCE.md` §8 for the two guards that are actually
needed, and `tally.service.ts` for the implementation.

**2.3 Add GST rate routing tests**
```typescript
it('routes 18% IGST to the 18% ledger (not 5%)', () => {
  const invoice = { isInterstate: true, items: [{ igstRate: 18, ... }] };
  const xml = buildSalesVoucherXml(invoice, settings);
  expect(xml).toContain(settings.tallyIgstLedger18);
  expect(xml).not.toContain(settings.tallyIgstLedger); // 5% ledger
});
```

### Phase 3: Import Response Tests (30 min)

**3.1 Test `parseImportResponse`**
```typescript
it('detects silent failure: EXCEPTIONS>0 with CREATED=0', () => {
  const xml = '<IMPORTRESULT><CREATED>0</CREATED><ALTERED>0</ALTERED><EXCEPTIONS>1</EXCEPTIONS></IMPORTRESULT>';
  const result = parseImportResponse(xml);
  expect(result.ok).toBe(false); // NOT success!
});
```

### Phase 4: Tag Name Regression Guard (30 min)

**4.1 Add constants file with correct tag names**
```typescript
// backend/src/utils/tally-tags.ts
export const TALLY_TAGS = {
  // Use these (correct)
  COUNTRY_OF_RESIDENCE: 'COUNTRYOFRESIDENCE',
  LEDGER_MAILING_DETAILS: 'LEDMAILINGDETAILS.LIST',
  LEDGER_GST_REG_DETAILS: 'LEDGSTREGDETAILS.LIST',
  PARTY_GSTIN: 'PARTYGSTIN',
  PARTY_PINCODE: 'PARTYPINCODE',
  
  // NOT these (wrong)
  // COUNTRY_NAME: 'COUNTRYNAME',  // ❌
  // LEDGER_MAILING_DETAILS: 'LEDGERMAILINGDETAILS.LIST',  // ❌
} as const;
```

**4.2 Use constants in builders (not raw strings)**
- Grep for hardcoded tag names
- Replace with constants
- Wrong tag = compile error

---

## Quick Wins — all done 2026-09-21

### 1. ~~Add balance assertion~~ — DONE, and the first attempt was wrong

The version originally drafted here summed the invoice header fields and compared them to the
header total. That is circular: `roundOff` is *defined* as the difference, so it can essentially
never fire. Worse, because round-off is a residual it silently absorbed arbitrarily large errors.

Both builders now assert against the amounts **actually emitted** into the XML, plus a `MAX_ROUND_OFF`
bound. Full explanation in `docs/TALLY_INTEGRATION_REFERENCE.md` §8.

### 2. Add REMOTEID uniqueness test

```typescript
it('REMOTEID is stable across re-pushes', () => {
  const id1 = remoteIdFor('invoice-123');
  const id2 = remoteIdFor('invoice-123');
  expect(id1).toBe(id2);
  expect(id1).toBe('KF-INV-invoice-123');
});
```

### 3. Copy the B2B fixtures README

Copy `kasya-b2b-sales/backend/src/services/__fixtures__/tally/README.md` to garment-erp to document the capture process.

---

## CI Integration

Add to `.github/workflows/test.yml`:
```yaml
- name: Tally fixture tests
  run: cd backend && npm test -- --grep "tally.fixtures"
```

If no fixtures exist, tests auto-skip (CI stays green). Once fixtures are captured, tests arm themselves.

---

## Verification Checklist

Before any Tally code change ships:

- [ ] `npm test` passes (including tally tests)
- [ ] Fixture tests are green (if fixtures exist)
- [ ] Balance assertion is in place
- [ ] REMOTEID uses the prefix function, not raw string
- [ ] GST rate check uses full rate, not cgstRate alone

---

## Priority

| Task | Effort | Impact |
|------|--------|--------|
| Balance assertion in builder | 10 min | Prevents unbalanced vouchers |
| Fixture test file (even without fixtures) | 30 min | Infrastructure ready |
| GST rate routing test | 15 min | Prevents wrong-ledger bug |
| Import response parsing test | 15 min | Prevents silent-failure bug |
| Capture real fixtures | 30 min | Arms all parser tests |

**Total: ~2 hours to port the essential guards from B2B.**
