/**
 * Free-text search for list screens.
 *
 * Two problems this exists to solve, both found in the 2026-09-12 search audit:
 *
 * 1. **Every list matched the whole phrase against each field.** So "kasya LNG182G" — a customer
 *    and a style, the obvious way to narrow a search — returned nothing, and even "House Kasya"
 *    (one word skipped) missed "House Of Kasya Pvt Ltd". Terms are now split on whitespace and
 *    ANDed: every word must match SOMETHING, but they may match different fields.
 *
 * 2. **Field lists were hand-rolled per endpoint** and drifted behind the columns the page
 *    actually displayed — the Sale Orders list showed a Style(s) column that was not searchable
 *    at all. Declaring the fields as paths keeps the list short enough to read next to the table.
 *
 * Field paths are dotted, with `[]` marking a to-many hop:
 *   'orderNumber'              → { orderNumber: { contains, insensitive } }
 *   'customers.name'           → { customers: { name: {…} } }
 *   'items[].style.styleCode'  → { items: { some: { style: { styleCode: {…} } } } }
 *
 * Every search in this codebase is a sequential scan — Postgres cannot use a B-tree index for
 * `ILIKE '%x%'`, and there are no trigram indexes — so adding fields costs nothing measurable at
 * the sizes here (largest table ~2k rows). Breadth is free; correctness is the point.
 *
 * Two more, from the 2026-09-26 Purchase Orders audit:
 *
 * 3. **A construction is written four ways.** Greige masters say "68×64", their materials mirror
 *    "68X64", people type "30x30" or "30*30" — and "30x30" found 0 of the 7 POs for a 30×30
 *    greige. A word holding a digit-by-digit dimension now matches every spelling (`spellings`).
 *
 * 4. **`%` and `_` were wildcards.** Prisma's `contains` sends `ILIKE $1` with `$1 = '%' + term +
 *    '%'` and escapes nothing (Prisma 6.19, verified in its query log and live: `search=%` returned
 *    all 13 POs, `PO2609_000` found 7). Every term is now escaped (`escapeLike`) so it matches itself.
 */

/** A Prisma `where` fragment. Deliberately loose: the shapes are nested and vary by model. */
type WhereFragment = Record<string, unknown>;

/** The spellings of the "by" in a construction or count: 30x30, 30X30, 30×30, 30*30. */
const DIMENSION_SEPARATORS = ['x', 'X', '×', '*'] as const;
/** A separator between two digits. The second digit is a lookahead, so "30x30x2" swaps both. */
const DIMENSION_SEPARATOR = /(\d)[xX×*](?=\d)/g;
const HAS_DIMENSION = /\d[xX×*]\d/;

/**
 * Every spelling of one search word: the word itself, or — when it holds a digit-by-digit
 * dimension — one per separator, each swapping every separator in the word.
 */
function spellings(term: string): string[] {
  if (!HAS_DIMENSION.test(term)) return [term];
  return DIMENSION_SEPARATORS.map((separator) => term.replace(DIMENSION_SEPARATOR, `$1${separator}`));
}

/**
 * A term that matches itself under LIKE / ILIKE: `\` is Postgres's default LIKE escape, `%` and
 * `_` its wildcards. Prisma's `contains` passes all three through untouched.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/** Wrap `matcher` in the nesting described by a dotted field path. */
function nestByPath(path: string, matcher: WhereFragment): WhereFragment {
  const segments = path.split('.');
  let node: WhereFragment = matcher;

  // Build from the leaf inwards, so the outermost segment ends up on top.
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    node = segment.endsWith('[]') ? { [segment.slice(0, -2)]: { some: node } } : { [segment]: node };
  }

  return node;
}

/**
 * A `where` fragment matching every word of `search` somewhere in `fields`, or undefined when
 * there is nothing to search for. A word with several spellings (a dimension) matches when ANY
 * spelling is found in ANY field; the words are still ANDed.
 */
export function buildSearchWhere(
  search: string | null | undefined,
  fields: readonly string[]
): { AND: WhereFragment[] } | undefined {
  const terms = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0 || fields.length === 0) return undefined;

  return {
    AND: terms.map((term) => ({
      OR: spellings(term).flatMap((spelling) =>
        fields.map((field) => nestByPath(field, { contains: escapeLike(spelling), mode: 'insensitive' }))
      ),
    })),
  };
}

/**
 * Add a search to a `where` object being built, preserving anything already on it.
 *
 * The conditions land under `AND` rather than `OR` precisely so they cannot swallow the filters
 * around them: a status or customer filter set elsewhere on the same `where` must still narrow the
 * result, not be ORed away.
 */
export function applySearch<T extends object>(
  where: T,
  search: string | null | undefined,
  fields: readonly string[]
): void {
  const filter = buildSearchWhere(search, fields);
  if (!filter) return;

  // Generic over the caller's own where type: several controllers declare a local where-clause
  // interface with no `AND` and no index signature, and demanding either bought casts at the call
  // sites rather than safety. All this function touches is `AND`.
  const target = where as { AND?: unknown };
  const existing = target.AND;
  const existingClauses: unknown[] = Array.isArray(existing) ? existing : existing ? [existing] : [];
  target.AND = [...existingClauses, ...filter.AND];
}
