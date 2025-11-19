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

    // Supplier filter
    if (supplierId) {
      where.supplierId = supplierId as string;
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
      supplierId,
      gsmRange,
      costPerMeter,
      moq,
      leadTimeDays,
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
        supplierId: supplierId || null,
        gsmRange,
        costPerMeter: costPerMeter ? parseFloat(costPerMeter) : null,
        moq: moq ? parseInt(moq) : null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : null,
        description,
        notes,
        isActive,
        createdById: userId,
      },
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
      supplierId,
      gsmRange,
      costPerMeter,
      moq,
      leadTimeDays,
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

    const updatedGreige = await prisma.greige_master.update({
      where: { id },
      data: {
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
        supplierId: supplierId || null,
        gsmRange,
        costPerMeter: costPerMeter ? parseFloat(costPerMeter) : null,
        moq: moq ? parseInt(moq) : null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : null,
        description,
        notes,
        isActive,
      },
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
