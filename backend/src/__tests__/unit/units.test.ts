import * as fs from 'fs';
import * as path from 'path';
import {
  UNIT_INFO,
  UNIT_OPTIONS,
  isCountUnit,
  jwoUomToUnit,
  normalizeUnit,
  unitHeader,
  unitLabel,
  unitPer,
  unitShort,
  unitToJwoUom,
  unitWord,
} from '../../utils/units';
import { UnitEnum } from '../../schemas/generated/prisma-enums';
import { materialQuerySchema, updateMaterialSchema } from '../../schemas/material.schema';

/**
 * Guards on the unit registry — the one place a unit is named, abbreviated and read back.
 * The spellings below are the ones the live database actually holds (groupBy, 2026-09-23).
 */
describe('unit registry', () => {
  it('labels every enum value', () => {
    for (const unit of UnitEnum.options) {
      const info = UNIT_INFO[unit];
      expect(info).toBeDefined();
      for (const field of ['label', 'short', 'per', 'header', 'word'] as const) {
        expect(info[field]).toBeTruthy();
      }
    }
    expect(Object.keys(UNIT_INFO).sort()).toEqual([...UnitEnum.options].sort());
  });

  it.each([
    ['METER', 'METER'],
    ['meters', 'METER'],
    ['meter', 'METER'],
    ['MTR', 'METER'],
    [' m ', 'METER'],
    ['pcs', 'PIECE'],
    ['PCS', 'PIECE'],
    ['piece', 'PIECE'],
    ['pieces', 'PIECE'],
    ['NOS', 'PIECE'],
    ['KG', 'KILOGRAM'],
    ['kgs', 'KILOGRAM'],
    ['cone', 'CONE'],
    ['CONE_5K', 'CONE'],
    ['PACKET', 'PACK'],
    ['GM', 'GRAM'],
    ['LTR', 'LITER'],
    ['ROL', 'ROLL'],
    ['YDS', 'YARD'],
  ])('reads %p back as %p', (raw, unit) => {
    expect(normalizeUnit(raw)).toBe(unit);
  });

  it.each(['lot', 'TRIP', 'JOB', 'xyz', '', null, undefined])('does not invent a stock unit for %p', (raw) => {
    expect(normalizeUnit(raw)).toBeNull();
  });

  it('shows short units beside quantities and rates', () => {
    expect(unitShort('METER')).toBe('m');
    expect(unitShort('meters')).toBe('m');
    expect(unitShort('MTR')).toBe('m');
    expect(unitShort('PIECE')).toBe('pcs');
    expect(unitShort('pcs')).toBe('pcs');
    expect(unitShort('KILOGRAM')).toBe('kg');
    expect(unitShort('KG')).toBe('kg');
    expect(unitPer('PIECE')).toBe('pc');
    expect(unitPer('METER')).toBe('m');
  });

  it('keeps an unknown spelling as it was stored instead of guessing', () => {
    expect(unitShort('Bundle')).toBe('bundle');
    expect(unitLabel('Bundle')).toBe('Bundle');
    expect(unitShort(null)).toBe('');
    expect(unitShort('lot')).toBe('lots');
    expect(unitShort('TRIP')).toBe('trips');
  });

  it('keeps the printed forms the job-work documents already use', () => {
    expect(unitHeader('MTR')).toBe('Mtr');
    expect(unitHeader('PCS')).toBe('Pcs');
    expect(unitHeader('KG')).toBe('Kg');
    expect(unitHeader('METER')).toBe('Mtr');
    expect(unitWord('MTR')).toBe('metre');
    expect(unitWord('PCS')).toBe('piece');
    expect(unitLabel('KILOGRAM')).toBe('Kilogram');
  });

  it('counts whole units without decimals', () => {
    for (const raw of ['PIECE', 'PCS', 'CONE', 'SET', 'DOZEN', 'NOS', 'TRIP', 'PACK', 'ROLL']) {
      expect(isCountUnit(raw)).toBe(true);
    }
    for (const raw of ['METER', 'MTR', 'KILOGRAM', 'KG', 'YARD', 'GRAM', 'LITER', 'Bundle']) {
      expect(isCountUnit(raw)).toBe(false);
    }
  });

  it('offers all 16 units in a dropdown, abbreviation only where it adds something', () => {
    expect(UNIT_OPTIONS.map((o) => o.value)).toEqual(UnitEnum.options);
    const label = (v: string) => UNIT_OPTIONS.find((o) => o.value === v)?.label;
    expect(label('METER')).toBe('Meter (m)');
    expect(label('PIECE')).toBe('Piece (pcs)');
    expect(label('PACK')).toBe('Pack');
    expect(label('BOX')).toBe('Box');
  });

  describe('job work bridge', () => {
    it('maps every JWO uom to the unit its goods move in', () => {
      expect(jwoUomToUnit('MTR')).toBe('METER');
      expect(jwoUomToUnit('PCS')).toBe('PIECE');
      // Before the registry, issuance made KG a PIECE and the unprocessed return made it a METER.
      expect(jwoUomToUnit('KG')).toBe('KILOGRAM');
      expect(jwoUomToUnit('TRIP')).toBe('PIECE');
      expect(jwoUomToUnit('XYZ')).toBeNull();
    });

    it('refuses a unit a processor cannot be billed in, instead of calling it metres', () => {
      expect(unitToJwoUom('METER')).toBe('MTR');
      expect(unitToJwoUom('meters')).toBe('MTR');
      expect(unitToJwoUom('PIECE')).toBe('PCS');
      expect(unitToJwoUom('KILOGRAM')).toBe('KG');
      expect(unitToJwoUom('DOZEN')).toBeNull();
      expect(unitToJwoUom('YARD')).toBeNull();
      expect(unitToJwoUom(null)).toBeNull();
    });
  });

  it('lets a material be saved or filtered in any of the 16 units (the schema used to know 9)', () => {
    for (const unit of UnitEnum.options) {
      expect(updateMaterialSchema.safeParse({ unit }).success).toBe(true);
      expect(materialQuerySchema.safeParse({ unit }).success).toBe(true);
    }
    // BD-0088 is a PACK material — editing it was refused before.
    expect(updateMaterialSchema.safeParse({ unit: 'PACK' }).success).toBe(true);
    // A spelling is not a unit: the form must post the enum value.
    expect(updateMaterialSchema.safeParse({ unit: 'KG' }).success).toBe(false);
  });

  it('is identical to its frontend twin except for the Unit import', () => {
    const strip = (file: string) =>
      fs
        .readFileSync(file, 'utf8')
        .replace(/\r\n/g, '\n')
        .replace(/^import type \{ Unit \} from '[^']+';$/m, '');
    const backend = path.resolve(__dirname, '../../utils/units.ts');
    const frontend = path.resolve(__dirname, '../../../../frontend/src/lib/units.ts');
    expect(strip(frontend)).toBe(strip(backend));
  });
});
