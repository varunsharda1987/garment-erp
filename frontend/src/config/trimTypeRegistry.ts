/**
 * Unified Trim Type Registry
 *
 * Single source of truth for ALL trim types (legacy + generic).
 * Used by CostSheetForm, TrimMasterCombobox, and anywhere trim types are listed.
 *
 * Adding a new trim type? Just add an entry here — no other code changes needed
 * in the cost sheet or combobox.
 */

import { Unit } from '@/types/material.types';

export interface TrimTypeEntry {
  /** MaterialType enum value (e.g., 'DRAWSTRING') */
  value: string;
  /** Display label (e.g., 'Drawstring') */
  label: string;
  /** FK field name on TrimDetail / style_material_bom (e.g., 'drawstringId') */
  idField: string;
  /** Whether this uses the genericTrim service (true) or a legacy-specific service (false) */
  isGeneric: boolean;
  /** For generic trims: the API route key (e.g., 'drawstring') */
  apiKey?: string;
  /** Name field on the master record (e.g., 'drawstringName') */
  nameField?: string;
  /** Code field on the master record (e.g., 'drawstringCode') */
  codeField?: string;
  /** Price field on the master record (e.g., 'pricePerMeter') */
  priceField?: string;
  /** Default unit (e.g., Unit.METER) */
  defaultUnit?: Unit;
}

// Legacy trim types — use dedicated services (thread.service, button.service, etc.)
const LEGACY_TRIM_TYPES: TrimTypeEntry[] = [
  { value: 'THREAD', label: 'Thread', idField: 'threadId', isGeneric: false },
  { value: 'BUTTON', label: 'Button', idField: 'buttonId', isGeneric: false },
  { value: 'ZIPPER', label: 'Zipper', idField: 'zipperId', isGeneric: false },
  { value: 'ELASTIC', label: 'Elastic', idField: 'elasticId', isGeneric: false },
  { value: 'LACE', label: 'Lace', idField: 'laceId', isGeneric: false },
  { value: 'LABEL', label: 'Label', idField: 'labelId', isGeneric: false },
  { value: 'PACKAGING', label: 'Packaging', idField: 'packagingId', isGeneric: false },
];

// Generic trim types — all use genericTrimService
const GENERIC_TRIM_TYPES: TrimTypeEntry[] = [
  {
    value: 'HOOK_EYE',
    label: 'Hook & Eye',
    idField: 'hookEyeId',
    isGeneric: true,
    apiKey: 'hook_eye',
    nameField: 'hookEyeName',
    codeField: 'hookEyeCode',
    priceField: 'pricePerPair',
    defaultUnit: Unit.PAIR,
  },
  {
    value: 'SNAP_BUTTON',
    label: 'Snap Button',
    idField: 'snapButtonId',
    isGeneric: true,
    apiKey: 'snap_button',
    nameField: 'snapButtonName',
    codeField: 'snapButtonCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'BUCKLE',
    label: 'Buckle',
    idField: 'buckleId',
    isGeneric: true,
    apiKey: 'buckle',
    nameField: 'buckleName',
    codeField: 'buckleCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'BELT',
    label: 'Belt',
    idField: 'beltId',
    isGeneric: true,
    apiKey: 'belt',
    nameField: 'beltName',
    codeField: 'beltCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'VELCRO',
    label: 'Velcro',
    idField: 'velcroId',
    isGeneric: true,
    apiKey: 'velcro',
    nameField: 'velcroName',
    codeField: 'velcroCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'OTHER_FASTENER',
    label: 'Other Fastener',
    idField: 'otherFastenerId',
    isGeneric: true,
    apiKey: 'other_fastener',
    nameField: 'otherFastenerName',
    codeField: 'otherFastenerCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'DRAWSTRING',
    label: 'Drawstring',
    idField: 'drawstringId',
    isGeneric: true,
    apiKey: 'drawstring',
    nameField: 'drawstringName',
    codeField: 'drawstringCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'RIBBON',
    label: 'Ribbon',
    idField: 'ribbonId',
    isGeneric: true,
    apiKey: 'ribbon',
    nameField: 'ribbonName',
    codeField: 'ribbonCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'OTHER_TAPE',
    label: 'Other Tape',
    idField: 'otherTapeId',
    isGeneric: true,
    apiKey: 'other_tape',
    nameField: 'otherTapeName',
    codeField: 'otherTapeCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'SEQUIN',
    label: 'Sequin',
    idField: 'sequinId',
    isGeneric: true,
    apiKey: 'sequin',
    nameField: 'sequinName',
    codeField: 'sequinCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'BEAD',
    label: 'Bead',
    idField: 'beadId',
    isGeneric: true,
    apiKey: 'bead',
    nameField: 'beadName',
    codeField: 'beadCode',
    priceField: 'pricePerPack',
    defaultUnit: Unit.PACK,
  },
  {
    value: 'MOTIF',
    label: 'Motif',
    idField: 'motifId',
    isGeneric: true,
    apiKey: 'motif',
    nameField: 'motifName',
    codeField: 'motifCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'OTHER_DECORATIVE',
    label: 'Other Decorative',
    idField: 'otherDecorativeId',
    isGeneric: true,
    apiKey: 'other_decorative',
    nameField: 'otherDecorativeName',
    codeField: 'otherDecorativeCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
  {
    value: 'INTERLINING',
    label: 'Interlining',
    idField: 'interliningId',
    isGeneric: true,
    apiKey: 'interlining',
    nameField: 'interliningName',
    codeField: 'interliningCode',
    priceField: 'pricePerMeter',
    defaultUnit: Unit.METER,
  },
  {
    value: 'PADDING',
    label: 'Padding',
    idField: 'paddingId',
    isGeneric: true,
    apiKey: 'padding',
    nameField: 'paddingName',
    codeField: 'paddingCode',
    priceField: 'pricePerPair',
    defaultUnit: Unit.PAIR,
  },
  {
    value: 'OTHER_FUNCTIONAL',
    label: 'Other Functional',
    idField: 'otherFunctionalId',
    isGeneric: true,
    apiKey: 'other_functional',
    nameField: 'otherFunctionalName',
    codeField: 'otherFunctionalCode',
    priceField: 'pricePerPiece',
    defaultUnit: Unit.PIECE,
  },
];

/** All trim types (legacy + generic) */
export const ALL_TRIM_TYPES: TrimTypeEntry[] = [...LEGACY_TRIM_TYPES, ...GENERIC_TRIM_TYPES];

/** Lookup by materialType value → entry */
export const TRIM_TYPE_REGISTRY: Record<string, TrimTypeEntry> = Object.fromEntries(
  ALL_TRIM_TYPES.map((t) => [t.value, t])
);

/** Get the FK field name for a materialType (e.g., 'DRAWSTRING' → 'drawstringId') */
export function getTrimIdField(materialType: string): string | undefined {
  return TRIM_TYPE_REGISTRY[materialType]?.idField;
}

/** Check if a materialType is a known trim type (not 'OTHER') */
export function isKnownTrimType(materialType: string): boolean {
  return materialType in TRIM_TYPE_REGISTRY;
}
