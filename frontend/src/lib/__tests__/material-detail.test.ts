import { describe, it, expect } from 'vitest';
import { materialDetailLine } from '../material-detail';

describe('materialDetailLine', () => {
  it('joins who it is for and what tells it apart', () => {
    expect(
      materialDetailLine({ buyerBrand: 'Easybuy · Easybuy - Western Wear', spec: 'Sewn-in · Main Cum Size Label' })
    ).toBe('Easybuy · Easybuy - Western Wear · Sewn-in · Main Cum Size Label');
  });

  it('skips a blank part', () => {
    expect(materialDetailLine({ buyerBrand: null, spec: '16L · 4 holes' })).toBe('16L · 4 holes');
    expect(materialDetailLine({ buyerBrand: 'Kasya · Nihsamah', spec: '  ' })).toBe('Kasya · Nihsamah');
  });

  it('is empty when the material has neither, or is not loaded', () => {
    expect(materialDetailLine({ buyerBrand: null, spec: null })).toBe('');
    expect(materialDetailLine({})).toBe('');
    expect(materialDetailLine(null)).toBe('');
    expect(materialDetailLine(undefined)).toBe('');
  });
});
