/**
 * Transfer Slip — data adapter for the kf transfer-slip template.
 * One root Prisma query on transfer_slips.
 *
 * This is an INTERNAL movement note (cutting → stitching → finishing …).
 * Nothing here is a supply: no GST, no party GSTINs, no values. The document
 * suppresses tax the way challan.hbs does — a flag plus a callout — and goes
 * one step further by hiding the masthead GSTIN line entirely (`hideGstin`),
 * because an inter-department note has no tax identity at all.
 *
 * Field-set authority: document-generator.service `drawTransferSlipPage`
 * (slipNumber, transferDate, status, from/to department, work order, style,
 * cutting batch, issued-to, colour/size SKU rows + total, remarks,
 * prepared-by / received-by). Everything it printed is printed here; the
 * SKU list is re-cut as a sizes-across grid so the floor can tick counts.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { addCurrency, toCurrency } from '../../utils/currency';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtQty } from './format';

const transferSlipDocInclude = {
  workOrder: {
    select: {
      workOrderNumber: true,
      totalQuantity: true,
      styles: { select: { styleCode: true, styleName: true, buyerStyleRef: true, brandName: true } },
      orders: { select: { orderNumber: true, customers: { select: { name: true } } } },
    },
  },
  component: { select: { componentName: true, componentType: true } },
  cuttingBatch: { select: { batchNumber: true, cuttingDate: true, status: true } },
  skuBreakdown: {
    include: {
      color: { select: { id: true, colorName: true, colorCode: true } },
      size: { select: { id: true, sizeName: true, sortOrder: true } },
    },
  },
  issuedTo: { select: { name: true } },
  preparedBy: { select: { firstName: true, lastName: true } },
  receivedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.transfer_slipsInclude;

export type TransferSlipWithDetails = Prisma.transfer_slipsGetPayload<{ include: typeof transferSlipDocInclude }>;

/** One colour of the consignment: issued counts per size column + its hatched counter-row. */
export interface TransferSlipColourRow {
  colour: string;
  /** One cell per entry of `sizes`, in the same order. Blank string where that size is not in this transfer. */
  cells: string[];
  total: string;
}

export interface TransferSlipDocData {
  company: CompanyBlock;
  /** mast partial: an internal note carries no GSTIN */
  hideGstin: boolean;
  docNo: string;
  docPill: string;
  movementBanner: string;
  fromLabel: string;
  toLabel: string;
  transferDate: string;
  statusLabel: string;
  workOrderNumber: string;
  styleLabel: string;
  styleName: string | null;
  componentLabel: string | null;
  batchLabel: string | null;
  issuedToName: string | null;
  orderRef: string | null;
  preparedByName: string;
  receivedByName: string | null;
  receivedDate: string | null;
  remarks: string | null;
  sizes: string[];
  colourRows: TransferSlipColourRow[];
  /** Column totals across every colour, aligned to `sizes` */
  sizeTotals: string[];
  issuedTotal: string;
  /** transfer_slips.totalGoodPieces — the header count, shown against the line sum */
  declaredTotal: string;
  countsAgree: boolean;
}

function userName(user: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name.length > 0 ? name : null;
}

/** "DEVIATION_RECORDED" → "Deviation recorded" */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "Cutting · Stitching" style stage/department pair, de-duplicated when they are the same word. */
function placeLabel(department: string, stage: string): string {
  const dept = department.trim();
  const stageLabel = humanise(stage);
  if (!dept) return stageLabel;
  if (dept.toLowerCase() === stageLabel.toLowerCase()) return dept;
  return `${dept} · ${stageLabel}`;
}

export async function buildTransferSlipDocData(slipId: string): Promise<TransferSlipDocData> {
  const [company, slip] = await Promise.all([
    buildCompanyBlock(),
    prisma.transfer_slips.findUnique({ where: { id: slipId }, include: transferSlipDocInclude }),
  ]);
  if (!slip) throw new NotFoundError('Transfer Slip', slipId);
  return transformTransferSlip(company, slip);
}

