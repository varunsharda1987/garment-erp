/**
 * Units — the project's ONE registry for how a unit of measure is named, abbreviated and read back.
 *
 * The VALUES come from `enum Unit` in schema.prisma (generated — never re-typed). This file owns
 * everything else: the label a dropdown shows, the short form beside a quantity, the heading a
 * printed document uses, and — most importantly — `normalizeUnit`, the single alias table that
 * reads every spelling the database actually holds back to the enum.
 *
 * Why it exists (2026-09-23): units were stored five ways (`METER`; job work's `MTR/PCS/KG`; the
 * BOM's `pcs/lot/cone`; stock tables' `meters/pieces`; the material master's `meter/piece`), and
 * more than a dozen hand-made maps read them back, each covering a different subset — the Processor
 * Statement printed kilograms as metres, one job-work path turned KG into PIECE while another
 * turned it into METER, and the only frontend label map knew 13 of the 16 units.
 *
 * Rules:
 *  - Display through `unitShort` / `unitPer` / `unitLabel` / `unitHeader` / `unitWord`. They accept
 *    ANY stored spelling, and an unknown one comes back as-is — they never guess.
 *  - Convert through `normalizeUnit` (→ enum or null) and the job-work bridge below. A caller that
 *    gets null decides what to do; the registry does not pick a default for it.
 *  - Stored data is NOT normalised yet — reading every spelling is the point.
 *
 * This file is identical to `frontend/src/lib/units.ts` except for the `Unit` import line
 * (asserted by `backend/src/__tests__/unit/units.test.ts`).
 */
import type { Unit } from '@/types/generated/prisma-enums';

export interface UnitInfo {
  /** Full name, for dropdowns: "Meter" */
  label: string;
  /** Beside a quantity: "1,707.3 m", "50 pcs" */
  short: string;
  /** After a rate: "₹10.00 / m", "₹4.50 / pc" */
  per: string;
  /** A printed column heading: "Mtr", "Pcs" */
  header: string;
  /** Prose, singular: "per metre", "per piece" */
  word: string;
  /** Counted in whole units — printed without decimals */
  count: boolean;
}

/** One entry per enum value — a unit added to schema.prisma fails the type-check until it is labelled here. */
export const UNIT_INFO: Record<Unit, UnitInfo> = {
  METER: { label: 'Meter', short: 'm', per: 'm', header: 'Mtr', word: 'metre', count: false },
  PIECE: { label: 'Piece', short: 'pcs', per: 'pc', header: 'Pcs', word: 'piece', count: true },
  KILOGRAM: { label: 'Kilogram', short: 'kg', per: 'kg', header: 'Kg', word: 'kg', count: false },
  SET: { label: 'Set', short: 'sets', per: 'set', header: 'Sets', word: 'set', count: true },
  YARD: { label: 'Yard', short: 'yd', per: 'yd', header: 'Yd', word: 'yard', count: false },
  DOZEN: { label: 'Dozen', short: 'doz', per: 'doz', header: 'Doz', word: 'dozen', count: true },
  GROSS: { label: 'Gross', short: 'gross', per: 'gross', header: 'Gross', word: 'gross', count: true },
  TUBE: { label: 'Tube', short: 'tubes', per: 'tube', header: 'Tubes', word: 'tube', count: true },
  CONE: { label: 'Cone', short: 'cones', per: 'cone', header: 'Cones', word: 'cone', count: true },
  SPOOL: { label: 'Spool', short: 'spools', per: 'spool', header: 'Spools', word: 'spool', count: true },
  BOX: { label: 'Box', short: 'boxes', per: 'box', header: 'Boxes', word: 'box', count: true },
  PAIR: { label: 'Pair', short: 'pairs', per: 'pair', header: 'Pairs', word: 'pair', count: true },
  PACK: { label: 'Pack', short: 'packs', per: 'pack', header: 'Packs', word: 'pack', count: true },
  GRAM: { label: 'Gram', short: 'g', per: 'g', header: 'g', word: 'gram', count: false },
  LITER: { label: 'Liter', short: 'L', per: 'L', header: 'Ltr', word: 'litre', count: false },
  ROLL: { label: 'Roll', short: 'rolls', per: 'roll', header: 'Rolls', word: 'roll', count: true },
};

/**
 * Stored units that are real vocabulary but not stock units, so not in the enum: a TRIP-priced
 * process (transport) and the BOM's `lot`. Displayed and counted; never offered in a dropdown.
 */
const EXTRA_UNITS: Record<string, UnitInfo> = {
  TRIP: { label: 'Trip', short: 'trips', per: 'trip', header: 'Trips', word: 'trip', count: true },
  LOT: { label: 'Lot', short: 'lots', per: 'lot', header: 'Lots', word: 'lot', count: true },
};

/** Every other spelling found in the database or typed by users, read back to the enum. */
const ALIASES: Record<string, Unit> = {
  M: 'METER',
  MTR: 'METER',
  MTRS: 'METER',
  METERS: 'METER',
  METRE: 'METER',
  METRES: 'METER',
  PC: 'PIECE',
  PCS: 'PIECE',
  PIECES: 'PIECE',
  NO: 'PIECE',
  NOS: 'PIECE',
  KG: 'KILOGRAM',
  KGS: 'KILOGRAM',
  KILOGRAMS: 'KILOGRAM',
  SETS: 'SET',
  YD: 'YARD',
  YDS: 'YARD',
  YARDS: 'YARD',
  DOZ: 'DOZEN',
  DOZENS: 'DOZEN',
  TUBES: 'TUBE',
  CONES: 'CONE',
  CONE_5K: 'CONE',
  CONE_10K: 'CONE',
  SPOOLS: 'SPOOL',
  BOXES: 'BOX',
  PAIRS: 'PAIR',
  PRS: 'PAIR',
  PACKS: 'PACK',
  PACKET: 'PACK',
  PACKETS: 'PACK',
  PKT: 'PACK',
  G: 'GRAM',
  GM: 'GRAM',
  GMS: 'GRAM',
  GRAMS: 'GRAM',
  L: 'LITER',
  LTR: 'LITER',
  LITERS: 'LITER',
  LITRE: 'LITER',
  LITRES: 'LITER',
  ROL: 'ROLL',
  ROLLS: 'ROLL',
};

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const keyOf = (raw: string | null | undefined) => (raw == null ? '' : String(raw).trim().toUpperCase());

