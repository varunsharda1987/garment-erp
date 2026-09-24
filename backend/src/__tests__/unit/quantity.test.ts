/**
 * The one quantity-tolerance rule (utils/quantity.ts). Born from MR2609-0084: 1,340.722 m needed,
 * 1340.72 allocated from a 2-decimal pre-fill, 0.002 m left — "Partially from Stock" for 2 mm —
 * and from the same dialog refusing its own pre-filled 2786.60 against a 2786.598 shortfall.
 */

import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  QTY_EPSILON,
  isQtyZero,
  qtyAtLeast,
  qtyExceeds,
  qtyRemaining,
  snapToLimit,
  prefillQty,
  minQty,
  toQty,
} from '../../utils/quantity';

describe('quantity tolerance', () => {
  it('treats rounding dust as zero, and a real remainder as real', () => {
    expect(isQtyZero(0.002)).toBe(true);
    expect(isQtyZero(new Prisma.Decimal('0.004'))).toBe(true);
    expect(isQtyZero(-0.003)).toBe(true);
    expect(isQtyZero(0.01)).toBe(false);
    expect(isQtyZero(QTY_EPSILON)).toBe(false);
  });

  it('decides "done" and "over" with the tolerance', () => {
    expect(qtyAtLeast(1340.72, 1340.722)).toBe(true); // the MR2609-0084 case
    expect(qtyAtLeast(1340.7, 1340.722)).toBe(false);
    expect(qtyExceeds(2786.6, 2786.598)).toBe(false); // the dialog that refused itself
    expect(qtyExceeds(2791.6, 2786.598)).toBe(true);
    expect(qtyAtLeast(0.1 + 0.2, 0.3)).toBe(true);
    expect(qtyExceeds(0.1 + 0.2, 0.3)).toBe(false);
  });

  it('snaps remainders and typed quantities to the limit', () => {
    expect(qtyRemaining(1340.722, 1340.72)).toBe(0);
    expect(qtyRemaining(1340.722, 1300)).toBe(40.722);
    expect(qtyRemaining(10, 12)).toBe(0);
    expect(snapToLimit(2786.6, 2786.598)).toBe(2786.598);
    expect(snapToLimit(1340.72, 1340.722)).toBe(1340.722);
    expect(snapToLimit(1000, 2786.598)).toBe(1000);
  });

  it('pre-fills the exact amount, never rounded up', () => {
    expect(prefillQty(2786.598)).toBe('2786.598');
    expect(prefillQty(1340.72)).toBe('1340.72');
    expect(prefillQty(new Prisma.Decimal('2550'))).toBe('2550');
    expect(prefillQty(0.1 + 0.2)).toBe('0.3');
    expect(prefillQty(-1)).toBe('0');
    expect(minQty(9810.78, new Prisma.Decimal('2786.598'))).toBe(2786.598);
  });

  it('reads stored values of every shape', () => {
    expect(toQty(null)).toBe(0);
    expect(toQty('')).toBe(0);
    expect(toQty('12.5')).toBe(12.5);
    expect(toQty(new Prisma.Decimal('3.125'))).toBe(3.125);
  });

  it('is identical to its frontend twin', () => {
    const read = (file: string) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const backend = path.resolve(__dirname, '../../utils/quantity.ts');
    const frontend = path.resolve(__dirname, '../../../../frontend/src/lib/quantity.ts');
    expect(read(frontend)).toBe(read(backend));
  });
});
