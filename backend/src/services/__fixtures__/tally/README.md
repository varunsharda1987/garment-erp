# Tally Fixtures

Real captured TallyPrime responses, **sanitized**, pinned by `../../tally.fixtures.test.ts`.

Every recurring Tally bug in the B2B app traced back to a tag name someone **guessed**. Pinning the
parsers to ground truth means a TallyPrime upgrade that renames a tag fails this test suite instead
of silently corrupting a balance.

## What's here

| File | Captured | Arms |
|------|----------|------|
| `ledgers.response.xml` | 2026-09-21, live | party group (`PARENT`), `PARTYGSTIN`, `GSTREGISTRATIONTYPE` |
| `ledger-balances.response.xml` | 2026-09-21, live | `CLOSINGBALANCE` parsing (Outstanding) |
| `companies.response.xml` | 2026-09-21, live | company-name parsing past the `CMPINFO` phantom |
| `voucher-import.response.xml` | **not captured** | import success/failure detection |

The import-response fixture is missing on purpose: capturing it means pushing a real voucher into
the live books. Capture it the first time a genuine invoice is pushed, from that reply.

## These are SANITIZED — keep them that way

The live capture held **2,616 parties** with real names, GSTINs and balances, and the Tally box is
shared with unrelated businesses. Before anything lands here:

- party names → `Test Party NN`
- company names → `TEST COMPANY N` (in **both** the element text and the `NAME="…"` attribute — the
  attribute form was missed on the first pass)
- GSTINs → synthetic but structurally valid (`01AAAAA0000A1Z5`)
- group names → neutral (`Sundry Debtors` / `Sundry Creditors`)
- balances → round synthetic figures, original sign preserved (the parser negates it)
- trimmed to 8 ledger blocks; the **shape** is what matters, not the volume

Never commit a raw capture.

## Re-capturing

There is no in-app export yet (the B2B app has *Settings → Export Tally fixtures*). Until one
exists: post the request XML from `buildListLedgersXml` / `buildLedgerBalancesXml` /
`buildListCompaniesXml` to the gateway, then sanitize as above.

## Proving a fixture still guards

Rename a tag in a fixture (e.g. `PARENT` → `PARENTGROUP`) and confirm the suite goes red, then
revert. Done 2026-09-21 — the ledger-list test failed exactly as intended.

See `docs/TALLY_INTEGRATION_REFERENCE.md` for the full list of tag traps.
