/**
 * Tally ERP Integration Service
 *
 * Provides gateway communication and read functions for Tally integration.
 * Settings-phase only: connection test, ledger list, create missing ledgers.
 *
 * Ported from Kasya B2B Sales app tally.service.ts (trimmed for settings phase).
 */

import { TallySettings, tallySettingsService } from './tally-settings.service';
import { xmlEscape, xmlUnescape, firstTag, xe } from '../utils/tally-xml';
import { logError } from '../utils/logger';
import prisma from '../config/database';

// Mutex for single-threaded Tally gateway access
class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const gatewayMutex = new Mutex();

const POST_TIMEOUT_MS = 15000;
export const SLOW_READ_TIMEOUT_MS = 60000;

const DELETE_REQUEST_RE = /\bACTION\s*=\s*["']?\s*Delete\b/i;

export function assertNoDeleteRequest(xml: string): void {
  if (DELETE_REQUEST_RE.test(xml)) {
    throw new Error('Blocked by guardrail: the app never sends delete requests to Tally. Delete in Tally directly.');
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function post(settings: TallySettings, xml: string, timeoutMs = POST_TIMEOUT_MS): Promise<string> {
  assertNoDeleteRequest(xml);
  return gatewayMutex.run(() => postNow(settings, xml, timeoutMs));
}

async function postNow(settings: TallySettings, xml: string, timeoutMs = POST_TIMEOUT_MS): Promise<string> {
  const url = `http://${settings.tallyHost}:${settings.tallyPort}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xml,
      },
      timeoutMs
    );
  } catch (err) {
    throw new Error(
      `Could not reach Tally at ${settings.tallyHost}:${settings.tallyPort}. ` +
        'Check that TallyPrime is running with "acts as Server" enabled and the PC is reachable.'
    );
  }
  if (!res.ok) {
    throw new Error(`Tally returned HTTP ${res.status}.`);
  }
  return res.text();
}

// ═══════════════════════════════════════════════════════════════════════════
// XML Builders for READ operations
// ═══════════════════════════════════════════════════════════════════════════

export function buildListCompaniesXml(): string {
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="List of Companies" ISMODIFY="No">
<TYPE>Company</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

const LEDGER_COLLECTION_ID = 'KF Party Ledgers';

export function buildListLedgersXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${LEDGER_COLLECTION_ID}</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="${LEDGER_COLLECTION_ID}" ISMODIFY="No">
<TYPE>Ledger</TYPE>
<NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>Parent</NATIVEMETHOD>
<NATIVEMETHOD>PartyGSTIN</NATIVEMETHOD><NATIVEMETHOD>GSTRegistrationType</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

export function buildListVoucherTypesXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of VoucherTypes</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="List of VoucherTypes" ISMODIFY="No">
<TYPE>VoucherType</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

export function buildListGroupsXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Groups</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="List of Groups" ISMODIFY="No">
<TYPE>Group</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

export function buildListUnitsXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Units</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="List of Units" ISMODIFY="No">
<TYPE>Unit</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// XML Parsers
// ═══════════════════════════════════════════════════════════════════════════

export function parseCompanyList(xml: string): string[] {
  const out: string[] = [];
  const re = /<COMPANY\b[^>]*>([\s\S]*?)<\/COMPANY>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const name = firstTag(m[1], 'NAME');
    if (name) out.push(name);
  }
  if (out.length === 0) {
    const re2 = /<NAME>([\s\S]*?)<\/NAME>/gi;
    let n: RegExpExecArray | null;
    while ((n = re2.exec(xml))) out.push(xmlUnescape(n[1].trim()));
  }
  return out.filter(Boolean);
}

export interface TallyLedger {
  name: string;
  parent: string;
  gstin: string;
  regType: string;
}

function parseLedgerGst(body: string): { gstin: string; regType: string } {
  const blocks = [...body.matchAll(/<LEDGSTREGDETAILS\.LIST[^>]*>([\s\S]*?)<\/LEDGSTREGDETAILS\.LIST>/gi)];
  if (blocks.length) {
    const inner = blocks[blocks.length - 1][1];
    const gstin = (firstTag(inner, 'GSTIN') ?? '').trim();
    const regType =
      (firstTag(inner, 'GSTREGISTRATIONTYPE') ?? '').trim() || (firstTag(body, 'GSTREGISTRATIONTYPE') ?? '').trim();
    return { gstin, regType };
  }
  const gstin = (firstTag(body, 'PARTYGSTIN') ?? firstTag(body, 'GSTIN') ?? '').trim();
  const regType = (firstTag(body, 'GSTREGISTRATIONTYPE') ?? '').trim();
  return { gstin, regType };
}

export function parseLedgerList(xml: string): TallyLedger[] {
  const out: TallyLedger[] = [];
  const opens = [...xml.matchAll(/<LEDGER\b([^>]*)>/gi)];
  for (let i = 0; i < opens.length; i++) {
    const attrs = opens[i][1];
    const start = (opens[i].index ?? 0) + opens[i][0].length;
    const end = i + 1 < opens.length ? (opens[i + 1].index ?? xml.length) : xml.length;
    let body = xml.slice(start, end);
    const close = body.indexOf('</LEDGER>');
    if (close >= 0) body = body.slice(0, close);
    const nameAttr = /\bNAME\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const name = xmlUnescape((nameAttr ?? firstTag(body, 'NAME') ?? '').trim());
    if (!name) continue;
    const parent = firstTag(body, 'PARENT') ?? '';
    const { gstin, regType } = parseLedgerGst(body);
    out.push({ name, parent, gstin, regType });
  }
  return out;
}

function parseMasterNames(xml: string, tag: string): string[] {
  const out: string[] = [];
  const opens = [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))];
  for (let i = 0; i < opens.length; i++) {
    const attrs = opens[i][1];
    const start = (opens[i].index ?? 0) + opens[i][0].length;
    const end = i + 1 < opens.length ? (opens[i + 1].index ?? xml.length) : xml.length;
    let body = xml.slice(start, end);
    const close = body.indexOf(`</${tag}>`);
    if (close >= 0) body = body.slice(0, close);
    const nameAttr = /\bNAME\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const name = xmlUnescape((nameAttr ?? firstTag(body, 'NAME') ?? '').trim());
    if (name) out.push(name);
  }
  return out;
}

export const parseVoucherTypeList = (xml: string): string[] => parseMasterNames(xml, 'VOUCHERTYPE');
export const parseGroupList = (xml: string): string[] => parseMasterNames(xml, 'GROUP');
export const parseUnitList = (xml: string): string[] => parseMasterNames(xml, 'UNIT');

// ═══════════════════════════════════════════════════════════════════════════
// Outstanding / Receivables
// ═══════════════════════════════════════════════════════════════════════════

// Parse a Tally amount string ("12,548.00", "-12548.00", "1234 Dr") → number (sign preserved).
function parseTallyAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Parse the integer day count out of a credit-period string ("30 Days", "45") → number | null.
function parseDays(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export interface TallyLedgerBalance {
  name: string;
  parent: string;
  gstin: string;
  regType: string;
  closingBalance: number; // Amount owed to us (receivable); positive = owes us, negative = advance
  creditPeriodDays: number | null;
}

// Collection of party-group ledgers with their closing balance + credit period.
export function buildLedgerBalancesXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${LEDGER_COLLECTION_ID}</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="${LEDGER_COLLECTION_ID}" ISMODIFY="No">
<TYPE>Ledger</TYPE>
<NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>Parent</NATIVEMETHOD>
<NATIVEMETHOD>PartyGSTIN</NATIVEMETHOD><NATIVEMETHOD>GSTRegistrationType</NATIVEMETHOD>
<NATIVEMETHOD>ClosingBalance</NATIVEMETHOD><NATIVEMETHOD>BillCreditPeriod</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

export function parseLedgerBalances(xml: string): TallyLedgerBalance[] {
  const out: TallyLedgerBalance[] = [];
  const opens = [...xml.matchAll(/<LEDGER\b([^>]*)>/gi)];
  for (let i = 0; i < opens.length; i++) {
    const attrs = opens[i][1];
    const start = (opens[i].index ?? 0) + opens[i][0].length;
    const end = i + 1 < opens.length ? (opens[i + 1].index ?? xml.length) : xml.length;
    let body = xml.slice(start, end);
    const close = body.indexOf('</LEDGER>');
    if (close >= 0) body = body.slice(0, close);
    const nameAttr = /\bNAME\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const name = xmlUnescape((nameAttr ?? firstTag(body, 'NAME') ?? '').trim());
    if (!name) continue;
    const parent = firstTag(body, 'PARENT') ?? '';
    const { gstin, regType } = parseLedgerGst(body);
    // Tally exports debtor's receivable as NEGATIVE, so negate to get amount owed
    const rawBalance = parseTallyAmount(firstTag(body, 'CLOSINGBALANCE'));
    const closingBalance = rawBalance === 0 ? 0 : -rawBalance;
    const creditPeriodDays = parseDays(firstTag(body, 'BILLCREDITPERIOD'));
    out.push({ name, parent, gstin, regType, closingBalance, creditPeriodDays });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fetch functions (use gateway)
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchCompanies(settings: TallySettings): Promise<string[]> {
  const xml = await post(settings, buildListCompaniesXml());
  return parseCompanyList(xml);
}

export async function fetchLedgers(settings: TallySettings): Promise<TallyLedger[]> {
  const xml = await post(settings, buildListLedgersXml(settings), SLOW_READ_TIMEOUT_MS);
  return parseLedgerList(xml);
}

export async function fetchVoucherTypes(settings: TallySettings): Promise<string[]> {
  const xml = await post(settings, buildListVoucherTypesXml(settings));
  return parseVoucherTypeList(xml);
}

export async function fetchGroups(settings: TallySettings): Promise<string[]> {
  const xml = await post(settings, buildListGroupsXml(settings));
  return parseGroupList(xml);
}

export async function fetchUnits(settings: TallySettings): Promise<string[]> {
  const xml = await post(settings, buildListUnitsXml(settings));
  return parseUnitList(xml);
}

export async function fetchLedgerBalances(settings: TallySettings): Promise<TallyLedgerBalance[]> {
  const xml = await post(settings, buildLedgerBalancesXml(settings), SLOW_READ_TIMEOUT_MS);
  return parseLedgerBalances(xml);
}

// ═══════════════════════════════════════════════════════════════════════════
// Ledger existence check and "did you mean" suggestions
// ═══════════════════════════════════════════════════════════════════════════

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function closestLedger(target: string, ledgers: TallyLedger[]): { name: string; distance: number } | null {
  const norm = normalize(target);
  if (!norm) return null;

  let best: { name: string; distance: number } | null = null;
  for (const l of ledgers) {
    const ln = normalize(l.name);
    if (ln === norm) return { name: l.name, distance: 0 };
    const d = levenshtein(norm, ln);
    if (!best || d < best.distance) {
      best = { name: l.name, distance: d };
    }
  }
  return best && best.distance <= Math.max(5, norm.length / 2) ? best : null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ═══════════════════════════════════════════════════════════════════════════
// Test connection
// ═══════════════════════════════════════════════════════════════════════════

export interface LedgerCheck {
  name: string;
  present: boolean;
  suggestion?: string;
}

export interface TestConnectionResult {
  companies: string[];
  companyConfigured: string | null;
  companyMatched: boolean;
  ledgers: LedgerCheck[];
  warnings: string[];
}

export async function testConnection(): Promise<TestConnectionResult> {
  const settings = await tallySettingsService.get();

  const companies = await fetchCompanies(settings);
  const companyConfigured = settings.tallyCompanyName?.trim() || null;
  const companyMatched = companyConfigured
    ? companies.some((c) => normalize(c) === normalize(companyConfigured))
    : companies.length === 1;

  const warnings: string[] = [];
  if (!companyConfigured && companies.length > 1) {
    warnings.push(`Multiple companies open in Tally. Set "Company name" to pin which one to use.`);
  }

  let ledgerList: TallyLedger[] = [];
  try {
    ledgerList = await fetchLedgers(settings);
  } catch (err) {
    warnings.push(`Could not fetch ledgers: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ledgerNames = new Set(ledgerList.map((l) => normalize(l.name)));

  const checkLedger = (name: string | null | undefined): LedgerCheck => {
    const n = name?.trim() || '';
    if (!n) return { name: '(not configured)', present: false };
    const present = ledgerNames.has(normalize(n));
    const suggestion = present ? undefined : closestLedger(n, ledgerList)?.name;
    return { name: n, present, suggestion };
  };

  const ledgers: LedgerCheck[] = [
    {
      ...checkLedger(settings.tallySalesLedgerIntra),
      name: `Sales Intra: ${settings.tallySalesLedgerIntra || '(not set)'}`,
    },
    {
      ...checkLedger(settings.tallySalesLedgerInter),
      name: `Sales Inter: ${settings.tallySalesLedgerInter || '(not set)'}`,
    },
    { ...checkLedger(settings.tallyCgstLedger), name: `CGST 5%: ${settings.tallyCgstLedger || '(not set)'}` },
    { ...checkLedger(settings.tallySgstLedger), name: `SGST 5%: ${settings.tallySgstLedger || '(not set)'}` },
    { ...checkLedger(settings.tallyIgstLedger), name: `IGST 5%: ${settings.tallyIgstLedger || '(not set)'}` },
    { ...checkLedger(settings.tallyCgstLedger18), name: `CGST 18%: ${settings.tallyCgstLedger18 || '(not set)'}` },
    { ...checkLedger(settings.tallySgstLedger18), name: `SGST 18%: ${settings.tallySgstLedger18 || '(not set)'}` },
    { ...checkLedger(settings.tallyIgstLedger18), name: `IGST 18%: ${settings.tallyIgstLedger18 || '(not set)'}` },
    { ...checkLedger(settings.tallyRoundOffLedger), name: `Round Off: ${settings.tallyRoundOffLedger || '(not set)'}` },
    { ...checkLedger(settings.tallyFreightLedger), name: `Freight: ${settings.tallyFreightLedger || '(not set)'}` },
  ];

  return {
    companies,
    companyConfigured,
    companyMatched,
    ledgers,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Create missing ledgers
// ═══════════════════════════════════════════════════════════════════════════

export type GstDutyHead = 'Central Tax' | 'State Tax' | 'Integrated Tax';

export interface BasicLedgerSpec {
  name: string;
  parent: string;
  gstDutyHead?: GstDutyHead;
}

export function plannedLedgers(settings: TallySettings): BasicLedgerSpec[] {
  const all: BasicLedgerSpec[] = [
    { name: settings.tallySalesLedgerIntra, parent: 'Sales Accounts' },
    { name: settings.tallySalesLedgerInter, parent: 'Sales Accounts' },
    { name: settings.tallyCgstLedger, parent: 'Duties & Taxes', gstDutyHead: 'Central Tax' },
    { name: settings.tallySgstLedger, parent: 'Duties & Taxes', gstDutyHead: 'State Tax' },
    { name: settings.tallyIgstLedger, parent: 'Duties & Taxes', gstDutyHead: 'Integrated Tax' },
    { name: settings.tallyCgstLedger18, parent: 'Duties & Taxes', gstDutyHead: 'Central Tax' },
    { name: settings.tallySgstLedger18, parent: 'Duties & Taxes', gstDutyHead: 'State Tax' },
    { name: settings.tallyIgstLedger18, parent: 'Duties & Taxes', gstDutyHead: 'Integrated Tax' },
    { name: settings.tallyRoundOffLedger, parent: 'Indirect Incomes' },
    { name: settings.tallyFreightLedger, parent: 'Indirect Incomes' },
  ];
  const seen = new Set<string>();
  return all.filter((x) => {
    const k = (x.name ?? '').trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function buildBasicLedgerXml(
  spec: BasicLedgerSpec,
  settings: TallySettings,
  action: 'Create' | 'Alter' = 'Create'
): string {
  const company = settings.tallyCompanyName;
  const gst = spec.gstDutyHead ? `<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>${xe(spec.gstDutyHead)}</GSTDUTYHEAD>` : '';
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC><STATICVARIABLES>${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES></DESC>
<DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
<LEDGER NAME="${xe(spec.name)}" ACTION="${action}">
<NAME.LIST TYPE="String"><NAME>${xe(spec.name)}</NAME></NAME.LIST>
<PARENT>${xe(spec.parent)}</PARENT>
<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
<AFFECTSSTOCK>No</AFFECTSSTOCK>
${gst}
</LEDGER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

interface ImportResult {
  ok: boolean;
  created: number;
  altered: number;
  errors: number;
  lineError: string | null;
}

function parseImportResponse(xml: string): ImportResult {
  const created = Number(firstTag(xml, 'CREATED') ?? 0) || 0;
  const altered = Number(firstTag(xml, 'ALTERED') ?? 0) || 0;
  const errors = (Number(firstTag(xml, 'ERRORS') ?? 0) || 0) + (Number(firstTag(xml, 'EXCEPTIONS') ?? 0) || 0);
  const lineError = firstTag(xml, 'LINEERROR') || null;
  const looksLikeResponse = /<(RESPONSE|IMPORTRESULT|LINEERROR|CREATED|ALTERED|ERRORS|EXCEPTIONS|IGNORED)\b/i.test(xml);
  if (!looksLikeResponse) {
    throw new Error('Unexpected reply from Tally. Make sure the correct company is open.');
  }
  const ok = errors === 0 && (created > 0 || altered > 0);
  return { ok, created, altered, errors, lineError };
}

export interface CreateLedgersResult {
  created: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

export async function createMissingLedgers(): Promise<CreateLedgersResult> {
  const settings = await tallySettingsService.get();
  const existing = await fetchLedgers(settings);
  const have = new Set(existing.map((l) => normalize(l.name)));

  const out: CreateLedgersResult = { created: [], skipped: [], failed: [] };
  const planned = plannedLedgers(settings);

  for (const spec of planned) {
    if (have.has(normalize(spec.name))) {
      out.skipped.push(spec.name);
      continue;
    }
    try {
      const res = parseImportResponse(await post(settings, buildBasicLedgerXml(spec, settings)));
      if (res.ok) {
        out.created.push(spec.name);
      } else {
        out.failed.push({ name: spec.name, error: res.lineError || 'Tally did not create the ledger' });
      }
    } catch (e) {
      out.failed.push({ name: spec.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Customer-Ledger Matching
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomerTallyMatch {
  id: string;
  code: string;
  name: string;
  billingName: string | null;
  gstNumber: string | null;
  tallyLedgerName: string | null;
  tallyMatched: boolean;
  suggestion?: string;
}

export interface CustomerMatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  matchStatus?: 'all' | 'matched' | 'unmatched';
}

export interface CustomerMatchResult {
  data: CustomerTallyMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    matched: number;
    unmatched: number;
  };
}

/**
 * Get customers with their Tally ledger match status.
 * Optionally fetches Tally ledgers to provide suggestions for unmatched customers.
 */
export async function getCustomersWithTallyStatus(
  params: CustomerMatchQueryParams,
  fetchSuggestions = false
): Promise<CustomerMatchResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    isActive: true,
  };

  if (params.search) {
    where.OR = [
      { code: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
      { billingName: { contains: params.search, mode: 'insensitive' } },
      { gstNumber: { contains: params.search, mode: 'insensitive' } },
      { tallyLedgerName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.matchStatus === 'matched') {
    where.tallyLedgerName = { not: null };
  } else if (params.matchStatus === 'unmatched') {
    where.OR = [{ tallyLedgerName: null }, { tallyLedgerName: '' }];
  }

  // Get customers and total count
  const [customers, total] = await Promise.all([
    prisma.customers.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        billingName: true,
        gstNumber: true,
        tallyLedgerName: true,
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.customers.count({ where }),
  ]);

  // Get stats
  const [matchedCount, unmatchedCount] = await Promise.all([
    prisma.customers.count({
      where: { isActive: true, tallyLedgerName: { not: null } },
    }),
    prisma.customers.count({
      where: { isActive: true, OR: [{ tallyLedgerName: null }, { tallyLedgerName: '' }] },
    }),
  ]);

  // Optionally fetch Tally ledgers for suggestions
  let tallyLedgers: TallyLedger[] = [];
  if (fetchSuggestions) {
    try {
      const settings = await tallySettingsService.get();
      tallyLedgers = await fetchLedgers(settings);
    } catch (err) {
      logError('Failed to fetch Tally ledgers for suggestions', err);
    }
  }

  // Build result with match status
  const data: CustomerTallyMatch[] = customers.map((c) => {
    const tallyMatched = !!(c.tallyLedgerName && c.tallyLedgerName.trim());
    let suggestion: string | undefined;

    // Try to find a suggestion if unmatched and we have ledgers
    if (!tallyMatched && tallyLedgers.length > 0) {
      // Try to match by name or billing name
      const searchNames = [c.name, c.billingName].filter(Boolean) as string[];
      for (const name of searchNames) {
        const match = closestLedger(name, tallyLedgers);
        if (match && match.distance <= 3) {
          suggestion = match.name;
          break;
        }
      }
    }

    return {
      id: c.id,
      code: c.code,
      name: c.name,
      billingName: c.billingName,
      gstNumber: c.gstNumber,
      tallyLedgerName: c.tallyLedgerName,
      tallyMatched,
      suggestion,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      total: matchedCount + unmatchedCount,
      matched: matchedCount,
      unmatched: unmatchedCount,
    },
  };
}

/**
 * Link a customer to a Tally ledger.
 */
export async function linkCustomerToTallyLedger(customerId: string, tallyLedgerName: string): Promise<void> {
  await prisma.customers.update({
    where: { id: customerId },
    data: { tallyLedgerName: tallyLedgerName.trim() || null },
  });
}

/**
 * Unlink a customer from their Tally ledger.
 */
export async function unlinkCustomerFromTallyLedger(customerId: string): Promise<void> {
  await prisma.customers.update({
    where: { id: customerId },
    data: { tallyLedgerName: null },
  });
}

/**
 * Auto-match customers to Tally ledgers by exact name match.
 * Returns the number of customers matched.
 */
export async function autoMatchCustomers(): Promise<{ matched: number; total: number }> {
  const settings = await tallySettingsService.get();
  const tallyLedgers = await fetchLedgers(settings);

  // Build a map of normalized ledger names
  const ledgerMap = new Map<string, string>();
  for (const l of tallyLedgers) {
    ledgerMap.set(normalize(l.name), l.name);
  }

  // Get unmatched customers
  const unmatchedCustomers = await prisma.customers.findMany({
    where: {
      isActive: true,
      OR: [{ tallyLedgerName: null }, { tallyLedgerName: '' }],
    },
    select: {
      id: true,
      name: true,
      billingName: true,
    },
  });

  let matched = 0;
  for (const c of unmatchedCustomers) {
    // Try exact match with name first, then billingName
    const searchNames = [c.name, c.billingName].filter(Boolean) as string[];
    for (const name of searchNames) {
      const normalizedName = normalize(name);
      if (ledgerMap.has(normalizedName)) {
        const ledgerName = ledgerMap.get(normalizedName)!;
        await prisma.customers.update({
          where: { id: c.id },
          data: { tallyLedgerName: ledgerName },
        });
        matched++;
        break;
      }
    }
  }

  return { matched, total: unmatchedCustomers.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// Invoice Push to Tally
// ═══════════════════════════════════════════════════════════════════════════

// GST rate threshold: apparel > ₹2,500/piece = 18%, else 5%
const GST_RATE_HIGH = 18;
const GST_RATE_LOW = 5;
const APPAREL_PRICE_THRESHOLD = 2500;

// Format amount for Tally XML (2 decimal places, handle -0)
const amt = (n: number): string => (Object.is(n, -0) ? 0 : n).toFixed(2);

// Format date as YYYYMMDD for Tally
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Round to 2 decimal places
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// Create a ledger entry line (Dr/Cr sign rule: Debit = negative, Credit = positive)
function ledgerEntry(name: string, amount: number, isDebit: boolean, billRef?: string): string {
  const signed = isDebit ? -Math.abs(amount) : Math.abs(amount);
  const bill = billRef
    ? `<BILLALLOCATIONS.LIST><NAME>${xe(billRef)}</NAME>` +
      `<BILLTYPE>New Ref</BILLTYPE><AMOUNT>${amt(signed)}</AMOUNT></BILLALLOCATIONS.LIST>`
    : '';
  return (
    `<LEDGERENTRIES.LIST>` +
    `<LEDGERNAME>${xe(name)}</LEDGERNAME>` +
    `<ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>` +
    (billRef ? '<ISPARTYLEDGER>Yes</ISPARTYLEDGER>' : '') +
    `<AMOUNT>${amt(signed)}</AMOUNT>${bill}` +
    `</LEDGERENTRIES.LIST>`
  );
}

export interface InvoiceForTally {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  customerId: string;
  isInterstate: boolean;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  // e-Invoice details generated by the ERP — embedded in the voucher so Tally
  // records the sale as already IRN-registered and does not re-generate
  eInvoiceIrn?: string | null;
  eInvoiceAckNo?: string | null;
  eInvoiceAckDate?: Date | null;
  eInvoiceStatus?: string | null;
  customers: {
    name: string;
    tallyLedgerName: string | null;
    billingAddress: string | null;
    billingStateId: string | null;
    billingState?: { name: string; stateCode: string } | null;
  };
  invoice_items: Array<{
    description: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    gstRate: number | null;
    cgstRate: number | null;
    cgstAmount: number | null;
    sgstRate: number | null;
    sgstAmount: number | null;
    igstRate: number | null;
    igstAmount: number | null;
  }>;
}

export interface PushInvoiceResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

/**
 * Build the Tally Sales Voucher XML for an invoice.
 */
export function buildSalesVoucherXml(
  invoice: InvoiceForTally,
  settings: TallySettings,
  action: 'Create' | 'Alter' = 'Create'
): string {
  const partyLedgerName = invoice.customers.tallyLedgerName;
  if (!partyLedgerName) {
    throw new Error('Customer does not have a linked Tally ledger. Link it first.');
  }

  const invNo = invoice.invoiceNumber;
  const date = fmtDate(invoice.invoiceDate);
  const company = settings.tallyCompanyName;
  const godown = settings.tallyGodownName || 'Main Location';
  const unit = settings.tallyStockUnit || 'Pcs';
  const voucherType = settings.tallyVoucherType || 'Sales';
  const remoteId = `KF-INV-${invoice.id}`;

  // Determine intra/inter state based on invoice flag
  const isIntraState = !invoice.isInterstate;

  // Select sales ledger based on intra/inter
  const salesLedger = isIntraState ? settings.tallySalesLedgerIntra : settings.tallySalesLedgerInter;

  // Total GST rate per item (5 vs 18 bucket). The old heuristic tested cgstRate >= 9,
  // which is null on interstate (IGST) invoices — every 18% IGST line landed in the 5%
  // bucket and posted to the wrong ledger. Derive the full rate from what's populated.
  const itemGstRate = (item: InvoiceForTally['invoice_items'][number]): number => {
    if (item.gstRate != null) return item.gstRate;
    return invoice.isInterstate ? (item.igstRate ?? 0) : (item.cgstRate ?? 0) * 2;
  };

  // Build inventory entries for each line item
  const inventoryLines = invoice.invoice_items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const amount = Number(item.totalPrice);
      const qtyStr = `${item.quantity} ${unit}`;
      const rateStr = `${Number(item.unitPrice).toFixed(2)}/${unit}`;
      const stockName = item.description; // Use description as stock item name

      return (
        `<ALLINVENTORYENTRIES.LIST>` +
        `<STOCKITEMNAME>${xe(stockName)}</STOCKITEMNAME>` +
        `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>` +
        `<RATE>${xe(rateStr)}</RATE>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `<BATCHALLOCATIONS.LIST>` +
        `<GODOWNNAME>${xe(godown)}</GODOWNNAME><BATCHNAME>Primary Batch</BATCHNAME>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `</BATCHALLOCATIONS.LIST>` +
        `<ACCOUNTINGALLOCATIONS.LIST>` +
        `<LEDGERNAME>${xe(salesLedger)}</LEDGERNAME>` +
        `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `</ACCOUNTINGALLOCATIONS.LIST>` +
        `</ALLINVENTORYENTRIES.LIST>`
      );
    })
    .join('');

  // Aggregate GST by rate bucket (5% vs 18%)
  const gstBuckets = new Map<string, { cgst: number; sgst: number; igst: number }>();
  for (const item of invoice.invoice_items) {
    const rateKey = itemGstRate(item) >= GST_RATE_HIGH ? '18' : '5';
    const bucket = gstBuckets.get(rateKey) || { cgst: 0, sgst: 0, igst: 0 };
    bucket.cgst += Number(item.cgstAmount || 0);
    bucket.sgst += Number(item.sgstAmount || 0);
    bucket.igst += Number(item.igstAmount || 0);
    gstBuckets.set(rateKey, bucket);
  }

  // Build GST ledger entries
  let gstLines = '';
  for (const [rateKey, bucket] of gstBuckets) {
    const isHighRate = rateKey === '18';
    if (isIntraState) {
      if (bucket.cgst > 0) {
        const cgstLedger = isHighRate ? settings.tallyCgstLedger18 : settings.tallyCgstLedger;
        gstLines += ledgerEntry(cgstLedger, round2(bucket.cgst), false);
      }
      if (bucket.sgst > 0) {
        const sgstLedger = isHighRate ? settings.tallySgstLedger18 : settings.tallySgstLedger;
        gstLines += ledgerEntry(sgstLedger, round2(bucket.sgst), false);
      }
    } else {
      if (bucket.igst > 0) {
        const igstLedger = isHighRate ? settings.tallyIgstLedger18 : settings.tallyIgstLedger;
        gstLines += ledgerEntry(igstLedger, round2(bucket.igst), false);
      }
    }
  }

  // Round-off calculation
  const calculatedTotal = round2(
    Number(invoice.subtotal) + Number(invoice.cgstAmount) + Number(invoice.sgstAmount) + Number(invoice.igstAmount)
  );
  const actualTotal = Number(invoice.totalAmount);
  const roundOff = round2(actualTotal - calculatedTotal);
  const roundLine =
    Math.abs(roundOff) < 0.01 ? '' : ledgerEntry(settings.tallyRoundOffLedger, Math.abs(roundOff), roundOff < 0);

  // Party ledger entry (debit the customer)
  const partyLine = ledgerEntry(partyLedgerName, actualTotal, true, invNo);

  // Buyer details
  const buyerName = invoice.customers.name;
  const buyerAddress = invoice.customers.billingAddress || '';
  const buyerState = invoice.customers.billingState?.name || '';

  // e-Invoice details: when the ERP already generated the IRN, embed it so the
  // Tally voucher shows as IRN-registered (Tally will not try to re-generate).
  const irnLines =
    invoice.eInvoiceIrn && invoice.eInvoiceStatus === 'GENERATED'
      ? `<IRN>${xe(invoice.eInvoiceIrn)}</IRN>` +
        (invoice.eInvoiceAckNo ? `<IRNACKNO>${xe(invoice.eInvoiceAckNo)}</IRNACKNO>` : '') +
        (invoice.eInvoiceAckDate ? `<IRNACKDATE>${fmtDate(invoice.eInvoiceAckDate)}</IRNACKDATE>` : '')
      : '';

  // Build the voucher XML
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC><STATICVARIABLES>${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES></DESC>
<DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER REMOTEID="${xe(remoteId)}" VCHTYPE="${xe(voucherType)}" ACTION="${action}">
<DATE>${date}</DATE>
<VOUCHERTYPENAME>${xe(voucherType)}</VOUCHERTYPENAME>
<VOUCHERNUMBER>${xe(invNo)}</VOUCHERNUMBER>
<PARTYLEDGERNAME>${xe(partyLedgerName)}</PARTYLEDGERNAME>
<BASICBUYERNAME>${xe(buyerName)}</BASICBUYERNAME>
<ISINVOICE>Yes</ISINVOICE>
<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
${buyerState ? `<STATENAME>${xe(buyerState)}</STATENAME>` : ''}
<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
${irnLines}
${inventoryLines}
${partyLine}
${gstLines}
${roundLine}
</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

/**
 * Push an invoice to Tally.
 */
export async function pushInvoiceToTally(invoiceId: string): Promise<PushInvoiceResult> {
  // Fetch invoice with customer and items
  const invoice = await prisma.invoices.findUnique({
    where: { id: invoiceId },
    include: {
      customers: {
        include: {
          billingState: true,
        },
      },
      invoice_items: true,
    },
  });

  if (!invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  if (!invoice.customers.tallyLedgerName) {
    return {
      success: false,
      error: `Customer "${invoice.customers.name}" is not linked to a Tally ledger. Link it first in Settings → Tally → Customer Matching.`,
    };
  }

  // Check if Tally is enabled
  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    return { success: false, error: 'Tally integration is disabled. Enable it in Settings → Tally.' };
  }

  if (!settings.tallyCompanyName) {
    return { success: false, error: 'Tally company name is not configured.' };
  }

  // Transform to InvoiceForTally
  const invoiceData: InvoiceForTally = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    customerId: invoice.customerId,
    isInterstate: invoice.isInterstate,
    subtotal: Number(invoice.subtotal),
    cgstAmount: Number(invoice.cgstAmount),
    sgstAmount: Number(invoice.sgstAmount),
    igstAmount: Number(invoice.igstAmount),
    totalAmount: Number(invoice.totalAmount),
    eInvoiceIrn: invoice.eInvoiceIrn,
    eInvoiceAckNo: invoice.eInvoiceAckNo,
    eInvoiceAckDate: invoice.eInvoiceAckDate,
    eInvoiceStatus: invoice.eInvoiceStatus,
    customers: {
      name: invoice.customers.name,
      tallyLedgerName: invoice.customers.tallyLedgerName,
      billingAddress: invoice.customers.billingAddress,
      billingStateId: invoice.customers.billingStateId,
      billingState: invoice.customers.billingState
        ? { name: invoice.customers.billingState.stateName, stateCode: invoice.customers.billingState.stateCode }
        : null,
    },
    invoice_items: invoice.invoice_items.map((item) => ({
      description: item.description,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      gstRate: item.gstRate ? Number(item.gstRate) : null,
      cgstRate: item.cgstRate ? Number(item.cgstRate) : null,
      cgstAmount: item.cgstAmount ? Number(item.cgstAmount) : null,
      sgstRate: item.sgstRate ? Number(item.sgstRate) : null,
      sgstAmount: item.sgstAmount ? Number(item.sgstAmount) : null,
      igstRate: item.igstRate ? Number(item.igstRate) : null,
      igstAmount: item.igstAmount ? Number(item.igstAmount) : null,
    })),
  };

  // Determine action: Create or Alter (if already pushed)
  const action = invoice.tallyPushedAt ? 'Alter' : 'Create';

  try {
    // Build and send the voucher
    const xml = buildSalesVoucherXml(invoiceData, settings, action);
    const response = await post(settings, xml);

    // Parse response
    const created = Number(firstTag(response, 'CREATED') ?? 0) || 0;
    const altered = Number(firstTag(response, 'ALTERED') ?? 0) || 0;
    const errors =
      (Number(firstTag(response, 'ERRORS') ?? 0) || 0) + (Number(firstTag(response, 'EXCEPTIONS') ?? 0) || 0);
    const lineError = firstTag(response, 'LINEERROR') || null;

    if (errors > 0 || (created === 0 && altered === 0)) {
      const errorMsg = lineError || 'Tally did not accept the voucher. Check company and ledger configuration.';
      await prisma.invoices.update({
        where: { id: invoiceId },
        data: { tallyLastError: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    // Success - update invoice
    await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        tallyPushedAt: new Date(),
        tallyVoucherNumber: invoice.invoiceNumber,
        tallyLastError: null,
      },
    });

    return {
      success: true,
      voucherNumber: invoice.invoiceNumber,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error pushing to Tally';
    logError('Failed to push invoice to Tally', err);

    await prisma.invoices.update({
      where: { id: invoiceId },
      data: { tallyLastError: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Get invoices with their Tally push status.
 */
export async function getInvoicesWithTallyStatus(params: {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}): Promise<{
  data: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: Date;
    customerName: string;
    totalAmount: number;
    tallyPushedAt: Date | null;
    tallyVoucherNumber: string | null;
    tallyLastError: string | null;
    customerLinked: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
      { customers: { name: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  if (params.pushStatus === 'pushed') {
    where.tallyPushedAt = { not: null };
  } else if (params.pushStatus === 'not_pushed') {
    where.tallyPushedAt = null;
    where.tallyLastError = null;
  } else if (params.pushStatus === 'error') {
    where.tallyLastError = { not: null };
  }

  const [invoices, total] = await Promise.all([
    prisma.invoices.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        tallyPushedAt: true,
        tallyVoucherNumber: true,
        tallyLastError: true,
        customers: {
          select: {
            name: true,
            tallyLedgerName: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoices.count({ where }),
  ]);

  return {
    data: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      customerName: inv.customers.name,
      totalAmount: Number(inv.totalAmount),
      tallyPushedAt: inv.tallyPushedAt,
      tallyVoucherNumber: inv.tallyVoucherNumber,
      tallyLastError: inv.tallyLastError,
      customerLinked: !!inv.customers.tallyLedgerName,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Credit Note Push to Tally
// ═══════════════════════════════════════════════════════════════════════════

export interface CreditNoteForTally {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: Date;
  invoiceId: string;
  customerId: string;
  isInterstate: boolean;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  reason: string;
  invoice: {
    invoiceNumber: string;
  };
  customer: {
    name: string;
    tallyLedgerName: string | null;
    billingAddress: string | null;
    billingStateId: string | null;
    billingState?: { name: string; stateCode: string } | null;
  };
  items: Array<{
    description: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    gstRate: number | null;
    cgstAmount: number | null;
    sgstAmount: number | null;
    igstAmount: number | null;
  }>;
}

export interface PushCreditNoteResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

/**
 * Build the Tally Credit Note Voucher XML.
 * Credit note reverses a sale: credits the customer, returns stock.
 */
export function buildCreditNoteVoucherXml(
  creditNote: CreditNoteForTally,
  settings: TallySettings,
  action: 'Create' | 'Alter' = 'Create'
): string {
  const partyLedgerName = creditNote.customer.tallyLedgerName;
  if (!partyLedgerName) {
    throw new Error('Customer does not have a linked Tally ledger. Link it first.');
  }

  const cnNo = creditNote.creditNoteNumber;
  const date = fmtDate(creditNote.creditNoteDate);
  const company = settings.tallyCompanyName;
  const godown = settings.tallyGodownName || 'Main Location';
  const unit = settings.tallyStockUnit || 'Pcs';
  // Credit Note voucher type (could be "Credit Note" or "Sales Return" in some Tally setups)
  const voucherType = 'Credit Note';
  const remoteId = `KF-CN-${creditNote.id}`;

  // Determine intra/inter state
  const isIntraState = !creditNote.isInterstate;

  // Select sales ledger (reversed - so still same ledger but entries are reversed)
  const salesLedger = isIntraState ? settings.tallySalesLedgerIntra : settings.tallySalesLedgerInter;

  // Check for rate (5% vs 18%)
  const is18 = (rate: number | null) => (rate ?? 0) >= GST_RATE_HIGH / 2;

  // Build inventory entries for each line item (RETURN: opposite of sales)
  // In credit note: stock is RETURNED to us (ISDEEMEDPOSITIVE = Yes)
  const inventoryLines = creditNote.items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const amount = Number(item.totalPrice);
      const qtyStr = `${item.quantity} ${unit}`;
      const rateStr = `${Number(item.unitPrice).toFixed(2)}/${unit}`;
      const stockName = item.description;

      // Credit note: stock returns TO inventory, so ISDEEMEDPOSITIVE=Yes, amount negative
      return (
        `<ALLINVENTORYENTRIES.LIST>` +
        `<STOCKITEMNAME>${xe(stockName)}</STOCKITEMNAME>` +
        `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>` +
        `<RATE>${xe(rateStr)}</RATE>` +
        `<AMOUNT>${amt(-amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `<BATCHALLOCATIONS.LIST>` +
        `<GODOWNNAME>${xe(godown)}</GODOWNNAME><BATCHNAME>Primary Batch</BATCHNAME>` +
        `<AMOUNT>${amt(-amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `</BATCHALLOCATIONS.LIST>` +
        `<ACCOUNTINGALLOCATIONS.LIST>` +
        `<LEDGERNAME>${xe(salesLedger)}</LEDGERNAME>` +
        `<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>` +
        `<AMOUNT>${amt(-amount)}</AMOUNT>` +
        `</ACCOUNTINGALLOCATIONS.LIST>` +
        `</ALLINVENTORYENTRIES.LIST>`
      );
    })
    .join('');

  // Aggregate GST by rate bucket (5% vs 18%)
  const gstBuckets = new Map<string, { cgst: number; sgst: number; igst: number }>();
  for (const item of creditNote.items) {
    const rateKey = is18(item.gstRate) ? '18' : '5';
    const bucket = gstBuckets.get(rateKey) || { cgst: 0, sgst: 0, igst: 0 };
    bucket.cgst += Number(item.cgstAmount || 0);
    bucket.sgst += Number(item.sgstAmount || 0);
    bucket.igst += Number(item.igstAmount || 0);
    gstBuckets.set(rateKey, bucket);
  }

  // Build GST ledger entries (REVERSED: credit note reduces GST liability)
  // In credit note: GST entries are DEBITED (opposite of sales)
  let gstLines = '';
  for (const [rateKey, bucket] of gstBuckets) {
    const isHighRate = rateKey === '18';
    if (isIntraState) {
      if (bucket.cgst > 0) {
        const cgstLedger = isHighRate ? settings.tallyCgstLedger18 : settings.tallyCgstLedger;
        gstLines += ledgerEntry(cgstLedger, round2(bucket.cgst), true); // Debit
      }
      if (bucket.sgst > 0) {
        const sgstLedger = isHighRate ? settings.tallySgstLedger18 : settings.tallySgstLedger;
        gstLines += ledgerEntry(sgstLedger, round2(bucket.sgst), true); // Debit
      }
    } else {
      if (bucket.igst > 0) {
        const igstLedger = isHighRate ? settings.tallyIgstLedger18 : settings.tallyIgstLedger;
        gstLines += ledgerEntry(igstLedger, round2(bucket.igst), true); // Debit
      }
    }
  }

  // Round-off calculation
  const calculatedTotal = round2(
    Number(creditNote.subtotal) +
      Number(creditNote.cgstAmount) +
      Number(creditNote.sgstAmount) +
      Number(creditNote.igstAmount)
  );
  const actualTotal = Number(creditNote.totalAmount);
  const roundOff = round2(actualTotal - calculatedTotal);
  // Credit note round-off: opposite direction
  const roundLine =
    Math.abs(roundOff) < 0.01 ? '' : ledgerEntry(settings.tallyRoundOffLedger, Math.abs(roundOff), roundOff > 0);

  // Party ledger entry (CREDIT the customer - reduces their outstanding)
  // Reference the original invoice for bill adjustment
  const partyLine = ledgerEntry(partyLedgerName, actualTotal, false, creditNote.invoice.invoiceNumber);

  // Buyer details
  const buyerName = creditNote.customer.name;
  const buyerState = creditNote.customer.billingState?.name || '';

  // Build the voucher XML
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC><STATICVARIABLES>${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES></DESC>
<DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER REMOTEID="${xe(remoteId)}" VCHTYPE="${xe(voucherType)}" ACTION="${action}">
<DATE>${date}</DATE>
<VOUCHERTYPENAME>${xe(voucherType)}</VOUCHERTYPENAME>
<VOUCHERNUMBER>${xe(cnNo)}</VOUCHERNUMBER>
<PARTYLEDGERNAME>${xe(partyLedgerName)}</PARTYLEDGERNAME>
<BASICBUYERNAME>${xe(buyerName)}</BASICBUYERNAME>
<ISINVOICE>Yes</ISINVOICE>
<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
<REFERENCE>${xe(creditNote.invoice.invoiceNumber)}</REFERENCE>
<NARRATION>Against Invoice: ${xe(creditNote.invoice.invoiceNumber)}. Reason: ${xe(creditNote.reason)}</NARRATION>
${buyerState ? `<STATENAME>${xe(buyerState)}</STATENAME>` : ''}
<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
${inventoryLines}
${partyLine}
${gstLines}
${roundLine}
</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

/**
 * Push a credit note to Tally.
 */
export async function pushCreditNoteToTally(creditNoteId: string): Promise<PushCreditNoteResult> {
  // Fetch credit note with customer and items
  const creditNote = await prisma.credit_notes.findUnique({
    where: { id: creditNoteId },
    include: {
      invoice: {
        select: { invoiceNumber: true },
      },
      customer: {
        include: {
          billingState: true,
        },
      },
      items: true,
    },
  });

  if (!creditNote) {
    return { success: false, error: 'Credit note not found' };
  }

  if (!creditNote.customer.tallyLedgerName) {
    return {
      success: false,
      error: `Customer "${creditNote.customer.name}" is not linked to a Tally ledger. Link it first in Settings → Tally → Customer Matching.`,
    };
  }

  // Check if Tally is enabled
  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    return { success: false, error: 'Tally integration is disabled. Enable it in Settings → Tally.' };
  }

  if (!settings.tallyCompanyName) {
    return { success: false, error: 'Tally company name is not configured.' };
  }

  // Transform to CreditNoteForTally
  const cnData: CreditNoteForTally = {
    id: creditNote.id,
    creditNoteNumber: creditNote.creditNoteNumber,
    creditNoteDate: creditNote.creditNoteDate,
    invoiceId: creditNote.invoiceId,
    customerId: creditNote.customerId,
    isInterstate: creditNote.isInterstate,
    subtotal: Number(creditNote.subtotal),
    cgstAmount: Number(creditNote.cgstAmount),
    sgstAmount: Number(creditNote.sgstAmount),
    igstAmount: Number(creditNote.igstAmount),
    totalAmount: Number(creditNote.totalAmount),
    reason: creditNote.reason,
    invoice: {
      invoiceNumber: creditNote.invoice.invoiceNumber,
    },
    customer: {
      name: creditNote.customer.name,
      tallyLedgerName: creditNote.customer.tallyLedgerName,
      billingAddress: creditNote.customer.billingAddress,
      billingStateId: creditNote.customer.billingStateId,
      billingState: creditNote.customer.billingState
        ? { name: creditNote.customer.billingState.stateName, stateCode: creditNote.customer.billingState.stateCode }
        : null,
    },
    items: creditNote.items.map((item) => ({
      description: item.description,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      gstRate: item.gstRate ? Number(item.gstRate) : null,
      cgstAmount: item.cgstAmount ? Number(item.cgstAmount) : null,
      sgstAmount: item.sgstAmount ? Number(item.sgstAmount) : null,
      igstAmount: item.igstAmount ? Number(item.igstAmount) : null,
    })),
  };

  // Determine action: Create or Alter (if already pushed)
  const action = creditNote.tallyPushedAt ? 'Alter' : 'Create';

  try {
    // Build and send the voucher
    const xml = buildCreditNoteVoucherXml(cnData, settings, action);
    const response = await post(settings, xml);

    // Parse response
    const created = Number(firstTag(response, 'CREATED') ?? 0) || 0;
    const altered = Number(firstTag(response, 'ALTERED') ?? 0) || 0;
    const errors =
      (Number(firstTag(response, 'ERRORS') ?? 0) || 0) + (Number(firstTag(response, 'EXCEPTIONS') ?? 0) || 0);
    const lineError = firstTag(response, 'LINEERROR') || null;

    if (errors > 0 || (created === 0 && altered === 0)) {
      const errorMsg =
        lineError || 'Tally did not accept the credit note voucher. Check company and ledger configuration.';
      await prisma.credit_notes.update({
        where: { id: creditNoteId },
        data: { tallyLastError: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    // Success - update credit note
    await prisma.credit_notes.update({
      where: { id: creditNoteId },
      data: {
        tallyPushedAt: new Date(),
        tallyVoucherNumber: creditNote.creditNoteNumber,
        tallyLastError: null,
      },
    });

    return {
      success: true,
      voucherNumber: creditNote.creditNoteNumber,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error pushing credit note to Tally';
    logError('Failed to push credit note to Tally', err);

    await prisma.credit_notes.update({
      where: { id: creditNoteId },
      data: { tallyLastError: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Get credit notes with their Tally push status.
 */
export async function getCreditNotesWithTallyStatus(params: {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}): Promise<{
  data: Array<{
    id: string;
    creditNoteNumber: string;
    creditNoteDate: Date;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    reason: string;
    tallyPushedAt: Date | null;
    tallyVoucherNumber: string | null;
    tallyLastError: string | null;
    customerLinked: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  // Search filter
  if (params.search) {
    where.OR = [
      { creditNoteNumber: { contains: params.search, mode: 'insensitive' } },
      { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      { invoice: { invoiceNumber: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  // Push status filter
  if (params.pushStatus === 'pushed') {
    where.tallyPushedAt = { not: null };
  } else if (params.pushStatus === 'not_pushed') {
    where.tallyPushedAt = null;
    where.tallyLastError = null;
  } else if (params.pushStatus === 'error') {
    where.tallyLastError = { not: null };
  }

  const [creditNotes, total] = await Promise.all([
    prisma.credit_notes.findMany({
      where,
      include: {
        invoice: {
          select: { invoiceNumber: true },
        },
        customer: {
          select: {
            name: true,
            tallyLedgerName: true,
          },
        },
      },
      orderBy: { creditNoteDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.credit_notes.count({ where }),
  ]);

  return {
    data: creditNotes.map((cn) => ({
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      creditNoteDate: cn.creditNoteDate,
      invoiceNumber: cn.invoice.invoiceNumber,
      customerName: cn.customer.name,
      totalAmount: Number(cn.totalAmount),
      reason: cn.reason,
      tallyPushedAt: cn.tallyPushedAt,
      tallyVoucherNumber: cn.tallyVoucherNumber,
      tallyLastError: cn.tallyLastError,
      customerLinked: !!cn.customer.tallyLedgerName,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Outstanding / Receivables Sync
// ═══════════════════════════════════════════════════════════════════════════

export interface OutstandingEntry {
  // Tally data
  tallyLedgerName: string;
  tallyParent: string;
  tallyGstin: string;
  tallyBalance: number; // Amount owed to us (positive = owes, negative = advance)
  tallyCreditDays: number | null;
  // ERP customer match (if linked)
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  erpBalance: number | null; // Outstanding from ERP invoices
  // Reconciliation
  difference: number | null; // tallyBalance - erpBalance
  matched: boolean;
}

export interface OutstandingResult {
  data: OutstandingEntry[];
  summary: {
    totalTallyBalance: number;
    totalErpBalance: number;
    totalDifference: number;
    matchedCount: number;
    unmatchedCount: number;
  };
  fetchedAt: Date;
}

/**
 * Fetch outstanding balances from Tally and match with ERP customers.
 */
export async function getOutstandingBalances(): Promise<OutstandingResult> {
  const settings = await tallySettingsService.get();

  if (!settings.tallyEnabled) {
    throw new Error('Tally integration is disabled');
  }

  // Fetch balances from Tally
  const tallyBalances = await fetchLedgerBalances(settings);

  // Filter to party group ledgers (Sundry Debtors) with non-zero balance
  const partyGroup = settings.tallyPartyGroup || 'Sundry Debtors';
  const partyBalances = tallyBalances.filter(
    (b) => normalize(b.parent) === normalize(partyGroup) && Math.abs(b.closingBalance) >= 0.01
  );

  // Get all ERP customers with their Tally ledger links and outstanding
  const customers = await prisma.customers.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      tallyLedgerName: true,
      invoices: {
        where: { status: { not: 'PAID' } },
        select: { balanceAmount: true },
      },
    },
  });

  // Build a map of tallyLedgerName -> customer
  const customerByLedger = new Map<string, (typeof customers)[0]>();
  for (const c of customers) {
    if (c.tallyLedgerName) {
      customerByLedger.set(normalize(c.tallyLedgerName), c);
    }
  }

  // Build outstanding entries
  const data: OutstandingEntry[] = [];
  let totalTallyBalance = 0;
  let totalErpBalance = 0;
  let matchedCount = 0;

  for (const tb of partyBalances) {
    const customer = customerByLedger.get(normalize(tb.name));
    const erpBalance = customer ? customer.invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0) : null;

    totalTallyBalance += tb.closingBalance;
    if (erpBalance !== null) {
      totalErpBalance += erpBalance;
      matchedCount++;
    }

    data.push({
      tallyLedgerName: tb.name,
      tallyParent: tb.parent,
      tallyGstin: tb.gstin,
      tallyBalance: tb.closingBalance,
      tallyCreditDays: tb.creditPeriodDays,
      customerId: customer?.id || null,
      customerCode: customer?.code || null,
      customerName: customer?.name || null,
      erpBalance,
      difference: erpBalance !== null ? round2(tb.closingBalance - erpBalance) : null,
      matched: !!customer,
    });
  }

  // Sort by balance descending
  data.sort((a, b) => b.tallyBalance - a.tallyBalance);

  return {
    data,
    summary: {
      totalTallyBalance: round2(totalTallyBalance),
      totalErpBalance: round2(totalErpBalance),
      totalDifference: round2(totalTallyBalance - totalErpBalance),
      matchedCount,
      unmatchedCount: data.length - matchedCount,
    },
    fetchedAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Supplier-Ledger Matching (for Debit Notes / Purchase-side)
// ═══════════════════════════════════════════════════════════════════════════

export interface SupplierTallyMatch {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tallyLedgerName: string | null;
  tallyMatched: boolean;
  suggestion?: string;
}

export async function getSuppliersWithTallyStatus(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    matchStatus?: 'all' | 'matched' | 'unmatched';
  },
  includeSuggestions = false
): Promise<{
  data: SupplierTallyMatch[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { total: number; matched: number; unmatched: number };
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = { isActive: true };

  if (params.search) {
    where.OR = [
      { code: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
      { tallyLedgerName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.matchStatus === 'matched') {
    where.tallyLedgerName = { not: null };
  } else if (params.matchStatus === 'unmatched') {
    where.tallyLedgerName = null;
  }

  const [suppliers, total, matchedCount] = await Promise.all([
    prisma.suppliers.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        tallyLedgerName: true,
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.suppliers.count({ where }),
    prisma.suppliers.count({ where: { isActive: true, tallyLedgerName: { not: null } } }),
  ]);

  let ledgerMap: Map<string, string> | null = null;
  if (includeSuggestions) {
    try {
      const settings = await tallySettingsService.get();
      if (settings.tallyEnabled) {
        const ledgers = await fetchLedgers(settings);
        const creditorLedgers = ledgers.filter(
          (l) => l.parent.toLowerCase().includes('creditor') || l.parent.toLowerCase().includes('payable')
        );
        ledgerMap = new Map(creditorLedgers.map((l) => [normalize(l.name), l.name]));
      }
    } catch {
      // Ignore - suggestions are optional
    }
  }

  const data: SupplierTallyMatch[] = suppliers.map((s) => {
    let suggestion: string | undefined;
    if (ledgerMap && !s.tallyLedgerName) {
      const normalizedName = normalize(s.name);
      if (ledgerMap.has(normalizedName)) {
        suggestion = ledgerMap.get(normalizedName);
      }
    }

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      phone: s.phone,
      tallyLedgerName: s.tallyLedgerName,
      tallyMatched: !!s.tallyLedgerName,
      suggestion,
    };
  });

  const totalSuppliers = await prisma.suppliers.count({ where: { isActive: true } });

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats: {
      total: totalSuppliers,
      matched: matchedCount,
      unmatched: totalSuppliers - matchedCount,
    },
  };
}

export async function linkSupplierToTallyLedger(supplierId: string, tallyLedgerName: string): Promise<void> {
  await prisma.suppliers.update({
    where: { id: supplierId },
    data: { tallyLedgerName },
  });
}

export async function unlinkSupplierFromTallyLedger(supplierId: string): Promise<void> {
  await prisma.suppliers.update({
    where: { id: supplierId },
    data: { tallyLedgerName: null },
  });
}

export async function autoMatchSuppliers(): Promise<{ matched: number; total: number }> {
  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    throw new Error('Tally integration is disabled');
  }

  const ledgers = await fetchLedgers(settings);
  const creditorLedgers = ledgers.filter(
    (l) => l.parent.toLowerCase().includes('creditor') || l.parent.toLowerCase().includes('payable')
  );
  const ledgerMap = new Map(creditorLedgers.map((l) => [normalize(l.name), l.name]));

  const unmatchedSuppliers = await prisma.suppliers.findMany({
    where: { isActive: true, tallyLedgerName: null },
    select: { id: true, name: true },
  });

  let matched = 0;
  for (const s of unmatchedSuppliers) {
    const normalizedName = normalize(s.name);
    if (ledgerMap.has(normalizedName)) {
      const ledgerName = ledgerMap.get(normalizedName)!;
      await prisma.suppliers.update({
        where: { id: s.id },
        data: { tallyLedgerName: ledgerName },
      });
      matched++;
    }
  }

  return { matched, total: unmatchedSuppliers.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// Supplier Detail Sync from Tally
// ═══════════════════════════════════════════════════════════════════════════

export interface TallyLedgerExtended {
  name: string;
  parent: string;
  gstin: string;
  regType: string;
  address: string;
  pincode: string;
  state: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  creditDays: number | null;
}

/**
 * Build XML to fetch extended ledger details including bank info, address, phone.
 */
export function buildExtendedLedgersXml(settings: TallySettings): string {
  const company = settings.tallyCompanyName;
  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>KF Extended Ledgers</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}
</STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="KF Extended Ledgers" ISMODIFY="No">
<TYPE>Ledger</TYPE>
<NATIVEMETHOD>Name</NATIVEMETHOD>
<NATIVEMETHOD>Parent</NATIVEMETHOD>
<NATIVEMETHOD>PartyGSTIN</NATIVEMETHOD>
<NATIVEMETHOD>GSTRegistrationType</NATIVEMETHOD>
<NATIVEMETHOD>Address</NATIVEMETHOD>
<NATIVEMETHOD>LedgerPhone</NATIVEMETHOD>
<NATIVEMETHOD>LedgerFax</NATIVEMETHOD>
<NATIVEMETHOD>Email</NATIVEMETHOD>
<NATIVEMETHOD>LedStateName</NATIVEMETHOD>
<NATIVEMETHOD>PinCode</NATIVEMETHOD>
<NATIVEMETHOD>BillCreditPeriod</NATIVEMETHOD>
<NATIVEMETHOD>BankDetails</NATIVEMETHOD>
<NATIVEMETHOD>BankName</NATIVEMETHOD>
<NATIVEMETHOD>AccountNumber</NATIVEMETHOD>
<NATIVEMETHOD>IFSCode</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
}

/**
 * Parse extended ledger data from Tally XML response.
 */
export function parseExtendedLedgers(xml: string): TallyLedgerExtended[] {
  const out: TallyLedgerExtended[] = [];
  const opens = [...xml.matchAll(/<LEDGER\b([^>]*)>/gi)];

  for (let i = 0; i < opens.length; i++) {
    const attrs = opens[i][1];
    const start = (opens[i].index ?? 0) + opens[i][0].length;
    const end = i + 1 < opens.length ? (opens[i + 1].index ?? xml.length) : xml.length;
    let body = xml.slice(start, end);
    const close = body.indexOf('</LEDGER>');
    if (close >= 0) body = body.slice(0, close);

    const nameAttr = /\bNAME\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
    const name = xmlUnescape((nameAttr ?? firstTag(body, 'NAME') ?? '').trim());
    if (!name) continue;

    const parent = firstTag(body, 'PARENT') ?? '';
    const { gstin, regType } = parseLedgerGst(body);

    // Address: Tally stores as ADDRESS.LIST with multiple ADDRESS lines
    const addressLines: string[] = [];
    const addressMatch = body.match(/<ADDRESS\.LIST[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i);
    if (addressMatch) {
      const addrRe = /<ADDRESS>([^<]*)<\/ADDRESS>/gi;
      let am;
      while ((am = addrRe.exec(addressMatch[1]))) {
        const line = xmlUnescape(am[1].trim());
        if (line) addressLines.push(line);
      }
    }
    const address = addressLines.join(', ');

    const pincode = (firstTag(body, 'PINCODE') ?? '').trim();
    const state = (firstTag(body, 'LEDSTATENAME') ?? '').trim();
    const phone = (firstTag(body, 'LEDGERPHONE') ?? '').trim();
    const email = (firstTag(body, 'EMAIL') ?? '').trim();

    // Bank details: Tally may have BANKDETAILS.LIST or flat fields
    let bankName = '';
    let bankAccountNumber = '';
    let ifscCode = '';

    const bankMatch = body.match(/<BANKDETAILS\.LIST[^>]*>([\s\S]*?)<\/BANKDETAILS\.LIST>/i);
    if (bankMatch) {
      bankName = (firstTag(bankMatch[1], 'BANKNAME') ?? '').trim();
      bankAccountNumber = (firstTag(bankMatch[1], 'ACCOUNTNUMBER') ?? '').trim();
      ifscCode = (firstTag(bankMatch[1], 'IFSCODE') ?? '').trim();
    }
    // Fallback to flat fields if not in BANKDETAILS.LIST
    if (!bankName) bankName = (firstTag(body, 'BANKNAME') ?? '').trim();
    if (!bankAccountNumber) bankAccountNumber = (firstTag(body, 'ACCOUNTNUMBER') ?? '').trim();
    if (!ifscCode) ifscCode = (firstTag(body, 'IFSCODE') ?? '').trim();

    // Credit period
    const creditPeriodRaw = firstTag(body, 'BILLCREDITPERIOD') ?? '';
    const creditMatch = creditPeriodRaw.match(/\d+/);
    const creditDays = creditMatch ? parseInt(creditMatch[0], 10) : null;

    out.push({
      name,
      parent,
      gstin,
      regType,
      address,
      pincode,
      state,
      phone,
      email,
      bankName,
      bankAccountNumber,
      ifscCode,
      creditDays,
    });
  }

  return out;
}

export async function fetchExtendedLedgers(settings: TallySettings): Promise<TallyLedgerExtended[]> {
  const xml = await post(settings, buildExtendedLedgersXml(settings), SLOW_READ_TIMEOUT_MS);
  return parseExtendedLedgers(xml);
}

export interface SupplierSyncPreviewItem {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  tallyLedgerName: string;
  changes: Array<{
    field: string;
    label: string;
    currentValue: string | null;
    tallyValue: string | null;
    willUpdate: boolean;
  }>;
}

export interface SupplierSyncPreviewResult {
  suppliers: SupplierSyncPreviewItem[];
  stats: {
    totalLinked: number;
    foundInTally: number;
    withChanges: number;
  };
}

/**
 * Preview what supplier details would be updated from Tally.
 * Only shows linked suppliers (those with tallyLedgerName set).
 */
export async function previewSupplierSyncFromTally(onlyBlanks: boolean = true): Promise<SupplierSyncPreviewResult> {
  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    throw new Error('Tally integration is disabled');
  }

  // Get all linked suppliers
  const linkedSuppliers = await prisma.suppliers.findMany({
    where: {
      isActive: true,
      tallyLedgerName: { not: null },
    },
    select: {
      id: true,
      code: true,
      name: true,
      tallyLedgerName: true,
      phone: true,
      address: true,
      billingPincode: true,
      bankName: true,
      bankAccountNumber: true,
      ifscCode: true,
      creditDays: true,
      gst_numbers: {
        where: { isPrimary: true },
        select: { gstNumber: true },
        take: 1,
      },
    },
  });

  if (linkedSuppliers.length === 0) {
    return {
      suppliers: [],
      stats: { totalLinked: 0, foundInTally: 0, withChanges: 0 },
    };
  }

  // Fetch extended ledgers from Tally
  const tallyLedgers = await fetchExtendedLedgers(settings);
  const ledgerMap = new Map<string, TallyLedgerExtended>();
  for (const l of tallyLedgers) {
    ledgerMap.set(normalize(l.name), l);
  }

  const results: SupplierSyncPreviewItem[] = [];
  let foundInTally = 0;
  let withChanges = 0;

  for (const supplier of linkedSuppliers) {
    const tallyLedger = ledgerMap.get(normalize(supplier.tallyLedgerName!));
    if (!tallyLedger) continue;
    foundInTally++;

    const currentGst = supplier.gst_numbers[0]?.gstNumber ?? null;

    const fields: SupplierSyncPreviewItem['changes'] = [];

    const addField = (
      field: string,
      label: string,
      current: string | number | null | undefined,
      tally: string | number | null | undefined
    ) => {
      const currentStr = current?.toString() || null;
      const tallyStr = tally?.toString() || null;
      const hasValue = !!tallyStr;
      const isDifferent = currentStr !== tallyStr;
      const willUpdate = hasValue && isDifferent && (!onlyBlanks || !currentStr);

      if (hasValue) {
        fields.push({
          field,
          label,
          currentValue: currentStr,
          tallyValue: tallyStr,
          willUpdate,
        });
      }
    };

    addField('gstin', 'GSTIN', currentGst, tallyLedger.gstin);
    addField('phone', 'Phone', supplier.phone, tallyLedger.phone);
    addField('address', 'Address', supplier.address, tallyLedger.address);
    addField('billingPincode', 'Pincode', supplier.billingPincode, tallyLedger.pincode);
    addField('bankName', 'Bank Name', supplier.bankName, tallyLedger.bankName);
    addField('bankAccountNumber', 'Account No.', supplier.bankAccountNumber, tallyLedger.bankAccountNumber);
    addField('ifscCode', 'IFSC Code', supplier.ifscCode, tallyLedger.ifscCode);
    addField('creditDays', 'Credit Days', supplier.creditDays, tallyLedger.creditDays);

    const hasUpdates = fields.some((f) => f.willUpdate);
    if (hasUpdates) withChanges++;

    // Only include suppliers with some Tally data available
    if (fields.length > 0) {
      results.push({
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplierName: supplier.name,
        tallyLedgerName: supplier.tallyLedgerName!,
        changes: fields,
      });
    }
  }

  return {
    suppliers: results,
    stats: {
      totalLinked: linkedSuppliers.length,
      foundInTally,
      withChanges,
    },
  };
}

export interface SupplierSyncResult {
  updated: number;
  skipped: number;
  details: Array<{
    supplierId: string;
    supplierName: string;
    fieldsUpdated: string[];
  }>;
}

/**
 * Apply supplier detail updates from Tally.
 * @param onlyBlanks If true, only fill in blank fields. If false, overwrite existing values.
 * @param supplierIds Optional list of supplier IDs to sync. If empty, syncs all linked suppliers.
 */
export async function syncSupplierDetailsFromTally(
  onlyBlanks: boolean = true,
  supplierIds?: string[]
): Promise<SupplierSyncResult> {
  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    throw new Error('Tally integration is disabled');
  }

  // Get linked suppliers
  const where: any = {
    isActive: true,
    tallyLedgerName: { not: null },
  };
  if (supplierIds && supplierIds.length > 0) {
    where.id = { in: supplierIds };
  }

  const linkedSuppliers = await prisma.suppliers.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      tallyLedgerName: true,
      phone: true,
      address: true,
      billingPincode: true,
      bankName: true,
      bankAccountNumber: true,
      ifscCode: true,
      creditDays: true,
      gst_numbers: {
        where: { isPrimary: true },
        select: { id: true, gstNumber: true },
        take: 1,
      },
    },
  });

  if (linkedSuppliers.length === 0) {
    return { updated: 0, skipped: 0, details: [] };
  }

  // Fetch extended ledgers from Tally
  const tallyLedgers = await fetchExtendedLedgers(settings);
  const ledgerMap = new Map<string, TallyLedgerExtended>();
  for (const l of tallyLedgers) {
    ledgerMap.set(normalize(l.name), l);
  }

  const result: SupplierSyncResult = { updated: 0, skipped: 0, details: [] };

  for (const supplier of linkedSuppliers) {
    const tallyLedger = ledgerMap.get(normalize(supplier.tallyLedgerName!));
    if (!tallyLedger) {
      result.skipped++;
      continue;
    }

    const updates: Record<string, any> = {};
    const fieldsUpdated: string[] = [];

    const maybeUpdate = (field: string, current: any, tallyValue: any) => {
      if (!tallyValue) return;
      const shouldUpdate = onlyBlanks ? !current : current !== tallyValue;
      if (shouldUpdate) {
        updates[field] = tallyValue;
        fieldsUpdated.push(field);
      }
    };

    maybeUpdate('phone', supplier.phone, tallyLedger.phone);
    maybeUpdate('address', supplier.address, tallyLedger.address);
    maybeUpdate('billingPincode', supplier.billingPincode, tallyLedger.pincode);
    maybeUpdate('bankName', supplier.bankName, tallyLedger.bankName);
    maybeUpdate('bankAccountNumber', supplier.bankAccountNumber, tallyLedger.bankAccountNumber);
    maybeUpdate('ifscCode', supplier.ifscCode, tallyLedger.ifscCode);
    maybeUpdate('creditDays', supplier.creditDays, tallyLedger.creditDays);

    if (Object.keys(updates).length > 0) {
      await prisma.suppliers.update({
        where: { id: supplier.id },
        data: updates,
      });
      result.updated++;
      result.details.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        fieldsUpdated,
      });
    } else {
      result.skipped++;
    }

    // Handle GST number - add to gst_numbers if not exists
    if (tallyLedger.gstin) {
      const currentGst = supplier.gst_numbers[0]?.gstNumber;
      if (!currentGst || (!onlyBlanks && currentGst !== tallyLedger.gstin)) {
        // Extract state code from GSTIN (first 2 digits)
        const stateCode = tallyLedger.gstin.substring(0, 2);
        const state = await prisma.indian_states.findFirst({
          where: { stateCode },
          select: { id: true, stateName: true, stateCode: true },
        });

        if (state) {
          // Upsert GST number
          await prisma.supplier_gst_numbers.upsert({
            where: {
              supplierId_gstNumber: {
                supplierId: supplier.id,
                gstNumber: tallyLedger.gstin,
              },
            },
            create: {
              supplierId: supplier.id,
              gstNumber: tallyLedger.gstin,
              stateId: state.id,
              stateName: state.stateName,
              stateCode: state.stateCode,
              isPrimary: true,
              billingAddress: tallyLedger.address || null,
              billingPincode: tallyLedger.pincode || null,
            },
            update: {
              billingAddress: tallyLedger.address || undefined,
              billingPincode: tallyLedger.pincode || undefined,
            },
          });

          // Mark other GST numbers as non-primary if this one is primary
          await prisma.supplier_gst_numbers.updateMany({
            where: {
              supplierId: supplier.id,
              gstNumber: { not: tallyLedger.gstin },
            },
            data: { isPrimary: false },
          });
        }
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Debit Note Push to Tally
// ═══════════════════════════════════════════════════════════════════════════

export interface DebitNoteForTally {
  id: string;
  debitNoteNumber: string;
  debitNoteDate: Date;
  poId: string | null;
  supplierId: string;
  isInterstate: boolean;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  reason: string;
  purchaseOrder: { poNumber: string } | null;
  jobWorkOrder: { jobWorkNumber: string } | null; // Phase 4a: JWO reference when no PO
  supplier: {
    name: string;
    tallyLedgerName: string | null;
    billingStateId: string | null;
    billingState?: { stateName: string; stateCode: string } | null;
  };
  items: Array<{
    description: string;
    hsnCode: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    gstRate: number | null;
  }>;
}

export interface PushDebitNoteResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

/**
 * Build the Tally Debit Note Voucher XML.
 * Debit note debits the supplier (reduces payable), returns goods.
 */
export function buildDebitNoteVoucherXml(
  debitNote: DebitNoteForTally,
  settings: TallySettings,
  action: 'Create' | 'Alter' = 'Create'
): string {
  const partyLedgerName = debitNote.supplier.tallyLedgerName;
  if (!partyLedgerName) {
    throw new Error('Supplier does not have a linked Tally ledger. Link it first.');
  }

  const dnNo = debitNote.debitNoteNumber;
  const date = fmtDate(debitNote.debitNoteDate);
  const company = settings.tallyCompanyName;
  const godown = settings.tallyGodownName || 'Main Location';
  const unit = settings.tallyStockUnit || 'Pcs';
  const voucherType = 'Debit Note';
  const remoteId = `KF-DN-${debitNote.id}`;

  const isIntraState = !debitNote.isInterstate;

  // For debit note (purchase return), we use purchase ledgers
  // Assuming they have a purchase ledger configured (could add to settings later)
  const purchaseLedger = isIntraState
    ? settings.tallySalesLedgerIntra.replace(/Sales/gi, 'Purchase') || 'Purchase Account'
    : settings.tallySalesLedgerInter.replace(/Sales/gi, 'Purchase') || 'Purchase Account';

  const is18 = (rate: number | null) => (rate ?? 0) >= GST_RATE_HIGH / 2;

  // Build inventory entries (RETURN: goods going back to supplier)
  const inventoryLines = debitNote.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => {
      const amount = Number(item.totalPrice);
      const qtyStr = `${item.quantity} ${unit}`;
      const rateStr = `${Number(item.unitPrice).toFixed(2)}/${unit}`;
      const stockName = item.description;

      return (
        `<ALLINVENTORYENTRIES.LIST>` +
        `<STOCKITEMNAME>${xe(stockName)}</STOCKITEMNAME>` +
        `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>` +
        `<RATE>${xe(rateStr)}</RATE>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `<BATCHALLOCATIONS.LIST>` +
        `<GODOWNNAME>${xe(godown)}</GODOWNNAME><BATCHNAME>Primary Batch</BATCHNAME>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `<ACTUALQTY>${xe(qtyStr)}</ACTUALQTY><BILLEDQTY>${xe(qtyStr)}</BILLEDQTY>` +
        `</BATCHALLOCATIONS.LIST>` +
        `<ACCOUNTINGALLOCATIONS.LIST>` +
        `<LEDGERNAME>${xe(purchaseLedger)}</LEDGERNAME>` +
        `<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>` +
        `<AMOUNT>${amt(amount)}</AMOUNT>` +
        `</ACCOUNTINGALLOCATIONS.LIST>` +
        `</ALLINVENTORYENTRIES.LIST>`
      );
    })
    .join('');

  // Aggregate GST by rate
  const gstBuckets = new Map<string, { cgst: number; sgst: number; igst: number }>();
  for (const item of debitNote.items) {
    const rateKey = is18(item.gstRate) ? '18' : '5';
    const bucket = gstBuckets.get(rateKey) || { cgst: 0, sgst: 0, igst: 0 };
    const gstAmt = Number(item.totalPrice) * (Number(item.gstRate || 0) / 100);
    if (isIntraState) {
      bucket.cgst += gstAmt / 2;
      bucket.sgst += gstAmt / 2;
    } else {
      bucket.igst += gstAmt;
    }
    gstBuckets.set(rateKey, bucket);
  }

  // GST ledger entries (INPUT GST for purchase-side)
  let gstLines = '';
  for (const [rateKey, bucket] of gstBuckets) {
    const isHighRate = rateKey === '18';
    if (isIntraState) {
      if (bucket.cgst > 0) {
        const cgstLedger = (isHighRate ? settings.tallyCgstLedger18 : settings.tallyCgstLedger).replace(
          /Output/gi,
          'Input'
        );
        gstLines += ledgerEntry(cgstLedger || 'Input CGST', round2(bucket.cgst), false);
      }
      if (bucket.sgst > 0) {
        const sgstLedger = (isHighRate ? settings.tallySgstLedger18 : settings.tallySgstLedger).replace(
          /Output/gi,
          'Input'
        );
        gstLines += ledgerEntry(sgstLedger || 'Input SGST', round2(bucket.sgst), false);
      }
    } else {
      if (bucket.igst > 0) {
        const igstLedger = (isHighRate ? settings.tallyIgstLedger18 : settings.tallyIgstLedger).replace(
          /Output/gi,
          'Input'
        );
        gstLines += ledgerEntry(igstLedger || 'Input IGST', round2(bucket.igst), false);
      }
    }
  }

  // Party ledger entry (DEBIT the supplier - reduces our payable)
  const actualTotal = Number(debitNote.totalAmount);
  const partyLine = ledgerEntry(
    partyLedgerName,
    actualTotal,
    true,
    debitNote.purchaseOrder?.poNumber || debitNote.jobWorkOrder?.jobWorkNumber || dnNo
  );

  const supplierName = debitNote.supplier.name;
  const supplierState = debitNote.supplier.billingState?.stateName || '';

  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC><STATICVARIABLES>${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES></DESC>
<DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER REMOTEID="${xe(remoteId)}" VCHTYPE="${xe(voucherType)}" ACTION="${action}">
<DATE>${date}</DATE>
<VOUCHERTYPENAME>${xe(voucherType)}</VOUCHERTYPENAME>
<VOUCHERNUMBER>${xe(dnNo)}</VOUCHERNUMBER>
<PARTYLEDGERNAME>${xe(partyLedgerName)}</PARTYLEDGERNAME>
<BASICBUYERNAME>${xe(supplierName)}</BASICBUYERNAME>
<ISINVOICE>Yes</ISINVOICE>
<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
${debitNote.purchaseOrder ? `<REFERENCE>${xe(debitNote.purchaseOrder.poNumber)}</REFERENCE>` : debitNote.jobWorkOrder ? `<REFERENCE>${xe(debitNote.jobWorkOrder.jobWorkNumber)}</REFERENCE>` : ''}
<NARRATION>Reason: ${xe(debitNote.reason)}</NARRATION>
${supplierState ? `<STATENAME>${xe(supplierState)}</STATENAME>` : ''}
<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
${inventoryLines}
${partyLine}
${gstLines}
</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

export async function pushDebitNoteToTally(debitNoteId: string): Promise<PushDebitNoteResult> {
  const debitNote = await prisma.debit_notes.findUnique({
    where: { id: debitNoteId },
    include: {
      purchaseOrder: { select: { poNumber: true } },
      jobWorkOrder: { select: { jobWorkNumber: true } },
      supplier: {
        include: { billing_state: true },
      },
      items: true,
    },
  });

  if (!debitNote) {
    return { success: false, error: 'Debit note not found' };
  }

  if (!debitNote.supplier.tallyLedgerName) {
    return {
      success: false,
      error: `Supplier "${debitNote.supplier.name}" is not linked to a Tally ledger. Link it first.`,
    };
  }

  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    return { success: false, error: 'Tally integration is disabled.' };
  }

  if (!settings.tallyCompanyName) {
    return { success: false, error: 'Tally company name is not configured.' };
  }

  const dnData: DebitNoteForTally = {
    id: debitNote.id,
    debitNoteNumber: debitNote.debitNoteNumber,
    debitNoteDate: debitNote.debitNoteDate,
    poId: debitNote.poId,
    supplierId: debitNote.supplierId,
    isInterstate: debitNote.isInterstate,
    subtotal: Number(debitNote.subtotal),
    cgstAmount: Number(debitNote.cgstAmount),
    sgstAmount: Number(debitNote.sgstAmount),
    igstAmount: Number(debitNote.igstAmount),
    totalAmount: Number(debitNote.totalAmount),
    reason: debitNote.reason,
    purchaseOrder: debitNote.purchaseOrder,
    jobWorkOrder: debitNote.jobWorkOrder,
    supplier: {
      name: debitNote.supplier.name,
      tallyLedgerName: debitNote.supplier.tallyLedgerName,
      billingStateId: debitNote.supplier.billingStateId,
      billingState: debitNote.supplier.billing_state
        ? {
            stateName: debitNote.supplier.billing_state.stateName,
            stateCode: debitNote.supplier.billing_state.stateCode,
          }
        : null,
    },
    items: debitNote.items.map((item) => ({
      description: item.description,
      hsnCode: item.hsnCode,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      gstRate: item.gstRate ? Number(item.gstRate) : null,
    })),
  };

  const action = debitNote.tallyPushedAt ? 'Alter' : 'Create';

  try {
    const xml = buildDebitNoteVoucherXml(dnData, settings, action);
    const response = await post(settings, xml);

    const created = Number(firstTag(response, 'CREATED') ?? 0) || 0;
    const altered = Number(firstTag(response, 'ALTERED') ?? 0) || 0;
    const errors =
      (Number(firstTag(response, 'ERRORS') ?? 0) || 0) + (Number(firstTag(response, 'EXCEPTIONS') ?? 0) || 0);
    const lineError = firstTag(response, 'LINEERROR') || null;

    if (errors > 0 || (created === 0 && altered === 0)) {
      const errorMsg = lineError || 'Tally did not accept the debit note voucher.';
      await prisma.debit_notes.update({
        where: { id: debitNoteId },
        data: { tallyLastError: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    await prisma.debit_notes.update({
      where: { id: debitNoteId },
      data: {
        tallyPushedAt: new Date(),
        tallyVoucherNumber: debitNote.debitNoteNumber,
        tallyLastError: null,
      },
    });

    return { success: true, voucherNumber: debitNote.debitNoteNumber };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error pushing debit note to Tally';
    logError('Failed to push debit note to Tally', err);

    await prisma.debit_notes.update({
      where: { id: debitNoteId },
      data: { tallyLastError: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}

export async function getDebitNotesWithTallyStatus(params: {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}): Promise<{
  data: Array<{
    id: string;
    debitNoteNumber: string;
    debitNoteDate: Date;
    poNumber: string | null;
    supplierName: string;
    totalAmount: number;
    reason: string;
    tallyPushedAt: Date | null;
    tallyVoucherNumber: string | null;
    tallyLastError: string | null;
    supplierLinked: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.search) {
    where.OR = [
      { debitNoteNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
      { purchaseOrder: { poNumber: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  if (params.pushStatus === 'pushed') {
    where.tallyPushedAt = { not: null };
  } else if (params.pushStatus === 'not_pushed') {
    where.tallyPushedAt = null;
    where.tallyLastError = null;
  } else if (params.pushStatus === 'error') {
    where.tallyLastError = { not: null };
  }

  const [debitNotes, total] = await Promise.all([
    prisma.debit_notes.findMany({
      where,
      include: {
        purchaseOrder: { select: { poNumber: true } },
        jobWorkOrder: { select: { jobWorkNumber: true } },
        supplier: { select: { name: true, tallyLedgerName: true } },
      },
      orderBy: { debitNoteDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.debit_notes.count({ where }),
  ]);

  return {
    data: debitNotes.map((dn) => ({
      id: dn.id,
      debitNoteNumber: dn.debitNoteNumber,
      debitNoteDate: dn.debitNoteDate,
      poNumber: dn.purchaseOrder?.poNumber || null,
      supplierName: dn.supplier.name,
      totalAmount: Number(dn.totalAmount),
      reason: dn.reason,
      tallyPushedAt: dn.tallyPushedAt,
      tallyVoucherNumber: dn.tallyVoucherNumber,
      tallyLastError: dn.tallyLastError,
      supplierLinked: !!dn.supplier.tallyLedgerName,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Payment (Receipt Voucher) Push to Tally
// ═══════════════════════════════════════════════════════════════════════════

export interface PaymentForTally {
  id: string;
  invoiceId: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  remarks: string | null;
  invoice: {
    invoiceNumber: string;
    customerId: string;
    customer: {
      name: string;
      tallyLedgerName: string | null;
    };
  };
}

export interface PushPaymentResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

/**
 * Build the Tally Receipt Voucher XML.
 * Receipt = money received from customer (credits their account).
 */
export function buildReceiptVoucherXml(
  payment: PaymentForTally,
  settings: TallySettings,
  action: 'Create' | 'Alter' = 'Create'
): string {
  const partyLedgerName = payment.invoice.customer.tallyLedgerName;
  if (!partyLedgerName) {
    throw new Error('Customer does not have a linked Tally ledger. Link it first.');
  }

  const date = fmtDate(payment.paymentDate);
  const company = settings.tallyCompanyName;
  const voucherType = 'Receipt';
  const remoteId = `KF-RCV-${payment.id}`;

  // Determine bank/cash ledger based on payment method
  let bankLedger: string;
  switch (payment.paymentMethod) {
    case 'CASH':
      bankLedger = 'Cash';
      break;
    case 'BANK_TRANSFER':
    case 'NEFT':
    case 'RTGS':
    case 'IMPS':
      bankLedger = 'Bank Account'; // User should configure specific bank
      break;
    case 'CHEQUE':
      bankLedger = 'Bank Account';
      break;
    case 'UPI':
      bankLedger = 'Bank Account';
      break;
    default:
      bankLedger = 'Bank Account';
  }

  const amount = Number(payment.amount);
  const narration = [
    `Against Invoice: ${payment.invoice.invoiceNumber}`,
    payment.referenceNumber ? `Ref: ${payment.referenceNumber}` : '',
    payment.remarks || '',
  ]
    .filter(Boolean)
    .join('. ');

  // Receipt voucher: Bank/Cash is DEBITED, Customer is CREDITED
  const bankLine = ledgerEntry(bankLedger, amount, true); // Debit bank
  const partyLine = ledgerEntry(partyLedgerName, amount, false, payment.invoice.invoiceNumber); // Credit customer

  return `<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
<BODY><DESC><STATICVARIABLES>${company ? `<SVCURRENTCOMPANY>${xe(company)}</SVCURRENTCOMPANY>` : ''}</STATICVARIABLES></DESC>
<DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER REMOTEID="${xe(remoteId)}" VCHTYPE="${xe(voucherType)}" ACTION="${action}">
<DATE>${date}</DATE>
<VOUCHERTYPENAME>${xe(voucherType)}</VOUCHERTYPENAME>
<PARTYLEDGERNAME>${xe(partyLedgerName)}</PARTYLEDGERNAME>
<NARRATION>${xe(narration)}</NARRATION>
${bankLine}
${partyLine}
</VOUCHER></TALLYMESSAGE></DATA></BODY></ENVELOPE>`;
}

export async function pushPaymentToTally(paymentId: string): Promise<PushPaymentResult> {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
    include: {
      invoices: {
        include: {
          customers: true,
        },
      },
    },
  });

  if (!payment) {
    return { success: false, error: 'Payment not found' };
  }

  if (!payment.invoices.customers.tallyLedgerName) {
    return {
      success: false,
      error: `Customer "${payment.invoices.customers.name}" is not linked to a Tally ledger. Link it first.`,
    };
  }

  const settings = await tallySettingsService.get();
  if (!settings.tallyEnabled) {
    return { success: false, error: 'Tally integration is disabled.' };
  }

  if (!settings.tallyCompanyName) {
    return { success: false, error: 'Tally company name is not configured.' };
  }

  const paymentData: PaymentForTally = {
    id: payment.id,
    invoiceId: payment.invoiceId,
    paymentDate: payment.paymentDate,
    amount: Number(payment.amount),
    paymentMethod: payment.paymentMethod,
    referenceNumber: payment.referenceNumber,
    remarks: payment.remarks,
    invoice: {
      invoiceNumber: payment.invoices.invoiceNumber,
      customerId: payment.invoices.customerId,
      customer: {
        name: payment.invoices.customers.name,
        tallyLedgerName: payment.invoices.customers.tallyLedgerName,
      },
    },
  };

  const action = payment.tallyPushedAt ? 'Alter' : 'Create';

  try {
    const xml = buildReceiptVoucherXml(paymentData, settings, action);
    const response = await post(settings, xml);

    const created = Number(firstTag(response, 'CREATED') ?? 0) || 0;
    const altered = Number(firstTag(response, 'ALTERED') ?? 0) || 0;
    const errors =
      (Number(firstTag(response, 'ERRORS') ?? 0) || 0) + (Number(firstTag(response, 'EXCEPTIONS') ?? 0) || 0);
    const lineError = firstTag(response, 'LINEERROR') || null;

    if (errors > 0 || (created === 0 && altered === 0)) {
      const errorMsg = lineError || 'Tally did not accept the receipt voucher.';
      await prisma.payments.update({
        where: { id: paymentId },
        data: { tallyLastError: errorMsg },
      });
      return { success: false, error: errorMsg };
    }

    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        tallyPushedAt: new Date(),
        tallyVoucherNumber: `RCV-${payment.id.slice(0, 8)}`,
        tallyLastError: null,
      },
    });

    return { success: true, voucherNumber: `RCV-${payment.id.slice(0, 8)}` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error pushing payment to Tally';
    logError('Failed to push payment to Tally', err);

    await prisma.payments.update({
      where: { id: paymentId },
      data: { tallyLastError: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}

export async function getPaymentsWithTallyStatus(params: {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}): Promise<{
  data: Array<{
    id: string;
    invoiceNumber: string;
    paymentDate: Date;
    customerName: string;
    amount: number;
    paymentMethod: string;
    referenceNumber: string | null;
    tallyPushedAt: Date | null;
    tallyVoucherNumber: string | null;
    tallyLastError: string | null;
    customerLinked: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.search) {
    where.OR = [
      { referenceNumber: { contains: params.search, mode: 'insensitive' } },
      { invoices: { invoiceNumber: { contains: params.search, mode: 'insensitive' } } },
      { invoices: { customers: { name: { contains: params.search, mode: 'insensitive' } } } },
    ];
  }

  if (params.pushStatus === 'pushed') {
    where.tallyPushedAt = { not: null };
  } else if (params.pushStatus === 'not_pushed') {
    where.tallyPushedAt = null;
    where.tallyLastError = null;
  } else if (params.pushStatus === 'error') {
    where.tallyLastError = { not: null };
  }

  const [payments, total] = await Promise.all([
    prisma.payments.findMany({
      where,
      include: {
        invoices: {
          include: {
            customers: { select: { name: true, tallyLedgerName: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payments.count({ where }),
  ]);

  return {
    data: payments.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoices.invoiceNumber,
      paymentDate: p.paymentDate,
      customerName: p.invoices.customers.name,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      tallyPushedAt: p.tallyPushedAt,
      tallyVoucherNumber: p.tallyVoucherNumber,
      tallyLastError: p.tallyLastError,
      customerLinked: !!p.invoices.customers.tallyLedgerName,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export const tallyService = {
  testConnection,
  fetchLedgers,
  fetchLedgerBalances,
  fetchVoucherTypes,
  fetchGroups,
  fetchUnits,
  createMissingLedgers,
  // Customer-ledger matching
  getCustomersWithTallyStatus,
  linkCustomerToTallyLedger,
  unlinkCustomerFromTallyLedger,
  autoMatchCustomers,
  // Supplier-ledger matching
  getSuppliersWithTallyStatus,
  linkSupplierToTallyLedger,
  unlinkSupplierFromTallyLedger,
  autoMatchSuppliers,
  // Supplier detail sync from Tally
  fetchExtendedLedgers,
  previewSupplierSyncFromTally,
  syncSupplierDetailsFromTally,
  // Invoice push
  pushInvoiceToTally,
  getInvoicesWithTallyStatus,
  // Credit Note push
  pushCreditNoteToTally,
  getCreditNotesWithTallyStatus,
  // Debit Note push
  pushDebitNoteToTally,
  getDebitNotesWithTallyStatus,
  // Payment (Receipt) push
  pushPaymentToTally,
  getPaymentsWithTallyStatus,
  // Outstanding/Receivables
  getOutstandingBalances,
};
