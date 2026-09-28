/**
 * PO links fill in order (owner decision D1, 2026-09-29) — the pure fill, no DB.
 *
 * A part delivery fills the earliest-delivery order first, and a GRN reversal must be exact. The fill is a pure
 * function of (the line's approved totals per pool, the links in fill order, which links are eligible), so every
 * event recomputes from the totals: these tests pin the XS walk from the design (docs/plans/po-allocation-design.md
 * §8 / §11), exactness in every order, the location pools (A: a processor's own orders, B: orders with no processor
 * yet, C: our store serves anyone), UNPLACED, issued floors and deficits, and that re-ranking the zero-credit tail
 * never moves a credit.
 */

import {
  fillLineReceipts,
  rankTail,
  receiptPoolOf,
  sortByFillOrder,
  STORE_POOL,
  UNPLACED_POOL,
  type FillLink,
  type FillResult,
} from '../../services/helpers/receipt-split.helper';
import { grnLineStockQty } from '../../services/helpers/grn-line-value.helper';
import { greigeHolderId } from '../../services/helpers/lot-location.helper';

const link = (id: string, allocated: number, fillOrder: number | null, extra: Partial<FillLink> = {}): FillLink => ({
  id,
  allocated,
  fillOrder,
  dyer: null,
  eligible: true,
  floors: {},
  ...extra,
});

const credits = (fill: FillResult, links: FillLink[]) => sortByFillOrder(links).map((l) => fill.credit.get(l.id));
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 1000) / 1000;

/** Σ credit + Σ plain = the line total, and 0 ≤ credit ≤ max(allocated, floors) — invariant 4 */
function expectBalanced(fill: FillResult, links: FillLink[], totals: Record<string, number>) {
  const credited = sum([...fill.credit.values()]);
  const plain = sum(Object.values(fill.plainStock));
  const deficit = sum(Object.values(fill.deficits));
  expect(sum([credited, plain])).toBeCloseTo(sum([...Object.values(totals), deficit]), 3);
  for (const l of links) {
    const c = fill.credit.get(l.id)!;
    const floor = sum(Object.values(l.floors));
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(Math.max(l.allocated, floor) + 0.0005);
  }
}

// PO2609-0231, LBL-0004-XS: the nine running orders in earliest-delivery order (design §11 step 4)
const XS_ALLOCATIONS = [350, 322, 253, 322, 350, 322, 322, 350, 350];
const xsLinks = () => XS_ALLOCATIONS.map((a, i) => link(`xs${i + 1}`, a, i + 1));

