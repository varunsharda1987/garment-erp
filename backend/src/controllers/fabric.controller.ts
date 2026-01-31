import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import { normalizeId, isUUID } from '../utils/id-helper';
import {
  FabricSupplierInput,
  FabricWhereClause,
  FabricUpdateData,
} from '../types/fabric.types';

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
    const where: FabricWhereClause = {};

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
            styleFabrics: true,
          },
        },
        // Include style fabric allocations for Style Usage column
        styleFabrics: {
          where: {
            style_components: {
              styles: {
                isActive: true,
              },
            },
          },
          select: {
            id: true,
            genericFabricName: true,
            style_components: {
              select: {
                id: true,
                componentName: true,
                componentType: true,
                styles: {
                  select: {
                    id: true,
                    styleCode: true,
                    styleName: true,
                  },
                },
              },
            },
          },
          take: 5,
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
  } catch (error: unknown) {
    logError('Error fetching fabric masters', error);
    res.status(500).json({ error: 'Failed to fetch fabric masters' });
  }
};

// Get single fabric master by ID
export const getFabricMasterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const normalizedId = normalizeId(id);

    let fabricMaster = await prisma.fabric_master.findUnique({
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
            cutableWidth: 'asc',
          },
        },
      },
    });

    // If not found and ID is not UUID, try normalized (lowercase) version
    if (!fabricMaster && !isUUID(id) && normalizedId !== id) {
      fabricMaster = await prisma.fabric_master.findUnique({
        where: { id: normalizedId },
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
              cutableWidth: 'asc',
            },
          },
        },
      });
    }

    if (!fabricMaster) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    res.json(fabricMaster);
  } catch (error: unknown) {
    logError('Error fetching fabric master', error);
    res.status(500).json({ error: 'Failed to fetch fabric master' });
  }
};

