import { describe, it, expect } from 'vitest';
import { groupRequirementsByOrderStyle } from '../order-style-groups';
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
