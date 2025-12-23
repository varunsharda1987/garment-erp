import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import {
  RawGreigeData,
  SerializedGreige,
  GreigeSupplierInput,
  GreigeWhereClause,
  GreigeUpdateData,
} from '../types/greige.types';

const prisma = new PrismaClient();

/**
 * Greige Master Controller
 * Manages raw, unfinished fabric specifications
 */

// Helper function to convert Decimal fields to numbers for JSON serialization
const serializeGreige = (greige: RawGreigeData): SerializedGreige => {
  return {
    ...greige,
    greigeWidth: greige.greigeWidth ? Number(greige.greigeWidth) : null,
    defaultCutableWidth: greige.defaultCutableWidth ? Number(greige.defaultCutableWidth) : null,
    expectedFinishedWidthMin: greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : null,
    expectedFinishedWidthMax: greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : null,
    averageShrinkagePercent: greige.averageShrinkagePercent ? Number(greige.averageShrinkagePercent) : null,
    costPerMeter: greige.costPerMeter ? Number(greige.costPerMeter) : null,
  };
};

// Get all greige masters with pagination and filters
export const getAllGreigeMasters = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      supplierId = '',
      isActive = 'true',
      composition = '',
      weaveType = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: GreigeWhereClause = {};

    // Active filter
    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    // Search filter (code, name, composition)
    if (search) {
      where.OR = [
        { greigeCode: { contains: search as string, mode: 'insensitive' } },
        { greigeName: { contains: search as string, mode: 'insensitive' } },
        { composition: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Supplier filter (via junction table)
    if (supplierId) {
      where.suppliers = {
        some: {
          supplierId: supplierId as string,
          isActive: true,
        },
      };
    }

    // Composition filter
    if (composition) {
      where.composition = { contains: composition as string, mode: 'insensitive' };
    }

    // Weave type filter
    if (weaveType) {
      where.weaveType = weaveType as string;
    }

    // Get total count
    const total = await prisma.greige_master.count({ where });

    // Get paginated results
    const greigeMasters = await prisma.greige_master.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            isPreferred: 'desc',
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            finishedFabrics: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Serialize Decimal fields to numbers
    const serializedData = greigeMasters.map(serializeGreige);

    res.json({
      data: serializedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: unknown) {
    logError('Error fetching greige masters:', error);
    res.status(500).json({ error: 'Failed to fetch greige masters' });
  }
};

// Get single greige master by ID
export const getGreigeMasterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const greigeMaster = await prisma.greige_master.findUnique({
      where: { id },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            isPreferred: 'desc',
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finishedFabrics: {
          include: {
            widthCADs: true,
          },
        },
      },
    });

    if (!greigeMaster) {
      return res.status(404).json({ error: 'Greige master not found' });
    }

    // Serialize Decimal fields to numbers
    const serialized = serializeGreige(greigeMaster);

    res.json(serialized);
  } catch (error: unknown) {
    logError('Error fetching greige master:', error);
    res.status(500).json({ error: 'Failed to fetch greige master' });
  }
};

