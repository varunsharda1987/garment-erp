/**
 * Which received fabric lot may carry a Production CAD — ONE rule for every writer.
 *
 * A Production CAD is the marker for one received bulk lot (`fabric_width_cad.fabricStockId`).
 * Until 2026-09-25 only "Create CAD" on a lot (production-from-stock) checked that the lot was
 * this style's and had no Production CAD yet; Add Row, Add Combined Row and Link to Stock took
 * any AVAILABLE lot, and Copy to Production / Promote / a purpose edit made one with no lot at
 * all. IP00138 and LNG279 were left with rejected, priced Production rows nobody could delete.
 *
 * Every writer that puts a lot on a Production row calls `resolveProductionLot`:
 *   1. the lot exists;
 *   2. it belongs to one of the style's fabric slots — resolved from the lot's lineage, or, when
 *      the caller names the slot, checked against it (received for this style, same fabric, or
 *      same greige);
 *   3. no other live (non-REJECTED) Production CAD holds it.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, BusinessError } from '../../errors';
import { resolveManualJobStyleFabricAnchor } from './fabric-identity.helper';

const lotInclude = {
  fabricMaster: {
    select: { fabricCode: true, greigeId: true, finishType: true, greige: { select: { genericGreigeName: true } } },
  },
  procurement: { select: { orderedForStyleId: true } },
  grnItem: { select: { goods_receiving_notes: { select: { grnNumber: true } } } },
} satisfies Prisma.fabric_stockInclude;

export type ProductionLotStock = Prisma.fabric_stockGetPayload<{ include: typeof lotInclude }>;

export interface ResolvedProductionLot {
  fabricStock: ProductionLotStock;
  styleFabricId: string;
  styleCode: string;
  /** "FAB-X-001, GRN2609-0080": what the refusal messages and notes print */
  lotLabel: string;
  finishType: 'DYED' | 'PRINTED';
  lotGreigeId: string | null;
}

/** A PRODUCTION row, whichever of the two purpose columns carries it (Landmine №8) */
export const PRODUCTION_PURPOSE_WHERE: Prisma.fabric_width_cadWhereInput = {
  OR: [{ purposeEnum: 'PRODUCTION' }, { purpose: 'PRODUCTION' }],
};

export const CREATE_CAD_HINT = 'Use Create CAD on the lot in the stock banner of CAD Planning.';

