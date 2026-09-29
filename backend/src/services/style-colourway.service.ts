/**
 * Create Colourway — copy a style into a new colour (owner, 2026-09-29).
 *
 * A colourway is its OWN style: one colour per style (`styles.colorId`, mirrored into `color_options` by
 * style-colour.helper). Easybuy gives each colour its own buyer code (GEMINI: SP27DR46 Rust / SP27DR47
 * Black), and until now the team re-made the whole style for every colour ("SP27CK130 — there is no easy
 * way to copy the style and just change the colour"). This copies a style in ONE transaction and links the
 * copies: `styles.colourwayOfStyleId` points at the FIRST style of the group, so a copy of a copy joins
 * the same group.
 *
 * WHAT A COLOURWAY TAKES (owner, 29-Sep):
 *  - the design: components, fabrics (+ pattern parts), processes, trims BOM (quantity, price, wastage),
 *    sizes, tech spec, sketches. A fabric in the style's colour takes the NEW colour; any other fabric
 *    (a contrast, a print) is copied as it is. Trims keep their item — a colour-matched trim is swapped
 *    afterwards in Edit Style.
 *  - the CAD work: every row except Production, with its sizes, pattern parts and marker image, back to
 *    PENDING. The marker does not change with the colour; approving it is a person's call for the new style.
 *  - NOT the costing (the dyeing rate can change with the shade), nor a Production CAD (one lot's marker),
 *    cost sheets, costing runs, CAD corrections, samples, lab work, orders, stock, comments or the photo.
 *
 * Every column of `styles` / `style_fabrics` / `fabric_width_cad` is decided below ('carry' or 'fresh');
 * the `satisfies` makes a new column a type error until someone decides what a colourway does with it.
 */

import { Prisma, styles, style_fabrics, fabric_width_cad } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logWarn } from '../utils/logger';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { styleCodeLabel } from '../utils/style-code';
import { styleService } from './style.service';
import { syncStyleColourway } from './helpers/style-colour.helper';
import { buyerStyleCodeOwner, buyerStyleCodeTakenMessage } from './helpers/buyer-style-code.helper';
import { cadRowsOfStyle, recomputeStyleCadStatus } from './helpers/cad-status.helper';
import { copyCadChildren } from './helpers/cad-copy.helper';
import { copyMarkerImage } from './helpers/cad-marker.helper';
import { cadSnapshot, EMPTY_CAD_SNAPSHOT, recordCadEdit } from './helpers/cad-history.helper';
import { lineUnit, loadLineUnits } from './helpers/material-unit.helper';

type Tx = Prisma.TransactionClient;
type Decision = 'carry' | 'fresh';

// ---------------------------------------------------------------------------
// What a colourway does with each column
// ---------------------------------------------------------------------------

/** styles — 'fresh' columns are set in copyStyleTx or left to their default. */
export const STYLE_COLUMNS = {
  // identity of the NEW style
  id: 'fresh',
  styleCode: 'fresh',
  styleName: 'fresh',
  buyerStyleRef: 'fresh',
  internalCode: 'fresh',
  accountingSKU: 'fresh', // one style's own SKU in Tally
  colorId: 'fresh',
  colourwayOfStyleId: 'fresh',
  createdById: 'fresh',
  createdAt: 'fresh',
  updatedAt: 'fresh',
  isActive: 'fresh',
  // the photo shows the old colour
  image: 'fresh',
  imageUrl: 'fresh',
  // derived from the copied CAD rows (recomputeStyleCadStatus)
  cadStatus: 'fresh',
  approvedCadDate: 'fresh',
  // the style's definition
  status: 'carry',
  categoryId: 'carry',
  brandCategoryId: 'carry',
  productCategoryId: 'carry',
  gender: 'carry',
  ageGroup: 'carry',
  description: 'carry',
  specifications: 'carry',
  costPrice: 'carry',
  sellingPrice: 'carry',
  brandName: 'carry',
  customerId: 'carry',
  customerName: 'carry',
  season: 'carry',
  seasonId: 'carry',
  projectGroup: 'carry',
  bulletPoints: 'carry',
  accountingUnit: 'carry',
  hsnCode: 'carry',
  productTaxRule: 'carry',
  numberOfComponents: 'carry',
  expectedOrderQuantity: 'carry',
  customerAccessoriesPresetId: 'carry',
  customerSizePresetId: 'carry',
} as const satisfies Record<keyof styles, Decision>;

