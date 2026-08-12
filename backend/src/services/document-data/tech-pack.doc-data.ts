/**
 * Tech Pack — data adapter for the kf tech-pack template.
 *
 * The only multi-page document in the pack: the adapter lays out the sheets
 * itself (cover → BOM → measurement chart → notes) and hands the template a
 * `sheets` array, so every physical page repeats the masthead and carries an
 * honest "Page N of M". Long trim BOMs and multi-component measurement charts
 * spill onto extra sheets rather than being silently clipped.
 *
 * Field-set authority is document-generator.service.ts → generateTechPackPDF:
 * style identity, images, tech specs, style BOM, components and variants. This
 * adapter adds what that PDF omitted (fabrics per component, size run, process
 * route, packaging) and NEVER prints a placeholder measurement — unset values
 * are hatched so the pattern master fills them by hand.
 *
 * Images: the renderer writes the HTML into backend/templates/kf and navigates
 * to it as a file:// URL, so anything under backend/uploads is outside the page
 * directory and must be an ABSOLUTE file:// URL — built here with
 * pathToFileURL(). A plate whose file is missing on disk is dropped entirely;
 * the template never renders a broken-image box.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError } from '../../errors';
import { addCurrency, toCurrency } from '../../utils/currency';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtPct, fmtQty } from './format';

// src/services/document-data → backend/ (identical hop from dist/services/document-data)
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const STYLE_UPLOAD_DIR = path.join(BACKEND_ROOT, 'uploads', 'styles');

// Sheet capacities — chosen against the 297mm sheet less 2×10mm print padding.
const TRIM_ROWS_FIRST_SHEET = 12; // shares its sheet with the fabric table
const TRIM_ROWS_PER_SHEET = 26;
const MEASURE_ROWS_PER_SHEET = 22;

const techPackInclude = {
  brand_categories: { select: { brandName: true, category: true, subCategory: true, subSubCategory: true } },
  style_categories: { select: { name: true } },
  product_category: { select: { code: true, name: true, parent: { select: { name: true } } } },
  season_master: { select: { code: true, name: true } },
  techSpecs: true,
  styleImages: {
    orderBy: { sortOrder: 'asc' },
    select: { imageUrl: true, imageType: true, caption: true },
  },
  size_options: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sizeCode: true, sizeName: true },
  },
  color_options: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { colorName: true, colorCode: true },
  },
  style_variants: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      sku: true,
      sizeName: true,
      colorName: true,
      size: { select: { sizeCode: true, sortOrder: true } },
      color: { select: { colorName: true, colorCode: true } },
    },
  },
  style_components: {
    orderBy: { sortOrder: 'asc' },
    select: {
      componentName: true,
      componentType: true,
      componentMaster: { select: { name: true, componentGroup: { select: { code: true, name: true } } } },
      style_fabrics: {
        select: {
          fabricName: true,
          fabricType: true,
          fabricGSM: true,
          fabricColor: true,
          printDesign: true,
          greigeName: true,
          genericGreigeName: true,
          supplierName: true,
          fabricFinishType: true,
          quantityNeeded: true,
          cadAverageMeters: true,
          cutableWidth: true,
          hasEmbroidery: true,
          notes: true,
          fabric: {
            select: {
              fabricCode: true,
              fabricName: true,
              composition: true,
              yarnCount: true,
              finishedConstruction: true,
              actualGSM: true,
              actualWidth: true,
              cutableWidth: true,
              colorName: true,
              printDesign: true,
              greigeName: true,
            },
          },
          fabricCAD: {
            select: { cutableWidth: true, widthUnit: true, cadMeters: true, cadAverage: true, actualCad: true },
          },
          colorMaster: { select: { colorName: true, colorCode: true } },
          selectedGreige: { select: { greigeName: true, greigeCode: true } },
        },
      },
      style_accessories: {
        select: { accessoryName: true, accessoryType: true, quantityPerPiece: true, unit: true, supplierName: true },
      },
    },
  },
  style_material_bom: {
    where: { isActive: true },
    orderBy: [{ usageCategory: 'asc' }, { sortOrder: 'asc' }],
    select: {
      materialType: true,
      usageCategory: true,
      componentName: true,
      quantityPerGarment: true,
      unit: true,
      extraPercentage: true,
      notes: true,
      materials: { select: { code: true, name: true, unit: true } },
    },
  },
  style_packaging: { select: { itemName: true, itemType: true, specification: true, quantityPerPack: true } },
  style_processes: {
    orderBy: { sortOrder: 'asc' },
    select: {
      processName: true,
      processType: true,
      isRequired: true,
      estimatedDays: true,
      notes: true,
      supplier: { select: { name: true } },
    },
  },
  style_value_additions: {
    select: { additionType: true, description: true, type: true, numberOfItems: true, vendor: true },
  },
  samples: {
    orderBy: { requestDate: 'desc' },
    take: 8,
    select: {
      sampleNumber: true,
      sampleType: true,
      status: true,
      requestDate: true,
      completionDate: true,
      customerFeedback: true,
      measurements: {
        select: {
          measurementPoint: true,
          specValue: true,
          tolerance: true,
          size: { select: { sizeCode: true } },
        },
      },
    },
  },
} satisfies Prisma.stylesInclude;

type StyleWithDetails = Prisma.stylesGetPayload<{ include: typeof techPackInclude }>;
type StyleComponent = StyleWithDetails['style_components'][number];
type StyleFabric = StyleComponent['style_fabrics'][number];
type StyleSample = StyleWithDetails['samples'][number];

export interface TechPackPlate {
  label: string;
  src: string; // absolute file:// URL — see file header
  caption: string | null;
}

export interface TechPackFabricRow {
  sn: number;
  component: string;
  fabric: string;
  subline: string | null;
  composition: string;
  construction: string;
  gsm: string;
  width: string;
  finish: string;
  consumption: string;
}

export interface TechPackTrimRow {
  sn: number;
  item: string;
  subline: string | null;
  type: string;
  usage: string;
  qty: string;
  unit: string;
  wastage: string;
  remark: string;
}

export interface TechPackMeasureRow {
  point: string;
  tolerance: string | null; // null → hatched cell
  values: (string | null)[]; // null → hatched cell
}

export interface TechPackMeasureBlock {
  title: string;
  note: string | null;
  rows: TechPackMeasureRow[];
}

export interface TechPackColourway {
  sn: number;
  colour: string;
  code: string;
  sizes: string;
  skus: string;
}

export interface TechPackProcessRow {
  sn: number;
  process: string;
  kind: string;
  required: string;
  days: string;
  partner: string;
  notes: string;
}

export interface TechPackPackRow {
  sn: number;
  item: string;
  kind: string;
  spec: string;
  qty: string;
  basis: string; // "Per pack" (style_packaging) | "Per garment" (BOM packaging line)
}

export interface TechPackSampleRow {
  sn: number;
  sampleNo: string;
  kind: string;
  status: string;
  requested: string;
  completed: string;
  feedback: string;
}

/**
 * One printed page. Everything the page needs is resolved onto the sheet itself
 * (rather than reached for with `../../` from inside nested {{#each}} blocks),
 * so the template stays flat and the page count cannot drift from the layout.
 */
