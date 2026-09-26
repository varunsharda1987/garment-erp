/**
 * Purchase unit — what a supplier sells in, when it is not what we count.
 *
 * A material is COUNTED in `materials.unit` (its consumption unit — every BOM, cost-sheet, order-BOM
 * and requirement line; see material-unit.helper). Some are BOUGHT in another unit (owner, 2026-09-26):
 *   - buttons and snap buttons: counted per PIECE, ordered and inwarded by the GROSS (144);
 *   - thread: bought in BOXES of cones / tubes (Phase C — the factor is the box size).
 *
 * The PO line and the GRN line stay in the purchase unit (quantity, rate, value, GST). Requirement
 * links and stock stay in the stock unit. These helpers are the only arithmetic between the two.
 */

import type { Prisma, Unit } from '@prisma/client';
import prisma from '../../config/database';
import { COUNT_UNIT_FACTORS, normalizeUnit, purchaseUnitOf, unitLabel } from '../../utils/units';
import { QTY_EPSILON } from '../../utils/quantity';
import { BusinessError } from '../../errors';

export interface PurchaseUnit {
  /** The unit the PO / GRN line is in */
  unit: Unit;
  /** Stock units in one purchase unit (GROSS → 144 pieces) */
  stockUnitsPerUnit: number;
}

/** The purchase unit of a material type (the rule lives in the unit registry), or null. */
export function purchaseUnitFor(materialType: string | null | undefined): PurchaseUnit | null {
  const p = purchaseUnitOf(materialType);
  return p ? { unit: p.unit, stockUnitsPerUnit: p.per } : null;
}

/** Stock units → purchase units, rounded UP to whole (2,300 pcs → 16 gross; 2,304 pcs → 16 gross). */
export function toPurchaseQty(stockQty: number, stockUnitsPerUnit: number): number {
  if (!(stockUnitsPerUnit > 0)) return stockQty;
  // A value within the quantity tolerance of a whole unit IS that unit — never round 2,304.001 up to 17
  return Math.ceil(stockQty / stockUnitsPerUnit - QTY_EPSILON / stockUnitsPerUnit);
}

/**
 * Purchase units → stock units. A factor only ever comes from a counted unit (gross, dozen, box of cones),
 * so the result is whole: 15.972 gross received is 2,300 pieces, not 2,299.968. No factor = unchanged.
 */
export function toStockQty(purchaseQty: number, stockUnitsPerUnit: number | null | undefined): number {
  if (!stockUnitsPerUnit || !(stockUnitsPerUnit > 0) || stockUnitsPerUnit === 1) return purchaseQty;
  return Math.round(purchaseQty * stockUnitsPerUnit);
}

export interface PoLineUnitInput {
  materialId?: string | null;
  unit: string;
}

export interface PoLineUnit {
  unit: Unit;
  /** null = the line is in the unit its material is counted in */
  stockUnitsPerUnit: number | null;
}

/**
 * The unit a PO line is stored in, and how many stock units one of it holds — decided by the SERVER for
 * every PO writer (a request body never sets the factor). Aligned with `lines` by index.
 *   - buttons / snap buttons: must be GROSS (factor 144) — refused otherwise, with the reason;
 *   - a DOZEN / GROSS of something counted in pieces: factor 12 / 144;
 *   - anything else: as sent, no factor.
 */
export async function resolvePoLineUnits(
  lines: ReadonlyArray<PoLineUnitInput>,
  tx?: Prisma.TransactionClient
): Promise<PoLineUnit[]> {
  const ids = Array.from(new Set(lines.map((l) => l.materialId).filter((id): id is string => !!id)));
  const materials = ids.length
    ? await (tx ?? prisma).materials.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, unit: true, materialType: true },
      })
    : [];
  const byId = new Map(materials.map((m) => [m.id, m]));

  return lines.map((line) => {
    const requested = normalizeUnit(line.unit) ?? (line.unit as Unit);
    const material = line.materialId ? byId.get(line.materialId) : undefined;
    if (!material) return { unit: requested, stockUnitsPerUnit: null };

    const purchase = purchaseUnitFor(material.materialType);
    if (purchase) {
      if (requested !== purchase.unit) {
        throw new BusinessError(
          `${material.name} is bought by the ${unitLabel(purchase.unit).toLowerCase()} ` +
            `(${purchase.stockUnitsPerUnit} ${unitLabel(material.unit).toLowerCase()}s each) — order it in ` +
            `${unitLabel(purchase.unit)}, not ${unitLabel(requested)}.`
        );
      }
      return { unit: purchase.unit, stockUnitsPerUnit: purchase.stockUnitsPerUnit };
    }
    const factor = COUNT_UNIT_FACTORS[requested];
    if (factor && factor.of === material.unit) return { unit: requested, stockUnitsPerUnit: factor.per };
    return { unit: requested, stockUnitsPerUnit: null };
  });
}