// Create new greige master
export const createGreigeMaster = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      greigeCode,
      greigeName,
      genericFabricName,
      yarnCount,
      construction,
      composition,
      weaveType,
      greigeWidth,
      expectedFinishedWidthMin,
      expectedFinishedWidthMax,
      averageShrinkagePercent,
      suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
      gsmRange,
      costPerMeter,
      moq,
      leadTimeDays,
      supplierId,
      description,
      notes,
      isActive = true,
    } = req.body;

    // Validate required fields
    if (!greigeCode || !greigeName || !composition || !greigeWidth) {
      return res.status(400).json({
        error: 'Missing required fields: greigeCode, greigeName, composition, greigeWidth',
      });
    }

    // Check if greige code already exists
    const existingGreige = await prisma.greige_master.findFirst({
      where: { greigeCode, isActive: true },
    });

    if (existingGreige) {
      return res.status(400).json({ error: 'Greige code already exists' });
    }

    const greigeMaster = await prisma.greige_master.create({
      data: {
        greigeCode,
        greigeName,
        genericFabricName: genericFabricName || null,
        yarnCount,
        construction,
        composition,
        weaveType,
        greigeWidth: parseFloat(greigeWidth),
        expectedFinishedWidthMin: expectedFinishedWidthMin
          ? parseFloat(expectedFinishedWidthMin)
          : null,
        expectedFinishedWidthMax: expectedFinishedWidthMax
          ? parseFloat(expectedFinishedWidthMax)
          : null,
        averageShrinkagePercent: averageShrinkagePercent
          ? parseFloat(averageShrinkagePercent)
          : 8.0,
        gsmRange,
        costPerMeter: costPerMeter ? parseFloat(costPerMeter) : null,
        moq: moq ? parseInt(moq) : null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : null,
        supplierId: supplierId || null,
        description,
        notes,
        isActive,
        createdById: userId,
        suppliers: {
          create: suppliers.map((s: GreigeSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
          })),
        },
      },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(greigeMaster);
  } catch (error: unknown) {
    logError('Error creating greige master:', error);
    res.status(500).json({ error: 'Failed to create greige master' });
  }
};

// Update greige master
export const updateGreigeMaster = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      greigeCode,
      greigeName,
      genericFabricName,
      yarnCount,
      construction,
      composition,
      weaveType,
      greigeWidth,
      expectedFinishedWidthMin,
      expectedFinishedWidthMax,
      averageShrinkagePercent,
      suppliers, // Array of {supplierId, isPreferred, isActive, notes}
      gsmRange,
      costPerMeter,
      moq,
      leadTimeDays,
      supplierId,
      description,
      notes,
      isActive,
    } = req.body;

    // Check if greige exists
    const existingGreige = await prisma.greige_master.findUnique({
      where: { id },
    });

    if (!existingGreige) {
      return res.status(404).json({ error: 'Greige master not found' });
    }

    // If updating code, check for duplicates
    if (greigeCode && greigeCode !== existingGreige.greigeCode) {
      const duplicateCode = await prisma.greige_master.findFirst({
        where: { greigeCode, isActive: true },
      });

      if (duplicateCode) {
        return res.status(400).json({ error: 'Greige code already exists' });
      }
    }

    // Build update data
    const updateData: GreigeUpdateData = {
      greigeCode,
      greigeName,
      genericFabricName: genericFabricName !== undefined ? (genericFabricName || null) : undefined,
      yarnCount,
      construction,
      composition,
      weaveType,
      greigeWidth: greigeWidth ? parseFloat(greigeWidth) : undefined,
      expectedFinishedWidthMin: expectedFinishedWidthMin
        ? parseFloat(expectedFinishedWidthMin)
        : null,
      expectedFinishedWidthMax: expectedFinishedWidthMax
        ? parseFloat(expectedFinishedWidthMax)
        : null,
      averageShrinkagePercent: averageShrinkagePercent
        ? parseFloat(averageShrinkagePercent)
        : undefined,
      gsmRange,
      costPerMeter: costPerMeter !== undefined ? (costPerMeter ? parseFloat(costPerMeter) : null) : undefined,
      moq: moq !== undefined ? (moq ? parseInt(moq) : null) : undefined,
      leadTimeDays: leadTimeDays !== undefined ? (leadTimeDays ? parseInt(leadTimeDays) : null) : undefined,
      supplierId: supplierId !== undefined ? (supplierId || null) : undefined,
      description,
      notes,
      isActive,
    };

    // Update suppliers if provided
    if (suppliers !== undefined) {
      // Delete existing supplier relationships
      await prisma.greige_suppliers.deleteMany({
        where: { greigeId: id },
      });

      // Create new supplier relationships
      updateData.suppliers = {
        create: suppliers.map((s: GreigeSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
        })),
      };
    }

    const updatedGreige = await prisma.greige_master.update({
      where: { id },
      data: updateData,
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(updatedGreige);
  } catch (error: unknown) {
    logError('Error updating greige master:', error);
    res.status(500).json({ error: 'Failed to update greige master' });
  }
};

