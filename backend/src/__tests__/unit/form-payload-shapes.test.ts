/**
 * Form-payload shape tests — "does the schema accept what the screen actually posts?"
 *
 * HTML inputs post numbers as strings and '' when blank; validateBody parses strictly. A plain
 * z.number() in supplierAssociationSchema therefore 400'd every trim-master save that carried a
 * supplier row on six of seven forms, and the thread form's ply (a Prisma enum) was declared as a
 * number (found 2026-09-10 via scripts/skills/validation-rejections.js). These tests parse the
 * EXACT shapes the forms send. No database.
 */
import { z } from 'zod';
import { formNumber } from '../../schemas/common.schema';
import { createPackagingSchema, createThreadSchema, createZipperSchema } from '../../schemas/trimMasters.schema';

const SUPPLIER_ID = '11111111-1111-4111-8111-111111111111';

describe('formNumber — numeric field as posted by an HTML form', () => {
  const schema = z.object({ v: formNumber(z.number().nonnegative()) });

  it.each([
    ['12.50', 12.5],
    ['', null],
    [' 3 ', 3],
    ['0', 0],
    [0, 0],
    [7, 7],
    [null, null],
  ])('%p → %p', (input, expected) => {
    const r = schema.safeParse({ v: input });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.v).toBe(expected);
  });

  it('leaves an absent key absent', () => {
    const r = schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect('v' in r.data).toBe(false);
  });

  it.each([['abc'], ['-1'], [true]])('rejects %p', (input) => {
    expect(schema.safeParse({ v: input }).success).toBe(false);
  });

  it('keeps an .int() base strict about decimals', () => {
    expect(z.object({ v: formNumber(z.number().int()) }).safeParse({ v: '12.50' }).success).toBe(false);
  });
});

describe('thread create — exact ThreadForm payload', () => {
  const payload = {
    threadName: 'Test Thread',
    brand: 'Coats',
    packagingType: 'CONE',
    color: 'White',
    ply: 'TWO_PLY',
    materialComposition: '100% Polyester',
    metersPerUnit: 5000,
    pricePerCone: 85,
    unitsPerBox: 10,
    styleCodes: [],
    suppliers: [{ supplierId: SUPPLIER_ID, pricePerCone: '12.50', isPreferred: true, isActive: true, notes: '' }],
  };

  it('accepts ply as the ThreadPly enum string the form posts', () => {
    const r = createThreadSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ply).toBe('TWO_PLY');
  });

  it('keeps and coerces the supplier row price (it used to be silently stripped)', () => {
    const r = createThreadSchema.safeParse(payload);
    expect(r.success).toBe(true);
    if (r.success) {
      const row = r.data.suppliers?.[0] as Record<string, unknown>;
      expect('pricePerCone' in row).toBe(true);
      expect(row.pricePerCone).toBe(12.5);
    }
  });

  it('rejects an unknown ply', () => {
    expect(createThreadSchema.safeParse({ ...payload, ply: 'FOUR_PLY' }).success).toBe(false);
  });

  it('rejects a non-numeric supplier price at the row field', () => {
    const r = createThreadSchema.safeParse({
      ...payload,
      suppliers: [{ ...payload.suppliers[0], pricePerCone: 'abc' }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path.join('.')).toBe('suppliers.0.pricePerCone');
  });
});

describe('packaging create — exact PackagingForm payload', () => {
  const base = {
    packagingName: '',
    packagingType: 'Poly Bag',
    material: 'LDPE',
    pricePerPiece: 0.5,
    suppliers: [{ supplierId: SUPPLIER_ID, pricePerPiece: '', isPreferred: false, isActive: true, notes: '' }],
  };

  it('accepts a supplier row with a blank price (blank means no price, not 0)', () => {
    const r = createPackagingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.suppliers?.[0].pricePerPiece).toBeNull();
  });

  it('accepts a supplier row with a typed price', () => {
    const r = createPackagingSchema.safeParse({
      ...base,
      suppliers: [{ ...base.suppliers[0], pricePerPiece: '0.50' }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.suppliers?.[0].pricePerPiece).toBe(0.5);
  });

  it('rejects a negative supplier price', () => {
    expect(
      createPackagingSchema.safeParse({ ...base, suppliers: [{ ...base.suppliers[0], pricePerPiece: '-1' }] }).success
    ).toBe(false);
  });
});

describe('zipper create — exact ZipperForm payload', () => {
  it('accepts a supplier row with a blank price', () => {
    const r = createZipperSchema.safeParse({
      zipperName: 'YKK 3CD 9"',
      length: 9,
      pricePerPiece: 10,
      styleCodes: [],
      suppliers: [{ supplierId: SUPPLIER_ID, pricePerPiece: '', isPreferred: true, isActive: true, notes: '' }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.suppliers?.[0].pricePerPiece).toBeNull();
  });
});
