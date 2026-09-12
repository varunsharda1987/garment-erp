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
 */

/** A Prisma `where` fragment. Deliberately loose: the shapes are nested and vary by model. */
type WhereFragment = Record<string, unknown>;

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
 * there is nothing to search for.
 */
export function buildSearchWhere(
  search: string | null | undefined,
  fields: readonly string[]
): { AND: WhereFragment[] } | undefined {
  const terms = (search ?? '').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0 || fields.length === 0) return undefined;

  return {
    AND: terms.map((term) => ({
      OR: fields.map((field) => nestByPath(field, { contains: term, mode: 'insensitive' })),
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
export function applySearch(where: WhereFragment, search: string | null | undefined, fields: readonly string[]): void {
  const filter = buildSearchWhere(search, fields);
  if (!filter) return;

  const existing = where.AND;
  const existingClauses = Array.isArray(existing) ? existing : existing ? [existing] : [];
  where.AND = [...existingClauses, ...filter.AND];
}
