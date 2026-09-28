/**
 * proposeMaterialHsn — the one rule for a material's 6-digit HSN code (services/helpers/material-hsn.helper.ts).
 * Pure: every case below hands in the master facts a material would have and reads the code and reason back.
 */

import {
  MATERIAL_HSN_CODES,
  MATERIAL_HSN_PATTERN,
  isMaterialHsn,
  proposeMaterialHsn,
  type MaterialHsnFacts,
  type MasterFacts,
} from '../../services/helpers/material-hsn.helper';

type Type = MaterialHsnFacts['materialType'];

const propose = (materialType: Type, master: MasterFacts | null, extra: Partial<MaterialHsnFacts> = {}) =>
  proposeMaterialHsn({ materialType, master, ...extra });
const codeOf = (materialType: Type, master: MasterFacts | null, extra: Partial<MaterialHsnFacts> = {}) =>
  propose(materialType, master, extra).code;

const greige = (composition: string | null, extra: MasterFacts = {}) =>
  propose('GREIGE', { greigeCode: 'GRG-T', greigeName: 'Test greige', composition, ...extra });
const fabric = (finishType: string | null, composition: string | null, extra: MasterFacts = {}) =>
  propose('FABRIC', { fabricCode: 'FAB-T', fabricName: 'Test fabric', finishType, composition, ...extra });

// Every code any case in this file produced — held against MATERIAL_HSN_CODES at the end
const seen = new Set<string>();
const note = (code: string | null) => {
  if (code) seen.add(code);
  return code;
};

