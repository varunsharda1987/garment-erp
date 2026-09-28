/**
 * Allocating a sent PO to running orders — the pure rules (docs/plans/po-allocation-design.md §4, §6.4, §8).
 *
 * Free to link (C6): trims reduce to ordered − allocated; a greige line split across dyers reaches only the
 * pools a link may draw on; never past what the line orders. The default split fills the earliest need first.
 * And every reason a line, a requirement or an Undo is refused, in the words the dialog shows.
 */

import {
  compareFillPriority,
  heldForEntries,
  isDyerServed,
  lineDeliveryHolders,
  lineFigures,
  lineLinkBlock,
  linkUndoBlock,
  poLinkBlock,
  requirementLinkBlock,
  sizeLinksForLine,
  suggestAllocations,
  type FillPriorityKey,
  type LineFigureSource,
  type RequirementLinkFacts,
  type LineLinkFacts,
  type SuggestCandidate,
  type SuggestLine,
  type UndoFacts,
} from '../../services/helpers/po-allocation.helper';
import { STORE_POOL, UNPLACED_POOL } from '../../services/helpers/receipt-split.helper';
import { fillAllocation, unreceivedStatus } from '../../services/helpers/receipt-allocation.helper';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const key = (over: Partial<FillPriorityKey> = {}): FillPriorityKey => ({
  orderDeliveryDate: null,
  requiredDate: null,
  orderNumber: null,
  requirementNumber: null,
  ...over,
});

const trimLine = (over: Partial<LineFigureSource> = {}): LineFigureSource => ({
  kind: 'untracked',
  orderedStock: 4530,
  arrived: 0,
  credited: 0,
  allocated: 0,
  plainStock: {},
  toCome: 4530,
  uncredited: 0,
  held: 0,
  ...over,
});

describe('compareFillPriority — earliest need first', () => {
  it('orders by delivery date, then required date, order number, requirement number; nulls last', () => {
    const rows = [
      { id: 'noOrder', ...key({ requiredDate: d('2026-10-01'), requirementNumber: 'MR-9' }) },
      { id: 'late', ...key({ orderDeliveryDate: d('2026-11-05'), orderNumber: 'ORD-030', requirementNumber: 'MR-1' }) },
      {
        id: 'early',
        ...key({ orderDeliveryDate: d('2026-10-10'), orderNumber: 'ORD-029', requirementNumber: 'MR-5' }),
      },
      {
        id: 'lateB',
        ...key({ orderDeliveryDate: d('2026-11-05'), orderNumber: 'ORD-031', requirementNumber: 'MR-0' }),
      },
      {
        id: 'lateEarlyNeed',
        ...key({
          orderDeliveryDate: d('2026-11-05'),
          requiredDate: d('2026-10-01'),
          orderNumber: 'ORD-099',
          requirementNumber: 'MR-7',
        }),
      },
    ];
    expect(rows.sort(compareFillPriority).map((r) => r.id)).toEqual([
      'early',
      'lateEarlyNeed',
      'late',
      'lateB',
      'noOrder',
    ]);
  });

  it('breaks a full tie on requirement number', () => {
    const a = key({ orderDeliveryDate: d('2026-10-10'), orderNumber: 'ORD-1', requirementNumber: 'MR-2' });
    const b = key({ orderDeliveryDate: d('2026-10-10'), orderNumber: 'ORD-1', requirementNumber: 'MR-1' });
    expect(compareFillPriority(a, b)).toBeGreaterThan(0);
    expect(compareFillPriority(a, a)).toBe(0);
  });
});

