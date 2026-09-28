/**
 * Propose an HSN code for every active material that has none (2026-09-28).
 *
 * None of the active materials carried an HSN code or a GST rate, and tax_masters is empty, so every PO
 * line was taxed at gst.service's last-resort 5% — buttons, zippers, poly bags and cartons included,
 * which are 18% in our own HSN master. The PO form now pre-fills a line's GST from the material's HSN;
 * this fills the HSN.
 *
 * Owner decision (28-Sep-2026): the table comes FIRST and nothing is written until the owner /
 * accountant has read it. So the dry run is the deliverable: per material, the proposed code, the rate
 * the HSN master gives it, and the evidence it came from (label type, packaging type, composition…).
 * A material with no usable evidence is listed under "Needs a person" and never guessed.
 *
 * Only codes the HSN master knows are proposed (exact code, or a chapter row the way gst.service looks
 * one up) — a code that is not there goes to "Needs a person" with a note to add it on HSN/SAC Codes.
 *
 * --apply writes materials.hsnCode ONLY (never gstRate: the rate follows from the HSN master, and a
 * material's own gstRate would override every later change to it), only on rows still without one, in
 * one transaction, after saving the old values to fill-material-hsn-snapshot-<time>.json next to this
 * script. --only lets the owner approve one material type at a time.
 *
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts                         (dry run)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --out <file.md>         (dry run, table to <file.md>)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --only LABEL,PACKAGING  (dry run, those types)
 *   cd backend && npx ts-node scripts/fill-material-hsn.ts --apply --only BUTTON   (write, after approval)
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MaterialType } from '@prisma/client';
import prisma from '../src/config/database';
import { MASTER_CONFIG } from '../src/services/helpers/master-config';
import { formatDateTime24 } from '../src/utils/date';

const APPLY = process.argv.includes('--apply');

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const OUT = argValue('--out') ?? path.join(os.tmpdir(), 'fill-material-hsn-dry-run.md');
const ONLY: MaterialType[] | null = (() => {
  const raw = argValue('--only');
  if (raw === null) return null;
  const types = raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  const unknown = types.filter((t) => !(t in MaterialType));
  if (unknown.length > 0 || types.length === 0) {
    throw new Error(`--only takes material types, e.g. --only LABEL,PACKAGING (unknown: ${unknown.join(', ') || 'none given'})`);
  }
  return types as MaterialType[];
})();

type MasterRow = Record<string, unknown>;

interface Proposal {
  hsn: string | null;
  /** Groupable rule — the summary table groups on it */
  rule: string;
  /** This row's own evidence (composition, label, GSM…) */
  detail?: string;
}

interface Line {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  hsn: string | null;
  rate: number | null;
  rule: string;
  detail: string;
}

/** Lower-cased words of every non-empty value — the text a rule looks for evidence in. */
function words(...values: unknown[]): string {
  return values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
    .map((v) => String(v).toLowerCase())
    .join(' ');
}

const quote = (label: string, value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== '' ? `${label} "${String(value).trim()}"` : null;
const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join('; ');

const METAL = /\b(metal|brass|steel|iron|alloy|zinc|aluminium|aluminum|nickel|copper)\b/;
const PLASTIC = /\b(plastic|acrylic|resin|pu|polyurethane|pvc|abs|acetal|nylon)\b/;

// ─── Woven / knitted fabric (GREIGE, FABRIC) ────────────────────────────────────────────────────

type Fibre = 'silk' | 'wool' | 'cotton' | 'flax' | 'synthetic' | 'artificial' | 'metallic';

// Order matters: "art silk" is viscose, not silk
const FIBRE_WORDS: Array<{ fibre: Fibre; re: RegExp }> = [
  { fibre: 'artificial', re: /art\.?\s*silk|viscose|rayon|modal|lyocell|tencel|cupro|acetate|bamboo/ },
  { fibre: 'silk', re: /silk/ },
  { fibre: 'cotton', re: /cotton/ },
  { fibre: 'flax', re: /flax|linen/ },
  { fibre: 'wool', re: /wool/ },
  { fibre: 'synthetic', re: /polyester|polyster|\bpoly\b|nylon|polyamide|acrylic|spandex|elastane|lycra/ },
  { fibre: 'metallic', re: /lurex|zari|metallic/ },
];

// Section XI note 2: when two fibres weigh the same, the fabric goes under the heading that comes LAST
const TIE_ORDER: Fibre[] = ['silk', 'wool', 'cotton', 'flax', 'synthetic', 'artificial'];

const fibreOf = (text: string): Fibre | null => FIBRE_WORDS.find((f) => f.re.test(text))?.fibre ?? null;

/** A fibre named in a material's NAME is a hint for the person filling the master — never a proposal. */
function nameHint(text: string): string | undefined {
  for (const f of FIBRE_WORDS) {
    const found = text.match(f.re);
    if (found) return `name says "${found[0]}" — fill the composition on the master and re-run`;
  }
  return undefined;
}

/** "60%Viscose40%Nylon" → viscose 60, nylon 40. One fibre we cannot name spoils the whole reading. */
function parseComposition(raw: string): Array<{ fibre: Fibre; pct: number }> {
  const text = raw.toLowerCase();
  const parts = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([a-z .]+)/g));
  if (parts.length === 0) {
    const fibre = fibreOf(text);
    return fibre ? [{ fibre, pct: 100 }] : [];
  }
  const out: Array<{ fibre: Fibre; pct: number }> = [];
  for (const [, share, name] of parts) {
    const fibre = fibreOf(name);
    if (!fibre) return [];
    const same = out.find((x) => x.fibre === fibre);
    if (same) same.pct += Number(share);
    else out.push({ fibre, pct: Number(share) });
  }
  return out;
}

