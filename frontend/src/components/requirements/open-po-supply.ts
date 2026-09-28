/**
 * "An open PO covers this, not linked" on the Requirements page (docs/plans/po-allocation-design.md §7).
 *
 * MRP only suggests: a requirement that still needs buying may already be on a sent PO's line with room to spare
 * (the PO was raised for other orders, or bought over). These pure helpers word that note and work out what a
 * Link opens — the PO page's Allocate dialog, on that PO's lines, with only these requirements ticked. Nothing is
 * linked until the dialog is saved. Figures are in the requirement's (stock) unit.
 */
import { formatQuantity } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { isQtyZero, minQty, qtyExceeds } from '@/lib/quantity';
import type { MaterialRequirement, OpenPOSupplyLine } from '@/types/mrp.types';

type SupplyCarrier = Pick<MaterialRequirement, 'openPOSupply'>;

const qty = (value: number, unit: string) => formatQuantity(value, unit, 3);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const sum = (values: number[]) => round3(values.reduce((a, b) => a + b, 0));

/** The open-PO lines this requirement can be linked to now: nothing blocks it, and there is room */
export const linkableSupply = (req: SupplyCarrier): OpenPOSupplyLine[] =>
  (req.openPOSupply ?? []).filter((s) => s.linkable && qtyExceeds(s.freeToLink, 0));

export const hasLinkableSupply = (req: SupplyCarrier): boolean => linkableSupply(req).length > 0;

/**
 * One entry per PO line. The same line can reach several rows (a size's colours, a material group) with a
 * different free figure only where the dyer decides it (greige / lace) — the larger one is what the line has.
 */
export function distinctSupplyLines(reqs: readonly SupplyCarrier[]): OpenPOSupplyLine[] {
  const byLine = new Map<string, OpenPOSupplyLine>();
  for (const r of reqs) {
    for (const s of r.openPOSupply ?? []) {
      const seen = byLine.get(s.purchaseOrderItemId);
      if (!seen || s.freeToLink > seen.freeToLink) byLine.set(s.purchaseOrderItemId, s);
    }
  }
  return [...byLine.values()].sort(byExpected);
}

const byExpected = (a: OpenPOSupplyLine, b: OpenPOSupplyLine) =>
  a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate) || a.poNumber.localeCompare(b.poNumber);

export interface OpenPOSupplyWords {
  /** "PO2609-0231 · 1,589 pcs free · not linked (unlinked orders need 2,941 pcs)", or "2 open POs · …" */
  headline: string;
  /** "559 pcs here + 1,030 pcs to come", "delivers to Mangal Dyeing", "due 05-Nov-2026 — after it is needed" */
  details: string[];
  /** Why it can't be linked from here (nothing when one of the lines can be) */
  blockedReason: string | null;
  /** Hover text — one line per PO line */
  title: string;
}

/** How the note reads, or null when no open PO covers it */
export function openPOSupplyWords(
  supply: readonly OpenPOSupplyLine[] | null | undefined,
  unit: string
): OpenPOSupplyWords | null {
  const lines = [...(supply ?? [])].sort(byExpected);
  if (lines.length === 0) return null;
  const open = lines.filter((s) => s.linkable && qtyExceeds(s.freeToLink, 0));
  const poNumbers = [...new Set(lines.map((s) => s.poNumber))];
  const who = poNumbers.length === 1 ? poNumbers[0] : `${poNumbers.length} open POs`;

  const free = sum(open.map((s) => s.freeToLink));
  const demand = Math.max(...lines.map((s) => s.unlinkedDemandQty));
  const headline =
    open.length > 0
      ? `${who} · ${qty(free, unit)} free · not linked` +
        (qtyExceeds(demand, 0) ? ` (unlinked orders need ${qty(demand, unit)})` : '')
      : `${who} · not linked`;

  const details: string[] = [];
  // What a link would take from goods already here (held at once) and what is still to come
  const here = sum(open.map((s) => minQty(s.arrivedFree, s.freeToLink)));
  if (qtyExceeds(here, 0)) {
    const toCome = round3(Math.max(0, free - here));
    details.push(
      isQtyZero(toCome) ? `${qty(here, unit)} here` : `${qty(here, unit)} here + ${qty(toCome, unit)} to come`
    );
  }
  const places = [...new Set(lines.flatMap((s) => (s.deliversTo ?? []).map((p) => p.name)))];
  if (places.length > 0) details.push(`delivers to ${places.join(', ')}`);
  const late = (open.length > 0 ? open : lines).filter((s) => s.arrivesLate);
  if (late.length > 0) {
    details.push(
      late.length === 1
        ? `due ${formatDate(late[0].expectedDeliveryDate)} — after it is needed`
        : 'some arrive after it is needed'
    );
  }

  const blockedReason = open.length > 0 ? null : (lines.find((s) => s.blockedReason)?.blockedReason ?? null);
  const title = lines
    .map((s) =>
      [
        `${s.poNumber}${s.supplierName ? ` — ${s.supplierName}` : ''}`,
        `expected ${formatDate(s.expectedDeliveryDate)}`,
        `${qty(s.orderedStockQty, unit)} ordered`,
        `${qty(s.allocatedQty, unit)} linked to orders`,
        qtyExceeds(s.arrivedQty, 0) ? `${qty(s.arrivedQty, unit)} arrived` : null,
        `${qty(s.freeToLink, unit)} free to link`,
      ]
        .filter(Boolean)
        .join(' · ')
    )
    .join('\n');
  return { headline, details, blockedReason, title };
}

