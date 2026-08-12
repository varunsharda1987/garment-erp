/**
 * Cutting Chart — data adapter for the kf cutting-chart template.
 * One root Prisma query on work_orders.
 *
 * The cutting floor's working sheet: what to lay, how wide, how many plies,
 * how many pieces per size — and blank hatched columns for what actually came
 * off the table. Internal only; no tax, no party GSTINs (see `hideGstin`).
 *
 * Field-set authority: document-generator.service `generateCuttingChartPDF`
 * (buyer/brand/style/style name/buyer ref, W/O number, order qty, cut qty at an
 * extra %, colour, size ratio + order + cut rows, per-part fabric with costing /
 * raw-material / production CAD widths and averages, fabric stock lots, max
 * cuttable pieces + bottleneck part, existing cutting batches).
 *
 * Deliberate differences from that generator, all stated in the report:
 *  - Colour: it takes (workOrderId, colorId) and prints ONE colour. This adapter
 *    takes a single id, so it prints EVERY colour in the work order breakup as
 *    its own lay grid plus a combined total — a superset, never a subset, and
 *    the honest shape for a sheet that goes to the table with the whole order.
 *  - `fabricOrdered` / `fabricReceived` / `extraShortage` are procurement
 *    reconciliation figures reached through materials → purchase_order_items →
 *    grn_items. They do not tell a cutter anything he can act on and would drag
 *    a four-level purchasing nest into a floor document, so they are dropped.
 *  - The style image is dropped: base.css has no image slot and the renderer's
 *    baseDir is templates/kf, so an /uploads path would not resolve.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import {
  addCurrency,
  divideCurrency,
  isZero,
  multiplyCurrency,
  subtractCurrency,
  toCurrency,
  Decimal,
} from '../../utils/currency';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtPct, fmtQty } from './format';

/**
 * House cutting allowance when nothing better is on record. Mirrors
 * generateCuttingChartPDF's `options.extraPercent ?? 1` — the same default the
 * pdfkit chart has always printed. Overridden by the real recorded allowance
 * (cutting_batch_skus.extraAllowed) as soon as a batch exists.
 */
const HOUSE_EXTRA_PERCENT = 1;