describe('lineFigures — free to link (C6)', () => {
  it('trims, nothing arrived: ordered − allocated', () => {
    const fig = lineFigures(trimLine({ allocated: 2941, uncredited: 2941 }));
    expect(fig.freeToLink).toBe(1589);
    expect(fig.plainReachable).toBe(0);
  });

  it('trims, part arrived and credited earliest first: still ordered − allocated', () => {
    // 3,500 arrived, 2,941 linked and credited in full → 559 plain, 1,030 to come
    const fig = lineFigures(
      trimLine({ arrived: 3500, credited: 2941, allocated: 2941, plainStock: { [STORE_POOL]: 559 }, toCome: 1030 })
    );
    expect(fig.plain).toBe(559);
    expect(fig.plainReachable).toBe(559);
    expect(fig.freeToLink).toBe(1589);
  });

  it('trims, a cancelled order issued part and let the rest go: ordered − its issued − live allocations', () => {
    // 1,000 ordered, 600 arrived; the cancelled link keeps the 100 it issued; the live link has 300 of its 400
    const fig = lineFigures(
      trimLine({
        orderedStock: 1000,
        arrived: 600,
        credited: 400,
        allocated: 400,
        plainStock: { [STORE_POOL]: 200 },
        toCome: 400,
        uncredited: 100,
      })
    );
    expect(fig.freeToLink).toBe(500);
  });

  it('never past what the line orders — an over-receipt is plain stock for Use Stock', () => {
    const fig = lineFigures(
      trimLine({
        orderedStock: 1000,
        arrived: 1100,
        credited: 1000,
        allocated: 1000,
        plainStock: { [STORE_POOL]: 100 },
        toCome: 0,
      })
    );
    expect(fig.plainReachable).toBe(100);
    expect(fig.freeToLink).toBe(0);
  });

  it('greige split across dyers: each processor reaches its own pool and the store; no processor reaches all', () => {
    const greige: LineFigureSource = {
      kind: 'lot-greige',
      orderedStock: 10000,
      arrived: 3000,
      credited: 2000,
      allocated: 5000,
      plainStock: { A: 600, B: 300, [STORE_POOL]: 100, [UNPLACED_POOL]: 0 },
      toCome: 7000,
      uncredited: 3000,
      held: 2000,
    };
    expect(lineFigures(greige, 'A').plainReachable).toBe(700);
    expect(lineFigures(greige, 'B').plainReachable).toBe(400);
    expect(lineFigures(greige, null).plainReachable).toBe(1000);
    expect(lineFigures(greige, 'A').freeToLink).toBe(4700);
    expect(lineFigures(greige, 'B').freeToLink).toBe(4400);
    // capped by the line: 10,000 − 5,000
    expect(lineFigures(greige, null).freeToLink).toBe(5000);
  });

  it('cloth in a unit linked to no processor reaches nobody', () => {
    const fig = lineFigures(
      {
        kind: 'lot-lace',
        orderedStock: 500,
        arrived: 200,
        credited: 0,
        allocated: 0,
        plainStock: { [UNPLACED_POOL]: 200 },
        toCome: 300,
        uncredited: 0,
        held: 0,
      },
      null
    );
    expect(fig.plainReachable).toBe(0);
    expect(fig.freeToLink).toBe(300);
  });
});

