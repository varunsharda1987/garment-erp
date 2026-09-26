/**
 * The ship-to places of a purchase order, for the PO print and the one-page Delivery Instruction
 * (direct-to-processor plan, Phase 3, 2026-09-26). One source for both documents.
 *
 * A PO delivers to one place, to several (a split — po_delivery_points, each with its share of each
 * line), or is "to be advised". Every place prints its name, address and GSTIN:
 *  - our own store: its own address, else our Company Profile address (po-deliver-to.ts), our GSTIN;
 *  - a processor's unit: its own address, else the processor's shipping (else billing) address as the
 *    supplier master holds it, and the processor's GSTIN — never ours, which would send the goods to us.
 * A processor place carries the job-work note: the goods stay ours, and the supplier invoices us.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { fmtDate, fmtQty } from './format';
import { unitHeader } from '../../utils/units';
import { resolvePoDeliverTo, TO_BE_ADVISED_LINE } from './po-deliver-to';
import { PRE_SEND_STATUSES } from '../helpers/po-delivery-plan.helper';

/** Printed under every processor place. The CA confirms the wording (plan decision 7). */
export const JOB_WORK_SHIP_TO_NOTE =
  'Job work on our account — the goods remain our property. Invoice us, not the processor.';

export const ONE_INVOICE_PER_DELIVERY =
  'One tax invoice and one e-way bill per delivery — each billed to us and shipped to that place.';

const WAREHOUSE_SELECT = {
  warehouseName: true,
  warehouseType: true,
  address: true,
  city: true,
  pincode: true,
  supplier: {
    select: {
      name: true,
      address: true,
      billingPincode: true,
      shippingAddress: true,
      shippingPincode: true,
      billing_city: { select: { cityName: true } },
      shipping_city: { select: { cityName: true } },
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  },
} as const satisfies Prisma.warehousesSelect;

type ShipToWarehouse = Prisma.warehousesGetPayload<{ select: typeof WAREHOUSE_SELECT }>;

export interface PoShipToLine {
  name: string;
  code: string | null;
  qty: string;
  uom: string;
}

export interface PoShipTo {
  seq: number;
  name: string;
  address: string | null;
  gstin: string | null;
  isProcessor: boolean;
  processorName: string | null;
  lines: PoShipToLine[];
}

export interface PoShipToPlan {
  mode: 'TO_BE_ADVISED' | 'ONE_PLACE' | 'SPLIT';
  shipTos: PoShipTo[];
  /** 0 = the original; N = changes to the delivery made after the PO was sent. */
  amendmentNo: number;
  amendmentDate: string | null;
  amendmentReason: string | null;
  toBeAdvisedLine: string;
}

function processorAddress(wh: ShipToWarehouse): string[] {
  const s = wh.supplier;
  if (!s) return [];
  const ship = [
    s.shippingAddress,
    [s.shipping_city?.cityName, s.shippingPincode].filter((b) => (b ?? '').trim()).join(' '),
  ];
  const bill = [s.address, [s.billing_city?.cityName, s.billingPincode].filter((b) => (b ?? '').trim()).join(' ')];
  const clean = (bits: Array<string | null | undefined>) =>
    bits.map((b) => (b ?? '').trim()).filter((b) => b.length > 0);
  return (s.shippingAddress ?? '').trim() ? clean(ship) : clean(bill);
}

function shipToFor(
  seq: number,
  wh: ShipToWarehouse,
  lines: PoShipToLine[],
  company: { addressLine: string; gstin: string | null }
): PoShipTo {
  const isProcessor = wh.warehouseType === 'JOB_WORK';
  const place = resolvePoDeliverTo(wh, company.addressLine);
  const addressLines = place.addressLines.length > 0 ? place.addressLines : isProcessor ? processorAddress(wh) : [];
  return {
    seq,
    name: wh.warehouseName,
    address: addressLines.length > 0 ? addressLines.join(', ') : null,
    gstin: isProcessor ? (wh.supplier?.gst_numbers[0]?.gstNumber ?? null) : company.gstin,
    isProcessor,
    processorName: isProcessor ? (wh.supplier?.name ?? null) : null,
    lines,
  };
}

/** The places a PO delivers to, with each one's quantities, and its amendment count. */
export async function loadPoShipToPlan(
  poId: string,
  company: { addressLine: string; gstin: string | null }
): Promise<PoShipToPlan> {
  const po = await prisma.purchase_orders.findUniqueOrThrow({
    where: { id: poId },
    select: {
      deliveryWarehouse: { select: WAREHOUSE_SELECT },
      purchase_order_items: {
        select: {
          id: true,
          orderedQuantity: true,
          unit: true,
          serviceDescription: true,
          materials: { select: { name: true, code: true } },
        },
      },
      deliveryPoints: {
        orderBy: { sequence: 'asc' },
        select: {
          sequence: true,
          warehouse: { select: WAREHOUSE_SELECT },
          lines: { select: { poItemId: true, quantity: true } },
        },
      },
      deliveryPlanRevisions: {
        where: { poStatus: { notIn: [...PRE_SEND_STATUSES] } },
        orderBy: { revisionNumber: 'desc' },
        select: { changedAt: true, reason: true },
      },
    },
  });

  const lineOf = (poItemId: string, quantity: number): PoShipToLine | null => {
    const item = po.purchase_order_items.find((i) => i.id === poItemId);
    if (!item) return null;
    return {
      name: item.materials?.name ?? item.serviceDescription ?? '—',
      code: item.materials?.code ?? null,
      qty: fmtQty(quantity, item.unit),
      uom: unitHeader(item.unit),
    };
  };

  let mode: PoShipToPlan['mode'] = 'TO_BE_ADVISED';
  let shipTos: PoShipTo[] = [];
  if (po.deliveryPoints.length > 0) {
    mode = 'SPLIT';
    shipTos = po.deliveryPoints.map((p) =>
      shipToFor(
        p.sequence,
        p.warehouse,
        p.lines.map((l) => lineOf(l.poItemId, Number(l.quantity))).filter((l): l is PoShipToLine => !!l),
        company
      )
    );
  } else if (po.deliveryWarehouse) {
    mode = 'ONE_PLACE';
    shipTos = [
      shipToFor(
        1,
        po.deliveryWarehouse,
        po.purchase_order_items
          .map((i) => lineOf(i.id, Number(i.orderedQuantity)))
          .filter((l): l is PoShipToLine => !!l),
        company
      ),
    ];
  }

  const latest = po.deliveryPlanRevisions[0] ?? null;
  return {
    mode,
    shipTos,
    amendmentNo: po.deliveryPlanRevisions.length,
    amendmentDate: latest ? fmtDate(latest.changedAt) : null,
    amendmentReason: latest?.reason ?? null,
    toBeAdvisedLine: TO_BE_ADVISED_LINE,
  };
}
