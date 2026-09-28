/**
 * The Allocate dialog's split (lib/po-allocation-split.ts): earliest delivery first until the line runs out,
 * typed quantities kept, focus ids tick only those rows, one line per requirement.
 */
import { describe, it, expect } from 'vitest';
import {
  editSplitRow,
  initialSplit,
  lineFreeFor,
  splitAllocations,
  splitIsSavable,
  splitKey,
  splitLineOf,
  splitLineSummary,
  splitRowProblem,
  tickedOn,
  toggleSplitRow,
  walkDefaultSplit,
  type SplitCandidate,
  type SplitLine,
  type SplitState,
} from '@/lib/po-allocation-split';
import type { PoAllocationLine } from '@/types/po-allocation.types';

const cand = (requirementId: string, needQty: number, suggestedQty = 0, extra: Partial<SplitCandidate> = {}) => ({
  requirementId,
  needQty,
  linkable: true,
  dyer: null,
  suggestedQty,
  ...extra,
});

// XS: 1,000 free, five orders earliest first — the server's default split is 350 / 322 / 253 / 75 / 0
const XS: SplitLine = {
  itemId: 'xs',
  freeToLink: 1000,
  candidates: [
    cand('r1', 350, 350),
    cand('r2', 322, 322),
    cand('r3', 253, 253),
    cand('r4', 200, 75),
    cand('r5', 90, 0),
  ],
};

const qtys = (state: SplitState, line: SplitLine) =>
  line.candidates.map((c) => {
    const row = state[splitKey(line.itemId, c.requirementId)];
    return row?.ticked ? row.qty : '-';
  });

describe('initialSplit', () => {
  it('starts from the server default: suggested rows ticked at their suggestion, the rest unticked', () => {
    const s = initialSplit([XS]);
    expect(qtys(s, XS)).toEqual(['350', '322', '253', '75', '-']);
    expect(Object.values(s).every((r) => !r.edited)).toBe(true);
  });

  it('with focus ids ticks only those rows and shares the whole line among them', () => {
    const s = initialSplit([XS], ['r4', 'r5']);
    expect(qtys(s, XS)).toEqual(['-', '-', '-', '200', '90']);
  });

  it('with focus ids, a requirement on two lines is ticked on the first with room only', () => {
    const full: SplitLine = { itemId: 'a', freeToLink: 0, candidates: [cand('r9', 40)] };
    const roomy: SplitLine = { itemId: 'b', freeToLink: 100, candidates: [cand('r9', 40)] };
    const s = initialSplit([full, roomy], ['r9']);
    expect(tickedOn([full, roomy], s, 'r9')).toBe('b');
    expect(s[splitKey('a', 'r9')].ticked).toBe(false);
    expect(s[splitKey('b', 'r9')].qty).toBe('40');
  });

  it('never ticks a row the server refuses', () => {
    const line: SplitLine = { itemId: 'x', freeToLink: 100, candidates: [cand('r1', 10, 0, { linkable: false })] };
    expect(initialSplit([line], ['r1'])[splitKey('x', 'r1')].ticked).toBe(false);
  });
});