// Create new fabric master
export const createFabricMaster = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      fabricCode,
      fabricName,
      greigeId,
      greigeName,
      genericFabricName,
      yarnCount,
      composition,
      colorName,
      colorCode,
      finishType,
      printDesign,
      actualWidth,
      cutableWidth,
      finishedConstruction,
      actualGSM,
      valueAddition,
      valueAdditionCost,
      costPerMeter,
      moq,
      leadTimeDays,
      supplierId,
      suppliers = [], // Array of {supplierId, isPreferred, isActive, notes}
      description,
      notes,
      imageUrl,
      styleReference,
      isGeneric,
      isActive = true,
    } = req.body;

    // Validate required fields (greigeId is optional for stock/generic fabrics)
    if (!fabricCode || !fabricName || !actualWidth) {
      return res.status(400).json({
        error: 'Missing required fields: fabricCode, fabricName, actualWidth',
      });
    }

    // Check if fabric code already exists
    const existingFabric = await prisma.fabric_master.findFirst({
      where: { fabricCode, isActive: true },
    });

    if (existingFabric) {
      return res.status(400).json({ error: 'Fabric code already exists' });
    }

    // Verify greige exists if provided
    let greige = null;
    if (greigeId) {
      greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(400).json({ error: 'Greige master not found' });
      }
    }

    const fabricMaster = await prisma.fabric_master.create({
      data: {
        fabricCode,
        fabricName,
        greigeId: greigeId || null,
        greigeName: greigeName || greige?.greigeName || null,
        genericFabricName: genericFabricName || greige?.genericGreigeName || null,
        yarnCount: yarnCount || null,
        composition: composition || null,
        colorName,
        colorCode,
        finishType,
        printDesign,
        actualWidth: parseFloat(actualWidth),
        cutableWidth: cutableWidth ? parseFloat(cutableWidth) : parseFloat(actualWidth) - 2,
        finishedConstruction: finishedConstruction || null,
        actualGSM: actualGSM ? parseInt(actualGSM) : null,
        valueAddition: valueAddition || null,
        valueAdditionCost: valueAdditionCost ? parseFloat(valueAdditionCost) : null,
        costPerMeter: costPerMeter ? parseFloat(costPerMeter) : null,
        moq: moq ? parseInt(moq) : null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : null,
        supplierId: supplierId || null,
        styleReference: styleReference || null,
        description,
        notes,
        imageUrl,
        isGeneric: isGeneric !== false,
        isActive,
        createdById: userId,
        suppliers: {
          create: suppliers.map((s: FabricSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: true,
            notes: null,
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
  } catch (error: unknown) {
    logError('Error creating fabric master', error);
    res.status(500).json({ error: 'Failed to create fabric master' });
  }
};

// Update fabric master
export const updateFabricMaster = async (req: Request, res: Response) => {
  try {
    let { id } = req.params;
    const {
      fabricCode,
      fabricName,
      greigeId,
      greigeName,
      genericFabricName,
      yarnCount,
      composition,
      colorName,
      colorCode,
      finishType,
      printDesign,
      actualWidth,
      cutableWidth,
      finishedConstruction,
      actualGSM,
      valueAddition,
      valueAdditionCost,
      costPerMeter,
      moq,
      leadTimeDays,
      supplierId,
      suppliers, // Array of {supplierId, isPreferred, isActive, notes}
      description,
      notes,
      imageUrl,
      styleReference,
      isGeneric,
      isActive,
    } = req.body;

    // Check if fabric exists (try lowercase for non-UUID IDs)
    let existingFabric = await prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!existingFabric && !isUUID(id)) {
      id = normalizeId(id);
      existingFabric = await prisma.fabric_master.findUnique({
        where: { id },
      });
    }

    if (!existingFabric) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    // If updating code, check for duplicates
    if (fabricCode && fabricCode !== existingFabric.fabricCode) {
      const duplicateCode = await prisma.fabric_master.findFirst({
        where: { fabricCode, isActive: true },
      });

      if (duplicateCode) {
        return res.status(400).json({ error: 'Fabric code already exists' });
      }
    }

    // If updating greige, verify it exists and get its genericFabricName
    let greige = null;
    if (greigeId && greigeId !== existingFabric.greigeId) {
      greige = await prisma.greige_master.findUnique({
        where: { id: greigeId },
      });

      if (!greige) {
        return res.status(400).json({ error: 'Greige master not found' });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      fabricCode,
      fabricName,
      greigeId: greigeId !== undefined ? (greigeId || null) : undefined,
      greigeName: greigeName !== undefined ? (greigeName || greige?.greigeName || null) : undefined,
      genericFabricName: genericFabricName || greige?.genericGreigeName || null,
      yarnCount: yarnCount !== undefined ? (yarnCount || null) : undefined,
      composition: composition !== undefined ? (composition || null) : undefined,
      colorName,
      colorCode,
      finishType,
      printDesign,
      actualWidth: actualWidth ? parseFloat(actualWidth) : undefined,
      cutableWidth: cutableWidth ? parseFloat(cutableWidth) : actualWidth ? parseFloat(actualWidth) - 2 : undefined,
      finishedConstruction: finishedConstruction || null,
      actualGSM: actualGSM ? parseInt(actualGSM) : null,
      valueAddition: valueAddition || null,
      valueAdditionCost: valueAdditionCost ? parseFloat(valueAdditionCost) : null,
      costPerMeter: costPerMeter !== undefined ? (costPerMeter ? parseFloat(costPerMeter) : null) : undefined,
      moq: moq !== undefined ? (moq ? parseInt(moq) : null) : undefined,
      leadTimeDays: leadTimeDays !== undefined ? (leadTimeDays ? parseInt(leadTimeDays) : null) : undefined,
      supplierId: supplierId !== undefined ? (supplierId || null) : undefined,
      styleReference: styleReference || null,
      description,
      notes,
      imageUrl,
      isGeneric: isGeneric !== false,
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
        create: suppliers.map((s: FabricSupplierInput) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: true,
          notes: null,
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
  } catch (error: unknown) {
    logError('Error updating fabric master', error);
    res.status(500).json({ error: 'Failed to update fabric master' });
  }
};

// Delete fabric master
export const deleteFabricMaster = async (req: Request, res: Response) => {
  try {
    let { id } = req.params;

    // Check if fabric exists (try lowercase for non-UUID IDs)
    let existingFabric = await prisma.fabric_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            widthCADs: true,
          },
        },
      },
    });

    if (!existingFabric && !isUUID(id)) {
      id = normalizeId(id);
      existingFabric = await prisma.fabric_master.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              widthCADs: true,
            },
          },
        },
      });
    }

    if (!existingFabric) {
      return res.status(404).json({ error: 'Fabric master not found' });
    }

    // Check for dependencies that would block deletion
    const dependencies = await prisma.fabric_master.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            fabricStock: true,
            styleFabrics: true,
            costingFabricItems: true,
            fabricProcurements: true,
            materials: true,
            processing_batch: true,
            lab_dips: true,
            job_work_orders: true,
          },
        },
      },
    });

    const blockingDeps = [];
    if (dependencies?._count.fabricStock) blockingDeps.push(`${dependencies._count.fabricStock} stock record(s)`);
    if (dependencies?._count.styleFabrics) blockingDeps.push(`${dependencies._count.styleFabrics} style allocation(s)`);
    if (dependencies?._count.costingFabricItems) blockingDeps.push(`${dependencies._count.costingFabricItems} costing item(s)`);
    if (dependencies?._count.fabricProcurements) blockingDeps.push(`${dependencies._count.fabricProcurements} procurement(s)`);
    if (dependencies?._count.materials) blockingDeps.push(`${dependencies._count.materials} material(s)`);
    if (dependencies?._count.processing_batch) blockingDeps.push(`${dependencies._count.processing_batch} processing batch(es)`);
    if (dependencies?._count.lab_dips) blockingDeps.push(`${dependencies._count.lab_dips} lab dip(s)`);
    if (dependencies?._count.job_work_orders) blockingDeps.push(`${dependencies._count.job_work_orders} job work order(s)`);

    if (blockingDeps.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete fabric with existing references',
        details: `This fabric has: ${blockingDeps.join(', ')}`,
        suggestion: 'Consider deactivating the fabric instead of deleting it, or remove the dependent records first.',
      });
    }

    // CAD entries will be automatically deleted due to onDelete: Cascade
    await prisma.fabric_master.delete({
      where: { id },
    });

    res.json({
      message: 'Fabric master deleted successfully',
      deletedCADs: existingFabric._count.widthCADs,
    });
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
            cutableWidth: 'asc',
          },
        },
      },
      orderBy: {
        fabricName: 'asc',
      },
    });

    res.json(fabrics);
  } catch (error: unknown) {
    logError('Error fetching fabrics by greige', error);
    res.status(500).json({ error: 'Failed to fetch fabrics' });
  }
};

