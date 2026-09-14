/**
 * Four production tables declare `colorId` NOT NULL — stitching_output_skus,
 * finishing_output_skus, polybag_skus and carton_skus — but their Zod shapes used to accept a
 * missing or null colour. The row reached Prisma and died there, so recording output on a style
 * with no colourway answered "An unexpected error occurred" (500) with no field named and nothing
 * on screen looking wrong. validateBody now rejects it first, as a 400 that says what to fix.
 *
 * The second half of this file is the more important half: the ISSUE-side and CUTTING shapes point
 * at genuinely nullable columns and must keep accepting a colour-less SKU. Tightening them to
 * "match" would break size-only cutting and issuing, which are legal today.
 *
 * No database — these parse the exact shapes the screens post.
 */
import {
  recordStitchingOutputSchema,
  recordFinishingOutputSchema,
  polybagEntrySchema,
  cartonPackingSchema,
  recordCuttingOutputSchema,
  createStitchingIssueSchema,
  createFinishingIssueSchema,
  receiveFromCuttingSchema,
} from '../../schemas/production.schema';

const COLOR = 'cm9x1a2b3c4d5e6f7g8h9i0j'; // color_options ids are cuids, not uuids
const SIZE = '11111111-1111-4111-8111-111111111111';
const WORK_ORDER = '22222222-2222-4222-8222-222222222222';

/** Every shape that writes a NOT-NULL colour, with the SKU list it posts. */
const required = [
  {
    name: 'record stitching output',
    schema: recordStitchingOutputSchema,
    key: 'skuOutputs',
    body: (sku: object) => ({ outputDate: '2026-09-14', skuOutputs: [sku] }),
    sku: { sizeId: SIZE, goodQty: 5 },
  },
  {
    name: 'record finishing output',
    schema: recordFinishingOutputSchema,
    key: 'skuOutputs',
    body: (sku: object) => ({ outputDate: '2026-09-14', skuOutputs: [sku] }),
    sku: { sizeId: SIZE, finishedQty: 5 },
  },
  {
    name: 'polybag entry',
    schema: polybagEntrySchema,
    key: 'skuBreakdown',
    body: (sku: object) => ({ packingDate: '2026-09-14', skuBreakdown: [sku] }),
    sku: { sizeId: SIZE, packedQty: 5 },
  },
  {
    name: 'carton packing',
    schema: cartonPackingSchema,
    key: 'skuBreakdown',
    body: (sku: object) => ({ cartonNumber: 'CTN-1', cartonDate: '2026-09-14', skuBreakdown: [sku] }),
    sku: { sizeId: SIZE, quantity: 5 },
  },
] as const;

describe('production schemas — a NOT-NULL colour is refused before it reaches Prisma', () => {
  describe.each(required)('$name', ({ schema, key, body, sku }) => {
    it('accepts a real colour', () => {
      expect(schema.safeParse(body({ ...sku, colorId: COLOR })).success).toBe(true);
    });

    it('rejects a missing colour, naming the field and how to fix it', () => {
      const r = schema.safeParse(body(sku));
      expect(r.success).toBe(false);
      if (r.success) return;
      const issue = r.error.issues.find((i) => i.path.join('.') === `${key}.0.colorId`);
      expect(issue).toBeDefined();
      // The operator's remedy, not "Invalid input" — this is the whole point of the 400.
      expect(issue!.message).toContain('Primary Color');
    });

    it('rejects an explicit null colour the same way', () => {
      const r = schema.safeParse(body({ ...sku, colorId: null }));
      expect(r.success).toBe(false);
      if (r.success) return;
      const issue = r.error.issues.find((i) => i.path.join('.') === `${key}.0.colorId`);
      expect(issue!.message).toContain('Primary Color');
    });

    it('rejects a malformed colour id', () => {
      const r = schema.safeParse(body({ ...sku, colorId: 'not-an-id' }));
      expect(r.success).toBe(false);
      if (r.success) return;
      expect(r.error.issues.some((i) => i.path.join('.') === `${key}.0.colorId`)).toBe(true);
    });

    it('names the row when a later SKU is the one missing a colour', () => {
      const r = schema.safeParse({
        ...body({ ...sku, colorId: COLOR }),
        [key]: [{ ...sku, colorId: COLOR }, { ...sku }],
      });
      expect(r.success).toBe(false);
      if (r.success) return;
      expect(r.error.issues.some((i) => i.path.join('.') === `${key}.1.colorId`)).toBe(true);
    });
  });
});

describe('production schemas — colour stays OPTIONAL where the column is nullable', () => {
  it('cutting output accepts a size-only SKU (cutting_batch_skus.colorId is nullable)', () => {
    expect(recordCuttingOutputSchema.safeParse({ skuOutputs: [{ sizeId: SIZE, cutQty: 10 }] }).success).toBe(true);
    expect(
      recordCuttingOutputSchema.safeParse({ skuOutputs: [{ sizeId: SIZE, cutQty: 10, colorId: null }] }).success
    ).toBe(true);
  });

  it('creating a stitching issue accepts a size-only SKU (stitching_issue_skus.colorId is nullable)', () => {
    expect(
      createStitchingIssueSchema.safeParse({
        workOrderId: WORK_ORDER,
        skuBreakdown: [{ sizeId: SIZE, issuedQty: 10 }],
      }).success
    ).toBe(true);
  });

  it('creating a finishing issue accepts a size-only SKU (finishing_issue_skus.colorId is nullable)', () => {
    expect(
      createFinishingIssueSchema.safeParse({
        workOrderId: WORK_ORDER,
        skuBreakdown: [{ sizeId: SIZE, issuedQty: 10 }],
      }).success
    ).toBe(true);
  });

  it('receiving from cutting accepts a size-only SKU', () => {
    // stage_receipt_skus.colorId IS non-nullable, but the controller drops colour-less rows rather
    // than writing them (stitching.controller.ts) and the header totals still capture the quantity.
    // Requiring it here would block a receive that works today.
    expect(receiveFromCuttingSchema.safeParse({ skuReceived: [{ sizeId: SIZE, receivedQty: 10 }] }).success).toBe(true);
  });
});
