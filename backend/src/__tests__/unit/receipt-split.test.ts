/**
 * Receipt splitting — pro-rata apportionment across allocation links (pure, no DB).
 *
 * The helper is the single answer to "one receipt, several requirements": these tests pin the
 * properties the MRP status aggregate relies on — shares sum EXACTLY to the receipt, a reversal is
 * the element-wise negation of the receipt it undoes, single-link receipts pass through untouched,
 * and over-receipt is never capped. The live case is JWO DJ-EBEW-003-001, whose 4,000 m partial
 * receipt used to be credited in full to both links.
 */

import { splitReceiptAcrossLinks, RECEIPT_SPLIT_DP } from '../../services/helpers/receipt-split.helper';
import { toCurrency, Decimal } from '../../utils/currency';

/** Compare quantities at column scale — never float ===. */
const at3 = (v: number) => toCurrency(v).toFixed(RECEIPT_SPLIT_DP);
const sumOf = (shares: Array<{ qty: number }>) =>
  shares.reduce((sum, s) => sum.plus(toCurrency(s.qty)), new Decimal(0));

const link = (id: string, allocatedQuantity: string) => ({ id, allocatedQuantity });

// The live allocation: 1099.920 + 6988.800 = 8088.720 on DJ-EBEW-003-001.
const LIVE_LINKS = [link('a', '1099.920'), link('b', '6988.800')];

describe('splitReceiptAcrossLinks — DJ-EBEW-003-001 live case', () => {
  it('4,000 m partial receipt splits pro-rata instead of crediting 4,000 to both links', () => {
    const shares = splitReceiptAcrossLinks(LIVE_LINKS, 4000);

    expect(shares.map((s) => s.id)).toEqual(['a', 'b']);
    expect(at3(shares[0].qty)).toBe('543.928');
    expect(at3(shares[1].qty)).toBe('3456.072');
    expect(sumOf(shares).equals(toCurrency(4000))).toBe(true);
  });

  it('the small link stays short — the shortfall that used to vanish from MRP survives', () => {
    const [small] = splitReceiptAcrossLinks(LIVE_LINKS, 4000);
    expect(toCurrency(small.qty).lessThan(toCurrency('1099.920'))).toBe(true);
  });

  it('full receipt of 8088.72 lands exactly on the two allocations', () => {
    const shares = splitReceiptAcrossLinks(LIVE_LINKS, 8088.72);

    expect(at3(shares[0].qty)).toBe('1099.920');
    expect(at3(shares[1].qty)).toBe('6988.800');
    expect(sumOf(shares).equals(toCurrency(8088.72))).toBe(true);
  });
});

describe('splitReceiptAcrossLinks — reversal symmetry', () => {
  it('a -4,000 reversal is the element-wise negation of the +4,000 receipt', () => {
    const receipt = splitReceiptAcrossLinks(LIVE_LINKS, 4000);
    const reversal = splitReceiptAcrossLinks(LIVE_LINKS, -4000);

    expect(reversal.map((s) => s.id)).toEqual(receipt.map((s) => s.id));
    reversal.forEach((r, i) => {
      expect(at3(r.qty)).toBe(at3(-receipt[i].qty));
    });
    expect(sumOf(reversal).equals(toCurrency(-4000))).toBe(true);
  });

  it('receipt + reversal returns every link to zero', () => {
    const receipt = splitReceiptAcrossLinks(LIVE_LINKS, 4000);
    const reversal = splitReceiptAcrossLinks(LIVE_LINKS, -4000);

    receipt.forEach((r, i) => {
      expect(toCurrency(r.qty).plus(toCurrency(reversal[i].qty)).isZero()).toBe(true);
    });
  });
});