// Delete greige master
export const deleteGreigeMaster = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if greige exists
    const existingGreige = await prisma.greige_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            finishedFabrics: true,
          },
        },
      },
    });

    if (!existingGreige) {
      return res.status(404).json({ error: 'Greige master not found' });
    }

    // Check if greige has finished fabrics
    if (existingGreige._count.finishedFabrics > 0) {
      return res.status(400).json({
        error: `Cannot delete greige master with ${existingGreige._count.finishedFabrics} linked finished fabrics. Please delete or reassign the fabrics first.`,
      });
    }

    await prisma.greige_master.delete({
      where: { id },
    });

    res.json({ message: 'Greige master deleted successfully' });
  } catch (error: unknown) {
    logError('Error deleting greige master:', error);
    res.status(500).json({ error: 'Failed to delete greige master' });
  }
};

// Get greige statistics
export const getGreigeStatistics = async (req: Request, res: Response) => {
  try {
    const totalGreige = await prisma.greige_master.count();
    const activeGreige = await prisma.greige_master.count({
      where: { isActive: true },
    });

    // Group by composition
    const byComposition = await prisma.$queryRaw<Array<{ composition: string; count: bigint }>>`
      SELECT composition, COUNT(*) as count
      FROM greige_master
      WHERE "isActive" = true
      GROUP BY composition
      ORDER BY count DESC
      LIMIT 10
    `;

    // Group by weave type
    const byWeaveType = await prisma.$queryRaw<Array<{ weaveType: string; count: bigint }>>`
      SELECT "weaveType", COUNT(*) as count
      FROM greige_master
      WHERE "isActive" = true AND "weaveType" IS NOT NULL
      GROUP BY "weaveType"
      ORDER BY count DESC
    `;

    res.json({
      totalGreige,
      activeGreige,
      inactiveGreige: totalGreige - activeGreige,
      byComposition: byComposition.map(item => ({
        composition: item.composition,
        count: Number(item.count),
      })),
      byWeaveType: byWeaveType.map(item => ({
        weaveType: item.weaveType,
        count: Number(item.count),
      })),
    });
  } catch (error: unknown) {
    logError('Error fetching greige statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Get pricing history for a greige from fabric_procurement
export const getGreigePricingHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    // Check if greige exists
    const greige = await prisma.greige_master.findUnique({
      where: { id },
    });

    if (!greige) {
      return res.status(404).json({ error: 'Greige master not found' });
    }

    // Get last N procurements for this greige
    const procurements = await prisma.fabric_procurement.findMany({
      where: {
        greigeId: id,
        procurementType: 'GREIGE',
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
      take: parseInt(limit as string),
    });

    // Format the response
    const pricingHistory = procurements.map(p => ({
      id: p.id,
      date: p.purchaseDate,
      supplier: p.supplier,
      quantity: p.quantityPurchased,
      unit: p.unit,
      ratePerUnit: p.ratePerUnit,
      totalCost: p.totalCost,
      width: p.width,
    }));

    res.json({
      greigeId: id,
      greigeName: greige.greigeName,
      greigeCode: greige.greigeCode,
      pricingHistory,
    });
  } catch (error: unknown) {
    logError('Error fetching greige pricing history:', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
};

// Bulk import greige masters from Excel
export const bulkImportGreigeMasters = async (req: Request, res: Response) => {
  try {
    const { greiges } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!greiges || !Array.isArray(greiges)) {
      return res.status(400).json({ error: 'Invalid data format. Expected array of greiges.' });
    }

    const results = {
      created: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Get current count for code generation
    const currentCount = await prisma.greige_master.count();

    for (let i = 0; i < greiges.length; i++) {
      try {
        const greige = greiges[i];

        // Auto-generate greige code
        const greigeCode = `GRG-${String(currentCount + i + 1).padStart(4, '0')}`;

        // Validate required fields
        if (!greige.greigeName || !greige.composition || !greige.greigeWidth || !greige.defaultCutableWidth) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel row (header is row 1)
            error: 'Missing required fields: greigeName, composition, greigeWidth, or defaultCutableWidth',
          });
          continue;
        }

        // Create greige master
        await prisma.greige_master.create({
          data: {
            greigeCode,
            greigeName: greige.greigeName,
            genericFabricName: greige.genericFabricName || null,
            yarnCount: greige.yarnCount || null,
            construction: greige.construction || null,
            composition: greige.composition,
            weaveType: greige.weaveType || null,
            greigeWidth: parseFloat(greige.greigeWidth),
            defaultCutableWidth: greige.defaultCutableWidth
              ? parseFloat(greige.defaultCutableWidth)
              : null,
            expectedFinishedWidthMin: greige.expectedFinishedWidthMin
              ? parseFloat(greige.expectedFinishedWidthMin)
              : null,
            expectedFinishedWidthMax: greige.expectedFinishedWidthMax
              ? parseFloat(greige.expectedFinishedWidthMax)
              : null,
            averageShrinkagePercent: greige.averageShrinkagePercent
              ? parseFloat(greige.averageShrinkagePercent)
              : 8.0,
            gsmRange: greige.gsmRange || null,
            description: greige.description || null,
            notes: greige.notes || null,
            isActive: greige.isActive !== false,
            createdById: userId,
          },
        });

        results.created++;
      } catch (error: unknown) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      message: 'Bulk import completed',
      summary: {
        total: greiges.length,
        created: results.created,
        failed: results.failed,
      },
      errors: results.errors,
    });
  } catch (error: unknown) {
    logError('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import greige masters' });
  }
};

