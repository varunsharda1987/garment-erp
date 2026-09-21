/**
 * Material Ledger — the arithmetic, with no database.
 *
 * The two things worth pinning down here are the ones that would silently produce a plausible
 * but wrong page: direction must come from the transaction TYPE (writers disagree about the sign
 * of `quantity`), and a lot's receipt is derived by balancing back from what is left, because no
 * column reliably records what arrived.
 */

import {
  buildLedger,
  classifyTxn,
  deriveLotReceipts,
  type LedgerEntryKind,
  type LedgerEvent,
  type RawLot,
} from '../material-ledger.service';

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

const lot = (over: Partial<RawLot> & Pick<RawLot, 'id'>): RawLot => ({
  quantityAvailable: 0,
  quantityReserved: 0,
  receivedDate: d('2026-08-01'),
  warehouse: { id: 'wh1', name: 'Main Store' },
  unit: 'meters',
  label: null,
  declaredQty: null,
  source: { type: 'STOCK_IN', number: null, id: null, route: null, party: null, destination: null },
  ...over,
});

const ev = (over: Partial<LedgerEvent> & Pick<LedgerEvent, 'id' | 'direction' | 'qty'>): LedgerEvent => ({
  date: d('2026-08-10'),
  seq: 1,
  kind: 'ISSUE' as LedgerEntryKind,
  unit: 'meters',
  warehouse: { id: 'wh1', name: 'Main Store' },
  lot: { id: 'lot1', label: null },
  source: { type: 'MANUAL', number: null, id: null, route: null, party: null, destination: null },
  remarks: null,
  performedBy: null,
  flags: [],
  ...over,
});

describe('material ledger — classifying a transaction', () => {
  it('reads direction from the type, never from the sign of the quantity', () => {
    // Fabric writers store every quantity positive; greige/lace/thread store OUT as negative.
    expect(classifyTxn('FABRIC', { transactionType: 'CONSUMPTION', referenceType: 'CHALLAN' })).toEqual({
      direction: 'OUT',
      kind: 'ISSUE',
    });
    expect(classifyTxn('GREIGE', { transactionType: 'CONSUMPTION', referenceType: 'CHALLAN' })).toEqual({
      direction: 'OUT',
      kind: 'ISSUE',
    });
    expect(classifyTxn('GREIGE', { transactionType: 'RETURN', referenceType: 'JOB_WORK_ORDER' })).toEqual({
      direction: 'IN',
      kind: 'RETURN',
    });
  });

  it('skips receipt-shaped transactions — the lot row is the receipt', () => {
    expect(classifyTxn('FABRIC', { transactionType: 'STOCK_IN', referenceType: 'GRN' })).toBeNull();
    expect(classifyTxn('LACE', { transactionType: 'STOCK_IN', referenceType: 'GRN' })).toBeNull();
    expect(classifyTxn('THREAD', { transactionType: 'RECEIPT', referenceType: 'GRN' })).toBeNull();
    expect(classifyTxn('FABRIC', { transactionType: 'EMBROIDERY_RECEIPT', referenceType: null })).toBeNull();
  });

  it('skips a fabric TRANSFER, which only relabels the warehouse', () => {
    expect(classifyTxn('FABRIC', { transactionType: 'TRANSFER', referenceType: 'MANUAL' })).toBeNull();
  });

  it('shows a lace reservation as reserve and release, because it moves available stock', () => {
    expect(classifyTxn('LACE', { transactionType: 'ALLOCATION', referenceType: 'ALLOCATION' })).toEqual({
      direction: 'OUT',
      kind: 'RESERVE',
    });
    expect(classifyTxn('LACE', { transactionType: 'RETURN', referenceType: 'ALLOCATION' })).toEqual({
      direction: 'IN',
      kind: 'RELEASE',
    });
  });

  it('skips the lace consumption that only moves reserved into consumed', () => {
    // available is untouched by this one, so counting it would double the earlier RESERVE.
    expect(classifyTxn('LACE', { transactionType: 'CONSUMPTION', referenceType: 'ALLOCATION' })).toBeNull();
    expect(classifyTxn('LACE', { transactionType: 'CONSUMPTION', referenceType: 'ISSUE_NOTE' })).toBeNull();
    expect(classifyTxn('LACE', { transactionType: 'CONSUMPTION', referenceType: 'CHALLAN' })).toEqual({
      direction: 'OUT',
      kind: 'ISSUE',
    });
  });

  it('ignores value-only and grade-only rows', () => {
    expect(classifyTxn('FABRIC', { transactionType: 'PRICE_CORRECTION', referenceType: 'MANUAL' })).toBeNull();
    expect(classifyTxn('FABRIC', { transactionType: 'QUALITY_DOWNGRADE', referenceType: 'MANUAL' })).toBeNull();
  });
});

