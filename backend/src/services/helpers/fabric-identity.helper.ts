/**
 * Fabric Identity Helper — the single authority for AUTO-created finished fabric_master
 * identity (name, code, colour, pattern part, width) on job-work / processing receipt.
 *
 * Naming convention (user decision 2026-08-18, mirrors FabricForm.generateFabricName):
 *   <styleCode (buyerRef)> - <greigeGeneric> - <finishLabel> - <Part> - <Colour> - <Width"> - <EmbroideryCode>
 * with segments omitted when absent. Identity splits by STYLE: the dedup anchor is the
 * style_fabrics row (one fabric_master ⇢ one style_fabrics row is the system-wide rule,
 * enforced on manual allocation in fabric.controller.ts), resolved through
 *   material_requirements.orderBomItemId → order_bom_items.selectedCadId → fabric_width_cad.styleFabricId
 * with an advisory tuple fallback {greigeId, finishType, styleReference, colorName}.
 *
 * Unknown colour is stored as NULL and the segment omitted — never 'Natural'/'Unknown'
 * placeholder text (those sentinels merged every colour of a greige into one master).
 *
 * Material Identity Unification invariant: materials.id === fabric_master.id.
 */

import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { generateStyleLinkedFabricCode } from '../../utils/fabric-code-generator';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { systemSettingsService } from '../system-settings.service';
import { ensureMaterialRecord, syncMasterToMaterials } from './material-sync.helper';
import { logInfo, logWarn } from '../../utils/logger';

type Tx = Prisma.TransactionClient;
const db = (tx?: Tx) => tx ?? prisma;

/** UI finish labels — MUST stay in sync with frontend/src/constants/fabric-finish-types.ts */
export const FINISH_LABELS: Record<string, string> = {
  DYED: 'Solid/Dyed',
  PRINTED: 'Printed',
  YARN_DYED: 'Yarn Dyed',
  RAW: 'Raw/Unfinished',
};

/** Mirrors controllers/cad-planning.utils.ts ALL_PARTS_CODE (helpers must not import controllers). */
const ALL_PARTS_CODE = 'ALL_PARTS';

interface PatternPartLite {
  id: string;
  name: string;
  sortOrder?: number | null;
}

export interface PatternPartRef {
  id: string | null;
  name: string;
}

/** The selectedCad chain as supplied by callers' Prisma includes. */
export interface CadChainLike {
  id?: string;
  styleFabricId?: string | null;
  isCombinedCutting?: boolean | null;
  patternPart?: PatternPartLite | null;
  cadPatternParts?: Array<{ patternPart: PatternPartLite }> | null;
}

/** material_requirements + orderBomItem chain (whatever the caller's include loaded). */
export interface RequirementChainLike {
  colorName?: string | null;
  printingType?: string | null;
  materials?: { greigeId?: string | null } | null;
  order_items?: {
    styleId?: string | null;
    styles?: { id?: string; styleCode?: string | null; buyerStyleRef?: string | null } | null;
  } | null;
  orderBomItem?: {
    id?: string;
    colorName?: string | null;
    greigeId?: string | null;
    fabricId?: string | null;
    selectedCad?: CadChainLike | null;
  } | null;
}

/** job_work_orders chain (whatever the caller's include loaded). */
export interface JwoChainLike {
  greigeStockLot?: { greigeId?: string | null } | null;
  fabric?: { greigeId?: string | null } | null;
  style?: { id?: string | null; styleCode?: string | null; buyerStyleRef?: string | null } | null;
  labDip?: {
    designArtwork?: string | null;
    colorReference?: string | null;
    targetColor?: { id?: string; colorName?: string | null; colorCode?: string | null } | null;
    fabric?: { greigeId?: string | null } | null;
  } | null;
  /**
   * Shade stamped on a STOCK job at creation. A style-less order has no requirement, no BOM
   * and no lab dip, so these are the only place the shade can come from — and they matter:
   * colorName is part of the dedup tuple, so without them every stock dye run of one greige
   * would fold into a single master with Black and Navy sharing its stock and its cost.
   */
  colorMaster?: { id?: string; colorName?: string | null; colorCode?: string | null } | null;
  colorName?: string | null;
  receivedWidthInches?: unknown;
  sentWidthInches?: unknown;
}