// Export all greige masters to Excel format (JSON)
export const exportGreigeMasters = async (req: Request, res: Response) => {
  try {
    const greigeMasters = await prisma.greige_master.findMany({
      where: { isActive: true },
      orderBy: { greigeCode: 'asc' },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Transform data for Excel export
    const exportData = greigeMasters.map((greige) => {
      // Use stored genericFabricName, fallback to extraction for legacy data
      let genericName = greige.genericFabricName;
      if (!genericName) {
        const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        genericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
      }

      return {
        'Greige Code': greige.greigeCode,
        'Generic Fabric Name': genericName,
        'Greige Name': greige.greigeName,
        'Yarn Count': greige.yarnCount || '',
        'Construction': greige.construction || '',
        'Greige Width (inches)': Number(greige.greigeWidth),
        'Default Cutable Width (inches)': greige.defaultCutableWidth
          ? Number(greige.defaultCutableWidth)
          : '',
        'Composition': greige.composition,
        'Weave Type': greige.weaveType || '',
        'GSM Range': greige.gsmRange || '',
        'Expected Finished Width Min': greige.expectedFinishedWidthMin
          ? Number(greige.expectedFinishedWidthMin)
          : '',
        'Expected Finished Width Max': greige.expectedFinishedWidthMax
          ? Number(greige.expectedFinishedWidthMax)
          : '',
        'Average Shrinkage %': Number(greige.averageShrinkagePercent),
        'Description': greige.description || '',
        'Notes': greige.notes || '',
        'Suppliers': greige.suppliers
          .map((s) => `${s.supplier.code} - ${s.supplier.name}`)
          .join('; '),
        'Is Active': greige.isActive ? 'TRUE' : 'FALSE',
      };
    });

    res.json({
      data: exportData,
      totalRecords: exportData.length,
    });
  } catch (error: unknown) {
    logError('Export error:', error);
    res.status(500).json({ error: 'Failed to export greige masters' });
  }
};
