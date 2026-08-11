/**
 * Shared formatting for kf-document data adapters.
 * Money always flows through decimal.js helpers (utils/currency) — a real 0
 * formats as "0.00"; only null/undefined become the em-dash. Never use `||`
 * on money/quantity values.
 */
import { roundToCent } from '../../utils/currency';
import { amountToWords } from '../../config/company.config';

export const EM_DASH = '—';

export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return EM_DASH;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return EM_DASH;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return `${fmtDate(d)} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** en-IN 2dp, no currency symbol (templates carry ₹ in headers) */
export function fmtMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return roundToCent(n).toNumber().toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const INTEGER_UNITS = new Set(['PCS', 'PIECE', 'PIECES', 'CONE', 'CONES', 'NOS', 'SET', 'SETS', 'TRIP', 'DOZEN']);

export function fmtQty(value: number | string | null | undefined, uom?: string | null): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  const digits = uom && INTEGER_UNITS.has(uom.toUpperCase()) ? 0 : 2;
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** KPI shorthand for reports: 1843200 → "18.4L" */
export function lakhShort(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  if (Math.abs(n) >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Paise-safe amount in words (re-export of the invoice authority, BH-0070) */
export function inrWords(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return amountToWords(roundToCent(n).toNumber());
}

/** GSTIN → state code prefix */
export function gstinState(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}
