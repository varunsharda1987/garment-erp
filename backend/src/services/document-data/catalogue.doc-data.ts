/**
 * Catalogue — data adapter for the kf catalogue template.
 *
 * The presentation piece: a cover, an optional index when the selection is
 * large, then four large photo cards a page. Same firm as the challan and the
 * tax invoice — same typography, same single terracotta accent — just more air.
 *
 * MULTI-STYLE and MULTI-PAGE. One root Prisma query; pagination happens HERE
 * and the template emits one `.sheet` per printed page, so the index can quote
 * real page numbers and a card is never split across a break.
 *
 * Selection argument (single string — see parseStyleSelection):
 *     "<uuid>,<uuid>"                     explicit styles by id
 *     "ESSKY062LS,COS173"                 explicit styles by code
 *     "brand=Easybuy,limit=24,prices"     filters + flags
 * Flags: `prices`/`noprices` toggle price display (OFF by default — a
 * catalogue is shown to people who are not always allowed to see prices);
 * `index`/`noindex` force the index page on or off (auto above 12 styles).
 *
 * A4 PORTRAIT — the shared renderer prints puppeteer `format:'A4'` without
 * preferCSSPageSize, so a CSS landscape @page would be ignored and clipped.
 */
import prisma from '../../config/database';
import { BusinessError, NotFoundError } from '../../errors';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
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
  styleCategory,
  styleColours,
  styleDocInclude,
  styleFabrics,
  styleSeason,
  styleSizes,
} from './style-doc-common';

// Page budget (Chrome A4 = 794x1123 CSS px, base.css leaves 10mm padding ⇒
// ~1047px of sheet): four 318px-plate cards fill a card page; an index row is
// ~21px, so 34 keeps a comfortable margin under the masthead and footer.
const CARDS_PER_PAGE = 4;
const INDEX_ROWS_PER_PAGE = 34;
const INDEX_AUTO_THRESHOLD = 12;

export interface CatalogueCard {
  sn: number;
  imageUrl: string | null; // absolute file:// URL, or null → empty plate
  code: string;
  buyerRef: string | null;
  name: string;
  seasonLabel: string | null;
  category: string | null;
  colours: string | null;
  sizes: string | null;
  fabric: string | null;
  wholesale: string | null; // already formatted; null = nothing to print
  mrp: string | null;
}

export interface CatalogueCardPage {
  pageNo: number;
  rangeLabel: string;
  continued: boolean;
  cards: CatalogueCard[];
}

export interface CatalogueIndexRow {
  sn: number;
  code: string; // styleCode (buyer ref)
  name: string;
  category: string;
  pageNo: number; // the real sheet the card sits on
}

export interface CatalogueIndexPage {
  pageNo: number;
  continued: boolean;
  rows: CatalogueIndexRow[];
}

export interface CatalogueDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  title: string;
  seasonLabel: string | null;
  collectionLabel: string | null;
  preparedFor: string | null;
  issuedOn: string;
  styleCount: number;
  styleCountIsOne: boolean;
  /** True only when the caller asked for prices AND at least one style has one. */
  showPrices: boolean;
  showIndex: boolean;
  categoryLabel: string;
  indexPages: CatalogueIndexPage[];
  cardPages: CatalogueCardPage[];
  pageCount: number;
}

function nullIfDash(value: string): string | null {
  return value === EM_DASH ? null : value;
}

