import { describe, it, expect } from 'vitest';
import { distributeByShares, percentageSum } from '../distribute';

const sum = (m: Map<string, number> | null) => [...(m?.values() ?? [])].reduce((s, v) => s + v, 0);

describe('distributeByShares', () => {
  it('splits by ratio and always adds up to the total', () => {
    const m = distributeByShares(
      2301,
      ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((k, i) => ({ key: k, share: [1, 2, 3, 3, 2, 1][i] })),
      'ratio'
    );
    expect(sum(m)).toBe(2301);
    expect(m?.get('M')).toBe(m?.get('L'));
  });

  it('splits by percentage, giving leftover pieces to the largest remainders', () => {
    const m = distributeByShares(
      100,
      [
        { key: 'a', share: 33.33 },
        { key: 'b', share: 33.33 },
        { key: 'c', share: 33.34 },
      ],
      'percentage'
    );
    expect(sum(m)).toBe(100);
    expect(m?.get('c')).toBe(34);
  });

  it('refuses nothing to split', () => {
    expect(distributeByShares(0, [{ key: 'a', share: 1 }], 'ratio')).toBeNull();
    expect(distributeByShares(10, [{ key: 'a', share: 0 }], 'ratio')).toBeNull();
    expect(distributeByShares(10, [], 'percentage')).toBeNull();
  });

  it('reads 33.33 + 33.33 + 33.34 as exactly 100', () => {
    expect(percentageSum([33.33, 33.33, 33.34])).toBe(100);
  });
});
