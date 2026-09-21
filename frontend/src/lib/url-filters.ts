/**
 * URL-held list filters.
 *
 * Filters live in the address bar so that row -> detail -> Back restores them and a filtered view
 * can be pasted to a colleague. These helpers are the shared half of that; each page still owns
 * its own `filters` useMemo, following the pattern in PurchaseOrderList.tsx.
 */

/** A value a filter control can write: a scalar, a multi-select list, or "remove me". */
export type FilterUpdate = string | string[] | number | undefined | null;

/**
 * Apply filter updates to a copy of the current params.
 *
 * A list is written as REPEATED KEYS (`?weaveType=A&weaveType=B`), never comma-joined: these are
 * free-text master-data values that may contain a comma ("Red, Deep"), and joining then splitting
 * would turn one real value into two that match nothing.
 *
 * `undefined` / `null` / `''` / `[]` all REMOVE the key, which is how a cleared control and the
 * mandatory `page: undefined` reset are expressed.
 */
export function applyUrlUpdates(current: URLSearchParams, updates: Record<string, FilterUpdate>): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    next.delete(key);
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      value.filter((v) => v !== '' && v != null).forEach((v) => next.append(key, v));
    } else {
      next.set(key, String(value));
    }
  }

  return next;
}

/**
 * Read a multi-select facet out of the URL.
 *
 * Uses getAll(), not get() — get() on a repeated key returns only the FIRST value, silently
 * dropping the rest. Sorted so that ticking Printing-then-Dyeing and Dyeing-then-Printing produce
 * one React Query cache entry, not two identical requests.
 */
export function getUrlList(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .filter((v) => v !== '')
    .sort();
}

/** Read a numeric bound. Absent/blank/unparseable means NO BOUND — never 0. */
export function getUrlNumber(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Read the page size, clamped to what the API's Zod schema accepts (min 1, max 100).
 * A hand-edited `?limit=500` would otherwise 400 the whole list page.
 */
export function getUrlLimit(params: URLSearchParams, fallback = 50): number {
  const n = Number(params.get('limit'));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

/** Read the page number, defaulting to 1. */
export function getUrlPage(params: URLSearchParams): number {
  const n = Number(params.get('page'));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
