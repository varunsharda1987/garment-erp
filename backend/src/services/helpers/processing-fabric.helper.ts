/**
 * P2.8 Processing Fabric Helper
 *
 * Handles get-or-create of finished fabric_master for MRP-generated PROCESSING POs.
 * These POs don't have job_work_orders (unlike dyeing/printing module POs), so the
 * GRN branch needs this helper to create the finished fabric stock.
 *
 * Material Identity Unification invariant: materials.id === master.id is enforced.
 */

import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { generateStyleLinkedFabricCode } from '../../utils/fabric-code-generator';
import { ensureMaterialRecord } from './material-sync.helper';
import { logInfo, logWarn } from '../../utils/logger';

interface GetOrCreateFinishedFabricParams {
  greigeId: string;
  colorName: string;
  finishType: 'DYED' | 'PRINTED';
  widthInches: number;
  styleCode?: string | null;
  styleId?: string | null;
  buyerStyleRef?: string | null;
  userId: string;
}

interface FinishedFabricResult {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  isNew: boolean;
}

/**
 * Get or create a finished fabric_master based on greige + color + finish type.
 * Also ensures the materials record exists (Material Identity Unification).
 *
 * @param params - Fabric parameters
 * @param tx - Prisma transaction client (optional)
 * @returns The fabric_master id and metadata
 */
export async function getOrCreateFinishedFabric(
  params: GetOrCreateFinishedFabricParams,
  tx?: Prisma.TransactionClient
): Promise<FinishedFabricResult> {
  const client = tx ?? prisma;
  const { greigeId, colorName, finishType, widthInches, styleCode, styleId, buyerStyleRef, userId } = params;

  // 1. Get the greige_master for name/composition info
  const greige = await client.greige_master.findUnique({
    where: { id: greigeId },
    select: {
      id: true,
      greigeName: true,
      genericGreigeName: true,
      composition: true,
      yarnCount: true,
    },
  });

  if (!greige) {
    throw new Error(`Greige master ${greigeId} not found`);
  }

  // 2. Check if a matching fabric_master already exists
  const existing = await client.fabric_master.findFirst({
    where: {
      greigeId,
      colorName,
      finishType,
      isActive: true,
    },
    select: { id: true, fabricCode: true, fabricName: true },
  });

  if (existing) {
    logInfo('Found existing finished fabric_master', {
      fabricId: existing.id,
      greigeId,
      colorName,
      finishType,
    });
    return {
      fabricId: existing.id,
      fabricCode: existing.fabricCode,
      fabricName: existing.fabricName,
      isNew: false,
    };
  }

  // 3. Generate fabric code
  const fabricCode = await generateStyleLinkedFabricCode(styleCode, tx);

  // 4. Build fabric name
  const greigeGeneric = greige.genericGreigeName || greige.greigeName?.split('/')[0]?.trim() || 'Fabric';
  const finishLabel = finishType === 'PRINTED' ? 'Printed' : 'Dyed';
  const widthStr = `${widthInches}"`;
  const styleLabel = styleCode ? (buyerStyleRef ? `${styleCode} (${buyerStyleRef})` : styleCode) : 'STK';

  const fabricName = [styleLabel, greigeGeneric, finishLabel, colorName, widthStr].filter(Boolean).join(' - ');

  // 5. Create the fabric_master with id = fabricId (Material Identity Unification)
  const fabricId = crypto.randomUUID();
  const cutableWidth = widthInches > 2 ? widthInches - 2 : widthInches;

  const newFabric = await client.fabric_master.create({
    data: {
      id: fabricId,
      fabricCode,
      fabricName,
      greigeId,
      greigeName: greige.greigeName,
      genericGreigeName: greige.genericGreigeName,
      colorName,
      finishType,
      actualWidth: widthInches,
      cutableWidth: new Prisma.Decimal(cutableWidth),
      composition: greige.composition,
      yarnCount: greige.yarnCount,
      styleReference: styleCode || null,
      source: 'AUTO_FROM_MRP_GRN',
      isGeneric: !styleId,
      isActive: true,
      createdById: userId,
    },
  });

  logInfo('Created new finished fabric_master', {
    fabricId: newFabric.id,
    fabricCode,
    greigeId,
    colorName,
    finishType,
    source: 'AUTO_FROM_MRP_GRN',
  });

  // 6. Ensure materials record exists (Material Identity Unification: materials.id === fabric_master.id)
  await ensureMaterialRecord(newFabric.id, 'FABRIC', tx);

  return {
    fabricId: newFabric.id,
    fabricCode: newFabric.fabricCode,
    fabricName: newFabric.fabricName,
    isNew: true,
  };
}

/**
 * Determine finish type from processor category or requirement printingType.
 */
export function determineFinishType(
  processorCategory: string | null | undefined,
  printingType: string | null | undefined
): 'DYED' | 'PRINTED' {
  // If printingType is set, it's printing
  if (printingType) {
    return 'PRINTED';
  }

  // Check processor category
  if (processorCategory === 'DYEING_PRINTING') {
    // Could be either - default to DYED unless printingType was set
    return 'DYED';
  }

  // Default to DYED for other processing
  return 'DYED';
}