/** style_fabrics — a fabric in the style's colour is recoloured on top of this (see copyFabric). */
export const FABRIC_COLUMNS = {
  id: 'fresh',
  componentId: 'fresh',
  fabricCADId: 'fresh', // remapped to the copied CAD row once it exists
  createdAt: 'fresh',
  updatedAt: 'fresh',
  // prices of the dyed / printed fabric — costing starts fresh (the rate can change with the shade)
  unitPrice: 'fresh',
  fabricCostPerMeter: 'fresh',
  totalCostPerMeter: 'fresh',
  // the fabric itself
  fabricId: 'carry', // cleared when recoloured: that finished fabric is the old colour
  fabricFinishType: 'carry',
  fabricType: 'carry',
  fabricName: 'carry',
  fabricColor: 'carry',
  colorMasterId: 'carry',
  printDesign: 'carry',
  numberOfColors: 'carry',
  fabricGSM: 'carry',
  greigeName: 'carry',
  genericGreigeName: 'carry',
  selectedGreigeId: 'carry',
  supplierName: 'carry',
  quantityNeeded: 'carry',
  notes: 'carry',
  hasEmbroidery: 'carry',
  embroideryId: 'carry',
  embroideryCostPerMeter: 'carry', // the same design costs the same in any colour
  // CAD grouping (the CAD rows are copied too)
  cadGroupKey: 'carry',
  cadAverageMeters: 'carry',
  cadAverageYards: 'carry',
  cutableWidth: 'carry',
  allowCombinedCutting: 'carry',
  averagingMode: 'carry',
  migrationStatus: 'carry',
} as const satisfies Record<keyof style_fabrics, Decision>;

/**
 * fabric_width_cad — CAD Planning's marker is carried; Fabric Costing's columns and every approval,
 * lock, lot, version and variance are fresh (CLAUDE.md "Fabric Costing IS the CAD row").
 */
export const CAD_COLUMNS = {
  // the marker (a superset of cadMarkerFields in cad-copy.helper)
  fabricId: 'carry', // cleared when its fabric was recoloured
  cutableWidth: 'carry',
  widthUnit: 'carry',
  cadMeters: 'carry',
  cadYards: 'carry',
  cadAverage: 'carry',
  cadWastagePercent: 'carry',
  markerEfficiency: 'carry',
  markerLengthMeters: 'carry',
  piecesPerMarker: 'carry',
  layerMarginMeters: 'carry',
  printDirection: 'carry',
  planningCadWidth: 'carry',
  greigeId: 'carry',
  componentName: 'carry',
  patternPartId: 'carry',
  isEmbroidery: 'carry',
  isPreferred: 'carry',
  isCombinedCutting: 'carry',
  combinedComponents: 'carry',
  purpose: 'carry',
  purposeEnum: 'carry',
  // the values were saved against the same image with this reason — it still holds
  markerOverrideReason: 'carry',
  markerOverrideById: 'carry',
  markerOverrideAt: 'carry',
  markerOverrideDifferences: 'carry',
  // identity and links of the NEW row
  id: 'fresh',
  styleFabricId: 'fresh', // remapped
  costingStyleId: 'fresh', // the new style when the source row had one
  combinedFabricIds: 'fresh', // remapped
  copiedFromId: 'fresh',
  notes: 'fresh',
  createdById: 'fresh',
  createdAt: 'fresh',
  updatedAt: 'fresh',
  version: 'fresh',
  supersededById: 'fresh',
  clonedFromCadId: 'fresh',
  clonedFromOrderId: 'fresh',
  markerPlanFile: 'fresh', // retired; the image is copied by copyMarkerImage
  // CAD approval, lock, lot — a colourway's CAD is approved again
  approvalStatus: 'fresh',
  approvalNotes: 'fresh',
  approvedAt: 'fresh',
  approvedBy: 'fresh',
  rejectedAt: 'fresh',
  rejectedBy: 'fresh',
  autoApprovedFrom: 'fresh',
  isLocked: 'fresh',
  lockedAt: 'fresh',
  lockedReason: 'fresh',
  fabricStockId: 'fresh',
  procurementId: 'fresh',
  styleCostingId: 'fresh',
  // actuals and variance belong to the rows that were cut
  actualCad: 'fresh',
  cadVariancePercent: 'fresh',
  variancePercent: 'fresh',
  widthVariance: 'fresh',
  varianceApprovalNotes: 'fresh',
  varianceApprovalStatus: 'fresh',
  varianceApprovedAt: 'fresh',
  varianceApprovedById: 'fresh',
  // Fabric Costing — never copied
  totalCostPerMeter: 'fresh',
  greigeCostPerMeter: 'fresh',
  greigeRateManualOverride: 'fresh',
  greigeRateOverrideReason: 'fresh',
  greigeRateSource: 'fresh',
  greigeRateSourceDate: 'fresh',
  greigeRateSourceRef: 'fresh',
  greigeRateSetById: 'fresh',
  processingPricePerMeter: 'fresh',
  transportCostPerMeter: 'fresh',
  shrinkagePercent: 'fresh',
  shrinkageCostPerMeter: 'fresh',
  screenCostPerMeter: 'fresh',
  screenType: 'fresh',
  numberOfColors: 'fresh',
  costInputMode: 'fresh',
  processorId: 'fresh',
  rateCardId: 'fresh',
  orderQuantityPcs: 'fresh',
  costedAtQuantityMeters: 'fresh',
  costedRateIsBatch: 'fresh',
  processingBatchGroupColorId: 'fresh',
  costingRunId: 'fresh',
  costingApprovalStatus: 'fresh',
  costingApprovedAt: 'fresh',
  costingApprovedBy: 'fresh',
  supplierAvailability: 'fresh',
  priceDifferential: 'fresh',
} as const satisfies Record<keyof fabric_width_cad, Decision>;