/** Pure transform — split from the loader so previews/tests can exercise it with a fixture record. */
export function transformTransferSlip(company: CompanyBlock, slip: TransferSlipWithDetails): TransferSlipDocData {
  // ---- Size columns: every size in the consignment, in the style's own sort order ----
  const sizeOrder = new Map<string, { name: string; sortOrder: number }>();
  for (const sku of slip.skuBreakdown) {
    if (!sku.size) continue; // sizeId with no size_options row — cannot be labelled, so it cannot own a column
    if (!sizeOrder.has(sku.size.id)) {
      sizeOrder.set(sku.size.id, { name: sku.size.sizeName, sortOrder: sku.size.sortOrder });
    }
  }
  const sizeIds = [...sizeOrder.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);
  const sizes = sizeIds.map((id) => sizeOrder.get(id)!.name);

  // ---- Rows: one per colour (null colour collapses to a single unnamed row) ----
  const NO_COLOUR = '\u0000';
  const colourGroups = new Map<string, { colour: string | null; bySize: Map<string, ReturnType<typeof toCurrency>> }>();
  for (const sku of slip.skuBreakdown) {
    if (!sku.size) continue;
    const key = sku.color?.id ?? NO_COLOUR;
    let group = colourGroups.get(key);
    if (!group) {
      group = { colour: sku.color?.colorName ?? null, bySize: new Map() };
      colourGroups.set(key, group);
    }
    const previous = group.bySize.get(sku.size.id) ?? toCurrency(0);
    group.bySize.set(sku.size.id, addCurrency(previous, sku.quantity));
  }

  const sizeTotalsAcc = sizeIds.map(() => toCurrency(0));
  let issuedTotal = toCurrency(0);
  const colourRows: TransferSlipColourRow[] = [...colourGroups.values()].map((group) => {
    let rowTotal = toCurrency(0);
    const cells = sizeIds.map((sizeId, idx) => {
      const qty = group.bySize.get(sizeId);
      if (qty === undefined) return ''; // this colour is not cut in this size — blank, never a fake 0
      rowTotal = addCurrency(rowTotal, qty);
      sizeTotalsAcc[idx] = addCurrency(sizeTotalsAcc[idx], qty);
      return fmtQty(qty.toNumber(), 'PCS');
    });
    issuedTotal = addCurrency(issuedTotal, rowTotal);
    return {
      colour: group.colour ?? 'Pieces',
      cells,
      total: fmtQty(rowTotal.toNumber(), 'PCS'),
    };
  });

  const declared = toCurrency(slip.totalGoodPieces);
  const style = slip.workOrder.styles;

  return {
    company,
    hideGstin: true,
    docNo: slip.slipNumber,
    docPill: 'Internal movement · Not a supply',
    movementBanner: `${humanise(slip.fromStage)} → ${humanise(slip.toStage)}`,
    fromLabel: placeLabel(slip.fromDepartment, slip.fromStage),
    toLabel: placeLabel(slip.toDepartment, slip.toStage),
    transferDate: fmtDate(slip.transferDate),
    statusLabel: humanise(slip.status),
    workOrderNumber: slip.workOrder.workOrderNumber,
    styleLabel: formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef),
    styleName: style.styleName,
    componentLabel: slip.component
      ? slip.component.componentType && slip.component.componentType !== slip.component.componentName
        ? `${slip.component.componentName} · ${slip.component.componentType}`
        : slip.component.componentName
      : null,
    batchLabel: slip.cuttingBatch
      ? `${slip.cuttingBatch.batchNumber} · cut ${fmtDate(slip.cuttingBatch.cuttingDate)}`
      : null,
    issuedToName: slip.issuedTo?.name ?? null,
    orderRef: slip.workOrder.orders
      ? `${slip.workOrder.orders.orderNumber}${
          slip.workOrder.orders.customers ? ` · ${slip.workOrder.orders.customers.name}` : ''
        }`
      : null,
    preparedByName: userName(slip.preparedBy) ?? EM_DASH,
    receivedByName: userName(slip.receivedBy),
    receivedDate: slip.receivedDate ? fmtDate(slip.receivedDate) : null,
    remarks: slip.remarks,
    sizes,
    colourRows,
    sizeTotals: sizeTotalsAcc.map((t) => fmtQty(t.toNumber(), 'PCS')),
    issuedTotal: fmtQty(issuedTotal.toNumber(), 'PCS'),
    declaredTotal: fmtQty(declared.toNumber(), 'PCS'),
    countsAgree: declared.equals(issuedTotal),
  };
}
