/**
 * PUT /api/customers/:id/sample-requirements used to take req.body.requirements unvalidated:
 * a missing key was a 500, a bad sample type an opaque Prisma 400, and nothing bounded the day
 * targets. These parse the exact shape CustomerSampleRequirements.tsx posts. No database.
 */
import { upsertSampleRequirementsSchema } from '../../schemas/customer.schema';

const row = (sampleType: string, extra: Record<string, unknown> = {}) => ({
  id: '22222222-2222-4222-8222-222222222222', // the screen echoes the row id back; it must be ignored, not rejected
  sampleType,
  isRequired: true,
  blocksProduction: true,
  ...extra,
});

describe('upsertSampleRequirementsSchema — exact CustomerSampleRequirements payload', () => {
  it('accepts all six types with their flags (the un-tick fix posts every type)', () => {
    const r = upsertSampleRequirementsSchema.safeParse({
      requirements: [
        row('FIT_SAMPLE'),
        row('PP_SAMPLE'),
        row('SIZE_SET_SAMPLE', { isRequired: false, blocksProduction: false }),
        row('PHOTO_SAMPLE', { isRequired: false }),
        row('PRODUCTION_SAMPLE', { isRequired: false }),
        row('SHIPMENT_SAMPLE'),
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.requirements).toHaveLength(6);
      expect(r.data.requirements[2].isRequired).toBe(false);
      expect('id' in r.data.requirements[0]).toBe(false);
    }
  });

  it('accepts an empty list (nothing to change)', () => {
    expect(upsertSampleRequirementsSchema.safeParse({ requirements: [] }).success).toBe(true);
  });

  it('rejects a missing requirements key (was a 500)', () => {
    expect(upsertSampleRequirementsSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an unknown sample type at the row field (was an opaque Prisma 400)', () => {
    const r = upsertSampleRequirementsSchema.safeParse({ requirements: [row('LAB_DIP')] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path.join('.')).toBe('requirements.0.sampleType');
  });

  it('rejects a non-boolean isRequired', () => {
    expect(
      upsertSampleRequirementsSchema.safeParse({ requirements: [row('FIT_SAMPLE', { isRequired: 'yes' })] }).success
    ).toBe(false);
  });

  it('rejects duplicate sample types', () => {
    expect(
      upsertSampleRequirementsSchema.safeParse({ requirements: [row('FIT_SAMPLE'), row('FIT_SAMPLE')] }).success
    ).toBe(false);
  });

  it('bounds the day targets and tolerates blank/absent values', () => {
    const ok = upsertSampleRequirementsSchema.safeParse({
      requirements: [row('FIT_SAMPLE', { targetDaysToSend: '14', targetDaysToFeedback: '' })],
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.requirements[0].targetDaysToSend).toBe(14);
      expect(ok.data.requirements[0].targetDaysToFeedback).toBeNull();
    }
    expect(
      upsertSampleRequirementsSchema.safeParse({ requirements: [row('FIT_SAMPLE', { targetDaysToSend: -1 })] }).success
    ).toBe(false);
    expect(
      upsertSampleRequirementsSchema.safeParse({ requirements: [row('FIT_SAMPLE', { targetDaysToSend: 400 })] }).success
    ).toBe(false);
  });
});