function buildCard(style: StyleDocRecord, sn: number, showPrices: boolean): CatalogueCard {
  const colours = styleColours(style, 3);
  const sizes = styleSizes(style, 8);
  const fabrics = styleFabrics(style, 2);
  const wholesale = style.costPrice != null ? fmtMoney(Number(style.costPrice)) : null;
  const mrp = style.sellingPrice != null ? fmtMoney(Number(style.sellingPrice)) : null;
  return {
    sn,
    imageUrl: resolveStyleImageUrl(style),
    code: style.styleCode,
    buyerRef: style.buyerStyleRef?.trim() ? style.buyerStyleRef.trim() : null,
    name: style.styleName,
    seasonLabel: styleSeason(style),
    category: styleCategory(style),
    colours: nullIfDash(colours.text),
    sizes: nullIfDash(sizes.text),
    fabric: nullIfDash(fabrics.text),
    wholesale: showPrices ? wholesale : null,
    mrp: showPrices ? mrp : null,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length > 0 ? out : [[]];
}

export async function buildCatalogueDocData(idArg: string): Promise<CatalogueDocData> {
  const selection = parseStyleSelection(idArg);
  if (!hasSelection(selection)) {
    throw new BusinessError(
      'Catalogue needs a selection: pass comma-separated style ids or codes, or a filter token such as brand=, season=, category='
    );
  }

  const [company, styles] = await Promise.all([
    buildCompanyBlock(),
    prisma.styles.findMany({
      where: buildStyleWhere(selection),
      include: styleDocInclude,
      orderBy: [{ brandCategoryId: 'asc' }, { styleCode: 'asc' }],
      take: resolveTake(selection),
    }),
  ]);

  if (styles.length === 0) throw new NotFoundError('Styles for catalogue', selection.raw);

  const showPrices = selection.flags.has('prices') && !selection.flags.has('noprices');
  const showIndex = selection.flags.has('index')
    ? true
    : selection.flags.has('noindex')
      ? false
      : styles.length >= INDEX_AUTO_THRESHOLD;

  const cards = styles.map((style, index) => buildCard(style, index + 1, showPrices));

  // Sheet numbering: cover is 1, then index pages, then card pages. Computed
  // before the rows are built so the index can quote the true page number.
  const cardChunks = chunk(cards, CARDS_PER_PAGE);
  const indexPageCount = showIndex ? Math.ceil(cards.length / INDEX_ROWS_PER_PAGE) : 0;
  const firstCardPageNo = 1 + indexPageCount + 1;

  const cardPages: CatalogueCardPage[] = cardChunks.map((group, index) => {
    const from = index * CARDS_PER_PAGE + 1;
    return {
      pageNo: firstCardPageNo + index,
      rangeLabel: `${from}–${from + group.length - 1} of ${cards.length}`,
      continued: index > 0,
      cards: group,
    };
  });

  const indexRows: CatalogueIndexRow[] = cards.map((card, index) => ({
    sn: card.sn,
    code: formatStyleCodeWithRef(card.code, card.buyerRef),
    name: card.name,
    category: card.category ?? EM_DASH,
    pageNo: firstCardPageNo + Math.floor(index / CARDS_PER_PAGE),
  }));

  const indexPages: CatalogueIndexPage[] = showIndex
    ? chunk(indexRows, INDEX_ROWS_PER_PAGE).map((rows, index) => ({
        pageNo: 2 + index,
        continued: index > 0,
        rows,
      }))
    : [];

  const seasons = Array.from(
    new Set(styles.map((s) => styleSeason(s)).filter((s): s is string => !!s && s.length > 0))
  );
  const categories = Array.from(
    new Set(styles.map((s) => styleCategory(s)).filter((c): c is string => !!c && c.length > 0))
  );

  const generatedAt = new Date();
  // The pill only claims prices when a price is actually printed — showPrices
  // is the caller's intent, not evidence that any style carries a price.
  const pricesPrinted = cards.some((card) => card.wholesale !== null || card.mrp !== null);
  const categoryLabel =
    categories.length > 0
      ? categories.slice(0, 4).join(', ') + (categories.length > 4 ? ` +${categories.length - 4}` : '')
      : EM_DASH;

  return {
    company,
    docNo: docReference('CAT', generatedAt, cards.length),
    docPill: pricesPrinted ? 'Presentation copy · ₹ per piece' : 'Presentation copy',
    title: selection.title ?? 'Catalogue',
    seasonLabel: seasons.length > 0 ? seasons.join(' · ') : null,
    collectionLabel: selection.collection ?? (categories.length > 0 ? categoryLabel : null),
    preparedFor: selection.buyer,
    issuedOn: fmtDate(generatedAt),
    styleCount: cards.length,
    styleCountIsOne: cards.length === 1,
    showPrices: pricesPrinted,
    showIndex,
    categoryLabel,
    indexPages,
    cardPages,
    pageCount: 1 + indexPages.length + cardPages.length,
  };
}
