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
import { createGRNSchema, receiveJwoToStockSchema, updateGRNInvoiceSchema } from '../../schemas/grn.schema';
import { issueFabricSchema } from '../../schemas/workOrder.schema';
import { completeCuttingBatchSchema } from '../../schemas/production.schema';
import { recordFabricPiecesSchema } from '../../schemas/fabricStock.schema';

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

describe('the invoice a receipt came on — exact payloads (2026-09-28)', () => {
  it('Add invoice: takes the number and the date input value, refuses either missing', () => {
    const ok = updateGRNInvoiceSchema.safeParse({ invoiceNumber: ' INV-1 ', invoiceDate: '2026-09-28' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.invoiceNumber).toBe('INV-1');
      expect(ok.data.invoiceDate).toBeInstanceOf(Date);
    }
    const noNumber = updateGRNInvoiceSchema.safeParse({ invoiceNumber: '', invoiceDate: '2026-09-28' });
    expect(noNumber.success).toBe(false);
    if (!noNumber.success) expect(noNumber.error.issues[0].message).toBe('Enter the invoice number');
    const noDate = updateGRNInvoiceSchema.safeParse({ invoiceNumber: 'INV-1' });
    expect(noDate.success).toBe(false);
    if (!noDate.success) expect(noDate.error.issues[0].message).toBe('Enter the invoice date');
  });

  it('keeps "Invoice not received yet" on a GRN and on a job-work return', () => {
    const grn = createGRNSchema.safeParse({
      poId: 'po-1',
      invoiceToFollow: true,
      items: [
        {
          poItemId: 'pi-1',
          materialId: 'm-1',
          receivedQuantity: 1,
          acceptedQuantity: 1,
          rejectedQuantity: 0,
          unit: 'METER',
        },
      ],
    });
    expect(grn.success).toBe(true);
    if (grn.success) expect(grn.data.invoiceToFollow).toBe(true);
    const back = receiveJwoToStockSchema.safeParse({
      jobWorkOrderId: '11111111-1111-4111-8111-111111111111',
      warehouseId: '22222222-2222-4222-8222-222222222222',
      qtyReceivedMeters: '100',
      invoiceToFollow: true,
    });
    expect(back.success).toBe(true);
    if (back.success) expect(back.data.invoiceToFollow).toBe(true);
  });
});

// FabricIssuanceSection, CuttingDetail's completion dialog and the Fabric Stock Record / Check dialog
describe('fabric rolls & thans — what the issue and cutting screens post (2026-09-28)', () => {
  const LOT = '33333333-3333-4333-8333-333333333333';
  const FABRIC = '44444444-4444-4444-8444-444444444444';
  const PIECE = '55555555-5555-4555-8555-555555555555';

  it('Issue to cutting: a listed lot sends its picks, a lot without a list goes by quantity', () => {
    const r = issueFabricSchema.safeParse({
      cuttingBatchId: '66666666-6666-4666-8666-666666666666',
      lots: [
        {
          fabricStockId: LOT,
          fabricId: FABRIC,
          quantity: 196,
          description: 'FAB-X · GRN2609-1228',
          details: [{ fabricStockDetailId: PIECE, metersToIssue: 100 }],
        },
        { fabricStockId: '77777777-7777-4777-8777-777777777777', fabricId: FABRIC, quantity: 400, description: '' },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lots[0].details).toHaveLength(1);
  });

  it('Issue to cutting: one line per lot', () => {
    const line = { fabricStockId: LOT, fabricId: FABRIC, quantity: 10, description: '' };
    expect(issueFabricSchema.safeParse({ lots: [line, line] }).success).toBe(false);
  });

  it('Complete batch: metres per lot, the whole rolls optional', () => {
    const r = completeCuttingBatchSchema.safeParse({
      fabricReturns: [
        { fabricStockId: LOT, returnedQuantity: 37.5 },
        { fabricStockId: '77777777-7777-4777-8777-777777777777', returnedQuantity: 233.5, wholePieceIds: [PIECE] },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fabricReturns?.[1].wholePieceIds).toEqual([PIECE]);
  });

  it('Record / Check rolls & thans: keeps and new pieces, never neither', () => {
    const check = recordFabricPiecesSchema.safeParse({
      entryMode: 'ROLL_WISE',
      keepPieceIds: [PIECE],
      pieces: [{ baleNumber: '', thanNo: 'R-9', meters: '45.50' }],
    });
    expect(check.success).toBe(true);
    if (check.success) expect(check.data.pieces[0]).toMatchObject({ baleNumber: null, meters: 45.5 });
    expect(recordFabricPiecesSchema.safeParse({ entryMode: 'THAN_WISE', keepPieceIds: [], pieces: [] }).success).toBe(
      false
    );
  });
});
