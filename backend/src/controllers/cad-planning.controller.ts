/**
 * CAD Planning Controller
 *
 * Independent module for CAD Planning operations.
 * Re-exports functions from style-cad-planning.controller.ts for backward compatibility
 * while providing a clean API namespace.
 */

// Re-export all CAD planning functions from the existing controller
// This allows gradual migration without breaking existing code
export {
  // List operations
  getPendingCADStyles,
  getStyleCADSummary,
  getEnhancedCADPlanning,
  getStyleCADHistory,
  getCADTableData,
  getCADOrderHistory,

  // CAD generation and calculation
  generateCADOptions,
  calculateCADCost,
  selectGreigeForGroup,

  // CAD row operations
  addCADWidth,
  deleteCADWidth,
  addCADTableRow,
  addCombinedCADRow,
  updateCADTableRow,
  deleteCADTableRow,
  updateCADValues,
  updateCADValuesWithBreakdown,
  setPreferredCAD,
  getCADGroupDetails,

  // Approval operations
  approveCAD,
  approveCADPurpose,
  rejectCADPurpose,
  createPlanningVersion,
  copyCADPurpose,
  linkCADToStock,

  // Production CAD from stock
  createProductionCADFromStock,

  // Greige operations
  getGreigeOptionsForGeneric,
  getGreigeWidths,

  // Pattern parts
  getStyleFabricPatternParts,
  assignPatternParts,
  updatePatternPartAssignment,
  deletePatternPartAssignment,
  assignPatternPartsFromComponent,
  getCADPatternPartsForComponent,

  // Embroidery CAD
  getEmbroideryCad,
  createOrUpdateEmbroideryCad,
  deleteEmbroideryCad,
  getTotalFabricCad,
} from './style-cad-planning.controller';

// New function: Get CAD status counts for dashboard
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get CAD status counts for all styles
 * Used by CADPlanningList to show tab counts
 * Note: Shows all active styles regardless of DRAFT/ACTIVE status
 * since CAD planning happens during both phases
 */
export async function getCADStatusCounts(req: Request, res: Response) {
  try {
    const counts = await prisma.styles.groupBy({
      by: ['cadStatus'],
      where: {
        isActive: true,
        // Note: Removed status: 'ACTIVE' filter - CAD planning works with DRAFT styles too
      },
      _count: {
        id: true,
      },
    });

    const result = {
      PENDING: 0,
      IN_PROGRESS: 0,
      APPROVED: 0,
    };

    counts.forEach((count) => {
      if (count.cadStatus && count.cadStatus in result) {
        result[count.cadStatus as keyof typeof result] = count._count.id;
      }
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting CAD status counts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get CAD status counts',
    });
  }
}

/**
 * Get styles for CAD planning list with filters
 * Dedicated endpoint for the new CADPlanningList page
 *
 * Enhanced to include:
 * - CAD width details (greige, width, CAD avg, purpose)
 * - Unified search across all statuses (when searchAll=true)
 * - IN_PROGRESS merged into PENDING tab
 */
export async function getStylesForCADPlanning(req: Request, res: Response) {
  try {
    const {
      status = 'PENDING',
      page = '1',
      limit = '20',
      search = '',
      searchAll = 'false', // When true, search across all statuses
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      isActive: true,
    };

    // Handle status filter
    // - If searchAll is true and search is provided, don't filter by status
    // - If status is PENDING, include both PENDING and IN_PROGRESS (merged)
    // - Otherwise use the exact status
    if (!(searchAll === 'true' && search)) {
      if (status === 'PENDING') {
        where.cadStatus = { in: ['PENDING', 'IN_PROGRESS'] };
      } else {
        where.cadStatus = status as string;
      }
    }

    // Add search filter
    if (search) {
      where.OR = [
        { styleCode: { contains: search as string, mode: 'insensitive' } },
        { styleName: { contains: search as string, mode: 'insensitive' } },
        { customerName: { contains: search as string, mode: 'insensitive' } },
        { brand_categories: { brandName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [styles, total] = await Promise.all([
      prisma.styles.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          styleCode: true,
          styleName: true,
          cadStatus: true,
          approvedCadDate: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          customerName: true,
          brand_categories: {
            select: {
              id: true,
              brandName: true,
              category: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          style_components: {
            select: {
              id: true,
              componentName: true,
              componentType: true,
              style_fabrics: {
                select: {
                  id: true,
                  fabric: {
                    select: {
                      id: true,
                      fabricName: true,
                      genericFabricName: true,
                    },
                  },
                  // Include CAD width details via cadRows relation
                  cadRows: {
                    where: {
                      cadMeters: { not: null },
                    },
                    select: {
                      id: true,
                      cutableWidth: true,
                      cadMeters: true,
                      cadAverage: true,
                      purpose: true,
                      greigeId: true,
                      greige: {
                        select: {
                          greigeName: true,
                          greigeCode: true,
                        },
                      },
                    },
                    orderBy: { cutableWidth: 'asc' },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.styles.count({ where }),
    ]);

    // Transform to include fabric summary and CAD details
    const transformedStyles = styles.map((style) => {
      const fabricNames = new Set<string>();
      const cadDetails: Array<{
        id: string;
        cutableWidth: number;
        layerLength: number;  // Renamed from cadMeters for clarity
        cadAverage: number | null;  // Per-piece consumption
        purpose: string | null;
        greigeName: string | null;
        greigeCode: string | null;
      }> = [];

      style.style_components?.forEach((comp) => {
        comp.style_fabrics?.forEach((sf) => {
          // Collect fabric names
          if (sf.fabric?.genericFabricName) {
            fabricNames.add(sf.fabric.genericFabricName);
          } else if (sf.fabric?.fabricName) {
            fabricNames.add(sf.fabric.fabricName);
          }

          // Collect CAD details from each style fabric
          sf.cadRows?.forEach((cad) => {
            cadDetails.push({
              id: cad.id,
              cutableWidth: cad.cutableWidth ? Number(cad.cutableWidth) : 0,
              layerLength: cad.cadMeters ? Number(cad.cadMeters) : 0,  // Renamed from cadMeters
              cadAverage: cad.cadAverage ? Number(cad.cadAverage) : null,  // Per-piece consumption
              purpose: cad.purpose || null,
              greigeName: cad.greige?.greigeName || null,
              greigeCode: cad.greige?.greigeCode || null,
            });
          });
        });
      });

      return {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
        approvedCadDate: style.approvedCadDate,
        imageUrl: style.imageUrl,
        createdAt: style.createdAt,
        updatedAt: style.updatedAt,
        buyerName: style.brand_categories?.customer?.name || style.customerName || null,
        brandName: style.brand_categories?.brandName || null,
        categoryName: style.brand_categories?.category || null,
        componentCount: style.style_components?.length || 0,
        fabricSummary: Array.from(fabricNames).join(', ') || 'No fabrics',
        cadDetails, // NEW: Array of CAD width details
      };
    });

    return res.json({
      success: true,
      data: {
        styles: transformedStyles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Error getting styles for CAD planning:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get styles for CAD planning',
    });
  }
}
