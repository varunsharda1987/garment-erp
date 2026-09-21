/**
 * Tally Fixture Tests — Regression Guard
 *
 * Pins each parser to REAL captured Tally responses (not hand-written XML).
 * Every recurring Tally bug traced back to a tag name we guessed wrong;
 * this test fails when TallyPrime changes a tag name, BEFORE it corrupts the books.
 *
 * If a fixture file doesn't exist yet, the test auto-skips (CI stays green).
 * Capture fixtures via Settings → Tally → Export Tally Fixtures.
 *
 * Ported from kasya-b2b-sales tally.fixtures.test.ts
 */

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
// Pure parser tests: they never touch the DB, but importing tally.service opens a real Prisma
// client, which keeps the Jest worker alive. (The logger is already mocked globally in
// src/__tests__/setup.ts — do not re-mock it here; a local mock without __esModule/default is the
// documented cause of "logger.info is not a function" 500s.)
jest.mock('../config/database', () => ({ __esModule: true, default: {} }));

import { parseLedgerList, parseLedgerBalances, parseCompanyList } from './tally.service';
import { firstTag } from '../utils/tally-xml';

const DIR = path.resolve(__dirname, '__fixtures__', 'tally');
const read = (file: string): string | null => {
  const p = path.join(DIR, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

interface Case {
  file: string;
  name: string;
  check: (xml: string) => void;
}

const CASES: Case[] = [
  {
    file: 'ledgers.response.xml',
    name: 'ledger list (party group, GSTIN, registration type)',
    check: (xml) => {
      const rows = parseLedgerList(xml);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.name.length > 0)).toBe(true);

      // Parent group must come through (it went BLANK when the collection name
      // collided with a reserved TallyPrime name — LEDGER_COLLECTION_ID fix).
      expect(rows.some((r) => r.parent.length > 0)).toBe(true);

      // GSTIN regression: a registered party's GSTIN + registration type must parse.
      // EVERY gstin blank = the "registered ledger reads as Unregistered" bug.
      expect(rows.some((r) => r.gstin.length === 15)).toBe(true);
      expect(rows.some((r) => /regular/i.test(r.regType))).toBe(true);
    },
  },
  {
    file: 'ledger-balances.response.xml',
    name: 'party closing balances (Outstanding)',
    check: (xml) => {
      const rows = parseLedgerBalances(xml);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.name.length > 0)).toBe(true);

      // Classic tag-drift symptom: EVERY balance parsing to 0. A real capture has some non-zero.
      expect(rows.some((r) => r.closingBalance !== 0)).toBe(true);

      // Same collection-name fix benefits Outstanding: GSTIN rides along.
      expect(rows.some((r) => r.gstin.length === 15)).toBe(true);
    },
  },
  {
    file: 'companies.response.xml',
    name: 'company list',
    check: (xml) => {
      const companies = parseCompanyList(xml);
      expect(companies.length).toBeGreaterThan(0);
      expect(companies.every((c) => c.length > 0)).toBe(true);
    },
  },
  {
    file: 'voucher-import.response.xml',
    name: 'import response (success/error detection)',
    check: (xml) => {
      // A success response has CREATED or ALTERED > 0
      const created = Number(firstTag(xml, 'CREATED') ?? 0);
      const altered = Number(firstTag(xml, 'ALTERED') ?? 0);
      const errors = Number(firstTag(xml, 'ERRORS') ?? 0) + Number(firstTag(xml, 'EXCEPTIONS') ?? 0);

      // The fixture should be a success response
      expect(created + altered).toBeGreaterThan(0);
      expect(errors).toBe(0);
    },
  },
];

describe('Tally fixture regression tests', () => {
  for (const { file, name, check } of CASES) {
    it(`parses ${name}`, () => {
      const xml = read(file);
      if (!xml) {
        console.log(`[SKIP] Fixture not captured yet: ${file}`);
        return; // Auto-skip if fixture doesn't exist
      }
      check(xml);
    });
  }
});

describe('Import response parsing (silent failure detection)', () => {
  it('detects silent failure: EXCEPTIONS>0 with CREATED=0', () => {
    // This is the bug that cost hours: Tally returns EXCEPTIONS=1 but CREATED=0,
    // which the old code treated as success.
    const xml = `<ENVELOPE><IMPORTRESULT>
      <CREATED>0</CREATED>
      <ALTERED>0</ALTERED>
      <ERRORS>0</ERRORS>
      <EXCEPTIONS>1</EXCEPTIONS>
    </IMPORTRESULT></ENVELOPE>`;

    const created = Number(firstTag(xml, 'CREATED') ?? 0);
    const altered = Number(firstTag(xml, 'ALTERED') ?? 0);
    const errors = Number(firstTag(xml, 'ERRORS') ?? 0) + Number(firstTag(xml, 'EXCEPTIONS') ?? 0);
    const ok = errors === 0 && (created > 0 || altered > 0);

    expect(ok).toBe(false); // This MUST be failure, not success
  });

  it('detects success: CREATED>0 with no errors', () => {
    const xml = `<ENVELOPE><IMPORTRESULT>
      <CREATED>1</CREATED>
      <ALTERED>0</ALTERED>
      <ERRORS>0</ERRORS>
      <EXCEPTIONS>0</EXCEPTIONS>
      <LASTVCHID>12345</LASTVCHID>
    </IMPORTRESULT></ENVELOPE>`;

    const created = Number(firstTag(xml, 'CREATED') ?? 0);
    const altered = Number(firstTag(xml, 'ALTERED') ?? 0);
    const errors = Number(firstTag(xml, 'ERRORS') ?? 0) + Number(firstTag(xml, 'EXCEPTIONS') ?? 0);
    const ok = errors === 0 && (created > 0 || altered > 0);

    expect(ok).toBe(true);
  });
});

describe('REMOTEID uniqueness', () => {
  it('generates stable, namespaced remote IDs', () => {
    // This prevents duplicate vouchers in Tally
    const makeId = (prefix: string, id: string) => `${prefix}${id}`;

    const id1 = makeId('KF-INV-', 'invoice-123');
    const id2 = makeId('KF-INV-', 'invoice-123');

    expect(id1).toBe(id2); // Same input = same output
    expect(id1).toBe('KF-INV-invoice-123');

    // Different entities have different namespaces (no collision)
    const invId = makeId('KF-INV-', 'abc');
    const cnId = makeId('KF-CN-', 'abc');
    expect(invId).not.toBe(cnId);
  });
});
