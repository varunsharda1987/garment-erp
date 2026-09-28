/**
 * Book finished pieces into finished-goods stock — the ONE writer that creates or tops up a
 * `finished_goods_stock` row (Generate Transfer Slip at the end of finishing).
 *
 * A row is one (style, colour, size, location). Colour is optional (sku-colour.helper, owner
 * 2026-09-28): a style with no colour books blank-colour stock. Prisma's compound-unique `upsert`
 * cannot address a NULL colour, so this is one INSERT … ON CONFLICT against the unique index
 * `finished_goods_stock_styleId_colorId_sizeId_locationId_key`, which is NULLS NOT DISTINCT (raw SQL,
 * migration 20260928170000) — two slips for the same blank-colour size add to the SAME row instead
 * of opening a second one. Atomic per row, as the upsert it replaces was.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

export async function addFinishedGoods(
  tx: Prisma.TransactionClient,
  row: {
    styleId: string;
    colorId: string | null;
    sizeId: string;
    locationId: string;
    quantity: number;
    workOrderId: string | null;
  }
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO finished_goods_stock
      (id, "styleId", "colorId", "sizeId", "locationId", quantity, "workOrderId", "receivedDate", "lastUpdated")
    VALUES
      (${randomUUID()}, ${row.styleId}, ${row.colorId}, ${row.sizeId}, ${row.locationId}, ${row.quantity},
       ${row.workOrderId}, now(), now())
    ON CONFLICT ("styleId", "colorId", "sizeId", "locationId")
    DO UPDATE SET quantity = finished_goods_stock.quantity + EXCLUDED.quantity, "lastUpdated" = now()`;
}
