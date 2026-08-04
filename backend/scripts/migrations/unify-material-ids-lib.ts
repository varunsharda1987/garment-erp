/**
 * Shared logic for the materials-id unification (material-identity project, 2026-08).
 *
 * Target state: materials.id === master.id for every master-backed material;
 * label size rows use label_size_variants.id. Legacy `mat-<code>` ids are renamed
 * (or merged, when a same-id row already exists — only possible for LABELs, the one
 * non-unique FK).
 *
 * Used by: unify-material-ids-audit.ts (read-only), unify-material-ids.ts (writer),
 * unify-material-ids-verify.ts (read-only).
 */
import { MASTER_CONFIG } from '../../src/services/helpers/master-config';

export interface MapEntry {
  oldId: string;
  newId: string;
  materialType: string;
  action: 'RENAME' | 'MERGE';
  /** For label size rows resolved by (labelId, size) parse: variant id to backfill */
  backfillSizeVariantId?: string;
  reason: string;
}

export interface AuditResult {
  map: MapEntry[];
  /** materials rows already conforming (id === target) — no-ops */
  conforming: number;
  /** rows with NO master FK at all (GENERIC/orphans) — carried over untouched */
  orphans: { id: string; code: string; materialType: string }[];
  /** rows we could NOT resolve a target for — HARD BLOCKERS, must be zero to migrate */
  unresolved: { id: string; code: string; materialType: string; problem: string }[];
  /** duplicate-target collisions inside the map itself (two rows → same new id) — blockers */
  duplicateTargets: string[];
}

// The FK precedence: sizeVariantId first (label size rows), then every unique type FK,
// labelId LAST (size rows also carry labelId — it must never win over sizeVariantId).
const TYPE_FKS: { field: string; type: string }[] = Object.entries(MASTER_CONFIG)
  .filter(([t]) => t !== 'LABEL')
  .map(([type, cfg]) => ({ field: cfg.fkField, type }));

/**
 * Build the old→new id map from the live materials table.
 * Read-only — safe to call from audit/verify and inside the migration transaction.
 */
export async function buildIdMap(client: any): Promise<AuditResult> {
  const rows: any[] = await client.materials.findMany({
    select: {
      id: true,
      code: true,
      materialType: true,
      sizeVariantId: true,
      labelId: true,
      ...Object.fromEntries(TYPE_FKS.map((f) => [f.field, true])),
    },
  });

  const existingIds = new Set(rows.map((r) => r.id));
  const map: MapEntry[] = [];
  const orphans: AuditResult['orphans'] = [];
  const unresolved: AuditResult['unresolved'] = [];
  let conforming = 0;

  // Preload label size variants for size-row resolution (labelId → [{id, size}])
  const variants: any[] = await client.label_size_variants.findMany({
    select: { id: true, size: true, labelId: true, label: { select: { labelCode: true } } },
  });
  const variantsByLabel = new Map<string, { id: string; size: string; labelCode: string }[]>();
  for (const v of variants) {
    const list = variantsByLabel.get(v.labelId) || [];
    list.push({ id: v.id, size: v.size, labelCode: v.label?.labelCode || '' });
    variantsByLabel.set(v.labelId, list);
  }

  for (const row of rows) {
    let target: string | null = null;
    let backfillSizeVariantId: string | undefined;
    let reason = '';

    if (row.sizeVariantId) {
      target = row.sizeVariantId;
      reason = 'label size row → label_size_variants.id';
    } else {
      const fk = TYPE_FKS.find((f) => row[f.field]);
      if (fk) {
        target = row[fk.field];
        reason = `${fk.type} → master id`;
      } else if (row.labelId) {
        // LABEL with no sizeVariantId: base row (code === labelCode) or a legacy size row
        // whose sizeVariantId was never stamped (resolve via labelCode-SIZE code parse).
        const labelVariants = variantsByLabel.get(row.labelId) || [];
        const sizeMatch = labelVariants.find(
          (v) => v.labelCode && row.code.toLowerCase() === `${v.labelCode}-${v.size}`.toLowerCase()
        );
        if (sizeMatch) {
          target = sizeMatch.id;
          backfillSizeVariantId = sizeMatch.id;
          reason = `label size row (parsed ${row.code}) → variant id`;
        } else {
          target = row.labelId;
          reason = 'label base row → label_master.id';
        }
      }
    }

    if (!target) {
      orphans.push({ id: row.id, code: row.code, materialType: row.materialType });
      continue;
    }
    if (target === row.id) {
      conforming++;
      continue;
    }

    map.push({
      oldId: row.id,
      newId: target,
      materialType: row.materialType,
      action: existingIds.has(target) ? 'MERGE' : 'RENAME',
      backfillSizeVariantId,
      reason,
    });
  }

  // Two different old rows resolving to the SAME new id would collide on rename
  const targetCounts = new Map<string, number>();
  for (const m of map) targetCounts.set(m.newId, (targetCounts.get(m.newId) || 0) + 1);
  const duplicateTargets = [...targetCounts.entries()].filter(([, n]) => n > 1).map(([t]) => t);

  // Verify every RENAME target's master actually exists (paranoia — FK columns imply it,
  // but the map is the contract for the destructive step)
  return { map, conforming, orphans, unresolved, duplicateTargets };
}