/** Highest number recorded — "120-130" reads 130, so a range that crosses 200 g/m² counts as heavy. */
function gsmOf(...values: unknown[]): number | null {
  for (const v of values) {
    const found = String(v ?? '').match(/\d+(?:\.\d+)?/g);
    if (found) return Math.max(...found.map(Number));
  }
  return null;
}

function wovenFabric(opts: { composition: string | null; compositionFrom: string; gsm: number | null; text: string }): Proposal {
  const { text, gsm } = opts;
  const embroidered = /\bemb\b|embroider/.test(text)
    ? 'name says embroidered — if it is bought already embroidered, 5810 (embroidery in the piece) applies instead'
    : null;

  // The kind of fabric decides before its fibre: a net is 5804 whatever it is made of
  if (/\b(net|tulle)\b/.test(text)) {
    return { hsn: '5804', rule: 'net fabric (by name) → 5804 tulle & net fabrics', detail: join(quote('composition', opts.composition)) };
  }
  if (/\b(knit|knitted|jersey|interlock|rib|pique|fleece)\b/.test(text)) {
    return { hsn: '6006', rule: 'knitted fabric (by name / weave) → 6006', detail: join(quote('composition', opts.composition)) };
  }
  if (!opts.composition || opts.composition.trim() === '') {
    return { hsn: null, rule: 'composition not recorded on the master', detail: nameHint(text) };
  }

  const fibres = parseComposition(opts.composition);
  const from = `composition "${opts.composition.trim()}" (${opts.compositionFrom})`;
  if (fibres.length === 0) return { hsn: null, rule: 'composition not understood', detail: from };

  const weighed = fibres.filter((f) => f.fibre !== 'metallic');
  if (weighed.length === 0) return { hsn: null, rule: 'metallic yarn only — needs a person', detail: from };
  const main = [...weighed].sort((a, b) => b.pct - a.pct || TIE_ORDER.indexOf(b.fibre) - TIE_ORDER.indexOf(a.fibre))[0];
  const tie = weighed.some((f) => f !== main && f.pct === main.pct) ? 'equal shares go to the later heading' : null;
  const gsmNote = gsm === null ? 'GSM not recorded — assumed ≤200 g/m²' : `${gsm} g/m²`;
  const heavy = gsm !== null && gsm > 200;

  switch (main.fibre) {
    case 'cotton': {
      if (main.pct >= 85) {
        return heavy
          ? { hsn: '5209', rule: 'cotton ≥85%, >200 g/m² → 5209', detail: join(from, gsmNote, embroidered) }
          : { hsn: '5208', rule: 'cotton ≥85%, ≤200 g/m² → 5208', detail: join(from, gsmNote, embroidered) };
      }
      const manMade = weighed.some((f) => f.fibre === 'synthetic' || f.fibre === 'artificial');
      if (manMade) {
        return heavy
          ? { hsn: '5211', rule: 'cotton <85% mixed with man-made fibre, >200 g/m² → 5211', detail: join(from, gsmNote, embroidered) }
          : { hsn: '5210', rule: 'cotton <85% mixed with man-made fibre, ≤200 g/m² → 5210', detail: join(from, gsmNote, embroidered) };
      }
      return { hsn: '5212', rule: 'cotton <85%, other blends → 5212', detail: join(from, gsmNote, embroidered) };
    }
    case 'flax':
      return { hsn: '5309', rule: 'flax / linen → 5309', detail: join(from, embroidered) };
    case 'silk':
      return { hsn: '5007', rule: 'silk → 5007', detail: join(from, embroidered) };
    case 'wool':
      return { hsn: null, rule: 'wool fabric — carded 5111 or combed 5112? needs a person', detail: from };
    case 'synthetic':
      if (/\bspun\b/.test(text)) {
        return main.pct >= 85
          ? { hsn: '5512', rule: 'spun synthetic ≥85% → 5512', detail: join(from, tie, embroidered) }
          : { hsn: '5515', rule: 'spun synthetic <85% → 5515', detail: join(from, tie, embroidered) };
      }
      return {
        hsn: '5407',
        rule: 'polyester / nylon (synthetic filament) → 5407',
        detail: join(from, tie, 'spun polyester would be 5512', embroidered),
      };
    case 'artificial': {
      const filament = text.match(/georgette|chiffon|organza|organaza|satin/);
      if (filament) {
        return {
          hsn: '5408',
          rule: 'viscose, name says georgette / chiffon / organza / satin (filament) → 5408',
          detail: join(from, `name says "${filament[0]}"`, tie, embroidered),
        };
      }
      return {
        hsn: '5516',
        rule: 'viscose / rayon (artificial staple) → 5516',
        detail: join(from, tie, 'filament viscose would be 5408', embroidered),
      };
    }
    default:
      return { hsn: null, rule: 'composition not understood', detail: from };
  }
}