describe('suggestAllocations — the default split', () => {
  const cand = (id: string, need: number, deliver: string, over: Partial<SuggestCandidate> = {}): SuggestCandidate => ({
    ...key({ orderDeliveryDate: d(deliver), orderNumber: `ORD-${id}`, requirementNumber: `MR-${id}` }),
    requirementId: id,
    need,
    linkable: true,
    ...over,
  });

  it('gives every order its full need, earliest first, the last one reached gets part', () => {
    const s = suggestAllocations([
      {
        itemId: 'XS',
        freeToLink: 1000,
        candidates: [
          cand('c', 400, '2026-10-30'),
          cand('a', 350, '2026-10-10'),
          cand('b', 322, '2026-10-20'),
          cand('d', 75, '2026-11-01'),
        ],
      },
    ]);
    expect(Object.fromEntries([...s].map(([id, v]) => [id, v.qty]))).toEqual({ a: 350, b: 322, c: 328 });
  });

  it('skips blocked rows, floors dust, and suggests a requirement on one line only', () => {
    const s = suggestAllocations([
      {
        itemId: 'L1',
        freeToLink: 100.0004,
        candidates: [cand('x', 60, '2026-10-01', { linkable: false }), cand('y', 100.0009, '2026-10-02')],
      },
      { itemId: 'L2', freeToLink: 500, candidates: [cand('y', 100.0009, '2026-10-02'), cand('z', 10, '2026-10-05')] },
    ]);
    expect(s.get('x')).toBeUndefined();
    expect(s.get('y')).toEqual({ itemId: 'L1', qty: 100 });
    expect(s.get('z')).toEqual({ itemId: 'L2', qty: 10 });
  });

  it('greige: a link at one processor is capped by what that processor can reach', () => {
    const s = suggestAllocations([
      {
        itemId: 'G',
        freeToLink: 1000,
        freeFor: (dyer) => (dyer === 'A' ? 300 : 1000),
        candidates: [cand('a1', 500, '2026-10-01', { dyer: 'A' }), cand('n1', 500, '2026-10-02', { dyer: null })],
      },
    ]);
    expect(s.get('a1')?.qty).toBe(300);
    expect(s.get('n1')?.qty).toBe(500);
  });

  it('prefers a line of its own colour that takes its whole need — whichever line sorts first', () => {
    const plain: Omit<SuggestLine, 'candidates'> = { itemId: 'plain', freeToLink: 1000, colorName: null };
    const red: Omit<SuggestLine, 'candidates'> = { itemId: 'red', freeToLink: 500, colorName: 'Red' };
    const candidates = [
      cand('r1', 300, '2026-10-10'),
      cand('r2', 300, '2026-10-20'),
      cand('r3', 500, '2026-10-30'),
      cand('rRed', 200, '2026-11-05', { colorName: 'Red' }),
    ];
    const split = (order: Array<Omit<SuggestLine, 'candidates'>>) =>
      Object.fromEntries(
        [...suggestAllocations(order.map((l) => ({ ...l, candidates })))].map(([id, v]) => [id, `${v.itemId}:${v.qty}`])
      );
    const expected = {
      r1: 'plain:300',
      r2: 'plain:300',
      // 400 left on its own line: whole on the Red line (it may go there) rather than a part cover
      r3: 'red:500',
      // Red is full; the last 200 of the plain line cover it whole
      rRed: 'plain:200',
    };
    expect(split([plain, red])).toEqual(expected);
    expect(split([red, plain])).toEqual(expected);
  });

  it('part-covers only when no line can take the whole need — its own colour first, then the most room', () => {
    const s = suggestAllocations([
      { itemId: 'small', freeToLink: 100, colorName: null, candidates: [cand('x', 400, '2026-10-01')] },
      { itemId: 'big', freeToLink: 250, colorName: null, candidates: [cand('x', 400, '2026-10-01')] },
      { itemId: 'blue', freeToLink: 300, colorName: 'Blue', candidates: [cand('x', 400, '2026-10-01')] },
    ]);
    expect(s.get('x')).toEqual({ itemId: 'big', qty: 250 });
  });
});

describe('fillAllocation — a finished order takes no more of the line (D11)', () => {
  it('a running order takes its whole link', () => {
    expect(fillAllocation(300, 100, 0, 'IN_PRODUCTION')).toBe(300);
    expect(fillAllocation(300, 0, 0, null)).toBe(300);
  });

  it('a completed or dispatched order keeps what it was credited, or issued if more — never more than its link', () => {
    expect(fillAllocation(300, 100, 0, 'COMPLETED')).toBe(100);
    expect(fillAllocation(300, 100, 150, 'DISPATCHED')).toBe(150);
    expect(fillAllocation(300, 400, 0, 'COMPLETED')).toBe(300);
    expect(fillAllocation(300, 0, 0, 'COMPLETED')).toBe(0);
  });
});

