/**
 * Samples follow the customer's requirements (owner, 2026-10-02) — mocked prisma, no DB.
 *
 * resolveCustomerGates is THE sample rule: a type holds production up only when the customer marks it
 * Required + Blocks Production, and no row = not required (what the customer screen shows). Kashaya
 * Fabs, needing no samples, was refused cutting under the old "no row blocks" default. The creation
 * chain FIT → PP → Size Set skips the types the sample's customer does not require.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    customer_sample_requirements: { findMany: jest.fn() },
    samples: { count: jest.fn(), findFirst: jest.fn() },
  },
}));

import prisma from '../../config/database';
import {
  resolveCustomerGates,
  productionBlockingValidationService as svc,
} from '../../services/productionBlockingValidation.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const row = (sampleType: string, isRequired: boolean, blocksProduction: boolean) => ({
  sampleType,
  isRequired,
  blocksProduction,
});

beforeEach(() => jest.resetAllMocks());

describe('resolveCustomerGates', () => {
  it('no customer or no rows: no sample blocks', () => {
    for (const customer of [null, undefined, { customer_sample_requirements: [] }]) {
      const g = resolveCustomerGates(customer);
      expect([g.fitBlocks, g.ppBlocks, g.sizeSetBlocks, g.shipmentSampleBlocks]).toEqual([false, false, false, false]);
    }
  });

  it('a type blocks only when Required AND Blocks Production', () => {
    const g = resolveCustomerGates({
      customer_sample_requirements: [
        row('FIT_SAMPLE', true, true),
        row('PP_SAMPLE', false, true), // hidden blocksProduction on an un-ticked type
        row('SIZE_SET_SAMPLE', true, false),
        row('SHIPMENT_SAMPLE', true, true),
      ],
    });
    expect(g).toMatchObject({ fitBlocks: true, ppBlocks: false, sizeSetBlocks: false, shipmentSampleBlocks: true });
  });

  it('Kashaya Fabs (only Size Set required): Size Set alone blocks', () => {
    const g = resolveCustomerGates({
      customer_sample_requirements: [
        row('FIT_SAMPLE', false, true),
        row('PP_SAMPLE', false, true),
        row('SIZE_SET_SAMPLE', true, true),
      ],
    });
    expect(g).toMatchObject({ fitBlocks: false, ppBlocks: false, sizeSetBlocks: true });
  });
});

describe('validateSampleCreation', () => {
  it('no customer: anything may be raised', async () => {
    await expect(svc.validateSampleCreation('style', 'SIZE_SET_SAMPLE', null)).resolves.toEqual({
      canCreate: true,
      blocker: null,
    });
    expect(db.customer_sample_requirements.findMany).not.toHaveBeenCalled();
  });

  it('FIT is first in the chain: never refused', async () => {
    await expect(svc.validateSampleCreation('style', 'FIT_SAMPLE', 'cust')).resolves.toMatchObject({ canCreate: true });
  });

  it('customer requires only Size Set: Size Set needs no FIT / PP', async () => {
    db.customer_sample_requirements.findMany.mockResolvedValue([]);
    await expect(svc.validateSampleCreation('style', 'SIZE_SET_SAMPLE', 'cust')).resolves.toMatchObject({
      canCreate: true,
    });
    expect(db.samples.count).not.toHaveBeenCalled();
  });

  it('customer requires FIT + PP: Size Set waits for the unapproved PP first', async () => {
    db.customer_sample_requirements.findMany.mockResolvedValue([
      { sampleType: 'FIT_SAMPLE' },
      { sampleType: 'PP_SAMPLE' },
    ]);
    db.samples.count.mockResolvedValue(0);
    const result = await svc.validateSampleCreation('style', 'SIZE_SET_SAMPLE', 'cust');
    expect(result.canCreate).toBe(false);
    expect(result.blocker?.prerequisiteType).toBe('PP_SAMPLE');
    expect(result.blocker?.message).toMatch(/PP Sample must be approved before creating Size Set Sample/);
  });

  it('customer requires FIT but not PP: Size Set waits for FIT', async () => {
    db.customer_sample_requirements.findMany.mockResolvedValue([{ sampleType: 'FIT_SAMPLE' }]);
    db.samples.count.mockResolvedValue(0);
    const result = await svc.validateSampleCreation('style', 'SIZE_SET_SAMPLE', 'cust');
    expect(result.blocker?.prerequisiteType).toBe('FIT_SAMPLE');
  });

  it('required earlier types approved: may be raised', async () => {
    db.customer_sample_requirements.findMany.mockResolvedValue([
      { sampleType: 'FIT_SAMPLE' },
      { sampleType: 'PP_SAMPLE' },
    ]);
    db.samples.count.mockResolvedValue(1);
    await expect(svc.validateSampleCreation('style', 'SIZE_SET_SAMPLE', 'cust')).resolves.toMatchObject({
      canCreate: true,
    });
  });
});

describe('sample stage gates', () => {
  it('not required: cutting is not held up and no sample is looked up', async () => {
    await expect(svc.validatePPSampleForStage('style', 'IN_CUTTING', false)).resolves.toEqual({
      isBlocked: false,
      blockers: [],
    });
    expect(db.samples.findFirst).not.toHaveBeenCalled();
  });

  it('PP required: cutting waits for an approved PP', async () => {
    db.samples.findFirst.mockResolvedValue({ sampleNumber: 'PP-1', status: 'SENT' });
    const result = await svc.validatePPSampleForStage('style', 'IN_CUTTING', true);
    expect(result.blockers.map((b) => b.type)).toEqual(['PP_SAMPLE_NOT_APPROVED']);
  });

  it('FIT required: holds up cutting as well as dyeing', async () => {
    db.samples.findFirst.mockResolvedValue(null);
    for (const stage of ['IN_DYING', 'IN_CUTTING'] as const) {
      const result = await svc.validateFitSampleForStage('style', stage, true);
      expect(result.blockers.map((b) => b.type)).toEqual(['FIT_SAMPLE_NOT_APPROVED']);
    }
  });

  it('approved with comments counts as approved', async () => {
    db.samples.findFirst.mockResolvedValue({ sampleNumber: 'SS-1', status: 'APPROVED_WITH_COMMENTS' });
    await expect(svc.validateSizeSetSampleForStage('style', 'IN_CUTTING', true)).resolves.toMatchObject({
      isBlocked: false,
    });
  });
});
