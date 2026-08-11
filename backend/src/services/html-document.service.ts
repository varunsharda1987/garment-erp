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

export type KfTemplateName =
  | 'job-work-order'
  | 'challan'
  | 'grn'
  | 'purchase-order'
  | 'tax-invoice'
  | 'report-job-work-ageing'
  | 'report-itc-04'
  | 'report-vendor-performance'
  // Phase B (kf-style templates authored in-house)
  | 'proforma-invoice'
  | 'order-form'
  | 'transfer-slip'
  | 'cutting-chart'
  | 'tech-pack'
  | 'line-sheet'
  | 'catalogue';

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

hb.registerHelper('dateDMY', (value: unknown): string => {
  if (!value) return EM_DASH;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
});

hb.registerHelper('qty', (value: unknown, uom?: unknown): string => {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  const unit = typeof uom === 'string' ? uom.toUpperCase() : '';
  const integerUnits = ['PCS', 'PIECE', 'PIECES', 'CONE', 'CONES', 'NOS', 'SET', 'TRIP'];
  const digits = integerUnits.includes(unit) ? 0 : 2;
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
});

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
  /** Copy marks — the template renders one .sheet per entry (Rule-55 triplicate) */
  copies?: string[];
  timeoutMs?: number;
}

export async function renderDocument(
  template: KfTemplateName,
  data: Record<string, unknown>,
  opts?: RenderDocumentOptions
): Promise<Buffer> {
  const compiled = getTemplate(template);
  const renderData: Record<string, unknown> = { ...data };
  if (opts?.copies?.length) {
    renderData.copies = opts.copies.map((copyMark) => ({ copyMark }));
  }
  const html = compiled(renderData);
  // Rendered next to its assets: the renderer writes a temp .html in TEMPLATE_DIR
  // and navigates to it, so `assets/base.css` and fonts resolve as real files.
  return htmlToPdf(html, { timeoutMs: opts?.timeoutMs, baseDir: TEMPLATE_DIR });
}
