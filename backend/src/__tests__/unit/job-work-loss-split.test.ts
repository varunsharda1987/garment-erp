/**
 * Loss-split maths — measured against the CONTRACTED EXPECTED OUTPUT, not greige sent.
 *
 * The pre-2026-08-18 formula charged the processor for expected shrinkage itself:
 * returning exactly the contracted 1686.59 m (1833.25 greige @8%) recorded 91.66 m
 * "abnormal loss" and demanded a ₹916.63 debit note — for meeting the contract.
 */

import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from '../../services/job-work-order.service';

const split = (input: Parameters<typeof jobWorkOrderService.calculateLossSplit>[0]) =>
  jobWorkOrderService.calculateLossSplit(input);

const n = (d: { toNumber(): number }) => d.toNumber();

describe('calculateLossSplit — expected-output basis', () => {
  const LIVE = {
    qtySent: 1833.25,
    qtyExpected: 1686.59,
    expectedShrinkagePercent: 8,
    tolerancePercent: 3,
    ratePerMeter: 10,
  };

  it('live JWO: returning exactly the contracted qty → ZERO abnormal loss, no debit', () => {
    const r = split({ ...LIVE, qtyReceived: 1686.59 });
    expect(n(r.qtyExpected)).toBe(1686.59);
    expect(n(r.shortfall)).toBe(0);
    expect(n(r.qtyAbnormalLoss)).toBe(0);
    expect(n(r.qtyNormalLoss)).toBeCloseTo(146.66, 4); // the shrinkage — accepted, not "loss"
    expect(r.debitNoteRequired).toBe(false);
    expect(r.debitNoteAmount).toBeNull();
  });

  it('D1: tolerance allowance sits on EXPECTED output (50.5977), not on sent (54.9975)', () => {
    const r = split({ ...LIVE, qtyReceived: 1686.59 });
    expect(n(r.allowedLoss)).toBeCloseTo(50.5977, 4); // 3% of 1686.59
    expect(n(r.allowedLoss)).not.toBeCloseTo(54.9975, 2); // old sent-basis figure
  });

  it('real shortfall: only the deficit beyond expected − allowance is abnormal', () => {
    const r = split({ ...LIVE, qtyReceived: 1600 });
    expect(n(r.shortfall)).toBeCloseTo(86.59, 4);
    expect(n(r.qtyAbnormalLoss)).toBeCloseTo(35.9923, 4); // 86.59 − 50.5977
    expect(n(r.totalLoss)).toBeCloseTo(233.25, 4);
    expect(n(r.qtyNormalLoss)).toBeCloseTo(197.2577, 4); // shrinkage 146.66 + allowance 50.5977
    expect(r.debitNoteRequired).toBe(true);
    expect(n(r.debitNoteAmount!)).toBeCloseTo(359.92, 2); // 35.9923 × 10 rounded to cent
  });

  it('legacy/PCS (no billable, no shrinkage): degrades to the OLD formula exactly', () => {
    const r = split({
      qtySent: 1000,
      qtyReceived: 900,
      qtyExpected: null,
      expectedShrinkagePercent: null,
      tolerancePercent: 3,
    });
    expect(n(r.qtyExpected)).toBe(1000);
    expect(n(r.allowedLoss)).toBe(30);
    expect(n(r.qtyAbnormalLoss)).toBe(70);
    expect(n(r.qtyNormalLoss)).toBe(30);
  });

  it('legacy MTR row (no billable, shrinkage 8): expected derived via applyShrinkageLoss', () => {
    const r = split({
      qtySent: 1000,
      qtyReceived: 920,
      qtyExpected: null,
      expectedShrinkagePercent: 8,
      tolerancePercent: 3,
    });
    expect(n(r.qtyExpected)).toBe(920);
    expect(n(r.qtyAbnormalLoss)).toBe(0);
    expect(n(r.qtyNormalLoss)).toBe(80);
  });

  it('shrinkage 0 with billable == sent behaves like the old formula', () => {
    const r = split({
      qtySent: 500,
      qtyReceived: 480,
      qtyExpected: 500,
      expectedShrinkagePercent: 0,
      tolerancePercent: 2,
    });
    expect(n(r.allowedLoss)).toBe(10);
    expect(n(r.qtyAbnormalLoss)).toBe(10);
    expect(n(r.qtyNormalLoss)).toBe(10);
  });

  it('over-delivery vs expected: zero shortfall, zero abnormal, physical loss stays', () => {
    const r = split({ ...LIVE, qtyReceived: 1700 });
    expect(n(r.shortfall)).toBe(0);
    expect(n(r.qtyAbnormalLoss)).toBe(0);
    expect(n(r.qtyNormalLoss)).toBeCloseTo(133.25, 4);
  });

  it('received > sent (stenter growth): all losses zero, no throw', () => {
    const r = split({ ...LIVE, qtyReceived: 1900 });
    expect(n(r.totalLoss)).toBe(0);
    expect(n(r.shortfall)).toBe(0);
    expect(n(r.qtyAbnormalLoss)).toBe(0);
    expect(n(r.qtyNormalLoss)).toBe(0);
    expect(r.debitNoteRequired).toBe(false);
  });

  it('tolerance 0 (strict): the entire shortfall is abnormal', () => {
    const r = split({ ...LIVE, qtyReceived: 1680, tolerancePercent: 0 });
    expect(n(r.allowedLoss)).toBe(0);
    expect(n(r.qtyAbnormalLoss)).toBeCloseTo(6.59, 4);
  });

  it('qtyExpected > sent (post-close settled data) is clamped to sent', () => {
    const r = split({ qtySent: 1833.25, qtyReceived: 1800, qtyExpected: 2000, tolerancePercent: 3 });
    expect(n(r.qtyExpected)).toBe(1833.25);
    expect(n(r.expectedShrinkageLoss)).toBe(0);
    // legacy-formula behaviour: allowance on sent, loss vs sent
    expect(n(r.allowedLoss)).toBeCloseTo(54.9975, 4);
    expect(n(r.qtyAbnormalLoss)).toBe(0); // shortfall 33.25 < allowance
  });

  it('throws DIVIDE_BY_ZERO when qtySent <= 0', () => {
    expect(() => split({ qtySent: 0, qtyReceived: 0, tolerancePercent: 3 })).toThrow(JobWorkOrderError);
    try {
      split({ qtySent: 0, qtyReceived: 0, tolerancePercent: 3 });
    } catch (e) {
      expect((e as JobWorkOrderError).code).toBe(JWO_ERROR_CODES.DIVIDE_BY_ZERO);
    }
  });

  it('invariants hold across a grid of scenarios', () => {
    const sents = [100, 1833.25, 5000];
    const shrinks = [0, 5, 8, 12];
    const tols = [0, 1, 3];
    const recvFactors = [0.7, 0.88, 0.92, 1.0, 1.05];
    for (const qtySent of sents)
      for (const s of shrinks)
        for (const tolerancePercent of tols)
          for (const f of recvFactors) {
            const qtyReceived = qtySent * f;
            const r = split({ qtySent, qtyReceived, qtyExpected: null, expectedShrinkagePercent: s, tolerancePercent });
            expect(n(r.qtyAbnormalLoss)).toBeGreaterThanOrEqual(0);
            expect(n(r.qtyAbnormalLoss)).toBeLessThanOrEqual(n(r.shortfall) + 1e-9);
            expect(n(r.shortfall)).toBeLessThanOrEqual(n(r.qtyExpected) + 1e-9);
            if (qtyReceived <= qtySent) {
              expect(n(r.qtyNormalLoss) + n(r.qtyAbnormalLoss)).toBeCloseTo(n(r.totalLoss), 6);
            }
          }
  });
});
