/**
 * What tells one material from another in a picker — the ONE place GET /api/materials reads it from.
 *
 * The PO form's Quick Add listed 91 labels as "LBL-0016 - Main Label", "LBL-0009 - Main Label", … with no
 * way to tell whose label each was (2026-09-28). The facts that tell them apart live on the type master,
 * not on `materials`, so each list item gains two lines of text:
 *
 *  - `buyerBrand` — whose it is: the customer · the brand ("House Of Kasya Pvt Ltd · Nihsamah - Sleepwear").
 *    Only label and packaging masters carry a customer / brand; everything else is null.
 *  - `spec` — the master's own distinguishing facts, " · "-joined, blanks skipped ("16L · 4 holes · Galaxy").
 *
 * One query per material TYPE on the page (never one per row). The master is found by the materials
 * row's own FK (`MASTER_CONFIG[type].fkField`) — a label's size row and a thread's pack row carry their
 * master's id there, so they read the same master as its base row.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { MASTER_CONFIG } from './master-config';

export interface MaterialDetails {
  /** "customer · brand" — null when the master has neither (only labels and packaging can) */
  buyerBrand: string | null;
  /** The master's distinguishing facts, " · "-joined — null when it has none */
  spec: string | null;
}

/** What the helper needs from a materials row: its type, and its FK columns (read by name). */
export interface MaterialDetailInput {
  materialType: string | null;
  /** A thread pack row's ply — its own, which may differ from the master's */
  threadPly?: string | null;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** One master's facts, before joining */
interface MasterFacts {
  id: string;
  /** The master's own name — a fact that only repeats it is dropped */
  name: string;
  buyer?: Array<string | null | undefined>;
  /** Given the materials row — a thread's pack row has its own ply */
  spec: (material: MaterialDetailInput) => Array<string | null | undefined>;
}

const SEP = ' · ';

/** 48 → '48"'. Widths and lengths on these masters are in inches (their forms say so). */
const inches = (value: Prisma.Decimal | number | null | undefined) => {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? `${n}"` : null;
};

/** Elastic width is in millimetres (Elastic form: "Width (mm)") */
const millimetres = (value: Prisma.Decimal | number | null | undefined) => {
  const n = value == null ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? `${n} mm` : null;
};

/** "70" or 70 → "70 GSM"; a range typed with its own word ("60-70 gsm") stays as typed */
const gsm = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value).trim();
  if (!text) return null;
  return /[a-z]/i.test(text) ? text : `${text} GSM`;
};

