/**
 * CAD Planning list filters — ONE definition of what each filter means.
 *
 * Read by GET /cad-planning/styles (the rows) AND GET /cad-planning/status-counts (the tab
 * badges), so a badge can never promise rows the table does not show.
 *
 * Deliberately type-only on Prisma: the Zod schema imports the value lists below, and a schema
 * must not drag the database client in with it.
 */
import type { Prisma } from '@prisma/client';

/** `orders` filter: is the style on an order that is still running? */
export const CAD_ORDER_FILTERS = ['open', 'none'] as const;
export type CadOrderFilter = (typeof CAD_ORDER_FILTERS)[number];

/** `cadProgress` filter: which purposes the style has a CAD row for. */
export const CAD_PROGRESS_FILTERS = [
  'NO_CAD',
  'NO_COSTING',
  'NO_RAW_MATERIAL_CALCULATION',
  'NO_PRODUCTION',
  'HAS_COSTING',
  'HAS_RAW_MATERIAL_CALCULATION',
  'HAS_PRODUCTION',
] as const;
export type CadProgressFilter = (typeof CAD_PROGRESS_FILTERS)[number];

export interface CadListFilters {
  customerId?: string[];
  brandName?: string[];
  productCategoryId?: string[];
  orders?: CadOrderFilter;
  cadProgress?: CadProgressFilter;
}

/**
 * Sale orders that no longer need anything from CAD. DRAFT stays open: a draft order is the
 * earliest signal that a style is about to be cut.
 */
const CLOSED_SALE_ORDER_STATUSES = ['CANCELLED', 'DISPATCHED', 'DELIVERED'] as const;

/** Production-order lines that are finished. SPLIT is a parent whose children carry the work. */
const CLOSED_ORDER_ITEM_STATUSES = ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'] as const;

const OPEN_ORDER_WHERE: Prisma.stylesWhereInput = {
  OR: [
    { sale_order_items: { some: { saleOrder: { status: { notIn: [...CLOSED_SALE_ORDER_STATUSES] } } } } },
    { order_items: { some: { status: { notIn: [...CLOSED_ORDER_ITEM_STATUSES] } } } },
  ],
};

/**
 * "The style has a CAD row [for this purpose]" — on EXACTLY the path the list's Progress ticks
 * read (getStylesForCADPlanning → cadDetails): the style fabric's cadRows plus its legacy
 * fabricCAD pointer. Rows linked only through costingStyleId are NOT counted, because the ticks
 * do not show them (all 14 such rows on 2026-09-26 were empty width-0 shells). Change both
 * together or a filter will disagree with the row it returns.
 */
function hasCadWhere(purpose?: string): Prisma.stylesWhereInput {
  const cadRow: Prisma.fabric_width_cadWhereInput = purpose ? { purpose } : {};
  return {
    style_components: {
      some: {
        style_fabrics: {
          some: purpose
            ? { OR: [{ cadRows: { some: cadRow } }, { fabricCAD: { is: cadRow } }] }
            : { OR: [{ cadRows: { some: {} } }, { fabricCADId: { not: null } }] },
        },
      },
    },
  };
}

function cadProgressWhere(progress: CadProgressFilter): Prisma.stylesWhereInput {
  switch (progress) {
    case 'NO_CAD':
      return { NOT: hasCadWhere() };
    case 'NO_COSTING':
      return { NOT: hasCadWhere('COSTING') };
    case 'NO_RAW_MATERIAL_CALCULATION':
      return { NOT: hasCadWhere('RAW_MATERIAL_CALCULATION') };
    case 'NO_PRODUCTION':
      return { NOT: hasCadWhere('PRODUCTION') };
    case 'HAS_COSTING':
      return hasCadWhere('COSTING');
    case 'HAS_RAW_MATERIAL_CALCULATION':
      return hasCadWhere('RAW_MATERIAL_CALCULATION');
    case 'HAS_PRODUCTION':
      return hasCadWhere('PRODUCTION');
  }
}

/**
 * The filter bar as Prisma clauses, to be AND-ed onto the caller's where. Empty when nothing is
 * set. Buyer and brand read the style's own columns (customerId / brandName), which are filled on
 * every active style; brand_categories is missing on some.
 */
export function buildCadListFilterClauses(filters: CadListFilters): Prisma.stylesWhereInput[] {
  const clauses: Prisma.stylesWhereInput[] = [];

  if (filters.customerId?.length) clauses.push({ customerId: { in: filters.customerId } });
  if (filters.brandName?.length) clauses.push({ brandName: { in: filters.brandName } });
  if (filters.productCategoryId?.length) clauses.push({ productCategoryId: { in: filters.productCategoryId } });

  if (filters.orders === 'open') clauses.push(OPEN_ORDER_WHERE);
  if (filters.orders === 'none') clauses.push({ NOT: OPEN_ORDER_WHERE });

  if (filters.cadProgress) clauses.push(cadProgressWhere(filters.cadProgress));

  return clauses;
}

/** Append the filter clauses to a where that may already carry an AND (e.g. from applySearch). */
export function applyCadListFilters(where: Prisma.stylesWhereInput, filters: CadListFilters): void {
  const clauses = buildCadListFilterClauses(filters);
  if (clauses.length === 0) return;
  const existing = where.AND;
  const existingClauses = Array.isArray(existing) ? existing : existing ? [existing] : [];
  where.AND = [...existingClauses, ...clauses];
}
