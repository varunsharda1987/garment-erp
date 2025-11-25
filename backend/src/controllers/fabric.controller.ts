import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

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
    logError('Error fetching fabric masters', error);
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
    logError('Error fetching fabric master', error);
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
      printDesign,
      actualWidth,
      actualGSM,
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
        genericFabricName: (req.body as any).genericFabricName || null,
        colorName,
        colorCode,
        finishType,
        printDesign,
        actualWidth: parseFloat(actualWidth),
        cutableWidth: (req.body as any).cutableWidth ? parseFloat((req.body as any).cutableWidth) : parseFloat(actualWidth) - 2,
        finishedConstruction: (req.body as any).finishedConstruction || null,
        actualGSM: actualGSM ? parseInt(actualGSM) : null,
        valueAddition: (req.body as any).valueAddition || null,
        valueAdditionCost: (req.body as any).valueAdditionCost ? parseFloat((req.body as any).valueAdditionCost) : null,
        styleReference: (req.body as any).styleReference || null,
        componentType: (req.body as any).componentType || null,
        description,
        notes,
        imageUrl,
        isGeneric: (req.body as any).isGeneric !== false,
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
    logError('Error creating fabric master', error);
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
      printDesign,
      actualWidth,
      actualGSM,
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
      printDesign,
      actualWidth: actualWidth ? parseFloat(actualWidth) : undefined,
      cutableWidth: (req.body as any).cutableWidth ? parseFloat((req.body as any).cutableWidth) : actualWidth ? parseFloat(actualWidth) - 2 : undefined,
      finishedConstruction: (req.body as any).finishedConstruction || null,
      actualGSM: actualGSM ? parseInt(actualGSM) : null,
      genericFabricName: (req.body as any).genericFabricName || null,
      valueAddition: (req.body as any).valueAddition || null,
      valueAdditionCost: (req.body as any).valueAdditionCost ? parseFloat((req.body as any).valueAdditionCost) : null,
      styleReference: (req.body as any).styleReference || null,
      componentType: (req.body as any).componentType || null,
      description,
      notes,
      imageUrl,
      isGeneric: (req.body as any).isGeneric !== false,
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
    logError('Error updating fabric master', error);
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
    logError('Error deleting fabric master', error);
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
    const byFinishType = await prisma.$queryRaw<Array<{ finishType: string; count: bigint }>>`
      SELECT "finishType", COUNT(*) as count
      FROM fabric_master
      WHERE "isActive" = true AND "finishType" IS NOT NULL
      GROUP BY "finishType"
      ORDER BY count DESC
    `;

    // Group by color
    const byColor = await prisma.$queryRaw<Array<{ colorName: string; count: bigint }>>`
      SELECT "colorName", COUNT(*) as count
      FROM fabric_master
      WHERE "isActive" = true AND "colorName" IS NOT NULL
      GROUP BY "colorName"
      ORDER BY count DESC
      LIMIT 10
    `;

    res.json({
      totalFabrics,
      activeFabrics,
      inactiveFabrics: totalFabrics - activeFabrics,
      byFinishType: byFinishType.map(item => ({
        finishType: item.finishType,
        count: Number(item.count),
      })),
      byColor: byColor.map(item => ({
        colorName: item.colorName,
        count: Number(item.count),
      })),
    });
  } catch (error: any) {
    logError('Error fetching fabric statistics', error);
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
    logError('Error fetching fabrics by greige', error);
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
    logError('Error fetching fabric pricing history', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
};

// Bulk import fabric masters from Excel
export const bulkImportFabricMasters = async (req: Request, res: Response) => {
  try {
    const { fabrics } = req.body;
    const userId = (req as any).user?.userId;

    if (!fabrics || !Array.isArray(fabrics)) {
      return res.status(400).json({ error: 'Invalid data format. Expected array of fabrics.' });
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Get current count for code generation
    const currentCount = await prisma.fabric_master.count();

    for (let i = 0; i < fabrics.length; i++) {
      try {
        const fabric = fabrics[i];

        // Validate required fields
        if (!fabric.greigeCode && !fabric.greigeId) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel row (header is row 1)
            error: 'Missing required field: greigeCode or greigeId',
          });
          continue;
        }

        if (!fabric.finishType || !fabric.actualWidth) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: 'Missing required fields: finishType or actualWidth',
          });
          continue;
        }

        // Find greige by code if greigeCode is provided
        let greigeId = fabric.greigeId;
        if (fabric.greigeCode && !greigeId) {
          const greige = await prisma.greige_master.findUnique({
            where: { greigeCode: fabric.greigeCode },
          });

          if (!greige) {
            results.failed++;
            results.errors.push({
              row: i + 2,
              error: `Greige not found with code: ${fabric.greigeCode}`,
            });
            continue;
          }

          greigeId = greige.id;
        }

        // Auto-generate fabric code if not provided
        const fabricCode = fabric.fabricCode || `FAB-${String(currentCount + i + 1).padStart(4, '0')}`;

        // Auto-generate fabric name based on convention
        let fabricName = fabric.fabricName;
        if (!fabricName) {
          const greige = await prisma.greige_master.findUnique({ where: { id: greigeId } });
          const parts = [];

          // Add style reference and component if provided
          if (fabric.styleReference && fabric.componentType) {
            parts.push(fabric.styleReference, fabric.componentType);
          }

          // Add generic fabric name or greige name
          parts.push(fabric.genericFabricName || greige?.greigeName.split(' ')[0] || 'Fabric');

          // Add width
          parts.push(`${fabric.actualWidth}"`);

          // Add color if provided
          if (fabric.colorName) {
            parts.push(fabric.colorName);
          }

          // Add value addition if provided
          if (fabric.valueAddition) {
            parts.push(`+ ${fabric.valueAddition}`);
          }

          fabricName = parts.join(' - ');
        }

        // Calculate cutable width (default: actualWidth - 2")
        const cutableWidth = fabric.cutableWidth || (parseFloat(fabric.actualWidth) - 2);

        // Check if fabric code already exists
        const existingFabric = await prisma.fabric_master.findUnique({
          where: { fabricCode },
        });

        if (existingFabric) {
          // Update existing fabric
          await prisma.fabric_master.update({
            where: { fabricCode },
            data: {
              fabricName,
              greigeId,
              genericFabricName: fabric.genericFabricName || null,
              colorName: fabric.colorName || null,
              colorCode: fabric.colorCode || null,
              finishType: fabric.finishType,
              printDesign: fabric.printDesign || null,
              actualWidth: parseFloat(fabric.actualWidth),
              cutableWidth: cutableWidth,
              finishedConstruction: fabric.finishedConstruction || null,
              actualGSM: fabric.actualGSM ? parseInt(fabric.actualGSM) : null,
              valueAddition: fabric.valueAddition || null,
              valueAdditionCost: fabric.valueAdditionCost ? parseFloat(fabric.valueAdditionCost) : null,
              styleReference: fabric.styleReference || null,
              componentType: fabric.componentType || null,
              description: fabric.description || null,
              notes: fabric.notes || null,
              imageUrl: fabric.imageUrl || null,
              isGeneric: fabric.isGeneric !== false,
              isActive: fabric.isActive !== false,
            },
          });
          results.updated++;
        } else {
          // Create new fabric
          await prisma.fabric_master.create({
            data: {
              fabricCode,
              fabricName,
              greigeId,
              genericFabricName: fabric.genericFabricName || null,
              colorName: fabric.colorName || null,
              colorCode: fabric.colorCode || null,
              finishType: fabric.finishType,
              printDesign: fabric.printDesign || null,
              actualWidth: parseFloat(fabric.actualWidth),
              cutableWidth: cutableWidth,
              finishedConstruction: fabric.finishedConstruction || null,
              actualGSM: fabric.actualGSM ? parseInt(fabric.actualGSM) : null,
              valueAddition: fabric.valueAddition || null,
              valueAdditionCost: fabric.valueAdditionCost ? parseFloat(fabric.valueAdditionCost) : null,
              styleReference: fabric.styleReference || null,
              componentType: fabric.componentType || null,
              description: fabric.description || null,
              notes: fabric.notes || null,
              imageUrl: fabric.imageUrl || null,
              isGeneric: fabric.isGeneric !== false,
              isActive: fabric.isActive !== false,
              createdById: userId,
            },
          });
          results.created++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      message: 'Bulk import completed',
      summary: {
        total: fabrics.length,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
      },
      errors: results.errors,
    });
  } catch (error: any) {
    logError('Bulk import error', error);
    res.status(500).json({ error: 'Failed to import fabric masters' });
  }
};

