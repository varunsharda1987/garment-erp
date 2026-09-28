/**
 * Which materials a PO category takes (po-line-category.helper) — mocked prisma, no DB.
 *
 * A line on the wrong category was received and booked NOTHING: greige, fabric, lace and thread POs book
 * their lots in their own GRN branch and skip a line that is not theirs; a greige with no greige master
 * books nothing anywhere (PO form bug hunt #4, 2026-09-28). The server now refuses such a line on every
 * PO writer, and the form's material list follows the same rule.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    materials: { findMany: jest.fn() },
  },
}));

import { MaterialType } from '@prisma/client';
import prisma from '../../config/database';
import {
  allowedPoCategories,
  assertPoLinesFitCategory,
  fitsPoCategory,
  wrongCategoryMessage,
  type PoLineMaterialFacts,
} from '../../services/helpers/po-line-category.helper';
import { MATERIAL_PO_CATEGORIES } from '../../types/purchaseOrder.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** A material of this type with every master it could have (a greige master, a fabric master, finished lace) */
const linked = (materialType: string, over: Partial<PoLineMaterialFacts> = {}): PoLineMaterialFacts => ({
  materialType,
  hasGreigeMaster: materialType === 'GREIGE',
  hasFabricMaster: materialType === 'FABRIC',
  laceIsGreige: materialType === 'LACE' ? false : null,
  ...over,
});

/** The contract, written out: what each page category takes */
const OWN_LOT = ['GREIGE', 'FABRIC', 'LACE', 'THREAD'];
/** The Style Form's Accessories tab: labels + packaging */
const ACCESSORIES = ['LABEL', 'PACKAGING'];
const TAKES: Record<string, (type: string) => boolean> = {
  FABRIC: (t) => t === 'FABRIC',
  GREIGE: (t) => t === 'GREIGE',
  TRIMS: (t) => !OWN_LOT.includes(t) && !ACCESSORIES.includes(t) && t !== 'MACHINE_PART',
  ACCESSORIES: (t) => ACCESSORIES.includes(t),
  THREAD: (t) => t === 'THREAD',
  LACE: (t) => t === 'LACE', // finished lace (linked() makes lace finished)
  GREIGE_LACE: () => false, // no finished lace ever goes on it
  MACHINE_PART: (t) => t === 'MACHINE_PART',
  GENERAL: (t) => !OWN_LOT.includes(t),
};