describe('the code format', () => {
  it('a material HSN is 6 digits, 8 allowed', () => {
    expect(isMaterialHsn('520812')).toBe(true);
    expect(isMaterialHsn('52081200')).toBe(true);
    expect(isMaterialHsn('5208')).toBe(false);
    expect(isMaterialHsn('5208123')).toBe(false);
    expect(isMaterialHsn(' 520812')).toBe(false);
    expect(isMaterialHsn(520812)).toBe(false);
    expect(isMaterialHsn(null)).toBe(false);
    expect(MATERIAL_HSN_PATTERN.test('960621')).toBe(true);
  });

  it('MATERIAL_HSN_CODES: 6 digits each, under their own heading, no repeats, described', () => {
    const codes = MATERIAL_HSN_CODES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of MATERIAL_HSN_CODES) {
      expect(c.code).toMatch(/^\d{6}$/);
      expect(c.heading).toBe(c.code.slice(0, 4));
      expect(c.description.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('LABEL', () => {
  const label = (m: MasterFacts, extra: Partial<MaterialHsnFacts> = {}) =>
    propose('LABEL', { labelCode: 'LBL-T', ...m }, extra);

  it('sewn-in main / size label with no material → woven 580710, and says it assumed woven', () => {
    const p = label({ labelType: 'Main Cum Size Label', labelCategory: 'SEWN_IN' });
    expect(note(p.code)).toBe('580710');
    expect(p.reason).toMatch(/taken as woven/);
  });

  it('sewn-in wash-care / traceability label → printed textile 580790', () => {
    expect(note(label({ labelType: 'Washcare Label', labelCategory: 'SEWN_IN' }).code)).toBe('580790');
    expect(note(label({ labelType: 'Traceability Label', labelCategory: 'SEWN_IN' }).code)).toBe('580790');
  });

  it('a sewn-in label printed digitally → 580790', () => {
    expect(note(label({ labelType: 'Brand Label', labelCategory: 'SEWN_IN', printMethod: 'digital' }).code)).toBe(
      '580790'
    );
  });

  it('material decides before category: satin (even misspelt) → 580790, woven / damask → 580710, card → 482110', () => {
    expect(note(label({ labelCategory: 'HANGTAG', material: 'satan' }).code)).toBe('580790');
    expect(note(label({ labelType: 'Washcare', labelCategory: 'SEWN_IN', material: 'Damask' }).code)).toBe('580710');
    expect(note(label({ labelCategory: 'HANGTAG', material: 'Card' }).code)).toBe('482110');
  });

  it('polyester main label → woven 580710; polyester care label → 580790', () => {
    expect(note(label({ labelType: 'Main Label', labelCategory: 'SEWN_IN', material: 'Polyester' }).code)).toBe(
      '580710'
    );
    expect(note(label({ labelType: 'Care Label', labelCategory: 'SEWN_IN', material: 'Polyester' }).code)).toBe(
      '580790'
    );
  });

  it('price tags, hangtags and stickers are printed paper labels → 482110', () => {
    expect(note(label({ labelType: 'Price Tag', labelCategory: 'PRICE_TAG' }).code)).toBe('482110');
    expect(note(label({ labelType: 'Liva Tag', labelCategory: 'HANGTAG' }).code)).toBe('482110');
    expect(note(label({ labelType: 'Barcode Sticker', labelCategory: 'SEWN_IN' }).code)).toBe('482110');
  });

  it('a size row follows its label and says so', () => {
    const p = label({ labelType: 'Size Label', labelCategory: 'SEWN_IN' }, { sizeRowOf: 'LBL-0010' });
    expect(p.code).toBe('580710');
    expect(p.evidence).toMatch(/size row of LBL-0010/);
  });

  it('no label master → blank', () => {
    expect(codeOf('LABEL', null)).toBeNull();
  });
});

describe('GREIGE — unbleached, by composition, weave and GSM', () => {
  it('cotton, plain, GSM not recorded → 520812 and the reason says the weight was assumed', () => {
    const p = greige('100% Cotton', { weaveType: 'Plain' });
    expect(note(p.code)).toBe('520812');
    expect(p.reason).toMatch(/GSM not recorded — taken as 100–200/);
    expect(p.reason).toMatch(/unbleached/);
  });

  it('cotton ≤100 g/m² → 520811; a range reads its top ("120-130" → >100) → 520812', () => {
    expect(note(greige('100% Cotton', { weaveType: 'Plain', gsmRange: '90' }).code)).toBe('520811');
    expect(greige('100% Cotton', { weaveType: 'Plain', gsmRange: '120-130' }).code).toBe('520812');
  });

  it('weave not recorded → plain, said so; twill in the name → 520813', () => {
    expect(greige('100% Cotton', { weaveType: '' }).reason).toMatch(/weave not recorded — taken as plain/);
    expect(note(greige('100% Cotton', { greigeName: 'cotton twill 63"' }).code)).toBe('520813');
  });

  it('cotton over 200 g/m² → 5209', () => {
    expect(note(greige('100% Cotton', { weaveType: 'Plain', gsmRange: '240' }).code)).toBe('520911');
  });

  it('87% cotton 13% flax and 97% cotton 3% lurex are still ≥85% cotton → 5208', () => {
    expect(greige('87% Cotton 13% Flax').code).toBe('520812');
    expect(greige('97% Cotton 3% Lurex', { weaveType: 'Plain' }).code).toBe('520812');
  });

  it('cotton <85% mixed with polyester → 5210; with flax → 5212', () => {
    expect(note(greige('60% Cotton 40% Polyester', { weaveType: 'Plain' }).code)).toBe('521011');
    expect(note(greige('60% Cotton 40% Flax').code)).toBe('521211');
  });

  it('viscose staple → 551611; georgette / organza by name → viscose filament 540821', () => {
    expect(note(greige('100% Viscose', { weaveType: 'Plain' }).code)).toBe('551611');
    const georgette = greige('100% Viscose', { greigeName: 'Georgette 60×60 / 200×200 / 63"' });
    expect(note(georgette.code)).toBe('540821');
    expect(greige('100% Viscose', { greigeName: 'Viscose Organaza 1×1' }).code).toBe('540821');
  });

  it('viscose blends go by what they are mixed mainly with; 50/50 with cotton goes to the later heading (5516)', () => {
    const nylon = greige('60%Viscose40%Nylon');
    expect(note(nylon.code)).toBe('551621');
    expect(nylon.reason).toMatch(/taken as filament/);
    const even = greige('50%Viscose 50%Cotton');
    expect(note(even.code)).toBe('551641');
    expect(even.evidence).toMatch(/equal shares/);
  });

  it('polyester → textured polyester filament 540751 (said so); nylon → 540741', () => {
    const poly = greige('100% Polyster');
    expect(note(poly.code)).toBe('540751');
    expect(poly.reason).toMatch(/taken as textured/);
    expect(note(greige('100% Nylon').code)).toBe('540741');
  });

  it('net by name → 580410 whatever the fibre; silk → 500720', () => {
    expect(note(greige('100% Nylon', { greigeName: 'Pink Net 1×1 / 1×1 / 57"' }).code)).toBe('580410');
    expect(note(greige('100% Pure Silk').code)).toBe('500720');
  });

  it('knitted cotton → 600621; knitted with 5% elastane → blank (6004 is not in our master)', () => {
    expect(note(greige('100% Cotton', { greigeName: 'Cotton Jersey' }).code)).toBe('600621');
    expect(greige('95% Cotton 5% Spandex', { greigeName: 'Cotton Jersey' }).code).toBeNull();
  });

  it('spun polyester by name → 5512', () => {
    expect(note(greige('100% Polyester', { greigeName: 'Spun Poly' }).code)).toBe('551211');
  });

  it('blank for a person: no master, no composition, wool, metallic yarn only, unreadable composition', () => {
    const noMaster = propose('GREIGE', null, { name: 'DDVMUID7T0N Cotton Flex 63"' });
    expect(noMaster.code).toBeNull();
    expect(noMaster.evidence).toMatch(/name says "cotton"/);
    expect(greige(null).code).toBeNull();
    expect(greige('100% Wool').code).toBeNull();
    expect(greige('100% Lurex').code).toBeNull();
    expect(greige('100% Mystery Fibre').code).toBeNull();
  });
});

describe('FABRIC — dyed / printed from finishType, composition from the fabric or its greige', () => {
  it('dyed cotton → 520832, printed → 520852, yarn-dyed → 520842, RAW → 520812', () => {
    expect(note(fabric('DYED', '100% Cotton').code)).toBe('520832');
    expect(note(fabric('PRINTED', '100% Cotton').code)).toBe('520852');
    expect(note(fabric('YARN_DYED', '100% Cotton').code)).toBe('520842');
    expect(fabric('RAW', '100% Cotton').code).toBe('520812');
  });

  it('printed twill has no twill subheading → 520859; dyed ≤100 g/m² → 520831', () => {
    expect(note(fabric('PRINTED', '100% Cotton', { fabricName: 'Cotton Twill' }).code)).toBe('520859');
    expect(note(fabric('DYED', '100% Cotton', { actualGSM: 90 }).code)).toBe('520831');
  });

  it('heavy yarn-dyed denim → 520942', () => {
    expect(note(fabric('YARN_DYED', '100% Cotton', { fabricName: 'Denim', actualGSM: 300 }).code)).toBe('520942');
  });

  it('viscose dyed → 551612, printed → 551614; polyester dyed → 540752, printed → 540754', () => {
    expect(note(fabric('DYED', '100% Viscose').code)).toBe('551612');
    expect(note(fabric('PRINTED', '100% Viscose').code)).toBe('551614');
    expect(note(fabric('DYED', '100% Polyester').code)).toBe('540752');
    expect(note(fabric('PRINTED', '100% Polyster').code)).toBe('540754');
  });

  it("reads its greige's composition, GSM and weave when it has none of its own", () => {
    const p = proposeMaterialHsn({
      materialType: 'FABRIC',
      master: { fabricName: 'LNG226 - Poplin - Printed', finishType: 'PRINTED', composition: null, greigeId: 'g1' },
      greige: { greigeCode: 'GRG-0017', composition: '100% Cotton', weaveType: 'Twill', gsmRange: '250' },
    });
    expect(note(p.code)).toBe('520952');
    expect(p.evidence).toMatch(/its greige GRG-0017/);
  });

  it("its own composition beats its greige's", () => {
    const p = proposeMaterialHsn({
      materialType: 'FABRIC',
      master: { fabricName: 'French Crepe - Printed', finishType: 'PRINTED', composition: '100% Polyster' },
      greige: { greigeCode: 'GRG-0050', composition: '100% Cotton' },
    });
    expect(p.code).toBe('540754');
  });

  it('finish not recorded: a name word decides, else dyed — and the reason says so', () => {
    expect(fabric(null, '100% Viscose', { fabricName: 'Viscose - Printed' }).code).toBe('551614');
    const p = fabric(null, '100% Viscose', { fabricName: 'Viscose' });
    expect(p.code).toBe('551612');
    expect(p.reason).toMatch(/finish not recorded — taken as dyed/);
  });

  it('a fabric named embroidered keeps its fabric code, with the 5810 caveat', () => {
    const p = fabric('DYED', '100% Cotton', { fabricName: 'Poplin - Yoke - Embroidery' });
    expect(p.code).toBe('520832');
    expect(p.evidence).toMatch(/5810/);
  });

  it('net by name → 580410 even with no composition; silk dyed → 500720', () => {
    expect(fabric('DYED', null, { fabricName: 'Pink Net - Dyed - Baby Pink' }).code).toBe('580410');
    expect(fabric('DYED', '100% Pure Silk').code).toBe('500720');
  });

  it('blank: no fabric master, no composition anywhere', () => {
    expect(codeOf('FABRIC', null, { name: 'Bubble Crepe - Printed' })).toBeNull();
    const p = fabric('PRINTED', null, { fabricName: 'LNG109B - Viscose Staple - Printed' });
    expect(p.code).toBeNull();
    expect(p.evidence).toMatch(/name says "viscose"/);
  });
});

describe('LACE', () => {
  const lace = (m: MasterFacts, name = '') => propose('LACE', { laceCode: 'LACE-T', laceName: name, ...m }, { name });

  it('plain lace by fibre: cotton → 580429, nylon / polyester → 580421, organza by type → 580421', () => {
    expect(note(lace({ laceType: 'Cotton Lace', composition: '100% Cotton' }).code)).toBe('580429');
    expect(note(lace({ laceType: 'Organza Lace', composition: 'Nylon' }).code)).toBe('580421');
    const organza = lace({ laceType: 'Organza' }, 'LRCMTSHGPKF Navy Organza');
    expect(organza.code).toBe('580421');
    expect(organza.reason).toMatch(/from its type \/ name/);
  });

  it('composition not recorded → man-made default, said so', () => {
    const p = lace({}, 'LACE-0012 | Lace | 0.25" | White');
    expect(p.code).toBe('580421');
    expect(p.reason).toMatch(/taken as man-made/);
  });

  it('schiffli / mirror / sequin lace is embroidery: cotton 581091, polyester 581092, zari 581099', () => {
    expect(note(lace({ laceType: 'Schiffli', composition: '100% Cotton' }).code)).toBe('581091');
    expect(note(lace({ laceType: 'Mirror Lace', composition: '100% Polyster' }).code)).toBe('581092');
    expect(note(lace({ laceType: 'Sequence', composition: 'Zari' }).code)).toBe('581099');
  });

  it('schiffli with no composition → cotton default; sequin with none → man-made default', () => {
    expect(lace({ laceType: 'Schiffli Lace' }).code).toBe('581091');
    expect(lace({}, 'Scalloped Sequin Lace').code).toBe('581092');
  });

  it('gota / zari / fringe → 580890; dori / braid → 580810', () => {
    expect(note(lace({ laceType: 'Gota Lace', composition: '100% Polyster' }).code)).toBe('580890');
    expect(lace({ laceType: 'Silver frinze lace' }).code).toBe('580890');
    expect(note(lace({ laceType: 'Dori Lace', composition: 'Polyester' }).code)).toBe('580810');
  });

  it('greige lace carries the same code, and says so', () => {
    const p = lace({ laceType: 'Cotton Lace', composition: '100% Cotton', isGreige: true });
    expect(p.code).toBe('580429');
    expect(p.evidence).toMatch(/greige \(undyed\)/);
  });

  it('no lace master → blank', () => {
    expect(codeOf('LACE', null)).toBeNull();
  });
});

describe('fasteners', () => {
  it('BUTTON by material: plastic 960621, metal 960622, coconut / shell 960629, covered 960629', () => {
    expect(note(codeOf('BUTTON', { material: 'Plastic' }))).toBe('960621');
    expect(note(codeOf('BUTTON', { material: 'Brass' }))).toBe('960622');
    expect(note(codeOf('BUTTON', { material: 'Coconut' }))).toBe('960629');
    expect(codeOf('BUTTON', { material: 'Shell' })).toBe('960629');
    expect(codeOf('BUTTON', { material: 'Fabric covered' })).toBe('960629');
  });

  it('BUTTON with a material we do not know ("Galaxy") → plastic default, said so', () => {
    const p = propose('BUTTON', { material: 'Galaxy' });
    expect(p.code).toBe('960621');
    expect(p.reason).toMatch(/taken as plastic/);
  });

  it('SNAP_BUTTON → 960610', () => {
    expect(note(codeOf('SNAP_BUTTON', { material: 'Metal' }))).toBe('960610');
  });

  it('ZIPPER: metal teeth 960711, nylon coil 960719, not recorded → 960719 said so', () => {
    expect(note(codeOf('ZIPPER', { teethType: 'METAL' }))).toBe('960711');
    expect(note(codeOf('ZIPPER', { teethType: 'Nylon Coil' }))).toBe('960719');
    expect(propose('ZIPPER', { zipperName: '3D YKK' }).reason).toMatch(/taken as nylon coil/);
  });

  it('HOOK_EYE: metal (default) 830810, plastic 392690', () => {
    expect(note(codeOf('HOOK_EYE', {}))).toBe('830810');
    expect(note(codeOf('HOOK_EYE', { material: 'Plastic' }))).toBe('392690');
  });

  it('BUCKLE: metal 830890, plastic 392690, glass / not recorded → blank', () => {
    expect(note(codeOf('BUCKLE', { material: 'Zinc Alloy' }))).toBe('830890');
    expect(codeOf('BUCKLE', { material: 'Plastic' })).toBe('392690');
    expect(codeOf('BUCKLE', { material: 'Glass' })).toBeNull();
    expect(codeOf('BUCKLE', { buckleName: 'Ring' })).toBeNull();
  });

  it('OTHER_FASTENER: metal stopper 830890, velcro 580632, snap 960610, not recorded → blank', () => {
    expect(codeOf('OTHER_FASTENER', { type: 'Metal', material: 'Metal', otherFastenerName: 'Stopper' })).toBe('830890');
    expect(note(codeOf('OTHER_FASTENER', { otherFastenerName: 'Velcro' }))).toBe('580632');
    expect(codeOf('OTHER_FASTENER', { otherFastenerName: 'Press Snap' })).toBe('960610');
    expect(codeOf('OTHER_FASTENER', { otherFastenerName: 'Ring Adjuster' })).toBeNull();
  });

  it('VELCRO → 580632', () => {
    expect(codeOf('VELCRO', {})).toBe('580632');
  });
});

describe('narrow fabrics and trims', () => {
  it('ELASTIC: woven 580620, type not recorded → woven said so, braided 580810, knitted → blank', () => {
    expect(note(codeOf('ELASTIC', { elasticType: 'Woven' }))).toBe('580620');
    expect(propose('ELASTIC', { elasticName: 'G' }).reason).toMatch(/taken as woven/);
    expect(note(codeOf('ELASTIC', { elasticType: 'Braided' }))).toBe('580810');
    expect(codeOf('ELASTIC', { elasticType: 'Knitted' })).toBeNull();
  });

  it('DRAWSTRING → 580810', () => {
    expect(codeOf('DRAWSTRING', { material: 'Polyester' })).toBe('580810');
  });

  it('RIBBON: velvet 580610, cotton 580631, else man-made 580632', () => {
    expect(note(codeOf('RIBBON', { type: 'Velvet' }))).toBe('580610');
    expect(note(codeOf('RIBBON', { ribbonName: 'Cotton Ribbon' }))).toBe('580631');
    expect(codeOf('RIBBON', { type: 'Satin' })).toBe('580632');
  });

  it('OTHER_TAPE: fusing → blank, braid 580810, elastic 580620, cotton 580631, else 580632', () => {
    expect(codeOf('OTHER_TAPE', { type: 'Fusing Tape' })).toBeNull();
    expect(codeOf('OTHER_TAPE', { type: 'Braid' })).toBe('580810');
    expect(codeOf('OTHER_TAPE', { type: 'Elastic Tape' })).toBe('580620');
    expect(codeOf('OTHER_TAPE', { material: 'Cotton' })).toBe('580631');
    expect(codeOf('OTHER_TAPE', { type: 'Twill Tape' })).toBe('580632');
  });

  it('INTERLINING: non-woven by weight 560311–560314, not recorded → 560312, fusible woven 590390, plain woven → blank', () => {
    const nonWoven = (weight: string | null) => codeOf('INTERLINING', { type: 'Non-Woven', fusible: true, weight });
    expect(note(nonWoven('20gsm'))).toBe('560311');
    expect(note(nonWoven('45gsm'))).toBe('560312');
    expect(note(nonWoven('100 gsm'))).toBe('560313');
    expect(note(nonWoven('180'))).toBe('560314');
    expect(propose('INTERLINING', { type: 'Non-Woven' }).reason).toMatch(/weight not recorded/);
    expect(note(codeOf('INTERLINING', { type: 'Woven', fusible: true }))).toBe('590390');
    expect(codeOf('INTERLINING', { type: 'Woven', fusible: false })).toBeNull();
  });

  it('BEAD: plastic 392690, metal 830890, glass → blank; SEQUIN: plastic by default, metal 830890', () => {
    expect(codeOf('BEAD', { material: 'Plastic' })).toBe('392690');
    expect(codeOf('BEAD', { material: 'Brass' })).toBe('830890');
    expect(codeOf('BEAD', { material: 'Glass' })).toBeNull();
    expect(codeOf('SEQUIN', { finish: 'Matte' })).toBe('392690');
    expect(codeOf('SEQUIN', { finish: 'Metal' })).toBe('830890');
  });

  it('MOTIF: cotton 581091, else man-made 581092', () => {
    expect(codeOf('MOTIF', { type: 'Cotton Flower' })).toBe('581091');
    expect(note(codeOf('MOTIF', { type: 'Applique' }))).toBe('581092');
  });

  it('OTHER_DECORATIVE: tassel 580890, cotton lace 580429, nylon lace 580421, patch 581092, plastic bead 392690, else blank', () => {
    expect(codeOf('OTHER_DECORATIVE', { type: 'Tassel', material: 'Polyester' })).toBe('580890');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Small Flower lace', material: 'Cotton ' })).toBe('580429');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Flower lace', material: 'Nylon' })).toBe('580421');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Patch' })).toBe('581092');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Cotton Patch' })).toBe('581091');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Bead', material: 'Plastic' })).toBe('392690');
    expect(codeOf('OTHER_DECORATIVE', { type: 'Brooch' })).toBeNull();
  });

  it('BELT: PU 392620, textile 621710, leather / not recorded → blank', () => {
    expect(note(codeOf('BELT', { type: 'Braided Belt', material: 'PU Leather' }))).toBe('392620');
    expect(note(codeOf('BELT', { material: 'Fabric' }))).toBe('621710');
    expect(codeOf('BELT', { material: 'Leather' })).toBeNull();
    expect(codeOf('BELT', {})).toBeNull();
  });
});

