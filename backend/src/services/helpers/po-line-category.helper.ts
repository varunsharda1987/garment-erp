/**
 * Which materials a PO category takes — ONE rule, enforced by every PO line writer (manual create,
 * edit, add-item, unified creation) and mirrored by the PO form's material list.
 *
 * Why it matters: the GRN books a line by its PO's category. Greige, fabric, lace and thread POs book
 * their lots in their OWN branch (`OWN_LOT_BRANCH_CATEGORIES`, grn.service.ts) and skip a line that is
 * not theirs, so a button on a Lace PO, or a greige with no greige master on a Greige PO, was received
 * and booked NOTHING — no lot, no stock level, and nothing said so (PO form bug hunt #4, 2026-09-28).
 * Every other category books through stock_levels and reaches a trim's lot by the LINE's material, so
 * Trims and General take anything that is not one of those four (labels and packaging included — MRP
 * files them on a Trims PO).
 *
 * Service lines (serviceType, no material) are not checked here. Categories the rule does not cover —
 * the retired processing / service ones, which no PO can be created with any more — are not checked.
 */

import type { POCategory, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import { MATERIAL_PO_CATEGORIES } from '../../types/purchaseOrder.types';

/** What the rule needs to know about a material. */
export interface PoLineMaterialFacts {
  materialType: string | null | undefined;
  /** materials.greigeId is set */
  hasGreigeMaster: boolean;
  /** materials.fabricId is set */
  hasFabricMaster: boolean;
  /** lace_master.isGreige — null when the material has no lace master */
  laceIsGreige: boolean | null;
}

/** The four types whose receipt books its lot in its own GRN branch — never on a Trims / General PO. */
const OWN_LOT_TYPES = new Set(['GREIGE', 'FABRIC', 'LACE', 'THREAD']);

const notOwnLot = (m: PoLineMaterialFacts) => !OWN_LOT_TYPES.has(m.materialType ?? '');
const ofType =
  (...types: string[]) =>
  (m: PoLineMaterialFacts) =>
    types.includes(m.materialType ?? '');

/** Category → does this material belong on it. A category missing here is not checked. */
const CATEGORY_RULE: Partial<Record<POCategory, (m: PoLineMaterialFacts) => boolean>> = {
  GREIGE: (m) => m.materialType === 'GREIGE' && m.hasGreigeMaster,
  FABRIC: (m) => m.materialType === 'FABRIC' && m.hasFabricMaster,
  LACE: (m) => m.materialType === 'LACE' && m.laceIsGreige === false,
  GREIGE_LACE: (m) => m.materialType === 'LACE' && m.laceIsGreige === true,
  THREAD: ofType('THREAD'),
  PACKAGING: ofType('PACKAGING'),
  MACHINE_PART: ofType('MACHINE_PART'),
  TRIMS: notOwnLot,
  GENERAL: notOwnLot,
  // The specific trim categories the schema still carries (creatable by API, not offered on the page)
  BUTTON: ofType('BUTTON', 'SNAP_BUTTON'),
  ZIPPER: ofType('ZIPPER'),
  ELASTIC: ofType('ELASTIC'),
  LABEL: ofType('LABEL'),
  OTHER_MATERIAL: notOwnLot,
};

/** The page's names for the categories the rule covers (frontend PO_CATEGORY_LABELS). */
const CATEGORY_LABEL: Partial<Record<POCategory, string>> = {
  FABRIC: 'Fabric',
  GREIGE: 'Greige',
  TRIMS: 'Trims',
  THREAD: 'Thread',
  LACE: 'Lace',
  GREIGE_LACE: 'Greige Lace',
  PACKAGING: 'Packaging',
  MACHINE_PART: 'Machine Parts',
  GENERAL: 'General',
  BUTTON: 'Buttons',
  ZIPPER: 'Zippers',
  ELASTIC: 'Elastic',
  LABEL: 'Labels',
  OTHER_MATERIAL: 'Other Material',
};

/** True when the rule covers this category (a null / retired category is not checked). */
export function isCategoryChecked(category: string | null | undefined): category is POCategory {
  return !!category && category in CATEGORY_RULE;
}

/** Does this material belong on a PO of this category? An unchecked category takes anything. */
export function fitsPoCategory(category: string | null | undefined, m: PoLineMaterialFacts): boolean {
  if (!isCategoryChecked(category)) return true;
  return CATEGORY_RULE[category]!(m);
}

/** Every category (the rule covers) this material may go on, in the page's order first. */
export function allowedPoCategories(m: PoLineMaterialFacts): POCategory[] {
  const all = Object.keys(CATEGORY_RULE) as POCategory[];
  const pageFirst = [...MATERIAL_PO_CATEGORIES, ...all.filter((c) => !MATERIAL_PO_CATEGORIES.includes(c))];
  return pageFirst.filter((c) => CATEGORY_RULE[c]!(m));
}

/** "a button", "an elastic", "a greige lace", "a greige with no greige master" */
function describeMaterial(m: PoLineMaterialFacts): string {
  const type = m.materialType ?? 'material';
  let word = type.toLowerCase().replace(/_/g, ' ');
  if (type === 'LACE') {
    word = m.laceIsGreige === true ? 'greige lace' : m.laceIsGreige === false ? 'finished lace' : 'lace';
  }
  const missingMaster =
    (type === 'GREIGE' && !m.hasGreigeMaster) ||
    (type === 'FABRIC' && !m.hasFabricMaster) ||
    (type === 'LACE' && m.laceIsGreige === null);
  if (missingMaster) word += ` with no ${type.toLowerCase()} master`;
  return `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;
}

/**
 * Why a material does not belong on a PO of this category, in the owner's words — null when it does.
 * "BTN-0003 Shell Button is a button — it goes on a Trims, General PO, not a Lace PO."
 */
export function wrongCategoryMessage(
  category: string | null | undefined,
  material: { code: string; name: string } & PoLineMaterialFacts
): string | null {
  if (fitsPoCategory(category, material)) return null;
  const label = CATEGORY_LABEL[category as POCategory] ?? String(category);
  const who = `${material.code} ${material.name} is ${describeMaterial(material)}`;
  // Name the page's categories it CAN go on; the API-only trim categories would only confuse
  const onPage = allowedPoCategories(material).filter((c) => MATERIAL_PO_CATEGORIES.includes(c));
  if (onPage.length === 0) {
    return `${who} — link it to its master before ordering it (it cannot go on a ${label} PO or any other).`;
  }
  return `${who} — it goes on a ${onPage.map((c) => CATEGORY_LABEL[c]).join(', ')} PO, not a ${label} PO.`;
}

/** The rule's facts for these materials, in ONE query. A missing id is simply absent. */
export async function loadPoLineMaterials(
  materialIds: ReadonlyArray<string>,
  tx?: Prisma.TransactionClient
): Promise<Map<string, { code: string; name: string } & PoLineMaterialFacts>> {
  const ids = Array.from(new Set(materialIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows = await (tx ?? prisma).materials.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      name: true,
      materialType: true,
      greigeId: true,
      fabricId: true,
      lace_master: { select: { isGreige: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.id,
      {
        code: r.code,
        name: r.name,
        materialType: r.materialType,
        hasGreigeMaster: !!r.greigeId,
        hasFabricMaster: !!r.fabricId,
        laceIsGreige: r.lace_master ? r.lace_master.isGreige : null,
      },
    ])
  );
}

/** Every line that does not belong on a PO of this category, with the reason. Empty = all fit. */
export async function linesOutsideCategory(
  category: string | null | undefined,
  items: ReadonlyArray<{ materialId?: string | null }>,
  tx?: Prisma.TransactionClient
): Promise<Array<{ materialId: string; message: string }>> {
  if (!isCategoryChecked(category)) return [];
  const materials = await loadPoLineMaterials(
    items.map((i) => i.materialId).filter((id): id is string => !!id),
    tx
  );
  const out: Array<{ materialId: string; message: string }> = [];
  for (const [materialId, material] of materials) {
    const message = wrongCategoryMessage(category, material);
    if (message) out.push({ materialId, message });
  }
  return out;
}

/** Refuse (422 PO_LINE_WRONG_CATEGORY) a PO whose material lines do not belong on its category. */
export async function assertPoLinesFitCategory(
  category: string | null | undefined,
  items: ReadonlyArray<{ materialId?: string | null }>,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const wrong = await linesOutsideCategory(category, items, tx);
  if (wrong.length === 0) return;
  const more = wrong.length > 1 ? ` (and ${wrong.length - 1} more line${wrong.length > 2 ? 's' : ''})` : '';
  throw new BusinessError(`${wrong[0].message}${more}`, {
    code: 'PO_LINE_WRONG_CATEGORY',
    poCategory: category,
    materialIds: wrong.map((w) => w.materialId),
  });
}
