/**
 * The Receive page's rules: one delivery from a processor, a row per colour (lib/jwo-receive.ts).
 * PJ-ESSKY090LS-002: Brown 2,425.21 m and Red 3,030 m expected back, 3% tolerance.
 */
import { describe, expect, it } from 'vitest';
import {
  checkRow,
  deliveryClosesJob,
  deliveryPayload,
  emptyReceiveRow,
  rowActual,
  rowIsFinal,
  type ReceiveLine,
  type ReceiveRow,
} from '@/lib/jwo-receive';

const brown: ReceiveLine = { id: 'brown', lineNo: 1, qtyExpected: 2425.21, receivedQty: 0, closedAt: null };
const red: ReceiveLine = { id: 'red', lineNo: 2, qtyExpected: 3030, receivedQty: 0, closedAt: null };
const TOL = 3;
const row = (lineId: string, patch: Partial<ReceiveRow>): ReceiveRow => ({ ...emptyReceiveRow(lineId), ...patch });
const opts = (maxReceivable: number | null) => ({ isLace: false, maxReceivable, tolerancePercent: TOL, unit: 'm' });

describe('a colour of the delivery', () => {
  it('stocks the actual metres at a fold under 100 cm, and the sum of the pieces in piece modes', () => {
    expect(rowActual(row('brown', { qtyMeters: 1000, foldLengthCm: 98 }))).toBeCloseTo(980, 2);
    const pieces = row('brown', {
      entryMode: 'ROLL_WISE',
      pieces: [
        { baleNumber: null, meters: 100 },
        { baleNumber: null, meters: 120.5 },
      ],
    });
    expect(rowActual(pieces)).toBeCloseTo(220.5, 2);
  });

  it('ticks Final once the colour reaches its expected quantity less the tolerance — until it is clicked', () => {
    expect(rowIsFinal(row('brown', { qtyMeters: 2400 }), brown, TOL)).toBe(true);
    expect(rowIsFinal(row('brown', { qtyMeters: 1200 }), brown, TOL)).toBe(false);
    expect(rowIsFinal(row('brown', { qtyMeters: 1200, finalOverride: true }), brown, TOL)).toBe(true);
    // No expected quantity: never final by itself, only when ticked
    expect(rowIsFinal(row('brown', { qtyMeters: 2400 }), { ...brown, qtyExpected: null }, TOL)).toBe(false);
    expect(
      rowIsFinal(row('brown', { qtyMeters: 2400, finalOverride: true }), { ...brown, qtyExpected: null }, TOL)
    ).toBe(true);
    // An earlier part counts towards it
    expect(rowIsFinal(row('brown', { qtyMeters: 1300 }), { ...brown, receivedQty: 1100 }, TOL)).toBe(true);
  });

  it('blocks a colour with no width or over its maximum, and notes a final that is short', () => {
    expect(checkRow(row('red', { qtyMeters: 3000 }), red, opts(3333)).problems).toEqual(['Measure the width']);
    expect(checkRow(row('red', { qtyMeters: 3400, widthInches: 54 }), red, opts(3333)).problems[0]).toMatch(
      /at most 3333\.00 m more/
    );
    const short = checkRow(row('red', { qtyMeters: 2000, widthInches: 54, finalOverride: true }), red, opts(3333));
    expect(short.problems).toEqual([]);
    expect(short.shortBy).toBe(1030);
    // A colour that did not come is not checked at all
    expect(checkRow(emptyReceiveRow('red'), red, opts(3333))).toEqual({ problems: [], shortBy: null });
  });
});

describe('the delivery', () => {
  it('closes the job only when every open colour comes on it marked final', () => {
    const both = [row('brown', { qtyMeters: 2420 }), row('red', { qtyMeters: 3000 })];
    expect(deliveryClosesJob([brown, red], both, TOL)).toBe(true);
    expect(deliveryClosesJob([brown, red], [row('brown', { qtyMeters: 2420 })], TOL)).toBe(false);
    expect(
      deliveryClosesJob([brown, red], [row('brown', { qtyMeters: 2420 }), row('red', { qtyMeters: 1000 })], TOL)
    ).toBe(false);
    // Brown already complete: the Red alone closes it
    const brownDone = { ...brown, receivedQty: 2425.21, closedAt: '2026-09-20' };
    expect(deliveryClosesJob([brownDone, red], [row('red', { qtyMeters: 3000 })], TOL)).toBe(true);
  });

  it('sends the truck once and only the colours that came, each with its own figures', () => {
    const payload = deliveryPayload(
      {
        jobWorkOrderId: 'job',
        receivedDate: '2026-10-02',
        receivedChallan: ' PC-771 ',
        invoiceNumber: 'ignored',
        invoiceDate: '2026-10-01',
        invoiceToFollow: true,
        toProcessor: false,
        warehouseId: 'store',
        vehicle: '',
      },
      [
        row('brown', { qtyMeters: 1200, widthInches: 54.5, thanCount: 12 }),
        emptyReceiveRow('red'),
        row('ghost', { qtyMeters: 5 }),
      ],
      [brown, red],
      { tolerancePercent: TOL, submissionKey: 'key-123456', shortCloseConfirmed: false }
    );
    expect(payload).toMatchObject({
      jobWorkOrderId: 'job',
      receivedChallan: 'PC-771',
      invoiceToFollow: true,
      warehouseId: 'store',
      submissionKey: 'key-123456',
    });
    expect(payload).not.toHaveProperty('invoiceNumber');
    expect(payload.shortCloseConfirmed).toBeUndefined();
    expect(payload.lines).toEqual([
      expect.objectContaining({
        lineId: 'brown',
        qtyReceivedMeters: 1200,
        thanCount: 12,
        receivedWidthInches: 54.5,
        isFinal: false,
      }),
    ]);
  });

  it('sends a bale-wise colour as its pieces, with the processor’s tags', () => {
    const payload = deliveryPayload(
      {
        jobWorkOrderId: 'job',
        receivedDate: '2026-10-02',
        receivedChallan: '',
        invoiceNumber: 'MT/118',
        invoiceDate: '2026-10-01',
        invoiceToFollow: false,
        toProcessor: true,
        warehouseId: 'unit',
        vehicle: 'RJ14 AB 1234',
      },
      [
        row('red', {
          entryMode: 'BALE_WISE',
          widthInches: 54,
          pieces: [{ baleNumber: 1, meters: 60, baleNo: 'B7', thanNo: 'T1' }],
          finalOverride: false,
        }),
      ],
      [brown, red],
      { tolerancePercent: TOL, submissionKey: 'key-123456', shortCloseConfirmed: true }
    );
    expect(payload).toMatchObject({
      invoiceNumber: 'MT/118',
      deliveredToProcessor: true,
      vehicleNumber: 'RJ14 AB 1234',
      shortCloseConfirmed: true,
    });
    expect(payload.lines[0]).toMatchObject({
      entryMode: 'BALE_WISE',
      details: [{ detailType: 'THAN', baleNumber: 1, sequenceNo: 1, meters: 60, baleNo: 'B7', thanNo: 'T1' }],
      isFinal: false,
    });
    expect(payload.lines[0]).not.toHaveProperty('qtyReceivedMeters');
  });
});