describe('XS walk — earliest delivery first, never pro-rata', () => {
  const walk: Array<[string, number, number[], number]> = [
    ['GRN-A 1,000 approved', 1000, [350, 322, 253, 75, 0, 0, 0, 0, 0], 0],
    ['GRN-B 3,530 approved too', 4530, XS_ALLOCATIONS, 1589],
    ['GRN-A reversed', 3530, XS_ALLOCATIONS, 589],
    ['GRN-B reversed instead of A', 1000, [350, 322, 253, 75, 0, 0, 0, 0, 0], 0],
    ['both reversed', 0, [0, 0, 0, 0, 0, 0, 0, 0, 0], 0],
  ];

  it.each(walk)('%s → the table from the design', (_label, total, expected, plain) => {
    const links = xsLinks();
    const fill = fillLineReceipts(links, { [STORE_POOL]: total });
    expect(credits(fill, links)).toEqual(expected);
    expect(fill.plainStock[STORE_POOL]).toBe(plain);
    expect(fill.deficits).toEqual({});
    expectBalanced(fill, links, { [STORE_POOL]: total });
  });

  it('the caller’s order does not matter — the fill sorts by fillOrder, then id', () => {
    const links = xsLinks().reverse();
    const fill = fillLineReceipts(links, { [STORE_POOL]: 1000 });
    expect(credits(fill, links)).toEqual([350, 322, 253, 75, 0, 0, 0, 0, 0]);
  });

  it('issued 300 to the first order: reversing both GRNs is a 300 deficit (the reversal the engine refuses)', () => {
    const links = xsLinks();
    links[0].floors = { [STORE_POOL]: 300 };
    const full = fillLineReceipts(links, { [STORE_POOL]: 4530 });
    expect(credits(full, links)).toEqual(XS_ALLOCATIONS);
    expect(full.plainStock[STORE_POOL]).toBe(1589);

    const afterA = fillLineReceipts(links, { [STORE_POOL]: 3530 });
    expect(credits(afterA, links)).toEqual(XS_ALLOCATIONS);
    expect(afterA.plainStock[STORE_POOL]).toBe(589);

    const none = fillLineReceipts(links, { [STORE_POOL]: 0 });
    expect(none.deficits).toEqual({ [STORE_POOL]: 300 });
    expect(none.credit.get('xs1')).toBe(300); // never below what it issued
    expect(credits(none, links).slice(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('reversal is exact in every order', () => {
  const GRNS: Record<string, number> = { A: 1000, B: 3530, C: 247.5 };
  const permutations = (xs: string[]): string[][] =>
    xs.length <= 1
      ? [xs]
      : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  const stateOf = (approved: Set<string>) => {
    const links = xsLinks();
    const total = sum([...approved].map((g) => GRNS[g]));
    const fill = fillLineReceipts(links, { [STORE_POOL]: total });
    return { credits: credits(fill, links), plain: fill.plainStock[STORE_POOL] };
  };

  it.each(permutations(['A', 'B', 'C']).flatMap((up) => permutations(['A', 'B', 'C']).map((down) => [up, down])))(
    'approve %j then reverse %j — every step lands on the state of the receipts still approved',
    (up, down) => {
      const approved = new Set<string>();
      const seen = new Map<string, ReturnType<typeof stateOf>>();
      const key = () => [...approved].sort().join('');
      seen.set('', stateOf(approved));
      for (const g of up as string[]) {
        approved.add(g);
        seen.set(key(), stateOf(approved));
      }
      for (const g of down as string[]) {
        approved.delete(g);
        const now = stateOf(approved);
        // The same set of approved receipts always reads the same, however it was reached
        if (seen.has(key())) expect(now).toEqual(seen.get(key()));
        expect(sum([...now.credits.map((c) => c ?? 0), now.plain])).toBeCloseTo(
          sum([...approved].map((x) => GRNS[x])),
          3
        );
      }
      expect(stateOf(approved)).toEqual(seen.get(''));
    }
  );
});

describe('location pools (greige and lace)', () => {
  it('the design’s Mangal walk: cloth at the dyer fills that dyer’s orders, the store tops them up', () => {
    const links = [
      link('m133', 1.533, 1, { dyer: 'MANGAL' }),
      link('m157', 3823.529, 2, { dyer: 'MANGAL' }),
      link('m141', 3823.529, 3, { dyer: 'MANGAL' }),
    ];
    const first = fillLineReceipts(links, { MANGAL: 4900 });
    expect(credits(first, links)).toEqual([1.533, 3823.529, 1074.938]);
    expect(first.plainStock.MANGAL).toBe(0);

    const second = fillLineReceipts(links, { MANGAL: 4900, [STORE_POOL]: 2940 });
    expect(credits(second, links)).toEqual([1.533, 3823.529, 3823.529]);
    expect(second.creditByPool.get('m141')).toEqual({ MANGAL: 1074.938, [STORE_POOL]: 2748.591 });
    expect(second.plainStock[STORE_POOL]).toBe(191.409);
    expectBalanced(second, links, { MANGAL: 4900, [STORE_POOL]: 2940 });

    // Reverse the store receipt → back to the first state exactly
    const back = fillLineReceipts(links, { MANGAL: 4900 });
    expect(credits(back, links)).toEqual(credits(first, links));
  });

  it('A: a processor’s pool serves its own orders first, even when a dyer-less order is earlier', () => {
    const links = [link('free', 100, 1), link('atX', 80, 2, { dyer: 'X' })];
    const fill = fillLineReceipts(links, { X: 100 });
    expect(fill.credit.get('atX')).toBe(80); // pass A
    expect(fill.credit.get('free')).toBe(20); // pass B: what X has left
  });

  it('B: what the processor pools have left serves dyer-less orders, pool by pool (id order)', () => {
    const links = [link('free', 100, 1), link('atX', 80, 2, { dyer: 'X' })];
    const fill = fillLineReceipts(links, { X: 100, Y: 50 });
    expect(fill.creditByPool.get('free')).toEqual({ X: 20, Y: 50 });
    expect(fill.plainStock).toEqual({ X: 0, Y: 0 });
  });

  it('never another processor’s cloth for an order whose processor is known', () => {
    const links = [link('atA', 100, 1, { dyer: 'A' })];
    const fill = fillLineReceipts(links, { B: 100 });
    expect(fill.credit.get('atA')).toBe(0);
    expect(fill.plainStock.B).toBe(100);
  });

  it('C: our store serves anyone — orders at a processor too — in fill order', () => {
    const links = [link('atA', 100, 1, { dyer: 'A' }), link('free', 100, 2), link('atB', 100, 3, { dyer: 'B' })];
    const fill = fillLineReceipts(links, { [STORE_POOL]: 250 });
    expect(credits(fill, links)).toEqual([100, 100, 50]);
  });

  it('UNPLACED (a processor unit linked to no processor) fills nobody — it stays plain stock', () => {
    const links = [link('free', 100, 1), link('atA', 100, 2, { dyer: 'A' })];
    const fill = fillLineReceipts(links, { [UNPLACED_POOL]: 500 });
    expect(credits(fill, links)).toEqual([0, 0]);
    expect(fill.plainStock[UNPLACED_POOL]).toBe(500);
  });

  it('a receipt’s pool is where its GRN booked it — the same answer as greigeHolderId, plus UNPLACED', () => {
    const cases = [
      { warehouseName: 'Store', warehouseType: 'RAW_MATERIAL', supplierId: null },
      { warehouseName: 'Mangal - Processing Unit', warehouseType: 'JOB_WORK', supplierId: 'MANGAL' },
      { warehouseName: 'Orphan unit', warehouseType: 'JOB_WORK', supplierId: null },
      { warehouseName: 'Odd store with a supplier', warehouseType: 'GENERAL', supplierId: 'SOMEONE' },
    ];
    expect(cases.map((w) => receiptPoolOf(w))).toEqual([STORE_POOL, 'MANGAL', UNPLACED_POOL, STORE_POOL]);
    for (const w of cases) {
      const holder = greigeHolderId({ warehouse: w });
      const pool = receiptPoolOf(w);
      if (holder) expect(pool).toBe(holder);
      else expect([STORE_POOL, UNPLACED_POOL]).toContain(pool);
    }
    expect(receiptPoolOf(null)).toBe(STORE_POOL);
  });
});

describe('floors (what a link already issued) and deficits', () => {
  it('issued goods count towards the allocation, wherever they came from', () => {
    const links = [link('atM', 100, 1, { dyer: 'M', floors: { M: 30 } })];
    const fill = fillLineReceipts(links, { M: 30, [STORE_POOL]: 100 });
    expect(fill.creditByPool.get('atM')).toEqual({ M: 30, [STORE_POOL]: 70 });
    expect(fill.plainStock[STORE_POOL]).toBe(30);
  });

  it('a pool holding less than was issued from it is a deficit; the floor stands', () => {
    const links = [link('l1', 350, 1, { floors: { [STORE_POOL]: 300 } }), link('l2', 322, 2)];
    const fill = fillLineReceipts(links, { [STORE_POOL]: 200 });
    expect(fill.deficits).toEqual({ [STORE_POOL]: 100 });
    expect(credits(fill, links)).toEqual([300, 0]);
    expect(fill.plainStock[STORE_POOL]).toBe(0);
  });

  it('a cancelled order keeps what it issued; the rest of its share passes to the next order', () => {
    const links = [link('cancelled', 350, 1, { eligible: false, floors: { [STORE_POOL]: 100 } }), link('next', 322, 2)];
    const fill = fillLineReceipts(links, { [STORE_POOL]: 1000 });
    expect(credits(fill, links)).toEqual([100, 322]);
    expect(fill.plainStock[STORE_POOL]).toBe(578);
  });

  it('dust below the tolerance is not a deficit', () => {
    const links = [link('l1', 100, 1, { floors: { [STORE_POOL]: 100.003 } })];
    const fill = fillLineReceipts(links, { [STORE_POOL]: 100 });
    expect(fill.deficits).toEqual({});
  });
});

describe('rankTail — re-ranking only the zero-credit tail moves no credit (C4)', () => {
  const byIdDesc = (a: FillLink, b: FillLink) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  const reRank = (links: FillLink[], ranks: Map<string, number>) =>
    links.map((l) => ({ ...l, fillOrder: ranks.get(l.id)! }));

  it('trims: ranks up to the last credited link stay, the rest are re-sorted after it', () => {
    const links = xsLinks();
    const fill = fillLineReceipts(links, { [STORE_POOL]: 1000 });
    const ranks = rankTail(links, fill.credit, byIdDesc);
    expect([1, 2, 3, 4].map((i) => ranks.get(`xs${i}`))).toEqual([1, 2, 3, 4]);
    expect(['xs9', 'xs8', 'xs7', 'xs6', 'xs5'].map((id) => ranks.get(id))).toEqual([5, 6, 7, 8, 9]);
    const again = fillLineReceipts(reRank(links, ranks), { [STORE_POOL]: 1000 });
    expect(again.credit).toEqual(fill.credit);
  });

  it('a new link (no rank yet) joins the tail by priority', () => {
    const links = [...xsLinks(), link('new', 200, null)];
    const fill = fillLineReceipts(links, { [STORE_POOL]: 1000 });
    const priority = (a: FillLink, b: FillLink) => (a.id === 'new' ? -1 : b.id === 'new' ? 1 : 0);
    const ranks = rankTail(links, fill.credit, priority);
    expect(ranks.get('new')).toBe(5);
    expect(fillLineReceipts(reRank(links, ranks), { [STORE_POOL]: 1000 }).credit).toEqual(fill.credit);
  });

  it('pooled: a zero-credit dyer-B link ranked before a credited dyer-A link keeps its place', () => {
    const links = [
      link('b1', 100, 1, { dyer: 'B' }),
      link('a2', 100, 2, { dyer: 'A' }),
      link('a3', 100, 3, { dyer: 'A' }),
      link('n4', 100, 4),
      link('b5', 100, 5, { dyer: 'B' }),
    ];
    const totals = { A: 100 };
    const fill = fillLineReceipts(links, totals);
    expect(credits(fill, links)).toEqual([0, 100, 0, 0, 0]);
    const ranks = rankTail(links, fill.credit, byIdDesc);
    expect(ranks.get('b1')).toBe(1); // not demoted behind later orders
    expect(ranks.get('a2')).toBe(2);
    expect(['n4', 'b5', 'a3'].map((id) => ranks.get(id))).toEqual([3, 4, 5]); // the tail, by the given priority
    const again = fillLineReceipts(reRank(links, ranks), totals);
    expect(again.credit).toEqual(fill.credit);
    // …and when B's cloth arrives later, b1 is still first in line for it
    const later = fillLineReceipts(reRank(links, ranks), { A: 100, B: 150 });
    expect(later.credit.get('b1')).toBe(100);
    expect(later.credit.get('b5')).toBe(50);
  });

  it('gaps and missing ranks in the head are kept in order and numbered on', () => {
    const links = [link('h1', 10, 1), link('h2', 10, 4), link('h3', 10, 4), link('t', 10, 9)];
    const ranks = rankTail(
      links,
      new Map([
        ['h1', 10],
        ['h2', 0],
        ['h3', 10],
        ['t', 0],
      ]),
      byIdDesc
    );
    expect(['h1', 'h2', 'h3', 't'].map((id) => ranks.get(id))).toEqual([1, 4, 5, 6]);
  });

  it('property: 300 random lines — re-ranking the tail with any priority never changes a credit', () => {
    // A small seeded generator so a failure reproduces
    let seed = 20260929;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    for (let run = 0; run < 300; run++) {
      const n = 2 + Math.floor(rnd() * 8);
      const links: FillLink[] = [];
      for (let i = 0; i < n; i++) {
        links.push(
          link(`r${run}-${i}`, Math.round(rnd() * 500 * 1000) / 1000, rnd() < 0.15 ? null : i + 1, {
            dyer: pick([null, null, 'A', 'B', 'C']),
            eligible: rnd() > 0.1,
          })
        );
      }
      const totals: Record<string, number> = {};
      for (const pool of ['A', 'B', STORE_POOL, UNPLACED_POOL]) if (rnd() < 0.6) totals[pool] = Math.round(rnd() * 900);
      const fill = fillLineReceipts(links, totals);
      expectBalanced(fill, links, totals);
      const keys = new Map(links.map((l) => [l.id, rnd()]));
      const ranks = rankTail(links, fill.credit, (a, b) => keys.get(a.id)! - keys.get(b.id)!);
      const again = fillLineReceipts(reRank(links, ranks), totals);
      expect(again.credit).toEqual(fill.credit);
      expect(again.plainStock).toEqual(fill.plainStock);
    }
  });
});

describe('sortByFillOrder', () => {
  it('fillOrder ascending, nulls last, then id', () => {
    const sorted = sortByFillOrder([link('c', 1, null), link('b', 1, 2), link('a', 1, null), link('d', 1, 1)]);
    expect(sorted.map((l) => l.id)).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('grnLineStockQty — what one approved GRN line put into stock', () => {
  it('the stored stockQuantity wins — reversal takes back exactly that', () => {
    expect(
      grnLineStockQty({ acceptedQuantity: 16, stockQuantity: 2304, purchase_order_items: { stockUnitsPerUnit: 144 } })
    ).toBe(2304);
  });
  it('an older receipt with none: actual accepted × stock units per unit', () => {
    expect(
      grnLineStockQty({ acceptedQuantity: 16, stockQuantity: null, purchase_order_items: { stockUnitsPerUnit: 144 } })
    ).toBe(2304);
    expect(grnLineStockQty({ acceptedQuantity: 1000, foldLengthCm: 98, stockQuantity: null })).toBe(980);
    expect(grnLineStockQty({ acceptedQuantity: 350 })).toBe(350);
  });
});
