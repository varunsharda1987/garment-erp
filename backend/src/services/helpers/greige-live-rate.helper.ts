/**
 * The LIVE greige rate — ONE lookup for Fabric Costing, CAD Planning's auto-costing, Push to
 * Fabric Costing and the cost-sheet calculator — and the honest label a saved rate carries.
 *
 * Until 2026-09-26 each of those screens had its own copy, all keyed on received purchases only.
 * A greige bought on a fresh PO (PO2609-0004, ₹67) therefore never reached costing: the page kept
 * offering January's ₹58.5, a merchandiser typed ₹65, and the save left the old
 * "PROCUREMENT · 25-Jan" label beside the typed number (IP00138 / IT00254; 28 rows in all).
 *
 * Live rate = the NEWEST of
 *   - a PO line for the greige (materials.id === greige id), PO category GREIGE, placed
 *     (SENT / ACKNOWLEDGED / PARTIALLY_RECEIVED / RECEIVED / SHORT_CLOSED), priced per metre;
 *   - a received greige purchase (fabric_procurement GREIGE, RECEIVED / PROCESSING / COMPLETED);
 *   - a greige stock lot with a purchase cost.
 * On the same day a receipt beats the PO (it is what actually arrived), and a stock lot beats a
 * procurement (the old rule). With none of them: the greige master's default cost.
 *
 * `greigeRateProvenance` decides what a SAVED rate is labelled: the live source when it equals the
 * live rate, otherwise MANUAL_OVERRIDE — with a reason required whenever a live rate existed.
 */

import { GreigeRateSource, Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { ValidationError } from '../../errors';
import { formatDate, toDateInputValue } from '../../utils/date';
import { normalizeUnit } from '../../utils/units';

type Db = PrismaClient | Prisma.TransactionClient;

export interface LiveGreigeRate {
  rate: number;
  source: GreigeRateSource;
  /** When the rate was set: PO date, purchase date, lot received date, or master last update */
  date: Date | null;
  /** The document it came from: PO number, procurement id — null for a stock lot or the master */
  ref: string | null;
  supplierName: string | null;
}

/** POs whose price has been agreed with the supplier — a DRAFT is not a price, a CANCELLED one never happened */
const PLACED_PO_STATUSES = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'SHORT_CLOSED'] as const;
const RECEIVED_PROCUREMENT_STATUSES = ['RECEIVED', 'PROCESSING', 'COMPLETED'] as const;

/** Receipts outrank a PO on the same day; a stock lot outranks a procurement (the rule before the merge) */
const SAME_DAY_RANK: Record<string, number> = { STOCK_VALUATION: 0, PROCUREMENT: 1, PURCHASE_ORDER: 2 };

function newer(a: LiveGreigeRate | undefined, b: LiveGreigeRate): LiveGreigeRate {
  if (!a) return b;
  const dayA = a.date ? toDateInputValue(a.date) : '';
  const dayB = b.date ? toDateInputValue(b.date) : '';
  if (dayA !== dayB) return dayB > dayA ? b : a;
  return SAME_DAY_RANK[b.source] < SAME_DAY_RANK[a.source] ? b : a;
}

