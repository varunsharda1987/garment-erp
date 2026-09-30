import { describe, it, expect } from 'vitest';
import { groupRequirementsByOrderStyle, mergedRowNote, requirementPart, requirementTags } from '../order-style-groups';
import type { MaterialRequirement } from '@/types/mrp.types';

const MAIN = { id: 'lbl-main', code: 'LBL-0004', name: 'Main Cum Size Label', type: 'MAIN', category: null };
const WASH = { id: 'lbl-wash', code: 'LBL-0006', name: 'Washcare', type: 'CARE', category: null };

let n = 0;
function req(p: {
  order?: string;
  style?: string;
  materialId: string;
  label?: typeof MAIN | null;
  size?: string | null;
  qty?: number;
  shortfall?: number;
  status?: MaterialRequirement['status'];
  requiredDate?: string | null;
  splitFromId?: string | null;
}): MaterialRequirement {
  n += 1;
  return {
    id: `r${n}`,
    requirementNumber: `MR-${String(n).padStart(3, '0')}`,
    orderId: p.order ?? 'o1',
    materialId: p.materialId,
    totalRequired: p.qty ?? 10,
    shortfall: p.shortfall ?? p.qty ?? 10,
    unit: 'PIECE',
    status: p.status ?? 'PO_REQUIRED',
    label: p.label ?? null,
    size: p.size ?? null,
    requiredDate: p.requiredDate ?? null,
    splitFromId: p.splitFromId ?? null,
    order: { id: p.order ?? 'o1', orderNumber: `ORD-${p.order ?? 'o1'}`, customerId: 'c1', customerName: 'Easybuy' },
    orderItem: { id: 'oi', styleId: p.style ?? 's1', styleCode: `ST-${p.style ?? 's1'}`, totalQuantity: 100 },
  } as unknown as MaterialRequirement;
}

