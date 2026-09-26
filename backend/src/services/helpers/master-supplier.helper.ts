/**
 * Who supplies a label or packaging item, and at what price — read from the master's OWN supplier table.
 *
 * `label_suppliers` and `packaging_suppliers` are what the Label and Packaging pages write: the one home of
 * "this supplier makes this label, at this price". `material_suppliers` is a copy that nothing keeps up for
 * these two types — a March 2026 script linked ONE arbitrary size row per label (usually XS) and no writer
 * has touched it since. Everything that read it saw the other sizes as having no supplier and no price: the
 * PO form offered only XS, MRP left size lines "Not Assigned" and refused their PO at ₹0 (2026-09-26).
 *
 * A label's size rows carry the label's id in `materials.labelId` (their own id is the size variant's), so
 * every size inherits the label's suppliers. Read through here; do not copy these rows into
 * material_suppliers — a second copy drifts exactly as the first one did.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { divideCurrency, toNumber } from '../../utils/currency';

export interface MasterSupplierLink {
  supplierId: string;
  isPreferred: boolean;
  /** Price per piece this supplier charges, when recorded (a per-hundred price is converted). */
  pricePerUnit: number | null;
}

type Ids = ReadonlyArray<string | null | undefined>;

const unique = (ids: Ids) => Array.from(new Set(ids.filter((id): id is string => !!id)));
const positive = (value: Prisma.Decimal | null | undefined) =>
  value != null && Number(value) > 0 ? Number(value) : null;

function push<K>(map: Map<K, MasterSupplierLink[]>, key: K, link: MasterSupplierLink) {
  map.set(key, [...(map.get(key) ?? []), link]);
}

/** Active supplier links per label id and per packaging id — preferred supplier first. */
export async function loadMasterSupplierLinks(
  keys: { labelIds?: Ids; packagingIds?: Ids },
  tx?: Prisma.TransactionClient
): Promise<{ byLabel: Map<string, MasterSupplierLink[]>; byPackaging: Map<string, MasterSupplierLink[]> }> {
  const db = tx ?? prisma;
  const labelIds = unique(keys.labelIds ?? []);
  const packagingIds = unique(keys.packagingIds ?? []);
  const [labelRows, packagingRows] = await Promise.all([
    labelIds.length
      ? db.label_suppliers.findMany({
          where: { labelId: { in: labelIds }, isActive: true },
          select: { labelId: true, supplierId: true, isPreferred: true, pricePerPiece: true, pricePerHundred: true },
          orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
        })
      : [],
    packagingIds.length
      ? db.packaging_suppliers.findMany({
          where: { packagingId: { in: packagingIds }, isActive: true },
          select: { packagingId: true, supplierId: true, isPreferred: true, pricePerPiece: true },
          orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
        })
      : [],
  ]);

  const byLabel = new Map<string, MasterSupplierLink[]>();
  for (const r of labelRows) {
    const perHundred = positive(r.pricePerHundred);
    push(byLabel, r.labelId, {
      supplierId: r.supplierId,
      isPreferred: r.isPreferred,
      pricePerUnit: positive(r.pricePerPiece) ?? (perHundred ? toNumber(divideCurrency(perHundred, 100)) : null),
    });
  }
  const byPackaging = new Map<string, MasterSupplierLink[]>();
  for (const r of packagingRows) {
    push(byPackaging, r.packagingId, {
      supplierId: r.supplierId,
      isPreferred: r.isPreferred,
      pricePerUnit: positive(r.pricePerPiece),
    });
  }
  return { byLabel, byPackaging };
}

/** Supplier links for materials rows (a label's base row, any of its size rows, a packaging row), by materials id. */
export async function loadMaterialMasterSuppliers(
  materialIds: Ids,
  tx?: Prisma.TransactionClient
): Promise<Map<string, MasterSupplierLink[]>> {
  const ids = unique(materialIds);
  if (ids.length === 0) return new Map();
  const rows = await (tx ?? prisma).materials.findMany({
    where: { id: { in: ids } },
    select: { id: true, labelId: true, packagingId: true },
  });
  const { byLabel, byPackaging } = await loadMasterSupplierLinks(
    { labelIds: rows.map((r) => r.labelId), packagingIds: rows.map((r) => r.packagingId) },
    tx
  );
  const out = new Map<string, MasterSupplierLink[]>();
  for (const r of rows) {
    const links = (r.labelId && byLabel.get(r.labelId)) || (r.packagingId && byPackaging.get(r.packagingId));
    if (links) out.set(r.id, links);
  }
  return out;
}

/**
 * The supplier to plan against: the one marked preferred, or the only one there is. With several suppliers
 * and none preferred there is no answer to guess — null, and the planner assigns one.
 */
export function preferredMasterSupplierId(links: MasterSupplierLink[] | undefined): string | null {
  if (!links?.length) return null;
  return links.find((l) => l.isPreferred)?.supplierId ?? (links.length === 1 ? links[0].supplierId : null);
}

/** The price this supplier charges for it, when recorded on the master's supplier row. */
export function masterSupplierPrice(links: MasterSupplierLink[] | undefined, supplierId: string): number | null {
  return links?.find((l) => l.supplierId === supplierId)?.pricePerUnit ?? null;
}