/** POLYESTER → "Polyester" */
const titleCase = (value: string | null | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : null;

/** The label master's category, as the Accessory preset picker names it */
const LABEL_CATEGORY_WORD: Record<string, string> = {
  SEWN_IN: 'Sewn-in',
  HANGTAG: 'Hangtag',
  PRICE_TAG: 'Price Tag',
};

const PLY_WORD: Record<string, string> = { TWO_PLY: '2-ply', THREE_PLY: '3-ply' };

/** Customer · brand ("Nihsamah - Sleepwear", as the Label form lists a brand). A brand set with no customer
 * on the master names its own customer. */
const BUYER_SELECT = {
  customer: { select: { name: true } },
  brandCategory: { select: { brandName: true, category: true, customer: { select: { name: true } } } },
} as const;

function buyerFacts(row: {
  customer: { name: string } | null;
  brandCategory: { brandName: string; category: string | null; customer: { name: string } | null } | null;
}): Array<string | null | undefined> {
  const brand = row.brandCategory;
  return [
    row.customer?.name ?? brand?.customer?.name,
    brand ? [brand.brandName, brand.category].filter((s) => s && s.trim()).join(' - ') : null,
  ];
}

/** One loader per master type: its facts, in one query for every id asked */
const LOADERS: Record<string, (db: Db, ids: string[]) => Promise<MasterFacts[]>> = {
  LABEL: async (db, ids) =>
    (
      await db.label_master.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          labelName: true,
          labelCategory: true,
          labelType: true,
          material: true,
          color: true,
          size: true,
          ...BUYER_SELECT,
        },
      })
    ).map((r) => ({
      id: r.id,
      name: r.labelName,
      buyer: buyerFacts(r),
      spec: () => [LABEL_CATEGORY_WORD[r.labelCategory] ?? r.labelCategory, r.labelType, r.material, r.color, r.size],
    })),

  PACKAGING: async (db, ids) =>
    (
      await db.packaging_master.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          packagingName: true,
          packagingType: true,
          size: true,
          material: true,
          thickness: true,
          ...BUYER_SELECT,
        },
      })
    ).map((r) => ({
      id: r.id,
      name: r.packagingName,
      buyer: buyerFacts(r),
      spec: () => [r.packagingType, r.size, r.material, r.thickness],
    })),

  BUTTON: async (db, ids) =>
    (
      await db.button_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, buttonName: true, size: true, holes: true, material: true, color: true },
      })
    ).map((r) => ({
      id: r.id,
      name: r.buttonName,
      spec: () => [r.size, r.holes ? `${r.holes} hole${r.holes === 1 ? '' : 's'}` : null, r.material, r.color],
    })),

  ZIPPER: async (db, ids) =>
    (
      await db.zipper_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, zipperName: true, teethType: true, length: true, color: true },
      })
    ).map((r) => ({ id: r.id, name: r.zipperName, spec: () => [r.teethType, inches(r.length), r.color] })),

  ELASTIC: async (db, ids) =>
    (
      await db.elastic_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, elasticName: true, width: true, composition: true, color: true },
      })
    ).map((r) => ({ id: r.id, name: r.elasticName, spec: () => [millimetres(r.width), r.composition, r.color] })),

  LACE: async (db, ids) =>
    (
      await db.lace_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, laceName: true, width: true, composition: true, color: true },
      })
    ).map((r) => ({ id: r.id, name: r.laceName, spec: () => [inches(r.width), r.composition, r.color] })),

  // No composition on the interlining master — its type ("fusible", "non-woven"…) is the nearest fact
  INTERLINING: async (db, ids) =>
    (
      await db.interlining_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, interliningName: true, width: true, type: true, color: true },
      })
    ).map((r) => ({ id: r.id, name: r.interliningName, spec: () => [r.width, r.type, r.color] })),

  GREIGE: async (db, ids) =>
    (
      await db.greige_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, greigeName: true, composition: true, greigeWidth: true, gsmRange: true },
      })
    ).map((r) => ({
      id: r.id,
      name: r.greigeName,
      spec: () => [r.composition, inches(r.greigeWidth), gsm(r.gsmRange)],
    })),

  FABRIC: async (db, ids) =>
    (
      await db.fabric_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, fabricName: true, composition: true, actualWidth: true, actualGSM: true },
      })
    ).map((r) => ({
      id: r.id,
      name: r.fabricName,
      spec: () => [r.composition, inches(r.actualWidth), gsm(r.actualGSM)],
    })),

  // The thread master has no yarn count: its ply is the count it is bought by. A pack row (a 3-ply cone of the
  // thread) carries its own ply, which beats the master's.
  THREAD: async (db, ids) =>
    (
      await db.thread_master.findMany({
        where: { id: { in: ids } },
        select: { id: true, threadName: true, materialComposition: true, ply: true, color: true },
      })
    ).map((r) => ({
      id: r.id,
      name: r.threadName,
      spec: (m) => [titleCase(r.materialComposition), PLY_WORD[m.threadPly ?? r.ply ?? ''], r.color],
    })),
};

/** Join facts with " · " — trimmed, blanks and repeats skipped, and a fact that is only the name dropped */
export function joinFacts(facts: ReadonlyArray<string | null | undefined>, name?: string | null): string | null {
  const seen = new Set<string>(name ? [name.trim().toLowerCase()] : []);
  const out: string[] = [];
  for (const fact of facts) {
    const text = fact?.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out.length > 0 ? out.join(SEP) : null;
}

/** The master id a materials row points at, by its own FK column — null when it has no master */
function masterIdOf(material: MaterialDetailInput): string | null {
  const config = material.materialType ? MASTER_CONFIG[material.materialType] : undefined;
  if (!config) return null;
  const value = (material as unknown as Record<string, unknown>)[config.fkField];
  return typeof value === 'string' && value ? value : null;
}

/**
 * Each material with its `buyerBrand` and `spec`, in the order given. One query per material type present
 * (types with no loader — the extended trims — get nulls and no query).
 */
export async function attachMaterialDetails<T extends MaterialDetailInput>(
  materials: ReadonlyArray<T>,
  tx?: Prisma.TransactionClient
): Promise<Array<T & MaterialDetails>> {
  const db: Db = tx ?? prisma;

  // Master ids wanted, per type
  const idsByType = new Map<string, Set<string>>();
  for (const material of materials) {
    const masterId = masterIdOf(material);
    if (!masterId || !material.materialType || !LOADERS[material.materialType]) continue;
    const ids = idsByType.get(material.materialType) ?? new Set<string>();
    ids.add(masterId);
    idsByType.set(material.materialType, ids);
  }

  const loaded = await Promise.all(
    [...idsByType].map(async ([type, ids]) => [type, await LOADERS[type](db, [...ids])] as const)
  );
  const factsByType = new Map(loaded.map(([type, rows]) => [type, new Map(rows.map((r) => [r.id, r]))]));

  return materials.map((material) => {
    const masterId = masterIdOf(material);
    const facts = masterId && material.materialType ? factsByType.get(material.materialType)?.get(masterId) : undefined;
    if (!facts) return { ...material, buyerBrand: null, spec: null };
    return {
      ...material,
      buyerBrand: joinFacts(facts.buyer ?? []),
      spec: joinFacts(facts.spec(material), facts.name),
    };
  });
}