describe('unreceivedStatus — a requirement with nothing received', () => {
  it('is PO_GENERATED while every PO it is on is a draft, and a PO_GENERATED row stays so', () => {
    expect(unreceivedStatus('PO_GENERATED', ['DRAFT'])).toBe('PO_GENERATED');
    expect(unreceivedStatus('PO_SENT', ['DRAFT'])).toBe('PO_GENERATED');
    expect(unreceivedStatus('PO_GENERATED', ['SENT'])).toBe('PO_GENERATED');
  });

  it('is PO_SENT once a PO it is on has gone out', () => {
    expect(unreceivedStatus('PARTIALLY_RECEIVED', ['SENT'])).toBe('PO_SENT');
    expect(unreceivedStatus('RECEIVED', ['DRAFT', 'PARTIALLY_RECEIVED'])).toBe('PO_SENT');
  });
});

describe('heldForEntries — who holds the goods, as the take-held dialog reads it', () => {
  it('one entry per holding requirement, its Use Stock and receipt holds added together', () => {
    const base = { orderId: 'o1', orderNumber: 'ORD1', styleCode: 'ST1', poLinkId: null, lotId: null, unit: 'PIECE' };
    expect(
      heldForEntries([
        { ...base, reservationId: 'h1', requirementId: 'r1', requirementNumber: 'MR1', kind: 'stock', qty: 40 },
        { ...base, reservationId: 'h2', requirementId: 'r1', requirementNumber: 'MR1', kind: 'receipt', qty: 60.5 },
        {
          ...base,
          reservationId: 'h3',
          requirementId: 'r2',
          requirementNumber: 'MR2',
          orderNumber: null,
          styleCode: null,
          kind: 'receipt',
          qty: 10,
        },
      ])
    ).toEqual([
      { requirementNumber: 'MR1', orderNumber: 'ORD1', styleCode: 'ST1', qty: 100.5, unit: 'PIECE' },
      { requirementNumber: 'MR2', orderNumber: null, styleCode: null, qty: 10, unit: 'PIECE' },
    ]);
  });
});

describe('sizeLinksForLine', () => {
  it('each requirement its need when the line covers them all — the excess stays free (16 gross for 2,300)', () => {
    const m = sizeLinksForLine(2304, [
      { id: 'a', need: 1300 },
      { id: 'b', need: 1000 },
    ]);
    expect([...m.values()]).toEqual([1300, 1000]);
  });

  it('pro-rata when the line is smaller, never above a need, together exactly the line', () => {
    const m = sizeLinksForLine(100, [
      { id: 'a', need: 100 },
      { id: 'b', need: 100 },
      { id: 'c', need: 100 },
    ]);
    expect([...m.values()]).toEqual([33.333, 33.333, 33.334]);
  });
});

describe('why a PO or a line cannot be linked', () => {
  const po = { poNumber: 'PO2609-0231', status: 'SENT', poCategory: 'ACCESSORIES', isActive: true };
  const line = { materialId: 'm', materialType: 'LABEL', fitsCategory: true, pendingQcGrnNumber: null };

  it.each([
    [{ ...po, status: 'DRAFT' }, /only a sent PO/],
    [{ ...po, status: 'CANCELLED' }, /is cancelled/],
    [{ ...po, status: 'RECEIVED' }, /is received/],
    [{ ...po, poCategory: 'FABRIC' }, /fabric PO/],
    [{ ...po, poCategory: 'PROCESSING' }, /processing PO/],
    [{ ...po, isActive: false }, /deleted/],
  ])('%o', (p, reason) => {
    expect(poLinkBlock(p)).toMatch(reason);
  });

  it('sent, acknowledged and part received POs of the linkable categories are open', () => {
    for (const status of ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED']) {
      for (const poCategory of ['ACCESSORIES', 'TRIMS', 'GENERAL', 'GREIGE', 'LACE', 'GREIGE_LACE']) {
        expect(poLinkBlock({ ...po, status, poCategory })).toBeNull();
      }
    }
  });

  it.each([
    [{ ...line, materialId: null }, /service line/],
    [{ ...line, materialType: 'THREAD' }, /thread lines/],
    [{ ...line, materialType: 'FABRIC' }, /fabric lines/],
    [{ ...line, fitsCategory: false }, /does not belong/],
    [{ ...line, pendingQcGrnNumber: 'GRN-7' }, /GRN-7 .*awaiting QC/],
  ])('line %o', (l, reason) => {
    expect(lineLinkBlock(po, l)).toMatch(reason);
  });
  it('a good line on an open PO is linkable', () => expect(lineLinkBlock(po, line)).toBeNull());
});