// ─── Per material type ──────────────────────────────────────────────────────────────────────────

function labelHsn(label: MasterRow | null, sizeRowOf: string | null): Proposal {
  if (!label) return { hsn: null, rule: 'no label master linked' };
  const base = sizeRowOf ? `size row of ${sizeRowOf} — follows its label` : null;
  const material = words(label.material);
  const text = words(label.labelType, label.labelName, label.printMethod, label.description);
  const evidence = join(base, quote('type', label.labelType), quote('category', label.labelCategory), quote('material', label.material));

  if (/sticker/.test(text)) return { hsn: '4821', rule: 'self-adhesive paper sticker → 4821 paper labels', detail: evidence };
  if (/satin|satan|woven|taffeta|cotton|polyester|nylon|fabric|twill|canvas|ribbon/.test(material)) {
    return { hsn: '5807', rule: 'label material is textile → 5807 textile labels', detail: evidence };
  }
  if (/paper|card|board|kraft/.test(material)) {
    return label.labelCategory === 'SEWN_IN'
      ? { hsn: '4821', rule: 'paper label → 4821 paper labels', detail: evidence }
      : { hsn: '4911', rule: 'card hangtag / price tag → 4911 printed matter (hangtags, price tags)', detail: evidence };
  }
  switch (label.labelCategory) {
    case 'SEWN_IN':
      return {
        hsn: '5807',
        rule: 'sewn-in label, material not recorded — sewn-in labels are woven / printed textile → 5807',
        detail: evidence,
      };
    case 'HANGTAG':
      return { hsn: '4911', rule: 'hangtag (paper / card) → 4911 printed matter (hangtags, swing tags)', detail: evidence };
    case 'PRICE_TAG':
      return { hsn: '4911', rule: 'price tag (paper / card) → 4911 printed matter (price tags)', detail: evidence };
    default:
      return { hsn: null, rule: 'label category not recorded', detail: evidence };
  }
}

function packagingHsn(pkg: MasterRow | null, name: string): Proposal {
  if (!pkg) return { hsn: null, rule: 'no packaging master linked' };
  const text = words(pkg.packagingType, pkg.packagingName, pkg.material, pkg.thickness, pkg.description, name);
  const evidence = join(quote('type', pkg.packagingType), quote('material', pkg.material), quote('thickness', pkg.thickness));

  if (/hanger/.test(text)) {
    if (/wire|metal|steel|iron/.test(text)) return { hsn: '7326', rule: 'metal hanger → 7326 articles of iron / steel', detail: evidence };
    if (/plastic|velvet|\bpp\b|\babs\b/.test(text)) return { hsn: '3926', rule: 'plastic hanger → 3926 articles of plastics', detail: evidence };
    return { hsn: null, rule: 'hanger, material not recorded (plastic 3926 / metal 7326 / wood 4421)', detail: evidence };
  }
  if (/sticker|barcode/.test(text)) return { hsn: '4821', rule: 'paper sticker → 4821 paper labels', detail: evidence };
  if (/tissue|insert card|butter paper|wrapping paper/.test(text)) {
    return { hsn: '4823', rule: 'tissue / insert paper → 4823 other paper articles', detail: evidence };
  }
  if (/tape/.test(text)) return { hsn: null, rule: 'packing tape — 3919 self-adhesive plastic; needs a person', detail: evidence };
  if (/silica/.test(text)) return { hsn: null, rule: 'silica gel — needs a person', detail: evidence };
  if (/non.?woven|cloth|fabric|cotton|jute/.test(words(pkg.material, pkg.packagingType))) {
    return { hsn: null, rule: 'textile bag / cover (6305 / 6307) — needs a person', detail: evidence };
  }
  if (/carton|\bbox\b|corrugated|\bply\b|\bcard\b|paper bag/.test(text)) {
    return { hsn: '4819', rule: 'carton / box / paper bag → 4819', detail: evidence };
  }
  if (/\bpoly\b|polybag|plastic|zip ?lock|ldpe|hdpe|bopp|\bpp\b|garment cover|dust cover|pouch|\bbag\b/.test(text)) {
    return { hsn: '3923', rule: 'poly bag / pouch / cover → 3923 plastic packing articles', detail: evidence };
  }
  return { hsn: null, rule: 'packaging type not recognised', detail: evidence };
}

