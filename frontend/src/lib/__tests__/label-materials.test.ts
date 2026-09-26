import { describe, it, expect } from 'vitest';
import {
  indexSizedLabels,
  labelDisplay,
  labelPieces,
  mergeLabelQuantities,
  type LabelMaterialRow,
} from '../label-materials';

const row = (id: string, size: string | null, labelId = 'LBL'): LabelMaterialRow => ({
  id,
  code: size ? `LBL-0004-${size}` : 'LBL-0004',
  name: size ? `Main Cum Size Label - Size ${size}` : 'Main Cum Size Label',
  labelId,
  sizeVariantId: size ? `v-${size}` : null,
  labelSizeVariant: size ? { size } : null,
});

describe('indexSizedLabels', () => {
  it('offers a sized label once (its base row) and keeps its sizes in size order', () => {
    const materials = [row('m', 'M'), row('LBL', null), row('xs', 'XS'), { id: 'btn', code: 'BTN-1', name: 'Button' }];
    const { pickerMaterials, sizeRowsByLabel } = indexSizedLabels(materials);
    expect(pickerMaterials.map((m) => m.id)).toEqual(['LBL', 'btn']);
    expect(sizeRowsByLabel.get('LBL')!.map((m) => m.id)).toEqual(['xs', 'm']);
  });
});

describe('labelDisplay', () => {
  it("strips a size row's size from its code and name", () => {
    expect(labelDisplay(row('xs', 'XS'))).toEqual({ code: 'LBL-0004', name: 'Main Cum Size Label' });
    expect(labelDisplay({ ...row('xs', 'XS'), name: 'Main Cum Size Label (XS)' }).name).toBe('Main Cum Size Label');
  });
});

describe('mergeLabelQuantities', () => {
  type Line = { materialId?: string; qty: number };
  const update = (l: Line, qty: number) => ({ ...l, qty });
  const create = (r: { id: string }, qty: number) => ({ materialId: r.id, qty });
  const rows = [{ id: 'xs' }, { id: 's' }, { id: 'm' }];

  it('updates in place, drops a size set to 0, and inserts a new size after the label’s last line', () => {
    const lines: Line[] = [
      { materialId: 'btn', qty: 1 },
      { materialId: 'xs', qty: 5 },
      { materialId: 'm', qty: 5 },
      { materialId: 'zip', qty: 2 },
    ];
    const out = mergeLabelQuantities(lines, rows, { xs: 10, s: 20, m: 0 }, update, create);
    expect(out).toEqual([
      { materialId: 'btn', qty: 1 },
      { materialId: 'xs', qty: 10 },
      { materialId: 's', qty: 20 },
      { materialId: 'zip', qty: 2 },
    ]);
  });

  it('never leaves one size on two lines, and appends when the label is not on the list yet', () => {
    const dup = mergeLabelQuantities(
      [
        { materialId: 'xs', qty: 1 },
        { materialId: 'xs', qty: 2 },
      ],
      rows,
      { xs: 3 },
      update,
      create
    );
    expect(dup).toEqual([{ materialId: 'xs', qty: 3 }]);
    const fresh = mergeLabelQuantities([{ materialId: 'btn', qty: 1 }], rows, { s: 4, xs: 2 }, update, create);
    expect(fresh).toEqual([
      { materialId: 'btn', qty: 1 },
      { materialId: 'xs', qty: 2 },
      { materialId: 's', qty: 4 },
    ]);
  });
});

describe('labelPieces', () => {
  it('is garments × per garment + extra %, rounded up to whole pieces', () => {
    expect(labelPieces(322, 1, 0)).toBe(322);
    expect(labelPieces(322, 1, 5)).toBe(339); // 338.1 → 339
    expect(labelPieces(100, 1.05, 0)).toBe(105); // float dust 105.00000000000001 is 105, not 106
    expect(labelPieces(0, 1, 5)).toBe(0);
  });
});
