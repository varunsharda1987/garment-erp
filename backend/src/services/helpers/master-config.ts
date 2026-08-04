/**
 * Master-type configuration — the SINGLE source of truth for how each physical-good
 * master table wires into the unified `materials` registry.
 *
 * One entry per master-backed MaterialType (27 total). Consumed by:
 *  - material.service.ts createFromMaster()/getOrCreateCategory() (id/unit/category assignment)
 *  - material-sync.helper.ts ensureMaterialRecord()/syncMasterToMaterials() (lookups + sync)
 *
 * INVARIANT (material-identity project, 2026-08): materials.id === master.id for every
 * master-backed material. Never hand-write a materials id (`mat-<code>` is the legacy
 * convention being migrated away; the smart-check manual-material-create ratchet blocks it).
 *
 * categoryName is matched by NAME first (live DBs predate the CAT-* id convention —
 * e.g. Buttons is `cat-buttons`); categoryId is only used when auto-creating.
 */

import type { Unit } from '@prisma/client';

export interface MasterTypeConfig {
  /** Prisma model name of the master table */
  table: string;
  codeField: string;
  nameField: string;
  /** FK column on `materials` pointing at this master */
  fkField: string;
  /** Default unit for the materials row */
  unit: Unit;
  /** Category id used ONLY when auto-creating (existing DBs matched by name) */
  categoryId: string;
  categoryName: string;
}

export const MASTER_CONFIG: Record<string, MasterTypeConfig> = {
  GREIGE: {
    table: 'greige_master',
    codeField: 'greigeCode',
    nameField: 'greigeName',
    fkField: 'greigeId',
    unit: 'METER',
    categoryId: 'CAT-GREIGE',
    categoryName: 'Greige (Raw Fabric)',
  },
  FABRIC: {
    table: 'fabric_master',
    codeField: 'fabricCode',
    nameField: 'fabricName',
    fkField: 'fabricId',
    unit: 'METER',
    categoryId: 'CAT-FABRIC',
    categoryName: 'Fabric',
  },
  LACE: {
    table: 'lace_master',
    codeField: 'laceCode',
    nameField: 'laceName',
    fkField: 'laceId',
    unit: 'METER',
    categoryId: 'CAT-LACE',
    categoryName: 'Lace',
  },
  THREAD: {
    table: 'thread_master',
    codeField: 'threadCode',
    nameField: 'threadName',
    fkField: 'threadId',
    unit: 'CONE',
    categoryId: 'CAT-THREAD',
    categoryName: 'Threads',
  },
  BUTTON: {
    table: 'button_master',
    codeField: 'buttonCode',
    nameField: 'buttonName',
    fkField: 'buttonId',
    unit: 'PIECE',
    categoryId: 'CAT-BUTTON',
    categoryName: 'Buttons',
  },
  ZIPPER: {
    table: 'zipper_master',
    codeField: 'zipperCode',
    nameField: 'zipperName',
    fkField: 'zipperId',
    unit: 'PIECE',
    categoryId: 'CAT-ZIPPER',
    categoryName: 'Zipper',
  },
  ELASTIC: {
    table: 'elastic_master',
    codeField: 'elasticCode',
    nameField: 'elasticName',
    fkField: 'elasticId',
    unit: 'METER',
    categoryId: 'CAT-ELASTIC',
    categoryName: 'Elastic',
  },
  LABEL: {
    table: 'label_master',
    codeField: 'labelCode',
    nameField: 'labelName',
    fkField: 'labelId',
    unit: 'PIECE',
    categoryId: 'CAT-LABEL',
    categoryName: 'Label',
  },
  PACKAGING: {
    table: 'packaging_master',
    codeField: 'packagingCode',
    nameField: 'packagingName',
    fkField: 'packagingId',
    unit: 'PIECE',
    categoryId: 'CAT-PACKAGING',
    categoryName: 'Packaging',
  },
  MACHINE_PART: {
    table: 'machine_part_master',
    codeField: 'partCode',
    nameField: 'partName',
    fkField: 'machinePartId',
    unit: 'PIECE',
    categoryId: 'CAT-MACHINE-PART',
    categoryName: 'Machine Parts',
  },
  OTHER_MATERIAL: {
    table: 'other_material_master',
    codeField: 'materialCode',
    nameField: 'materialName',
    fkField: 'otherMaterialId',
    unit: 'PIECE',
    categoryId: 'CAT-OTHER',
    categoryName: 'Other',
  },
  // Extended trims (units mirror generic-trim.controller TRIM_CONFIGS defaults)
  HOOK_EYE: {
    table: 'hook_eye_master',
    codeField: 'hookEyeCode',
    nameField: 'hookEyeName',
    fkField: 'hookEyeId',
    unit: 'PAIR',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  SNAP_BUTTON: {
    table: 'snap_button_master',
    codeField: 'snapButtonCode',
    nameField: 'snapButtonName',
    fkField: 'snapButtonId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  BUCKLE: {
    table: 'buckle_master',
    codeField: 'buckleCode',
    nameField: 'buckleName',
    fkField: 'buckleId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  BELT: {
    table: 'belt_master',
    codeField: 'beltCode',
    nameField: 'beltName',
    fkField: 'beltId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  VELCRO: {
    table: 'velcro_master',
    codeField: 'velcroCode',
    nameField: 'velcroName',
    fkField: 'velcroId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  DRAWSTRING: {
    table: 'drawstring_master',
    codeField: 'drawstringCode',
    nameField: 'drawstringName',
    fkField: 'drawstringId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  RIBBON: {
    table: 'ribbon_master',
    codeField: 'ribbonCode',
    nameField: 'ribbonName',
    fkField: 'ribbonId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  SEQUIN: {
    table: 'sequin_master',
    codeField: 'sequinCode',
    nameField: 'sequinName',
    fkField: 'sequinId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  BEAD: {
    table: 'bead_master',
    codeField: 'beadCode',
    nameField: 'beadName',
    fkField: 'beadId',
    unit: 'PACK',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  MOTIF: {
    table: 'motif_master',
    codeField: 'motifCode',
    nameField: 'motifName',
    fkField: 'motifId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  INTERLINING: {
    table: 'interlining_master',
    codeField: 'interliningCode',
    nameField: 'interliningName',
    fkField: 'interliningId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  PADDING: {
    table: 'padding_master',
    codeField: 'paddingCode',
    nameField: 'paddingName',
    fkField: 'paddingId',
    unit: 'PAIR',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  OTHER_FASTENER: {
    table: 'other_fastener_master',
    codeField: 'otherFastenerCode',
    nameField: 'otherFastenerName',
    fkField: 'otherFastenerId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  OTHER_TAPE: {
    table: 'other_tape_master',
    codeField: 'otherTapeCode',
    nameField: 'otherTapeName',
    fkField: 'otherTapeId',
    unit: 'METER',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  OTHER_DECORATIVE: {
    table: 'other_decorative_master',
    codeField: 'otherDecorativeCode',
    nameField: 'otherDecorativeName',
    fkField: 'otherDecorativeId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
  OTHER_FUNCTIONAL: {
    table: 'other_functional_master',
    codeField: 'otherFunctionalCode',
    nameField: 'otherFunctionalName',
    fkField: 'otherFunctionalId',
    unit: 'PIECE',
    categoryId: 'CAT-ACCESSORIES',
    categoryName: 'Accessories',
  },
};