function laceHsn(lace: MasterRow | null, name: string): Proposal {
  if (!lace) return { hsn: null, rule: 'no lace master linked' };
  const text = words(lace.laceType, lace.laceName, lace.design, lace.composition, lace.description, name);
  const evidence = join(quote('type', lace.laceType), quote('design', lace.design), quote('composition', lace.composition));
  const embroidered = text.match(/schiffli|embroider|sequin|sequence|mirror|chikan/);
  if (embroidered) {
    return {
      hsn: '5810',
      rule: 'schiffli / sequin / mirror-work lace = embroidery → 5810 embroidery in strips',
      detail: join(`says "${embroidered[0]}"`, evidence),
    };
  }
  const trimming = text.match(/gota|zari|fringe|frinze|tape|braid|dori|tassel/);
  if (trimming) {
    return {
      hsn: '5808',
      rule: 'gota / zari / fringe / tape / braid → 5808 braids & ornamental trimmings',
      detail: join(`says "${trimming[0]}"`, evidence),
    };
  }
  return { hsn: '5804', rule: 'lace in strips → 5804', detail: evidence };
}

function threadHsn(thread: MasterRow | null): Proposal {
  if (!thread) return { hsn: null, rule: 'no thread master linked' };
  const text = words(thread.threadName, thread.description, thread.brand);
  const placeholder = /placeholder/.test(text) ? 'placeholder thread, not a real item' : null;
  switch (thread.materialComposition) {
    case 'COTTON':
      return { hsn: '5204', rule: 'cotton sewing thread → 5204', detail: join(placeholder) };
    case 'POLYESTER':
      return /filament/.test(text)
        ? { hsn: '5401', rule: 'polyester filament sewing thread → 5401', detail: join(placeholder) }
        : {
            hsn: '5508',
            rule: 'polyester sewing thread, spun (the usual kind) → 5508',
            detail: join('filament thread would be 5401', placeholder),
          };
    default:
      return {
        hsn: null,
        rule: 'thread composition not recorded (cotton 5204 / spun polyester 5508 / filament 5401)',
        detail: join(placeholder),
      };
  }
}

/** Beads, sequins, buckles and loose fasteners are classified by what they are made of. */
function byMaterial(what: string, text: string, evidence: string): Proposal {
  if (/glass|crystal/.test(text)) return { hsn: '7018', rule: `glass ${what} → 7018`, detail: evidence };
  if (METAL.test(text)) return { hsn: '8308', rule: `metal ${what} → 8308 base-metal clasps, buckles, hooks, eyes`, detail: evidence };
  if (PLASTIC.test(text)) return { hsn: '3926', rule: `plastic ${what} → 3926 articles of plastics`, detail: evidence };
  return { hsn: null, rule: `${what}, material not recorded (metal 8308 / plastic 3926)`, detail: evidence };
}

