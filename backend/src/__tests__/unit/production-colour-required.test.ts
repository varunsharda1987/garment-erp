/**
 * Colour is OPTIONAL (owner, 2026-09-28; services/helpers/sku-colour.helper.ts). The output tables —
 * stitching_output_skus, finishing_output_skus, polybag_skus and carton_skus — declared `colorId`
 * NOT NULL until then, and these shapes refused a missing colour ("open the style and set its
 * Primary Color"), so a style with no colour could be cut but never stitched. The columns are
 * nullable now (migration 20260928170000, NULLS NOT DISTINCT unique indexes), so every production
 * shape takes a size-only SKU. A colour that IS sent must still be a well-formed id.
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

/** Every OUTPUT shape (the columns that were NOT NULL until 2026-09-28), with the SKU list it posts. */
const outputs = [
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

describe('production output schemas — colour is optional', () => {
  describe.each(outputs)('$name', ({ schema, key, body, sku }) => {
    it('accepts a real colour', () => {
      expect(schema.safeParse(body({ ...sku, colorId: COLOR })).success).toBe(true);
    });

    it('accepts a size-only SKU — no colour at all', () => {
      expect(schema.safeParse(body(sku)).success).toBe(true);
    });

    it('accepts an explicit null colour (what the pages post for a style with no colour)', () => {
      expect(schema.safeParse(body({ ...sku, colorId: null })).success).toBe(true);
    });

    it('still rejects a malformed colour id, naming the row', () => {
      const r = schema.safeParse({
        ...body({ ...sku, colorId: COLOR }),
        [key]: [
          { ...sku, colorId: COLOR },
          { ...sku, colorId: 'not-an-id' },
        ],
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
    // stage_receipt_skus.colorId is nullable since 2026-09-28 — the colour-less row is recorded
    expect(receiveFromCuttingSchema.safeParse({ skuReceived: [{ sizeId: SIZE, receivedQty: 10 }] }).success).toBe(true);
  });
});
