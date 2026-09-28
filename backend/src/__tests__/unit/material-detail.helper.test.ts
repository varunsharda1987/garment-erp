/**
 * What tells one material from another in a picker (material-detail.helper) — mocked prisma, no DB.
 *
 * The PO form's Quick Add listed 91 labels as "LBL-0016 - Main Label", "LBL-0009 - Main Label", … with
 * nothing to say whose each was (2026-09-28). GET /api/materials items now carry `buyerBrand` (customer ·
 * brand) and `spec` (the type master's own facts), read in one query per material type on the page.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    label_master: { findMany: jest.fn() },
    packaging_master: { findMany: jest.fn() },
    button_master: { findMany: jest.fn() },
    zipper_master: { findMany: jest.fn() },
    elastic_master: { findMany: jest.fn() },
    lace_master: { findMany: jest.fn() },
    interlining_master: { findMany: jest.fn() },
    greige_master: { findMany: jest.fn() },
    fabric_master: { findMany: jest.fn() },
    thread_master: { findMany: jest.fn() },
  },
}));

import prisma from '../../config/database';
import {
  attachMaterialDetails,
  joinFacts,
  loadMaterialBuyers,
  MATERIAL_DETAIL_SELECT,
  materialDetailLine,
} from '../../services/helpers/material-detail.helper';
import { MASTER_CONFIG } from '../../services/helpers/master-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const KASYA = { name: 'House Of Kasya Pvt Ltd' };
const NIHSAMAH = { brandName: 'Nihsamah', category: 'Sleepwear', customer: KASYA };

describe('joinFacts', () => {
  it('joins with " · ", skipping blanks, repeats and a fact that is only the name', () => {
    expect(joinFacts(['Sewn-in', null, '  ', 'Main Label', 'Black ', 'black'], 'Main Label')).toBe('Sewn-in · Black');
    expect(joinFacts([null, undefined, ''])).toBeNull();
  });
});

describe('attachMaterialDetails', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads each type once for the page — a label size row reads its base label', async () => {
    db.label_master.findMany.mockResolvedValue([
      {
        id: 'lbl-1',
        labelName: 'Main Label',
        labelCategory: 'SEWN_IN',
        labelType: 'Main Label',
        material: 'Satin',
        color: 'Black',
        size: null,
        customer: KASYA,
        brandCategory: NIHSAMAH,
      },
      {
        id: 'lbl-2',
        labelName: 'coord tag',
        labelCategory: 'HANGTAG',
        labelType: null,
        material: 'Card',
        color: 'White',
        size: '1*3',
        customer: null,
        brandCategory: null,
      },
    ]);
    db.button_master.findMany.mockResolvedValue([
      { id: 'btn-1', buttonName: 'Galaxy Button', size: '16L', holes: 4, material: 'Galaxy', color: null },
    ]);

    const out = await attachMaterialDetails([
      { id: 'lbl-1', code: 'LBL-0016', materialType: 'LABEL', labelId: 'lbl-1' },
      { id: 'lbl-1-xs', code: 'LBL-0016-XS', materialType: 'LABEL', labelId: 'lbl-1' }, // its XS size row
      { id: 'lbl-2', code: 'LBL-0029', materialType: 'LABEL', labelId: 'lbl-2' },
      { id: 'btn-1', code: 'BTN-0001', materialType: 'BUTTON', buttonId: 'btn-1' },
    ]);

    expect(db.label_master.findMany).toHaveBeenCalledTimes(1);
    expect(db.label_master.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['lbl-1', 'lbl-2'] } });
    expect(db.button_master.findMany).toHaveBeenCalledTimes(1);

    expect(out.map((m) => [m.code, m.buyerBrand, m.spec])).toEqual([
      ['LBL-0016', 'House Of Kasya Pvt Ltd · Nihsamah - Sleepwear', 'Sewn-in · Satin · Black'],
      ['LBL-0016-XS', 'House Of Kasya Pvt Ltd · Nihsamah - Sleepwear', 'Sewn-in · Satin · Black'],
      ['LBL-0029', null, 'Hangtag · Card · White · 1*3'],
      ['BTN-0001', null, '16L · 4 holes · Galaxy'],
    ]);
  });

  it('names the brand’s own customer when the master has a brand but no customer', async () => {
    db.packaging_master.findMany.mockResolvedValue([
      {
        id: 'pkg-1',
        packagingName: 'Poly Bag',
        packagingType: 'Poly Bag',
        size: '12X16',
        material: null,
        thickness: '50',
        customer: null,
        brandCategory: { brandName: 'Kasya', category: 'Ethnic Wear', customer: KASYA },
      },
    ]);
    const [pkg] = await attachMaterialDetails([{ materialType: 'PACKAGING', packagingId: 'pkg-1' }]);
    expect(pkg.buyerBrand).toBe('House Of Kasya Pvt Ltd · Kasya - Ethnic Wear');
    expect(pkg.spec).toBe('12X16 · 50');
  });

  it('writes widths and lengths with their units, GSM after a bare number', async () => {
    db.zipper_master.findMany.mockResolvedValue([
      { id: 'zip-1', zipperName: 'YKK', teethType: 'Metal', length: 12, color: 'Black' },
    ]);
    db.elastic_master.findMany.mockResolvedValue([
      { id: 'ela-1', elasticName: 'Elastic', width: 38.1, composition: null, color: 'Black' },
    ]);
    db.lace_master.findMany.mockResolvedValue([
      { id: 'lace-1', laceName: 'Schiffli', width: 1, composition: '100% Cotton', color: 'Red' },
    ]);
    db.interlining_master.findMany.mockResolvedValue([
      { id: 'int-1', interliningName: 'Fusing', width: '44"', type: 'Non-woven', color: 'White' },
    ]);
    db.greige_master.findMany.mockResolvedValue([
      { id: 'grg-1', greigeName: 'Poplin', composition: '100% Cotton', greigeWidth: 48, gsmRange: '' },
    ]);
    db.fabric_master.findMany.mockResolvedValue([
      { id: 'fab-1', fabricName: 'French Crepe', composition: '100% Polyester', actualWidth: 54, actualGSM: 70 },
    ]);

    const out = await attachMaterialDetails([
      { materialType: 'ZIPPER', zipperId: 'zip-1' },
      { materialType: 'ELASTIC', elasticId: 'ela-1' },
      { materialType: 'LACE', laceId: 'lace-1' },
      { materialType: 'INTERLINING', interliningId: 'int-1' },
      { materialType: 'GREIGE', greigeId: 'grg-1' },
      { materialType: 'FABRIC', fabricId: 'fab-1' },
    ]);
    expect(out.map((m) => m.spec)).toEqual([
      'Metal · 12" · Black',
      '38.1 mm · Black',
      '1" · 100% Cotton · Red',
      '44" · Non-woven · White',
      '100% Cotton · 48"',
      '100% Polyester · 54" · 70 GSM',
    ]);
  });

  it('gives a thread pack row its own ply', async () => {
    db.thread_master.findMany.mockResolvedValue([
      { id: 'thr-1', threadName: 'Poly Thread', materialComposition: 'POLYESTER', ply: 'TWO_PLY', color: 'White' },
    ]);
    const out = await attachMaterialDetails([
      { materialType: 'THREAD', threadId: 'thr-1', threadPly: null },
      { materialType: 'THREAD', threadId: 'thr-1', threadPly: 'THREE_PLY' },
    ]);
    expect(out.map((m) => m.spec)).toEqual(['Polyester · 2-ply · White', 'Polyester · 3-ply · White']);
    expect(db.thread_master.findMany).toHaveBeenCalledTimes(1);
  });

  it('leaves nulls, and asks nothing, for a row with no master or a type it does not describe', async () => {
    const out = await attachMaterialDetails([
      { materialType: 'LABEL', labelId: null },
      { materialType: 'HOOK_EYE', hookEyeId: 'hk-1' },
      { materialType: null },
    ]);
    expect(out.every((m) => m.buyerBrand === null && m.spec === null)).toBe(true);
    expect(db.label_master.findMany).not.toHaveBeenCalled();
  });
});

describe('what a PO / GRN line reads it through', () => {
  it('MATERIAL_DETAIL_SELECT carries the FK of every master type described above', () => {
    for (const type of [
      'LABEL',
      'PACKAGING',
      'BUTTON',
      'ZIPPER',
      'ELASTIC',
      'LACE',
      'INTERLINING',
      'GREIGE',
      'FABRIC',
      'THREAD',
    ]) {
      expect(MATERIAL_DETAIL_SELECT).toHaveProperty(MASTER_CONFIG[type].fkField, true);
    }
    expect(MATERIAL_DETAIL_SELECT).toMatchObject({ materialType: true, threadPly: true });
  });

  it('loadMaterialBuyers: the customer behind buyerBrand (else the brand’s), reading only labels and packaging', async () => {
    jest.clearAllMocks();
    const EASYBUY = { id: 'cust-e', name: 'Easybuy' };
    db.label_master.findMany.mockResolvedValue([
      {
        id: 'lbl-4',
        labelName: 'Main Cum Size Label Black',
        labelCategory: 'SEWN_IN',
        labelType: 'Main Cum Size Label',
        material: null,
        color: 'Black',
        size: null,
        customer: null,
        brandCategory: { brandName: 'Easybuy', category: 'Western Wear', customer: EASYBUY },
      },
    ]);
    const out = await loadMaterialBuyers([
      { materialType: 'LABEL', labelId: 'lbl-4' },
      { materialType: 'BUTTON', buttonId: 'btn-1' },
    ]);
    expect(out).toEqual([EASYBUY, null]);
    expect(db.button_master.findMany).not.toHaveBeenCalled();
  });

  it('materialDetailLine joins buyerBrand and spec, null when neither', () => {
    expect(materialDetailLine({ buyerBrand: 'Easybuy · Easybuy - Western Wear', spec: 'Sewn-in · Black' })).toBe(
      'Easybuy · Easybuy - Western Wear · Sewn-in · Black'
    );
    expect(materialDetailLine({ buyerBrand: null, spec: '16L · 4 holes' })).toBe('16L · 4 holes');
    expect(materialDetailLine({ buyerBrand: null, spec: null })).toBeNull();
    expect(materialDetailLine(undefined)).toBeNull();
  });
});
