/**
 * label-lines — a label's sizes grouped under one heading, in size order (utils/label-lines.ts).
 */
import fs from 'fs';
import path from 'path';
import { flattenGroups, groupLabelLines, sumRows, type LabelLineKey } from '../../utils/label-lines';

interface Line {
  id: string;
  qty: number;
  label?: LabelLineKey;
}
const L = (labelId: string, size: string | null): LabelLineKey => ({
  labelId,
  code: labelId,
  name: `${labelId} name`,
  size,
});
const labelOf = (l: Line) => l.label ?? null;

describe('groupLabelLines', () => {
  const lines: Line[] = [
    { id: 'button', qty: 10 },
    { id: 'main-M', qty: 3, label: L('MAIN', 'M') },
    { id: 'main-XS', qty: 1, label: L('MAIN', 'XS') },
    { id: 'liva', qty: 9, label: L('LIVA', null) },
    { id: 'main-XXL', qty: 5, label: L('MAIN', 'XXL') },
    { id: 'main-base', qty: 7, label: L('MAIN', null) },
    { id: 'zip', qty: 2 },
  ];
  const groups = groupLabelLines(lines, labelOf);

  it("gathers a label's lines under one heading where its first line was", () => {
    expect(groups.map((g) => (g.kind === 'label' ? `label:${g.labelId}` : g.line.id))).toEqual([
      'button',
      'label:MAIN',
      'liva',
      'zip',
    ]);
  });

  it('puts the base (unsized) row first, then sizes in size order', () => {
    const main = groups.find((g) => g.kind === 'label');
    expect(main && main.kind === 'label' && main.rows.map((r) => r.line.id)).toEqual([
      'main-base',
      'main-XS',
      'main-M',
      'main-XXL',
    ]);
  });

  it('keeps each row’s position in the input, for index-based updaters', () => {
    const main = groups.find((g) => g.kind === 'label');
    expect(main && main.kind === 'label' && main.rows.map((r) => r.index)).toEqual([5, 2, 1, 4]);
  });

  it('leaves a lone unsized label single, carrying its label', () => {
    const liva = groups.find((g) => g.kind === 'single' && g.line.id === 'liva');
    expect(liva && liva.kind === 'single' && liva.label?.labelId).toBe('LIVA');
  });

  it('groups an unsized label with two lines', () => {
    const twice = groupLabelLines(
      [
        { id: 'a', qty: 1, label: L('X', null) },
        { id: 'b', qty: 1, label: L('X', null) },
      ],
      labelOf
    );
    expect(twice).toHaveLength(1);
    expect(twice[0].kind).toBe('label');
  });

  it('flattens back to grouped order and totals a group to 3 decimals', () => {
    expect(flattenGroups(groups).map((l) => l.id)).toEqual([
      'button',
      'main-base',
      'main-XS',
      'main-M',
      'main-XXL',
      'liva',
      'zip',
    ]);
    const main = groups.find((g) => g.kind === 'label');
    expect(main && main.kind === 'label' && sumRows(main.rows, (l) => l.qty)).toBe(16);
    expect(
      sumRows(
        [
          { line: { qty: 0.1 }, index: 0, size: 'S' },
          { line: { qty: 0.2 }, index: 1, size: 'M' },
        ],
        (l) => l.qty
      )
    ).toBe(0.3);
  });

  it('handles an empty list', () => {
    expect(groupLabelLines([], labelOf)).toEqual([]);
  });

  it('is identical to its frontend twin except for the compareSizes import', () => {
    const strip = (file: string) =>
      fs
        .readFileSync(file, 'utf8')
        .replace(/\r\n/g, '\n')
        .replace(/^import \{ compareSizes \} from '[^']+';$/m, '');
    const backend = path.resolve(__dirname, '../../utils/label-lines.ts');
    const frontend = path.resolve(__dirname, '../../../../frontend/src/lib/label-lines.ts');
    expect(strip(frontend)).toBe(strip(backend));
  });
});