export async function resolveLiveGreigeRates(
  greigeIds: Array<string | null | undefined>,
  db: Db = prisma
): Promise<Map<string, LiveGreigeRate>> {
  const ids = [...new Set(greigeIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const live = new Map<string, LiveGreigeRate>();
  if (ids.length === 0) return live;

  const [poLines, procurements, lots, masters] = await Promise.all([
    db.purchase_order_items.findMany({
      where: {
        materialId: { in: ids },
        unitPrice: { gt: 0 },
        purchase_orders: {
          poCategory: 'GREIGE',
          isActive: true,
          status: { in: [...PLACED_PO_STATUSES] },
        },
      },
      select: {
        materialId: true,
        unit: true,
        unitPrice: true,
        purchase_orders: { select: { poNumber: true, poDate: true, suppliers: { select: { name: true } } } },
      },
    }),
    db.fabric_procurement.findMany({
      where: {
        greigeId: { in: ids },
        procurementType: 'GREIGE',
        status: { in: [...RECEIVED_PROCUREMENT_STATUSES] },
      },
      select: { id: true, greigeId: true, ratePerUnit: true, purchaseDate: true, supplier: { select: { name: true } } },
    }),
    db.greige_stock.findMany({
      where: { greigeId: { in: ids }, purchaseCost: { not: null } },
      select: { greigeId: true, purchaseCost: true, receivedDate: true },
    }),
    db.greige_master.findMany({
      where: { id: { in: ids } },
      select: { id: true, costPerMeter: true, updatedAt: true },
    }),
  ]);

  for (const line of poLines) {
    // A PO priced per kg (or per piece) is not a per-metre greige rate
    if (!line.materialId || normalizeUnit(line.unit) !== 'METER') continue;
    live.set(
      line.materialId,
      newer(live.get(line.materialId), {
        rate: Number(line.unitPrice),
        source: 'PURCHASE_ORDER',
        date: line.purchase_orders.poDate,
        ref: line.purchase_orders.poNumber,
        supplierName: line.purchase_orders.suppliers?.name ?? null,
      })
    );
  }
  for (const p of procurements) {
    if (!p.greigeId || p.ratePerUnit == null || !p.purchaseDate) continue;
    live.set(
      p.greigeId,
      newer(live.get(p.greigeId), {
        rate: Number(p.ratePerUnit),
        source: 'PROCUREMENT',
        date: p.purchaseDate,
        ref: p.id,
        supplierName: p.supplier?.name ?? null,
      })
    );
  }
  for (const lot of lots) {
    if (lot.purchaseCost == null) continue;
    live.set(
      lot.greigeId,
      newer(live.get(lot.greigeId), {
        rate: Number(lot.purchaseCost),
        source: 'STOCK_VALUATION',
        date: lot.receivedDate,
        ref: null,
        supplierName: null,
      })
    );
  }
  for (const m of masters) {
    if (!live.has(m.id) && m.costPerMeter != null && Number(m.costPerMeter) > 0) {
      live.set(m.id, {
        rate: Number(m.costPerMeter),
        source: 'GREIGE_MASTER',
        date: m.updatedAt,
        ref: null,
        supplierName: null,
      });
    }
  }
  return live;
}

/** "PO2609-0004 · 21-Sep-2026" / "purchase · 25-Jan-2026" — how a refusal names the live rate */
export function describeLiveGreigeRate(live: LiveGreigeRate): string {
  const when = live.date ? formatDate(live.date) : null;
  const what =
    live.source === 'PURCHASE_ORDER'
      ? live.ref
      : live.source === 'PROCUREMENT'
        ? 'purchase'
        : live.source === 'STOCK_VALUATION'
          ? 'stock lot'
          : 'greige master default';
  return [what, when].filter(Boolean).join(' · ');
}

/** The provenance columns a saved greige rate writes (fabric_width_cad.greigeRate*) */
export interface GreigeRateProvenance {
  greigeRateSource: GreigeRateSource | null;
  greigeRateSourceDate: Date | null;
  greigeRateSourceRef: string | null;
  greigeRateManualOverride: number | null;
  greigeRateOverrideReason: string | null;
  greigeRateSetById: string | null;
}

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * What a saved greige rate is labelled. The server decides — the client's own "manual" flag is
 * never trusted. Throws ValidationError when a typed rate departs from an existing live rate
 * without a reason.
 */
export function greigeRateProvenance(args: {
  rate: number | null;
  live: LiveGreigeRate | undefined;
  reason?: string | null;
  userId: string | null;
  now?: Date;
  /** For the refusal message: "Top 52"" */
  rowLabel?: string;
}): GreigeRateProvenance {
  const { rate, live, userId } = args;
  const reason = args.reason?.trim() || null;
  if (rate == null) {
    return {
      greigeRateSource: null,
      greigeRateSourceDate: null,
      greigeRateSourceRef: null,
      greigeRateManualOverride: null,
      greigeRateOverrideReason: null,
      greigeRateSetById: null,
    };
  }
  if (live && sameMoney(rate, live.rate)) {
    return {
      greigeRateSource: live.source,
      greigeRateSourceDate: live.date,
      greigeRateSourceRef: live.ref,
      greigeRateManualOverride: null,
      greigeRateOverrideReason: null,
      greigeRateSetById: userId,
    };
  }
  if (live && (!reason || reason.length < 3)) {
    throw new ValidationError(
      `${args.rowLabel ? `${args.rowLabel}: g` : 'G'}reige ₹${rate} differs from the live rate ₹${live.rate} ` +
        `(${describeLiveGreigeRate(live)}). Use the live rate, or enter a reason for ₹${rate}.`
    );
  }
  return {
    greigeRateSource: 'MANUAL_OVERRIDE',
    greigeRateSourceDate: args.now ?? new Date(),
    greigeRateSourceRef: null,
    greigeRateManualOverride: rate,
    greigeRateOverrideReason: reason,
    greigeRateSetById: userId,
  };
}