// Export all fabric masters to Excel format (JSON)
export const exportFabricMasters = async (req: Request, res: Response) => {
  try {
    const fabricMasters = await prisma.fabric_master.findMany({
      where: { isActive: true },
      orderBy: { fabricCode: 'asc' },
      include: {
        greige: {
          select: {
            greigeCode: true,
            greigeName: true,
            composition: true,
            yarnCount: true,
            construction: true,
          },
        },
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
    const exportData = fabricMasters.map((fabric) => {
      return {
        'Fabric Code': fabric.fabricCode,
        'Fabric Name': fabric.fabricName,
        'Greige Code': fabric.greige?.greigeCode || '',
        'Greige Name': fabric.greige?.greigeName || '',
        'Generic Fabric Name': fabric.genericFabricName || '',
        'Style Reference': fabric.styleReference || '',
        'Component Type': fabric.componentType || '',
        'Color Name': fabric.colorName || '',
        'Color Code': fabric.colorCode || '',
        'Finish Type': fabric.finishType || '',
        'Print Design': fabric.printDesign || '',
        'Actual Width (inches)': Number(fabric.actualWidth),
        'Cutable Width (inches)': fabric.cutableWidth ? Number(fabric.cutableWidth) : '',
        'Finished Construction': fabric.finishedConstruction || '',
        'Actual GSM': fabric.actualGSM || '',
        'Value Addition': fabric.valueAddition || '',
        'Value Addition Cost': fabric.valueAdditionCost ? Number(fabric.valueAdditionCost) : '',
        'Composition': fabric.greige?.composition || '',
        'Yarn Count': fabric.greige?.yarnCount || '',
        'Construction': fabric.greige?.construction || '',
        'Description': fabric.description || '',
        'Notes': fabric.notes || '',
        'Suppliers': fabric.suppliers
          .map((s) => `${s.supplier.code} - ${s.supplier.name}`)
          .join('; '),
        'Is Generic': fabric.isGeneric ? 'TRUE' : 'FALSE',
        'Is Active': fabric.isActive ? 'TRUE' : 'FALSE',
      };
    });

    res.json({
      data: exportData,
      totalRecords: exportData.length,
    });
  } catch (error: any) {
    logError('Export error', error);
    res.status(500).json({ error: 'Failed to export fabric masters' });
  }
};

/**
 * Get unique Generic Fabric Names for style creation dropdown
 * GET /api/fabrics/generic-names
 */
export const getGenericFabricNames = async (req: Request, res: Response) => {
  try {
    const { isActive = 'true' } = req.query;

    // Build where clause
    const where: any = {
      genericFabricName: { not: null }, // Only get fabrics with generic names
    };

    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    // Get distinct generic fabric names
    const fabrics = await prisma.fabric_master.findMany({
      where,
      select: {
        genericFabricName: true,
      },
      distinct: ['genericFabricName'],
      orderBy: {
        genericFabricName: 'asc',
      },
    });

    // Extract unique names and filter out nulls
    const genericNames = fabrics
      .map(f => f.genericFabricName)
      .filter(name => name !== null && name.trim().length > 0) as string[];

    logDebug(`Found ${genericNames.length} unique generic fabric names`);

    res.json({
      data: genericNames,
      count: genericNames.length,
    });
  } catch (error: any) {
    logError('Error fetching generic fabric names', error);
    res.status(500).json({ error: 'Failed to fetch generic fabric names' });
  }
};
