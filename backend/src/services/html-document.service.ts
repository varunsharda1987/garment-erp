/**
 * KF document template registry (kf-documents design system).
 *
 * Templates are committed Handlebars files under backend/templates/kf/ —
 * one HTML file per document, all importing the shared assets/base.css
 * (SKILL rule: never fork the stylesheet). This module compiles/caches
 * them, injects a file:// <base> so css/font relative paths resolve, and
 * hands the final HTML to the Chrome renderer.
 */
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { htmlToPdf } from './html-renderer.service';
import { roundToCent } from '../utils/currency';
import { formatDate } from '../utils/date';
import { fmtQty } from './document-data/format';

export type KfTemplateName =
  | 'job-work-order'
  | 'challan'
  | 'grn'
  | 'purchase-order'
  | 'tax-invoice'
  | 'report-job-work-ageing'
  | 'report-itc-04'
  | 'report-vendor-performance'
  | 'report-processor-statement'
  | 'report-material-ledger'
  // Phase B (kf-style templates authored in-house)
  | 'proforma-invoice'
  | 'order-form'
  | 'transfer-slip'
  | 'cutting-chart'
  | 'tech-pack'
  | 'line-sheet'
  | 'catalogue'
  | 'cost-sheet'
  // Phase C — a BUYER's own form reproduced, not a kf document. Same design system, but the
  // layout and wording belong to the buyer and must match what their lab expects.
  | 'buyer-trf';

// Resolves from both src/ (ts-node/tests) and dist/ (production build)
const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'kf');

const EM_DASH = '—';

// ---------------------------------------------------------------------------
// Handlebars helpers — shared formatting for every document.
// Money: en-IN grouping, 2dp via roundToCent; null/undefined renders an
// em-dash (a real 0 renders as 0.00 — never || on money).
// ---------------------------------------------------------------------------
const hb = Handlebars.create();

hb.registerHelper('inr', (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return roundToCent(n).toNumber().toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

// No template in backend/templates/kf/*.hbs currently calls this — the adapters pre-format dates
// via fmtDate before the template ever sees them. Kept (rather than deleted) so that if a template
// ever does call it, it produces the same `19-Sep-2026` as everything else instead of drifting.
hb.registerHelper('dateDMY', (value: unknown): string => formatDate(value as Date | string | null | undefined));

// Same rule as the adapters' fmtQty (whole numbers for counted units, per the unit registry).
// Handlebars passes its options hash last, so a call with no uom arrives here as an object.
hb.registerHelper('qty', (value: unknown, uom?: unknown): string =>
  fmtQty(value as number | string | null | undefined, typeof uom === 'string' ? uom : null)
);

hb.registerHelper('pct', (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
});

hb.registerHelper('upper', (value: unknown): string => (value == null ? '' : String(value).toUpperCase()));

hb.registerHelper('idx1', (index: unknown): number => Number(index) + 1);

hb.registerHelper('dash', (value: unknown): string => {
  if (value === null || value === undefined || value === '') return EM_DASH;
  return String(value);
});

// ---------------------------------------------------------------------------
// Template loading with mtime-based cache invalidation (instant iteration in
// dev; effectively load-once in production where files never change).
// ---------------------------------------------------------------------------
interface CachedTemplate {
  compiled: Handlebars.TemplateDelegate;
  mtimeMs: number;
}
const cache = new Map<string, CachedTemplate>();
let partialsRegisteredAt = 0;

function registerPartials(): void {
  const partialsDir = path.join(TEMPLATE_DIR, 'partials');
  if (!fs.existsSync(partialsDir)) return;
  let newest = 0;
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith('.hbs')) continue;
    const full = path.join(partialsDir, file);
    newest = Math.max(newest, fs.statSync(full).mtimeMs);
  }
  if (newest <= partialsRegisteredAt) return;
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith('.hbs')) continue;
    const name = path.basename(file, '.hbs');
    hb.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), 'utf8'));
  }
  partialsRegisteredAt = newest;
}

function getTemplate(name: KfTemplateName): Handlebars.TemplateDelegate {
  const file = path.join(TEMPLATE_DIR, `${name}.hbs`);
  const mtimeMs = fs.statSync(file).mtimeMs;
  const cached = cache.get(name);
  if (cached && cached.mtimeMs === mtimeMs) return cached.compiled;
  registerPartials();
  const compiled = hb.compile(fs.readFileSync(file, 'utf8'));
  cache.set(name, { compiled, mtimeMs });
  return compiled;
}

export interface RenderDocumentOptions {
  /**
   * Copy marks — the template renders one .sheet per entry (Rule-55 triplicate).
   * A plain string becomes `{ copyMark }`; an object may carry extra per-copy flags
   * the template branches on (e.g. the JWO's `processorCopy` trimming internal sections).
   */
  copies?: Array<string | { copyMark: string; [key: string]: unknown }>;
  timeoutMs?: number;
  /** A4 landscape instead of portrait — the template must size its .sheet to 297 × 210 mm */
  landscape?: boolean;
}

export async function renderDocument(
  template: KfTemplateName,
  data: Record<string, unknown>,
  opts?: RenderDocumentOptions
): Promise<Buffer> {
  const compiled = getTemplate(template);
  const renderData: Record<string, unknown> = { ...data };
  if (opts?.copies?.length) {
    renderData.copies = opts.copies.map((copy) => (typeof copy === 'string' ? { copyMark: copy } : copy));
  }
  const html = compiled(renderData);
  // Rendered next to its assets: the renderer writes a temp .html in TEMPLATE_DIR
  // and navigates to it, so `assets/base.css` and fonts resolve as real files.
  return htmlToPdf(html, { timeoutMs: opts?.timeoutMs, baseDir: TEMPLATE_DIR, landscape: opts?.landscape });
}
