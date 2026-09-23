import { foldActual, foldCounted, hasFold } from '../../utils/fold-length';

describe('fold length (L)', () => {
  it('converts the GRN2609-0250 receipt: 10,011 counted @ L=98 → 9,810.78', () => {
    expect(foldActual(10011, 98).toNumber()).toBe(9810.78);
    expect(foldActual('10011', '98').toNumber()).toBe(9810.78);
  });

  it('rounds a single than to 2 dp, half-up', () => {
    expect(foldActual(102.75, 98).toNumber()).toBe(100.7);
    expect(foldActual(97.3, 98).toNumber()).toBe(95.35);
  });

  it('accepts a fractional L', () => {
    expect(foldActual(1000, 97.5).toNumber()).toBe(975);
  });

  it.each([null, undefined, '', 0, 100, 120, -5])('leaves the quantity untouched when L is %p', (l) => {
    expect(hasFold(l as any)).toBe(false);
    expect(foldActual(10011.125, l as any).toNumber()).toBe(10011.125);
  });

  it('reads the counted figure back from actual', () => {
    expect(foldCounted(9810.78, 98).toNumber()).toBe(10011);
    expect(foldCounted(500, null).toNumber()).toBe(500);
  });
});