describe('splitReceiptAcrossLinks — edges', () => {
  it('over-receipt is not capped at the allocation and still sums exactly', () => {
    const shares = splitReceiptAcrossLinks(LIVE_LINKS, 8500);

    expect(toCurrency(shares[0].qty).greaterThan(toCurrency('1099.920'))).toBe(true);
    expect(toCurrency(shares[1].qty).greaterThan(toCurrency('6988.800'))).toBe(true);
    expect(sumOf(shares).equals(toCurrency(8500))).toBe(true);
  });

  it('a single link receives the caller’s own number, untouched', () => {
    const qty = 4123.457;
    const shares = splitReceiptAcrossLinks([link('solo', '9999.999')], qty);

    expect(shares).toHaveLength(1);
    expect(shares[0].id).toBe('solo');
    expect(Object.is(shares[0].qty, qty)).toBe(true);
  });

  it('a single link passes a reversal through unchanged too', () => {
    const qty = -8792.09;
    const shares = splitReceiptAcrossLinks([link('solo', '0')], qty);
    expect(Object.is(shares[0].qty, qty)).toBe(true);
  });

  it('no links returns no shares', () => {
    expect(splitReceiptAcrossLinks([], 4000)).toEqual([]);
  });

  it('all-zero allocations split equally instead of dividing by zero', () => {
    const shares = splitReceiptAcrossLinks([link('a', '0'), link('b', '0'), link('c', '0')], 100);

    expect(shares.map((s) => at3(s.qty))).toEqual(['33.333', '33.333', '33.334']);
    expect(sumOf(shares).equals(toCurrency(100))).toBe(true);
    expect(shares.every((s) => Number.isFinite(s.qty))).toBe(true);
  });

  it('a zero receipt credits nothing anywhere', () => {
    const shares = splitReceiptAcrossLinks(LIVE_LINKS, 0);
    expect(shares.every((s) => toCurrency(s.qty).isZero())).toBe(true);
  });

  it('the remainder always lands on the LAST link, so order decides it', () => {
    const forward = splitReceiptAcrossLinks([link('a', '1'), link('b', '1'), link('c', '1')], 100);
    expect(at3(forward[2].qty)).toBe('33.334');
    expect(at3(forward[0].qty)).toBe('33.333');
  });
});

describe('splitReceiptAcrossLinks — exactness grid', () => {
  const allocationVectors: string[][] = [
    ['1099.920', '6988.800'],
    ['1', '1', '1'],
    ['0.001', '9999.999'],
    ['100', '200', '300', '400'],
    ['33.333', '33.333', '33.334'],
    ['7', '11', '13', '17', '19'],
    ['0', '0', '5000'],
    ['2500.500', '2500.500'],
  ];
  // In-contract quantities: at most RECEIPT_SPLIT_DP decimals, both signs.
  const quantities = [4000, -4000, 8088.72, -8088.72, 0.001, -0.001, 12345.678, -12345.678, 1, 0];

  it.each(allocationVectors.map((v, i) => [i, v] as const))(
    'vector %i sums exactly for every quantity, positive and negative',
    (_i, vector) => {
      const links = vector.map((a, idx) => link(`l${idx}`, a));

      for (const qty of quantities) {
        const shares = splitReceiptAcrossLinks(links, qty);

        expect(shares).toHaveLength(links.length);
        expect(shares.map((s) => s.id)).toEqual(links.map((l) => l.id));
        expect(sumOf(shares).equals(toCurrency(qty))).toBe(true);
        expect(sumOf(shares).toFixed(RECEIPT_SPLIT_DP)).toBe(at3(qty));
      }
    }
  );

  it.each(allocationVectors.map((v, i) => [i, v] as const))(
    'vector %i negates element-wise between a receipt and its reversal',
    (_i, vector) => {
      const links = vector.map((a, idx) => link(`l${idx}`, a));

      for (const qty of quantities) {
        const receipt = splitReceiptAcrossLinks(links, qty);
        const reversal = splitReceiptAcrossLinks(links, -qty);

        receipt.forEach((r, idx) => {
          expect(toCurrency(r.qty).plus(toCurrency(reversal[idx].qty)).isZero()).toBe(true);
        });
      }
    }
  );

  it('no share ever exceeds column scale for in-contract quantities', () => {
    for (const vector of allocationVectors) {
      const links = vector.map((a, idx) => link(`l${idx}`, a));
      for (const qty of [4000, -12345.678, 0.001]) {
        for (const share of splitReceiptAcrossLinks(links, qty)) {
          expect(toCurrency(share.qty).decimalPlaces()).toBeLessThanOrEqual(RECEIPT_SPLIT_DP);
        }
      }
    }
  });
});