/**
 * The rate per purchase unit a supplier charges for each material bought in one (buttons, snap buttons):
 * the supplier's own price per gross, else the master's. Materials with neither are absent — the caller then
 * converts its per-piece rate (× 144).
 */
export async function purchaseUnitPrices(
  materialIds: ReadonlyArray<string>,
  supplierId: string | null | undefined,
  tx?: Prisma.TransactionClient
): Promise<Map<string, number>> {
  const client = tx ?? prisma;
  const materials = await client.materials.findMany({
    where: { id: { in: Array.from(new Set(materialIds)) }, materialType: { in: ['BUTTON', 'SNAP_BUTTON'] } },
    select: {
      id: true,
      buttonId: true,
      button_master: { select: { pricePerGross: true } },
      snap_button_master: { select: { pricePerGross: true } },
    },
  });
  const buttonIds = materials.map((m) => m.buttonId).filter((id): id is string => !!id);
  const supplierPrices =
    supplierId && buttonIds.length
      ? await client.button_suppliers.findMany({
          where: { supplierId, buttonId: { in: buttonIds }, pricePerGross: { not: null } },
          select: { buttonId: true, pricePerGross: true },
        })
      : [];
  const bySupplier = new Map(supplierPrices.map((s) => [s.buttonId, Number(s.pricePerGross)]));
  const out = new Map<string, number>();
  for (const m of materials) {
    const price =
      (m.buttonId ? bySupplier.get(m.buttonId) : undefined) ??
      (m.button_master?.pricePerGross != null ? Number(m.button_master.pricePerGross) : undefined) ??
      (m.snap_button_master?.pricePerGross != null ? Number(m.snap_button_master.pricePerGross) : undefined);
    if (price != null) out.set(m.id, price);
  }
  return out;
}

/**
 * A requirement-built PO line in STOCK units (2,300 pcs at ₹0.125) → its PURCHASE unit (16 gross at ₹18).
 * Quantity rounds UP to whole units AFTER consolidation. A wizard override is already in the purchase unit
 * (the preview showed gross) and is never converted again — that would be a second ×144.
 */
export function toPurchaseLine(
  line: { quantity: number; unitPrice: number },
  purchase: PurchaseUnit,
  opts: { quantityOverride?: number | null; priceOverride?: number | null; purchaseUnitPrice?: number | null }
): { quantity: number; unit: Unit; unitPrice: number; stockUnitsPerUnit: number } {
  const quantity =
    opts.quantityOverride != null
      ? Number(opts.quantityOverride)
      : toPurchaseQty(line.quantity, purchase.stockUnitsPerUnit);
  const unitPrice =
    opts.priceOverride != null
      ? Number(opts.priceOverride)
      : opts.purchaseUnitPrice != null
        ? opts.purchaseUnitPrice
        : Math.round(line.unitPrice * purchase.stockUnitsPerUnit * 100) / 100;
  return { quantity, unit: purchase.unit, unitPrice, stockUnitsPerUnit: purchase.stockUnitsPerUnit };
}

/** A rate per purchase unit → per stock unit, to 4 decimals (₹18 / gross → ₹0.125 / piece). */
export function stockRate(purchaseRate: number, stockUnitsPerUnit: number | null | undefined): number {
  const factor = stockUnitsPerUnit && stockUnitsPerUnit > 0 ? stockUnitsPerUnit : 1;
  return Math.round((purchaseRate / factor) * 10000) / 10000;
}
