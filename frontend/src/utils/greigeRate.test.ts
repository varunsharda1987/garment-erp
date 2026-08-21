import { describe, it, expect } from 'vitest';
import { resolveGreigeCost, isGreigeRateStale, greigeSourceLabel, describeLiveRate } from './greigeRate';
import type { FabricForCosting } from '../types/fabricCosting.types';

/** Only the greige-related fields matter; the rest of FabricForCosting is irrelevant here. */
const fabric = (over: Partial<FabricForCosting>): FabricForCosting =>
  ({
    greigeCostPerMeter: null,
    greigeCostSource: null,
    greigeCostPerMeterSaved: null,
    greigeDefaultCost: null,
    ...over,
  }) as FabricForCosting;

describe('resolveGreigeCost', () => {
  it('shows the LIVE rate on a row that was never costed, ignoring an older stamp', () => {
    // The reported bug: nine rows stamped ₹42 in December, repurchased at ₹47 in August.
    const r = resolveGreigeCost(
      fabric({ greigeCostPerMeter: 47, greigeCostSource: 'GREIGE_PROCUREMENT', greigeCostPerMeterSaved: 42 }),
      false
    );
    expect(r.greigeCostPerMeter).toBe(47);
    expect(r.greigeCostSource).toBe('GREIGE_PROCUREMENT');
  });

  it('keeps the committed rate on a costed row and never calls it manual', () => {
    // GRG-0017: costed at ₹59 against a 1-metre sample GRN of ₹50. Must not re-price.
    const r = resolveGreigeCost(
      fabric({ greigeCostPerMeter: 50, greigeCostSource: 'GREIGE_PROCUREMENT', greigeCostPerMeterSaved: 59 }),
      true
    );
    expect(r.greigeCostPerMeter).toBe(59);
    expect(r.greigeCostSource).toBe('COMMITTED');
    expect(r.liveGreigeCostPerMeter).toBe(50);
  });

  it('labels a costed row by its live source when the committed rate still matches', () => {
    const r = resolveGreigeCost(
      fabric({ greigeCostPerMeter: 47, greigeCostSource: 'GREIGE_STOCK', greigeCostPerMeterSaved: 47 }),
      true
    );
    expect(r.greigeCostPerMeter).toBe(47);
    expect(r.greigeCostSource).toBe('GREIGE_STOCK');
  });

  it('falls back to the committed rate when nothing resolves live', () => {
    const r = resolveGreigeCost(fabric({ greigeCostPerMeterSaved: 42 }), false);
    expect(r.greigeCostPerMeter).toBe(42);
    expect(r.greigeCostSource).toBe('COMMITTED');
  });

  it('uses the Greige Master default only when there is no live rate and nothing committed', () => {
    const r = resolveGreigeCost(fabric({ greigeDefaultCost: 38 }), false);
    expect(r.greigeCostPerMeter).toBe(38);
    expect(r.greigeCostSource).toBe('GREIGE_MASTER');
  });

  it('returns no rate AND no source when the greige has no price anywhere', () => {
    // Previously rendered the grey "default" label over an empty box.
    const r = resolveGreigeCost(fabric({}), false);
    expect(r.greigeCostPerMeter).toBeNull();
    expect(r.greigeCostSource).toBeNull();
  });

  it('never attaches a source to a null live rate', () => {
    const r = resolveGreigeCost(fabric({ greigeCostPerMeter: null, greigeCostSource: 'GREIGE_PROCUREMENT' }), false);
    expect(r.liveGreigeCostSource).toBeNull();
  });

  it('carries the live rate through so a costed row can offer it', () => {
    const r = resolveGreigeCost(
      fabric({
        greigeCostPerMeter: 47,
        greigeCostSource: 'GREIGE_PROCUREMENT',
        greigeCostSourceDate: '2026-08-20T00:00:00.000Z',
        greigeCostSourceSupplier: 'Bhuval Corporation',
        greigeCostPerMeterSaved: 42,
      }),
      true
    );
    expect(r.liveGreigeCostPerMeter).toBe(47);
    expect(r.liveGreigeCostSourceSupplier).toBe('Bhuval Corporation');
  });
});

describe('isGreigeRateStale', () => {
  it('is true when the shown rate differs from the live one', () => {
    expect(isGreigeRateStale({ greigeCostPerMeter: 42, liveGreigeCostPerMeter: 47 })).toBe(true);
  });

  it('tolerates sub-paise difference', () => {
    expect(isGreigeRateStale({ greigeCostPerMeter: 47, liveGreigeCostPerMeter: 47.001 })).toBe(false);
  });

  it('is false when there is no live rate to offer', () => {
    expect(isGreigeRateStale({ greigeCostPerMeter: 42, liveGreigeCostPerMeter: null })).toBe(false);
  });
});

describe('labels', () => {
  it('names each source, and nothing when there is none', () => {
    expect(greigeSourceLabel('GREIGE_PROCUREMENT')).toBe('from GRN');
    expect(greigeSourceLabel('GREIGE_STOCK')).toBe('from Stock');
    expect(greigeSourceLabel('GREIGE_MASTER')).toBe('default');
    expect(greigeSourceLabel('COMMITTED')).toBe('committed');
    expect(greigeSourceLabel('MANUAL')).toBe('manual');
    expect(greigeSourceLabel(null)).toBeNull();
  });

  it('describes the live rate with supplier and date', () => {
    const text = describeLiveRate({
      liveGreigeCostPerMeter: 47,
      liveGreigeCostSource: 'GREIGE_PROCUREMENT',
      liveGreigeCostSourceDate: '2026-08-20T00:00:00.000Z',
      liveGreigeCostSourceSupplier: 'Bhuval Corporation',
    });
    expect(text).toContain('from GRN');
    expect(text).toContain('Bhuval Corporation');
  });

  it('returns nothing when there is no live rate', () => {
    expect(
      describeLiveRate({
        liveGreigeCostPerMeter: null,
        liveGreigeCostSource: null,
        liveGreigeCostSourceDate: null,
        liveGreigeCostSourceSupplier: null,
      })
    ).toBeNull();
  });
});
