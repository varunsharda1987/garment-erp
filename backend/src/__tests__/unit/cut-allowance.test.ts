import {
  maxCutForSize,
  maxCutBySize,
  fabricCutBySize,
  plannedCutForSize,
  MAX_EXTRA_CUT_PERCENT,
} from '../../utils/cut-allowance';

describe('cut allowance — up to 5 % per size, rounded down', () => {
  it('is 5 %', () => {
    expect(MAX_EXTRA_CUT_PERCENT).toBe(5);
  });

  it('caps each size at order + 5 % rounded down (ESSKY085LS / 086LS split)', () => {
    const split = [322, 483, 506, 460, 345, 184];
    expect(split.map(maxCutForSize)).toEqual([338, 507, 531, 483, 362, 193]);
    expect(split.map(maxCutForSize).reduce((s, v) => s + v, 0)).toBe(2414);
  });

  it('rounds the Extra % up to whole garments but never past the allowance', () => {
    expect(plannedCutForSize(322, 5)).toBe(338); // ceil gives 339 = +5.3 %
    expect(plannedCutForSize(460, 5)).toBe(483); // 460 × 1.05 is 483.00000000000006 in floats
    expect(plannedCutForSize(322, 1)).toBe(326); // 325.22 → 326, well inside 338
    expect(plannedCutForSize(322, 10)).toBe(338); // a bigger Extra % is still capped
    expect(plannedCutForSize(322, 0)).toBe(322);
  });

  it('Max Cuttable per size is the allowance when the fabric covers it', () => {
    const split = [322, 483, 506, 460, 345, 184];
    expect(maxCutBySize(split, 5000)).toEqual([338, 507, 531, 483, 362, 193]);
    expect(maxCutBySize(split, null)).toEqual([338, 507, 531, 483, 362, 193]);
  });

  it('shares the fabric across sizes in the order ratio when the fabric is lower', () => {
    const split = [322, 483, 506, 460, 345, 184];
    const m = maxCutBySize(split, 2328); // 086LS: 1,707.3 m / 0.7333
    expect(m.reduce((s, v) => s + v, 0)).toBe(2328);
    m.forEach((v, i) => expect(v).toBeLessThanOrEqual(maxCutForSize(split[i])));
    m.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(split[i])); // enough fabric for the order itself
  });

  it('shows both limits: order 100 allows 105; the fabric allows 102 or 95 (owner example 2026-09-25)', () => {
    expect(maxCutForSize(100)).toBe(105);
    expect(fabricCutBySize([100], 102)).toEqual([102]); // fabric shown even though above the order
    expect(fabricCutBySize([100], 95)).toEqual([95]);
    expect(maxCutBySize([100], 102)).toEqual([102]); // to cut stays within the lower of the two
    expect(maxCutBySize([100], 95)).toEqual([95]);
    expect(maxCutBySize([100], 200)).toEqual([105]);
    // across sizes, the fabric's pieces follow the order ratio and add up exactly — not capped at +5 %
    const f = fabricCutBySize([322, 483, 506, 460, 345, 184], 2500)!;
    expect(f.reduce((s, v) => s + v, 0)).toBe(2500);
    expect(f[0]).toBeGreaterThan(maxCutForSize(322));
    expect(fabricCutBySize([100], null)).toBeNull();
  });

  it('treats nothing ordered as nothing to cut', () => {
    expect(maxCutForSize(0)).toBe(0);
    expect(plannedCutForSize(0, 5)).toBe(0);
  });
});
