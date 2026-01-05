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
 */
export async function getStylesForCADPlanning(req: Request, res: Response) {
  try {
    const {
      status = 'PENDING',
      page = '1',
      limit = '20',
      search = '',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      isActive: true,
      // Note: Removed status: 'ACTIVE' filter - CAD planning works with DRAFT styles too
      cadStatus: status as string,
    };

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
                },
              },
            },
          },
        },
      }),
      prisma.styles.count({ where }),
    ]);

    // Transform to include fabric summary
    const transformedStyles = styles.map((style) => {
      const fabricNames = new Set<string>();
      style.style_components?.forEach((comp) => {
        comp.style_fabrics?.forEach((sf) => {
          if (sf.fabric?.genericFabricName) {
            fabricNames.add(sf.fabric.genericFabricName);
          } else if (sf.fabric?.fabricName) {
            fabricNames.add(sf.fabric.fabricName);
          }
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
