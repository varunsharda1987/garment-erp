/**
 * "Best fit (whole thans)" — the owner's rules (2026-09-24): no than cut; land within ±1% of the job;
 * whole bales first; finish opened bales; break as few bales as possible.
 */
import { describe, expect, it } from 'vitest';
import { bestFitThans } from '../lot-rows';
import type { GreigeLotThans, GreigeStockDetail } from '@/services/jobWorkOrder.service';

let seq = 0;
function than(baleNumber: number, meters: number, opts: Partial<GreigeStockDetail> = {}): GreigeStockDetail {
  seq += 1;
  return {
    id: `t${seq}`,
    baleNumber,
    sequenceNo: seq,
    meters,
    metersRemaining: meters,
    status: 'AVAILABLE',
    baleNo: null,
    thanNo: null,
    remarks: null,
    baleOpen: false,
    ...opts,
  };
}
function lot(details: GreigeStockDetail[], foldLengthCm: number | null = null): GreigeLotThans {
  return { stockId: 'lot', baleCount: null, thanCount: details.length, totalAvailable: 0, foldLengthCm, details };
}
const balesOf = (l: GreigeLotThans, picks: { detailId: string }[]) =>
  new Set(picks.map((p) => l.details.find((d) => d.id === p.detailId)!.baleNumber));

describe('bestFitThans', () => {
  it('uses whole bales when they land within 1%', () => {
    const l = lot([1, 1, 1, 2, 2, 2, 3, 3, 3].map((b) => than(b, 100)));
    const fit = bestFitThans(l, 600)!;
    expect(fit.balesBroken).toBe(0);
    expect(fit.balesWhole).toBe(2);
    expect(fit.picks).toHaveLength(6);
    expect(fit.actual).toBe(600);
  });

  it('finishes an already-opened bale before opening a new one', () => {
    const l = lot([
      than(1, 100, { baleOpen: true }),
      than(1, 100, { baleOpen: true }),
      than(2, 100),
      than(2, 100),
      than(3, 100),
      than(3, 100),
    ]);
    const fit = bestFitThans(l, 200)!;
    expect(balesOf(l, fit.picks)).toEqual(new Set([1]));
    expect(fit.openBalesFinished).toBe(1);
  });

  it('breaks one bale only when no set of whole bales fits', () => {
    const l = lot([1, 1, 1, 2, 2, 2].map((b) => than(b, 100)));
    const fit = bestFitThans(l, 400)!; // 300 or 600 from whole bales — neither within 1%
    expect(fit.balesBroken).toBe(1);
    expect(fit.balesWhole).toBe(1);
    expect(fit.actual).toBe(400);
  });

  it('lands within ±1% and never cuts a than', () => {
    const l = lot([than(1, 101.5), than(1, 99.2), than(2, 103.4), than(2, 97.8)]);
    const fit = bestFitThans(l, 300)!;
    expect(Math.abs(fit.actual - 300)).toBeLessThanOrEqual(3);
    for (const p of fit.picks) {
      const d = l.details.find((x) => x.id === p.detailId)!;
      expect(Number(p.metersToIssue)).toBe(d.metersRemaining);
    }
  });

  it('works in counted tag metres at the lot fold length', () => {
    const l = lot([than(1, 100), than(1, 100), than(2, 100)], 98);
    const fit = bestFitThans(l, 196)!; // 2 thans × 100 counted × 0.98
    expect(fit.picks).toHaveLength(2);
    expect(fit.actual).toBe(196);
  });

  it('says so when no whole-than set fits', () => {
    expect(bestFitThans(lot([than(1, 100)]), 50)).toBeNull();
  });

  it('is fast on a lot the size of KMC (109 thans, 12 bales)', () => {
    const details: GreigeStockDetail[] = [];
    for (let b = 1; b <= 12; b++) {
      for (let t = 0; t < 9; t++) details.push(than(b, 85 + ((b * 7 + t * 13) % 30)));
    }
    const start = Date.now();
    const fit = bestFitThans(lot(details, 98), 2786.6);
    expect(Date.now() - start).toBeLessThan(3000);
    expect(fit).not.toBeNull();
    expect(Math.abs(fit!.actual - 2786.6)).toBeLessThanOrEqual(27.87);
  });
});