/** Every FK into materials(id) must be ON UPDATE CASCADE for the single-UPDATE rename to work. */
export async function checkFkCascade(client: any): Promise<{ ok: boolean; rows: any[] }> {
  const rows: any[] = await client.$queryRawUnsafe(`
    SELECT tc.table_name, rc.update_rule, rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name
    WHERE ccu.table_name = 'materials' AND ccu.column_name = 'id'
  `);
  return { ok: rows.every((r) => r.update_rule === 'CASCADE'), rows };
}

/** Tables holding materials.id WITHOUT a Prisma relation — cascade misses them. */
export const DANGLING_COLUMNS = [
  { table: 'stock_settings', column: 'materialId' },
  { table: 'challan_items', column: 'materialId' },
  { table: 'style_costing_trim_items', column: 'materialId' },
  { table: 'style_costing_accessory_items', column: 'materialId' },
];

/** Relation-bearing children (cascade handles the rename; merges must repoint these). */
export const RELATION_CHILDREN = [
  'stock_levels',
  'stock_movements',
  'stock_transactions',
  'stock_reservations',
  'stock_count_items',
  'inventory_stock',
  'grn_items',
  'purchase_order_items',
  'material_requirements',
  'material_requisition_items',
  'material_suppliers',
  'order_bom_items',
  'style_material_bom',
  'customer_accessories_preset_items',
];

export interface Baselines {
  stockTotal: string;
  stockPerWarehouse: Record<string, string>;
  rowCounts: Record<string, number>;
  matStarCount: number;
}

export async function collectBaselines(client: any): Promise<Baselines> {
  const [total]: any[] = await client.$queryRawUnsafe(
    `SELECT COALESCE(SUM(quantity), 0)::text AS t FROM stock_levels`
  );
  const perWh: any[] = await client.$queryRawUnsafe(
    `SELECT "warehouseId", COALESCE(SUM(quantity), 0)::text AS t FROM stock_levels GROUP BY 1`
  );
  const rowCounts: Record<string, number> = {};
  for (const t of [...RELATION_CHILDREN, ...DANGLING_COLUMNS.map((d) => d.table), 'materials']) {
    if (t in rowCounts) continue;
    const [{ n }]: any[] = await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${t}`);
    rowCounts[t] = n;
  }
  const [{ n: matStarCount }]: any[] = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM materials WHERE id LIKE 'mat-%'`
  );
  return {
    stockTotal: total.t,
    stockPerWarehouse: Object.fromEntries(perWh.map((r) => [r.warehouseId, r.t])),
    rowCounts,
    matStarCount,
  };
}
