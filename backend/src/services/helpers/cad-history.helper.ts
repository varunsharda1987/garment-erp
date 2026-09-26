/**
 * CAD row history + the in-use check behind Reject.
 *
 * Until 2026-09-26 nothing recorded who changed a CAD. ESSKY082LS's approved average moved
 * 0.7033 → 0.8440 through Reject CAD Plan → edit → approve; approving again wiped `rejectedBy`,
 * no save wrote a trace, and the cost sheets, Order BOM and requirement built on 0.7033 were left
 * behind without anyone being told. So:
 *
 *  - every approve / reject / geometry save / correction writes ONE audit_logs row
 *    (entityType `fabric_width_cad`, entityId = the CAD row) through `recordCadEvent`;
 *  - `getCadHistory` reads them back for the row's History dialog;
 *  - `requireRejectConfirmation` stops a Reject from quietly stranding the approved cost sheets
 *    and order BOMs built on the row: the user must see them and confirm.
 *
 * Audit rows are written AFTER the business write commits (createAuditLog uses the global client and
 * never throws), so a history failure can never undo a save.
 */

import prisma from '../../config/database';
import { ConflictError } from '../../errors';
import { createAuditLog } from '../audit.service';
import { getCadCostingDependents } from './cad-costing-provenance.helper';

export const CAD_HISTORY_ENTITY = 'fabric_width_cad';

/** History event kinds, stored in audit_logs.action. RELINK_GREIGE came from a one-off data fix. */
export type CadHistoryAction = 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'CORRECT';

// ---------------------------------------------------------------------------
// Snapshots — the CAD fields whose change moves fabric quantity or identity
// ---------------------------------------------------------------------------

type Num = number | string | { toString(): string } | null | undefined;

export interface CadSnapshotSource {
  cadAverage?: Num;
  cadMeters?: Num;
  layerMarginMeters?: Num;
  piecesPerMarker?: Num;
  cutableWidth?: Num;
  greigeId?: string | null;
  fabricId?: string | null;
  purposeEnum?: string | null;
  purpose?: string | null;
  sizeBreakdowns?: Array<{ sizeName: string; quantity: number }> | null;
}

export interface CadSnapshot {
  cadAverage: number | null;
  cadMeters: number | null;
  layerMarginMeters: number | null;
  piecesPerMarker: number | null;
  cutableWidth: number | null;
  greigeId: string | null;
  fabricId: string | null;
  purpose: string | null;
  sizes: string | null;
}

const toNum = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
};

/**
 * "L×1, M×1, S×1" — sorted by size name so the same breakdown always reads the same (rows come back
 * from the database in no fixed order); null when there is no breakdown.
 */
function sizesLabel(rows: CadSnapshotSource['sizeBreakdowns']): string | null {
  if (!rows || rows.length === 0) return null;
  return [...rows]
    .sort((a, b) => a.sizeName.localeCompare(b.sizeName))
    .map((r) => `${r.sizeName}×${r.quantity}`)
    .join(', ');
}

export function cadSnapshot(row: CadSnapshotSource): CadSnapshot {
  return {
    cadAverage: toNum(row.cadAverage),
    cadMeters: toNum(row.cadMeters),
    layerMarginMeters: toNum(row.layerMarginMeters),
    piecesPerMarker: toNum(row.piecesPerMarker),
    cutableWidth: toNum(row.cutableWidth),
    greigeId: row.greigeId ?? null,
    fabricId: row.fabricId ?? null,
    purpose: row.purposeEnum ?? row.purpose ?? null,
    sizes: sizesLabel(row.sizeBreakdowns),
  };
}

/** Only the fields that changed; both halves empty when nothing did. */
export function diffCadSnapshots(
  before: CadSnapshot,
  after: CadSnapshot
): { old: Partial<CadSnapshot>; new: Partial<CadSnapshot> } {
  const oldPart: Partial<CadSnapshot> = {};
  const newPart: Partial<CadSnapshot> = {};
  for (const key of Object.keys(after) as Array<keyof CadSnapshot>) {
    if (before[key] !== after[key]) {
      (oldPart as Record<string, unknown>)[key] = before[key];
      (newPart as Record<string, unknown>)[key] = after[key];
    }
  }
  return { old: oldPart, new: newPart };
}