describe('THREAD', () => {
  it('cotton 520411, polyester spun 550810 (said so), polyester filament 540110, not recorded → blank', () => {
    expect(note(codeOf('THREAD', { materialComposition: 'COTTON' }))).toBe('520411');
    const poly = propose('THREAD', { materialComposition: 'POLYESTER', threadName: 'Poly Thread' });
    expect(note(poly.code)).toBe('550810');
    expect(poly.reason).toMatch(/taken as spun/);
    expect(note(codeOf('THREAD', { materialComposition: 'POLYESTER', threadName: 'Filament Thread' }))).toBe('540110');
    expect(codeOf('THREAD', { materialComposition: null, threadName: 'Default Thread' })).toBeNull();
  });
});

describe('PACKAGING', () => {
  const pkg = (m: MasterFacts) => codeOf('PACKAGING', m);

  it('poly bag → polyethylene 392321 (said so when not recorded); PP bag → 392329', () => {
    expect(note(pkg({ packagingType: 'Poly Bag', thickness: '50' }))).toBe('392321');
    expect(propose('PACKAGING', { packagingType: 'Poly Bag' }).reason).toMatch(/taken as polyethylene/);
    expect(pkg({ packagingType: 'Bag', material: 'LDPE' })).toBe('392321');
    expect(note(pkg({ packagingType: 'Bag', material: 'PP' }))).toBe('392329');
  });

  it('cartons: 5 ply corrugated 481910, mono / folding 481920, bare carton → corrugated, card box 481920, paper bag 481940', () => {
    expect(note(pkg({ packagingType: 'Carton', material: 'Card', thickness: '5 ply' }))).toBe('481910');
    expect(note(pkg({ packagingType: 'Mono Carton' }))).toBe('481920');
    expect(pkg({ packagingType: 'Carton' })).toBe('481910');
    expect(pkg({ packagingType: 'Box', material: 'Card' })).toBe('481920');
    expect(note(pkg({ packagingType: 'Paper Bag' }))).toBe('481940');
  });

  it('plastic box 392310, sticker 482110', () => {
    expect(note(pkg({ packagingType: 'Box', material: 'Plastic' }))).toBe('392310');
    expect(pkg({ packagingType: 'Barcode Sticker' })).toBe('482110');
  });

  it('hangers by material: wire 732620, metal 732690, plastic 392690, not recorded → blank', () => {
    expect(note(pkg({ packagingType: 'Wire Hanger' }))).toBe('732620');
    expect(note(pkg({ packagingType: 'Hanger', material: 'Steel' }))).toBe('732690');
    expect(pkg({ packagingType: 'Hanger', material: 'Plastic' })).toBe('392690');
    expect(pkg({ packagingType: 'Hanger' })).toBeNull();
  });

  it('blank for a person: tissue, tape, silica, textile bag, unknown, no master', () => {
    expect(pkg({ packagingType: 'Tissue Paper' })).toBeNull();
    expect(pkg({ packagingType: 'Packing Tape' })).toBeNull();
    expect(pkg({ packagingType: 'Silica Gel' })).toBeNull();
    expect(pkg({ packagingType: 'Bag', material: 'Non-woven' })).toBeNull();
    expect(pkg({ packagingType: 'Thing' })).toBeNull();
    expect(codeOf('PACKAGING', null)).toBeNull();
  });
});