describe('walkDefaultSplit', () => {
  it('unticking an earlier order gives its share to the next ticked ones, earliest first', () => {
    let s = initialSplit([XS]);
    s = toggleSplitRow([XS], s, 'xs', 'r1', false);
    // 1,000 over r2..r4: 322 + 253 + 200 = 775, r5 not ticked
    expect(qtys(s, XS)).toEqual(['-', '322', '253', '200', '-']);
    s = toggleSplitRow([XS], s, 'xs', 'r5', true);
    expect(qtys(s, XS)).toEqual(['-', '322', '253', '200', '90']);
  });

  it('a row ticked after the line ran out gets 0, and is left out of the POST', () => {
    let s = initialSplit([XS]);
    s = toggleSplitRow([XS], s, 'xs', 'r5', true);
    expect(s[splitKey('xs', 'r5')].qty).toBe('0');
    expect(splitAllocations([XS], s).map((a) => a.requirementId)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('a typed quantity is kept and comes off the line before the others share it', () => {
    let s = initialSplit([XS]);
    s = editSplitRow([XS], s, 'xs', 'r3', '100');
    // 1,000 − 100 typed = 900: r1 350, r2 322, r4 228 → capped at its need 200
    expect(qtys(s, XS)).toEqual(['350', '322', '100', '200', '-']);
    expect(s[splitKey('xs', 'r3')].edited).toBe(true);
  });

  it('shares floor to 3 decimals and never pass a need', () => {
    const line: SplitLine = { itemId: 'm', freeToLink: 10.0009, candidates: [cand('a', 3.3333), cand('b', 99)] };
    const s = walkDefaultSplit([line], {
      [splitKey('m', 'a')]: { ticked: true, edited: false, qty: '' },
      [splitKey('m', 'b')]: { ticked: true, edited: false, qty: '' },
    });
    expect(qtys(s, line)).toEqual(['3.333', '6.667']);
  });

  it('greige: each order takes only what can reach its processor', () => {
    const line: SplitLine = {
      itemId: 'g',
      freeToLink: 1000,
      freeFor: (d) => (d === 'aryan' ? 300 : 1000),
      candidates: [cand('a1', 500, 0, { dyer: { id: 'aryan' } }), cand('m1', 500, 0, { dyer: { id: 'mangal' } })],
    };
    const s = initialSplit([line], ['a1', 'm1']);
    expect(qtys(s, line)).toEqual(['300', '500']);
  });
});

describe('summary, problems and the POST body', () => {
  it('left free goes live, and a line over its free quantity cannot be saved', () => {
    let s = initialSplit([XS]);
    expect(splitLineSummary(XS, s)).toMatchObject({ requested: 1000, leftFree: 0, over: false });
    s = editSplitRow([XS], s, 'xs', 'r5', '90');
    // r5 typed 90 first, then 350 + 322 + 238 (r3 cut) + 0 = 1,000 — still not over
    expect(splitLineSummary(XS, s).over).toBe(false);
    s = editSplitRow([XS], s, 'xs', 'r1', '350');
    s = editSplitRow([XS], s, 'xs', 'r2', '322');
    s = editSplitRow([XS], s, 'xs', 'r3', '253');
    s = editSplitRow([XS], s, 'xs', 'r4', '75');
    expect(splitLineSummary(XS, s)).toMatchObject({ requested: 1090, leftFree: -90, over: true });
    expect(splitIsSavable([XS], s)).toBe(false);
  });

  it('flags a typed quantity above the need or not a number', () => {
    const c = cand('r1', 350);
    expect(splitRowProblem(c, { ticked: true, edited: true, qty: '350.004' })).toBeNull();
    expect(splitRowProblem(c, { ticked: true, edited: true, qty: '351' })).toBe('OVER_NEED');
    expect(splitRowProblem(c, { ticked: true, edited: true, qty: 'abc' })).toBe('NOT_A_NUMBER');
    expect(splitRowProblem(c, { ticked: true, edited: true, qty: '' })).toBe('NOT_A_NUMBER');
    expect(splitRowProblem(c, { ticked: false, edited: false, qty: 'abc' })).toBeNull();
  });

  it('snaps a quantity within dust of the need to the need', () => {
    const line: SplitLine = { itemId: 'l', freeToLink: 5000, candidates: [cand('r1', 2786.598)] };
    const s = editSplitRow([line], initialSplit([line]), 'l', 'r1', '2786.60');
    expect(splitAllocations([line], s)).toEqual([
      { purchaseOrderItemId: 'l', requirementId: 'r1', quantity: 2786.598 },
    ]);
    expect(splitIsSavable([line], s)).toBe(true);
  });

  it('nothing ticked is not savable', () => {
    const line: SplitLine = { itemId: 'l', freeToLink: 5, candidates: [cand('r1', 2)] };
    expect(splitIsSavable([line], initialSplit([line]))).toBe(false);
  });
});

describe('lineFreeFor (greige / lace)', () => {
  const link = (allocatedQty: number, receivedQty: number, extra: Partial<PoAllocationLine['links'][number]> = {}) =>
    ({
      linkId: `l${allocatedQty}`,
      requirementId: 'x',
      requirementNumber: 'MR',
      requirementStatus: 'PO_SENT',
      orderStatus: 'IN_PRODUCTION',
      allocatedQty,
      receivedQty,
      ...extra,
    }) as PoAllocationLine['links'][number];

  const greige = (over: Partial<PoAllocationLine> = {}): PoAllocationLine =>
    ({
      itemId: 'g',
      located: true,
      orderedStockQty: 10000,
      linkedQty: 3000,
      toComeQty: 6000,
      freeToLink: 7000,
      plainByPlace: [
        { pool: 'STORE', name: 'Our store', qty: 200 },
        { pool: 'mangal', name: 'Mangal', qty: 500 },
        { pool: 'aryan', name: 'Aryan', qty: 300 },
      ],
      links: [link(3000, 1000)],
      candidates: [],
      ...over,
    }) as PoAllocationLine;

  it('reaches our store and its own processor only: 200 + 500 + 6,000 to come − 2,000 owed', () => {
    expect(lineFreeFor(greige(), 'mangal')).toBe(4700);
    expect(lineFreeFor(greige(), 'aryan')).toBe(4500);
  });

  it('an order with no processor yet gets the line figure', () => {
    expect(lineFreeFor(greige(), null)).toBe(7000);
  });

  it('a cancelled order is owed nothing', () => {
    expect(lineFreeFor(greige({ links: [link(3000, 1000, { orderStatus: 'CANCELLED' })] }), 'mangal')).toBe(6700);
  });

  it('never past the line, nor the server figure', () => {
    expect(lineFreeFor(greige({ freeToLink: 1000 }), 'mangal')).toBe(1000);
  });

  it('splitLineOf gives located lines a per-processor room and trims none', () => {
    expect(splitLineOf(greige()).freeFor?.('aryan')).toBe(4500);
    expect(splitLineOf(greige({ located: false })).freeFor).toBeUndefined();
  });
});
