import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fabric Master Controller
 * Manages finished, ready-to-use fabrics
 */

// Get all fabric masters with pagination and filters
export const getAllFabricMasters = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      greigeId = '',
      supplierId = '',
      isActive = 'true',
      colorName = '',
      finishType = '',
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

    // Search filter (code, name, color)
    if (search) {
      where.OR = [
        { fabricCode: { contains: search as string, mode: 'insensitive' } },
        { fabricName: { contains: search as string, mode: 'insensitive' } },
        { colorName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Greige filter
    if (greigeId) {
      where.greigeId = greigeId as string;
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

    // Color filter
    if (colorName) {
      where.colorName = { contains: colorName as string, mode: 'insensitive' };
    }

    // Finish type filter
    if (finishType) {
      where.finishType = finishType as string;
    }

    // Get total count
    const total = await prisma.fabric_master.count({ where });

    // Get paginated results
    const fabricMasters = await prisma.fabric_master.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        greige: true,
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
            widthCADs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      data: fabricMasters,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching fabric masters:', error);
    res.status(500).json({ error: 'Failed to fetch fabric masters' });
  }
};

// Get single fabric master by ID
export const getFabricMasterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const fabricMaster = await prisma.fabric_master.findUnique({
      where: { id },
      include: {
        greige: true,
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
        widthCADs: {
          orderBy: {
            availableWidth: 'asc',
          },
        },
      },
    });

    if (!fabricMaster) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    res.json(fabricMaster);
  } catch (error: any) {
    console.error('Error fetching fabric master:', error);
    res.status(500).json({ error: 'Failed to fetch fabric master' });
  }
};

// Create new fabric master
export const createFabricMaster = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      fabricCode,
      fabricName,
      greigeId,
      colorName,
      colorCode,
      finishType,
      finishProcess,
      printDesign,
      actualWidth,
      actualGSM,
      actualShrinkage,
      suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
      description,
      notes,
      imageUrl,
      isActive = true,
    } = req.body;

    // Validate required fields
    if (!fabricCode || !fabricName || !greigeId || !actualWidth) {
      return res.status(400).json({
        error: 'Missing required fields: fabricCode, fabricName, greigeId, actualWidth',
      });
    }

    // Check if fabric code already exists
    const existingFabric = await prisma.fabric_master.findUnique({
      where: { fabricCode },
    });

    if (existingFabric) {
      return res.status(400).json({ error: 'Fabric code already exists' });
    }

    // Verify greige exists
    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      return res.status(400).json({ error: 'Greige master not found' });
    }

    const fabricMaster = await prisma.fabric_master.create({
      data: {
        fabricCode,
        fabricName,
        greigeId,
        colorName,
        colorCode,
        finishType,
        finishProcess,
        printDesign,
        actualWidth: parseFloat(actualWidth),
        actualGSM: actualGSM ? parseInt(actualGSM) : null,
        actualShrinkage: actualShrinkage ? parseFloat(actualShrinkage) : null,
        description,
        notes,
        imageUrl,
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
        greige: true,
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

    res.status(201).json(fabricMaster);
  } catch (error: any) {
    console.error('Error creating fabric master:', error);
    res.status(500).json({ error: 'Failed to create fabric master' });
  }
};

// Update fabric master
export const updateFabricMaster = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fabricCode,
      fabricName,
      greigeId,
      colorName,
      colorCode,
      finishType,
      finishProcess,
      printDesign,
      actualWidth,
      actualGSM,
      actualShrinkage,
      suppliers, // Array of {supplierId, isPreferred, isActive, notes}
      description,
      notes,
      imageUrl,
      isActive,
    } = req.body;

    // Check if fabric exists
    const existingFabric = await prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!existingFabric) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    // If updating code, check for duplicates
    if (fabricCode && fabricCode !== existingFabric.fabricCode) {
      const duplicateCode = await prisma.fabric_master.findUnique({
        where: { fabricCode },
      });

      if (duplicateCode) {
        return res.status(400).json({ error: 'Fabric code already exists' });
      }
    }

    // If updating greige, verify it exists
    if (greigeId && greigeId !== existingFabric.greigeId) {
      const greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(400).json({ error: 'Greige master not found' });
      }
    }

    // Build update data
    const updateData: any = {
      fabricCode,
      fabricName,
      greigeId,
      colorName,
      colorCode,
      finishType,
      finishProcess,
      printDesign,
      actualWidth: actualWidth ? parseFloat(actualWidth) : undefined,
      actualGSM: actualGSM ? parseInt(actualGSM) : null,
      actualShrinkage: actualShrinkage ? parseFloat(actualShrinkage) : null,
      description,
      notes,
      imageUrl,
      isActive,
    };

    // Update suppliers if provided
    if (suppliers !== undefined) {
      // Delete existing supplier relationships
      await prisma.fabric_suppliers.deleteMany({
        where: { fabricId: id },
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

    const updatedFabric = await prisma.fabric_master.update({
      where: { id },
      data: updateData,
      include: {
        greige: true,
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

    res.json(updatedFabric);
  } catch (error: any) {
    console.error('Error updating fabric master:', error);
    res.status(500).json({ error: 'Failed to update fabric master' });
  }
};

// Delete fabric master
export const deleteFabricMaster = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if fabric exists
    const existingFabric = await prisma.fabric_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            widthCADs: true,
          },
        },
      },
    });

    if (!existingFabric) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    // CAD entries will be automatically deleted due to onDelete: Cascade
    await prisma.fabric_master.delete({
      where: { id },
    });

    res.json({
      message: 'Fabric master deleted successfully',
      deletedCADs: existingFabric._count.widthCADs,
    });
  } catch (error: any) {
    console.error('Error deleting fabric master:', error);
    res.status(500).json({ error: 'Failed to delete fabric master' });
  }
};