/** The 'carry' columns of a row (a row read with relations keeps them out: only the map's keys are read). */
function carried<K extends string, T extends Record<K, unknown>>(
  row: T,
  columns: Record<K, Decision>
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of Object.keys(columns) as K[]) {
    if (columns[key] === 'carry') out[key] = row[key];
  }
  return out;
}

/** Photos show the garment in its old colour; sketches, flats and construction images do not. */
const PHOTO_IMAGE_TYPES = ['MAIN', 'DETAIL_VIEW'] as const;

/**
 * The CAD rows a colourway copies: every row but Production (one lot's marker), rejected rows, and
 * versions a newer row has superseded. All copies start PENDING, so two source rows that differ only in
 * their approval would collide on the row's unique key — the better one is kept (approved first).
 */
export function pickCadRowsToCopy<
  R extends Pick<
    fabric_width_cad,
    | 'id'
    | 'purpose'
    | 'purposeEnum'
    | 'approvalStatus'
    | 'supersededById'
    | 'costingStyleId'
    | 'componentName'
    | 'styleFabricId'
    | 'cutableWidth'
    | 'updatedAt'
  >,
>(rows: R[]): R[] {
  const superseded = new Set(rows.map((r) => r.supersededById).filter((id): id is string => !!id));
  const rank = (r: R): number =>
    r.approvalStatus === 'APPROVED' ? 0 : r.approvalStatus === 'ALTERNATE_APPROVED' ? 1 : 2;
  const byKey = new Map<string, R>();
  for (const row of rows) {
    const purpose = row.purposeEnum ?? row.purpose;
    if (purpose === 'PRODUCTION' || row.approvalStatus === 'REJECTED' || superseded.has(row.id)) continue;
    const key = [
      row.costingStyleId ? 'style' : '-',
      row.componentName ?? '',
      row.styleFabricId ?? '',
      String(row.cutableWidth),
      purpose ?? '',
    ].join('|');
    const kept = byKey.get(key);
    if (!kept || rank(row) < rank(kept) || (rank(row) === rank(kept) && row.updatedAt > kept.updatedAt)) {
      byKey.set(key, row);
    }
  }
  const keep = new Set(byKey.values());
  return rows.filter((r) => keep.has(r));
}