// Get pricing history for a fabric from fabric_procurement
export const getFabricPricingHistory = async (req: Request, res: Response) => {
  try {
    let { id } = req.params;
    const { limit = 5 } = req.query;

    // Check if fabric exists (try lowercase for non-UUID IDs)
    let fabric = await prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!fabric && !isUUID(id)) {
      id = normalizeId(id);
      fabric = await prisma.fabric_master.findUnique({
        where: { id },
      });
    }

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
  } catch (error: unknown) {
    logError('Error fetching fabric pricing history', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
};

// Bulk import fabric masters from Excel
export const bulkImportFabricMasters = async (req: Request, res: Response) => {
  try {
    const { fabrics } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

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
          const greige = await prisma.greige_master.findFirst({
            where: { greigeCode: fabric.greigeCode, isActive: true },
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

          // Add style reference if provided
          if (fabric.styleReference) {
            parts.push(fabric.styleReference);
          }

          // Add generic fabric name or greige name (extract everything before first digit or ×)
          let greigeGenericName = 'Fabric';
          if (greige?.greigeName) {
            const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
            greigeGenericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
          }
          parts.push(fabric.genericFabricName || greigeGenericName);

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
        const existingFabric = await prisma.fabric_master.findFirst({
          where: { fabricCode, isActive: true },
        });

        if (existingFabric) {
          // Update existing fabric
          await prisma.fabric_master.update({
            where: { id: existingFabric.id },
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
        total: fabrics.length,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
      },
      errors: results.errors,
    });
  } catch (error: unknown) {
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
        'Composition': fabric.composition || fabric.greige?.composition || '',
        'Yarn Count': fabric.yarnCount || fabric.greige?.yarnCount || '',
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
  } catch (error: unknown) {
    logError('Export error', error);
    res.status(500).json({ error: 'Failed to export fabric masters' });
  }
};

/**
 * Get next auto-generated fabric code based on source type
 * GET /api/fabric-management/fabric/next-code?source={source}&styleCode={styleCode}
 *
 * Source types:
 * - style_linked: FAB-{StyleCode}-{Seq} (e.g., FAB-STY001-001)
 * - ready_purchase: FAB-RDY-{Seq} (e.g., FAB-RDY-0001)
 * - stock: FAB-STK-{Seq} (e.g., FAB-STK-0001)
 */
export const getNextFabricCode = async (req: Request, res: Response) => {
  try {
    const { source, styleCode } = req.query;

    if (!source) {
      return res.status(400).json({ error: 'Source type is required' });
    }

    let prefix: string;
    let pattern: string;

    switch (source) {
      case 'style_linked':
        if (!styleCode) {
          return res.status(400).json({ error: 'Style code is required for style_linked source' });
        }
        prefix = `FAB-${styleCode}-`;
        pattern = `FAB-${styleCode}-%`;
        break;
      case 'ready_purchase':
        prefix = 'FAB-RDY-';
        pattern = 'FAB-RDY-%';
        break;
      case 'stock':
        prefix = 'FAB-STK-';
        pattern = 'FAB-STK-%';
        break;
      default:
        return res.status(400).json({ error: 'Invalid source type. Must be style_linked, ready_purchase, or stock' });
    }

    // Find the highest sequence number for this prefix
    const existingFabrics = await prisma.fabric_master.findMany({
      where: {
        fabricCode: {
          startsWith: prefix,
        },
      },
      select: { fabricCode: true },
      orderBy: { fabricCode: 'desc' },
      take: 1,
    });

    let nextSeq = 1;
    if (existingFabrics.length > 0) {
      const lastCode = existingFabrics[0].fabricCode;
      // Extract the sequence number from the end
      const seqMatch = lastCode.match(/-(\d+)$/);
      if (seqMatch) {
        nextSeq = parseInt(seqMatch[1]) + 1;
      }
    }

    // Format sequence number based on source type
    const seqStr = source === 'style_linked'
      ? String(nextSeq).padStart(3, '0')  // 3 digits for style-linked
      : String(nextSeq).padStart(4, '0'); // 4 digits for ready_purchase and stock

    const nextCode = `${prefix}${seqStr}`;

    res.json({ nextCode });
  } catch (error: unknown) {
    logError('Error generating next fabric code', error);
    res.status(500).json({ error: 'Failed to generate next fabric code' });
  }
};

/**
 * Get unique Generic Fabric Names for style creation dropdown
 * GET /api/fabrics/generic-names
 *
 * Sources fabric names from:
 * 1. fabric_master.genericFabricName (if populated)
 * 2. greige_master.greigeName (extracts fabric type from name like "Cambric 40×40 / 92×88 / 48")
 */
export const getGenericFabricNames = async (req: Request, res: Response) => {
  try {
    const { isActive = 'true' } = req.query;

    // Build where clause for fabric_master
    const fabricWhere: Record<string, unknown> = {
      genericFabricName: { not: null },
    };
    if (isActive !== 'all') {
      fabricWhere.isActive = isActive === 'true';
    }

    // Build where clause for greige_master
    const greigeWhere: Record<string, unknown> = {};
    if (isActive !== 'all') {
      greigeWhere.isActive = isActive === 'true';
    }

    // Get from both fabric_master and greige_master
    const [fabrics, greiges] = await Promise.all([
      prisma.fabric_master.findMany({
        where: fabricWhere,
        select: { genericFabricName: true },
        distinct: ['genericFabricName'],
      }),
      prisma.greige_master.findMany({
        where: greigeWhere,
        select: { greigeName: true },
        distinct: ['greigeName'],
      }),
    ]);

    // Extract fabric names from fabric_master
    const fabricNames = fabrics
      .map(f => f.genericFabricName)
      .filter((name): name is string => name !== null && name.trim().length > 0);

    // Extract generic fabric type from greige names
    // Pattern: "Cambric 40×40 / 92×88 / 48"" → "Cambric"
    // Pattern: "Viscose Shantoon 40×40 / 92×58 / 63"" → "Viscose Shantoon"
    const greigeNames = greiges
      .map(g => {
        if (!g.greigeName) return null;
        // Extract fabric type: everything before the first digit or "×" character
        const match = g.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        return match ? match[1].trim() : g.greigeName.split('/')[0].trim();
      })
      .filter((name): name is string => name !== null && name.trim().length > 0);

    // Combine, deduplicate, and sort
    const allNames = [...new Set([...fabricNames, ...greigeNames])].sort();

    logDebug(`Found ${allNames.length} unique generic fabric names (${fabricNames.length} from fabric_master, ${greigeNames.length} from greige_master)`);

    res.json({
      data: allNames,
      count: allNames.length,
    });
  } catch (error: unknown) {
    logError('Error fetching generic fabric names', error);
    res.status(500).json({ error: 'Failed to fetch generic fabric names' });
  }
};

// ============================================
// FABRIC STYLE ALLOCATION METHODS
// ============================================

/**
 * Get all styles/components/pattern parts using this fabric
 * GET /api/fabric-management/fabric/:id/style-allocations
 */
export const getStyleAllocations = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify fabric exists
    const fabric = await prisma.fabric_master.findUnique({
      where: { id },
      select: { id: true, fabricCode: true, fabricName: true },
    });

    if (!fabric) {
      return res.status(404).json({ error: 'Fabric not found' });
    }

    // Get all style_fabrics where this fabric is allocated
    const allocations = await prisma.style_fabrics.findMany({
      where: { fabricId: id },
      include: {
        style_components: {
          include: {
            styles: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
                isActive: true,
              },
            },
          },
        },
        stylePatternParts: {
          include: {
            patternPart: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform the data to a cleaner structure
    const transformedAllocations = allocations.map((allocation) => ({
      id: allocation.id,
      fabricId: allocation.fabricId,
      componentId: allocation.componentId,
      notes: allocation.notes,
      createdAt: allocation.createdAt,
      component: {
        id: allocation.style_components?.id,
        componentName: allocation.style_components?.componentName || 'Unknown',
        componentCode: allocation.style_components?.componentType || '',
        style: allocation.style_components?.styles ? {
          id: allocation.style_components.styles.id,
          styleCode: allocation.style_components.styles.styleCode,
          styleName: allocation.style_components.styles.styleName,
          isActive: allocation.style_components.styles.isActive,
        } : null,
      },
      patternParts: allocation.stylePatternParts.map((sp: { id: string; patternPartId: string; quantity: number; goesToEmbroidery: boolean; patternPart: { id: string; code: string; name: string } }) => ({
        id: sp.id,
        patternPartId: sp.patternPartId,
        quantity: sp.quantity,
        goesToEmbroidery: sp.goesToEmbroidery,
        patternPart: sp.patternPart,
      })),
    }));

    res.json({
      fabricId: id,
      fabricCode: fabric.fabricCode,
      fabricName: fabric.fabricName,
      allocations: transformedAllocations,
      totalAllocations: transformedAllocations.length,
    });
  } catch (error: unknown) {
    logError('Error fetching style allocations', error);
    res.status(500).json({ error: 'Failed to fetch style allocations' });
  }
};

/**
 * Allocate fabric to a style component
 * POST /api/fabric-management/fabric/:id/allocate-to-style
 *
 * Body: {
 *   componentId: string,
 *   patternPartIds?: string[],  // Optional array of pattern part IDs
 *   hasEmbroidery?: boolean,    // Whether this fabric allocation is for embroidered use
 *   embroideryId?: string,      // Optional embroidery design ID
 *   notes?: string
 * }
 */
export const allocateToStyle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // fabricId
    const { componentId, patternPartIds = [], hasEmbroidery = false, embroideryId, notes } = req.body;

    // Validate required fields
    if (!componentId) {
      return res.status(400).json({ error: 'componentId is required' });
    }

    // Verify fabric exists
    const fabric = await prisma.fabric_master.findUnique({
      where: { id },
      select: { id: true, fabricCode: true, fabricName: true, genericFabricName: true },
    });

    if (!fabric) {
      return res.status(404).json({ error: 'Fabric not found' });
    }

    // Verify component exists and get style info
    const component = await prisma.style_components.findUnique({
      where: { id: componentId },
      include: {
        styles: {
          select: { id: true, styleCode: true, styleName: true },
        },
      },
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Check if this fabric is already allocated to this component
    const existingAllocation = await prisma.style_fabrics.findFirst({
      where: {
        fabricId: id,
        componentId: componentId,
      },
    });

    if (existingAllocation) {
      return res.status(400).json({
        error: 'This fabric is already allocated to this component',
        existingAllocationId: existingAllocation.id,
      });
    }

    // Validate pattern parts if provided
    if (patternPartIds.length > 0) {
      const validPatternParts = await prisma.pattern_part_master.findMany({
        where: { id: { in: patternPartIds } },
        select: { id: true },
      });

      if (validPatternParts.length !== patternPartIds.length) {
        return res.status(400).json({ error: 'One or more pattern parts not found' });
      }
    }

    // Validate embroidery ID if provided
    if (embroideryId) {
      const embroideryExists = await prisma.embroidery_master.findUnique({
        where: { id: embroideryId },
        select: { id: true },
      });
      if (!embroideryExists) {
        return res.status(400).json({ error: 'Embroidery design not found' });
      }
    }

    // Create the style_fabrics entry with optional pattern parts and embroidery
    const styleFabric = await prisma.style_fabrics.create({
      data: {
        componentId,
        fabricId: id,
        fabricName: fabric.fabricName,
        genericFabricName: fabric.genericFabricName,
        hasEmbroidery: hasEmbroidery,
        embroideryId: hasEmbroidery && embroideryId ? embroideryId : null,
        notes: notes || null,
        stylePatternParts: patternPartIds.length > 0 ? {
          create: patternPartIds.map((partId: string) => ({
            patternPartId: partId,
            quantity: 1,
            goesToEmbroidery: hasEmbroidery, // Pattern parts inherit embroidery status
          })),
        } : undefined,
      },
      include: {
        style_components: {
          include: {
            styles: {
              select: { id: true, styleCode: true, styleName: true },
            },
          },
        },
        stylePatternParts: {
          include: {
            patternPart: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    logInfo(`Fabric ${fabric.fabricCode} allocated to style ${component.styles?.styleCode}, component ${component.componentName}`);

    res.status(201).json({
      message: 'Fabric allocated successfully',
      allocation: {
        id: styleFabric.id,
        fabricId: styleFabric.fabricId,
        componentId: styleFabric.componentId,
        hasEmbroidery: styleFabric.hasEmbroidery,
        embroideryId: styleFabric.embroideryId,
        notes: styleFabric.notes,
        createdAt: styleFabric.createdAt,
        component: {
          id: styleFabric.style_components?.id,
          componentName: styleFabric.style_components?.componentName,
          componentCode: styleFabric.style_components?.componentType,
          style: styleFabric.style_components?.styles ? {
            id: styleFabric.style_components.styles.id,
            styleCode: styleFabric.style_components.styles.styleCode,
            styleName: styleFabric.style_components.styles.styleName,
          } : null,
        },
        patternParts: styleFabric.stylePatternParts.map((sp: { id: string; patternPartId: string; quantity: number; goesToEmbroidery?: boolean; patternPart: { id: string; code: string; name: string } }) => ({
          id: sp.id,
          patternPartId: sp.patternPartId,
          quantity: sp.quantity,
          goesToEmbroidery: sp.goesToEmbroidery || false,
          patternPart: sp.patternPart,
        })),
      },
    });
  } catch (error: unknown) {
    logError('Error allocating fabric to style', error);
    res.status(500).json({ error: 'Failed to allocate fabric to style' });
  }
};

/**
 * Remove a style allocation
 * DELETE /api/fabric-management/fabric/:id/style-allocations/:styleFabricId
 */
export const removeStyleAllocation = async (req: Request, res: Response) => {
  try {
    const { id, styleFabricId } = req.params;

    // Verify the style_fabrics record exists and belongs to this fabric
    const styleFabric = await prisma.style_fabrics.findUnique({
      where: { id: styleFabricId },
      include: {
        style_components: {
          include: {
            styles: {
              select: { styleCode: true, styleName: true },
            },
          },
        },
      },
    });

    if (!styleFabric) {
      return res.status(404).json({ error: 'Style allocation not found' });
    }

    if (styleFabric.fabricId !== id) {
      return res.status(400).json({ error: 'This allocation does not belong to the specified fabric' });
    }

    // Delete the style_fabrics record (cascades to style_pattern_parts)
    await prisma.style_fabrics.delete({
      where: { id: styleFabricId },
    });

    logInfo(`Fabric allocation removed: styleFabricId=${styleFabricId}, style=${styleFabric.style_components?.styles?.styleCode}`);

    res.json({
      message: 'Style allocation removed successfully',
      removedAllocation: {
        id: styleFabricId,
        styleCode: styleFabric.style_components?.styles?.styleCode,
        styleName: styleFabric.style_components?.styles?.styleName,
        componentName: styleFabric.style_components?.componentName,
      },
    });
  } catch (error: unknown) {
    logError('Error removing style allocation', error);
    res.status(500).json({ error: 'Failed to remove style allocation' });
  }
};