// ---------------------------------------------------------------------------
// Writing history
// ---------------------------------------------------------------------------

export async function recordCadEvent(args: {
  cadId: string;
  userId: string | null | undefined;
  action: CadHistoryAction;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string | null;
}): Promise<void> {
  const newValues = { ...(args.newValues ?? {}), ...(args.reason ? { reason: args.reason } : {}) };
  await createAuditLog({
    userId: args.userId ?? 'SYSTEM',
    action: args.action,
    entityType: CAD_HISTORY_ENTITY,
    entityId: args.cadId,
    oldValues: args.oldValues && Object.keys(args.oldValues).length > 0 ? args.oldValues : null,
    newValues: Object.keys(newValues).length > 0 ? newValues : null,
  });
}

/** An empty snapshot — the "before" of a newly created row. */
export const EMPTY_CAD_SNAPSHOT: CadSnapshot = cadSnapshot({});

/** Record a save only when a tracked field actually changed (a CREATE records the fields it set). */
export async function recordCadEdit(args: {
  cadId: string;
  userId: string | null | undefined;
  before: CadSnapshot;
  after: CadSnapshot;
  action?: 'CREATE' | 'UPDATE';
  reason?: string | null;
}): Promise<void> {
  const diff = diffCadSnapshots(args.before, args.after);
  if (Object.keys(diff.new).length === 0 && args.action !== 'CREATE') return;
  await recordCadEvent({
    cadId: args.cadId,
    userId: args.userId,
    action: args.action ?? 'UPDATE',
    oldValues: args.action === 'CREATE' ? null : diff.old,
    newValues: diff.new,
    reason: args.reason,
  });
}

// ---------------------------------------------------------------------------
// Reading history
// ---------------------------------------------------------------------------

export interface CadHistoryChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export interface CadHistoryEntry {
  id: string;
  at: Date;
  action: string;
  by: { name: string | null; email: string | null } | null;
  reason: string | null;
  changes: CadHistoryChange[];
  /** Approved cost sheets / orders a confirmed Reject went ahead over (Reject events only). */
  inUse: string | null;
}

/** Fields the History dialog shows; anything else a row carries is left out. */
const SHOWN_FIELDS = new Set([
  'cadAverage',
  'cadMeters',
  'layerMarginMeters',
  'piecesPerMarker',
  'cutableWidth',
  'greigeId',
  'fabricId',
  'purpose',
  'sizes',
  'approvalNotes',
]);