/** Any stored spelling → the enum value, or null when it is not a stock unit (`lot`, `TRIP`, typos). */
export function normalizeUnit(raw: string | null | undefined): Unit | null {
  const key = keyOf(raw);
  if (!key) return null;
  if (has(UNIT_INFO, key)) return key as Unit;
  return has(ALIASES, key) ? ALIASES[key] : null;
}

function infoFor(raw: string | null | undefined): UnitInfo | null {
  const unit = normalizeUnit(raw);
  if (unit) return UNIT_INFO[unit];
  const key = keyOf(raw);
  return has(EXTRA_UNITS, key) ? EXTRA_UNITS[key] : null;
}

const asIs = (raw: string | null | undefined) => (raw == null ? '' : String(raw).trim());

/** "m", "pcs", "kg" — beside a quantity. Unknown spellings come back lowercased, never guessed. */
export function unitShort(raw: string | null | undefined): string {
  return infoFor(raw)?.short ?? asIs(raw).toLowerCase();
}

/** "m", "pc", "kg" — after a rate: "₹4.50 / pc". */
export function unitPer(raw: string | null | undefined): string {
  return infoFor(raw)?.per ?? asIs(raw).toLowerCase();
}

/** "Meter", "Piece" — the full name. */
export function unitLabel(raw: string | null | undefined): string {
  return infoFor(raw)?.label ?? asIs(raw);
}

/** "Mtr", "Pcs" — a printed column heading. */
export function unitHeader(raw: string | null | undefined): string {
  return infoFor(raw)?.header ?? asIs(raw);
}

/** "metre", "piece" — singular, for prose ("per metre"). */
export function unitWord(raw: string | null | undefined): string {
  return infoFor(raw)?.word ?? asIs(raw).toLowerCase();
}

/** True for units counted in whole numbers (pieces, cones, sets…) — they print without decimals. */
export function isCountUnit(raw: string | null | undefined): boolean {
  return infoFor(raw)?.count ?? false;
}

/** Dropdown options in enum order: "Meter (m)", "Piece (pcs)", and just "Pack" where the short form adds nothing. */
export const UNIT_OPTIONS: ReadonlyArray<{ value: Unit; label: string }> = (Object.keys(UNIT_INFO) as Unit[]).map(
  (value) => {
    const { label, short } = UNIT_INFO[value];
    return { value, label: short.toLowerCase().startsWith(label.toLowerCase()) ? label : `${label} (${short})` };
  }
);

/**
 * Units that are a fixed count of another. A supplier sells buttons by the GROSS while we count them
 * in pieces: a purchase quantity × `per` = stock units. The ONE home of these numbers.
 */
export const COUNT_UNIT_FACTORS: Readonly<Partial<Record<Unit, { of: Unit; per: number }>>> = {
  DOZEN: { of: 'PIECE', per: 12 },
  GROSS: { of: 'PIECE', per: 144 },
};

/** Material types BOUGHT in another unit than they are counted in (owner, 2026-09-26). */
const PURCHASE_UNIT_BY_MATERIAL_TYPE: Readonly<Record<string, Unit>> = {
  BUTTON: 'GROSS',
  SNAP_BUTTON: 'GROSS',
};

/**
 * The unit a material type is ordered and inwarded in, and how many stock units one holds — buttons and
 * snap buttons are counted per piece but bought by the gross (144). Null = bought in the unit it is counted in.
 */
export function purchaseUnitOf(materialType: string | null | undefined): { unit: Unit; per: number } | null {
  const unit = materialType ? PURCHASE_UNIT_BY_MATERIAL_TYPE[String(materialType).toUpperCase()] : undefined;
  const factor = unit ? COUNT_UNIT_FACTORS[unit] : undefined;
  return unit && factor ? { unit, per: factor.per } : null;
}

// ── Job work bridge ─────────────────────────────────────────────────────────────────────────────
// job_work_orders.uom holds short codes (MTR / PCS / KG / TRIP) — the only vocabulary the JWO
// schema accepts. These two functions are the ONLY conversions between it and the enum.

export type JwoUom = 'MTR' | 'PCS' | 'KG';

/**
 * A job's `uom` → the stock unit its goods move in. TRIP-priced jobs move goods counted in pieces
 * (the behaviour every issuance path already had). Null for a code no job can carry.
 */
export function jwoUomToUnit(uom: string | null | undefined): Unit | null {
  return keyOf(uom) === 'TRIP' ? 'PIECE' : normalizeUnit(uom);
}

/** A stock unit → the `uom` a job work order carries, or null when a processor cannot be billed in it. */
export function unitToJwoUom(unit: string | null | undefined): JwoUom | null {
  switch (normalizeUnit(unit)) {
    case 'METER':
      return 'MTR';
    case 'PIECE':
      return 'PCS';
    case 'KILOGRAM':
      return 'KG';
    default:
      return null;
  }
}
