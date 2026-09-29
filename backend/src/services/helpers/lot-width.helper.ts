/**
 * A received lot's width and the width of the marker cut from it — ONE rule (owner, 2026-09-29).
 *
 * A lot carries two widths: `finishedWidth` (what the fabric measures) and `cutableWidth` (what a
 * marker may use: measured − the selvedge setting, `GREIGE_CUTABLE_WIDTH_DEDUCTION_CM`, in inches).
 * A Production CAD's width is its MARKER's width, which need not equal the lot's: a 52" marker fits
 * on 53" cutable fabric with 1" spare. It must never be WIDER than the lot — it would not fit.
 *
 * Until 2026-09-29 a Production CAD had to be made at exactly the lot's width (an approved 52" marker
 * was not reused for a 53" lot), nothing refused one wider than its lot, and a lot's widths could not
 * be corrected after inward (ESSKY076LS: both lots recorded 57" measured, the fabric was 55").
 *
 * Callers: Create CAD on a lot (cad-embroidery.controller), the CAD row save, Approve and Link to
 * Stock, Correct width on a lot (fabric-stock.service), and the job-work receipt (grn.service).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import { qtyExceeds } from '../../utils/quantity';

type Db = PrismaClient | Prisma.TransactionClient;

/** Spare above this many inches earns a warning: a wider marker may save fabric */
export const MARKER_SPARE_WARN_INCHES = 2;

/** The cutable width a measured width gives: measured − selvedge (never below nothing to cut) */
export function cutableFromMeasured(measuredInches: number, selvedgeInches: number): number {
  return measuredInches > selvedgeInches ? Math.round((measuredInches - selvedgeInches) * 100) / 100 : measuredInches;
}

export interface MarkerFit {
  /** the marker is no wider than the lot's cutable width (within 0.005) */
  fits: boolean;
  /** lot cutable − marker width; negative when the marker is wider */
  spareInches: number;
  /** fits, with more than MARKER_SPARE_WARN_INCHES left over */
  wideSpare: boolean;
}

export function markerFitsLot(markerWidthInches: number, lotCutableInches: number): MarkerFit {
  const spareInches = Math.round((lotCutableInches - markerWidthInches) * 100) / 100;
  const fits = !qtyExceeds(markerWidthInches, lotCutableInches);
  return { fits, spareInches, wideSpare: fits && spareInches > MARKER_SPARE_WARN_INCHES };
}

/** "FAB-X-001, GRN2609-0502" — how a lot is named in these messages */
export async function lotWidthLabel(db: Db, fabricStockId: string): Promise<string> {
  const lot = await db.fabric_stock.findUnique({
    where: { id: fabricStockId },
    select: {
      fabricMaster: { select: { fabricCode: true } },
      grnItem: { select: { goods_receiving_notes: { select: { grnNumber: true } } } },
    },
  });
  return (
    [lot?.fabricMaster?.fabricCode, lot?.grnItem?.goods_receiving_notes?.grnNumber].filter(Boolean).join(', ') ||
    fabricStockId
  );
}

/**
 * Refuse a Production CAD that is wider than its lot (PRODUCTION_MARKER_WIDER_THAN_LOT).
 * A row with no width or no lot has nothing to check.
 */
export async function assertMarkerFitsLot(
  db: Db,
  markerWidthInches: number | null | undefined,
  fabricStockId: string | null | undefined,
  cadId?: string
): Promise<void> {
  if (!fabricStockId || markerWidthInches == null || !(Number(markerWidthInches) > 0)) return;
  const lotCutable = await lotCutableWidth(fabricStockId, db);
  if (lotCutable == null) return;
  const fit = markerFitsLot(Number(markerWidthInches), lotCutable);
  if (fit.fits) return;
  const label = await lotWidthLabel(db, fabricStockId);
  throw new BusinessError(
    `This marker is ${Number(markerWidthInches)}" but lot ${label} is ${lotCutable}" cutable — it will not fit. ` +
      `Make a marker at ${lotCutable}" or less, or correct the lot's width if it was recorded wrong.`,
    { code: 'PRODUCTION_MARKER_WIDER_THAN_LOT', cadId, fabricStockId, lotCutableWidth: lotCutable }
  );
}

/** A lot's cutable width, or null when the lot is gone */
export async function lotCutableWidth(fabricStockId: string, db: Db = prisma): Promise<number | null> {
  const lot = await db.fabric_stock.findUnique({ where: { id: fabricStockId }, select: { cutableWidth: true } });
  return lot ? Number(lot.cutableWidth) : null;
}