/** A combined-cutting row's fabric list (JSON array of style_fabrics ids) in the new style's ids. */
function remapCombinedFabricIds(json: string | null, fabricIdMap: ReadonlyMap<string, string>): string | null {
  if (!json) return null;
  try {
    const ids: unknown = JSON.parse(json);
    if (!Array.isArray(ids)) return null;
    const mapped = ids
      .map((id) => (typeof id === 'string' ? fabricIdMap.get(id) : undefined))
      .filter((id): id is string => !!id);
    return mapped.length > 0 ? JSON.stringify(mapped) : null;
  } catch {
    return null; // unparseable — the source row's own list is not usable either
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateColourwayInput {
  colorId: string;
  buyerStyleRef?: string | null;
  styleName?: string | null;
}

export interface ColourwayCreated {
  id: string;
  styleCode: string;
  buyerStyleRef: string | null;
  styleName: string;
  colourName: string;
  copied: { fabrics: number; recolouredFabrics: number; trims: number; sizes: number; cadRows: number };
}

/** Raised inside the transaction so the caller can mint another code and try again. */
class StyleCodeTaken extends Error {}

export async function createColourway(
  sourceId: string,
  input: CreateColourwayInput,
  userId: string
): Promise<ColourwayCreated> {
  const source = await prisma.styles.findUnique({ where: { id: sourceId } });
  if (!source) throw new NotFoundError('Style', sourceId);
  if (!source.isActive) {
    throw new BusinessError(`${styleCodeLabel(source)} is archived — restore it before making a colourway of it.`);
  }

  const colour = await prisma.color_master.findUnique({
    where: { id: input.colorId },
    select: { id: true, colorName: true },
  });
  if (!colour) throw new ValidationError('The colour picked is not in the colour master.');
  if (source.colorId === colour.id) {
    throw new ValidationError(
      `${styleCodeLabel(source)} is already ${colour.colorName}. Pick a different colour for the new colourway.`
    );
  }

  // In-house brands type their buyer code AS the style code (LNG182P → LNG182Y). Read from the source's
  // own data, not from customer names: then the new code is typed, and it is both codes.
  const buyerStyleRef = input.buyerStyleRef?.trim() || null;
  const codeIsBuyerCode = !!source.buyerStyleRef && source.buyerStyleRef.trim() === source.styleCode.trim();
  if (codeIsBuyerCode && !buyerStyleRef) {
    throw new ValidationError(
      `${source.styleCode}'s Style Code is its Buyer Style Code — type the new colourway's code.`
    );
  }
  if (buyerStyleRef) {
    const owner = await buyerStyleCodeOwner(buyerStyleRef);
    if (owner) throw new ConflictError(buyerStyleCodeTakenMessage(buyerStyleRef, owner));
  }

  const styleName =
    input.styleName?.trim() || (source.styleName.trim() === source.styleCode.trim() ? null : source.styleName);

  const maxAttempts = codeIsBuyerCode ? 1 : 3;
  for (let attempt = 1; ; attempt++) {
    const styleCode =
      codeIsBuyerCode && buyerStyleRef
        ? buyerStyleRef
        : await styleService.generateStyleCode(source.brandCategoryId, source.productCategoryId);
    try {
      const created = await prisma.$transaction(
        (tx) =>
          copyStyleTx(tx, {
            source,
            styleCode,
            styleName: styleName ?? styleCode, // a source named only by its code: the copy is named by its own
            buyerStyleRef,
            colour,
            userId,
          }),
        { timeout: 60_000, maxWait: 10_000 }
      );
      await recordCopiedCadHistory(created.cadCopies, source, userId);
      logInfo('Colourway created', {
        sourceId: source.id,
        sourceStyleCode: source.styleCode,
        id: created.result.id,
        styleCode: created.result.styleCode,
        colour: colour.colorName,
        ...created.result.copied,
      });
      return created.result;
    } catch (err) {
      const codeTaken =
        err instanceof StyleCodeTaken ||
        (err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          /style_?code/i.test(String(err.meta?.target ?? '')));
      if (!codeTaken) throw err;
      if (attempt >= maxAttempts) throw new ConflictError('Style code already exists');
      logWarn('Colourway style code collided — minting another', { styleCode, attempt });
    }
  }
}

interface CopyArgs {
  source: styles;
  styleCode: string;
  styleName: string;
  buyerStyleRef: string | null;
  colour: { id: string; colorName: string };
  userId: string;
}

async function copyStyleTx(
  tx: Tx,
  { source, styleCode, styleName, buyerStyleRef, colour, userId }: CopyArgs
): Promise<{ result: ColourwayCreated; cadCopies: fabric_width_cad[] }> {
  const taken = await tx.styles.findFirst({ where: { styleCode, isActive: true }, select: { id: true } });
  if (taken) throw new StyleCodeTaken(styleCode);

  // ---- the style ----
  const newId = randomUUID();
  await tx.styles.create({
    data: {
      ...carried(source, STYLE_COLUMNS),
      id: newId,
      styleCode,
      styleName,
      buyerStyleRef,
      internalCode: await generateAtomicDocNumber('STY', tx),
      colorId: colour.id,
      colourwayOfStyleId: source.colourwayOfStyleId ?? source.id,
      createdById: userId,
    } as Prisma.stylesUncheckedCreateInput,
  });
  await syncStyleColourway(tx, newId, colour.id);

  // ---- sizes + SKUs ----
  // SKU = style code + size, as the Style form writes it (EBEW-002XS), so the form's next save keeps them.
  // Never the source's SKUs: they are unique, and the update path would move them onto the copy.
  const sizes = await tx.size_options.findMany({
    where: { styleId: source.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  const sizeIdMap = new Map<string, string>(sizes.map((s) => [s.id, randomUUID()]));
  const newSizes = sizes.map((s) => ({ ...s, id: sizeIdMap.get(s.id) as string, sku: `${styleCode}${s.sizeName}` }));
  if (newSizes.length > 0) {
    const skuTaken = await tx.style_variants.findMany({
      where: { sku: { in: newSizes.map((s) => s.sku) } },
      select: { sku: true },
    });
    if (skuTaken.length > 0) {
      throw new ConflictError(
        `SKU ${skuTaken.map((s) => s.sku).join(', ')} already belongs to another style — pick another code.`
      );
    }
    await tx.size_options.createMany({
      data: newSizes.map((s) => ({
        id: s.id,
        styleId: newId,
        sizeName: s.sizeName,
        sizeCode: s.sizeCode,
        sortOrder: s.sortOrder,
        isActive: true,
      })),
    });
    await tx.style_variants.createMany({
      data: newSizes.map((s) => ({
        id: randomUUID(),
        styleId: newId,
        sizeId: s.id,
        sizeName: s.sizeName,
        sku: s.sku,
        isActive: true,
        sortOrder: s.sortOrder,
      })),
    });
  }

  // ---- components, fabrics, pattern parts, accessories ----
  const components = await tx.style_components.findMany({
    where: { styleId: source.id },
    orderBy: { sortOrder: 'asc' },
    include: {
      style_fabrics: { include: { stylePatternParts: true, embroideryPartCad: { include: { sizeBreakdowns: true } } } },
      style_accessories: true,
    },
  });
  const fabricIdMap = new Map<string, string>();
  const recolouredFabricIds = new Set<string>(); // source ids
  const sourceFabrics: Array<(typeof components)[number]['style_fabrics'][number]> = [];
  for (const component of components) {
    const componentId = randomUUID();
    await tx.style_components.create({
      data: {
        id: componentId,
        styleId: newId,
        componentName: component.componentName,
        componentType: component.componentType,
        componentMasterId: component.componentMasterId,
        sortOrder: component.sortOrder,
      },
    });
    for (const fabric of component.style_fabrics) {
      const fabricId = randomUUID();
      fabricIdMap.set(fabric.id, fabricId);
      sourceFabrics.push(fabric);
      // A fabric in the style's own colour IS the colourway; a contrast or printed fabric is not.
      const recolour = !!source.colorId && fabric.colorMasterId === source.colorId;
      if (recolour) recolouredFabricIds.add(fabric.id);
      await tx.style_fabrics.create({
        data: {
          ...carried(fabric, FABRIC_COLUMNS),
          id: fabricId,
          componentId,
          ...(recolour ? { colorMasterId: colour.id, fabricColor: colour.colorName, fabricId: null } : {}),
        } as Prisma.style_fabricsUncheckedCreateInput,
      });
      if (fabric.stylePatternParts.length > 0) {
        await tx.style_pattern_parts.createMany({
          data: fabric.stylePatternParts.map((p) => ({
            id: randomUUID(),
            styleFabricId: fabricId,
            patternPartId: p.patternPartId,
            quantity: p.quantity,
            goesToEmbroidery: p.goesToEmbroidery,
            notes: p.notes,
          })),
        });
      }
    }
    if (component.style_accessories.length > 0) {
      await tx.style_accessories.createMany({
        data: component.style_accessories.map((a) => ({
          id: randomUUID(),
          componentId,
          accessoryName: a.accessoryName,
          accessoryType: a.accessoryType,
          quantityPerPiece: a.quantityPerPiece,
          unit: a.unit,
          supplierName: a.supplierName,
          unitPrice: a.unitPrice,
        })),
      });
    }
  }

  // ---- processes ----
  const processes = await tx.style_processes.findMany({ where: { styleId: source.id } });
  if (processes.length > 0) {
    await tx.style_processes.createMany({
      data: processes.map((p) => ({
        id: randomUUID(),
        styleId: newId,
        processName: p.processName,
        processType: p.processType,
        isRequired: p.isRequired,
        sortOrder: p.sortOrder,
        estimatedCost: p.estimatedCost,
        estimatedDays: p.estimatedDays,
        notes: p.notes,
        supplierId: p.supplierId,
      })),
    });
  }

  // ---- trims BOM: the same items, quantity, price and wastage; the unit is the material's ----
  const bom = await tx.style_material_bom.findMany({ where: { styleId: source.id }, orderBy: { sortOrder: 'asc' } });
  if (bom.length > 0) {
    const units = await loadLineUnits(bom, tx);
    await tx.style_material_bom.createMany({
      data: bom.map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, styleId, createdAt, updatedAt, ...line } = row;
        return { ...line, id: randomUUID(), styleId: newId, unit: lineUnit(line, units) };
      }),
    });
  }

  // ---- tech spec, sketches ----
  const techSpec = await tx.style_tech_specs.findUnique({ where: { styleId: source.id } });
  if (techSpec) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, styleId, createdAt, updatedAt, ...spec } = techSpec;
    await tx.style_tech_specs.create({ data: { ...spec, id: randomUUID(), styleId: newId } });
  }
  const images = await tx.style_images.findMany({
    where: { styleId: source.id, imageType: { notIn: [...PHOTO_IMAGE_TYPES] } },
  });
  if (images.length > 0) {
    await tx.style_images.createMany({
      data: images.map((img) => ({
        id: randomUUID(),
        styleId: newId,
        imageUrl: img.imageUrl,
        imageType: img.imageType,
        caption: img.caption,
        sortOrder: img.sortOrder,
      })),
    });
  }

  // ---- CAD rows: the marker, its sizes, parts and image — unapproved, uncosted ----
  const sourceCads = pickCadRowsToCopy(
    await tx.fabric_width_cad.findMany({ where: cadRowsOfStyle(source.id), orderBy: { createdAt: 'asc' } })
  );
  const cadIdMap = new Map<string, string>();
  const cadCopies: fabric_width_cad[] = [];
  const label = styleCodeLabel(source);
  for (const src of sourceCads) {
    const coveredFabrics = [src.styleFabricId, ...parseIds(src.combinedFabricIds)].filter((id): id is string => !!id);
    const recoloured = coveredFabrics.some((id) => recolouredFabricIds.has(id));
    const note = `Copied from ${label} for the ${colour.colorName} colourway`;
    const created = await tx.fabric_width_cad.create({
      data: {
        ...carried(src, CAD_COLUMNS),
        ...(recoloured ? { fabricId: null } : {}),
        id: randomUUID(),
        styleFabricId: src.styleFabricId ? (fabricIdMap.get(src.styleFabricId) ?? null) : null,
        costingStyleId: src.costingStyleId ? newId : null,
        combinedFabricIds: remapCombinedFabricIds(src.combinedFabricIds, fabricIdMap),
        copiedFromId: src.id,
        notes: src.notes ? `${src.notes}\n\n${note}` : note,
        approvalStatus: 'PENDING',
        createdById: userId,
      } as Prisma.fabric_width_cadUncheckedCreateInput,
    });
    await copyCadChildren(tx, src.id, created.id, sizeIdMap);
    // The same marker: its image comes along, filed under the new style (a Raw Mat row needs one)
    await copyMarkerImage(tx, src.id, created.id, undefined, newId);
    cadIdMap.set(src.id, created.id);
    cadCopies.push(created);
  }

  // A fabric's chosen CAD row, and its embroidery marker, point at the copies
  for (const fabric of sourceFabrics) {
    const fabricId = fabricIdMap.get(fabric.id) as string;
    const cadId = fabric.fabricCADId ? cadIdMap.get(fabric.fabricCADId) : undefined;
    if (cadId) await tx.style_fabrics.update({ where: { id: fabricId }, data: { fabricCADId: cadId } });
    const emb = fabric.embroideryPartCad;
    if (emb) {
      const embId = randomUUID();
      await tx.embroidery_part_cad.create({
        data: {
          id: embId,
          styleFabricId: fabricId,
          fabricWidthCadId: emb.fabricWidthCadId ? (cadIdMap.get(emb.fabricWidthCadId) ?? null) : null,
          embroideryId: emb.embroideryId,
          cadMeters: emb.cadMeters,
          cadYards: emb.cadYards,
          cadWastagePercent: emb.cadWastagePercent,
          layerMarginMeters: emb.layerMarginMeters,
          piecesPerMarker: emb.piecesPerMarker,
          markerEfficiency: emb.markerEfficiency,
          printDirection: emb.printDirection,
          isApproved: false,
          notes: emb.notes,
        },
      });
      if (emb.sizeBreakdowns.length > 0) {
        await tx.embroidery_cad_size_breakdown.createMany({
          data: emb.sizeBreakdowns.map((s) => ({
            embroideryCadId: embId,
            sizeName: s.sizeName,
            sizeId: s.sizeId ? (sizeIdMap.get(s.sizeId) ?? null) : null,
            quantity: s.quantity,
          })),
        });
      }
    }
  }

  await recomputeStyleCadStatus(tx, newId);

  return {
    result: {
      id: newId,
      styleCode,
      buyerStyleRef,
      styleName,
      colourName: colour.colorName,
      copied: {
        fabrics: sourceFabrics.length,
        recolouredFabrics: recolouredFabricIds.size,
        trims: bom.length,
        sizes: newSizes.length,
        cadRows: cadCopies.length,
      },
    },
    cadCopies,
  };
}

function parseIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const ids: unknown = JSON.parse(json);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Each copied CAD row's History starts with where it came from (as "Copy to Raw Mat" records it). */
async function recordCopiedCadHistory(rows: fabric_width_cad[], source: styles, userId: string): Promise<void> {
  for (const row of rows) {
    const sizes = await prisma.cad_size_breakdown.findMany({
      where: { cadId: row.id },
      select: { sizeName: true, quantity: true },
    });
    await recordCadEdit({
      cadId: row.id,
      userId,
      action: 'CREATE',
      before: EMPTY_CAD_SNAPSHOT,
      after: cadSnapshot({ ...row, sizeBreakdowns: sizes }),
      reason: `Copied from ${styleCodeLabel(source)} CAD ${row.copiedFromId} (Create Colourway)`,
    });
  }
}

// ---------------------------------------------------------------------------
// The colour group
// ---------------------------------------------------------------------------

export interface ColourwaySibling {
  id: string;
  styleCode: string;
  buyerStyleRef: string | null;
  styleName: string;
  colour: { id: string; colorName: string; hexCode: string | null } | null;
  isFirst: boolean;
  isCurrent: boolean;
}

/** The style's colour group — the first style and every copy of it — active styles only, oldest first. */
export async function listColourways(styleId: string): Promise<ColourwaySibling[]> {
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { id: true, colourwayOfStyleId: true },
  });
  if (!style) throw new NotFoundError('Style', styleId);
  const firstId = style.colourwayOfStyleId ?? style.id;
  const rows = await prisma.styles.findMany({
    where: { isActive: true, OR: [{ id: firstId }, { colourwayOfStyleId: firstId }] },
    select: {
      id: true,
      styleCode: true,
      buyerStyleRef: true,
      styleName: true,
      color: { select: { id: true, colorName: true, hexCode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    styleCode: r.styleCode,
    buyerStyleRef: r.buyerStyleRef,
    styleName: r.styleName,
    colour: r.color,
    isFirst: r.id === firstId,
    isCurrent: r.id === styleId,
  }));
}
