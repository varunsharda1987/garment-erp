import { describe, it, expect } from 'vitest';
import { flattenGroups, groupLabelLines, sumRows, type LabelLineKey } from '../label-lines';

interface Line {
  id: string;
  qty: number;
  label?: LabelLineKey;
}
const L = (labelId: string, size: string | null): LabelLineKey => ({ labelId, code: labelId, name: labelId, size });
const labelOf = (l: Line) => l.label ?? null;

describe('groupLabelLines', () => {
  it("gathers a label's sizes under one heading, base row first, then size order", () => {
    const lines: Line[] = [
      { id: 'thread', qty: 1 },
      { id: 'L', qty: 3, label: L('MAIN', 'L') },
      { id: 'XS', qty: 1, label: L('MAIN', 'XS') },
      { id: 'pending', qty: 9, label: L('MAIN', null) },
      { id: 'S', qty: 2, label: L('MAIN', 'S') },
    ];
    const groups = groupLabelLines(lines, labelOf);
    expect(groups).toHaveLength(2);
    const main = groups[1];
    expect(main.kind).toBe('label');
    if (main.kind === 'label') {
      expect(main.rows.map((r) => r.line.id)).toEqual(['pending', 'XS', 'S', 'L']);
      expect(main.rows.map((r) => r.index)).toEqual([3, 2, 4, 1]);
      expect(sumRows(main.rows, (l) => l.qty)).toBe(15);
    }
    expect(flattenGroups(groups).map((l) => l.id)).toEqual(['thread', 'pending', 'XS', 'S', 'L']);
  });

  it('orders numeric sizes numerically and keeps equal sizes in input order', () => {
    const lines: Line[] = [
      { id: '32a', qty: 1, label: L('W', '32') },
      { id: '28', qty: 1, label: L('W', '28') },
      { id: '32b', qty: 1, label: L('W', '32') },
    ];
    const [g] = groupLabelLines(lines, labelOf);
    expect(g.kind === 'label' && g.rows.map((r) => r.line.id)).toEqual(['28', '32a', '32b']);
  });

  it('leaves a single unsized label line alone', () => {
    const [g] = groupLabelLines([{ id: 'liva', qty: 5, label: L('LIVA', null) }], labelOf);
    expect(g.kind).toBe('single');
  });
});
