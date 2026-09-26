/**
 * Material line unit — the ONE rule for the unit on a CONSUMPTION line: style BOM
 * (`style_material_bom`), cost-sheet trim (`style_costing_trim_items`), order BOM
 * (`order_bom_items`) and material requirement (`material_requirements`).
 *
 * A consumption line's unit IS its material's unit. `materials.unit` is the one home of it
 * (29 of the type masters have no unit column; `materials.id === master.id`, so any master FK on a
 * line is also a materials id). Quantity and price on the line are per that unit — a lace line
 * carries metres at a per-metre rate — so a request body never overrides it.
 *
 * Until 2026-09-26 every trim picked on the Style form was stamped `'pcs'`, and the cost sheet,
 * order BOM and requirement copied that forward: 111 metre lines (lace, elastic, interlining,
 * drawstring) read "pcs" and MR2608-0111 asked for 2,300 PIECES of fusing.
 *
 * Consumption unit ≠ purchase unit: buttons are consumed per PIECE but bought by the GROSS; thread
 * is bought in cones/tubes and converted by box size. PO lines are NOT governed by this helper.
 *
 * THREAD is left exactly as its writer set it (`'lot'`, qty 1 per garment): its quantity counts
 * garments, not cones, and thread costing has not been designed yet — stamping CONE would turn
 * "2,550 garments' worth" into "2,550 cones".
 *
 * Resolution: materials.unit → MASTER_CONFIG[type].unit (no material picked yet) →
 * the caller's unit through the registry → PIECE.
 */

import type { Prisma, Unit } from '@prisma/client';
import prisma from '../../config/database';
import { normalizeUnit } from '../../utils/units';
import { MASTER_CONFIG } from './master-config';

/**
 * Every column on a line that can hold a master id — `materialId`, each type's FK, and the
 * cost sheet's generic `masterId` fallback.
 */
export const MASTER_ID_FIELDS: readonly string[] = [
  'materialId',
  ...Array.from(new Set(Object.values(MASTER_CONFIG).map((c) => c.fkField))),
  'masterId',
];

/** The material this line is about: its `materialId`, else the first type FK set. */
export function masterIdOf(line: object): string | null {
  const row = line as Record<string, unknown>;
  for (const field of MASTER_ID_FIELDS) {
    const value = row[field];
    // `auto-thread` and friends are form sentinels, not ids
    if (typeof value === 'string' && value.trim() !== '' && !value.startsWith('auto-')) return value;
  }
  return null;
}

/** `materials.unit` for each id, in one query. Ids with no materials row are simply absent. */
export async function loadMaterialUnits(
  ids: ReadonlyArray<string | null | undefined>,
  tx?: Prisma.TransactionClient
): Promise<Map<string, Unit>> {
  const wanted = Array.from(new Set(ids.filter((id): id is string => !!id && !id.startsWith('auto-'))));
  if (wanted.length === 0) return new Map();
  const rows = await (tx ?? prisma).materials.findMany({
    where: { id: { in: wanted } },
    select: { id: true, unit: true },
  });
  return new Map(rows.map((r) => [r.id, r.unit]));
}

/** Load the units for a batch of lines (reads each line's master id). */
export function loadLineUnits(lines: ReadonlyArray<object>, tx?: Prisma.TransactionClient): Promise<Map<string, Unit>> {
  return loadMaterialUnits(lines.map(masterIdOf), tx);
}

export interface UnitLine {
  materialType?: string | null;
  unit?: string | null;
  /** Or any type FK (`laceId`, `interliningId` …) — see MASTER_ID_FIELDS */
  materialId?: string | null;
}

/**
 * The unit to store on a consumption line. `units` comes from `loadLineUnits` /
 * `loadMaterialUnits`. Returns a Unit enum value (`'METER'`, `'PIECE'` …) — except for THREAD,
 * whose caller-set unit is returned untouched.
 */
export function lineUnit(line: UnitLine & object, units: ReadonlyMap<string, Unit>): string {
  const type = line.materialType ? String(line.materialType).toUpperCase() : '';
  const callerUnit = line.unit != null && String(line.unit).trim() !== '' ? String(line.unit) : null;

  if (type === 'THREAD' && callerUnit) return callerUnit;

  const masterId = masterIdOf(line);
  const materialUnit = masterId ? units.get(masterId) : undefined;
  if (materialUnit) return materialUnit;

  const typeDefault = MASTER_CONFIG[type]?.unit;
  if (typeDefault) return typeDefault;

  return normalizeUnit(callerUnit) ?? 'PIECE';
}

/** `lineUnit` for the `material_requirements.unit` enum column. */
export function requirementLineUnit(line: UnitLine & object, units: ReadonlyMap<string, Unit>): Unit | null {
  return normalizeUnit(lineUnit(line, units));
}
