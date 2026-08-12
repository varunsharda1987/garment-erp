/**
 * Shared plumbing for the two image-led, MULTI-STYLE kf documents —
 * line-sheet.doc-data.ts and catalogue.doc-data.ts.
 *
 * Everything here exists because those two documents differ from every
 * single-record Phase A adapter in three ways:
 *
 *  1. They take a SET of styles, not one id (see parseStyleSelection).
 *  2. They print photographs. The renderer writes the HTML into
 *     backend/templates/kf/ and navigates to it as a real file:// URL, so a
 *     relative "uploads/..." path in the template would resolve against the
 *     TEMPLATE directory and 404. Image paths are therefore resolved to
 *     absolute file:// URLs HERE, in the adapter — never in the template —
 *     and a file that is not on disk resolves to null so the template can
 *     render a clean empty plate instead of a broken-image box.
 *  3. They are multi-page. Both adapters paginate their own content and emit
 *     one `.sheet` per printed page, which is what makes "Page n of m" true
 *     and stops a card from ever splitting across a page break.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Prisma } from '@prisma/client';
import { EM_DASH } from './format';

// document-data → services → src|dist → backend  (works from ts-node and dist/)
const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads');

/** One root query's worth of style detail — every field either document prints. */
export const styleDocInclude = {
  brand_categories: { select: { brandName: true, category: true, subCategory: true } },
  product_category: { select: { name: true } },
  season_master: { select: { code: true, name: true } },
  size_options: {
    where: { isActive: true },
    select: { sizeName: true, sizeCode: true },
    orderBy: { sortOrder: 'asc' },
  },
  color_options: {
    where: { isActive: true },
    select: { colorName: true, colorCode: true },
    orderBy: { sortOrder: 'asc' },
  },
  style_variants: {
    where: { isActive: true },
    select: { colorName: true, sizeName: true },
    orderBy: { sortOrder: 'asc' },
  },
  styleImages: {
    select: { imageUrl: true, imageType: true },
    orderBy: { sortOrder: 'asc' },
  },
  style_components: {
    select: {
      componentName: true,
      style_fabrics: {
        select: {
          fabricName: true,
          fabricType: true,
          fabricGSM: true,
          fabricColor: true,
          printDesign: true,
          fabric: { select: { fabricName: true, actualGSM: true, colorName: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.stylesInclude;

export type StyleDocRecord = Prisma.stylesGetPayload<{ include: typeof styleDocInclude }>;

// ---------------------------------------------------------------------------
// Selection argument
// ---------------------------------------------------------------------------

/**
 * Both documents are multi-style, but the dev preview script (and the future
 * endpoint's `:id` slot) hands over ONE string. Convention: that string is a
 * COMMA-SEPARATED token list, where a token is either
 *
 *   • a style id (uuid) or a style CODE      — "ESSKY062LS,COS173"
 *   • a filter    key=value                  — "brand=Easybuy,limit=12"
 *   • a bare flag                            — "prices", "noprices", "index"
 *
 * Ids/codes and filters can be mixed; filters are AND-ed, ids and codes are
 * OR-ed with each other. An empty selection is rejected rather than silently
 * printing the whole style master.
 */
export interface StyleSelection {
  ids: string[];
  codes: string[];
  season: string | null;
  brand: string | null;
  category: string | null;
  limit: number | null;
  title: string | null;
  buyer: string | null;
  collection: string | null;
  flags: Set<string>;
  raw: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_RE = /^c[a-z0-9]{20,}$/i;
const FLAG_TOKENS = new Set(['prices', 'noprices', 'index', 'noindex']);

export function parseStyleSelection(idArg: string | undefined | null): StyleSelection {
  const raw = (idArg ?? '').trim();
  const sel: StyleSelection = {
    ids: [],
    codes: [],
    season: null,
    brand: null,
    category: null,
    limit: null,
    title: null,
    buyer: null,
    collection: null,
    flags: new Set<string>(),
    raw,
  };

  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const key = t.slice(0, eq).trim().toLowerCase();
      const value = t.slice(eq + 1).trim();
      if (!value) continue;
      switch (key) {
        case 'season':
          sel.season = value;
          break;
        case 'brand':
          sel.brand = value;
          break;
        case 'category':
        case 'cat':
          sel.category = value;
          break;
        case 'limit': {
          const n = Number.parseInt(value, 10);
          if (Number.isFinite(n) && n > 0) sel.limit = n;
          break;
        }
        case 'title':
          sel.title = value;
          break;
        case 'buyer':
        case 'for':
          sel.buyer = value;
          break;
        case 'collection':
          sel.collection = value;
          break;
        default:
          break; // unknown key — ignored, never guessed at
      }
      continue;
    }
    if (UUID_RE.test(t) || CUID_RE.test(t)) {
      sel.ids.push(t);
    } else if (/^[a-z]+$/i.test(t) && FLAG_TOKENS.has(t.toLowerCase())) {
      sel.flags.add(t.toLowerCase());
    } else {
      sel.codes.push(t);
    }
  }
  return sel;
}

export function hasSelection(sel: StyleSelection): boolean {
  return (
    sel.ids.length > 0 || sel.codes.length > 0 || sel.season !== null || sel.brand !== null || sel.category !== null
  );
}

/** Where-clause for the single root query. Ids/codes OR-ed, filters AND-ed. */
export function buildStyleWhere(sel: StyleSelection): Prisma.stylesWhereInput {
  const and: Prisma.stylesWhereInput[] = [];

  const idOr: Prisma.stylesWhereInput[] = [];
  if (sel.ids.length > 0) idOr.push({ id: { in: sel.ids } });
  if (sel.codes.length > 0) idOr.push({ styleCode: { in: sel.codes } });
  if (idOr.length > 0) and.push({ OR: idOr });

  if (sel.season) {
    and.push({
      OR: [
        { season: { contains: sel.season, mode: 'insensitive' } },
        { season_master: { is: { code: { equals: sel.season, mode: 'insensitive' } } } },
        { season_master: { is: { name: { contains: sel.season, mode: 'insensitive' } } } },
      ],
    });
  }
  if (sel.brand) {
    and.push({
      OR: [
        { brandName: { contains: sel.brand, mode: 'insensitive' } },
        { brand_categories: { is: { brandName: { contains: sel.brand, mode: 'insensitive' } } } },
      ],
    });
  }
  if (sel.category) {
    and.push({
      OR: [
        { product_category: { is: { name: { contains: sel.category, mode: 'insensitive' } } } },
        { brand_categories: { is: { category: { contains: sel.category, mode: 'insensitive' } } } },
      ],
    });
  }

  return { isActive: true, ...(and.length > 0 ? { AND: and } : {}) };
}

/** Hard ceiling — these documents embed photographs; an unbounded set kills the renderer. */
export const MAX_STYLES = 120;
const DEFAULT_FILTER_LIMIT = 48;

export function resolveTake(sel: StyleSelection): number {
  const explicit = sel.ids.length + sel.codes.length;
  if (sel.limit !== null) return Math.min(sel.limit, MAX_STYLES);
  if (explicit > 0) return Math.min(explicit, MAX_STYLES);
  return DEFAULT_FILTER_LIMIT;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Absolute file:// URL for a style photograph, or null when nothing is on disk.
 *
 * Candidate order matches the pdfkit generators this replaces: a MAIN style_images
 * row, then any other style_images row, then styles.imageUrl, then styles.image.
 * Each candidate is tried as a path relative to the backend root ("uploads/styles/x.jpg")
 * and then by basename under uploads/styles (legacy rows that stored only a filename).
 * Anything that resolves outside uploads/ is refused.
 */
export function resolveStyleImageUrl(style: StyleDocRecord): string | null {
  const images = style.styleImages ?? [];
  const main = images.find((img) => img.imageType === 'MAIN');
  const candidates = [
    main?.imageUrl,
    ...images.filter((img) => img !== main).map((img) => img.imageUrl),
    style.imageUrl,
    style.image,
  ];

  for (const candidate of candidates) {
    const abs = toExistingUploadPath(candidate);
    if (abs) return pathToFileURL(abs).href;
  }
  return null;
}

function toExistingUploadPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const cleaned = candidate.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned) return null;

  const direct = path.resolve(BACKEND_ROOT, cleaned);
  if (isInsideUploads(direct) && fileExists(direct)) return direct;

  const byName = path.resolve(UPLOADS_ROOT, 'styles', path.basename(cleaned));
  if (isInsideUploads(byName) && fileExists(byName)) return byName;

  return null;
}

function isInsideUploads(target: string): boolean {
  const root = path.resolve(UPLOADS_ROOT);
  return target === root || target.startsWith(root + path.sep);
}

function fileExists(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Field extraction — every one of these omits cleanly rather than inventing
// ---------------------------------------------------------------------------

export interface ListSummary {
  text: string; // joined, already truncated
  count: number;
  extra: number; // how many were not shown
}

function summarise(values: string[], max: number): ListSummary {
  const unique: string[] = [];
  for (const value of values) {
    const v = value.trim();
    if (v.length > 0 && !unique.includes(v)) unique.push(v);
  }
  if (unique.length === 0) return { text: EM_DASH, count: 0, extra: 0 };
  const shown = unique.slice(0, max);
  return { text: shown.join(', '), count: unique.length, extra: unique.length - shown.length };
}

/**
 * Colourways. color_options is the style's own colour list; style_variants
 * colour names are the fallback (that is where the pdfkit line sheet read
 * them). Neither is invented — a style with no colour rows prints an em-dash.
 */
export function styleColours(style: StyleDocRecord, max = 4): ListSummary {
  const fromOptions = style.color_options.map((c) => c.colorName);
  if (fromOptions.length > 0) return summarise(fromOptions, max);
  const fromVariants = style.style_variants.map((v) => v.colorName ?? '').filter((n) => n.length > 0);
  return summarise(fromVariants, max);
}

/** Size range: size_options in sort order, variant size names as fallback. */
export function styleSizes(style: StyleDocRecord, max = 8): ListSummary {
  const fromOptions = style.size_options.map((s) => s.sizeName);
  if (fromOptions.length > 0) return summarise(fromOptions, max);
  const fromVariants = style.style_variants.map((v) => v.sizeName ?? '').filter((n) => n.length > 0);
  return summarise(fromVariants, max);
}

/** Fabrics, via style_components → style_fabrics (linked master name wins). */
export function styleFabrics(style: StyleDocRecord, max = 2): ListSummary {
  const names = style.style_components.flatMap((component) =>
    component.style_fabrics.map((sf) => {
      const name = sf.fabric?.fabricName ?? sf.fabricName ?? '';
      if (!name) return '';
      const gsm = sf.fabricGSM ?? (sf.fabric?.actualGSM != null ? `${sf.fabric.actualGSM}` : null);
      return gsm ? `${name} ${gsm} GSM` : name;
    })
  );
  return summarise(names, max);
}

export function styleCategory(style: StyleDocRecord): string | null {
  return style.product_category?.name ?? style.brand_categories?.category ?? null;
}

export function styleBrand(style: StyleDocRecord): string | null {
  return style.brand_categories?.brandName ?? style.brandName ?? null;
}

export function styleSeason(style: StyleDocRecord): string | null {
  const master = style.season_master;
  if (master) return master.code ? `${master.code}` : master.name;
  const own = style.season?.trim();
  return own && own.length > 0 ? own : null;
}

/** "Dresses · Easybuy · SS26" — only the parts that exist. */
export function styleMetaLine(style: StyleDocRecord): string | null {
  const bits = [styleCategory(style), styleBrand(style), styleSeason(style)].filter(
    (b): b is string => !!b && b.length > 0
  );
  return bits.length > 0 ? bits.join(' · ') : null;
}

/** Document reference: LS-20260812-11 / CAT-20260812-11. Deterministic, not stored. */
export function docReference(prefix: string, generatedAt: Date, styleCount: number): string {
  const y = generatedAt.getFullYear();
  const m = `${generatedAt.getMonth() + 1}`.padStart(2, '0');
  const d = `${generatedAt.getDate()}`.padStart(2, '0');
  return `${prefix}-${y}${m}${d}-${styleCount}`;
}
