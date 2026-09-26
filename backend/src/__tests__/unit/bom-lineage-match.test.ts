/**
 * matchBomLineage — which line of the previous BOM each new line replaces (bom-lineage.helper).
 * A wrong match would carry one material's requirements onto another; an ambiguous one must stay null.
 */

import { matchBomLineage, type LineageLine } from '../../services/helpers/bom-lineage.helper';

const line = (id: string, fields: Partial<LineageLine>): LineageLine => ({
  id,
  materialType: 'GREIGE',
  sortOrder: 0,
  ...fields,
});

describe('matchBomLineage', () => {
  it('matches a fabric line through the same CAD row', () => {
    const prev = [line('p1', { selectedCadId: 'cad-1', greigeId: 'g1', colorName: 'Red' })];
    const next = [line('n1', { selectedCadId: 'cad-1', greigeId: 'g1', colorName: 'Red' })];
    expect(matchBomLineage(prev, next).get('n1')).toBe('p1');
  });

  it('matches a corrected greige through the same CAD slot and colour (greige changed, slot kept)', () => {
    const prev = [
      line('p1', { selectedCadId: 'cad-1', cadSlot: 'sf-1', greigeId: 'GRG-0053', colorName: 'Animal Print' }),
    ];
    const next = [
      line('n1', { selectedCadId: 'cad-1', cadSlot: 'sf-1', greigeId: 'GRG-0039', colorName: 'Animal Print' }),
    ];
    expect(matchBomLineage(prev, next).get('n1')).toBe('p1');
  });

  it('matches a re-costed width (new CAD row) through the slot', () => {
    const prev = [line('p1', { selectedCadId: 'cad-52', cadSlot: 'sf-1', greigeId: 'g1', colorName: 'Red' })];
    const next = [line('n1', { selectedCadId: 'cad-54', cadSlot: 'sf-1', greigeId: 'g1', colorName: 'Red' })];
    expect(matchBomLineage(prev, next).get('n1')).toBe('p1');
  });

  it('keeps two colours of one greige apart', () => {
    const prev = [
      line('pRed', { greigeId: 'g1', colorName: 'Red', componentName: 'Top' }),
      line('pBlue', { greigeId: 'g1', colorName: 'Blue', componentName: 'Top' }),
    ];
    const next = [
      line('nBlue', { greigeId: 'g1', colorName: 'Blue', componentName: 'Top' }),
      line('nRed', { greigeId: 'g1', colorName: 'Red', componentName: 'Top' }),
    ];
    const m = matchBomLineage(prev, next);
    expect(m.get('nRed')).toBe('pRed');
    expect(m.get('nBlue')).toBe('pBlue');
  });

  it('matches trims by their master, labels per label', () => {
    const prev = [
      line('pBtn', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front' }),
      line('pLbl', { materialType: 'LABEL', labelId: 'l1', componentName: 'Neck' }),
    ];
    const next = [
      line('nLbl', { materialType: 'LABEL', labelId: 'l1', componentName: 'Neck' }),
      line('nBtn', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front' }),
    ];
    const m = matchBomLineage(prev, next);
    expect(m.get('nBtn')).toBe('pBtn');
    expect(m.get('nLbl')).toBe('pLbl');
  });

  it('never matches a trim to a fabric line, and uses each previous line once', () => {
    const prev = [line('p1', { greigeId: 'g1', colorName: 'Red', componentName: 'Top' })];
    const next = [
      line('n1', { greigeId: 'g1', colorName: 'Red', componentName: 'Top' }),
      line('n2', { greigeId: 'g1', colorName: 'Red', componentName: 'Top', sortOrder: 5 }),
      line('n3', { materialType: 'BUTTON', buttonId: 'b1' }),
    ];
    const m = matchBomLineage(prev, next);
    expect([...m.values()]).toEqual(['p1']);
    expect(m.has('n3')).toBe(false);
  });

  it('leaves an ambiguous line unmatched rather than guessing', () => {
    const prev = [
      line('p1', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 1 }),
      line('p2', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 2 }),
    ];
    const next = [line('n1', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 9 })];
    expect(matchBomLineage(prev, next).has('n1')).toBe(false);
  });

  it('breaks a tie by sort order', () => {
    const prev = [
      line('p1', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 1 }),
      line('p2', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 2 }),
    ];
    const next = [line('n2', { materialType: 'BUTTON', buttonId: 'b1', componentName: 'Front', sortOrder: 2 })];
    expect(matchBomLineage(prev, next).get('n2')).toBe('p2');
  });
});