describe('why a requirement cannot be linked to a line', () => {
  const req: RequirementLinkFacts = {
    requirementNumber: 'MR-1',
    status: 'PO_REQUIRED',
    requirementType: 'MATERIAL',
    materialId: 'm',
    colorName: 'Navy Blue',
    unit: 'PIECE',
    orderId: 'o',
    orderNumber: 'ORD-1',
    orderStatus: 'IN_PRODUCTION',
    linkedTo: [],
  };
  const line: LineLinkFacts = {
    materialId: 'm',
    stockUnit: 'PIECE',
    colorName: 'navy  blue',
    poCategory: 'ACCESSORIES',
  };

  it('a matching PO_REQUIRED / PARTIAL_STOCK row of a running (or no) order is linkable', () => {
    expect(requirementLinkBlock(req, line)).toBeNull();
    expect(requirementLinkBlock({ ...req, status: 'PARTIAL_STOCK' }, line)).toBeNull();
    expect(requirementLinkBlock({ ...req, orderId: null, orderNumber: null, orderStatus: null }, line)).toBeNull();
    expect(requirementLinkBlock({ ...req, orderStatus: 'PENDING' }, line)).toBeNull();
  });

  it.each([
    [{ status: 'SIZE_PENDING' }, /size breakdown/],
    [{ status: 'DECISION_PENDING' }, /Order the extra/],
    [{ status: 'PO_GENERATED', linkedTo: ['PO2609-0100'] }, /already on PO2609-0100/],
    [{ status: 'FULFILLED_STOCK' }, /fulfilled stock/],
    [{ requirementType: 'PROCESSING' }, /processing requirement/],
    [{ materialId: 'other' }, /different material/],
    [{ colorName: 'Maroon' }, /is for Maroon, this line is navy {2}blue/],
    [{ unit: 'METER' }, /counted in m, this line's material in pcs/],
    [{ linkedTo: ['DJ-1'] }, /already on DJ-1/],
    [{ orderStatus: 'COMPLETED' }, /ORD-1 is completed/],
    [{ orderStatus: 'CANCELLED' }, /ORD-1 is cancelled/],
  ])('%o', (over, reason) => {
    expect(requirementLinkBlock({ ...req, ...over }, line)).toMatch(reason);
  });

  it('colour is not compared on greige and greige lace, nor when either side has none', () => {
    expect(requirementLinkBlock({ ...req, colorName: 'Maroon' }, { ...line, poCategory: 'GREIGE' })).toBeNull();
    expect(requirementLinkBlock({ ...req, colorName: 'Maroon' }, { ...line, poCategory: 'GREIGE_LACE' })).toBeNull();
    expect(requirementLinkBlock({ ...req, colorName: null }, line)).toBeNull();
    expect(requirementLinkBlock({ ...req, colorName: 'Maroon' }, { ...line, poCategory: 'LACE' })).toMatch(/Maroon/);
  });

  it('greige: the order must be dyed where the line delivers, or the line delivers to our store', () => {
    const names = new Map([
      ['MANGAL', 'Mangal Dyeing'],
      ['ARYAN', 'Aryan Prints'],
    ]);
    const g = { ...line, poCategory: 'GREIGE', holders: ['MANGAL'] };
    expect(requirementLinkBlock(req, g, 'MANGAL', names)).toBeNull();
    expect(requirementLinkBlock(req, g, null, names)).toBeNull();
    expect(requirementLinkBlock(req, g, 'ARYAN', names)).toMatch(
      /dyed at Aryan Prints, but this line delivers to Mangal Dyeing/
    );
    expect(requirementLinkBlock(req, { ...g, holders: [STORE_POOL] }, 'ARYAN', names)).toBeNull();
    expect(requirementLinkBlock(req, { ...g, holders: null }, 'ARYAN', names)).toBeNull();
    expect(requirementLinkBlock(req, { ...g, holders: [UNPLACED_POOL] }, null, names)).toMatch(/cannot be placed/);
  });
});

describe('lineDeliveryHolders', () => {
  const store = { warehouseType: 'RAW_MATERIAL', supplierId: null };
  const mangal = { warehouseType: 'JOB_WORK', supplierId: 'MANGAL' };
  const orphan = { warehouseType: 'JOB_WORK', supplierId: null };

  it('split PO: the points carrying this line', () => {
    const plan = {
      deliveryWarehouse: store,
      deliveryPoints: [
        { warehouse: store, lines: [{ poItemId: 'L1' }] },
        { warehouse: mangal, lines: [{ poItemId: 'L1' }, { poItemId: 'L2' }] },
        { warehouse: orphan, lines: [{ poItemId: 'L3' }] },
      ],
    };
    expect(lineDeliveryHolders(plan, 'L1')).toEqual(['MANGAL', STORE_POOL]);
    expect(lineDeliveryHolders(plan, 'L2')).toEqual(['MANGAL']);
    expect(lineDeliveryHolders(plan, 'L3')).toEqual([UNPLACED_POOL]);
    expect(lineDeliveryHolders(plan, 'L9')).toBeNull();
  });

  it('one place, or to be advised', () => {
    expect(lineDeliveryHolders({ deliveryWarehouse: mangal, deliveryPoints: [] }, 'L1')).toEqual(['MANGAL']);
    expect(lineDeliveryHolders({ deliveryWarehouse: null, deliveryPoints: [] }, 'L1')).toBeNull();
  });

  it('isDyerServed', () => {
    expect(isDyerServed(null, 'X')).toBe(true);
    expect(isDyerServed([STORE_POOL], 'X')).toBe(true);
    expect(isDyerServed(['MANGAL'], 'MANGAL')).toBe(true);
    expect(isDyerServed(['MANGAL'], 'ARYAN')).toBe(false);
    expect(isDyerServed(['MANGAL'], null)).toBe(true);
    expect(isDyerServed([UNPLACED_POOL], null)).toBe(false);
  });
});

describe('linkUndoBlock — undo until goods arrive for it', () => {
  const f: UndoFacts = {
    poNumber: 'PO-1',
    poStatus: 'SENT',
    pendingQcGrnNumber: null,
    requirementStatus: 'PO_SENT',
    credit: 0,
    issued: 0,
    held: 0,
    unit: 'PIECE',
    otherLinks: [],
  };
  it('a link with nothing arrived on an open PO can be undone', () => {
    expect(linkUndoBlock(f)).toBeNull();
    expect(linkUndoBlock({ ...f, requirementStatus: 'PO_GENERATED', poStatus: 'PARTIALLY_RECEIVED' })).toBeNull();
    expect(linkUndoBlock({ ...f, credit: 0.002 })).toBeNull();
  });
  it.each([
    [{ poStatus: 'SHORT_CLOSED' }, /short closed/],
    [{ credit: 400 }, /400 pcs already arrived/],
    [{ issued: 20, credit: 20 }, /20 pcs of it was already issued/],
    [{ held: 5 }, /held for this order/],
    [{ pendingQcGrnNumber: 'GRN-9' }, /GRN-9/],
    [{ requirementStatus: 'PARTIALLY_RECEIVED' }, /partially received/],
    [{ otherLinks: ['PO-2'] }, /also covered by PO-2/],
  ])('%o', (over, reason) => {
    expect(linkUndoBlock({ ...f, ...over })).toMatch(reason);
  });
});