export interface FinishedFabricIdentity {
  greigeId: string;
  greige: {
    greigeName: string | null;
    genericGreigeName: string | null;
    composition: string | null;
    yarnCount: string | null;
  };
  styleId: string | null;
  styleCode: string | null;
  buyerStyleRef: string | null;
  finishType: 'DYED' | 'PRINTED';
  colorName: string | null;
  colorCode: string | null;
  colorMasterId: string | null;
  /** PRINTED only — occupies the colour slot in the name when present. */
  printDesign: string | null;
  styleFabricId: string | null;
  patternPartId: string | null;
  patternPartName: string | null;
  hasEmbroidery: boolean;
  embroideryCode: string | null;
  /** Width for the NAME: measured ?? asked ONLY. Deep fallbacks are stock-only. */
  nameWidthInches: number | null;
}

export type FabricCreationSource = 'AUTO_FROM_MRP_JWO' | 'AUTO_FROM_MRP_GRN' | 'AUTO_FROM_JOB_WORK';

export interface FinishedFabricResultV2 {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  isNew: boolean;
  matchedBy: 'STYLE_FABRIC' | 'TUPLE' | 'CREATED';
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function sortParts(parts: PatternPartLite[]): PatternPartLite[] {
  return [...parts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

/**
 * Pattern-part from the CAD row itself (ladder steps 1-2). Step 3 (style_pattern_parts)
 * needs the styleFabric row and runs inside resolveFinishedFabricIdentity.
 */
export function resolvePartFromCadShape(cad: CadChainLike | null | undefined): PatternPartRef | null {
  if (!cad) return null;
  if (cad.patternPart) return { id: cad.patternPart.id, name: cad.patternPart.name };
  const multi = (cad.cadPatternParts ?? []).map((p) => p.patternPart).filter(Boolean);
  if (multi.length > 0) {
    const first = sortParts(multi)[0];
    return { id: first.id, name: first.name };
  }
  return null;
}

/**
 * Ladder step 3 — the CAD module's own defaulting rule (cad-planning.controller.ts
 * auto-population): exactly 1 style_pattern_part → use it; 0 → default to All Parts;
 * >1 → ambiguous, omit the segment.
 */
async function partFromStylePatternParts(
  stylePatternParts: Array<{ patternPart: PatternPartLite }> | null | undefined,
  tx?: Tx
): Promise<PatternPartRef | null> {
  const parts = (stylePatternParts ?? []).map((p) => p.patternPart).filter(Boolean);
  if (parts.length === 1) return { id: parts[0].id, name: parts[0].name };
  if (parts.length > 1) return null;
  const allParts = await db(tx).pattern_part_master.findFirst({
    where: { code: ALL_PARTS_CODE, isActive: true },
    select: { id: true, name: true },
  });
  // Master row missing → still name the segment (existing names carry 'All Parts'), no id to stamp
  return allParts ? { id: allParts.id, name: allParts.name } : { id: null, name: 'All Parts' };
}

/**
 * The colour ladder, as one pure function so its ORDER is pinned by a test rather than by
 * reading it. Order matters commercially: colorName is part of the finished-fabric dedup
 * tuple, so whichever rung answers decides whether two runs are one fabric or two.
 *
 * The first four rungs are the order-linked chain and are unchanged. The last two are the
 * shade stamped on a STOCK job, and can only ever fire when the four above are empty — which
 * is exactly the style-less case, where there is no requirement, BOM or lab dip to ask.
 */
export function resolveIdentityColourName(input: {
  requirement?: { colorName?: string | null } | null;
  orderBomItem?: { colorName?: string | null } | null;
  jwo?: JwoChainLike | null;
  finishType: 'DYED' | 'PRINTED';
}): string | null {
  const { requirement, orderBomItem, jwo, finishType } = input;
  return (
    trimOrNull(requirement?.colorName) ??
    trimOrNull(orderBomItem?.colorName) ??
    trimOrNull(jwo?.labDip?.targetColor?.colorName) ??
    // colorReference is a dye-house shade reference; on a print job it would name the wrong thing
    (finishType === 'DYED' ? trimOrNull(jwo?.labDip?.colorReference) : null) ??
    trimOrNull(jwo?.colorMaster?.colorName) ??
    trimOrNull(jwo?.colorName)
  );
}

export interface ResolveIdentityParams {
  requirement?: RequirementChainLike | null;
  jwo?: JwoChainLike | null;
  /** Explicit style override; otherwise derived from requirement.order_items → jwo.style. */
  style?: { id?: string | null; styleCode?: string | null; buyerStyleRef?: string | null } | null;
  /** Pre-resolved style_fabrics anchor (manual dyeing/printing flows) — skips the CAD chain. */
  knownStyleFabricId?: string | null;
  finishType: 'DYED' | 'PRINTED';
  tx?: Tx;
}

/**
 * styleFabric anchor for MANUAL dyeing/printing jobs (no requirement/CAD chain): the
 * style's style_fabrics row on the same greige with the same finish. Adopt ONLY on
 * exactly one match — multi-component styles (e.g. Kurta + Pallazo on one greige) are
 * ambiguous and fall back to the tuple path.
 */
export async function resolveManualJobStyleFabricAnchor(
  styleId: string,
  greigeId: string,
  finishType: 'DYED' | 'PRINTED',
  tx?: Tx
): Promise<string | null> {
  const rows = await db(tx).style_fabrics.findMany({
    where: {
      selectedGreigeId: greigeId,
      fabricFinishType: finishType,
      style_components: { styleId },
    },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0].id : null;
}

/**
 * Resolve the full identity for a finished fabric from whatever chain the caller has
 * (requirement and/or JWO). Returns null when no greige lineage is resolvable — callers
 * log and degrade (creation is never blocked by naming). Throws only on data corruption
 * (greigeId points at a missing greige_master).
 */
export async function resolveFinishedFabricIdentity(
  params: ResolveIdentityParams
): Promise<FinishedFabricIdentity | null> {
  const { requirement: req, jwo, finishType, tx } = params;
  const client = db(tx);
  const obi = req?.orderBomItem ?? null;

  const greigeId =
    obi?.greigeId ??
    req?.materials?.greigeId ??
    jwo?.greigeStockLot?.greigeId ??
    jwo?.fabric?.greigeId ??
    jwo?.labDip?.fabric?.greigeId ??
    null;
  if (!greigeId) return null;

  const greige = await client.greige_master.findUnique({
    where: { id: greigeId },
    select: { greigeName: true, genericGreigeName: true, composition: true, yarnCount: true },
  });
  if (!greige) {
    throw new Error(`Greige master ${greigeId} not found while resolving finished fabric identity`);
  }

  const style = params.style ?? {
    id: req?.order_items?.styleId ?? jwo?.style?.id ?? null,
    styleCode: req?.order_items?.styles?.styleCode ?? jwo?.style?.styleCode ?? null,
    buyerStyleRef: req?.order_items?.styles?.buyerStyleRef ?? jwo?.style?.buyerStyleRef ?? null,
  };

  const cad = obi?.selectedCad ?? null;
  let styleFabricId = params.knownStyleFabricId ?? cad?.styleFabricId ?? null;
  if (!styleFabricId && obi?.fabricId) {
    // BOM already names a finished master — its claiming style_fabrics row is the anchor
    const claimed = await client.style_fabrics.findFirst({
      where: { fabricId: obi.fabricId },
      select: { id: true },
    });
    styleFabricId = claimed?.id ?? null;
  }

  let part = resolvePartFromCadShape(cad);

  let sf: {
    fabricId: string | null;
    hasEmbroidery: boolean;
    printDesign: string | null;
    colorMasterId: string | null;
    embroidery: { embroideryCode: string } | null;
    stylePatternParts: Array<{ patternPart: PatternPartLite }>;
  } | null = null;
  if (styleFabricId) {
    sf = await client.style_fabrics.findUnique({
      where: { id: styleFabricId },
      select: {
        fabricId: true,
        hasEmbroidery: true,
        printDesign: true,
        colorMasterId: true,
        embroidery: { select: { embroideryCode: true } },
        stylePatternParts: {
          select: { patternPart: { select: { id: true, name: true, sortOrder: true } } },
        },
      },
    });
  }
  if (!part && sf) part = await partFromStylePatternParts(sf.stylePatternParts, tx);

  const colorName = resolveIdentityColourName({ requirement: req, orderBomItem: obi, jwo, finishType });
  const printDesign =
    finishType === 'PRINTED' ? (trimOrNull(sf?.printDesign) ?? trimOrNull(jwo?.labDip?.designArtwork)) : null;

  return {
    greigeId,
    greige,
    styleId: style.id ?? null,
    styleCode: trimOrNull(style.styleCode),
    buyerStyleRef: trimOrNull(style.buyerStyleRef),
    finishType,
    colorName,
    colorCode: trimOrNull(jwo?.labDip?.targetColor?.colorCode) ?? trimOrNull(jwo?.colorMaster?.colorCode),
    colorMasterId: sf?.colorMasterId ?? jwo?.labDip?.targetColor?.id ?? jwo?.colorMaster?.id ?? null,
    printDesign,
    styleFabricId,
    patternPartId: part?.id ?? null,
    patternPartName: part?.name ?? null,
    hasEmbroidery: sf?.hasEmbroidery ?? false,
    embroideryCode: trimOrNull(sf?.embroidery?.embroideryCode),
    nameWidthInches: toFiniteNumber(jwo?.receivedWidthInches) ?? toFiniteNumber(jwo?.sentWidthInches),
  };
}

/**
 * The naming convention, as one pure function (FabricForm.generateFabricName order):
 *   style(ref) - greigeGeneric - finishLabel - part - colour/design - width" - embroidery
 */
export function buildFinishedFabricName(identity: FinishedFabricIdentity): string {
  const greigeGeneric =
    identity.greige.genericGreigeName || identity.greige.greigeName?.split('/')[0]?.trim() || 'Fabric';
  const colourSegment =
    identity.finishType === 'PRINTED' ? (identity.printDesign ?? identity.colorName) : identity.colorName;
  return [
    identity.styleCode ? formatStyleCodeWithRef(identity.styleCode, identity.buyerStyleRef) : null,
    greigeGeneric,
    FINISH_LABELS[identity.finishType] ?? identity.finishType,
    identity.patternPartName,
    colourSegment,
    identity.nameWidthInches != null ? `${identity.nameWidthInches}"` : null,
    identity.hasEmbroidery ? (identity.embroideryCode ?? 'Embroidery') : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

/**
 * Link the style's fabric slot to the master so cutting (candidates from
 * style_fabrics.fabricId) and fabric costing (readyFabricCost/stockAvailable) can see
 * received lots. Never overwrites a slot already claimed by a DIFFERENT master.
 */
export async function stampStyleFabricLink(
  styleFabricId: string | null | undefined,
  fabricId: string,
  tx?: Tx
): Promise<void> {
  if (!styleFabricId) return;
  const client = db(tx);
  const sf = await client.style_fabrics.findUnique({
    where: { id: styleFabricId },
    select: { fabricId: true },
  });
  if (!sf) return;
  if (!sf.fabricId) {
    await client.style_fabrics.update({ where: { id: styleFabricId }, data: { fabricId } });
    logInfo('style_fabrics.fabricId stamped from job-work receipt', { styleFabricId, fabricId });
  } else if (sf.fabricId !== fabricId) {
    logWarn('style_fabrics already claims a different fabric master — not overwriting', {
      styleFabricId,
      claimedFabricId: sf.fabricId,
      incomingFabricId: fabricId,
    });
  }
}

/**
 * Get-or-create a finished fabric_master for the resolved identity.
 * Dedup: style_fabrics anchor first, then an advisory per-style tuple
 * {greigeId, finishType, styleReference, colorName[, printDesign]} that only adopts
 * masters not claimed by a DIFFERENT style_fabrics row. No DB unique constraint backs
 * this (pattern part is not a fabric_master column) — the race is advisory and accepted.
 */
export async function getOrCreateFinishedFabricV2(
  identity: FinishedFabricIdentity,
  userId: string,
  source: FabricCreationSource,
  tx?: Tx
): Promise<FinishedFabricResultV2> {
  const client = db(tx);

  // 1. Anchor: the style_fabrics row already claims a master
  if (identity.styleFabricId) {
    const sf = await client.style_fabrics.findUnique({
      where: { id: identity.styleFabricId },
      select: {
        fabric: { select: { id: true, fabricCode: true, fabricName: true, isActive: true } },
      },
    });
    if (sf?.fabric?.isActive) {
      logInfo('Finished fabric matched via style_fabrics anchor', {
        styleFabricId: identity.styleFabricId,
        fabricId: sf.fabric.id,
      });
      return {
        fabricId: sf.fabric.id,
        fabricCode: sf.fabric.fabricCode,
        fabricName: sf.fabric.fabricName,
        isNew: false,
        matchedBy: 'STYLE_FABRIC',
      };
    }
  }

  // 2. Advisory tuple — per-style (identity decision), null-aware (Prisma null → IS NULL)
  const candidates = await client.fabric_master.findMany({
    where: {
      greigeId: identity.greigeId,
      finishType: identity.finishType,
      isActive: true,
      styleReference: identity.styleCode ?? null,
      colorName: identity.colorName ?? null,
      // Two print designs of the same greige+style must not merge
      ...(identity.finishType === 'PRINTED' ? { printDesign: identity.printDesign ?? null } : {}),
    },
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
      styleFabrics: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const match = candidates.find(
    (c) =>
      c.styleFabrics.length === 0 ||
      (identity.styleFabricId != null && c.styleFabrics.some((s) => s.id === identity.styleFabricId))
  );
  if (match) {
    await stampStyleFabricLink(identity.styleFabricId, match.id, tx);
    logInfo('Finished fabric matched via identity tuple', {
      fabricId: match.id,
      greigeId: identity.greigeId,
      styleCode: identity.styleCode,
      colorName: identity.colorName,
      finishType: identity.finishType,
    });
    return {
      fabricId: match.id,
      fabricCode: match.fabricCode,
      fabricName: match.fabricName,
      isNew: false,
      matchedBy: 'TUPLE',
    };
  }

  // 3. Create
  const fabricCode = await generateStyleLinkedFabricCode(identity.styleCode ?? undefined, tx);
  const fabricName = buildFinishedFabricName(identity);
  const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
  const width = identity.nameWidthInches;
  const fabricId = randomUUID();

  const created = await client.fabric_master.create({
    data: {
      id: fabricId,
      fabricCode,
      fabricName,
      greigeId: identity.greigeId,
      greigeName: identity.greige.greigeName,
      genericGreigeName: identity.greige.genericGreigeName,
      colorName: identity.colorName,
      colorCode: identity.colorCode,
      colorMasterId: identity.colorMasterId,
      printDesign: identity.printDesign,
      finishType: identity.finishType,
      actualWidth: width != null ? new Prisma.Decimal(width) : null,
      cutableWidth: width != null ? new Prisma.Decimal(Math.max(width - widthDeduction, 0)) : null,
      composition: identity.greige.composition,
      yarnCount: identity.greige.yarnCount,
      styleReference: identity.styleCode,
      source,
      isGeneric: !identity.styleId,
      isActive: true,
      createdById: userId,
    },
  });

  // Material Identity Unification: materials.id === fabric_master.id
  await ensureMaterialRecord(created.id, 'FABRIC', tx);
  await stampStyleFabricLink(identity.styleFabricId, created.id, tx);

  logInfo('Created finished fabric_master from job-work identity', {
    fabricId: created.id,
    fabricCode,
    fabricName,
    source,
    styleFabricId: identity.styleFabricId,
    patternPart: identity.patternPartName,
  });

  return { fabricId: created.id, fabricCode, fabricName, isNew: true, matchedBy: 'CREATED' };
}

/**
 * Receive-time width truth: always patch actualWidth/cutableWidth; for AUTO-created
 * masters also swap the width token inside the name (all other segments are kept
 * verbatim — part/colour may not be re-derivable later if the CAD selection changed)
 * and sync the rename to materials.
 */
export async function rebuildAutoFabricName(fabricId: string, measuredWidthInches: number, tx?: Tx): Promise<void> {
  if (!Number.isFinite(measuredWidthInches) || measuredWidthInches <= 0) return;
  const client = db(tx);
  const master = await client.fabric_master.findUnique({
    where: { id: fabricId },
    select: { id: true, fabricName: true, source: true },
  });
  if (!master) return;

  const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
  await client.fabric_master.update({
    where: { id: fabricId },
    data: {
      actualWidth: new Prisma.Decimal(measuredWidthInches),
      cutableWidth: new Prisma.Decimal(Math.max(measuredWidthInches - widthDeduction, 0)),
    },
  });

  // Hand-authored masters keep their names; only AUTO ones follow the measurement
  if (!master.source?.startsWith('AUTO')) return;

  const widthSegment = `${measuredWidthInches}"`;
  const segments = master.fabricName.split(' - ');
  const widthIdx = segments.findIndex((s) => /^\d+(\.\d+)?"$/.test(s.trim()));
  const newName =
    widthIdx >= 0
      ? [...segments.slice(0, widthIdx), widthSegment, ...segments.slice(widthIdx + 1)].join(' - ')
      : `${master.fabricName} - ${widthSegment}`;

  if (newName !== master.fabricName) {
    await client.fabric_master.update({ where: { id: fabricId }, data: { fabricName: newName } });
    await syncMasterToMaterials(fabricId, 'FABRIC', { name: newName }, tx);
    logInfo('Auto fabric name rebuilt for measured width', {
      fabricId,
      oldName: master.fabricName,
      newName,
    });
  }
}

/**
 * Width for fabric_stock.finishedWidth (NOT NULL column): measured ?? asked ??
 * greige finished-width band ?? loom width ?? 44 (last resort, loudly logged).
 * NEVER used for the fabric NAME — the name only carries measured ?? asked.
 */
export async function resolveStockWidthInches(
  jwo: {
    sentWidthInches?: unknown;
    greigeStockLot?: { greigeId?: string | null } | null;
    fabric?: { greigeId?: string | null } | null;
  },
  measuredWidthInches: number | null,
  tx?: Tx
): Promise<number> {
  if (measuredWidthInches != null && Number.isFinite(measuredWidthInches) && measuredWidthInches > 0) {
    return measuredWidthInches;
  }
  const asked = toFiniteNumber(jwo.sentWidthInches);
  if (asked != null && asked > 0) return asked;

  const greigeId = jwo.greigeStockLot?.greigeId ?? jwo.fabric?.greigeId ?? null;
  if (greigeId) {
    const greige = await db(tx).greige_master.findUnique({
      where: { id: greigeId },
      select: { expectedFinishedWidthMax: true, greigeWidth: true },
    });
    const band = toFiniteNumber(greige?.expectedFinishedWidthMax);
    if (band != null && band > 0) return band;
    const loom = toFiniteNumber(greige?.greigeWidth);
    if (loom != null && loom > 0) return loom;
  }

  logWarn('fabric_stock width defaulted to 44" — no measurement, asked width, or greige band', {
    greigeId,
  });
  return 44;
}