export async function getCadHistory(cadId: string): Promise<CadHistoryEntry[]> {
  const rows = await prisma.audit_logs.findMany({
    where: { entityType: CAD_HISTORY_ENTITY, entityId: cadId },
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: { users: { select: { firstName: true, lastName: true, email: true } } },
  });

  // Greige / fabric ids read as codes
  const greigeIds = new Set<string>();
  const fabricIds = new Set<string>();
  for (const r of rows) {
    for (const v of [r.oldValues, r.newValues] as Array<Record<string, unknown> | null>) {
      if (v && typeof v.greigeId === 'string') greigeIds.add(v.greigeId);
      if (v && typeof v.fabricId === 'string') fabricIds.add(v.fabricId);
    }
  }
  const [greiges, fabrics] = await Promise.all([
    greigeIds.size
      ? prisma.greige_master.findMany({ where: { id: { in: [...greigeIds] } }, select: { id: true, greigeCode: true } })
      : Promise.resolve([]),
    fabricIds.size
      ? prisma.fabric_master.findMany({ where: { id: { in: [...fabricIds] } }, select: { id: true, fabricCode: true } })
      : Promise.resolve([]),
  ]);
  const greigeCode = new Map(greiges.map((g) => [g.id, g.greigeCode]));
  const fabricCode = new Map(fabrics.map((f) => [f.id, f.fabricCode]));

  const display = (field: string, value: unknown): string | number | null => {
    if (value === null || value === undefined) return null;
    if (field === 'greigeId' && typeof value === 'string') return greigeCode.get(value) ?? value;
    if (field === 'fabricId' && typeof value === 'string') return fabricCode.get(value) ?? value;
    return typeof value === 'number' || typeof value === 'string' ? value : JSON.stringify(value);
  };

  return rows.map((r) => {
    const oldV = (r.oldValues ?? {}) as Record<string, unknown>;
    const newV = (r.newValues ?? {}) as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])].filter((f) => SHOWN_FIELDS.has(f));
    const name = r.users ? [r.users.firstName, r.users.lastName].filter(Boolean).join(' ') || null : null;
    return {
      id: r.id,
      at: r.timestamp,
      action: r.action,
      by: r.users ? { name, email: r.users.email } : null,
      reason: typeof newV.reason === 'string' ? newV.reason : null,
      changes: fields.map((field) => ({ field, from: display(field, oldV[field]), to: display(field, newV[field]) })),
      inUse: typeof newV.inUse === 'string' ? newV.inUse : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Reject: is anything approved built on this CAD?
// ---------------------------------------------------------------------------

export interface CadInUseEntry {
  cadId: string;
  costSheets: Array<{ costSheetId: string; version: number; purpose: string; styleCode: string | null }>;
  orders: Array<{ orderNumber: string; bomVersion: number; bomStatus: string }>;
}

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw material',
};

/** CAD rows with an approved, current cost sheet or an active order BOM built on them. */
export async function findCadsInUse(cadIds: string[]): Promise<CadInUseEntry[]> {
  const found: CadInUseEntry[] = [];
  for (const cadId of cadIds) {
    const deps = await getCadCostingDependents(cadId);
    const costSheets = deps.blockingCostSheets.map((s) => ({
      costSheetId: s.costSheetId,
      version: s.version,
      purpose: s.purpose,
      styleCode: s.styleCode,
    }));
    const orders = deps.orderBoms.map((b) => ({
      orderNumber: b.orderNumber,
      bomVersion: b.bomVersion,
      bomStatus: b.bomStatus,
    }));
    if (costSheets.length > 0 || orders.length > 0) found.push({ cadId, costSheets, orders });
  }
  return found;
}

/** "approved cost sheet v1 (Raw material) and the BOM of order ORD2026090132" */
export function describeCadUse(entries: CadInUseEntry[]): string {
  const sheets = new Map<string, string>();
  const orders = new Set<string>();
  for (const e of entries) {
    for (const s of e.costSheets) {
      sheets.set(s.costSheetId, `v${s.version} (${PURPOSE_LABEL[s.purpose] ?? s.purpose})`);
    }
    for (const o of e.orders) orders.add(o.orderNumber);
  }
  const parts: string[] = [];
  if (sheets.size > 0) {
    parts.push(`approved cost sheet${sheets.size > 1 ? 's' : ''} ${[...sheets.values()].join(', ')}`);
  }
  if (orders.size > 0) {
    parts.push(`the BOM of order${orders.size > 1 ? 's' : ''} ${[...orders].join(', ')}`);
  }
  return parts.join(' and ');
}

/**
 * A Reject clears the row's fabric price approval, and the cost sheets / order BOMs built on it keep
 * their old figures. Refuse (409 `CAD_IN_USE`, requiresConfirmation) until the user has seen what is
 * built on the row and confirmed. Returns the in-use list so the caller can record it.
 */
export async function requireRejectConfirmation(
  cadIds: string[],
  confirmImpact: boolean | undefined
): Promise<CadInUseEntry[]> {
  const inUse = await findCadsInUse(cadIds);
  if (inUse.length > 0 && confirmImpact !== true) {
    throw new ConflictError(
      `This CAD is already used by ${describeCadUse(inUse)}. Rejecting it clears its fabric price approval, ` +
        'and those will NOT update — they stay on the old figures. Confirm to reject anyway.',
      { code: 'CAD_IN_USE', requiresConfirmation: true, inUse }
    );
  }
  return inUse;
}
