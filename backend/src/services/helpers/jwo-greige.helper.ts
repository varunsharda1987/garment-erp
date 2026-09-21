/**
 * JWO greige identity — the single authority for "which greige cloth is this job about".
 *
 * A job work order has no single column that always answers this. `greigeId` (added
 * 2026-09-21) is set only on hand-raised stock cloth jobs; MRP- and Processing-page-created
 * jobs legitimately leave it null and derive the greige from their requirement chain, and
 * every row that predates the column has it null. So readers need ONE agreed precedence
 * rather than a private chain each — two chains answering "which greige" differently is how
 * a reconciliation and an issuance guard end up disagreeing about the same job.
 *
 * Precedence, most authoritative first:
 *   1. `greigeId`            — the contract. The rate card and shrinkage were quoted on it.
 *   2. `greigeStockLot`      — the lot actually consumed at issue (stamped `lots[0]`).
 *   3. `components`          — per-lot trail, written when a multi-lot issue split the send.
 *   4. `requirementLinks`    — the MRP requirement's material, for order-linked jobs.
 *   5. `fabric.greigeId`     — the finished fabric's greige (design-time sourcing).
 *   6. `labDip.fabric`       — same, via the lab dip the job was raised from.
 *
 * Steps 4-6 are the chain `job-work-issuance.service.ts` used before the column existed.
 *
 * PURE — no Prisma, no I/O. Callers select whichever of these fields they already load;
 * every field is optional, so a partial select simply skips that step.
 *
 * NOTE for callers whose job may not be about greige at all: a FABRIC reprocessing or
 * EMBROIDERY job (`fabricStockLotId` set) and a LACE dyeing job (`greigeLaceId` set) can
 * still resolve here via step 5, because their finished fabric has a greige behind it.
 * Check those columns BEFORE calling this, or you will label a fabric job with its greige.
 */

export interface JwoGreigeSource {
  greigeId?: string | null;
  greigeStockLot?: { greigeId?: string | null } | null;
  components?: Array<{ materialType?: string | null; greigeId?: string | null }> | null;
  requirementLinks?: Array<{
    material_requirements?: { materials?: { greigeId?: string | null } | null } | null;
  }> | null;
  fabric?: { greigeId?: string | null } | null;
  labDip?: { fabric?: { greigeId?: string | null } | null } | null;
}

/** Which step answered — for diagnostics and for warning when only a weak source was available. */
export type JwoGreigeSourceName = 'header' | 'lot' | 'component' | 'requirement' | 'fabric' | 'labDip';

export interface JwoGreigeResolution {
  greigeId: string;
  source: JwoGreigeSourceName;
}

/**
 * Resolve the greige cloth a job work order is about, with the source that answered.
 * Returns null when no step resolves (style-less stock jobs raised before the column, or
 * jobs that are not about greige at all).
 */
export function resolveJwoGreige(jwo: JwoGreigeSource | null | undefined): JwoGreigeResolution | null {
  if (!jwo) return null;

  if (jwo.greigeId) return { greigeId: jwo.greigeId, source: 'header' };

  if (jwo.greigeStockLot?.greigeId) return { greigeId: jwo.greigeStockLot.greigeId, source: 'lot' };

  const component = (jwo.components ?? []).find((c) => c?.greigeId && c.materialType !== 'LACE');
  if (component?.greigeId) return { greigeId: component.greigeId, source: 'component' };

  for (const link of jwo.requirementLinks ?? []) {
    const fromRequirement = link?.material_requirements?.materials?.greigeId;
    if (fromRequirement) return { greigeId: fromRequirement, source: 'requirement' };
  }

  if (jwo.fabric?.greigeId) return { greigeId: jwo.fabric.greigeId, source: 'fabric' };

  if (jwo.labDip?.fabric?.greigeId) return { greigeId: jwo.labDip.fabric.greigeId, source: 'labDip' };

  return null;
}

/** Convenience wrapper when only the id is needed. */
export function resolveJwoGreigeId(jwo: JwoGreigeSource | null | undefined): string | null {
  return resolveJwoGreige(jwo)?.greigeId ?? null;
}
