/**
 * The Purchase Orders page's material categories are ONE list on both sides.
 *
 * The page's Material tab, category filter and PO-form picker read the frontend copy
 * (frontend/src/types/purchaseOrder.types.ts); the stat cards and Total Value read the backend copy
 * through /stats. THREAD was added to the frontend on 2026-09-26 and not to the backend, so a thread
 * PO would have been listed but never counted (PO list bug hunt #9, 2026-09-27).
 */

import fs from 'fs';
import path from 'path';
import { CREATABLE_PO_CATEGORIES, MATERIAL_PO_CATEGORIES } from '../../types/purchaseOrder.types';
import { ManualPOCategoryEnum } from '../../schemas/purchaseOrder.schema';

const FRONTEND_TYPES = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'types',
  'purchaseOrder.types.ts'
);

function frontendMaterialCategories(): string[] {
  const src = fs.readFileSync(FRONTEND_TYPES, 'utf8');
  const block = src.match(/export const MATERIAL_PO_CATEGORIES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) throw new Error('frontend purchaseOrder.types.ts has no `MATERIAL_PO_CATEGORIES = [...] as const`');
  return [...block[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
}

describe('PO material categories', () => {
  it('are the same list on the frontend and the backend', () => {
    expect([...MATERIAL_PO_CATEGORIES].sort()).toEqual(frontendMaterialCategories().sort());
  });

  it('include THREAD, so a thread PO is counted on the stat cards', () => {
    expect(MATERIAL_PO_CATEGORIES).toContain('THREAD');
  });

  it('can all be created — every category the page shows is one a PO may be made with', () => {
    for (const category of MATERIAL_PO_CATEGORIES) {
      expect(CREATABLE_PO_CATEGORIES).toContain(category);
      expect(ManualPOCategoryEnum.safeParse(category).success).toBe(true);
    }
  });

  it('never let a PO be created for service or processing work (that is a Job Work Order)', () => {
    for (const retired of ['PROCESSING', 'LACE_PROCESSING', 'EMBROIDERY_SERVICE', 'WASHING_SERVICE']) {
      expect(ManualPOCategoryEnum.safeParse(retired).success).toBe(false);
    }
  });
});