function propose(type: MaterialType, master: MasterRow | null, ctx: { name: string; greige: MasterRow | null; sizeRowOf: string | null }): Proposal {
  const m = master ?? {};
  switch (type) {
    case MaterialType.LABEL:
      return labelHsn(master, ctx.sizeRowOf);
    case MaterialType.PACKAGING:
      return packagingHsn(master, ctx.name);
    case MaterialType.GREIGE:
      if (!master) return { hsn: null, rule: 'no greige master linked — composition unknown', detail: nameHint(words(ctx.name)) };
      return wovenFabric({
        composition: (m.composition as string | null) ?? null,
        compositionFrom: String(m.greigeCode),
        gsm: gsmOf(m.gsmRange),
        text: words(m.greigeName, m.weaveType, m.construction, ctx.name),
      });
    case MaterialType.FABRIC: {
      if (!master) return { hsn: null, rule: 'no fabric master linked — composition unknown', detail: nameHint(words(ctx.name)) };
      // Dyeing and printing do not change the fibre, so a finished fabric reads its greige's composition
      const own = (m.composition as string | null) ?? null;
      const greigeComposition = (ctx.greige?.composition as string | null) ?? null;
      return wovenFabric({
        composition: own?.trim() ? own : greigeComposition,
        compositionFrom: own?.trim() ? 'fabric master' : `its greige ${String(ctx.greige?.greigeCode ?? '')}`,
        gsm: gsmOf(m.actualGSM, ctx.greige?.gsmRange),
        text: words(m.fabricName, m.finishedConstruction, ctx.greige?.greigeName, ctx.greige?.weaveType, ctx.name),
      });
    }
    case MaterialType.LACE:
      return laceHsn(master, ctx.name);
    case MaterialType.THREAD:
      return threadHsn(master);
    case MaterialType.BUTTON:
    case MaterialType.SNAP_BUTTON:
      return { hsn: '9606', rule: 'buttons / press-fasteners → 9606', detail: join(quote('material', m.material)) };
    case MaterialType.ZIPPER:
      return { hsn: '9607', rule: 'zippers → 9607', detail: join(quote('teeth', m.teethType)) };
    case MaterialType.HOOK_EYE: {
      const evidence = join(quote('material', m.material)) || 'material not recorded — hooks & eyes are metal';
      return PLASTIC.test(words(m.material))
        ? { hsn: '3926', rule: 'plastic hooks & eyes → 3926 articles of plastics', detail: evidence }
        : { hsn: '8308', rule: 'hooks & eyes (metal) → 8308', detail: evidence };
    }
    case MaterialType.BUCKLE:
      return byMaterial('buckle', words(m.material, m.type, m.buckleName), join(quote('material', m.material), quote('type', m.type)));
    case MaterialType.OTHER_FASTENER: {
      const text = words(m.type, m.material, m.otherFastenerName, m.description, ctx.name);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/velcro|hook.?(and|&).?loop/.test(text)) return { hsn: '5806', rule: 'hook-and-loop tape (narrow woven) → 5806', detail: evidence };
      if (/\bsnap|\bpress/.test(text)) return { hsn: '9606', rule: 'press / snap fastener → 9606', detail: evidence };
      return byMaterial('fastener', text, evidence);
    }
    case MaterialType.VELCRO:
      return { hsn: '5806', rule: 'hook-and-loop tape (narrow woven) → 5806' };
    case MaterialType.ELASTIC: {
      const text = words(m.elasticType, m.elasticName, m.composition, m.description);
      const evidence = join(quote('type', m.elasticType), quote('composition', m.composition)) || 'type not recorded — assumed woven';
      if (/knit/.test(text)) return { hsn: '6002', rule: 'knitted elastic → 6002 narrow knitted fabric with elastomer', detail: evidence };
      return { hsn: '5806', rule: 'elastic = narrow woven fabric with elastomeric yarn → 5806', detail: evidence };
    }
    case MaterialType.DRAWSTRING:
      return { hsn: '5808', rule: 'drawstring cord = braid in the piece → 5808', detail: join(quote('material', m.material)) };
    case MaterialType.RIBBON:
      return { hsn: '5806', rule: 'ribbon = narrow woven fabric → 5806', detail: join(quote('type', m.type)) };
    case MaterialType.OTHER_TAPE: {
      const text = words(m.type, m.material, m.otherTapeName, m.description);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/adhesive|reflective|fusing|fusible/.test(text)) return { hsn: null, rule: 'adhesive / reflective / fusing tape — needs a person', detail: evidence };
      if (/braid/.test(text)) return { hsn: '5808', rule: 'braided tape → 5808', detail: evidence };
      return { hsn: '5806', rule: 'tape = narrow woven fabric → 5806', detail: evidence };
    }
    case MaterialType.INTERLINING: {
      const evidence = join(quote('type', m.type), m.fusible === true ? 'fusible' : m.fusible === false ? 'not fusible' : null, quote('weight', m.weight));
      if (/non.?woven/.test(words(m.type, m.interliningName, m.description))) {
        return { hsn: '5603', rule: 'non-woven interlining → 5603 nonwovens (coated or not)', detail: evidence };
      }
      if (m.fusible === true) return { hsn: '5903', rule: 'fusible woven interlining (coated fabric) → 5903', detail: evidence };
      return { hsn: null, rule: 'woven, not fusible — classify by its fibre; needs a person', detail: evidence };
    }
    case MaterialType.BEAD:
      return byMaterial('bead', words(m.material, m.beadName), join(quote('material', m.material)));
    case MaterialType.SEQUIN:
      return byMaterial('sequin', words(m.finish, m.sequinName, m.description), join(quote('finish', m.finish)));
    case MaterialType.MOTIF:
      return { hsn: '5810', rule: 'motif (embroidered) → 5810 embroidery in motifs', detail: join(quote('type', m.type)) };
    case MaterialType.OTHER_DECORATIVE: {
      const text = words(m.type, m.otherDecorativeName, m.material, m.description, ctx.name);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/tassel|pom.?pom|fringe/.test(text)) return { hsn: '5808', rule: 'tassel / pompom / fringe → 5808 ornamental trimmings', detail: evidence };
      if (/lace/.test(text)) return { hsn: '5804', rule: 'lace (decorative) → 5804', detail: evidence };
      if (/motif|patch|embroider|applique/.test(text)) return { hsn: '5810', rule: 'motif / patch → 5810 embroidery', detail: evidence };
      if (/bead|sequin/.test(text)) return byMaterial('bead / sequin', text, evidence);
      return { hsn: null, rule: 'decorative item not recognised', detail: evidence };
    }
    case MaterialType.BELT: {
      const text = words(m.material, m.type, m.beltName);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/\bpu\b|faux|synthetic|rexine|pvc|plastic/.test(text)) return { hsn: '3926', rule: 'PU / plastic belt → 3926 plastic clothing accessories', detail: evidence };
      if (/leather/.test(text)) return { hsn: '4203', rule: 'leather belt → 4203', detail: evidence };
      if (/fabric|cotton|polyester|textile|elastic/.test(text)) return { hsn: '6217', rule: 'textile belt → 6217 clothing accessories', detail: evidence };
      return { hsn: null, rule: 'belt material not recorded', detail: evidence };
    }
    case MaterialType.MACHINE_PART: {
      const text = words(m.machine, m.category, m.partName, m.description);
      const evidence = join(quote('machine', m.machine), quote('category', m.category)) || 'machine not recorded — assumed a sewing machine';
      if (/compressor|boiler|steam|generator|press machine|\biron\b/.test(text)) {
        return { hsn: null, rule: 'part of a machine other than a sewing machine — needs a person', detail: evidence };
      }
      return { hsn: '8452', rule: 'sewing machine part → 8452', detail: evidence };
    }
    case MaterialType.PADDING:
      return { hsn: null, rule: 'padding / wadding (5601) or foam (3921) — needs a person', detail: join(quote('material', m.material)) };
    default:
      // OTHER, OTHER_MATERIAL, OTHER_FUNCTIONAL, GENERIC, TRIMS, ACCESSORIES, SERVICE: the type says nothing about the goods
      return { hsn: null, rule: 'type says nothing about what it is' };
  }
}

