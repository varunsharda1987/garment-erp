/**
 * Date Utility — the project's ONLY date display format.
 *
 * Every user-visible date reads `19-Sep-2026`. With time: `19-Sep-2026 02:05 pm`
 * on screens, `19-Sep-2026 14:05` on printed documents and "Generated on" footers.
 *
 * Two rules this file exists to enforce, both learned the hard way:
 *
 * 1. NEVER `month: 'short'`. ICU disagrees with itself across runtimes —
 *      Node 24  toLocaleDateString('en-IN', {month:'short', …})  ->  "19 Sept 2026"
 *      Chrome   …the exact same options…                         ->  "19 Sep 2026"
 *    so the same record printed two different strings on a PDF and on screen.
 *    The month name here comes from MONTHS below and can never drift again.
 *
 * 2. `formatToParts`, never `.format()`. `.format()` can emit bidi control marks
 *    and its separators shift between ICU versions; parts are stable.
 *
 * Timezone is pinned to IST. Nothing else in the repo pins one, so a server in
 * UTC used to render dates a day early for anything after 05:30 IST.
 *
 * This file is byte-identical to `frontend/src/lib/date.ts` except for
 * `parseDMY`, which is backend-only (it hardens the importer).
 */

export const IST = 'Asia/Kolkata';
export const EM_DASH = '—';

export type DateInput = Date | string | number | null | undefined;

/** Our own month names — see rule 1 above. Do not replace with `month: 'short'`. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const dmy = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const t12 = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
const t24 = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Normalise any input to a valid Date, or null.
 *
 * `0` is a real instant (01-Jan-1970), not a missing value — mirroring the
 * repo's money rule that a real 0 is not the same as nothing. Only
 * null/undefined/''/NaN are "missing".
 */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partsOf(fmt: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** The project's only date format: `19-Sep-2026` */
export function formatDate(value: DateInput, fallback: string = EM_DASH): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = partsOf(dmy, d);
  return `${p.day}-${MONTHS[Number(p.month) - 1]}-${p.year}`;
}

/** `02:05 pm` */
export function formatTime(value: DateInput, fallback: string = EM_DASH): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = partsOf(t12, d);
  return `${p.hour.padStart(2, '0')}:${p.minute} ${(p.dayPeriod || '').toLowerCase()}`;
}

/** `14:05` — time alone, 24-hour. Documents, logs and machine-read context. */
export function formatTime24(value: DateInput, fallback: string = EM_DASH): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = partsOf(t24, d);
  return `${p.hour.padStart(2, '0')}:${p.minute}`;
}

/** `19-Sep-2026 02:05 pm` — screens */
export function formatDateTime(value: DateInput, fallback: string = EM_DASH): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** `19-Sep-2026 14:05` — printed documents and "Generated on" footers */
export function formatDateTime24(value: DateInput, fallback: string = EM_DASH): string {
  const d = toDate(value);
  if (!d) return fallback;
  const p = partsOf(t24, d);
  return `${formatDate(d)} ${p.hour.padStart(2, '0')}:${p.minute}`;
}

/**
 * `19-Sep-2026 – 25-Sep-2026`, collapsing to one date when both ends are the
 * same day. A single open end formats the end that exists.
 */
export function formatDateRange(from: DateInput, to: DateInput, fallback: string = EM_DASH): string {
  const a = toDate(from);
  const b = toDate(to);
  if (!a && !b) return fallback;
  if (!a) return formatDate(b, fallback);
  if (!b) return formatDate(a, fallback);
  const left = formatDate(a);
  const right = formatDate(b);
  return left === right ? left : `${left} – ${right}`;
}

/**
 * `2026-09-19` in IST. The ONLY blessed producer of an ISO date string —
 * `<input type="date">` values, query params, filenames, CSV.
 *
 * NOT a display format. Replaces `.toISOString().split('T')[0]`, which is UTC
 * and therefore reports YESTERDAY for anything before 05:30 IST.
 */
export function toDateInputValue(value: DateInput): string {
  const d = toDate(value);
  if (!d) return '';
  const p = partsOf(dmy, d);
  return `${p.year}-${p.month}-${p.day}`;
}

const MONTH_INDEX = new Map(MONTHS.map((m, i) => [m.toLowerCase(), i]));

/**
 * Backend only. Parses `19-Sep-2026` and `19/09/2026` back to a Date, rejecting
 * impossible days like `31/02/2026`.
 *
 * Hardens the importer: `new Date("05/03/2026")` silently reads as May 3rd
 * (MM/DD), so a DD/MM export round-tripping through the importer used to be a
 * silent data-corruption path. Day-first is assumed here because that is what
 * this app emits.
 */
export function parseDMY(input: string | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,}|\d{1,2})[-/\s](\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const year = Number(m[3]);

  let month: number;
  if (/^\d+$/.test(m[2])) {
    month = Number(m[2]) - 1;
  } else {
    const idx = MONTH_INDEX.get(m[2].slice(0, 3).toLowerCase());
    if (idx === undefined) return null;
    month = idx;
  }

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;

  // UTC midnight: +05:30 keeps it on the same calendar day in IST, so a value
  // round-trips through formatDate() unchanged.
  const d = new Date(Date.UTC(year, month, day));
  // Date.UTC rolls 31-Feb over into March — reject rather than accept a shift.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}