export async function resolveProductionLot(
  styleId: string,
  fabricStockId: string,
  hints: { styleFabricId?: string | null; componentId?: string | null } = {},
  options: { excludeCadId?: string } = {}
): Promise<ResolvedProductionLot> {
  const fabricStock = await prisma.fabric_stock.findUnique({ where: { id: fabricStockId }, include: lotInclude });
  if (!fabricStock) {
    throw new NotFoundError('Fabric stock', fabricStockId);
  }
  const style = await prisma.styles.findUnique({ where: { id: styleId }, select: { styleCode: true } });
  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  const lotLabel = [fabricStock.fabricMaster?.fabricCode, fabricStock.grnItem?.goods_receiving_notes?.grnNumber]
    .filter(Boolean)
    .join(', ');
  const finishType: 'DYED' | 'PRINTED' =
    (fabricStock.fabricFinishType ?? fabricStock.fabricMaster?.finishType) === 'PRINTED' ? 'PRINTED' : 'DYED';
  const lotGreigeId = fabricStock.fabricMaster?.greigeId ?? null;
  const lotGeneric = fabricStock.fabricMaster?.greige?.genericGreigeName?.trim().toLowerCase() ?? null;

  const slotsOfStyle = (where: Prisma.style_fabricsWhereInput) =>
    prisma.style_fabrics.findMany({
      where: { AND: [where, { style_components: { styleId } }] },
      select: {
        id: true,
        fabricId: true,
        genericGreigeName: true,
        fabricFinishType: true,
        fabric: { select: { greigeId: true } },
        style_components: { select: { componentName: true } },
      },
    });

  // 1. Which of the style's fabric slots this lot belongs to — resolved, or refused
  let styleFabricId: string | null = null;
  if (hints.styleFabricId) {
    const [sf] = await slotsOfStyle({ id: hints.styleFabricId });
    if (!sf) {
      throw new BusinessError('That fabric does not belong to this style.');
    }
    const receivedForStyle =
      fabricStock.originStyleId === styleId || fabricStock.procurement?.orderedForStyleId === styleId;
    const sameFabric = sf.fabricId === fabricStock.fabricId;
    const sameGreige = !!lotGreigeId && sf.fabric?.greigeId === lotGreigeId;
    const sameGeneric =
      !!lotGeneric &&
      sf.genericGreigeName?.trim().toLowerCase() === lotGeneric &&
      (!sf.fabricFinishType || sf.fabricFinishType === finishType);
    const anchored =
      !receivedForStyle &&
      !sameFabric &&
      !sameGreige &&
      !sameGeneric &&
      !!lotGreigeId &&
      (await resolveManualJobStyleFabricAnchor(styleId, lotGreigeId, finishType)) === sf.id;
    if (!(receivedForStyle || sameFabric || sameGreige || sameGeneric || anchored)) {
      throw new BusinessError(
        `This lot (${lotLabel || fabricStockId}) is not a fabric of ${style.styleCode}` +
          `${sf.style_components?.componentName ? ` ${sf.style_components.componentName}` : ''}: it was not received ` +
          `for the style and its greige (${fabricStock.fabricMaster?.greige?.genericGreigeName ?? '—'}) is not this ` +
          `fabric's. Pick one of the style's own lots.`
      );
    }
    styleFabricId = sf.id;
  }
  if (!styleFabricId) {
    // The slot already linked to this lot's fabric (ready fabric, or a dyed fabric the receipt linked)
    const claimed = await slotsOfStyle({ fabricId: fabricStock.fabricId });
    if (claimed.length === 1) styleFabricId = claimed[0].id;
  }
  if (!styleFabricId && hints.componentId) {
    const matching = (await slotsOfStyle({ componentId: hints.componentId })).filter(
      (s) =>
        (!lotGeneric || !s.genericGreigeName || s.genericGreigeName.trim().toLowerCase() === lotGeneric) &&
        (!s.fabricFinishType || s.fabricFinishType === finishType)
    );
    if (matching.length === 1) styleFabricId = matching[0].id;
  }
  if (!styleFabricId && lotGreigeId) {
    // The greige the lot was dyed from, read off the style's CAD rows (the receipt's own fallback)
    styleFabricId = await resolveManualJobStyleFabricAnchor(styleId, lotGreigeId, finishType);
  }
  if (!styleFabricId && lotGreigeId) {
    const byGreige = await slotsOfStyle({ fabric: { greigeId: lotGreigeId } });
    if (byGreige.length === 1) styleFabricId = byGreige[0].id;
  }
  if (!styleFabricId) {
    throw new BusinessError(
      `Cannot tell which fabric of ${style.styleCode} this lot belongs to (${lotLabel || fabricStockId}). ` +
        `Check the style's fabrics (greige ${fabricStock.fabricMaster?.greige?.genericGreigeName ?? '—'}, ` +
        `finish ${finishType}) and press Create CAD again.`
    );
  }

  // 2. One Production CAD per lot — a rejected one may be replaced
  const existing = await prisma.fabric_width_cad.findFirst({
    where: {
      fabricStockId,
      ...(options.excludeCadId ? { id: { not: options.excludeCadId } } : {}),
      AND: [
        PRODUCTION_PURPOSE_WHERE,
        { OR: [{ approvalStatus: null }, { approvalStatus: { not: 'REJECTED' } }] }, // allow-cad-approval
      ],
    },
    select: { approvalStatus: true },
  });
  if (existing) {
    throw new BusinessError(
      `This lot (${lotLabel || fabricStockId}) already has a Production CAD (${(existing.approvalStatus ?? 'PENDING').toLowerCase()}). ` +
        `Open it in the Production section of the table.`
    );
  }

  return { fabricStock, styleFabricId, styleCode: style.styleCode, lotLabel, finishType, lotGreigeId };
}
