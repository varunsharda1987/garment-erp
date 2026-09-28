/**
 * The colour of a size line — ONE rule for sizes, production and dispatch.
 *
 * Colour is OPTIONAL (owner, 2026-09-28). This business makes one colour per style (the style's
 * Primary Color, mirrored into `color_options` by style-colour.helper.ts) and most styles have none.
 * On 2026-09-24 a size breakdown was made to REFUSE a style with no colour, because stitching output
 * then demanded one; Link to Production Order therefore copied no sizes for 6 of the 8 Easybuy orders,
 * and their size-wise labels sat in "Size Split Pending" while the sale orders listed every size.
 * Sizes, stitching and finishing do not need a colour — the colour is recorded when the style has
 * one and left blank when it does not.
 *
 * The rule, per size line:
 *  - a line's own colour is kept, and must be one of the style's colours;
 *  - a line without one takes the style's ONLY colour;
 *  - on a style with NO colour it stays blank (null);
 *  - on a style with SEVERAL colours it is refused — which colour is being made has to be said.
 *
 * Blank-colour stock is stock of the style in whatever colour it is: it matches any request for that
 * style and size (`stockColourMatches`).
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { ValidationError } from '../../errors';

type Db = Prisma.TransactionClient | PrismaClient;

/** The key one (colour, size) pair goes by — a blank colour is its own key, never "any". */
export function skuKey(colorId: string | null | undefined, sizeId: string | null | undefined): string {
  return `${colorId ?? ''}|${sizeId ?? ''}`;
}

/** May stock of this colour serve a request for that colour? Blank-colour stock serves any colour. */
export function stockColourMatches(
  stockColorId: string | null | undefined,
  wantedColorId: string | null | undefined
): boolean {
  return !stockColorId || !wantedColorId || stockColorId === wantedColorId;
}

/**
 * The Prisma `where` fragment for stock that may serve `wanted` — `stockColourMatches` as a query:
 * that colour or blank-colour stock; with no colour wanted, any. Spread it into a where that has no
 * `OR` of its own.
 */
export function stockColourWhere(wanted: string | null | undefined): { OR?: Array<{ colorId: string | null }> } {
  return wanted ? { OR: [{ colorId: wanted }, { colorId: null }] } : {};
}

/**
 * Apply the colour rule to a style's size lines. Returns the lines with `colorId` settled (a string,
 * or null for a style with no colour); throws when a line names a foreign colour, or leaves the
 * colour out on a style that comes in several.
 */
export async function resolveSizeLineColours<T extends { colorId?: string | null }>(
  db: Db,
  styleId: string,
  lines: T[],
  styleCode?: string
): Promise<Array<T & { colorId: string | null }>> {
  const colours = await db.color_options.findMany({
    where: { styleId },
    select: { id: true, colorName: true },
  });
  const allowed = new Set(colours.map((c) => c.id));
  const only = colours.length === 1 ? colours[0].id : null;

  const settled = lines.map((line) => ({ ...line, colorId: line.colorId || only }));
  if (settled.some((l) => l.colorId && !allowed.has(l.colorId))) {
    throw new ValidationError(`One or more sizes carry a colour that is not ${styleCode ?? 'this style'}'s colour.`);
  }
  if (colours.length > 1 && settled.some((l) => !l.colorId)) {
    throw new ValidationError(
      `${styleCode ?? 'This style'} comes in ${colours.length} colours (${colours.map((c) => c.colorName).join(', ')}) — choose the colour for each size.`
    );
  }
  return settled;
}

/**
 * The colour rule for rows that each name their style (delivery-note items): every row settled by
 * `resolveSizeLineColours` for its own style, in the original order. A row left blank on a one-colour
 * style takes that colour — so it is capped, matched and drawn as the colour its order was sized in.
 */
export async function settleRowColours<T extends { styleId: string; colorId?: string | null }>(
  db: Db,
  rows: T[]
): Promise<Array<T & { colorId: string | null }>> {
  const out = rows.map((row) => ({ ...row, colorId: row.colorId || null }));
  const byStyle = new Map<string, number[]>();
  rows.forEach((row, i) => byStyle.set(row.styleId, [...(byStyle.get(row.styleId) ?? []), i]));
  for (const [styleId, indexes] of byStyle) {
    const settled = await resolveSizeLineColours(
      db,
      styleId,
      indexes.map((i) => rows[i])
    );
    settled.forEach((row, k) => {
      out[indexes[k]] = row;
    });
  }
  return out;
}
