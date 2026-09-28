/**
 * GRN line value — the single rule for "what rate is this receipt line valued at, and what is it
 * worth". Read by the GRN list (Rate / Value columns) and the printed job-work return (Job
 * charges), so the two can never disagree.
 *
 * A PO receipt is valued at what the goods cost: the receipt's own override, else the PO line's
 * price — the same precedence stock booking uses (grn.service.ts, fabric_stock purchaseCost).
 * A PO-less job-work return is valued at the PROCESSOR'S CHARGE only (owner, 2026-09-23): the
 * fabric's landed stock cost (greige + processing) lives on the stock lot, not here.
 *
 * Value is always on the ACTUAL accepted quantity — what enters stock and is payable. A line counted
 * at fold L (grn_items.foldLengthCm) carries the supplier's counted figure in acceptedQuantity; the
 * actual metres are that × L/100 (utils/fold-length). Computed from the stored counted figure, so a
 * receipt still in PENDING_QC values correctly too.
 */
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { addCurrency, multiplyCurrency, toCurrency } from '../../utils/currency';
import { foldActual } from '../../utils/fold-length';
import { toStockQty } from './purchase-unit.helper';

type DecimalLike = Prisma.Decimal | Decimal | number | string;

export interface GrnLineRateInput {
  actualRatePerUnit?: DecimalLike | null;
  purchase_order_items?: { unitPrice: DecimalLike } | null;
}

export interface JobWorkChargesInput {
  processType: string;
  processTypeMaster?: { code: string } | null;
  agreedRatePerMeter: DecimalLike;
  buttonholeCount?: number | null;
  buttonCount?: number | null;
  buttonholeRatePerUnit?: DecimalLike | null;
  buttonRatePerUnit?: DecimalLike | null;
}

export interface GrnLineQtyInput {
  acceptedQuantity: DecimalLike;
  foldLengthCm?: DecimalLike | null;
}

/** Actual accepted quantity of a GRN line — the counted figure converted at its fold length. */
export function grnLineActualQty(item: GrnLineQtyInput): Decimal {
  return foldActual(item.acceptedQuantity, item.foldLengthCm ?? null);
}

export interface GrnLineStockQtyInput extends GrnLineQtyInput {
  /** What approval booked, in stock units (NULL on receipts approved before 2026-09-26) */
  stockQuantity?: DecimalLike | null;
  purchase_order_items?: { stockUnitsPerUnit?: DecimalLike | null } | null;
}

/**
 * What ONE approved GRN line put into stock, in the STOCK unit — the figure a PO line's links are filled from
 * (receipt-allocation.helper). The stored `stockQuantity` when there is one: reversal takes back exactly that,
 * so filling from anything else would drift. Else the same rule approval uses (`grnLineStock`, grn.service):
 * the actual accepted quantity × the PO line's stock units per unit (16 gross → 2,304 pieces).
 */
export function grnLineStockQty(item: GrnLineStockQtyInput): number {
  if (item.stockQuantity != null) return Number(item.stockQuantity);
  const factor = item.purchase_order_items?.stockUnitsPerUnit;
  return toStockQty(grnLineActualQty(item).toNumber(), factor != null ? Number(factor) : null);
}

/** Kaaj-button prices two per-unit operations, so it has no single rate per unit received. */
export function isKaajButtonJob(jwo: Pick<JobWorkChargesInput, 'processType' | 'processTypeMaster'>): boolean {
  return jwo.processType === 'KAAJ_BUTTON' || jwo.processTypeMaster?.code === 'KAAJ_BUTTON';
}

/**
 * Rate per unit a GRN line is valued at, or null when it has none (a kaaj-button return, or a
 * line with neither a PO price nor a job work order).
 * `jwo` is passed only for a PO-less job-work return — a PO-backed receipt keys on its PO line.
 */
export function grnLineRate(item: GrnLineRateInput, jwo: JobWorkChargesInput | null): Decimal | null {
  if (item.actualRatePerUnit != null) return toCurrency(item.actualRatePerUnit);
  if (item.purchase_order_items) return toCurrency(item.purchase_order_items.unitPrice);
  if (jwo && !isKaajButtonJob(jwo)) return toCurrency(jwo.agreedRatePerMeter);
  return null;
}

/**
 * What the processor charges for a job-work return. Kaaj-button bills buttonholes and buttons at
 * their own per-unit rates; every other process bills accepted quantity × agreed rate.
 */
export function jobWorkCharges(
  jwo: JobWorkChargesInput,
  acceptedQty: DecimalLike
): { amount: Decimal; ratePerUnit: Decimal | null } {
  if (isKaajButtonJob(jwo)) {
    const amount = addCurrency(
      multiplyCurrency(jwo.buttonholeCount ?? 0, jwo.buttonholeRatePerUnit ?? 0),
      multiplyCurrency(jwo.buttonCount ?? 0, jwo.buttonRatePerUnit ?? 0)
    );
    return { amount, ratePerUnit: null };
  }
  const rate = toCurrency(jwo.agreedRatePerMeter);
  return { amount: multiplyCurrency(acceptedQty, rate), ratePerUnit: rate };
}