/** What one Link opens: a PO, the lines of it that cover these requirements, and those requirements ticked */
export interface POLinkTarget {
  poId: string;
  poNumber: string;
  itemIds: string[];
  focusRequirementIds: string[];
  /** Σ free over those lines, in `unit` */
  freeToLink: number;
  unit: string;
}

/** One target per open PO some of these requirements can be linked to — the soonest expected first */
export function poLinkTargets(reqs: readonly MaterialRequirement[]): POLinkTarget[] {
  const targets = new Map<string, { target: POLinkTarget; expected: string; free: Map<string, number> }>();
  for (const r of reqs) {
    for (const s of linkableSupply(r)) {
      let entry = targets.get(s.purchaseOrderId);
      if (!entry) {
        entry = {
          target: {
            poId: s.purchaseOrderId,
            poNumber: s.poNumber,
            itemIds: [],
            focusRequirementIds: [],
            freeToLink: 0,
            unit: r.unit,
          },
          expected: s.expectedDeliveryDate,
          free: new Map(),
        };
        targets.set(s.purchaseOrderId, entry);
      }
      const { target, free } = entry;
      if (!target.itemIds.includes(s.purchaseOrderItemId)) target.itemIds.push(s.purchaseOrderItemId);
      if (!target.focusRequirementIds.includes(r.id)) target.focusRequirementIds.push(r.id);
      free.set(s.purchaseOrderItemId, Math.max(free.get(s.purchaseOrderItemId) ?? 0, s.freeToLink));
    }
  }
  return [...targets.values()]
    .sort((a, b) => a.expected.localeCompare(b.expected) || a.target.poNumber.localeCompare(b.target.poNumber))
    .map(({ target, free }) => ({ ...target, freeToLink: sum([...free.values()]) }));
}

/** Waiting for a PO — the statuses a requirement can be linked or ordered from */
const waitingForPO = (r: Pick<MaterialRequirement, 'status'>) =>
  r.status === 'PO_REQUIRED' || r.status === 'PARTIAL_STOCK';

/**
 * A label's heading, "Open PO covers 5/6 sizes": of its size rows still waiting for a PO, how many an open PO
 * could be linked to. Null when none could — the heading then says nothing.
 */
export function openPOSizeCoverage(
  rows: readonly { requirements: readonly MaterialRequirement[] }[]
): { covered: number; waiting: number } | null {
  const waiting = rows.filter((row) => row.requirements.some(waitingForPO));
  const covered = waiting.filter((row) => row.requirements.some(hasLinkableSupply)).length;
  return covered > 0 ? { covered, waiting: waiting.length } : null;
}

/** "PO2609-0231 · 350 pcs" per PO these requirements are linked to — what each PO covers of them */
export function linkedPOTexts(reqs: readonly MaterialRequirement[], unit: string): string[] {
  const byPo = new Map<string, { poNumber: string; qty: number }>();
  for (const r of reqs) {
    for (const l of r.poLinks ?? []) {
      const poNumber = l.purchaseOrder?.poNumber ?? 'PO';
      const key = l.purchaseOrderId || poNumber;
      const entry = byPo.get(key) ?? { poNumber, qty: 0 };
      entry.qty = round3(entry.qty + Number(l.allocatedQuantity || 0));
      byPo.set(key, entry);
    }
  }
  return [...byPo.values()].map((p) => `${p.poNumber} · ${qty(p.qty, unit)}`);
}