// ─── HSN master: what rate a code would get ─────────────────────────────────────────────────────

interface HsnRow {
  code: string;
  chapter: string | null;
  rate: number;
  isActive: boolean;
}

/**
 * The same lookup gst.service `getGSTRate` makes for a code: exact code, then a chapter row (4 digits,
 * then 2). A chapter hit is flagged — the code itself should be added to the HSN master first.
 */
function masterRate(code: string, master: HsnRow[]): { rate: number; via: string } | null {
  const exact = master.find((h) => h.code === code);
  if (exact) return { rate: exact.rate, via: 'exact' };
  for (const len of [4, 2]) {
    if (code.length < len) continue;
    const chapter = master.find((h) => h.isActive && h.chapter === code.slice(0, len));
    if (chapter) return { rate: chapter.rate, via: `chapter ${code.slice(0, len)} (row ${chapter.code})` };
  }
  return null;
}

// ─── Output ─────────────────────────────────────────────────────────────────────────────────────

const pct = (rate: number | null) => (rate === null ? '—' : `${rate}%`);
const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function mdTable(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(md).join(' | ')} |`),
  ].join('\n');
}

function textTable(head: string[], rows: string[][]): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

async function main() {
  const materials = await prisma.materials.findMany({
    where: {
      isActive: true,
      OR: [{ hsnCode: null }, { hsnCode: '' }],
      ...(ONLY ? { materialType: { in: ONLY } } : {}),
    },
    orderBy: { code: 'asc' },
  });

  // Every master row a material points at, one query per master table
  const masters = new Map<string, MasterRow>();
  const byType = new Map<MaterialType, typeof materials>();
  for (const m of materials) byType.set(m.materialType, [...(byType.get(m.materialType) ?? []), m]);
  for (const [type, rows] of byType) {
    const cfg = MASTER_CONFIG[type];
    if (!cfg) continue;
    const ids = rows.map((r) => (r as unknown as Record<string, string | null>)[cfg.fkField]).filter((id): id is string => !!id);
    // A label size row without its own labelId still reaches the label through its size variant
    if (type === MaterialType.LABEL) {
      const variantIds = rows.filter((r) => !r.labelId && r.sizeVariantId).map((r) => r.sizeVariantId as string);
      if (variantIds.length > 0) {
        const variants = await prisma.label_size_variants.findMany({ where: { id: { in: variantIds } }, select: { id: true, labelId: true } });
        for (const v of variants) {
          masters.set(`variant:${v.id}`, { labelId: v.labelId });
          ids.push(v.labelId);
        }
      }
    }
    if (ids.length === 0) continue;
    const found: MasterRow[] = await (prisma as any)[cfg.table].findMany({ where: { id: { in: Array.from(new Set(ids)) } } });
    for (const row of found) masters.set(`${cfg.table}:${String(row.id)}`, row);
  }
  // A finished fabric's composition usually lives on its greige
  const fabricGreigeIds = Array.from(masters.values())
    .map((row) => row.greigeId)
    .filter((id): id is string => typeof id === 'string');
  if (fabricGreigeIds.length > 0) {
    const greiges = await prisma.greige_master.findMany({ where: { id: { in: fabricGreigeIds } } });
    for (const g of greiges) masters.set(`greige_master:${g.id}`, g as unknown as MasterRow);
  }

  const hsnMaster: HsnRow[] = (
    await prisma.hsn_sac_masters.findMany({ select: { code: true, chapter: true, defaultGstRate: true, isActive: true }, orderBy: { code: 'asc' } })
  ).map((h) => ({ code: h.code, chapter: h.chapter, rate: Number(h.defaultGstRate), isActive: h.isActive }));

  // What these lines are taxed at today: no HSN → tax_masters → gst.service's last resort
  const now = new Date();
  const taxMaster = await prisma.tax_masters.findFirst({
    where: { taxType: 'GST', isActive: true, applicableFrom: { lte: now }, OR: [{ applicableTo: null }, { applicableTo: { gte: now } }] },
    orderBy: { taxRate: 'asc' },
  });
  const rateToday = taxMaster ? `${Number(taxMaster.taxRate)}% (tax_masters ${taxMaster.taxCode})` : '5% (gst.service last resort — tax_masters is empty)';

  const lines: Line[] = materials.map((mat) => {
    const cfg = MASTER_CONFIG[mat.materialType];
    let master: MasterRow | null = null;
    let sizeRowOf: string | null = null;
    if (cfg) {
      let fk = (mat as unknown as Record<string, string | null>)[cfg.fkField];
      if (!fk && mat.materialType === MaterialType.LABEL && mat.sizeVariantId) {
        fk = (masters.get(`variant:${mat.sizeVariantId}`)?.labelId as string | undefined) ?? null;
      }
      master = fk ? (masters.get(`${cfg.table}:${fk}`) ?? null) : null;
      if (master && mat.materialType === MaterialType.LABEL && mat.sizeVariantId) sizeRowOf = String(master.labelCode);
    }
    const greigeId = mat.materialType === MaterialType.FABRIC ? (master?.greigeId as string | null | undefined) : null;
    const greige = greigeId ? (masters.get(`greige_master:${greigeId}`) ?? null) : null;

    const p = propose(mat.materialType, master, { name: mat.name, greige, sizeRowOf });
    let { hsn, rule } = p;
    let detail = p.detail ?? '';
    let rate: number | null = null;
    if (hsn) {
      const found = masterRate(hsn, hsnMaster);
      if (!found) {
        rule = `${rule} — but ${hsn} is not in the HSN master (add it on HSN/SAC Codes, then re-run)`;
        hsn = null;
      } else {
        rate = found.rate;
        if (found.via !== 'exact') detail = join(detail, `rate from ${found.via} — add ${hsn} itself to the HSN master`);
      }
    }
    // A material's own GST rate beats its HSN (gst.service step 2) — say so rather than print a rate it will not get
    if (mat.gstRate !== null) {
      detail = join(detail, `the material's own GST rate ${Number(mat.gstRate)}% applies, not the HSN's`);
      rate = Number(mat.gstRate);
    }
    return { id: mat.id, code: mat.code, name: mat.name, type: mat.materialType, hsn, rate, rule, detail };
  });

  // Summary: type | proposed HSN | rate | count | reason — biggest types first
  const typeCount = new Map<string, number>();
  for (const l of lines) typeCount.set(l.type, (typeCount.get(l.type) ?? 0) + 1);
  const groups = new Map<string, { type: string; hsn: string; rate: string; count: number; rule: string }>();
  for (const l of lines) {
    const key = `${l.type}\u0000${l.hsn ?? ''}\u0000${l.rule}`;
    const g = groups.get(key) ?? { type: l.type, hsn: l.hsn ?? '—', rate: pct(l.rate), count: 0, rule: l.rule };
    g.count += 1;
    groups.set(key, g);
  }
  const summary = Array.from(groups.values()).sort(
    (a, b) => (typeCount.get(b.type) ?? 0) - (typeCount.get(a.type) ?? 0) || a.type.localeCompare(b.type) || b.count - a.count
  );
  const summaryHead = ['Type', 'Proposed HSN', 'Rate', 'Count', 'Reason'];
  const summaryRows = summary.map((g) => [g.type, g.hsn, g.rate, String(g.count), g.rule]);

  const byTypeThenCode = (a: Line, b: Line) =>
    (typeCount.get(b.type) ?? 0) - (typeCount.get(a.type) ?? 0) || a.type.localeCompare(b.type) || a.code.localeCompare(b.code);
  const proposed = lines.filter((l) => l.hsn);
  const unproposed = lines.filter((l) => !l.hsn).sort(byTypeThenCode);
  const rateCounts = new Map<string, number>();
  for (const l of proposed) rateCounts.set(pct(l.rate), (rateCounts.get(pct(l.rate)) ?? 0) + 1);
  const rateLine = Array.from(rateCounts.entries())
    .sort()
    .map(([r, n]) => `${n} at ${r}`)
    .join(', ');

  const report = [
    '# HSN dry run — proposed codes for materials with none',
    '',
    `Generated on ${formatDateTime24(now)} by \`backend/scripts/fill-material-hsn.ts\`${ONLY ? ` (--only ${ONLY.join(',')})` : ''}. **Nothing has been written.**`,
    '',
    `- ${lines.length} active material(s) have no HSN code. Today every PO line for them is taxed at ${rateToday}.`,
    `- A code is proposed for ${proposed.length} (${rateLine || 'none'}); ${unproposed.length} need a person.`,
    '- Rate = the HSN master\'s rate for the proposed code (HSN/SAC Codes page). Applying writes the HSN code only; the rate follows from the master.',
    '- 4821 and 4911 are both 18% in our master — which one a tag goes under is the accountant\'s call; the rate does not change.',
    '',
    '## Summary by material type',
    '',
    mdTable(summaryHead, summaryRows),
    '',
    `## Needs a person (${unproposed.length})`,
    '',
    unproposed.length > 0
      ? mdTable(['Code', 'Name', 'Type', 'Why', 'Evidence'], unproposed.map((l) => [l.code, l.name, l.type, l.rule, l.detail || '—']))
      : 'None.',
    '',
    `## Every material (${lines.length})`,
    '',
    mdTable(
      ['Code', 'Name', 'Type', 'Proposed HSN', 'Rate', 'Reason'],
      [...lines].sort(byTypeThenCode).map((l) => [l.code, l.name, l.type, l.hsn ?? '—', pct(l.rate), join(l.rule, l.detail)])
    ),
    '',
    '## To apply (after approval)',
    '',
    'Type by type, e.g. `cd backend && npx ts-node scripts/fill-material-hsn.ts --apply --only BUTTON,ZIPPER`. It writes only',
    'rows that still have no HSN, in one transaction, and saves the old values to `backend/scripts/fill-material-hsn-snapshot-<time>.json` first.',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report);

  console.log(`\n${lines.length} active material(s) without an HSN code. Today their PO lines are taxed at ${rateToday}.\n`);
  console.log(textTable(summaryHead, summaryRows));
  console.log(`\nProposed: ${proposed.length} (${rateLine || 'none'}). Needs a person: ${unproposed.length}.`);
  console.log(`Full table (summary, needs a person, every material): ${OUT}`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. After approval: --apply [--only TYPE,...]');
    return;
  }
  if (proposed.length === 0) {
    console.log('\nNothing to write.');
    return;
  }

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const snapshot = path.join(__dirname, `fill-material-hsn-snapshot-${stamp}.json`);
  const before = new Map(materials.map((m) => [m.id, m]));
  fs.writeFileSync(
    snapshot,
    JSON.stringify(
      {
        takenAt: now.toISOString(),
        only: ONLY,
        rows: proposed.map((l) => ({
          id: l.id,
          code: l.code,
          materialType: l.type,
          hsnCodeBefore: before.get(l.id)?.hsnCode ?? null,
          gstRateBefore: before.get(l.id)?.gstRate === null ? null : Number(before.get(l.id)?.gstRate),
          hsnCodeAfter: l.hsn,
          reason: join(l.rule, l.detail),
        })),
      },
      null,
      2
    )
  );

  const byCode = new Map<string, string[]>();
  for (const l of proposed) byCode.set(l.hsn as string, [...(byCode.get(l.hsn as string) ?? []), l.id]);
  const written = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const [hsnCode, ids] of byCode) {
      // Still-empty rows only: an HSN someone typed since the table was read is theirs to keep
      const res = await tx.materials.updateMany({ where: { id: { in: ids }, OR: [{ hsnCode: null }, { hsnCode: '' }] }, data: { hsnCode } });
      n += res.count;
    }
    return n;
  });
  console.log(`\nWrote the HSN code on ${written} of ${proposed.length} material(s). Snapshot: ${snapshot}`);
  if (written < proposed.length) console.log(`${proposed.length - written} had an HSN code by the time of writing — left as they were.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