describe('material ledger — deriving what arrived', () => {
  it('balances back from what is left rather than trusting a consumed column', () => {
    const receipts = deriveLotReceipts(
      [lot({ id: 'lot1', quantityAvailable: 40 })],
      [
        ev({ id: 'a', direction: 'OUT', qty: 20 }),
        ev({ id: 'b', direction: 'OUT', qty: 30 }),
        ev({ id: 'c', direction: 'OUT', qty: 10 }),
      ]
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].qty).toBe(100);
    expect(receipts[0].direction).toBe('IN');
    expect(receipts[0].kind).toBe('RECEIPT');
  });

  it('makes the closing balance equal what the stock pages show', () => {
    const movements = [
      ev({ id: 'a', direction: 'OUT', qty: 20 }),
      ev({ id: 'b', direction: 'IN', qty: 5, kind: 'RETURN' }),
    ];
    const lots = [lot({ id: 'lot1', quantityAvailable: 85 })];
    const { closing } = buildLedger([...movements, ...deriveLotReceipts(lots, movements)], {});
    expect(closing).toBe(85);
  });

  it('never dates a receipt after its own issues, even when the entry was backdated', () => {
    // Stock In lets you set an arrival date in the past while its movements are stamped now.
    const receipts = deriveLotReceipts(
      [lot({ id: 'lot1', quantityAvailable: 10, receivedDate: d('2026-09-30') })],
      [ev({ id: 'a', direction: 'OUT', qty: 5, date: d('2026-09-02') })]
    );
    expect(receipts[0].date).toEqual(d('2026-09-02'));
  });

  it('flags a lot whose movements exceed anything it could have received', () => {
    const receipts = deriveLotReceipts(
      [lot({ id: 'lot1', quantityAvailable: -30 })],
      [ev({ id: 'a', direction: 'IN', qty: 10, kind: 'RETURN' })]
    );
    expect(receipts[0].qty).toBeLessThan(0);
    expect(receipts[0].flags.join(' ')).toContain('negative');
  });

  it('says a movement may be missing when less is accounted for than was received', () => {
    const receipts = deriveLotReceipts([lot({ id: 'lot1', quantityAvailable: 95, declaredQty: 100 })], []);
    expect(receipts[0].qty).toBe(95);
    expect(receipts[0].flags.join(' ')).toContain('may be missing');
  });

  it('says a movement may be counted twice when more is needed to balance than was received', () => {
    // The live shape of this is GRG-0006: challan transfers once wrote a TRANSFER_OUT alongside
    // their CONSUMPTION row, so one 500 m challan reads as 1000 m leaving.
    const receipts = deriveLotReceipts(
      [lot({ id: 'lot1', quantityAvailable: 4883.14, declaredQty: 5383.14 })],
      [
        ev({ id: 'consume', direction: 'OUT', qty: 500 }),
        ev({ id: 'transfer', direction: 'OUT', qty: 500, kind: 'TRANSFER' }),
      ]
    );
    expect(receipts[0].qty).toBe(5883.14);
    expect(receipts[0].flags.join(' ')).toContain('counted twice');
  });

  it('folds movements with no lot recorded into the oldest lot, and says so', () => {
    // A fabric Stock Out deducts lots FIFO but records no lot id; without this the receipts would
    // be short by that amount and the ledger would stop tying to on-hand.
    const lots = [
      lot({ id: 'old', quantityAvailable: 20, receivedDate: d('2026-07-01') }),
      lot({ id: 'new', quantityAvailable: 50, receivedDate: d('2026-08-01') }),
    ];
    const lotless = ev({ id: 'm', direction: 'OUT', qty: 30, lot: null });
    const receipts = deriveLotReceipts(lots, [lotless], -30);

    const older = receipts.find((r) => r.lot?.id === 'old')!;
    expect(older.qty).toBe(50); // 20 available + the 30 that left without a lot
    expect(older.flags.join(' ')).toContain('never recorded');
    expect(receipts.find((r) => r.lot?.id === 'new')!.qty).toBe(50);

    const { closing } = buildLedger([lotless, ...receipts], {});
    expect(closing).toBe(70); // equals 20 + 50 still on the shelf
  });
});