export interface TechPackSheet {
  pageNo: number;
  isCover: boolean;
  isBom: boolean;
  isMeasure: boolean;
  isNotes: boolean;
  continued: boolean;
  showFabric: boolean;
  fabricRows: TechPackFabricRow[];
  fabricTotal: string;
  trimRows: TechPackTrimRow[];
  trimNote: string | null; // first BOM sheet only
  measureBlocks: TechPackMeasureBlock[];
  measureSizes: string[];
  measureColspan: number; // point + tolerance + one per size
  showMeasureCallout: boolean; // first measurement sheet, blank chart only
}

export interface TechPackDocData {
  company: CompanyBlock;
  docNo: string; // style code (+ buyer ref)
  docPill: string;
  pageTotal: number;
  statusBanner: string;
  // 01 — identity
  styleName: string;
  buyerRef: string | null;
  customerName: string;
  brandName: string;
  category: string;
  productCategory: string;
  season: string;
  gender: string;
  hsnCode: string | null;
  internalCode: string | null;
  accountingSku: string | null;
  projectGroup: string | null;
  expectedOrderQty: string | null;
  componentSummary: string;
  styleStatus: string;
  cadStatus: string;
  cadApprovedOn: string | null; // null → no approval date on record
  latestSample: string;
  createdOn: string;
  updatedOn: string;
  // 02 — size run & colourways
  sizeRun: string;
  colourways: TechPackColourway[];
  colourwaySource: string;
  // 03 — plates
  plates: TechPackPlate[];
  platesNote: string | null;
  // 06 — measurements
  measureBanner: string;
  measureIsBlank: boolean;
  // 07 — construction
  specRows: { label: string; value: string }[];
  noteBlocks: { title: string; lines: string[] }[];
  processRows: TechPackProcessRow[];
  handFillNotes: boolean;
  // 08 — packing & labelling
  packRows: TechPackPackRow[];
  packIsBlank: boolean;
  // 09 — sample & approval log
  sampleRows: TechPackSampleRow[];
  sampleIsBlank: boolean;
  // pagination
  sheets: TechPackSheet[];
}

