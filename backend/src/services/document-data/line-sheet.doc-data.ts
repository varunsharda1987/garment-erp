/**
 * Line Sheet — data adapter for the kf line-sheet template.
 *
 * The wholesale working document: one dense row per style with a small photo
 * plate, the codes a buyer orders by, colourways, size range, fabric, HSN and
 * price — plus a hatched column the buyer writes quantities into (base.css's
 * hand-fill device: hatched means a human completes it after printing).
 *
 * MULTI-STYLE and MULTI-PAGE. One root Prisma query; the rows are paginated
 * HERE and the template emits one `.sheet` per printed page, so "Page n of m"
 * is true and a row can never straddle a page break.
 *
 * Selection argument (single string, so the preview script and a future
 * `:id`-shaped route both work) — comma-separated tokens:
 *     "<uuid>,<uuid>"                 explicit styles by id
 *     "ESSKY062LS,COS173"             explicit styles by code
 *     "brand=Easybuy,limit=12"        filter tokens (AND-ed)
 *     "season=SS26,buyer=Acme Retail,title=Spring Drop 1"
 * See parseStyleSelection in style-doc-common.ts.
 *
 * A4 PORTRAIT — the shared renderer prints puppeteer `format:'A4'` without
 * preferCSSPageSize, so a CSS landscape @page would be ignored and clipped.
 */
import prisma from '../../config/database';
import { BusinessError, NotFoundError } from '../../errors';
import { compareCurrency } from '../../utils/currency';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney } from './format';
import {
  buildStyleWhere,
  docReference,
  hasSelection,
  parseStyleSelection,
  resolveStyleImageUrl,
  resolveTake,
  StyleDocRecord,
  styleColours,
  styleDocInclude,
  styleFabrics,
  styleMetaLine,
  styleSeason,
  styleSizes,
} from './style-doc-common';

// Page budget: Chrome prints A4 at 794x1123 CSS px and base.css leaves 10mm
// padding, so a sheet holds ~1047px. A row is a 76px plate + 10px padding.
// The first page also carries the masthead and section 01.
const FIRST_PAGE_ROWS = 8;
const PAGE_ROWS = 10;
const SUMMARY_ROW_COST = 3; // vertical space the closing summary needs, in rows

export interface LineSheetRow {
  sn: number;
  imageUrl: string | null; // absolute file:// URL, or null → empty plate
  code: string;
  buyerRef: string | null;
  name: string;
  meta: string | null; // "Dresses · Easybuy · SS26"
  colours: string;
  coloursExtra: number;
  sizes: string;
  sizesExtra: number;
  fabric: string;
  hsn: string;
  wholesale: string;
  mrp: string;
}

export interface LineSheetSummary {
  styleCount: number;
  styleCountIsOne: boolean;
  wholesaleBand: string;
  wholesaleSub: string;
  mrpBand: string;
  mrpSub: string;
  imagesShown: number;
  imagesMissing: number;
}

export interface LineSheetPage {
  pageNo: number;
  isFirst: boolean;
  rangeLabel: string; // "Styles 1–8 of 11"
  rows: LineSheetRow[];
  summary: LineSheetSummary | null;
}

export interface LineSheetDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  collectionLabel: string;
  preparedFor: string | null;
  seasonLabel: string;
  categoryLabel: string;
  issuedOn: string;
  styleCount: number;
  priceNote: string;
  pages: LineSheetPage[];
  pageCount: number;
  summary: LineSheetSummary;
}

/** Decimal-safe extremes (no float min/max on money). */
function priceBand(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (compareCurrency(value, min) < 0) min = value;
    if (compareCurrency(value, max) > 0) max = value;
  }
  return { min, max };
}

function bandLabel(band: { min: number; max: number } | null): string {
  if (!band) return EM_DASH;
  if (compareCurrency(band.min, band.max) === 0) return fmtMoney(band.min);
  return `${fmtMoney(band.min)} – ${fmtMoney(band.max)}`;
}

function buildRow(style: StyleDocRecord, sn: number): LineSheetRow {
  const colours = styleColours(style, 4);
  const sizes = styleSizes(style, 8);
  const fabrics = styleFabrics(style, 2);
  return {
    sn,
    imageUrl: resolveStyleImageUrl(style),
    code: style.styleCode,
    buyerRef: style.buyerStyleRef?.trim() ? style.buyerStyleRef.trim() : null,
    name: style.styleName,
    meta: styleMetaLine(style),
    colours: colours.text,
    coloursExtra: colours.extra,
    sizes: sizes.text,
    sizesExtra: sizes.extra,
    fabric: fabrics.text,
    hsn: style.hsnCode?.trim() ? style.hsnCode.trim() : EM_DASH,
    wholesale: fmtMoney(style.costPrice != null ? Number(style.costPrice) : null),
    mrp: fmtMoney(style.sellingPrice != null ? Number(style.sellingPrice) : null),
  };
}

