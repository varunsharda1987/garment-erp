/**
 * A material's HSN code — the ONE rule for which 6-digit ITC-HS code a material is bought under (2026-09-28).
 *
 * None of the active materials carried an HSN code, so every PO line fell through gst.service to its last-resort
 * 5% — buttons, zippers, poly bags and cartons included, which are 18% in our own HSN master. The owner: "HSN code
 * … has to be 6 digit … whenever a new material comes it should carry the HSN code."
 *
 *  - proposeMaterialHsn reads the master a material points at (label type, composition, GSM, greige / dyed /
 *    printed, lace kind, button material, zipper teeth …) and names ONE 6-digit subheading with its reason. Where
 *    the master cannot decide between two subheadings it takes the usual garment-trade pick and the reason SAYS so.
 *  - A material with too little to go on (no master, no composition, type OTHER) gets no code — never a guess.
 *  - fillMaterialHsnIfBlank is the one writer: blank rows only, and only a code the HSN master has, so the PO GST
 *    resolver finds its rate by the exact code.
 *  - MATERIAL_HSN_CODES is every code the rule can give. `scripts/fill-material-hsn.ts --seed-codes` adds them to
 *    hsn_sac_masters at their 4-digit heading's rate — the rate is always the HSN master's, never set here.
 */

import { MaterialType, Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { MASTER_CONFIG } from './master-config';

type Db = PrismaClient | Prisma.TransactionClient;

/** A material's HSN is 6 digits (an 8-digit tariff item is allowed too). */
export const MATERIAL_HSN_PATTERN = /^\d{6}(\d{2})?$/;

export function isMaterialHsn(code: unknown): code is string {
  return typeof code === 'string' && MATERIAL_HSN_PATTERN.test(code);
}

// ─── Every code the rule can give ───────────────────────────────────────────────────────────────

const hs = (code: string, description: string) => ({ code, heading: code.slice(0, 4), description });

/**
 * Every 6-digit code proposeMaterialHsn can return, with its 4-digit heading (whose row in hsn_sac_masters
 * supplies the rate) and the HSN wording, shortened. A unit test holds this list and the rule to each other.
 */
export const MATERIAL_HSN_CODES: ReadonlyArray<{ code: string; heading: string; description: string }> = [
  // Plastics
  hs('392310', 'Boxes, cases, crates and similar articles, of plastics'),
  hs('392321', 'Sacks and bags (including cones), of polymers of ethylene'),
  hs('392329', 'Sacks and bags (including cones), of other plastics'),
  hs('392620', 'Articles of apparel and clothing accessories (including belts), of plastics'),
  hs('392690', 'Other articles of plastics (beads, sequins, clasps, hooks, hangers)'),
  // Paper
  hs('481910', 'Cartons, boxes and cases, of corrugated paper or paperboard'),
  hs('481920', 'Folding cartons, boxes and cases, of non-corrugated paper or paperboard'),
  hs('481940', 'Other sacks and bags, including cones, of paper'),
  hs('482110', 'Paper or paperboard labels of all kinds, printed (tags, price tags, stickers)'),
  // Silk
  hs('500720', 'Woven fabrics of silk, containing 85% or more by weight of silk (other than noil silk)'),
  hs('500790', 'Other woven fabrics of silk'),
  // Cotton thread and woven cotton fabrics
  hs('520411', 'Cotton sewing thread, containing 85% or more by weight of cotton, not put up for retail sale'),
  hs('520811', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: unbleached, plain weave, ≤100 g/m²'),
  hs('520812', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: unbleached, plain weave, >100 g/m²'),
  hs('520813', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: unbleached, 3-thread or 4-thread twill'),
  hs('520819', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: unbleached, other fabrics'),
  hs('520831', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: dyed, plain weave, ≤100 g/m²'),
  hs('520832', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: dyed, plain weave, >100 g/m²'),
  hs('520833', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: dyed, 3-thread or 4-thread twill'),
  hs('520839', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: dyed, other fabrics'),
  hs('520841', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: of yarns of different colours, plain weave, ≤100 g/m²'),
  hs('520842', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: of yarns of different colours, plain weave, >100 g/m²'),
  hs(
    '520843',
    'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: of yarns of different colours, 3-thread or 4-thread twill'
  ),
  hs('520849', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: of yarns of different colours, other fabrics'),
  hs('520851', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: printed, plain weave, ≤100 g/m²'),
  hs('520852', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: printed, plain weave, >100 g/m²'),
  hs('520859', 'Woven cotton fabric, ≥85% cotton, ≤200 g/m²: printed, other fabrics'),
  hs('520911', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: unbleached, plain weave'),
  hs('520912', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: unbleached, 3-thread or 4-thread twill'),
  hs('520919', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: unbleached, other fabrics'),
  hs('520931', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: dyed, plain weave'),
  hs('520932', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: dyed, 3-thread or 4-thread twill'),
  hs('520939', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: dyed, other fabrics'),
  hs('520941', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: of yarns of different colours, plain weave'),
  hs('520942', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: of yarns of different colours, denim'),
  hs(
    '520943',
    'Woven cotton fabric, ≥85% cotton, >200 g/m²: of yarns of different colours, other 3- or 4-thread twill'
  ),
  hs('520949', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: of yarns of different colours, other fabrics'),
  hs('520951', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: printed, plain weave'),
  hs('520952', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: printed, 3-thread or 4-thread twill'),
  hs('520959', 'Woven cotton fabric, ≥85% cotton, >200 g/m²: printed, other fabrics'),
  hs('521011', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: unbleached, plain weave'),
  hs('521019', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: unbleached, other fabrics'),
  hs('521031', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: dyed, plain weave'),
  hs('521032', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: dyed, 3- or 4-thread twill'),
  hs('521039', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: dyed, other fabrics'),
  hs(
    '521041',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: of yarns of different colours, plain weave'
  ),
  hs(
    '521049',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: of yarns of different colours, other fabrics'
  ),
  hs('521051', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: printed, plain weave'),
  hs('521059', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, ≤200 g/m²: printed, other fabrics'),
  hs('521111', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: unbleached, plain weave'),
  hs(
    '521112',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: unbleached, 3- or 4-thread twill'
  ),
  hs('521119', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: unbleached, other fabrics'),
  hs('521131', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: dyed, plain weave'),
  hs('521132', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: dyed, 3- or 4-thread twill'),
  hs('521139', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: dyed, other fabrics'),
  hs(
    '521141',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: of yarns of different colours, plain weave'
  ),
  hs(
    '521142',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: of yarns of different colours, denim'
  ),
  hs(
    '521143',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: of yarns of different colours, other twill'
  ),
  hs(
    '521149',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: of yarns of different colours, other fabrics'
  ),
  hs('521151', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: printed, plain weave'),
  hs(
    '521152',
    'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: printed, 3- or 4-thread twill'
  ),
  hs('521159', 'Woven cotton fabric, <85% cotton, mixed with man-made fibres, >200 g/m²: printed, other fabrics'),
  hs('521211', 'Other woven fabrics of cotton, ≤200 g/m²: unbleached'),
  hs('521213', 'Other woven fabrics of cotton, ≤200 g/m²: dyed'),
  hs('521214', 'Other woven fabrics of cotton, ≤200 g/m²: of yarns of different colours'),
  hs('521215', 'Other woven fabrics of cotton, ≤200 g/m²: printed'),
  hs('521221', 'Other woven fabrics of cotton, >200 g/m²: unbleached'),
  hs('521223', 'Other woven fabrics of cotton, >200 g/m²: dyed'),
  hs('521224', 'Other woven fabrics of cotton, >200 g/m²: of yarns of different colours'),
  hs('521225', 'Other woven fabrics of cotton, >200 g/m²: printed'),
  // Flax
  hs('530911', 'Woven fabrics of flax, ≥85% flax: unbleached or bleached'),
  hs('530919', 'Woven fabrics of flax, ≥85% flax: other (dyed, printed)'),
  hs('530921', 'Woven fabrics of flax, <85% flax: unbleached or bleached'),
  hs('530929', 'Woven fabrics of flax, <85% flax: other (dyed, printed)'),
  // Man-made filament thread and woven fabrics
  hs('540110', 'Sewing thread of synthetic filaments'),
  hs('540741', 'Woven fabric, ≥85% nylon / polyamide filaments: unbleached or bleached'),
  hs('540742', 'Woven fabric, ≥85% nylon / polyamide filaments: dyed'),
  hs('540743', 'Woven fabric, ≥85% nylon / polyamide filaments: of yarns of different colours'),
  hs('540744', 'Woven fabric, ≥85% nylon / polyamide filaments: printed'),
  hs('540751', 'Woven fabric, ≥85% textured polyester filaments: unbleached or bleached'),
  hs('540752', 'Woven fabric, ≥85% textured polyester filaments: dyed'),
  hs('540753', 'Woven fabric, ≥85% textured polyester filaments: of yarns of different colours'),
  hs('540754', 'Woven fabric, ≥85% textured polyester filaments: printed'),
  hs('540771', 'Woven fabric, ≥85% synthetic filaments (other): unbleached or bleached'),
  hs('540772', 'Woven fabric, ≥85% synthetic filaments (other): dyed'),
  hs('540773', 'Woven fabric, ≥85% synthetic filaments (other): of yarns of different colours'),
  hs('540774', 'Woven fabric, ≥85% synthetic filaments (other): printed'),
  hs('540781', 'Woven fabric, <85% synthetic filaments, mixed mainly with cotton: unbleached or bleached'),
  hs('540782', 'Woven fabric, <85% synthetic filaments, mixed mainly with cotton: dyed'),
  hs('540783', 'Woven fabric, <85% synthetic filaments, mixed mainly with cotton: of yarns of different colours'),
  hs('540784', 'Woven fabric, <85% synthetic filaments, mixed mainly with cotton: printed'),
  hs('540791', 'Other woven fabrics of synthetic filament yarn: unbleached or bleached'),
  hs('540792', 'Other woven fabrics of synthetic filament yarn: dyed'),
  hs('540793', 'Other woven fabrics of synthetic filament yarn: of yarns of different colours'),
  hs('540794', 'Other woven fabrics of synthetic filament yarn: printed'),
  hs('540821', 'Woven fabric, ≥85% artificial (viscose) filament: unbleached or bleached'),
  hs('540822', 'Woven fabric, ≥85% artificial (viscose) filament: dyed'),
  hs('540823', 'Woven fabric, ≥85% artificial (viscose) filament: of yarns of different colours'),
  hs('540824', 'Woven fabric, ≥85% artificial (viscose) filament: printed'),
  hs('540831', 'Other woven fabrics of artificial filament yarn: unbleached or bleached'),
  hs('540832', 'Other woven fabrics of artificial filament yarn: dyed'),
  hs('540833', 'Other woven fabrics of artificial filament yarn: of yarns of different colours'),
  hs('540834', 'Other woven fabrics of artificial filament yarn: printed'),
  // Man-made staple thread and woven fabrics
  hs('550810', 'Sewing thread of synthetic staple fibres'),
  hs('551211', 'Woven fabric, ≥85% polyester staple fibres: unbleached or bleached'),
  hs('551219', 'Woven fabric, ≥85% polyester staple fibres: other (dyed, printed)'),
  hs('551291', 'Woven fabric, ≥85% other synthetic staple fibres: unbleached or bleached'),
  hs('551299', 'Woven fabric, ≥85% other synthetic staple fibres: other (dyed, printed)'),
  hs('551611', 'Woven fabric, ≥85% artificial (viscose) staple fibres: unbleached or bleached'),
  hs('551612', 'Woven fabric, ≥85% artificial (viscose) staple fibres: dyed'),
  hs('551613', 'Woven fabric, ≥85% artificial (viscose) staple fibres: of yarns of different colours'),
  hs('551614', 'Woven fabric, ≥85% artificial (viscose) staple fibres: printed'),
  hs('551621', 'Woven fabric, <85% artificial staple, mixed mainly with man-made filaments: unbleached or bleached'),
  hs('551622', 'Woven fabric, <85% artificial staple, mixed mainly with man-made filaments: dyed'),
  hs(
    '551623',
    'Woven fabric, <85% artificial staple, mixed mainly with man-made filaments: of yarns of different colours'
  ),
  hs('551624', 'Woven fabric, <85% artificial staple, mixed mainly with man-made filaments: printed'),
  hs('551631', 'Woven fabric, <85% artificial staple, mixed mainly with wool: unbleached or bleached'),
  hs('551632', 'Woven fabric, <85% artificial staple, mixed mainly with wool: dyed'),
  hs('551633', 'Woven fabric, <85% artificial staple, mixed mainly with wool: of yarns of different colours'),
  hs('551634', 'Woven fabric, <85% artificial staple, mixed mainly with wool: printed'),
  hs('551641', 'Woven fabric, <85% artificial staple, mixed mainly with cotton: unbleached or bleached'),
  hs('551642', 'Woven fabric, <85% artificial staple, mixed mainly with cotton: dyed'),
  hs('551643', 'Woven fabric, <85% artificial staple, mixed mainly with cotton: of yarns of different colours'),
  hs('551644', 'Woven fabric, <85% artificial staple, mixed mainly with cotton: printed'),
  hs('551691', 'Other woven fabrics of artificial staple fibres: unbleached or bleached'),
  hs('551692', 'Other woven fabrics of artificial staple fibres: dyed'),
  hs('551693', 'Other woven fabrics of artificial staple fibres: of yarns of different colours'),
  hs('551694', 'Other woven fabrics of artificial staple fibres: printed'),
  // Nonwovens
  hs('560311', 'Nonwovens of man-made filaments, ≤25 g/m²'),
  hs('560312', 'Nonwovens of man-made filaments, >25 g/m² but ≤70 g/m²'),
  hs('560313', 'Nonwovens of man-made filaments, >70 g/m² but ≤150 g/m²'),
  hs('560314', 'Nonwovens of man-made filaments, >150 g/m²'),
  // Special woven fabrics: net, lace, narrow fabrics, labels, braids, embroidery
  hs('580410', 'Tulles and other net fabrics'),
  hs('580421', 'Mechanically made lace, in the piece, in strips or in motifs, of man-made fibres'),
  hs('580429', 'Mechanically made lace, in the piece, in strips or in motifs, of other textile materials (cotton)'),
  hs('580610', 'Narrow woven pile fabrics (velvet ribbon) and chenille fabrics'),
  hs(
    '580620',
    'Other narrow woven fabrics, containing 5% or more by weight of elastomeric yarn or rubber thread (elastic tape)'
  ),
  hs('580631', 'Other narrow woven fabrics, of cotton'),
  hs('580632', 'Other narrow woven fabrics, of man-made fibres (ribbon, tape, hook-and-loop)'),
  hs('580710', 'Labels, badges and similar articles of textile materials, woven'),
  hs('580790', 'Labels, badges and similar articles of textile materials, other (printed satin / taffeta)'),
  hs('580810', 'Braids in the piece (drawstring cord, dori)'),
  hs('580890', 'Ornamental trimmings in the piece, tassels, pompons and the like (gota, zari lace, fringe)'),
  hs('581091', 'Embroidery in the piece, in strips or in motifs, of cotton (schiffli)'),
  hs('581092', 'Embroidery in the piece, in strips or in motifs, of man-made fibres'),
  hs('581099', 'Embroidery in the piece, in strips or in motifs, of other textile materials (zari)'),
  // Coated fabrics
  hs('590390', 'Textile fabrics impregnated, coated, covered or laminated with other plastics (fusible interlining)'),
  // Knitted fabrics
  hs('600621', 'Other knitted fabrics, of cotton: unbleached or bleached'),
  hs('600622', 'Other knitted fabrics, of cotton: dyed'),
  hs('600623', 'Other knitted fabrics, of cotton: of yarns of different colours'),
  hs('600624', 'Other knitted fabrics, of cotton: printed'),
  hs('600631', 'Other knitted fabrics, of synthetic fibres: unbleached or bleached'),
  hs('600632', 'Other knitted fabrics, of synthetic fibres: dyed'),
  hs('600633', 'Other knitted fabrics, of synthetic fibres: of yarns of different colours'),
  hs('600634', 'Other knitted fabrics, of synthetic fibres: printed'),
  hs('600641', 'Other knitted fabrics, of artificial fibres: unbleached or bleached'),
  hs('600642', 'Other knitted fabrics, of artificial fibres: dyed'),
  hs('600643', 'Other knitted fabrics, of artificial fibres: of yarns of different colours'),
  hs('600644', 'Other knitted fabrics, of artificial fibres: printed'),
  hs('600690', 'Other knitted fabrics, of other textile materials'),
  // Clothing accessories of textile
  hs('621710', 'Clothing accessories of textile, not knitted (belts)'),
  // Iron / steel, base metal
  hs('732620', 'Articles of iron or steel wire (wire hangers)'),
  hs('732690', 'Other articles of iron or steel (metal hangers)'),
  hs('830810', 'Hooks, eyes and eyelets, of base metal'),
  hs('830890', 'Other clasps, buckles, stoppers, beads and spangles, of base metal'),
  // Sewing machines
  hs('845230', 'Sewing machine needles'),
  hs('845290', 'Other parts of sewing machines (furniture, bases, covers, parts)'),
  // Buttons and zippers
  hs('960610', 'Press-fasteners, snap-fasteners and press-studs and parts therefor'),
  hs('960621', 'Buttons of plastics, not covered with textile material'),
  hs('960622', 'Buttons of base metal, not covered with textile material'),
  hs('960629', 'Other buttons (shell, coconut, wood, horn, covered)'),
  hs('960711', 'Slide fasteners (zippers) fitted with chain scoops of base metal'),
  hs('960719', 'Other slide fasteners (nylon coil, plastic zippers)'),
];

// ─── Facts the rule reads ───────────────────────────────────────────────────────────────────────

/** A master row as read from its table (label_master, greige_master …) — the rule reads only the columns it names. */
export type MasterFacts = Record<string, unknown>;

export interface MaterialHsnFacts {
  materialType: MaterialType;
  /** The material's own name: a hint for the KIND of goods (net, knit, hanger …), never for a fibre */
  name?: string | null;
  /** The master row the material points at; null = none linked */
  master: MasterFacts | null;
  /** FABRIC only: its greige — a finished fabric's composition, GSM and weave usually live there */
  greige?: MasterFacts | null;
  /** LABEL size rows: the code of the label this row is a size of */
  sizeRowOf?: string | null;
}

export interface MaterialHsnProposal {
  code: string | null;
  /** Why this code (groupable — no per-row values); an assumption the data could not settle is named here */
  reason: string;
  /** This row's own evidence: composition, GSM, label type … */
  evidence?: string;
}

// ─── Small readers ──────────────────────────────────────────────────────────────────────────────

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
const proposal = (code: string | null, reason: string, evidence?: string | null): MaterialHsnProposal =>
  evidence ? { code, reason, evidence } : { code, reason };

const METAL = /\b(metal|brass|steel|iron|alloy|zinc|aluminium|aluminum|nickel|copper|antique)\b/;
const PLASTIC = /\b(plastic|acrylic|resin|pu|polyurethane|pvc|abs|acetal|nylon|polyester|pet|pp)\b/;
const GLASS = /glass|crystal/;

/** Highest number recorded — "120-130" reads 130, so a range that crosses a band counts as the heavier. */
function gsmOf(...values: unknown[]): number | null {
  for (const v of values) {
    const found = String(v ?? '').match(/\d+(?:\.\d+)?/g);
    if (found) return Math.max(...found.map(Number));
  }
  return null;
}

// ─── Fibres ─────────────────────────────────────────────────────────────────────────────────────

type Fibre =
  | 'silk'
  | 'wool'
  | 'cotton'
  | 'flax'
  | 'nylon'
  | 'polyester'
  | 'elastane'
  | 'synthetic'
  | 'artificial'
  | 'metallic';

// Order matters: "art silk" is viscose, not silk
const FIBRE_WORDS: Array<{ fibre: Fibre; re: RegExp }> = [
  { fibre: 'artificial', re: /art\.?\s*silk|viscose|rayon|modal|lyocell|tencel|cupro|acetate|bamboo/ },
  { fibre: 'silk', re: /silk/ },
  { fibre: 'cotton', re: /cotton/ },
  { fibre: 'flax', re: /flax|linen/ },
  { fibre: 'wool', re: /wool/ },
  { fibre: 'nylon', re: /nylon|polyamide/ },
  { fibre: 'polyester', re: /polyester|polyster|\bpoly\b/ },
  { fibre: 'elastane', re: /spandex|elastane|lycra/ },
  { fibre: 'synthetic', re: /acrylic|polypropylene/ },
  { fibre: 'metallic', re: /lurex|zari|metallic/ },
];

const SYNTHETIC: ReadonlySet<Fibre> = new Set<Fibre>(['nylon', 'polyester', 'elastane', 'synthetic']);
const isManMade = (f: Fibre) => SYNTHETIC.has(f) || f === 'artificial';

// Section XI note 2: when two fibres weigh the same, the fabric goes under the heading that comes LAST
const TIE_ORDER: Fibre[] = [
  'silk',
  'wool',
  'cotton',
  'flax',
  'nylon',
  'polyester',
  'elastane',
  'synthetic',
  'artificial',
];

const fibreOf = (text: string): Fibre | null => FIBRE_WORDS.find((f) => f.re.test(text))?.fibre ?? null;

interface Share {
  fibre: Fibre;
  pct: number;
}

/** "60%Viscose40%Nylon" → viscose 60, nylon 40. One fibre we cannot name spoils the whole reading. */
function parseComposition(raw: string): Share[] {
  const text = raw.toLowerCase();
  const parts = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([a-z .]+)/g));
  if (parts.length === 0) {
    const fibre = fibreOf(text);
    return fibre ? [{ fibre, pct: 100 }] : [];
  }
  const out: Share[] = [];
  for (const [, share, name] of parts) {
    const fibre = fibreOf(name);
    if (!fibre) return [];
    const same = out.find((x) => x.fibre === fibre);
    if (same) same.pct += Number(share);
    else out.push({ fibre, pct: Number(share) });
  }
  return out;
}

/** Heaviest fibre first; equal shares → the later heading (Section XI note 2). Metallic yarn is never weighed. */
function byWeight(shares: Share[]): Share[] {
  return shares
    .filter((f) => f.fibre !== 'metallic')
    .sort((a, b) => b.pct - a.pct || TIE_ORDER.indexOf(b.fibre) - TIE_ORDER.indexOf(a.fibre));
}

const shareOf = (shares: Share[], test: (f: Fibre) => boolean) =>
  shares.filter((s) => test(s.fibre)).reduce((n, s) => n + s.pct, 0);

/** A fibre named in a material's NAME is a hint for the person filling the master — never a proposal. */
function nameHint(text: string): string | undefined {
  for (const f of FIBRE_WORDS) {
    const found = text.match(f.re);
    if (found) return `name says "${found[0]}" — fill the composition on the master and re-run`;
  }
  return undefined;
}

/** The fibre a trim is made of: its recorded composition / material, else a fibre word in its type or name. */
function trimFibre(recorded: unknown, ...hints: unknown[]): { fibre: Fibre | null; from: 'recorded' | 'hint' | null } {
  const own = words(recorded);
  if (own) {
    const main = byWeight(parseComposition(own))[0]?.fibre ?? fibreOf(own);
    if (main) return { fibre: main, from: 'recorded' };
  }
  const hint = words(...hints);
  // Organza lace and ribbon are nylon / polyester
  const fibre = fibreOf(hint) ?? (/organza|organaza/.test(hint) ? 'nylon' : null);
  return fibre ? { fibre, from: 'hint' } : { fibre: null, from: null };
}

// ─── Woven / knitted fabric (GREIGE, FABRIC) ────────────────────────────────────────────────────

type DyeState = 'unbleached' | 'dyed' | 'yarnDyed' | 'printed';
const STATE_DIGIT: Record<DyeState, string> = { unbleached: '1', dyed: '2', yarnDyed: '3', printed: '4' };
const STATE_WORD: Record<DyeState, string> = {
  unbleached: 'unbleached',
  dyed: 'dyed',
  yarnDyed: 'yarn-dyed',
  printed: 'printed',
};

type Weave = 'plain' | 'twill' | 'denim' | 'other';
type WeaveColumn = 'plainLight' | Weave;

// Cotton subheadings by dye state and weave. `plainLight` = plain weave ≤100 g/m² (5208 only).
const COTTON_5208: Record<DyeState, Record<WeaveColumn, string>> = {
  unbleached: { plainLight: '520811', plain: '520812', twill: '520813', denim: '520813', other: '520819' },
  dyed: { plainLight: '520831', plain: '520832', twill: '520833', denim: '520833', other: '520839' },
  yarnDyed: { plainLight: '520841', plain: '520842', twill: '520843', denim: '520843', other: '520849' },
  printed: { plainLight: '520851', plain: '520852', twill: '520859', denim: '520859', other: '520859' },
};
const COTTON_5209: Record<DyeState, Record<Weave, string>> = {
  unbleached: { plain: '520911', twill: '520912', denim: '520912', other: '520919' },
  dyed: { plain: '520931', twill: '520932', denim: '520932', other: '520939' },
  yarnDyed: { plain: '520941', twill: '520943', denim: '520942', other: '520949' },
  printed: { plain: '520951', twill: '520952', denim: '520952', other: '520959' },
};
const COTTON_5210: Record<DyeState, Record<Weave, string>> = {
  unbleached: { plain: '521011', twill: '521019', denim: '521019', other: '521019' },
  dyed: { plain: '521031', twill: '521032', denim: '521032', other: '521039' },
  yarnDyed: { plain: '521041', twill: '521049', denim: '521049', other: '521049' },
  printed: { plain: '521051', twill: '521059', denim: '521059', other: '521059' },
};
const COTTON_5211: Record<DyeState, Record<Weave, string>> = {
  unbleached: { plain: '521111', twill: '521112', denim: '521112', other: '521119' },
  dyed: { plain: '521131', twill: '521132', denim: '521132', other: '521139' },
  yarnDyed: { plain: '521141', twill: '521143', denim: '521142', other: '521149' },
  printed: { plain: '521151', twill: '521152', denim: '521152', other: '521159' },
};
const COTTON_5212: Record<'light' | 'heavy', Record<DyeState, string>> = {
  light: { unbleached: '521211', dyed: '521213', yarnDyed: '521214', printed: '521215' },
  heavy: { unbleached: '521221', dyed: '521223', yarnDyed: '521224', printed: '521225' },
};

interface FabricReading {
  composition: string | null;
  /** Where the composition came from — "greige GRG-0001", "fabric master", "its greige GRG-0050" */
  compositionFrom: string;
  gsm: number | null;
  /** The recorded weave (greige weaveType), if any */
  weave: string | null;
  /** Names and construction — for net / knit / filament / twill words */
  text: string;
  state: DyeState;
  /** How the state reads in the reason when it is more than the finish ("unbleached (greige)", an assumption) */
  stateLabel: string | null;
}

/** The weave: the recorded weaveType when there is one, else a weave word in the name; plain when neither says. */
function weaveOf(recorded: string | null, text: string): { weave: Weave; assumed: boolean } {
  const read = (t: string): Weave | null => {
    if (/denim/.test(t)) return 'denim';
    if (/twill|drill|gabardine|gaberdine/.test(t)) return 'twill';
    if (/satin|sateen|dobby|jacquard|oxford|herringbone|basket/.test(t)) return 'other';
    if (/plain|poplin|cambric|voile|muslin|mulmul/.test(t)) return 'plain';
    return null;
  };
  const own = words(recorded);
  if (own) return { weave: read(own) ?? 'other', assumed: false };
  const hinted = read(text);
  return hinted ? { weave: hinted, assumed: false } : { weave: 'plain', assumed: true };
}

const WEAVE_WORD: Record<Weave, string> = {
  plain: 'plain weave',
  twill: 'twill',
  denim: 'denim',
  other: 'other weave',
};

function fabricHsn(r: FabricReading): MaterialHsnProposal {
  const { text, state } = r;
  const embroidered = /\bemb\b|embroider/.test(text)
    ? 'name says embroidered — if it is bought already embroidered, 5810 (embroidery in the piece) applies instead'
    : null;
  const stateWord = r.stateLabel ?? STATE_WORD[state];

  // The kind of fabric decides before its fibre: a net is 5804 whatever it is made of or dyed
  if (/\b(net|tulle)\b/.test(text)) {
    return proposal('580410', 'net / tulle fabric (by name) → 580410', quote('composition', r.composition));
  }
  if (!r.composition || r.composition.trim() === '') {
    return proposal(null, 'composition not recorded on the master', nameHint(text));
  }
  const from = `composition "${r.composition.trim()}" (${r.compositionFrom})`;
  const parsed = parseComposition(r.composition);
  const shares = byWeight(parsed);
  if (shares.length === 0) {
    return proposal(
      null,
      parsed.length > 0 ? 'metallic yarn only — needs a person' : 'composition not understood',
      from
    );
  }
  const [main, second] = shares;
  const tie = second && second.pct === main.pct ? 'equal shares go to the later heading' : null;
  const gsmNote = r.gsm === null ? null : `${r.gsm} g/m²`;
  const digit = STATE_DIGIT[state];

  if (/\b(knit|knitted|jersey|interlock|rib|pique|fleece)\b/.test(text)) {
    if (shareOf(shares, (f) => f === 'elastane') >= 5) {
      return proposal(null, 'knitted with 5% or more elastane → 6004 (not in our HSN master) — needs a person', from);
    }
    const group =
      main.fibre === 'cotton' ? '2' : SYNTHETIC.has(main.fibre) ? '3' : main.fibre === 'artificial' ? '4' : null;
    const code = group ? `6006${group}${digit}` : '600690';
    return proposal(
      code,
      `knitted fabric (by name), ${group ? main.fibre : 'other fibre'}, ${stateWord} → ${code}`,
      join(from, tie)
    );
  }

  const heavy = r.gsm !== null && r.gsm > 200;
  const { weave, assumed: weaveAssumed } = weaveOf(r.weave, text);
  const weaveWord = weaveAssumed ? 'weave not recorded — taken as plain weave' : WEAVE_WORD[weave];

  switch (main.fibre) {
    case 'cotton': {
      if (main.pct >= 85) {
        if (heavy) {
          const code = COTTON_5209[state][weave];
          return proposal(
            code,
            `woven cotton ≥85%, over 200 g/m², ${weaveWord}, ${stateWord} → ${code}`,
            join(from, gsmNote, embroidered)
          );
        }
        const light = r.gsm !== null && r.gsm <= 100;
        const column: WeaveColumn = weave === 'plain' && light ? 'plainLight' : weave;
        const code = COTTON_5208[state][column];
        const weight =
          weave !== 'plain'
            ? 'up to 200 g/m²'
            : r.gsm === null
              ? 'GSM not recorded — taken as 100–200 g/m²'
              : light
                ? 'up to 100 g/m²'
                : '100–200 g/m²';
        return proposal(
          code,
          `woven cotton ≥85%, ${weaveWord}, ${weight}, ${stateWord} → ${code}`,
          join(from, gsmNote, embroidered)
        );
      }
      const weight = heavy
        ? 'over 200 g/m²'
        : r.gsm === null
          ? 'GSM not recorded — taken as up to 200 g/m²'
          : 'up to 200 g/m²';
      if (second && isManMade(second.fibre)) {
        const code = (heavy ? COTTON_5211 : COTTON_5210)[state][weave];
        return proposal(
          code,
          `woven cotton <85% mixed mainly with man-made fibre, ${weaveWord}, ${weight}, ${stateWord} → ${code}`,
          join(from, gsmNote, tie, embroidered)
        );
      }
      const code = COTTON_5212[heavy ? 'heavy' : 'light'][state];
      return proposal(
        code,
        `woven cotton <85%, other blend, ${weight}, ${stateWord} → ${code}`,
        join(from, gsmNote, tie, embroidered)
      );
    }
    case 'flax': {
      const plain = state === 'unbleached';
      const code = main.pct >= 85 ? (plain ? '530911' : '530919') : plain ? '530921' : '530929';
      return proposal(
        code,
        `woven flax / linen ${main.pct >= 85 ? '≥85%' : '<85%'}, ${stateWord} → ${code}`,
        join(from, tie, embroidered)
      );
    }
    case 'silk': {
      const code = main.pct >= 85 ? '500720' : '500790';
      return proposal(code, `woven silk ${main.pct >= 85 ? '≥85%' : '<85%'} → ${code}`, join(from, tie, embroidered));
    }
    case 'wool':
      return proposal(null, 'wool fabric — carded 5111 or combed 5112 (not in our HSN master); needs a person', from);
    case 'nylon':
    case 'polyester':
    case 'elastane':
    case 'synthetic': {
      if (/\bspun\b/.test(text)) {
        if (main.pct < 85) {
          return proposal(
            null,
            'spun synthetic blend <85% — 5513 / 5514 / 5515 by what it is mixed with; needs a person',
            from
          );
        }
        const plain = state === 'unbleached';
        const code = main.fibre === 'polyester' ? (plain ? '551211' : '551219') : plain ? '551291' : '551299';
        return proposal(
          code,
          `woven spun (staple) ${main.fibre} ≥85%, ${stateWord} → ${code}`,
          join(from, embroidered)
        );
      }
      // Woven polyester / nylon is filament yarn unless the name says spun
      const nylon = shareOf(shares, (f) => f === 'nylon');
      const polyester = shareOf(shares, (f) => f === 'polyester');
      const synthetic = shareOf(shares, (f) => SYNTHETIC.has(f));
      let code: string;
      let reason: string;
      if (nylon >= 85) {
        code = `54074${digit}`;
        reason = `woven nylon filament ≥85%, ${stateWord} → ${code}`;
      } else if (polyester >= 85) {
        code = `54075${digit}`;
        reason = `woven polyester filament ≥85% (taken as textured — non-textured would be 54076x), ${stateWord} → ${code}`;
      } else if (synthetic >= 85) {
        code = `54077${digit}`;
        reason = `woven synthetic filament ≥85%, mixed synthetics, ${stateWord} → ${code}`;
      } else if (second?.fibre === 'cotton') {
        code = `54078${digit}`;
        reason = `woven synthetic filament <85% mixed mainly with cotton, ${stateWord} → ${code}`;
      } else {
        code = `54079${digit}`;
        reason = `woven synthetic filament <85%, other blend, ${stateWord} → ${code}`;
      }
      return proposal(code, reason, join(from, tie, 'spun polyester would be 5512', embroidered));
    }
    case 'artificial': {
      const artificial = shareOf(shares, (f) => f === 'artificial');
      const filament = text.match(/georgette|chiffon|organza|organaza|satin|filament/);
      if (filament) {
        const code = artificial >= 85 ? `54082${digit}` : `54083${digit}`;
        return proposal(
          code,
          `woven viscose filament (name says georgette / chiffon / organza / satin) ${artificial >= 85 ? '≥85%' : '<85%'}, ${stateWord} → ${code}`,
          join(from, `name says "${filament[0]}"`, tie, embroidered)
        );
      }
      if (artificial >= 85) {
        const code = `55161${digit}`;
        return proposal(
          code,
          `woven viscose / rayon (staple) ≥85%, ${stateWord} → ${code}`,
          join(from, 'filament viscose would be 5408', embroidered)
        );
      }
      // <85%: the subheading follows what it is mixed mainly with
      let group = '9';
      let mixed = 'other blend';
      if (second?.fibre === 'nylon') {
        group = '2';
        mixed = 'mixed mainly with nylon (taken as filament yarn — spun would be 55169x)';
      } else if (second?.fibre === 'wool') {
        group = '3';
        mixed = 'mixed mainly with wool';
      } else if (second?.fibre === 'cotton') {
        group = '4';
        mixed = 'mixed mainly with cotton';
      } else if (second && SYNTHETIC.has(second.fibre)) {
        mixed = 'mixed mainly with polyester / other synthetic (taken as staple — filament would be 55162x)';
      }
      const code = `5516${group}${digit}`;
      return proposal(
        code,
        `woven viscose / rayon (staple) <85%, ${mixed}, ${stateWord} → ${code}`,
        join(from, tie, embroidered)
      );
    }
    default:
      return proposal(null, 'composition not understood', from);
  }
}

/** A finished fabric's dye state: its finishType, else a word in its name, else dyed (said so). */
function fabricState(fabric: MasterFacts, text: string): { state: DyeState; assumed: string | null } {
  switch (fabric.finishType) {
    case 'DYED':
      return { state: 'dyed', assumed: null };
    case 'PRINTED':
      return { state: 'printed', assumed: null };
    case 'YARN_DYED':
      return { state: 'yarnDyed', assumed: null };
    case 'RAW':
      return { state: 'unbleached', assumed: null };
    default:
      if (/print/.test(text)) return { state: 'printed', assumed: null };
      if (/yarn.?dyed/.test(text)) return { state: 'yarnDyed', assumed: null };
      if (/dyed|solid/.test(text)) return { state: 'dyed', assumed: null };
      return { state: 'dyed', assumed: 'finish not recorded — taken as dyed' };
  }
}

// ─── Per material type ──────────────────────────────────────────────────────────────────────────

const CARE_LABEL = /wash|care|content|composition|traceab|instruction|fibre|fiber|origin/;
const PRINTED_TEXTILE = /satin|satan|taffeta|canvas|ribbon|tape|tyvek/;
const TEXTILE = /polyester|nylon|cotton|fabric|textile|twill/;
const WOVEN = /woven|damask|jacquard/;
const PAPER = /paper|card|board|kraft/;
const PRINT_METHOD = /print|digital|screen|offset|flexo|thermal/;

function labelHsn(label: MasterFacts | null, sizeRowOf: string | null | undefined): MaterialHsnProposal {
  if (!label) return proposal(null, 'no label master linked');
  const material = words(label.material);
  const method = words(label.printMethod);
  const kind = words(label.labelType, label.labelName, label.description);
  const evidence = join(
    sizeRowOf ? `size row of ${sizeRowOf} — follows its label` : null,
    quote('type', label.labelType),
    quote('category', label.labelCategory),
    quote('material', label.material),
    quote('print', label.printMethod)
  );
  const care = CARE_LABEL.test(kind);

  if (/sticker/.test(`${kind} ${material}`))
    return proposal('482110', 'self-adhesive printed paper sticker → 482110', evidence);
  if (WOVEN.test(material) || WOVEN.test(method))
    return proposal('580710', 'woven label (by material / making) → 580710', evidence);
  if (PRINTED_TEXTILE.test(material))
    return proposal('580790', 'printed textile label (satin / taffeta / tape) → 580790', evidence);
  if (TEXTILE.test(material)) {
    return care || PRINT_METHOD.test(method)
      ? proposal('580790', 'textile care / printed label → 580790', evidence)
      : proposal(
          '580710',
          'textile main / size label — taken as woven (a printed one would be 580790) → 580710',
          evidence
        );
  }
  if (PAPER.test(material)) return proposal('482110', 'paper / card tag or label, printed → 482110', evidence);
  switch (label.labelCategory) {
    case 'SEWN_IN':
      if (care) {
        return proposal(
          '580790',
          'sewn-in care / content label, material not recorded — taken as printed satin / taffeta → 580790',
          evidence
        );
      }
      if (PRINT_METHOD.test(method)) {
        return proposal(
          '580790',
          'sewn-in printed label, material not recorded — taken as printed textile → 580790',
          evidence
        );
      }
      return proposal('580710', 'sewn-in main / size label, material not recorded — taken as woven → 580710', evidence);
    case 'HANGTAG':
    case 'PRICE_TAG':
      return proposal(
        '482110',
        'hangtag / price tag, material not recorded — taken as printed paper / card → 482110',
        evidence
      );
    default:
      return proposal(null, 'label category not recorded', evidence);
  }
}

function packagingHsn(pkg: MasterFacts | null, name: string): MaterialHsnProposal {
  if (!pkg) return proposal(null, 'no packaging master linked');
  const text = words(pkg.packagingType, pkg.packagingName, pkg.material, pkg.thickness, pkg.description, name);
  const evidence = join(
    quote('type', pkg.packagingType),
    quote('material', pkg.material),
    quote('thickness', pkg.thickness)
  );

  if (/hanger/.test(text)) {
    if (/wire/.test(text)) return proposal('732620', 'wire hanger (iron / steel wire) → 732620', evidence);
    if (/metal|steel|iron/.test(text)) return proposal('732690', 'metal hanger → 732690', evidence);
    if (/plastic|velvet|\bpp\b|\babs\b/.test(text)) return proposal('392690', 'plastic hanger → 392690', evidence);
    return proposal(null, 'hanger, material not recorded (plastic 392690 / metal 732690 / wood 4421)', evidence);
  }
  if (/sticker|barcode/.test(text)) return proposal('482110', 'printed paper sticker → 482110', evidence);
  if (/tissue|insert card|butter paper|wrapping paper/.test(text)) {
    return proposal(
      null,
      'tissue / insert paper → 4823 other paper articles (not in our HSN master) — needs a person',
      evidence
    );
  }
  if (/tape/.test(text))
    return proposal(
      null,
      'packing tape → 3919 self-adhesive plastic (not in our HSN master) — needs a person',
      evidence
    );
  if (/silica/.test(text)) return proposal(null, 'silica gel — needs a person', evidence);
  if (/non.?woven|cloth|fabric|cotton|jute/.test(words(pkg.material, pkg.packagingType))) {
    return proposal(null, 'textile bag / cover (6305 / 6307) — needs a person', evidence);
  }
  if (/paper bag|kraft bag/.test(text)) return proposal('481940', 'paper bag → 481940', evidence);
  if (/corrugated|\bply\b/.test(text)) return proposal('481910', 'corrugated carton (ply board) → 481910', evidence);
  if (/mono ?carton|folding|duplex/.test(text))
    return proposal('481920', 'folding carton (not corrugated) → 481920', evidence);
  if (/carton/.test(text)) {
    return proposal('481910', 'carton, board not recorded — taken as corrugated (shipping carton) → 481910', evidence);
  }
  if (/\bbox\b|\bcase\b|crate/.test(text)) {
    if (/plastic|pvc|\bpp\b|\bpet\b|acrylic/.test(text)) return proposal('392310', 'plastic box → 392310', evidence);
    return proposal('481920', 'card box, not corrugated → 481920 folding cartons', evidence);
  }
  if (
    /\bpoly\b|polybag|plastic|zip ?lock|ldpe|hdpe|bopp|\bpp\b|polypropylene|garment cover|dust cover|pouch|\bbag\b/.test(
      text
    )
  ) {
    if (/\bpp\b|polypropylene|bopp|pvc|\bpet\b/.test(text))
      return proposal('392329', 'polypropylene / other plastic bag → 392329', evidence);
    if (/ldpe|hdpe|polyethylene|polythene/.test(text)) return proposal('392321', 'polyethylene bag → 392321', evidence);
    return proposal(
      '392321',
      'poly bag / pouch, plastic not recorded — taken as polyethylene (LDPE) → 392321',
      evidence
    );
  }
  return proposal(null, 'packaging type not recognised', evidence);
}

const EMBROIDERED_LACE = /schiffli|embroider|sequin|sequence|mirror|chikan/;

function laceHsn(lace: MasterFacts | null, name: string): MaterialHsnProposal {
  if (!lace) return proposal(null, 'no lace master linked');
  const text = words(lace.laceType, lace.laceName, lace.design, lace.composition, lace.description, name);
  const evidence = join(
    quote('type', lace.laceType),
    quote('design', lace.design),
    quote('composition', lace.composition),
    lace.isGreige === true ? 'greige (undyed) lace — the same code once dyed' : null
  );
  const { fibre, from } = trimFibre(lace.composition, lace.laceType, lace.laceName, name);
  const assumed = from === 'hint' ? ' (fibre from its type / name)' : '';

  const embroidered = text.match(EMBROIDERED_LACE);
  if (embroidered) {
    const says = join(`says "${embroidered[0]}"`, evidence);
    if (fibre === 'cotton')
      return proposal('581091', `schiffli / sequin / mirror-work lace = embroidery, cotton${assumed} → 581091`, says);
    if (fibre && isManMade(fibre)) {
      return proposal(
        '581092',
        `schiffli / sequin / mirror-work lace = embroidery, man-made fibre${assumed} → 581092`,
        says
      );
    }
    if (fibre)
      return proposal(
        '581099',
        `schiffli / sequin / mirror-work lace = embroidery, zari / other textile${assumed} → 581099`,
        says
      );
    return /schiffli/.test(text)
      ? proposal(
          '581091',
          'schiffli lace, composition not recorded — taken as cotton (the usual schiffli) → 581091',
          says
        )
      : proposal(
          '581092',
          'sequin / mirror-work lace, composition not recorded — taken as man-made fibre → 581092',
          says
        );
  }
  const trimming = text.match(/gota|zari|fringe|frinze|tape|braid|dori|tassel/);
  if (trimming) {
    const says = join(`says "${trimming[0]}"`, evidence);
    return /braid|dori/.test(trimming[0])
      ? proposal('580810', 'braid / dori → 580810 braids in the piece', says)
      : proposal('580890', 'gota / zari / fringe / tape → 580890 ornamental trimmings', says);
  }
  if (fibre && isManMade(fibre)) return proposal('580421', `lace, man-made fibre${assumed} → 580421`, evidence);
  if (fibre) return proposal('580429', `lace, cotton / other textile${assumed} → 580429`, evidence);
  return proposal(
    '580421',
    'lace, composition not recorded — taken as man-made fibre (polyester / nylon machine lace) → 580421',
    evidence
  );
}

function threadHsn(thread: MasterFacts | null): MaterialHsnProposal {
  if (!thread) return proposal(null, 'no thread master linked');
  const text = words(thread.threadName, thread.description, thread.brand);
  const placeholder = /placeholder/.test(text) ? 'placeholder thread, not a real item' : null;
  switch (thread.materialComposition) {
    case 'COTTON':
      return proposal('520411', 'cotton sewing thread (industrial cones, not for retail sale) → 520411', placeholder);
    case 'POLYESTER':
      return /filament/.test(text)
        ? proposal('540110', 'polyester filament sewing thread → 540110', placeholder)
        : proposal(
            '550810',
            'polyester sewing thread, taken as spun (the usual kind — filament would be 540110) → 550810',
            placeholder
          );
    default:
      return proposal(
        null,
        'thread composition not recorded (cotton 520411 / spun polyester 550810 / filament 540110)',
        placeholder
      );
  }
}

/** Beads, sequins, buckles and loose fasteners are classified by what they are made of. */
function byMaterial(what: string, text: string, evidence: string, fallback?: 'plastic'): MaterialHsnProposal {
  if (GLASS.test(text))
    return proposal(null, `glass ${what} → 7018 (not in our HSN master) — needs a person`, evidence);
  if (METAL.test(text))
    return proposal('830890', `metal ${what} → 830890 base-metal clasps, buckles, beads, spangles`, evidence);
  if (PLASTIC.test(text)) return proposal('392690', `plastic ${what} → 392690 other articles of plastics`, evidence);
  if (fallback === 'plastic')
    return proposal('392690', `${what}, material not recorded — taken as plastic → 392690`, evidence);
  return proposal(null, `${what}, material not recorded (metal 830890 / plastic 392690)`, evidence);
}

function buttonHsn(button: MasterFacts, name: string): MaterialHsnProposal {
  const recorded = words(button.material);
  const text = recorded || words(button.buttonName, button.description, name);
  const evidence = join(quote('material', button.material)) || undefined;
  if (/cover|fabric|cloth/.test(text)) return proposal('960629', 'fabric-covered button → 960629', evidence);
  if (METAL.test(text)) return proposal('960622', 'metal button → 960622', evidence);
  if (PLASTIC.test(text)) return proposal('960621', 'plastic / polyester button → 960621', evidence);
  if (/coconut|shell|wood|horn|bone|ceramic|pearl|mother|stone|leather|jute|glass/.test(text)) {
    return proposal('960629', 'button of shell / coconut / wood / horn … → 960629 other buttons', evidence);
  }
  return proposal(
    '960621',
    `button material ${recorded ? 'not one we recognise' : 'not recorded'} — taken as plastic (polyester), the usual garment button → 960621`,
    evidence
  );
}

function zipperHsn(zipper: MasterFacts, name: string): MaterialHsnProposal {
  const text = words(zipper.teethType) || words(zipper.zipperName, zipper.description, name);
  const evidence = join(quote('teeth', zipper.teethType)) || undefined;
  if (/metal|brass|alumin|antique|copper|nickel|steel/.test(text))
    return proposal('960711', 'metal-tooth zipper → 960711', evidence);
  if (/nylon|coil|plastic|vislon|invisible|resin|delrin|polyester|mou?lded/.test(text)) {
    return proposal('960719', 'nylon coil / plastic zipper → 960719', evidence);
  }
  return proposal(
    '960719',
    'zipper teeth not recorded — taken as nylon coil, the usual garment zipper → 960719',
    evidence
  );
}

/**
 * The 6-digit HSN a material is bought under, and why. Pure: reads only the facts handed in.
 * `code: null` = the master does not say enough — the material is left for a person, never guessed.
 */
export function proposeMaterialHsn(facts: MaterialHsnFacts): MaterialHsnProposal {
  const master = facts.master;
  const m: MasterFacts = master ?? {};
  const name = facts.name ?? '';
  switch (facts.materialType) {
    case MaterialType.LABEL:
      return labelHsn(master, facts.sizeRowOf);
    case MaterialType.PACKAGING:
      return packagingHsn(master, name);
    case MaterialType.GREIGE: {
      if (!master) return proposal(null, 'no greige master linked — composition unknown', nameHint(words(name)));
      const composition = (m.composition as string | null) ?? null;
      return fabricHsn({
        composition,
        compositionFrom: `greige ${String(m.greigeCode ?? '')}`.trim(),
        gsm: gsmOf(m.gsmRange),
        weave: (m.weaveType as string | null) ?? null,
        text: words(m.greigeName, m.weaveType, m.construction, name),
        // Greige is loom-state cloth: unbleached
        state: 'unbleached',
        stateLabel: 'unbleached (greige)',
      });
    }
    case MaterialType.FABRIC: {
      if (!master) return proposal(null, 'no fabric master linked — composition unknown', nameHint(words(name)));
      // Dyeing and printing do not change the fibre, so a finished fabric reads its greige's composition
      const greige = facts.greige ?? null;
      const own = (m.composition as string | null) ?? null;
      const greigeComposition = (greige?.composition as string | null) ?? null;
      const text = words(m.fabricName, m.finishedConstruction, greige?.greigeName, greige?.weaveType, name);
      const { state, assumed } = fabricState(m, text);
      return fabricHsn({
        composition: own?.trim() ? own : greigeComposition,
        compositionFrom: own?.trim() ? 'fabric master' : `its greige ${String(greige?.greigeCode ?? '')}`.trim(),
        gsm: gsmOf(m.actualGSM, greige?.gsmRange),
        weave: (greige?.weaveType as string | null) ?? null,
        text,
        state,
        stateLabel: assumed,
      });
    }
    case MaterialType.LACE:
      return laceHsn(master, name);
    case MaterialType.THREAD:
      return threadHsn(master);
    case MaterialType.BUTTON:
      return buttonHsn(m, name);
    case MaterialType.SNAP_BUTTON:
      return proposal('960610', 'snap / press fastener → 960610', quote('material', m.material));
    case MaterialType.ZIPPER:
      return zipperHsn(m, name);
    case MaterialType.HOOK_EYE: {
      const evidence = quote('material', m.material) ?? 'material not recorded — hooks & eyes are metal';
      return PLASTIC.test(words(m.material))
        ? proposal('392690', 'plastic hooks & eyes → 392690', evidence)
        : proposal('830810', 'hooks & eyes (metal) → 830810', evidence);
    }
    case MaterialType.BUCKLE:
      return byMaterial(
        'buckle',
        words(m.material, m.type, m.buckleName),
        join(quote('material', m.material), quote('type', m.type))
      );
    case MaterialType.OTHER_FASTENER: {
      const text = words(m.type, m.material, m.otherFastenerName, m.description, name);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/velcro|hook.?(and|&).?loop/.test(text))
        return proposal('580632', 'hook-and-loop tape (nylon narrow woven) → 580632', evidence);
      if (/\bsnap|\bpress/.test(text)) return proposal('960610', 'press / snap fastener → 960610', evidence);
      return byMaterial('fastener', text, evidence);
    }
    case MaterialType.VELCRO:
      return proposal('580632', 'hook-and-loop tape (nylon narrow woven) → 580632', quote('type', m.type));
    case MaterialType.ELASTIC: {
      const text = words(m.elasticType, m.elasticName, m.composition, m.description);
      const evidence = join(quote('type', m.elasticType), quote('composition', m.composition));
      if (/knit/.test(text))
        return proposal(null, 'knitted elastic → 6002 (not in our HSN master) — needs a person', evidence);
      if (/braid/.test(text)) return proposal('580810', 'braided elastic → 580810 braids in the piece', evidence);
      return m.elasticType
        ? proposal('580620', 'woven elastic tape (narrow woven, with elastomeric yarn) → 580620', evidence)
        : proposal('580620', 'elastic, type not recorded — taken as woven elastic tape → 580620', evidence);
    }
    case MaterialType.DRAWSTRING:
      return proposal('580810', 'drawstring cord = braid in the piece → 580810', quote('material', m.material));
    case MaterialType.RIBBON: {
      const text = words(m.type, m.ribbonName, m.pattern, m.description, name);
      const evidence = join(quote('type', m.type)) || undefined;
      if (/velvet/.test(text)) return proposal('580610', 'velvet ribbon (narrow woven pile) → 580610', evidence);
      if (/cotton/.test(text)) return proposal('580631', 'cotton ribbon (narrow woven) → 580631', evidence);
      return proposal(
        '580632',
        'ribbon (narrow woven), taken as man-made fibre (satin / grosgrain polyester) → 580632',
        evidence
      );
    }
    case MaterialType.OTHER_TAPE: {
      const text = words(m.type, m.material, m.otherTapeName, m.description);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/adhesive|reflective|fusing|fusible/.test(text))
        return proposal(null, 'adhesive / reflective / fusing tape — needs a person', evidence);
      if (/braid/.test(text)) return proposal('580810', 'braided tape → 580810', evidence);
      if (/elastic/.test(text)) return proposal('580620', 'elastic tape → 580620', evidence);
      if (/cotton/.test(text)) return proposal('580631', 'cotton tape (narrow woven) → 580631', evidence);
      return proposal('580632', 'tape (narrow woven), taken as man-made fibre → 580632', evidence);
    }
    case MaterialType.INTERLINING: {
      const evidence = join(
        quote('type', m.type),
        m.fusible === true ? 'fusible' : m.fusible === false ? 'not fusible' : null,
        quote('weight', m.weight)
      );
      if (/non.?woven/.test(words(m.type, m.interliningName, m.description))) {
        const gsm = gsmOf(m.weight);
        if (gsm === null)
          return proposal(
            '560312',
            'non-woven interlining, weight not recorded — taken as 25–70 g/m² → 560312',
            evidence
          );
        const code = gsm <= 25 ? '560311' : gsm <= 70 ? '560312' : gsm <= 150 ? '560313' : '560314';
        return proposal(
          code,
          `non-woven interlining (man-made filament), ${gsm <= 25 ? 'up to 25' : gsm <= 70 ? '25–70' : gsm <= 150 ? '70–150' : 'over 150'} g/m² → ${code}`,
          evidence
        );
      }
      if (m.fusible === true)
        return proposal('590390', 'fusible interlining (fabric coated with plastics) → 590390', evidence);
      return proposal(null, 'woven, not fusible — classify by its fibre; needs a person', evidence);
    }
    case MaterialType.BEAD:
      return byMaterial('bead', words(m.material, m.beadName), join(quote('material', m.material)));
    case MaterialType.SEQUIN:
      return byMaterial(
        'sequin',
        words(m.finish, m.sequinName, m.description),
        join(quote('finish', m.finish)),
        'plastic'
      );
    case MaterialType.MOTIF: {
      const { fibre } = trimFibre(null, m.type, m.motifName, m.design, m.description, name);
      const evidence = join(quote('type', m.type)) || undefined;
      if (fibre === 'cotton') return proposal('581091', 'embroidered motif, cotton → 581091', evidence);
      return proposal(
        '581092',
        'embroidered motif, material not recorded — taken as man-made fibre → 581092',
        evidence
      );
    }
    case MaterialType.OTHER_DECORATIVE: {
      const text = words(m.type, m.otherDecorativeName, m.material, m.description, name);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/tassel|pom.?pom|fringe/.test(text))
        return proposal('580890', 'tassel / pompom / fringe → 580890 ornamental trimmings', evidence);
      const { fibre } = trimFibre(m.material, m.type, m.otherDecorativeName);
      if (/lace/.test(text)) {
        if (fibre && !isManMade(fibre))
          return proposal('580429', 'lace (decorative), cotton / other textile → 580429', evidence);
        return proposal('580421', 'lace (decorative), man-made fibre or not recorded → 580421', evidence);
      }
      if (/motif|patch|embroider|applique/.test(text)) {
        if (fibre === 'cotton') return proposal('581091', 'embroidered motif / patch, cotton → 581091', evidence);
        return proposal('581092', 'embroidered motif / patch, man-made fibre or not recorded → 581092', evidence);
      }
      if (/bead|sequin/.test(text)) return byMaterial('bead / sequin', text, evidence);
      return proposal(null, 'decorative item not recognised', evidence);
    }
    case MaterialType.BELT: {
      const text = words(m.material, m.type, m.beltName);
      const evidence = join(quote('type', m.type), quote('material', m.material));
      if (/\bpu\b|faux|synthetic|rexine|pvc|plastic/.test(text))
        return proposal('392620', 'PU / plastic belt → 392620 plastic clothing accessories', evidence);
      if (/leather/.test(text))
        return proposal(null, 'leather belt → 4203 (not in our HSN master) — needs a person', evidence);
      if (/fabric|cotton|polyester|textile|elastic/.test(text))
        return proposal('621710', 'textile belt → 621710 clothing accessories', evidence);
      return proposal(null, 'belt material not recorded', evidence);
    }
    case MaterialType.MACHINE_PART: {
      const text = words(m.machine, m.category, m.partName, m.description, name);
      const evidence =
        join(quote('machine', m.machine), quote('category', m.category)) ||
        'machine not recorded — taken as a sewing machine';
      if (/compressor|boiler|steam|generator|press machine|\biron\b/.test(text)) {
        return proposal(null, 'part of a machine other than a sewing machine — needs a person', evidence);
      }
      if (/needle/.test(text)) return proposal('845230', 'sewing machine needle → 845230', evidence);
      return proposal('845290', 'sewing machine part → 845290', evidence);
    }
    case MaterialType.PADDING:
      return proposal(null, 'padding / wadding (5601) or foam (3921) — needs a person', quote('material', m.material));
    default:
      // OTHER, OTHER_MATERIAL, OTHER_FUNCTIONAL, GENERIC, TRIMS, ACCESSORIES, SERVICE: the type says nothing about the goods
      return proposal(null, 'type says nothing about what it is');
  }
}

// ─── Reading the facts and writing the code ─────────────────────────────────────────────────────

type MasterTable = { findMany(args: { where: { id: { in: string[] } } }): Promise<MasterFacts[]> };

/**
 * The facts proposeMaterialHsn needs for each material, read in a few queries: the material, the master each
 * points at, a label size row's label, a finished fabric's greige. Ids with no materials row are absent.
 */
export async function loadMaterialHsnFacts(
  materialIds: string[],
  tx?: Prisma.TransactionClient
): Promise<Map<string, MaterialHsnFacts & { code: string; name: string; hsnCode: string | null }>> {
  const db: Db = tx ?? prisma;
  const out = new Map<string, MaterialHsnFacts & { code: string; name: string; hsnCode: string | null }>();
  const ids = Array.from(new Set(materialIds.filter((id) => typeof id === 'string' && id.trim() !== '')));
  if (ids.length === 0) return out;

  const materials = await db.materials.findMany({ where: { id: { in: ids } } });
  const fkOf = (row: (typeof materials)[number], field: string) =>
    (row as unknown as Record<string, string | null>)[field] ?? null;

  // A label size row without its own labelId still reaches the label through its size variant
  const variantLabel = new Map<string, string>();
  const variantIds = materials
    .filter((r) => r.materialType === MaterialType.LABEL && !r.labelId && r.sizeVariantId)
    .map((r) => r.sizeVariantId as string);
  if (variantIds.length > 0) {
    const variants = await db.label_size_variants.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, labelId: true },
    });
    for (const v of variants) variantLabel.set(v.id, v.labelId);
  }
  const masterIdOf = (row: (typeof materials)[number]): string | null => {
    const cfg = MASTER_CONFIG[row.materialType];
    if (!cfg) return null;
    const fk = fkOf(row, cfg.fkField);
    if (fk) return fk;
    return row.materialType === MaterialType.LABEL && row.sizeVariantId
      ? (variantLabel.get(row.sizeVariantId) ?? null)
      : null;
  };

  // Every master row the materials point at, one query per master table
  const masters = new Map<string, MasterFacts>();
  const idsByTable = new Map<string, Set<string>>();
  for (const row of materials) {
    const cfg = MASTER_CONFIG[row.materialType];
    const id = masterIdOf(row);
    if (!cfg || !id) continue;
    idsByTable.set(cfg.table, (idsByTable.get(cfg.table) ?? new Set<string>()).add(id));
  }
  const tables = db as unknown as Record<string, MasterTable>;
  for (const [table, tableIds] of idsByTable) {
    const found = await tables[table].findMany({ where: { id: { in: Array.from(tableIds) } } });
    for (const row of found) masters.set(`${table}:${String(row.id)}`, row);
  }

  // A finished fabric's composition, GSM and weave usually live on its greige
  const greigeIds = Array.from(masters.entries())
    .filter(([key, row]) => key.startsWith('fabric_master:') && typeof row.greigeId === 'string')
    .map(([, row]) => row.greigeId as string);
  const greiges = new Map<string, MasterFacts>();
  if (greigeIds.length > 0) {
    const found = await db.greige_master.findMany({ where: { id: { in: Array.from(new Set(greigeIds)) } } });
    for (const g of found) greiges.set(g.id, g as unknown as MasterFacts);
  }

  for (const row of materials) {
    const cfg = MASTER_CONFIG[row.materialType];
    const id = masterIdOf(row);
    const master = cfg && id ? (masters.get(`${cfg.table}:${id}`) ?? null) : null;
    const greigeId = row.materialType === MaterialType.FABRIC ? (master?.greigeId as string | null | undefined) : null;
    out.set(row.id, {
      materialType: row.materialType,
      code: row.code,
      name: row.name,
      hsnCode: row.hsnCode,
      master,
      greige: greigeId ? (greiges.get(greigeId) ?? null) : null,
      sizeRowOf:
        master && row.materialType === MaterialType.LABEL && row.sizeVariantId ? String(master.labelCode) : null,
    });
  }
  return out;
}

/**
 * Give a material its HSN code when it has none: the proposed code, IF the HSN master has it (active) — so the
 * PO GST resolver finds its rate by the exact code. Never overwrites a code already there (someone chose it),
 * never throws for "nothing to propose" (the dry run lists those for a person). Returns the code now on the row.
 */
export async function fillMaterialHsnIfBlank(
  materialId: string,
  tx?: Prisma.TransactionClient
): Promise<string | null> {
  const db: Db = tx ?? prisma;
  const facts = (await loadMaterialHsnFacts([materialId], tx)).get(materialId);
  if (!facts) return null;
  if (facts.hsnCode && facts.hsnCode.trim() !== '') return facts.hsnCode;

  const { code } = proposeMaterialHsn(facts);
  if (!code) return null;
  const known = await db.hsn_sac_masters.findFirst({ where: { code, isActive: true }, select: { code: true } });
  if (!known) return null;

  const written = await db.materials.updateMany({
    where: { id: materialId, OR: [{ hsnCode: null }, { hsnCode: '' }] },
    data: { hsnCode: code },
  });
  if (written.count > 0) return code;
  // Someone gave it a code between the read and the write — theirs stands
  const now = await db.materials.findUnique({ where: { id: materialId }, select: { hsnCode: true } });
  return now?.hsnCode && now.hsnCode.trim() !== '' ? now.hsnCode : null;
}
