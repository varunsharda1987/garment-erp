/**
 * Lab round verdict — roundResult() truth table (mocked prisma, no DB).
 *
 * roundResult is the ONE definition of "did this lab round pass", read by the sample's Lab Tests
 * panel, the approve-sample warning and the Shipment Sample dispatch gate. A drift here moves all
 * three at once, which is why the whole table is pinned.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    buyer_test_requirement_forms: { findFirst: jest.fn() },
  },
}));

import prisma from '../../config/database';
import {
  roundResult,
  latestRoundForSample,
  latestSampleRoundForStyle,
  pickResultFields,
} from '../../services/helpers/lab-round.helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Result = 'PENDING' | 'PASS' | 'FAIL' | 'RETEST_REQUIRED' | 'CONDITIONAL_PASS';
const t = (overallTestResult: Result, adminOverride = false) => ({ overallTestResult, adminOverride });

describe('roundResult', () => {
  it('is NO_RESULT when the lab has not answered on either kind', () => {
    expect(roundResult({ fabricTest: null, garmentTest: null })).toBe('NO_RESULT');
  });

  it('is NO_RESULT while a recorded test is still PENDING', () => {
    expect(roundResult({ fabricTest: t('PENDING'), garmentTest: null })).toBe('NO_RESULT');
    expect(roundResult({ fabricTest: t('PASS'), garmentTest: t('PENDING') })).toBe('NO_RESULT');
  });

  it('passes on PASS or CONDITIONAL_PASS for every recorded test', () => {
    expect(roundResult({ fabricTest: t('PASS'), garmentTest: null })).toBe('PASS');
    expect(roundResult({ fabricTest: null, garmentTest: t('CONDITIONAL_PASS') })).toBe('PASS');
    expect(roundResult({ fabricTest: t('PASS'), garmentTest: t('CONDITIONAL_PASS') })).toBe('PASS');
  });

  it('fails if ANY recorded test fails — FAIL beats a pass and beats pending', () => {
    expect(roundResult({ fabricTest: t('FAIL'), garmentTest: null })).toBe('FAIL');
    expect(roundResult({ fabricTest: t('PASS'), garmentTest: t('FAIL') })).toBe('FAIL');
    expect(roundResult({ fabricTest: t('PENDING'), garmentTest: t('FAIL') })).toBe('FAIL');
  });

  it('treats RETEST_REQUIRED as a failure', () => {
    expect(roundResult({ fabricTest: t('RETEST_REQUIRED'), garmentTest: null })).toBe('FAIL');
  });

  it('treats an admin-overridden failure as a pass, like validateFPTForStage does', () => {
    expect(roundResult({ fabricTest: t('FAIL', true), garmentTest: null })).toBe('PASS');
    expect(roundResult({ fabricTest: t('FAIL', true), garmentTest: t('PASS') })).toBe('PASS');
    // The other test still counts on its own.
    expect(roundResult({ fabricTest: t('FAIL', true), garmentTest: t('FAIL') })).toBe('FAIL');
  });
});

describe('latestRoundForSample', () => {
  it('returns null when the sample has never been to a lab', async () => {
    db.buyer_test_requirement_forms.findFirst.mockResolvedValue(null);
    await expect(latestRoundForSample('sample-1')).resolves.toBeNull();
  });

  it('orders by createdAt (not the editable trfDate) and reports the verdict + report number', async () => {
    db.buyer_test_requirement_forms.findFirst.mockResolvedValue({
      id: 'trf-2',
      trfNumber: 'TRF-0002',
      sampleStage: 'SHIPMENT',
      fabricTest: { ...t('FAIL'), testReportNumber: 'IN-1' },
      garmentTest: null,
    });

    const latest = await latestRoundForSample('sample-1');

    expect(latest).toEqual({
      trfId: 'trf-2',
      trfNumber: 'TRF-0002',
      sampleStage: 'SHIPMENT',
      result: 'FAIL',
      reportNumber: 'IN-1',
    });
    const args = db.buyer_test_requirement_forms.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ sampleId: 'sample-1', isActive: true });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('latestSampleRoundForStyle', () => {
  it("reads the newest round on ANY of the style's samples for the buyer, never a sample-less form", async () => {
    db.buyer_test_requirement_forms.findFirst.mockResolvedValue({
      id: 'trf-7',
      trfNumber: 'TRF-0007',
      sampleStage: 'PP',
      sample: { sampleNumber: 'PP2609-0071' },
      fabricTest: null,
      garmentTest: { ...t('PASS'), testReportNumber: 'IN-9' },
    });

    const latest = await latestSampleRoundForStyle('style-1', 'buyer-1');

    expect(latest).toMatchObject({
      trfNumber: 'TRF-0007',
      sampleNumber: 'PP2609-0071',
      result: 'PASS',
      reportNumber: 'IN-9',
    });
    const args = db.buyer_test_requirement_forms.findFirst.mock.calls[0][0];
    // A fabric-lot test's form has no sample, so the relation filter excludes it.
    expect(args.where).toEqual({ isActive: true, sample: { is: { styleId: 'style-1', customerId: 'buyer-1' } } });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('pickResultFields', () => {
  it('copies only the listed keys that were actually sent — null is sent, undefined is not', () => {
    const picked = pickResultFields(
      { testReportNumber: 'R1', failureReason: null, remarks: undefined, adminOverride: true },
      ['testReportNumber', 'failureReason', 'remarks']
    );
    expect(picked).toEqual({ testReportNumber: 'R1', failureReason: null });
  });
});