// Get fabric statistics
export const getFabricStatistics = async (req: Request, res: Response) => {
  try {
    const totalFabrics = await prisma.fabric_master.count();
    const activeFabrics = await prisma.fabric_master.count({
      where: { isActive: true },
    });

    // Group by finish type
    const byFinishType = await prisma.$queryRaw<Array<{ finish_type: string; count: bigint }>>`
      SELECT "finishType" as finish_type, COUNT(*) as count
      FROM fabric_master
      WHERE "isActive" = true AND "finishType" IS NOT NULL
      GROUP BY "finishType"
      ORDER BY count DESC
    `;

    // Group by color
    const byColor = await prisma.$queryRaw<Array<{ color_name: string; count: bigint }>>`
      SELECT "colorName" as color_name, COUNT(*) as count
      FROM fabric_master
      WHERE "isActive" = true AND "colorName" IS NOT NULL
      GROUP BY "colorName"
      ORDER BY count DESC
      LIMIT 10
    `;

    // Average shrinkage
    const avgShrinkage = await prisma.fabric_master.aggregate({
      where: {
        isActive: true,
        actualShrinkage: { not: null },
      },
      _avg: {
        actualShrinkage: true,
      },
    });

    res.json({
      totalFabrics,
      activeFabrics,
      inactiveFabrics: totalFabrics - activeFabrics,
      averageShrinkagePercent: avgShrinkage._avg.actualShrinkage,
      byFinishType: byFinishType.map(item => ({
        finishType: item.finish_type,
        count: Number(item.count),
      })),
      byColor: byColor.map(item => ({
        colorName: item.color_name,
        count: Number(item.count),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching fabric statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Get fabrics by greige ID
export const getFabricsByGreigeId = async (req: Request, res: Response) => {
  try {
    const { greigeId } = req.params;

    const fabrics = await prisma.fabric_master.findMany({
      where: { greigeId },
      include: {
        widthCADs: {
          orderBy: {
            availableWidth: 'asc',
          },
        },
      },
      orderBy: {
        fabricName: 'asc',
      },
    });

    res.json(fabrics);
  } catch (error: any) {
    console.error('Error fetching fabrics by greige:', error);
    res.status(500).json({ error: 'Failed to fetch fabrics' });
  }
};

// Get pricing history for a fabric from fabric_procurement
export const getFabricPricingHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    // Check if fabric exists
    const fabric = await prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!fabric) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    // Get last N procurements for this fabric
    const procurements = await prisma.fabric_procurement.findMany({
      where: {
        fabricId: id,
        procurementType: 'FINISHED',
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
      fabricId: id,
      fabricName: fabric.fabricName,
      fabricCode: fabric.fabricCode,
      pricingHistory,
    });
  } catch (error: any) {
    console.error('Error fetching fabric pricing history:', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
};