/** Rows → pages. Page one is shorter because it carries section 01. */
function paginate(rows: LineSheetRow[], summary: LineSheetSummary): LineSheetPage[] {
  const chunks: LineSheetRow[][] = [];
  let cursor = 0;
  while (cursor < rows.length) {
    const size = chunks.length === 0 ? FIRST_PAGE_ROWS : PAGE_ROWS;
    chunks.push(rows.slice(cursor, cursor + size));
    cursor += size;
  }
  if (chunks.length === 0) chunks.push([]);

  const pages: LineSheetPage[] = chunks.map((chunk, index) => {
    const from = index === 0 ? 1 : FIRST_PAGE_ROWS + (index - 1) * PAGE_ROWS + 1;
    return {
      pageNo: index + 1,
      isFirst: index === 0,
      rangeLabel: `Styles ${from}–${from + chunk.length - 1} of ${rows.length}`,
      rows: chunk,
      summary: null,
    };
  });

  // The summary rides on the last page when there is room, otherwise it takes
  // a sheet of its own — it must never be the thing that overflows a page.
  const last = pages[pages.length - 1];
  const capacity = pages.length === 1 ? FIRST_PAGE_ROWS : PAGE_ROWS;
  if (last.rows.length <= capacity - SUMMARY_ROW_COST) {
    last.summary = summary;
  } else {
    pages.push({
      pageNo: pages.length + 1,
      isFirst: false,
      rangeLabel: `${rows.length} styles`,
      rows: [],
      summary,
    });
  }
  return pages;
}

export async function buildLineSheetDocData(idArg: string): Promise<LineSheetDocData> {
  const selection = parseStyleSelection(idArg);
  if (!hasSelection(selection)) {
    throw new BusinessError(
      'Line sheet needs a selection: pass comma-separated style ids or codes, or a filter token such as brand=, season=, category='
    );
  }

  const [company, styles] = await Promise.all([
    buildCompanyBlock(),
    prisma.styles.findMany({
      where: buildStyleWhere(selection),
      include: styleDocInclude,
      orderBy: [{ styleCode: 'asc' }],
      take: resolveTake(selection),
    }),
  ]);

  if (styles.length === 0) throw new NotFoundError('Styles for line sheet', selection.raw);

  const rows = styles.map((style, index) => buildRow(style, index + 1));

  const wholesale = priceBand(styles.filter((s) => s.costPrice != null).map((s) => Number(s.costPrice)));
  const mrp = priceBand(styles.filter((s) => s.sellingPrice != null).map((s) => Number(s.sellingPrice)));
  const wholesaleCount = styles.filter((s) => s.costPrice != null).length;
  const mrpCount = styles.filter((s) => s.sellingPrice != null).length;
  const imagesShown = rows.filter((r) => r.imageUrl !== null).length;

  const summary: LineSheetSummary = {
    styleCount: rows.length,
    styleCountIsOne: rows.length === 1,
    wholesaleBand: bandLabel(wholesale),
    wholesaleSub: wholesale ? `${wholesaleCount} of ${rows.length} styles priced` : 'not published',
    mrpBand: bandLabel(mrp),
    mrpSub: mrp ? `${mrpCount} of ${rows.length} styles priced` : 'not published',
    imagesShown,
    imagesMissing: rows.length - imagesShown,
  };

  const pages = paginate(rows, summary);

  const seasons = Array.from(
    new Set(styles.map((s) => styleSeason(s)).filter((s): s is string => !!s && s.length > 0))
  );
  const categories = Array.from(
    new Set(
      styles
        .map((s) => s.product_category?.name ?? s.brand_categories?.category ?? null)
        .filter((c): c is string => !!c && c.length > 0)
    )
  );

  const generatedAt = new Date();
  const priced = wholesaleCount > 0 || mrpCount > 0;

  return {
    company,
    docNo: docReference('LS', generatedAt, rows.length),
    docPill: priced ? 'Wholesale · ₹ per piece' : 'Wholesale · prices on request',
    collectionLabel: selection.title ?? selection.collection ?? 'Current range',
    preparedFor: selection.buyer,
    seasonLabel: seasons.length > 0 ? seasons.join(', ') : EM_DASH,
    categoryLabel:
      categories.length > 0
        ? categories.slice(0, 4).join(', ') + (categories.length > 4 ? ` +${categories.length - 4}` : '')
        : EM_DASH,
    issuedOn: fmtDate(generatedAt),
    styleCount: rows.length,
    priceNote: priced ? 'Wholesale and MRP where published' : 'Prices on request',
    pages,
    pageCount: pages.length,
    summary,
  };
}
