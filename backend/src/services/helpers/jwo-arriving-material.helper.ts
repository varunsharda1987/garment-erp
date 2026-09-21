/**
 * Which material is ARRIVING on a job work order — the single authority used by BOTH the GRN
 * creation guard and GRN approval, so the two halves of one receipt can never read different
 * columns again.
 *
 * Why this exists (2026-09-15, T0-A): GRN creation checked `fabricId` — the fabric SENT on a
 * reprocessing job — while approval two hundred lines later resolved `finishedFabricId` — the fabric
 * expected BACK. A greige→fabric job has no `fabricId` by design (it sent greige, not fabric), so
 * every such job, including every MRP-generated one, was refused at a door that approval would have
 * handled. Lace already booked against `finishedLaceId` ("the dyed variant expected BACK"); this
 * makes fabric do the same. See CLAUDE.md "One concept, two homes".
 *
 *   LACE                    → finishedLaceId
 *   fabric-lot reprocessing → fabricId          embroidery on a finished roll keeps its master and is
 *                                               told apart by embroideryId (legacy parity — see
 *                                               approvePolessJwoGrnInTx; widening this is T0-D)
 *   greige → fabric         → finishedFabricId, else MINT from greige lineage, else the legacy
 *                             fabricId fallback every existing caller already uses
 *                             (dyeing.controller.ts "keep the source master"), else THROW.
 *
 * Never silently proceed: a GRN approved with no stock is worse than a refusal (T0-B).
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import { logInfo, logWarn } from '../../utils/logger';
import { determineFinishType } from './processing-fabric.helper';
import {
  FabricCreationSource,
  FinishedFabricIdentity,
  getOrCreateFinishedFabricV2,
  resolveFinishedFabricIdentity,
} from './fabric-identity.helper';

type Tx = Prisma.TransactionClient;

/**
 * Everything a GRN needs to know about a job work order — identity lineage AND cost basis.
 * Used by GRN creation and GRN approval alike so neither can load less than the other sees.
 */