// ── small helpers ──────────────────────────────────────────────────────────
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** ENUM_VALUE → "Enum Value" */
function humanize(value: string | null | undefined): string | null {
  const c = clean(value);
  if (!c) return null;
  if (!/^[A-Z0-9_]+$/.test(c)) return c; // already free text — leave as authored
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function joinBits(bits: (string | null | undefined)[], sep = ' · '): string | null {
  const kept = bits.map((b) => clean(b)).filter((b): b is string => b !== null);
  return kept.length > 0 ? kept.join(sep) : null;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * uploads/ path → absolute file:// URL, or null when the file is not on disk.
 * Accepts "/uploads/styles/x.jpg" (styles.imageUrl / style_images.imageUrl) and
 * a bare "x.jpg" (styles.image), matching document-generator.service resolution.
 * Anything resolving outside uploads/ is refused — a stored path is data, and the
 * rendered page is a file:// document with read access to the whole disk.
 * (Same containment rule as style-doc-common.ts, the multi-style sibling.)
 */
function resolveUploadUrl(raw: string | null | undefined): string | null {
  const value = clean(raw);
  if (!value) return null;
  const relative = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidates = [path.resolve(BACKEND_ROOT, relative), path.resolve(STYLE_UPLOAD_DIR, path.basename(relative))];
  const uploadsRoot = path.resolve(BACKEND_ROOT, 'uploads');
  for (const candidate of candidates) {
    if (!candidate.startsWith(uploadsRoot + path.sep)) continue;
    try {
      if (fs.statSync(candidate).isFile()) return pathToFileURL(candidate).href;
    } catch {
      // not on disk — try the next candidate
    }
  }
  return null; // missing file → plate omitted (never a broken-image box)
}

const IMAGE_TYPE_LABEL: Record<string, string> = {
  MAIN: 'Main',
  SKETCH_FRONT: 'Sketch — Front',
  SKETCH_BACK: 'Sketch — Back',
  SKETCH_SIDE: 'Sketch — Side',
  TECHNICAL_FLAT: 'Technical Flat',
  DETAIL_VIEW: 'Detail',
  CONSTRUCTION: 'Construction',
  OTHER: 'Reference',
};

/**
 * Blank points of measure by component group. These are chart LABELS for a
 * hand-filled grid, not data: every value cell is hatched. Used only when the
 * style has no approved sample measurement set to print.
 */
const BLANK_POINTS: Record<string, string[]> = {
  TOP: [
    'Chest — 1″ below armhole',
    'Waist',
    'Bottom hem',
    'Shoulder — seam to seam',
    'Front length from HPS',
    'Back length from HPS',
    'Sleeve length from shoulder',
    'Sleeve opening',
    'Armhole — straight',
    'Neck width — seam to seam',
    'Front neck drop',
    'Back neck drop',
  ],
  BOTTOM: [
    'Waist — relaxed',
    'Waist — fully stretched',
    'Hip — 8″ below waist',
    'Thigh — 1″ below crotch',
    'Knee',
    'Leg opening',
    'Inseam',
    'Outseam',
    'Front rise',
    'Back rise',
  ],
  FULL: [
    'Chest — 1″ below armhole',
    'Waist',
    'Hip',
    'Bottom sweep',
    'Shoulder — seam to seam',
    'Front length from HPS',
    'Back length from HPS',
    'Sleeve length from shoulder',
    'Sleeve opening',
    'Armhole — straight',
    'Neck width — seam to seam',
    'Front neck drop',
  ],
  ACCESS: ['Finished length', 'Finished width', 'Border / hem width', 'Finished weight'],
};
BLANK_POINTS.INNER = BLANK_POINTS.TOP;
BLANK_POINTS.OUTER = BLANK_POINTS.TOP;

const COMPONENT_TYPE_GROUP: Record<string, string> = {
  'UPPER WEAR': 'TOP',
  'LOWER WEAR': 'BOTTOM',
  FULL: 'FULL',
};

function groupCodeFor(component: StyleComponent): string {
  const fromMaster = clean(component.componentMaster?.componentGroup?.code)?.toUpperCase();
  if (fromMaster && BLANK_POINTS[fromMaster]) return fromMaster;
  const fromType = COMPONENT_TYPE_GROUP[clean(component.componentType)?.toUpperCase() ?? ''];
  if (fromType) return fromType;
  return 'FULL';
}

// ── row builders ───────────────────────────────────────────────────────────
function fabricDisplayName(sf: StyleFabric): string {
  return (
    clean(sf.fabric?.fabricName) ??
    clean(sf.fabricName) ??
    clean(sf.genericGreigeName) ??
    clean(sf.selectedGreige?.greigeName) ??
    clean(sf.greigeName) ??
    EM_DASH
  );
}

function fabricSubline(sf: StyleFabric, widthNote: string | null): string | null {
  return joinBits([
    sf.fabric?.fabricCode,
    clean(sf.fabric?.greigeName) ?? clean(sf.selectedGreige?.greigeName) ?? clean(sf.greigeName),
    sf.selectedGreige?.greigeCode ? `Greige ${sf.selectedGreige.greigeCode}` : null,
    widthNote,
    sf.supplierName,
    sf.hasEmbroidery ? 'Embroidered' : null,
    clean(sf.notes),
  ]);
}

function buildFabricRows(components: StyleComponent[]): { rows: TechPackFabricRow[]; total: string } {
  const rows: TechPackFabricRow[] = [];
  let known = 0;
  let running = toCurrency(0);

  for (const component of components) {
    for (const sf of component.style_fabrics) {
      // Consumption: CAD average first, then the CAD row, then the style-fabric
      // quantity. A stored 0 means "not yet established" — printed as an em-dash,
      // never as a real 0.
      const consumptionRaw =
        sf.cadAverageMeters ??
        sf.fabricCAD?.cadAverage ??
        sf.fabricCAD?.cadMeters ??
        sf.fabricCAD?.actualCad ??
        sf.quantityNeeded;
      const consumption =
        consumptionRaw != null && toCurrency(consumptionRaw).greaterThan(0) ? toCurrency(consumptionRaw) : null;
      if (consumption) {
        running = addCurrency(running, consumption);
        known += 1;
      }

      // Cutable width is what the marker is laid on, so it wins; a full width is
      // shown only when no cutable width exists, and is labelled as such in the
      // subline so nobody plans a marker against a selvedge-to-selvedge figure.
      const cutable = sf.cutableWidth ?? sf.fabricCAD?.cutableWidth ?? sf.fabric?.cutableWidth;
      const widthRaw = cutable ?? sf.fabric?.actualWidth;
      const widthNote =
        cutable != null && sf.fabric?.actualWidth != null
          ? `Full width ${fmtQty(Number(sf.fabric.actualWidth))}″`
          : cutable == null && sf.fabric?.actualWidth != null
            ? 'Width is full width — cutable width not set'
            : null;
      const gsmRaw = sf.fabric?.actualGSM ?? (clean(sf.fabricGSM) != null ? Number(sf.fabricGSM) : null);

      rows.push({
        sn: rows.length + 1,
        component: clean(component.componentName) ?? clean(component.componentMaster?.name) ?? EM_DASH,
        fabric: fabricDisplayName(sf),
        subline: fabricSubline(sf, widthNote),
        composition: clean(sf.fabric?.composition) ?? EM_DASH,
        construction: clean(sf.fabric?.finishedConstruction) ?? clean(sf.fabric?.yarnCount) ?? EM_DASH,
        gsm: gsmRaw != null && Number.isFinite(gsmRaw) ? fmtQty(gsmRaw, 'PCS') : EM_DASH,
        width: widthRaw != null ? `${fmtQty(Number(widthRaw))}″` : EM_DASH,
        finish:
          joinBits(
            [
              humanize(sf.fabricFinishType),
              clean(sf.colorMaster?.colorName) ?? clean(sf.fabricColor) ?? clean(sf.fabric?.colorName),
              clean(sf.printDesign) ?? clean(sf.fabric?.printDesign),
            ],
            ' · '
          ) ?? EM_DASH,
        consumption: consumption ? fmtQty(consumption.toNumber()) : EM_DASH,
      });
    }
  }

  return {
    rows,
    total: known > 0 ? fmtQty(running.toNumber()) : EM_DASH,
  };
}

function buildTrimRows(style: StyleWithDetails): TechPackTrimRow[] {
  const rows: TechPackTrimRow[] = [];

  for (const bom of style.style_material_bom) {
    if (bom.usageCategory === 'PACKAGING') continue; // printed in section 08
    const qty = toCurrency(bom.quantityPerGarment);
    const item = clean(bom.componentName) ?? clean(bom.materials?.name) ?? humanize(bom.materialType) ?? EM_DASH;
    const materialName = clean(bom.materials?.name);
    rows.push({
      sn: rows.length + 1,
      item,
      subline: joinBits([bom.materials?.code, materialName !== item ? materialName : null]),
      type: humanize(bom.materialType) ?? EM_DASH,
      usage: humanize(bom.usageCategory) ?? EM_DASH,
      // a stored 0 per garment means "not established" — never printed as 0.00
      qty: qty.greaterThan(0) ? fmtQty(qty.toNumber(), bom.unit) : EM_DASH,
      unit: clean(bom.unit) ?? clean(bom.materials?.unit) ?? EM_DASH,
      wastage: bom.extraPercentage != null ? fmtPct(Number(bom.extraPercentage)) : EM_DASH,
      remark: clean(bom.notes) ?? EM_DASH,
    });
  }

  // Component-level accessories are a second, independent source (style_accessories)
  for (const component of style.style_components) {
    for (const acc of component.style_accessories) {
      const qty = toCurrency(acc.quantityPerPiece);
      rows.push({
        sn: rows.length + 1,
        item: clean(acc.accessoryName) ?? EM_DASH,
        subline: joinBits([`Component ${clean(component.componentName) ?? EM_DASH}`, acc.supplierName]),
        type: humanize(acc.accessoryType) ?? EM_DASH,
        usage: 'Accessory',
        qty: qty.greaterThan(0) ? fmtQty(qty.toNumber(), acc.unit) : EM_DASH,
        unit: clean(acc.unit) ?? EM_DASH,
        wastage: EM_DASH,
        remark: EM_DASH,
      });
    }
  }

  // Value additions carry no per-garment quantity of their own — listed as trims
  // so the pack is complete, with the count where one is recorded.
  for (const va of style.style_value_additions) {
    rows.push({
      sn: rows.length + 1,
      item: clean(va.description) ?? clean(va.additionType) ?? EM_DASH,
      subline: joinBits([humanize(va.additionType), va.vendor]),
      type: humanize(va.type) ?? humanize(va.additionType) ?? EM_DASH,
      usage: 'Value addition',
      qty: clean(va.numberOfItems) ?? EM_DASH,
      unit: EM_DASH,
      wastage: EM_DASH,
      remark: EM_DASH,
    });
  }

  return rows;
}

/** Colourways from style_variants (colour + the sizes that carry it). */
function buildColourways(style: StyleWithDetails): { rows: TechPackColourway[]; source: string } {
  const byColour = new Map<string, { code: string | null; sizes: Map<string, number>; skus: number }>();

  for (const variant of style.style_variants) {
    const colourName = clean(variant.color?.colorName) ?? clean(variant.colorName);
    if (!colourName) continue;
    const entry = byColour.get(colourName) ?? { code: clean(variant.color?.colorCode), sizes: new Map(), skus: 0 };
    entry.skus += 1;
    const sizeCode = clean(variant.size?.sizeCode) ?? clean(variant.sizeName);
    if (sizeCode) entry.sizes.set(sizeCode, variant.size?.sortOrder ?? entry.sizes.size);
    byColour.set(colourName, entry);
  }

  if (byColour.size > 0) {
    const rows = [...byColour.entries()].map(([colour, entry], idx) => ({
      sn: idx + 1,
      colour,
      code: entry.code ?? EM_DASH,
      sizes:
        entry.sizes.size > 0
          ? [...entry.sizes.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([code]) => code)
              .join(' · ')
          : EM_DASH,
      skus: fmtQty(entry.skus, 'PCS'),
    }));
    return { rows, source: `${rows.length} colourway${rows.length === 1 ? '' : 's'} · from style SKUs` };
  }

  // color_options is the other authored source; used when no SKUs exist yet
  const rows = style.color_options.map((c, idx) => ({
    sn: idx + 1,
    colour: clean(c.colorName) ?? EM_DASH,
    code: clean(c.colorCode) ?? EM_DASH,
    sizes: EM_DASH,
    skus: EM_DASH,
  }));
  if (rows.length > 0) {
    return { rows, source: `${rows.length} colour option${rows.length === 1 ? '' : 's'}` };
  }
  // SKUs can exist on size alone — say so rather than implying the style is empty
  return {
    rows,
    source:
      style.style_variants.length > 0
        ? `${style.style_variants.length} size-only SKUs · no colourway on record`
        : 'None recorded — fill by hand',
  };
}

/** Measurement blocks: real sample spec when one exists, else a blank hand-fill chart. */
function buildMeasureBlocks(
  style: StyleWithDetails,
  sizes: string[]
): { blocks: TechPackMeasureBlock[]; isBlank: boolean; banner: string } {
  const sampleWithSpec: StyleSample | undefined = style.samples.find((s) => s.measurements.length > 0);

  if (sampleWithSpec) {
    const byPoint = new Map<string, { tolerance: string | null; values: Map<string, string> }>();
    for (const m of sampleWithSpec.measurements) {
      const point = clean(m.measurementPoint) ?? EM_DASH;
      const entry = byPoint.get(point) ?? { tolerance: fmtQty(Number(m.tolerance)), values: new Map<string, string>() };
      const sizeCode = clean(m.size?.sizeCode);
      if (sizeCode) entry.values.set(sizeCode, fmtQty(Number(m.specValue)));
      byPoint.set(point, entry);
    }
    const rows: TechPackMeasureRow[] = [...byPoint.entries()].map(([point, entry]) => ({
      point,
      tolerance: entry.tolerance,
      values: sizes.map((s) => entry.values.get(s) ?? null),
    }));
    return {
      blocks: [
        {
          title: `Spec — ${humanize(sampleWithSpec.sampleType) ?? 'Sample'} ${sampleWithSpec.sampleNumber}`,
          note: `Approved spec from sample ${sampleWithSpec.sampleNumber}. Hatched cells have no recorded value.`,
          rows,
        },
      ],
      isBlank: false,
      banner: `From sample ${sampleWithSpec.sampleNumber}`,
    };
  }

  // No approved measurement set on record → blank chart, one block per component
  const components = style.style_components.length > 0 ? style.style_components : null;
  const blocks: TechPackMeasureBlock[] = components
    ? components.map((component) => {
        const code = groupCodeFor(component);
        return {
          title: `${clean(component.componentName) ?? clean(component.componentMaster?.name) ?? 'Component'} — ${
            clean(component.componentMaster?.componentGroup?.name) ?? humanize(component.componentType) ?? 'Garment'
          }`,
          note: null,
          rows: (BLANK_POINTS[code] ?? BLANK_POINTS.FULL).map((point) => ({
            point,
            tolerance: null,
            values: sizes.map(() => null),
          })),
        };
      })
    : [
        {
          title: 'Garment — points of measure',
          note: 'No components are recorded for this style; the standard full-garment points are issued blank.',
          rows: BLANK_POINTS.FULL.map((point) => ({ point, tolerance: null, values: sizes.map(() => null) })),
        },
      ];

  return {
    blocks,
    isBlank: true,
    banner: 'Blank — to be filled and signed',
  };
}

function buildProcessRows(style: StyleWithDetails): TechPackProcessRow[] {
  return style.style_processes.map((p, idx) => ({
    sn: idx + 1,
    process: clean(p.processName) ?? humanize(p.processType) ?? EM_DASH,
    kind: humanize(p.processType) ?? EM_DASH,
    required: p.isRequired ? 'Mandatory' : 'Optional',
    days: p.estimatedDays != null ? fmtQty(p.estimatedDays, 'NOS') : EM_DASH,
    partner: clean(p.supplier?.name) ?? EM_DASH,
    notes: clean(p.notes) ?? EM_DASH,
  }));
}

function buildPackRows(style: StyleWithDetails): TechPackPackRow[] {
  const rows: TechPackPackRow[] = [];
  for (const pack of style.style_packaging) {
    rows.push({
      sn: rows.length + 1,
      item: clean(pack.itemName) ?? EM_DASH,
      kind: humanize(pack.itemType) ?? EM_DASH,
      spec: clean(pack.specification) ?? EM_DASH,
      qty: fmtQty(pack.quantityPerPack, 'PCS'),
      basis: 'Per pack',
    });
  }
  for (const bom of style.style_material_bom) {
    if (bom.usageCategory !== 'PACKAGING') continue;
    const qty = toCurrency(bom.quantityPerGarment);
    rows.push({
      sn: rows.length + 1,
      item: clean(bom.componentName) ?? clean(bom.materials?.name) ?? humanize(bom.materialType) ?? EM_DASH,
      kind: humanize(bom.materialType) ?? EM_DASH,
      spec: joinBits([bom.materials?.code, clean(bom.notes)]) ?? EM_DASH,
      qty: qty.greaterThan(0) ? fmtQty(qty.toNumber(), bom.unit) : EM_DASH,
      basis: 'Per garment',
    });
  }
  return rows;
}

function buildSampleRows(style: StyleWithDetails): TechPackSampleRow[] {
  return style.samples.map((s, idx) => ({
    sn: idx + 1,
    sampleNo: s.sampleNumber,
    kind: humanize(s.sampleType) ?? EM_DASH,
    status: humanize(s.status) ?? EM_DASH,
    requested: fmtDate(s.requestDate),
    completed: fmtDate(s.completionDate),
    feedback: clean(s.customerFeedback) ?? EM_DASH,
  }));
}

function buildSpecRows(style: StyleWithDetails): { label: string; value: string }[] {
  const specs = style.techSpecs;
  if (!specs) return [];
  const unit = clean(specs.lengthUnit) ?? 'inches';
  const rows: { label: string; value: string }[] = [];
  const pushLength = (label: string, value: Prisma.Decimal | null) => {
    if (value == null) return;
    rows.push({ label, value: `${fmtQty(Number(value))} ${unit}` });
  };
  pushLength('Overall length', specs.overallLength);
  pushLength('Top length', specs.topLength);
  pushLength('Bottom length', specs.bottomLength);
  const pushText = (label: string, value: string | null) => {
    const v = humanize(value);
    if (v) rows.push({ label, value: v });
  };
  pushText('Sleeve', specs.sleeveType);
  pushText('Collar / neck', specs.collarType);
  pushText('Fit', specs.fitType);
  pushText('Closure', specs.closureType);
  return rows;
}

function splitLines(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ── main ───────────────────────────────────────────────────────────────────
export async function buildTechPackDocData(styleId: string): Promise<TechPackDocData> {
  const [company, style] = await Promise.all([
    buildCompanyBlock(),
    prisma.styles.findUnique({ where: { id: styleId }, include: techPackInclude }),
  ]);
  if (!style) throw new NotFoundError('Style', styleId);

  // ── 01 — identity ────────────────────────────────────────────────────────
  const buyerRef = clean(style.buyerStyleRef);
  const docNo = formatStyleCodeWithRef(style.styleCode, buyerRef);
  const category =
    joinBits(
      [style.brand_categories?.category, style.brand_categories?.subCategory, style.brand_categories?.subSubCategory],
      ' / '
    ) ??
    clean(style.style_categories?.name) ??
    clean(style.specifications) ??
    EM_DASH;
  const productCategory =
    joinBits([style.product_category?.parent?.name, style.product_category?.name], ' / ') ??
    (style.product_category?.code ? style.product_category.code : EM_DASH);
  const season =
    joinBits([style.season_master?.code, style.season_master?.name], ' · ') ?? clean(style.season) ?? EM_DASH;

  const componentNames = style.style_components
    .map((c) => clean(c.componentName) ?? clean(c.componentMaster?.name))
    .filter((n): n is string => n !== null);

  // ── 02 — size run & colourways ───────────────────────────────────────────
  const sizes = style.size_options
    .map((s) => clean(s.sizeCode) ?? clean(s.sizeName))
    .filter((s): s is string => s !== null);
  // A style with no size run still gets a chart — one open column to write in.
  const sizeColumns = sizes.length > 0 ? sizes : ['Spec'];
  const colourways = buildColourways(style);

  // ── 03 — image plates ────────────────────────────────────────────────────
  const plates: TechPackPlate[] = [];
  for (const image of style.styleImages) {
    const src = resolveUploadUrl(image.imageUrl);
    if (!src) continue; // file gone from disk — drop the plate
    plates.push({
      label: IMAGE_TYPE_LABEL[image.imageType] ?? 'Reference',
      src,
      caption: clean(image.caption),
    });
    if (plates.length >= 6) break;
  }
  if (plates.length === 0) {
    const src = resolveUploadUrl(style.imageUrl) ?? resolveUploadUrl(style.image);
    if (src) plates.push({ label: 'Main', src, caption: null });
  }
  const platesNote =
    plates.length > 0
      ? null
      : style.styleImages.length > 0 || clean(style.imageUrl) != null || clean(style.image) != null
        ? 'Image files referenced by this style are missing from the server — plates omitted rather than printed blank.'
        : 'No images are attached to this style. Attach front, back and detail views in the Design Hub before issuing this pack to production.';

  // ── 04/05 — fabric & trim tables ─────────────────────────────────────────
  const fabric = buildFabricRows(style.style_components);
  const trimRows = buildTrimRows(style);
  const trimNote =
    trimRows.length === 0
      ? 'No trims are recorded against this style. Nothing can be raised through MRP until the style BOM is filled in.'
      : trimRows.some((r) => r.qty === EM_DASH)
        ? 'Lines showing — carry no per-garment quantity in the style BOM. Set them in the ERP before MRP; do not estimate on the shop floor.'
        : null;

  // ── 06 — measurements ────────────────────────────────────────────────────
  const measure = buildMeasureBlocks(style, sizeColumns);

  // ── 07 — construction ────────────────────────────────────────────────────
  const specRows = buildSpecRows(style);
  const noteBlocks: { title: string; lines: string[] }[] = [];
  const designLines = splitLines(clean(style.techSpecs?.designNotes));
  if (designLines.length > 0) noteBlocks.push({ title: 'Design notes', lines: designLines });
  const constructionLines = splitLines(clean(style.techSpecs?.constructionNotes));
  if (constructionLines.length > 0) noteBlocks.push({ title: 'Construction notes', lines: constructionLines });
  const styleLines = [...splitLines(clean(style.description)), ...splitLines(clean(style.bulletPoints))];
  if (styleLines.length > 0) noteBlocks.push({ title: 'Style notes', lines: styleLines });
  const processRows = buildProcessRows(style);

  // ── 08/09 — packing & sample log ─────────────────────────────────────────
  const packRows = buildPackRows(style);
  const sampleRows = buildSampleRows(style);

  // ── sheet layout ─────────────────────────────────────────────────────────
  const trimChunks =
    trimRows.length > TRIM_ROWS_FIRST_SHEET
      ? [trimRows.slice(0, TRIM_ROWS_FIRST_SHEET), ...chunk(trimRows.slice(TRIM_ROWS_FIRST_SHEET), TRIM_ROWS_PER_SHEET)]
      : [trimRows];

  // Measurement blocks packed onto sheets by row budget; a block longer than one
  // sheet is split and the continuation keeps the block title.
  const measureSheets: TechPackMeasureBlock[][] = [];
  let currentSheet: TechPackMeasureBlock[] = [];
  let budget = MEASURE_ROWS_PER_SHEET;
  for (const block of measure.blocks) {
    let rows = block.rows;
    let first = true;
    while (rows.length > 0) {
      if (budget <= 2) {
        measureSheets.push(currentSheet);
        currentSheet = [];
        budget = MEASURE_ROWS_PER_SHEET;
      }
      const take = rows.slice(0, budget);
      currentSheet.push({
        title: first ? block.title : `${block.title} (cont.)`,
        note: first ? block.note : null,
        rows: take,
      });
      budget -= take.length + 1; // + the block's own header row
      rows = rows.slice(take.length);
      first = false;
    }
  }
  if (currentSheet.length > 0) measureSheets.push(currentSheet);
  if (measureSheets.length === 0) measureSheets.push([]);

  const sheets: TechPackSheet[] = [];
  const blank = {
    showFabric: false,
    fabricRows: [] as TechPackFabricRow[],
    fabricTotal: EM_DASH,
    trimRows: [] as TechPackTrimRow[],
    trimNote: null as string | null,
    measureBlocks: [] as TechPackMeasureBlock[],
    measureSizes: sizeColumns,
    measureColspan: sizeColumns.length + 2,
    showMeasureCallout: false,
  };
  sheets.push({
    pageNo: 0,
    isCover: true,
    isBom: false,
    isMeasure: false,
    isNotes: false,
    continued: false,
    ...blank,
  });
  trimChunks.forEach((rows, idx) => {
    sheets.push({
      pageNo: 0,
      isCover: false,
      isBom: true,
      isMeasure: false,
      isNotes: false,
      continued: idx > 0,
      ...blank,
      showFabric: idx === 0,
      fabricRows: idx === 0 ? fabric.rows : [],
      fabricTotal: fabric.total,
      trimRows: rows,
      trimNote: idx === 0 ? trimNote : null,
    });
  });
  measureSheets.forEach((blocks, idx) => {
    sheets.push({
      pageNo: 0,
      isCover: false,
      isBom: false,
      isMeasure: true,
      isNotes: false,
      continued: idx > 0,
      ...blank,
      measureBlocks: blocks,
      showMeasureCallout: idx === 0 && measure.isBlank,
    });
  });
  sheets.push({
    pageNo: 0,
    isCover: false,
    isBom: false,
    isMeasure: false,
    isNotes: true,
    continued: false,
    ...blank,
  });
  sheets.forEach((sheet, idx) => {
    sheet.pageNo = idx + 1;
  });

  return {
    company,
    docNo,
    docPill: 'Production reference · not a commercial document',
    pageTotal: sheets.length,
    statusBanner: `${humanize(style.status) ?? EM_DASH} · CAD ${humanize(style.cadStatus) ?? EM_DASH}`,
    styleName: clean(style.styleName) ?? style.styleCode,
    buyerRef,
    customerName: clean(style.customerName) ?? EM_DASH,
    brandName: clean(style.brandName) ?? clean(style.brand_categories?.brandName) ?? EM_DASH,
    category,
    productCategory,
    season,
    gender: joinBits([humanize(style.gender), humanize(style.ageGroup)]) ?? EM_DASH,
    hsnCode: clean(style.hsnCode),
    internalCode: clean(style.internalCode),
    accountingSku: clean(style.accountingSKU),
    projectGroup: clean(style.projectGroup),
    expectedOrderQty: style.expectedOrderQuantity != null ? fmtQty(style.expectedOrderQuantity, 'PCS') : null,
    componentSummary:
      componentNames.length > 0 ? `${componentNames.length} — ${componentNames.join(' · ')}` : 'None recorded',
    styleStatus: humanize(style.status) ?? EM_DASH,
    cadStatus: humanize(style.cadStatus) ?? EM_DASH,
    cadApprovedOn: style.approvedCadDate ? fmtDate(style.approvedCadDate) : null,
    latestSample: sampleRows.length > 0 ? `${sampleRows[0].sampleNo} · ${sampleRows[0].status}` : '— none recorded',
    createdOn: fmtDate(style.createdAt),
    updatedOn: fmtDate(style.updatedAt),
    sizeRun: sizes.length > 0 ? sizes.join(' · ') : '— no size run recorded',
    colourways: colourways.rows,
    colourwaySource: colourways.source,
    plates,
    platesNote,
    measureBanner: measure.banner,
    measureIsBlank: measure.isBlank,
    specRows,
    noteBlocks,
    processRows,
    handFillNotes: noteBlocks.length === 0,
    packRows,
    packIsBlank: packRows.length === 0,
    sampleRows,
    sampleIsBlank: sampleRows.length === 0,
    sheets,
  };
}