describe('groupRequirementsByOrderStyle', () => {
  it('splits by order + style, merges a size across colours, and groups a label with its sizes in size order', () => {
    const rows = [
      req({ materialId: 'thread', qty: 1 }),
      req({ materialId: 'main-M', label: MAIN, size: 'M', qty: 30 }),
      req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 10 }),
      // second colour of XS — same material, one size row
      req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 5, shortfall: 2 }),
      req({ materialId: 'wash', label: WASH, size: null, qty: 45 }),
      req({ style: 's2', materialId: 'main-S', label: MAIN, size: 'S', qty: 7 }),
      req({ order: 'o2', materialId: 'main-XS', label: MAIN, size: 'XS', qty: 3 }),
    ];
    const groups = groupRequirementsByOrderStyle(rows);
    expect(groups.map((g) => g.key)).toEqual(['o1|s1', 'o1|s2', 'o2|s1']);

    const [first] = groups;
    expect(first.requirements).toHaveLength(5);
    expect(first.orderNumber).toBe('ORD-o1');
    expect(first.styleCode).toBe('ST-s1');
    // thread single, MAIN grouped (sized), Washcare single (one unsized line)
    expect(first.lines.map((l) => l.kind)).toEqual(['single', 'label', 'single']);

    const main = first.lines[1];
    if (main.kind !== 'label') throw new Error('expected a label group');
    expect(main.code).toBe('LBL-0004');
    expect(main.rows.map((r) => r.size)).toEqual(['XS', 'M']);
    const xs = main.rows[0].line;
    expect(xs.requirements.map((r) => r.id)).toHaveLength(2);
    expect(xs.totalRequired).toBe(15);
    expect(xs.shortfall).toBe(12);
    expect(main.rows[1].line.totalRequired).toBe(30);
  });

  it('keeps a SIZE_PENDING base row first within its label', () => {
    const rows = [
      req({ materialId: 'main-S', label: MAIN, size: 'S' }),
      req({ materialId: 'lbl-main', label: MAIN, size: null, status: 'SIZE_PENDING' }),
    ];
    const [g] = groupRequirementsByOrderStyle(rows);
    const main = g.lines[0];
    if (main.kind !== 'label') throw new Error('expected a label group');
    expect(main.rows.map((r) => r.size)).toEqual([null, 'S']);
    expect(main.rows[0].line.head.status).toBe('SIZE_PENDING');
  });

  it('puts the soonest-needed set first, then by order number; a set with no date goes last', () => {
    const rows = [
      req({ order: 'o3', materialId: 'a', requiredDate: null }),
      req({ order: 'o2', materialId: 'b', requiredDate: '2026-10-20T00:00:00.000Z' }),
      req({ order: 'o1', materialId: 'c', requiredDate: '2026-10-20T00:00:00.000Z' }),
      req({ order: 'o4', materialId: 'd', requiredDate: '2026-11-01T00:00:00.000Z' }),
      // o4's earliest date is the one that counts
      req({ order: 'o4', materialId: 'e', requiredDate: '2026-10-07T00:00:00.000Z' }),
    ];
    const groups = groupRequirementsByOrderStyle(rows);
    expect(groups.map((g) => g.orderNumber)).toEqual(['ORD-o4', 'ORD-o1', 'ORD-o2', 'ORD-o3']);
    expect(groups[0].earliestRequiredDate).toBe('2026-10-07T00:00:00.000Z');
    expect(groups[3].earliestRequiredDate).toBeNull();
  });

  it('counts a split balance row once: its quantity is already in its parent (M10)', () => {
    // MR-A needed 100; a PO took 60 and the 40 left became balance MR-B, of which another PO took 30 → MR-C 10
    const parent = req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 100, shortfall: 60, status: 'PO_SENT' });
    const child = req({
      materialId: 'main-XS',
      label: MAIN,
      size: 'XS',
      qty: 40,
      shortfall: 30,
      splitFromId: parent.id,
    });
    const grandchild = req({
      materialId: 'main-XS',
      label: MAIN,
      size: 'XS',
      qty: 10,
      shortfall: 10,
      splitFromId: child.id,
    });
    // a second colour of XS is its own requirement and still adds
    const other = req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 5, shortfall: 5 });
    const [g] = groupRequirementsByOrderStyle([grandchild, parent, child, other]);
    const main = g.lines[0];
    if (main.kind !== 'label') throw new Error('expected a label group');
    expect(main.rows[0].line.totalRequired).toBe(105);
    expect(main.rows[0].line.shortfall).toBe(105);

    // With the parent filtered out (on a PO, not "Needs action"), the balance row is what is shown
    const [shown] = groupRequirementsByOrderStyle([child, grandchild]);
    const shownMain = shown.lines[0];
    if (shownMain.kind !== 'label') throw new Error('expected a label group');
    expect(shownMain.rows[0].line.totalRequired).toBe(40);
  });

  it('names each merged requirement by what differs: the part for fabric, the colour for label sizes (SP27CK130)', () => {
    const kurta = req({ materialId: 'grg-0038', qty: 1300 });
    const combined = req({ materialId: 'grg-0038', qty: 6952.174 });
    Object.assign(kurta, {
      colorName: 'Teal',
      componentName: 'Kurta - GRG-0038 - Viscose Slub 30×30 / 68×64 / 63" (Super Dyeing)',
    });
    Object.assign(combined, { colorName: 'Teal', componentName: 'Kurta - Combined: Kurta, Pallazo' });
    const tags = requirementTags([kurta, combined]);
    expect(tags.get(kurta.id)).toBe('Kurta');
    expect(tags.get(combined.id)).toBe('Kurta + Pallazo');
    // one colour, so the note must not say "2 colours"
    expect(mergedRowNote([kurta, combined])).toBe('2 requirements');

    const black = req({ materialId: 'wash-M', label: WASH, size: 'M' });
    const white = req({ materialId: 'wash-M', label: WASH, size: 'M' });
    Object.assign(black, { colorName: 'Black', componentName: 'Washcare Label Black (M)' });
    Object.assign(white, { colorName: 'White', componentName: 'Washcare Label Black (M)' });
    const labelTags = requirementTags([black, white]);
    expect(labelTags.get(black.id)).toBe('Black');
    expect(labelTags.get(white.id)).toBe('White');
    expect(mergedRowNote([black, white])).toBe('2 colours');

    // nothing tells them apart → the requirement number; a single requirement needs no name at all
    const a = req({ materialId: 'x' });
    const b = req({ materialId: 'x' });
    expect(requirementTags([a, b]).get(a.id)).toBe(a.requirementNumber);
    expect(requirementTags([a]).size).toBe(0);
    expect(mergedRowNote([a])).toBeNull();
  });

  it('reads the part from every componentName shape MRP stores', () => {
    expect(requirementPart('Shirt - Viscose Staple')).toBe('Shirt');
    expect(requirementPart('Kurta - Combined: Kurta, Pallazo')).toBe('Kurta + Pallazo');
    expect(
      requirementPart(
        'Kurta - GRG-0038 - Viscose Slub 30×30 / 68×64 / 63" (Super Dyeing), Kurta - Combined: Kurta, Pallazo'
      )
    ).toBe('Kurta, Kurta + Pallazo');
    expect(requirementPart('Price Tag (XS)')).toBe('Price Tag (XS)');
    expect(requirementPart(null)).toBeNull();
  });

  it('rounds merged quantities to 3 decimals', () => {
    const rows = [
      req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 0.1, shortfall: 0.1 }),
      req({ materialId: 'main-XS', label: MAIN, size: 'XS', qty: 0.2, shortfall: 0.2 }),
    ];
    const [g] = groupRequirementsByOrderStyle(rows);
    const main = g.lines[0];
    if (main.kind !== 'label') throw new Error('expected a label group');
    expect(main.rows[0].line.totalRequired).toBe(0.3);
  });
});
