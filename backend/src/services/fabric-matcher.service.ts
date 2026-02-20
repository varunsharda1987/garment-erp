/**
 * Fabric Matcher Service
 *
 * Matches text-based fabric descriptions from style_fabrics to fabric_master records
 * Used for migrating NULL fabricId values to proper fabric references
 */

import prisma from '../config/database';

export interface FabricMatchResult {
  styleFabricId: string;
  matchedFabricId: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  matchReason: string;
  suggestedFabricCode?: string;
}

interface StyleFabricToMatch {
  id: string;
  fabricName: string | null;
  genericGreigeName: string | null;
  fabricType: string | null;
  fabricColor: string | null;
  fabricGSM: string | null;
}

/**
 * Match a single style_fabric to fabric_master
 */
async function matchSingleFabric(styleFabric: StyleFabricToMatch): Promise<FabricMatchResult> {
  const { id, fabricName, genericGreigeName, fabricType, fabricColor } = styleFabric;

  // HIGH CONFIDENCE: Exact fabricName match
  if (fabricName) {
    const exactMatch = await prisma.fabric_master.findFirst({
      where: { fabricName: { equals: fabricName, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
    });

    if (exactMatch) {
      return {
        styleFabricId: id,
        matchedFabricId: exactMatch.id,
        confidence: 'HIGH',
        matchReason: `Exact fabricName match: "${fabricName}"`,
      };
    }
  }

  // MEDIUM CONFIDENCE: genericGreigeName + color + type match
  if (genericGreigeName) {
    const whereClause: any = {
      genericGreigeName: { equals: genericGreigeName, mode: 'insensitive' },
    };

    if (fabricColor) {
      whereClause.colorName = { contains: fabricColor, mode: 'insensitive' };
    }

    if (fabricType) {
      whereClause.finishType = fabricType;
    }

    const partialMatch = await prisma.fabric_master.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    if (partialMatch) {
      return {
        styleFabricId: id,
        matchedFabricId: partialMatch.id,
        confidence: 'MEDIUM',
        matchReason: `Partial match: genericGreigeName="${genericGreigeName}"${fabricColor ? `, color="${fabricColor}"` : ''}${fabricType ? `, type="${fabricType}"` : ''}`,
      };
    }
  }

  // LOW CONFIDENCE: genericGreigeName only
  if (genericGreigeName) {
    const genericMatch = await prisma.fabric_master.findFirst({
      where: {
        genericGreigeName: { equals: genericGreigeName, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (genericMatch) {
      return {
        styleFabricId: id,
        matchedFabricId: genericMatch.id,
        confidence: 'LOW',
        matchReason: `Generic match: genericGreigeName="${genericGreigeName}" only`,
      };
    }
  }

  // NONE: No match found - need to create placeholder
  return {
    styleFabricId: id,
    matchedFabricId: null,
    confidence: 'NONE',
    matchReason: 'No matching fabric_master found',
    suggestedFabricCode: generateAutoFabricCode(fabricName, genericGreigeName),
  };
}

/**
 * Generate auto fabric code for unmatched fabrics
 */
function generateAutoFabricCode(fabricName: string | null, genericGreigeName: string | null): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const baseName = fabricName || genericGreigeName || 'UNKNOWN';
  const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();
  return `AUTO-${cleanName}-${timestamp}-${random}`;
}

/**
 * Match all style_fabrics with NULL fabricId
 */
export async function matchAllStyleFabrics(): Promise<FabricMatchResult[]> {
  // Fetch all style_fabrics with NULL fabricId
  const styleFabricsToMatch = await prisma.style_fabrics.findMany({
    where: {
      fabricId: null,
    },
    select: {
      id: true,
      fabricName: true,
      genericGreigeName: true,
      fabricType: true,
      fabricColor: true,
      fabricGSM: true,
    },
  });

  console.log(`Found ${styleFabricsToMatch.length} style_fabrics with NULL fabricId`);

  const results: FabricMatchResult[] = [];

  for (const styleFabric of styleFabricsToMatch) {
    const result = await matchSingleFabric(styleFabric);
    results.push(result);
  }

  return results;
}

/**
 * Get match statistics
 */
export function getMatchStatistics(results: FabricMatchResult[]) {
  const stats = {
    total: results.length,
    high: results.filter((r) => r.confidence === 'HIGH').length,
    medium: results.filter((r) => r.confidence === 'MEDIUM').length,
    low: results.filter((r) => r.confidence === 'LOW').length,
    none: results.filter((r) => r.confidence === 'NONE').length,
  };

  return {
    ...stats,
    successRate: ((stats.high + stats.medium + stats.low) / stats.total) * 100,
  };
}

/**
 * Create placeholder fabric_master for unmatched style_fabrics
 */
export async function createPlaceholderFabrics(
  unmatchedResults: FabricMatchResult[],
  createdById: string
): Promise<{ fabricId: string; styleFabricId: string }[]> {
  const createdFabrics: { fabricId: string; styleFabricId: string }[] = [];

  for (const result of unmatchedResults) {
    if (result.confidence === 'NONE' && result.suggestedFabricCode) {
      // Get original style_fabric data
      const styleFabric = await prisma.style_fabrics.findUnique({
        where: { id: result.styleFabricId },
      });

      if (!styleFabric) continue;

      // Create placeholder fabric_master
      const newFabric = await prisma.fabric_master.create({
        data: {
          fabricCode: result.suggestedFabricCode,
          fabricName: styleFabric.fabricName || styleFabric.genericGreigeName || 'Unknown Fabric',
          genericGreigeName: styleFabric.genericGreigeName,
          colorName: styleFabric.fabricColor,
          finishType: (styleFabric.fabricType as any) || 'RAW',
          actualGSM: styleFabric.fabricGSM ? parseFloat(styleFabric.fabricGSM) : null,
          isActive: true,
          createdById,
        },
      });

      createdFabrics.push({
        fabricId: newFabric.id,
        styleFabricId: result.styleFabricId,
      });

      console.log(`Created placeholder fabric: ${newFabric.fabricCode} for style_fabric ${result.styleFabricId}`);
    }
  }

  return createdFabrics;
}

export default {
  matchAllStyleFabrics,
  getMatchStatistics,
  createPlaceholderFabrics,
};
