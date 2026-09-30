import { slipRemaining, slipSkuBalances } from '../../services/helpers/stitching-slip-balance.helper';

describe('stitching-slip-balance: what is left on a cutting slip', () => {
  const slip = {
    skuBreakdown: [
      { colorId: null, sizeId: 'S', quantity: 459 },
      { colorId: null, sizeId: 'M', quantity: 469 },
      { colorId: 'black', sizeId: 'M', quantity: 10 },
    ],
    stitchingAllocations: [
      { colorId: null, sizeId: 'S', quantity: 400 },
      { colorId: null, sizeId: 'S', quantity: 59 },
      { colorId: 'black', sizeId: 'M', quantity: 4 },
    ],
  };

  it('takes each issue’s pieces off its own colour + size', () => {
    expect(slipSkuBalances(slip)).toEqual([
      { colorId: null, sizeId: 'S', sent: 459, taken: 459, remaining: 0 },
      { colorId: null, sizeId: 'M', sent: 469, taken: 0, remaining: 469 },
      { colorId: 'black', sizeId: 'M', sent: 10, taken: 4, remaining: 6 },
    ]);
    expect(slipRemaining(slip)).toBe(475);
  });

  it('a slip nobody has issued from keeps everything', () => {
    expect(slipRemaining({ ...slip, stitchingAllocations: [] })).toBe(938);
  });

  it('never reads below zero', () => {
    const over = { ...slip, stitchingAllocations: [{ colorId: null, sizeId: 'S', quantity: 500 }] };
    expect(slipSkuBalances(over)[0].remaining).toBe(0);
  });
});
