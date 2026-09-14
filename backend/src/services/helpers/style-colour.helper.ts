/**
 * Style colourway helper — the single authority for `color_options` rows.
 *
 * THE PROBLEM IT FIXES (2026-09-14). The system held colour in two disconnected places:
 *
 *   - `styles.colorId`   — ONE colour per style, FK to the `color_master` catalogue. Written by the
 *                          Style form's "Primary Color" picker and by the House of Kasya B2B app
 *                          (`PUT /styles/:id {colorId}`). 27 of 1,130 styles carried one.
 *   - `color_options`    — the per-style colourway rows that the Sale Order colour dropdown, work
 *                          orders, cutting, dispatch, ASN and samples all read. **0 rows, ever.**
 *
 * `color_options` had no writer at all: no form field, no import column, and
 * `POST /styles/:id/variants` accepts only `{size, sku, barcode}` (Zod strips anything else). The
 * one function that could have created a colourway — `style-variant.service.findOrCreateColor` —
 * had zero callers and has been deleted in favour of this helper.
 *
 * That gap was not cosmetic. Ten tables carry a NOT-NULL FK to `color_options`, so with it empty:
 * `finished_goods_stock` could not exist (hence sale-order Allocate could never find anything),
 * `delivery_note_items` and `asn_skus` were unreachable, and the sample Colourways tab was dead.
 * Where colour is nullable it removed a safety check — `saleOrder.service.ts` only compares colour
 * `if (item.colorId)`, so a colour-less line would consume stock of ANY colour.
 *
 * THE MODEL (owner decision 2026-09-14): **one colour per style.** Style codes already encode it
 * (LNG182P = Pink, LNG212Y = Yellow), the importer says so outright ("colorways are separate
 * styles"), and every B2B line's colour matched the style's own. So the style's Primary Color IS
 * its colourway, and this helper mirrors it into the row everything else reads.
 *
 * Call `syncStyleColourway` after every write to `styles.colorId`. Never insert a `color_options`
 * row by hand — a row without `colorMasterId` is unlinked from the colour catalogue, which is the
 * very thing this helper exists to prevent.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { logInfo } from '../../utils/logger';

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Ensure the style has a colourway matching its Primary Color, and return that colourway's id.
 *
 * - `colorMasterId` null/undefined → no-op, returns null. Clearing a style's Primary Color must
 *   NOT delete its colourway: finished-goods stock, delivery notes and placed order lines may
 *   already point at it, and the FKs are NOT NULL.
 * - Changing the Primary Color ADDS a colourway and leaves the old one, for the same reason. The
 *   style then carries both; the current one is whichever matches `styles.colorId`.
 * - Idempotent: saving a style repeatedly reuses the existing row.
 */
export async function syncStyleColourway(
  client: DbClient,
  styleId: string,
  colorMasterId: string | null | undefined
): Promise<string | null> {
  if (!colorMasterId) return null;

  const master = await client.color_master.findUnique({
    where: { id: colorMasterId },
    select: { id: true, colorName: true, colorCode: true },
  });

  // A colour that is not in the catalogue is not a colour we can name on a garment. The style's
  // own colorId FK has already accepted it, so this only happens if the master was deleted.
  if (!master) return null;

  const existing = await client.color_options.findFirst({
    where: { styleId, colorMasterId },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await client.color_options.create({
      data: {
        id: randomUUID(),
        styleId,
        colorName: master.colorName,
        colorCode: master.colorCode,
        colorMasterId: master.id,
        sortOrder: 0,
        isActive: true,
      },
      select: { id: true },
    });

    logInfo('Style colourway created from Primary Color', { styleId, colour: master.colorName });
    return created.id;
  } catch (err) {
    // Two saves of the same style racing each other — re-read rather than fail the save.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const justCreated = await client.color_options.findFirst({
        where: { styleId, colorMasterId },
        select: { id: true },
      });
      if (justCreated) return justCreated.id;
    }
    throw err;
  }
}
