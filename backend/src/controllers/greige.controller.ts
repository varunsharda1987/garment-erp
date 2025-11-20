import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Greige Master Controller
 * Manages raw, unfinished fabric specifications
 */

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
    const where: any = {};

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

    res.json({
      data: greigeMasters,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching greige masters:', error);
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

    res.json(greigeMaster);
  } catch (error: any) {
    console.error('Error fetching greige master:', error);
    res.status(500).json({ error: 'Failed to fetch greige master' });
  }
};

// Create new greige master
export const createGreigeMaster = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      greigeCode,
      greigeName,
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
    const existingGreige = await prisma.greige_master.findUnique({
      where: { greigeCode },
    });

    if (existingGreige) {
      return res.status(400).json({ error: 'Greige code already exists' });
    }

    const greigeMaster = await prisma.greige_master.create({
      data: {
        greigeCode,
        greigeName,
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
        description,
        notes,
        isActive,
        createdById: userId,
        suppliers: {
          create: suppliers.map((s: any) => ({
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
  } catch (error: any) {
    console.error('Error creating greige master:', error);
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
      const duplicateCode = await prisma.greige_master.findUnique({
        where: { greigeCode },
      });

      if (duplicateCode) {
        return res.status(400).json({ error: 'Greige code already exists' });
      }
    }

    // Build update data
    const updateData: any = {
      greigeCode,
      greigeName,
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
        create: suppliers.map((s: any) => ({
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
  } catch (error: any) {
    console.error('Error updating greige master:', error);
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
  } catch (error: any) {
    console.error('Error deleting greige master:', error);
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
    const byWeaveType = await prisma.$queryRaw<Array<{ weave_type: string; count: bigint }>>`
      SELECT "weaveType" as weave_type, COUNT(*) as count
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
        weaveType: item.weave_type,
        count: Number(item.count),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching greige statistics:', error);
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
  } catch (error: any) {
    console.error('Error fetching greige pricing history:', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
};