describe('material ledger — the running balance', () => {
  const events = [
    ev({ id: 'r', direction: 'IN', qty: 100, kind: 'RECEIPT', seq: 0, date: d('2026-08-05') }),
    ev({ id: 'i1', direction: 'OUT', qty: 40, date: d('2026-08-20') }),
    ev({ id: 'i2', direction: 'OUT', qty: 25, date: d('2026-09-10') }),
    ev({ id: 'ret', direction: 'IN', qty: 15, kind: 'RETURN', date: d('2026-09-18') }),
  ];

  it('runs the balance down the rows', () => {
    const { rows, closing, totalIn, totalOut } = buildLedger(events, {});
    expect(rows.map((r) => r.balance)).toEqual([100, 60, 35, 50]);
    expect(totalIn).toBe(115);
    expect(totalOut).toBe(65);
    expect(closing).toBe(50);
  });

  it('puts everything before the window into an opening balance', () => {
    const { opening, rows, closing } = buildLedger(events, { from: d('2026-09-01'), to: d('2026-09-30') });
    expect(opening).toBe(60); // 100 received less 40 issued in August
    expect(rows.map((r) => r.id)).toEqual(['i2', 'ret']);
    expect(rows.map((r) => r.balance)).toEqual([35, 50]);
    expect(closing).toBe(50);
  });

  it('reports no opening balance when no start date was asked for', () => {
    expect(buildLedger(events, {}).opening).toBeNull();
  });

  it('includes both edges of the window as whole days', () => {
    const { rows } = buildLedger(events, { from: d('2026-08-20'), to: d('2026-09-10') });
    expect(rows.map((r) => r.id)).toEqual(['i1', 'i2']);
  });

  it('sorts a receipt before the issues it paid for on the same day', () => {
    const sameDay = [
      ev({ id: 'issue', direction: 'OUT', qty: 10, seq: 1, date: d('2026-08-05') }),
      ev({ id: 'receipt', direction: 'IN', qty: 30, kind: 'RECEIPT', seq: 0, date: d('2026-08-05') }),
    ];
    const { rows } = buildLedger(sameDay, {});
    expect(rows.map((r) => r.id)).toEqual(['receipt', 'issue']);
    expect(rows.map((r) => r.balance)).toEqual([30, 20]);
  });

  it('recomputes the opening balance for the warehouse being filtered to', () => {
    const other = { id: 'wh2', name: 'Unit 2' };
    const mixed = [
      ev({ id: 'a', direction: 'IN', qty: 100, kind: 'RECEIPT', seq: 0, date: d('2026-08-01') }),
      ev({ id: 'b', direction: 'IN', qty: 60, kind: 'RECEIPT', seq: 0, date: d('2026-08-02'), warehouse: other }),
      ev({ id: 'c', direction: 'OUT', qty: 10, date: d('2026-09-05'), warehouse: other }),
    ];
    const { opening, rows, closing } = buildLedger(mixed, {
      from: d('2026-09-01'),
      to: d('2026-09-30'),
      warehouseId: 'wh2',
    });
    expect(opening).toBe(60); // the Main Store receipt is not this warehouse's business
    expect(rows.map((r) => r.id)).toEqual(['c']);
    expect(closing).toBe(50);
  });
});
