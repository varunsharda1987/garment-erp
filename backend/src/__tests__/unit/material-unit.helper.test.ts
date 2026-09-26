/**
 * lineUnit — the one rule for a consumption line's unit (services/helpers/material-unit.helper.ts).
 */

import type { Unit } from '@prisma/client';
import { lineUnit, masterIdOf, requirementLineUnit } from '../../services/helpers/material-unit.helper';
import { MASTER_CONFIG } from '../../services/helpers/master-config';

const units = new Map<string, Unit>([
  ['fusing-1', 'METER'],
  ['button-1', 'PIECE'],
  ['thread-1', 'CONE'],
]);

describe('lineUnit', () => {
  it("takes the material's unit over whatever the line was sent with", () => {
    expect(lineUnit({ materialType: 'INTERLINING', materialId: 'fusing-1', unit: 'pcs' }, units)).toBe('METER');
  });

  it('finds the material through a type FK when there is no materialId (cost-sheet single-FK rows)', () => {
    expect(lineUnit({ materialType: 'INTERLINING', unit: 'pcs', interliningId: 'fusing-1' } as object, units)).toBe(
      'METER'
    );
  });

  it('a button is consumed per PIECE (bought by the gross is the purchase unit, not this)', () => {
    expect(lineUnit({ materialType: 'BUTTON', materialId: 'button-1' }, units)).toBe('PIECE');
  });

  it('leaves THREAD exactly as its writer set it — thread costing is not designed yet', () => {
    expect(lineUnit({ materialType: 'THREAD', materialId: 'thread-1', unit: 'lot' }, units)).toBe('lot');
    expect(lineUnit({ materialType: 'THREAD', materialId: 'thread-1', unit: 'LOT' }, units)).toBe('LOT');
  });

  it("falls back to the type's default when no material is picked yet", () => {
    expect(lineUnit({ materialType: 'LACE', unit: 'pcs' }, units)).toBe('METER');
    expect(lineUnit({ materialType: 'LABEL' }, units)).toBe('PIECE');
  });

  it('every master-backed type has a default to fall back to', () => {
    for (const [type, config] of Object.entries(MASTER_CONFIG)) {
      if (type === 'THREAD') continue;
      expect(lineUnit({ materialType: type }, new Map())).toBe(config.unit);
    }
  });

  it('a type with no master reads the caller unit through the registry, else PIECE', () => {
    expect(lineUnit({ materialType: 'OTHER', unit: 'meters' }, units)).toBe('METER');
    expect(lineUnit({ materialType: 'OTHER' }, units)).toBe('PIECE');
  });

  it('ignores form sentinels like auto-thread', () => {
    expect(masterIdOf({ materialId: 'auto-thread' })).toBeNull();
  });

  it('requirementLineUnit: a stock unit, or null for THREAD lot (MRP then counts it as before)', () => {
    expect(requirementLineUnit({ materialType: 'INTERLINING', materialId: 'fusing-1', unit: 'pcs' }, units)).toBe(
      'METER'
    );
    expect(requirementLineUnit({ materialType: 'THREAD', materialId: 'thread-1', unit: 'lot' }, units)).toBeNull();
  });
});