const cuttingChartInclude = {
  orders: {
    select: {
      orderNumber: true,
      expectedDeliveryDate: true,
      customers: { select: { name: true, brandNames: true } },
    },
  },
  styles: {
    select: {
      styleCode: true,
      styleName: true,
      buyerStyleRef: true,
      brandName: true,
      size_options: { select: { id: true, sizeName: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
      style_components: {
        orderBy: { sortOrder: 'asc' },
        select: {
          componentName: true,
          style_fabrics: {
            select: {
              fabricName: true,
              fabricColor: true,
              fabricGSM: true,
              cutableWidth: true,
              printDesign: true,
              colorMaster: { select: { colorName: true } },
              fabric: {
                select: {
                  fabricCode: true,
                  fabricName: true,
                  colorName: true,
                  printDesign: true,
                  finishType: true,
                  cutableWidth: true,
                  fabricStock: {
                    where: { quantityAvailable: { gt: 0 } },
                    orderBy: { receivedDate: 'desc' },
                    take: 8,
                    select: {
                      id: true,
                      rollNumbers: true,
                      cutableWidth: true,
                      quantityAvailable: true,
                      qualityGrade: true,
                    },
                  },
                },
              },
              cadRows: {
                select: {
                  purpose: true,
                  purposeEnum: true,
                  isPreferred: true,
                  cutableWidth: true,
                  widthUnit: true,
                  cadMeters: true,
                  cadAverage: true,
                  layerMarginMeters: true,
                  piecesPerMarker: true,
                  markerLengthMeters: true,
                  cadWastagePercent: true,
                  isCombinedCutting: true,
                  combinedComponents: true,
                  approvalStatus: true,
                  sizeBreakdowns: { select: { sizeName: true, quantity: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  work_order_breakup: {
    select: {
      plannedQuantity: true,
      completedQuantity: true,
      color_options: { select: { id: true, colorName: true, colorCode: true } },
      size_options: { select: { id: true, sizeName: true, sortOrder: true } },
    },
  },
  cutting_batches: {
    orderBy: { cuttingDate: 'asc' },
    select: {
      batchNumber: true,
      status: true,
      cuttingDate: true,
      actualFabricWidth: true,
      cadAverageUsed: true,
      layersPerLay: true,
      numberOfLays: true,
      fabricConsumed: true,
      fabricStock: { select: { rollNumbers: true } },
      skuOutputs: {
        select: { colorId: true, sizeId: true, orderQty: true, extraAllowed: true, toCut: true, cutQty: true },
      },
    },
  },
} satisfies Prisma.work_ordersInclude;

export type WorkOrderWithCuttingDetails = Prisma.work_ordersGetPayload<{ include: typeof cuttingChartInclude }>;

/** One lay grid — sizes across, plan rows down. Cells align to `sizes` index-for-index. */
export interface CuttingChartColourGrid {
  colour: string;
  ratio: string[];
  ratioTotal: string;
  orderQty: string[];
  extraQty: string[];
  toCut: string[];
  /** Recorded cut for THIS colour. null → nothing laid in it yet, so the row is hatched. */
  actualCut: string[] | null;
  orderTotal: string;
  extraTotal: string;
  toCutTotal: string;
  actualTotal: string | null;
}

/** A roll lot sitting against the part's fabric, printed under it in the marker table. */
export interface CuttingChartLotLine {
  rolls: string;
  width: string;
  available: string;
  grade: string;
}

export interface CuttingChartMarkerRow {
  part: string;
  fabric: string;
  fabricSubline: string | null;
  basis: string;
  width: string;
  markerLength: string;
  piecesPerMarker: string;
  cadAverage: string;
  plannedMeters: string;
  /** "XS 1 · S 2 · M 2 · L 1" — pieces of each size inside the marker */
  markerRatio: string | null;
  lots: CuttingChartLotLine[];
}

export interface CuttingChartLayRow {
  batch: string;
  date: string;
  rolls: string;
  width: string;
  plies: string;
  lays: string;
  consumed: string;
  cut: string;
  status: string;
}

export interface CuttingChartDocData {
  company: CompanyBlock;
  hideGstin: boolean;
  docNo: string;
  docPill: string;
  buyer: string | null;
  brand: string | null;
  styleLabel: string;
  styleName: string | null;
  orderRef: string | null;
  deliveryDate: string | null;
  plannedStart: string;
  plannedEnd: string;
  statusLabel: string;
  orderQtyLabel: string;
  cutQtyLabel: string;
  extraPctLabel: string;
  extraBasis: string;
  sizes: string[];
  grids: CuttingChartColourGrid[];
  sizeSource: string;
  markerRows: CuttingChartMarkerRow[];
  markerBanner: string;
  lotCount: number;
  lotsAvailable: string | null;
  maxCuttableLabel: string | null;
  bottleneckPart: string | null;
  layRows: CuttingChartLayRow[];
  alreadyCut: string | null;
}

type StyleFabric = WorkOrderWithCuttingDetails['styles']['style_components'][number]['style_fabrics'][number];
type CadRow = StyleFabric['cadRows'][number];

/** PRODUCTION beats RAW_MATERIAL_CALCULATION beats COSTING — the cutter works to the production marker. */
const CAD_PRIORITY: Record<string, number> = { PRODUCTION: 0, RAW_MATERIAL_CALCULATION: 1, COSTING: 2 };

function cadPurpose(cad: CadRow): string {
  return cad.purposeEnum ?? cad.purpose ?? 'COSTING';
}

function pickCad(cadRows: CadRow[]): CadRow | null {
  const usable = cadRows.filter((c) => c.cadAverage != null || c.cadMeters != null || !isZero(c.cutableWidth));
  if (usable.length === 0) return null;
  // Purpose first, then the width the planner marked preferred for this fabric.
  return [...usable].sort(
    (a, b) =>
      (CAD_PRIORITY[cadPurpose(a)] ?? 9) - (CAD_PRIORITY[cadPurpose(b)] ?? 9) ||
      Number(b.isPreferred) - Number(a.isPreferred)
  )[0];
}

/** "Production marker" / "Raw material calc" / "Costing" */
function basisLabel(cad: CadRow): string {
  const purpose = cadPurpose(cad);
  if (purpose === 'PRODUCTION') return 'Production';
  if (purpose === 'RAW_MATERIAL_CALCULATION') return 'Raw mat. calc';
  return 'Costing';
}

function fabricLabel(sf: StyleFabric): string {
  return sf.fabric?.fabricName ?? sf.fabricName ?? EM_DASH;
}

function fabricSubline(sf: StyleFabric): string | null {
  const bits: string[] = [];
  if (sf.fabric?.fabricCode) bits.push(sf.fabric.fabricCode);
  const colour = sf.colorMaster?.colorName ?? sf.fabricColor ?? sf.fabric?.colorName ?? null;
  if (colour) bits.push(colour);
  const print = sf.printDesign ?? sf.fabric?.printDesign ?? null;
  if (print) bits.push(print);
  if (sf.fabric?.finishType) bits.push(sf.fabric.finishType.replace(/_/g, ' ').toLowerCase());
  if (sf.fabricGSM) bits.push(`${sf.fabricGSM} gsm`);
  return bits.length > 0 ? bits.join(' · ') : null;
}

/** inches unless the CAD says otherwise; 0 means "not planned yet" and prints as an em-dash. */
function widthLabel(width: Prisma.Decimal | null, unit: string | null): string {
  if (width == null) return EM_DASH;
  const value = toCurrency(width);
  if (value.lte(0)) return EM_DASH;
  const suffix = unit && unit.toLowerCase().startsWith('cm') ? ' cm' : '"';
  // Widths read as 50" / 49.5", never 50.00" — trailing zeros cost column width here.
  return `${value.toNumber().toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
}

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function buildCuttingChartDocData(workOrderId: string): Promise<CuttingChartDocData> {
  const [company, workOrder] = await Promise.all([
    buildCompanyBlock(),
    prisma.work_orders.findUnique({ where: { id: workOrderId }, include: cuttingChartInclude }),
  ]);
  if (!workOrder) throw new NotFoundError('Work Order', workOrderId);
  return transformCuttingChart(company, workOrder);
}

/** Pure transform — split from the loader so previews/tests can exercise it with a fixture record. */
export function transformCuttingChart(
  company: CompanyBlock,
  workOrder: WorkOrderWithCuttingDetails
): CuttingChartDocData {
  const style = workOrder.styles;

  // ---- Extra allowance: what the floor actually booked, else the house default ----
  const allSkuOutputs = workOrder.cutting_batches.flatMap((b) => b.skuOutputs);
  let bookedOrder = toCurrency(0);
  let bookedExtra = toCurrency(0);
  for (const sku of allSkuOutputs) {
    bookedOrder = addCurrency(bookedOrder, sku.orderQty);
    bookedExtra = addCurrency(bookedExtra, sku.extraAllowed);
  }
  const hasBookedExtra = !isZero(bookedOrder);
  const extraPercent = hasBookedExtra
    ? multiplyCurrency(divideCurrency(bookedExtra, bookedOrder), 100)
    : toCurrency(HOUSE_EXTRA_PERCENT);
  const extraFactor = addCurrency(1, divideCurrency(extraPercent, 100));

  // ---- Recorded cut, by colour+size, from the cutting batches ----
  const cutBySku = new Map<string, ReturnType<typeof toCurrency>>();
  for (const sku of allSkuOutputs) {
    const key = `${sku.colorId ?? ''}|${sku.sizeId}`;
    cutBySku.set(key, addCurrency(cutBySku.get(key) ?? toCurrency(0), sku.cutQty));
  }

  // ---- Size columns: breakup sizes, falling back to the style's size set ----
  const breakup = workOrder.work_order_breakup;
  const sizeMeta = new Map<string, { name: string; sortOrder: number }>();
  for (const row of breakup) {
    if (!sizeMeta.has(row.size_options.id)) {
      sizeMeta.set(row.size_options.id, { name: row.size_options.sizeName, sortOrder: row.size_options.sortOrder });
    }
  }
  const usingStyleSizes = sizeMeta.size === 0;
  if (usingStyleSizes) {
    for (const size of style.size_options) {
      sizeMeta.set(size.id, { name: size.sizeName, sortOrder: size.sortOrder });
    }
  }
  const sizeIds = [...sizeMeta.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[1].name.localeCompare(b[1].name))
    .map(([id]) => id);
  const sizes = sizeIds.map((id) => sizeMeta.get(id)!.name);

  // ---- One lay grid per colour ----
  const NO_COLOUR = '';
  const colourGroups = new Map<
    string,
    { colour: string | null; planned: Map<string, ReturnType<typeof toCurrency>> }
  >();
  for (const row of breakup) {
    const key = row.color_options?.id ?? NO_COLOUR;
    let group = colourGroups.get(key);
    if (!group) {
      group = { colour: row.color_options?.colorName ?? null, planned: new Map() };
      colourGroups.set(key, group);
    }
    const previous = group.planned.get(row.size_options.id) ?? toCurrency(0);
    group.planned.set(row.size_options.id, addCurrency(previous, row.plannedQuantity));
  }
  if (colourGroups.size === 0) {
    // No breakup rows at all — a single hand-fill grid over the style's sizes.
    colourGroups.set(NO_COLOUR, { colour: null, planned: new Map() });
  }

  let plannedGrand = toCurrency(0);
  let toCutGrand = toCurrency(0);
  const grids: CuttingChartColourGrid[] = [...colourGroups.entries()].map(([colourId, group]) => {
    const groupTotal = sizeIds.reduce((acc, sizeId) => addCurrency(acc, group.planned.get(sizeId) ?? 0), toCurrency(0));

    const ratio: string[] = [];
    const orderQty: string[] = [];
    const extraQty: string[] = [];
    const toCut: string[] = [];
    const actualCut: string[] = [];
    let extraTotal = toCurrency(0);
    let toCutTotal = toCurrency(0);
    let actualTotal = toCurrency(0);
    let anyRecordedInColour = false;

    for (const sizeId of sizeIds) {
      const planned = group.planned.get(sizeId);
      if (planned === undefined) {
        // This size is not planned in this colour — blank, never a fake 0.
        ratio.push('');
        orderQty.push('');
        extraQty.push('');
        toCut.push('');
      } else {
        ratio.push(
          isZero(groupTotal) ? EM_DASH : fmtPct(multiplyCurrency(divideCurrency(planned, groupTotal), 100).toNumber())
        );
        // Whole garments only: the lay is rounded up, exactly as the pdfkit chart does.
        const cut = new Decimal(multiplyCurrency(planned, extraFactor).toString()).ceil();
        const extra = subtractCurrency(cut, planned);
        orderQty.push(fmtQty(planned.toNumber(), 'PCS'));
        extraQty.push(fmtQty(extra.toNumber(), 'PCS'));
        toCut.push(fmtQty(cut.toNumber(), 'PCS'));
        extraTotal = addCurrency(extraTotal, extra);
        toCutTotal = addCurrency(toCutTotal, cut);
      }
      const recorded = cutBySku.get(`${colourId}|${sizeId}`);
      if (recorded === undefined) {
        actualCut.push('');
      } else {
        anyRecordedInColour = true;
        actualCut.push(fmtQty(recorded.toNumber(), 'PCS'));
        actualTotal = addCurrency(actualTotal, recorded);
      }
    }

    plannedGrand = addCurrency(plannedGrand, groupTotal);
    toCutGrand = addCurrency(toCutGrand, toCutTotal);

    return {
      colour: group.colour ?? 'Colour not split',
      ratio,
      ratioTotal: isZero(groupTotal) ? EM_DASH : '100.0%',
      orderQty,
      extraQty,
      toCut,
      // Hatched unless THIS colour has been cut — a colour with no lay must not
      // print a 0 next to a colour that has genuinely produced zero pieces.
      actualCut: anyRecordedInColour ? actualCut : null,
      orderTotal: fmtQty(groupTotal.toNumber(), 'PCS'),
      extraTotal: fmtQty(extraTotal.toNumber(), 'PCS'),
      toCutTotal: fmtQty(toCutTotal.toNumber(), 'PCS'),
      actualTotal: anyRecordedInColour ? fmtQty(actualTotal.toNumber(), 'PCS') : null,
    };
  });

  // The work order header quantity is the authority when the breakup is silent.
  const headerQty = toCurrency(workOrder.totalQuantity);
  const plannedForCut = isZero(plannedGrand) ? headerQty : plannedGrand;
  const cutTarget = isZero(toCutGrand)
    ? new Decimal(multiplyCurrency(headerQty, extraFactor).toString()).ceil()
    : toCutGrand;

  // ---- Marker / CAD rows, one per component × fabric that has a CAD or a width ----
  const markerRows: CuttingChartMarkerRow[] = [];
  let lotCount = 0;
  const seenLotIds = new Set<string>();
  const availableByPart = new Map<string, ReturnType<typeof toCurrency>>();
  const cadAvgByPart = new Map<string, ReturnType<typeof toCurrency>>();
  let lotsAvailable = toCurrency(0);

  for (const component of style.style_components) {
    for (const sf of component.style_fabrics) {
      const cad = pickCad(sf.cadRows);
      const width = cad?.cutableWidth ?? sf.cutableWidth ?? sf.fabric?.cutableWidth ?? null;
      const hasLots = (sf.fabric?.fabricStock.length ?? 0) > 0;
      if (!cad && !hasLots) continue; // nothing planned and nothing in the room — no row to print

      const partName = component.componentName;
      const cadAverage = cad?.cadAverage != null ? toCurrency(cad.cadAverage) : null;
      const planned = cadAverage != null ? multiplyCurrency(cadAverage, cutTarget) : null;

      const markerRatio =
        cad && cad.sizeBreakdowns.length > 0
          ? cad.sizeBreakdowns.map((s) => `${s.sizeName} ${s.quantity}`).join(' · ')
          : null;

      // Roll lots sit with their fabric, not in a section of their own: the cutter
      // reads "this part, this fabric, these rolls" as one line.
      const lots: CuttingChartLotLine[] = [];
      for (const lot of sf.fabric?.fabricStock ?? []) {
        if (seenLotIds.has(lot.id)) continue; // the same fabric can hang off two components
        seenLotIds.add(lot.id);
        lotCount += 1;
        const qty = toCurrency(lot.quantityAvailable);
        lotsAvailable = addCurrency(lotsAvailable, qty);
        availableByPart.set(partName, addCurrency(availableByPart.get(partName) ?? 0, qty));
        lots.push({
          rolls: lot.rollNumbers && lot.rollNumbers.trim().length > 0 ? lot.rollNumbers : EM_DASH,
          width: widthLabel(lot.cutableWidth, 'inches'),
          available: fmtQty(qty.toNumber(), 'MTR'),
          grade: lot.qualityGrade,
        });
      }

      markerRows.push({
        part: cad?.isCombinedCutting && cad.combinedComponents ? `${partName} + ${cad.combinedComponents}` : partName,
        fabric: fabricLabel(sf),
        fabricSubline: fabricSubline(sf),
        basis: cad ? basisLabel(cad) : 'Stock only',
        width: widthLabel(width, cad?.widthUnit ?? null),
        markerLength:
          cad?.markerLengthMeters != null
            ? fmtQty(toCurrency(cad.markerLengthMeters).toNumber(), 'MTR')
            : cad?.cadMeters != null
              ? fmtQty(toCurrency(cad.cadMeters).toNumber(), 'MTR')
              : EM_DASH,
        piecesPerMarker: cad?.piecesPerMarker != null ? fmtQty(cad.piecesPerMarker, 'PCS') : EM_DASH,
        cadAverage:
          cadAverage != null
            ? cadAverage.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
            : EM_DASH,
        plannedMeters: planned != null ? fmtQty(planned.toNumber(), 'MTR') : EM_DASH,
        markerRatio,
        lots,
      });

      if (cadAverage != null && cadAverage.gt(0) && !cadAvgByPart.has(partName)) {
        cadAvgByPart.set(partName, cadAverage);
      }
    }
  }

  // ---- Max cuttable from what is physically in the room, per part; the worst part rules ----
  let maxCuttable: Decimal | null = null;
  let bottleneckPart: string | null = null;
  for (const [part, cadAverage] of cadAvgByPart) {
    const available = availableByPart.get(part);
    if (available === undefined || available.lte(0)) continue;
    const pcs = new Decimal(divideCurrency(available, cadAverage).toString()).floor();
    if (maxCuttable === null || pcs.lt(maxCuttable)) {
      maxCuttable = pcs;
      bottleneckPart = part;
    }
  }

  // ---- Lays already recorded ----
  const layRows: CuttingChartLayRow[] = workOrder.cutting_batches.map((batch) => {
    const cut = batch.skuOutputs.reduce((acc, s) => addCurrency(acc, s.cutQty), toCurrency(0));
    return {
      batch: batch.batchNumber,
      date: fmtDate(batch.cuttingDate),
      rolls:
        batch.fabricStock.rollNumbers && batch.fabricStock.rollNumbers.trim().length > 0
          ? batch.fabricStock.rollNumbers
          : EM_DASH,
      width: widthLabel(batch.actualFabricWidth, 'inches'),
      plies: fmtQty(batch.layersPerLay, 'PCS'),
      lays: fmtQty(batch.numberOfLays, 'PCS'),
      consumed: fmtQty(toCurrency(batch.fabricConsumed).toNumber(), 'MTR'),
      cut: fmtQty(cut.toNumber(), 'PCS'),
      status: humanise(batch.status),
    };
  });
  const alreadyCutQty = workOrder.cutting_batches.reduce(
    (acc, b) =>
      addCurrency(
        acc,
        b.skuOutputs.reduce((inner, s) => addCurrency(inner, s.cutQty), toCurrency(0))
      ),
    toCurrency(0)
  );

  const buyer = workOrder.orders?.customers?.name ?? null;
  const brand = style.brandName ?? workOrder.orders?.customers?.brandNames ?? null;

  return {
    company,
    hideGstin: true,
    docNo: workOrder.workOrderNumber,
    docPill: 'Cutting floor · Internal',
    buyer,
    brand: brand && brand.trim().length > 0 ? brand.split('\n')[0].trim() : null,
    styleLabel: formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef),
    // Many styles are named after their own code — printing "LNG211 · LNG211" says nothing.
    styleName: style.styleName === style.styleCode ? null : style.styleName,
    orderRef: workOrder.orders?.orderNumber ?? null,
    deliveryDate: workOrder.orders?.expectedDeliveryDate ? fmtDate(workOrder.orders.expectedDeliveryDate) : null,
    plannedStart: fmtDate(workOrder.plannedStartDate),
    plannedEnd: fmtDate(workOrder.plannedEndDate),
    statusLabel: humanise(workOrder.status),
    orderQtyLabel: fmtQty(plannedForCut.toNumber(), 'PCS'),
    cutQtyLabel: fmtQty(cutTarget.toNumber(), 'PCS'),
    extraPctLabel: fmtPct(extraPercent.toNumber()),
    extraBasis: hasBookedExtra
      ? 'Booked on the cutting batches for this order'
      : 'House allowance — no per-order extra is held against a work order',
    sizes,
    grids,
    sizeSource: usingStyleSizes
      ? 'Size set taken from the style — this work order has no size breakup yet'
      : 'Size breakup of this work order',
    markerRows,
    markerBanner:
      markerRows.length > 0 ? `${markerRows.length} part${markerRows.length === 1 ? '' : 's'}` : 'Not planned',
    lotCount,
    lotsAvailable: lotCount > 0 ? fmtQty(lotsAvailable.toNumber(), 'MTR') : null,
    maxCuttableLabel: maxCuttable != null ? fmtQty(maxCuttable.toNumber(), 'PCS') : null,
    bottleneckPart,
    layRows,
    alreadyCut: layRows.length > 0 ? fmtQty(alreadyCutQty.toNumber(), 'PCS') : null,
  };
}