describe('MACHINE_PART and the rest', () => {
  it('sewing machine part 845290, needle 845230, a boiler part → blank', () => {
    expect(note(codeOf('MACHINE_PART', { partName: 'Bobbin Case' }))).toBe('845290');
    expect(note(codeOf('MACHINE_PART', { partName: 'DBx1 Needle' }))).toBe('845230');
    expect(codeOf('MACHINE_PART', { partName: 'Valve', machine: 'Steam Boiler' })).toBeNull();
  });

  it('PADDING, OTHER, GENERIC, TRIMS say nothing about the goods → blank', () => {
    expect(codeOf('PADDING', { material: 'Foam' })).toBeNull();
    expect(codeOf('OTHER', null)).toBeNull();
    expect(codeOf('GENERIC', null)).toBeNull();
    expect(codeOf('TRIMS', null)).toBeNull();
  });
});

describe('the rule and MATERIAL_HSN_CODES hold each other', () => {
  // Every woven / knitted branch: fibre mix × weave × weight × finish
  const compositions: Array<[string, string]> = [
    ['100% Cotton', 'Fabric'],
    ['60% Cotton 40% Polyester', 'Fabric'],
    ['60% Cotton 40% Flax', 'Fabric'],
    ['100% Linen', 'Fabric'],
    ['60% Linen 40% Cotton', 'Fabric'],
    ['100% Silk', 'Fabric'],
    ['60% Silk 40% Cotton', 'Fabric'],
    ['100% Nylon', 'Fabric'],
    ['100% Polyester', 'Fabric'],
    ['50% Nylon 50% Polyester', 'Fabric'],
    ['60% Polyester 40% Cotton', 'Fabric'],
    ['60% Polyester 40% Viscose', 'Fabric'],
    ['100% Polyester', 'Spun'],
    ['100% Nylon', 'Spun'],
    ['100% Viscose', 'Fabric'],
    ['100% Viscose', 'Georgette'],
    ['60% Viscose 40% Cotton', 'Georgette'],
    ['60% Viscose 40% Nylon', 'Fabric'],
    ['60% Viscose 40% Wool', 'Fabric'],
    ['60% Viscose 40% Cotton', 'Fabric'],
    ['60% Viscose 40% Polyester', 'Fabric'],
    ['100% Cotton', 'Jersey'],
    ['100% Polyester', 'Jersey'],
    ['100% Viscose', 'Jersey'],
    ['100% Silk', 'Jersey'],
  ];
  const weaves = ['Poplin', 'Twill', 'Denim', 'Dobby'];
  const weights = [80, 150, 250];
  const finishes = ['RAW', 'DYED', 'YARN_DYED', 'PRINTED'];

  for (const [composition, kind] of compositions) {
    for (const weave of weaves) {
      for (const gsm of weights) {
        for (const finishType of finishes) {
          note(fabric(finishType, composition, { fabricName: `${kind} ${weave}`, actualGSM: gsm }).code);
        }
      }
    }
  }

  it('every code the rule gives is in MATERIAL_HSN_CODES (so --seed-codes adds it)', () => {
    const listed = new Set(MATERIAL_HSN_CODES.map((c) => c.code));
    const unlisted = Array.from(seen).filter((c) => !listed.has(c));
    expect(unlisted).toEqual([]);
  });

  it('every code in MATERIAL_HSN_CODES is one the rule can give', () => {
    const unreached = MATERIAL_HSN_CODES.map((c) => c.code).filter((c) => !seen.has(c));
    expect(unreached).toEqual([]);
  });

  it('every proposal is 6 digits', () => {
    for (const code of seen) expect(isMaterialHsn(code)).toBe(true);
  });
});