export const JWO_GRN_INCLUDE = {
  processor: { select: { id: true, name: true } },
  // Tolerance precedence is job → process type → 0; the short-close guard needs the process-type default.
  processTypeMaster: { select: { tolerancePercent: true } },
  greigeStockLot: { select: { id: true, purchaseCost: true, greigeId: true } },
  // Phase 5b: fabric-roll source (EMBROIDERY) — cost basis is the source lot's WAC
  fabricStockLot: { select: { id: true, weightedAvgCost: true, fabricFinishType: true } },
  fabric: { select: { id: true, greigeId: true } },
  style: { select: { id: true, styleCode: true, buyerStyleRef: true } },
  // Stock (style-less) job: the shade lives on the order itself, because there is no
  // requirement, BOM or lab dip below to carry it.
  colorMaster: { select: { id: true, colorName: true, colorCode: true } },
  // Fabric-naming: requirement chain carries the dye colour + CAD pattern part +
  // styleFabric anchor for the finished fabric identity (never 'Natural' again).
  // labDip.fabric.greigeId is a lineage rung resolveFinishedFabricIdentity can use — it was
  // missing from the GRN include before 2026-09-15, so that rung was dead on this path.
  labDip: {
    select: {
      designArtwork: true,
      colorReference: true,
      targetColor: { select: { id: true, colorName: true, colorCode: true } },
      fabric: { select: { greigeId: true } },
    },
  },
  requirementLinks: {
    take: 1,
    select: {
      material_requirements: {
        select: {
          id: true,
          colorName: true,
          printingType: true,
          materials: { select: { greigeId: true } },
          orderBomItem: {
            select: {
              id: true,
              colorName: true,
              greigeId: true,
              fabricId: true,
              selectedCad: {
                select: {
                  id: true,
                  styleFabricId: true,
                  isCombinedCutting: true,
                  patternPart: { select: { id: true, name: true } },
                  cadPatternParts: {
                    select: { patternPart: { select: { id: true, name: true, sortOrder: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.job_work_ordersInclude;

export type JwoGrnRow = Prisma.job_work_ordersGetPayload<{ include: typeof JWO_GRN_INCLUDE }>;

export interface JwoArrivingMaterialInput {
  fabricType?: string | null;
  fabricId?: string | null;
  finishedFabricId?: string | null;
  finishedLaceId?: string | null;
  fabricStockLotId?: string | null;
  greigeStockLotId?: string | null;
}

export type JwoArrivingMaterial = {
  kind: 'LACE' | 'FABRIC';
  id: string;
  /** true when the job re-processes an existing finished lot and keeps its master */
  reprocessing: boolean;
};

/** A job that sent a FINISHED fabric lot (not greige) — its result keeps the same master. */
export function isFabricLotReprocessingJwo(jwo: JwoArrivingMaterialInput): boolean {
  return !!jwo.fabricStockLotId && !jwo.greigeStockLotId;
}

/**
 * What the JWO already KNOWS is arriving, with no I/O. Null means "not recorded on the row" —
 * for a greige job that is normal when the mint was deferred, and resolveOrMint… handles it.
 */
export function resolveJwoArrivingMaterial(jwo: JwoArrivingMaterialInput): JwoArrivingMaterial | null {
  if (jwo.fabricType === 'LACE') {
    return jwo.finishedLaceId ? { kind: 'LACE', id: jwo.finishedLaceId, reprocessing: false } : null;
  }
  if (isFabricLotReprocessingJwo(jwo)) {
    return jwo.fabricId ? { kind: 'FABRIC', id: jwo.fabricId, reprocessing: true } : null;
  }
  return jwo.finishedFabricId ? { kind: 'FABRIC', id: jwo.finishedFabricId, reprocessing: false } : null;
}

export interface ResolveOrMintOptions {
  userId: string;
  source: FabricCreationSource;
  /** Measured width at receipt, when known — baked into the minted name. */
  receivedWidthInches?: number | null;
  tx?: Tx;
}

export type ResolvedArrivingMaterial = JwoArrivingMaterial & {
  /** Resolved for greige jobs (null for lace and reprocessing) — callers stamp the style link with it. */
  identity: FinishedFabricIdentity | null;
  /** true when this call created the finished master — the caller should persist it on the JWO. */
  minted: boolean;
};

/**
 * The one sequence both GRN sites run. Precedence for a greige job, in order:
 *   1. finishedFabricId already on the row
 *   2. mint from greige lineage (idempotent get-or-create, so re-running is safe)
 *   3. legacy fabricId fallback ("keep the source master")
 *   4. throw — never a silent stock-less receipt
 */
export async function resolveOrMintJwoArrivingMaterial(
  jwo: JwoGrnRow,
  opts: ResolveOrMintOptions
): Promise<ResolvedArrivingMaterial> {
  const known = resolveJwoArrivingMaterial(jwo);

  if (jwo.fabricType === 'LACE') {
    // BusinessError (422): a refusal the user can act on must reach them with its message — a plain
    // Error is masked to "An unexpected error occurred" by the production middleware.
    if (!known) throw new BusinessError(`${jwo.jobWorkNumber} has no dyed lace variant — cannot create a GRN item`);
    return { ...known, identity: null, minted: false };
  }

  if (isFabricLotReprocessingJwo(jwo)) {
    if (!known) {
      throw new BusinessError(
        `${jwo.jobWorkNumber} re-processes a fabric lot but names no fabric — cannot create a GRN item`
      );
    }
    return { ...known, identity: null, minted: false };
  }

  // Greige → fabric. Identity is resolved even when the master already exists: approval uses it
  // to follow the measured width and to stamp the style link.
  const identity = await resolveFinishedFabricIdentity({
    requirement: jwo.requirementLinks?.[0]?.material_requirements ?? null,
    jwo: {
      greigeStockLot: jwo.greigeStockLot,
      fabric: jwo.fabric,
      style: jwo.style,
      labDip: jwo.labDip,
      colorMaster: jwo.colorMaster,
      colorName: jwo.colorName,
      receivedWidthInches: opts.receivedWidthInches,
      sentWidthInches: jwo.sentWidthInches,
    },
    finishType: determineFinishType(null, jwo.processType === 'PRINTING' ? 'PIGMENT' : null),
    tx: opts.tx,
  });

  if (known) return { ...known, identity, minted: false };

  if (identity) {
    const minted = await getOrCreateFinishedFabricV2(identity, opts.userId, opts.source, opts.tx);
    logInfo(`[JWO] ${jwo.jobWorkNumber}: finished fabric minted at receipt (${minted.fabricCode ?? minted.fabricId})`);
    return { kind: 'FABRIC', id: minted.fabricId, reprocessing: false, identity, minted: true };
  }

  if (jwo.fabricId) {
    logWarn(`[JWO] ${jwo.jobWorkNumber}: no greige lineage — receiving against the job's fabricId (legacy parity)`);
    return { kind: 'FABRIC', id: jwo.fabricId, reprocessing: false, identity: null, minted: false };
  }

  throw new BusinessError(
    `${jwo.jobWorkNumber} names no finished fabric and carries no greige lineage (no greige lot, ` +
      `requirement, lab dip or fabric) — the finished fabric cannot be identified, so nothing can be received. ` +
      `Link the job to its greige lot or requirement, or set its finished fabric, then receive again.`
  );
}

/** Persist a freshly minted finished fabric on the JWO so approval — and every later reader — finds it. */
export async function stampJwoFinishedFabric(jwoId: string, finishedFabricId: string, tx?: Tx): Promise<void> {
  await (tx ?? prisma).job_work_orders.update({ where: { id: jwoId }, data: { finishedFabricId } });
}