describe('PO line category rule', () => {
  it('covers every page category', () => {
    expect(Object.keys(TAKES).sort()).toEqual([...MATERIAL_PO_CATEGORIES].sort());
  });

  it.each(Object.values(MaterialType))('%s goes on exactly the categories the contract says', (type) => {
    for (const category of MATERIAL_PO_CATEGORIES) {
      expect({ category, fits: fitsPoCategory(category, linked(type)) }).toEqual({
        category,
        fits: TAKES[category](type),
      });
    }
  });

  it('puts labels and packaging on Accessories, never Trims — as the Style Form does', () => {
    expect(fitsPoCategory('ACCESSORIES', linked('LABEL'))).toBe(true);
    expect(fitsPoCategory('ACCESSORIES', linked('PACKAGING'))).toBe(true);
    expect(fitsPoCategory('TRIMS', linked('LABEL'))).toBe(false);
    expect(fitsPoCategory('TRIMS', linked('PACKAGING'))).toBe(false);
    expect(fitsPoCategory('ACCESSORIES', linked('BUTTON'))).toBe(false);
    // The API-only categories keep their one type
    expect(fitsPoCategory('PACKAGING', linked('PACKAGING'))).toBe(true);
    expect(fitsPoCategory('PACKAGING', linked('LABEL'))).toBe(false);
    expect(fitsPoCategory('LABEL', linked('LABEL'))).toBe(true);
  });

  it('MRP files a label or a packaging on Accessories — the first category it may go on', () => {
    expect(allowedPoCategories(linked('LABEL'))[0]).toBe('ACCESSORIES');
    expect(allowedPoCategories(linked('PACKAGING'))[0]).toBe('ACCESSORIES');
    expect(allowedPoCategories(linked('BUTTON'))[0]).toBe('TRIMS');
    expect(allowedPoCategories(linked('MACHINE_PART'))[0]).toBe('MACHINE_PART');
  });

  it('greige lace goes on Greige Lace only; finished lace on Lace only', () => {
    const greigeLace = linked('LACE', { laceIsGreige: true });
    expect(allowedPoCategories(greigeLace)).toEqual(['GREIGE_LACE']);
    expect(allowedPoCategories(linked('LACE'))).toEqual(['LACE']);
  });

  it('a greige, fabric or lace with no master fits no category at all — its receipt would book no stock', () => {
    expect(allowedPoCategories(linked('GREIGE', { hasGreigeMaster: false }))).toEqual([]);
    expect(allowedPoCategories(linked('FABRIC', { hasFabricMaster: false }))).toEqual([]);
    expect(allowedPoCategories(linked('LACE', { laceIsGreige: null }))).toEqual([]);
  });

  it('lists the page categories first, in the page order', () => {
    expect(allowedPoCategories(linked('BUTTON')).slice(0, 2)).toEqual(['TRIMS', 'GENERAL']);
    expect(allowedPoCategories(linked('PACKAGING')).slice(0, 3)).toEqual(['ACCESSORIES', 'GENERAL', 'PACKAGING']);
  });

  it('does not check a PO with no category, or a retired processing / service one', () => {
    expect(fitsPoCategory(null, linked('BUTTON'))).toBe(true);
    expect(fitsPoCategory('PROCESSING', linked('BUTTON'))).toBe(true);
    expect(fitsPoCategory('EMBROIDERY_SERVICE', linked('GREIGE'))).toBe(true);
  });

  it('says what the material is and where it goes', () => {
    const button = { code: 'BTN-0003', name: 'Shell Button', ...linked('BUTTON') };
    expect(wrongCategoryMessage('LACE', button)).toBe(
      'BTN-0003 Shell Button is a button — it goes on a Trims, General PO, not a Lace PO.'
    );
    expect(wrongCategoryMessage('TRIMS', button)).toBeNull();
    expect(wrongCategoryMessage('ACCESSORIES', button)).toBe(
      'BTN-0003 Shell Button is a button — it goes on a Trims, General PO, not an Accessories PO.'
    );

    const label = { code: 'LBL-0001', name: 'Main Label', ...linked('LABEL') };
    expect(wrongCategoryMessage('TRIMS', label)).toBe(
      'LBL-0001 Main Label is a label — it goes on an Accessories, General PO, not a Trims PO.'
    );

    const orphan = { code: 'GRG-0002', name: 'Loose Greige', ...linked('GREIGE', { hasGreigeMaster: false }) };
    expect(wrongCategoryMessage('GREIGE', orphan)).toMatch(/GRG-0002 Loose Greige is a greige with no greige master/);
  });
});

describe('assertPoLinesFitCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses a wrong line with 422 PO_LINE_WRONG_CATEGORY, reading the materials in one query', async () => {
    db.materials.findMany.mockResolvedValue([
      {
        id: 'm-btn',
        code: 'BTN-0003',
        name: 'Shell Button',
        materialType: 'BUTTON',
        greigeId: null,
        fabricId: null,
        lace_master: null,
      },
      {
        id: 'm-lace',
        code: 'LACE-0001',
        name: 'Cotton Lace',
        materialType: 'LACE',
        greigeId: null,
        fabricId: null,
        lace_master: { isGreige: false },
      },
    ]);

    const refusal = assertPoLinesFitCategory('LACE', [
      { materialId: 'm-lace' },
      { materialId: 'm-btn' },
      { materialId: null }, // a service line — not checked
    ]);
    await expect(refusal).rejects.toMatchObject({
      statusCode: 422,
      message: 'BTN-0003 Shell Button is a button — it goes on a Trims, General PO, not a Lace PO.',
      details: { code: 'PO_LINE_WRONG_CATEGORY', materialIds: ['m-btn'] },
    });
    expect(db.materials.findMany).toHaveBeenCalledTimes(1);
  });

  it('lets lines that fit through, and skips the query for an unchecked category', async () => {
    db.materials.findMany.mockResolvedValue([
      {
        id: 'm-lace',
        code: 'LACE-0001',
        name: 'Cotton Lace',
        materialType: 'LACE',
        greigeId: null,
        fabricId: null,
        lace_master: { isGreige: false },
      },
    ]);
    await expect(assertPoLinesFitCategory('LACE', [{ materialId: 'm-lace' }])).resolves.toBeUndefined();

    db.materials.findMany.mockClear();
    await expect(assertPoLinesFitCategory(null, [{ materialId: 'm-lace' }])).resolves.toBeUndefined();
    expect(db.materials.findMany).not.toHaveBeenCalled();
  });
});
