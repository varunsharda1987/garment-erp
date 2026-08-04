import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';
import { normalizeId, isUUID } from '../utils/id-helper';
import { FabricFinishType } from '@prisma/client';
import { FabricSupplierInput, FabricWhereClause, FabricUpdateData } from '../types/fabric.types';
import { materialService } from '../services/material.service';
import { getDerivedOnHandMap } from '../services/helpers/derived-stock.helper';
import { ValidationError, NotFoundError } from '../errors';
import { systemSettingsService } from '../services/system-settings.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';
import { generateStyleLinkedFabricCode, peekNextStyleLinkedFabricCode } from '../utils/fabric-code-generator';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';

/**
 * Fabric Master Controller
 * Manages finished, ready-to-use fabrics
 */

// Get all fabric masters with pagination and filters
export const getAllFabricMasters = async (req: Request, res: Response) => {
  // BUG-FM7: Use req.validatedQuery (coerced by Zod) instead of req.query (raw strings)
  // This avoids redundant parseInt calls and NaN from parseInt(undefined)
  const validated = (req as any).validatedQuery ?? req.query;
  const {
    page = 1,
    limit = 50,
    search = '',
    greigeId = '',
    supplierId = '',
    isActive = 'true',
    colorName = '',
    finishType = '',
  } = validated;

  // page and limit are already numbers from Zod transform, no parseInt needed
  const pageNum = typeof page === 'number' ? page : 1;
  const limitNum = typeof limit === 'number' ? limit : 50;
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
    where.finishType = finishType as FabricFinishType;
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
          genericGreigeName: true,
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
};

// Get single fabric master by ID
export const getFabricMasterById = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Fabric master not found');
  }

  res.json(fabricMaster);
};

// Create new fabric master
export const createFabricMaster = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    fabricCode,
    fabricName,
    greigeId,
    greigeName,
    genericGreigeName,
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
    source,
    isGeneric,
    isActive = true,
  } = req.body;

  // Validate required fields (greigeId is optional for stock/generic fabrics)
  if (!fabricCode || !fabricName || !actualWidth) {
    throw new ValidationError('Missing required fields: fabricCode, fabricName, actualWidth');
  }

  // Auto-pattern codes (from the next-code preview) are re-minted server-side
  // inside the transaction below, so a stale preview colliding with an existing
  // code is not an error. FAB-STK-NNNN is checked first — FAB-.+-\d+ would also
  // match it (with "STK" as the style code).
  const isStockAutoCode = /^FAB-STK-\d+$/.test(fabricCode);
  const styleLinkedAutoMatch = isStockAutoCode ? null : String(fabricCode).match(/^FAB-(.+)-\d+$/);

  if (!isStockAutoCode && !styleLinkedAutoMatch) {
    // Hand-typed code: reject duplicates up front.
    // The unique constraint spans ALL rows (active + inactive), so no isActive filter.
    const existingFabric = await prisma.fabric_master.findFirst({
      where: { fabricCode },
    });

    if (existingFabric) {
      throw new ValidationError('Fabric code already exists');
    }
  }

  // Verify greige exists if provided
  let greige = null;
  if (greigeId) {
    greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      throw new ValidationError('Greige master not found');
    }
  }

  // Create fabric_master + its materials record atomically (materials.id === master.id —
  // material-identity invariant; replaces the old create-then-compensating-delete pattern)
  const fabricMaster = await prisma.$transaction(async (tx) => {
    // Re-mint auto-pattern codes inside the transaction: the preview endpoint only
    // peeks the sequence, so stale previews / concurrent submits are resolved here
    // by claiming the real next number race-safely. Hand-typed codes pass through.
    let finalFabricCode: string = fabricCode;
    if (isStockAutoCode) {
      finalFabricCode = await generateStyleLinkedFabricCode(null, tx);
    } else if (styleLinkedAutoMatch) {
      finalFabricCode = await generateStyleLinkedFabricCode(styleLinkedAutoMatch[1], tx);
    }

    const created = await tx.fabric_master.create({
      data: {
        fabricCode: finalFabricCode,
        fabricName,
        greigeId: greigeId || null,
        greigeName: greigeName || greige?.greigeName || null,
        genericGreigeName: genericGreigeName || greige?.genericGreigeName || null,
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
        source: source || null,
        description,
        notes,
        imageUrl,
        isGeneric: isGeneric ?? false,
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

    // BUG-MM3 fix (v2): materials record created in the SAME transaction — a failure rolls
    // back the master too, so an orphan fabric (master without registry row) is impossible.
    await materialService.createFromMaster(
      { id: created.id, code: created.fabricCode, name: created.fabricName },
      'FABRIC',
      tx
    );

    return created;
  });

  res.status(201).json({ data: fabricMaster, message: 'Fabric master created successfully' });
};

// Update fabric master
export const updateFabricMaster = async (req: Request, res: Response) => {
  let { id } = req.params;
  const {
    fabricCode,
    fabricName,
    greigeId,
    greigeName,
    genericGreigeName,
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
    throw new NotFoundError('Fabric master not found');
  }

  // If updating code, check for duplicates
  if (fabricCode && fabricCode !== existingFabric.fabricCode) {
    const duplicateCode = await prisma.fabric_master.findFirst({
      where: { fabricCode, isActive: true },
    });

    if (duplicateCode) {
      throw new ValidationError('Fabric code already exists');
    }
  }

  // If updating greige, verify it exists and get its genericGreigeName
  let greige = null;
  if (greigeId && greigeId !== existingFabric.greigeId) {
    greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
    });

    if (!greige) {
      throw new ValidationError('Greige master not found');
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    fabricCode,
    fabricName,
    greigeId: greigeId !== undefined ? greigeId || null : undefined,
    greigeName: greigeName !== undefined ? greigeName || greige?.greigeName || null : undefined,
    genericGreigeName: genericGreigeName || greige?.genericGreigeName || null,
    yarnCount: yarnCount !== undefined ? yarnCount || null : undefined,
    composition: composition !== undefined ? composition || null : undefined,
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
    supplierId: supplierId !== undefined ? supplierId || null : undefined,
    styleReference: styleReference || null,
    description,
    notes,
    imageUrl,
    ...(isGeneric !== undefined && { isGeneric: isGeneric === true }),
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

  // BUG-MM13 fix: sync code to materials
  const syncUpdates: { code?: string; name?: string } = {};
  if (fabricCode && fabricCode !== existingFabric.fabricCode) {
    syncUpdates.code = fabricCode;
  }
  if (fabricName && fabricName !== existingFabric.fabricName) {
    syncUpdates.name = fabricName;
  }
  if (syncUpdates.code || syncUpdates.name) {
    await syncMasterToMaterials(id, 'FABRIC', syncUpdates);
  }

  res.json(updatedFabric);
};

// Delete fabric master
export const deleteFabricMaster = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Fabric master not found');
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

  // BUG-FM9 fix: BOM tables also reference fabric — order_bom_items directly via fabricId;
  // style_material_bom indirectly via its materials record (that table has no fabricId column)
  const [orderBomItemCount, styleMaterialBomCount] = await Promise.all([
    prisma.order_bom_items.count({ where: { fabricId: id } }),
    prisma.style_material_bom.count({ where: { materials: { fabricId: id } } }),
  ]);

  const blockingDeps = [];
  if (dependencies?._count.fabricStock) blockingDeps.push(`${dependencies._count.fabricStock} stock record(s)`);
  if (dependencies?._count.styleFabrics) blockingDeps.push(`${dependencies._count.styleFabrics} style allocation(s)`);
  if (dependencies?._count.costingFabricItems)
    blockingDeps.push(`${dependencies._count.costingFabricItems} costing item(s)`);
  if (dependencies?._count.fabricProcurements)
    blockingDeps.push(`${dependencies._count.fabricProcurements} procurement(s)`);
  if (dependencies?._count.processing_batch)
    blockingDeps.push(`${dependencies._count.processing_batch} processing batch(es)`);
  if (dependencies?._count.lab_dips) blockingDeps.push(`${dependencies._count.lab_dips} lab dip(s)`);
  if (dependencies?._count.job_work_orders)
    blockingDeps.push(`${dependencies._count.job_work_orders} job work order(s)`);
  if (orderBomItemCount) blockingDeps.push(`${orderBomItemCount} order BOM item(s)`);
  if (styleMaterialBomCount) blockingDeps.push(`${styleMaterialBomCount} style material BOM row(s)`);

  // For materials: check derived on-hand (per-lot truth) before blocking
  let materialsToDelete: string[] = [];
  if (dependencies?._count.materials) {
    const linkedMaterials = await prisma.materials.findMany({
      where: { fabricId: id },
      select: { id: true },
    });

    const linkedMaterialIds = linkedMaterials.map((m) => m.id);
    const onHandMap = await getDerivedOnHandMap(linkedMaterialIds);
    const materialsWithStock = linkedMaterialIds.filter((materialId) => (onHandMap.get(materialId) ?? 0) > 0);
    if (materialsWithStock.length > 0) {
      blockingDeps.push(`${materialsWithStock.length} material(s) with stock on hand`);
    } else {
      // Materials exist but have no stock on hand - safe to cascade delete
      materialsToDelete = linkedMaterialIds;
    }
  }

  if (blockingDeps.length > 0) {
    throw new ValidationError(
      `Cannot delete fabric with existing references. This fabric has: ${blockingDeps.join(', ')}. Consider deactivating the fabric instead.`
    );
  }

  // Use transaction to delete materials and fabric together
  await prisma.$transaction(async (tx) => {
    // Delete unused material records first (auto-created with fabric)
    if (materialsToDelete.length > 0) {
      // Clean up leftover zero-qty shim + settings rows first
      // (stock_levels.materialId FK has no cascade and would block the material delete)
      await tx.stock_levels.deleteMany({
        where: { materialId: { in: materialsToDelete } },
      });
      await tx.stock_settings.deleteMany({
        where: { materialId: { in: materialsToDelete } },
      });
      await tx.materials.deleteMany({
        where: { id: { in: materialsToDelete } },
      });
    }

    // CAD entries will be automatically deleted due to onDelete: Cascade
    await tx.fabric_master.delete({
      where: { id },
    });
  });

  res.json({
    message: 'Fabric master deleted successfully',
    deletedCADs: existingFabric._count.widthCADs,
  });
};

// Get fabric statistics
export const getFabricStatistics = async (req: Request, res: Response) => {
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
    byFinishType: byFinishType.map((item) => ({
      finishType: item.finishType,
      count: Number(item.count),
    })),
    byColor: byColor.map((item) => ({
      colorName: item.colorName,
      count: Number(item.count),
    })),
  });
};

// Get fabrics by greige ID
export const getFabricsByGreigeId = async (req: Request, res: Response) => {
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
};

// Get pricing history for a fabric from fabric_procurement
export const getFabricPricingHistory = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Fabric master not found');
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
  const pricingHistory = procurements.map((p) => ({
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
};

// Bulk import fabric masters from Excel
export const bulkImportFabricMasters = async (req: Request, res: Response) => {
  const { fabrics } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!fabrics || !Array.isArray(fabrics)) {
    throw new ValidationError('Invalid data format. Expected array of fabrics.');
  }

  const results = {
    created: 0,
    updated: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };

  // Get current count for code generation
  const currentCount = await prisma.fabric_master.count();

  // BUG-GR8 fix: Use configurable cutable width deduction from system settings
  const cutableWidthDeduction = await systemSettingsService.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);

  // buyerStyleRef lookups for auto-generated names, cached per import run
  // (one query per unique style code; null = style not found → plain code)
  const buyerRefCache = new Map<string, string | null>();
  const lookupBuyerStyleRef = async (styleCode: string): Promise<string | null> => {
    if (!buyerRefCache.has(styleCode)) {
      const style = await prisma.styles.findFirst({
        where: { styleCode },
        select: { buyerStyleRef: true },
      });
      buyerRefCache.set(styleCode, style?.buyerStyleRef ?? null);
    }
    return buyerRefCache.get(styleCode) ?? null;
  };

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

        // Add style reference if provided (with buyer style ref appended when the style exists)
        if (fabric.styleReference) {
          const buyerRef = await lookupBuyerStyleRef(fabric.styleReference);
          parts.push(formatStyleCodeWithRef(fabric.styleReference, buyerRef));
        }

        // Add generic fabric name or greige name (extract everything before first digit or ×)
        let greigeGenericName = 'Fabric';
        if (greige?.greigeName) {
          const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
          greigeGenericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
        }
        parts.push(fabric.genericGreigeName || greigeGenericName);

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

      // BUG-GR8 fix: Calculate cutable width using configurable deduction from system settings
      const cutableWidth = fabric.cutableWidth || parseFloat(fabric.actualWidth) - cutableWidthDeduction;

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
            genericGreigeName: fabric.genericGreigeName || null,
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
        const created = await prisma.fabric_master.create({
          data: {
            fabricCode,
            fabricName,
            greigeId,
            genericGreigeName: fabric.genericGreigeName || null,
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

        // BUG-FM8 fix: Auto-create materials record (mirrors single-create at createFabricMaster).
        // If it fails, roll back the fabric row and count this row as failed —
        // otherwise the fabric is invisible to stock_levels, MRP, and GRN flows.
        try {
          await materialService.createFromMaster(
            { id: created.id, code: created.fabricCode, name: created.fabricName },
            'FABRIC'
          );
        } catch (err) {
          logError('Failed to auto-create materials record for bulk-imported fabric', err);
          await prisma.fabric_master.delete({ where: { id: created.id } });
          throw new Error(
            `Failed to create materials record for fabric ${fabricCode}: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }

        results.created++;
      }
    } catch (error: unknown) {
      // allow-swallow — per-row bulk-import error, counted in results.failed and surfaced in results.errors
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
};

// Export all fabric masters to Excel format (JSON)
export const exportFabricMasters = async (req: Request, res: Response) => {
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
      'Generic Fabric Name': fabric.genericGreigeName || '',
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
      Composition: fabric.composition || fabric.greige?.composition || '',
      'Yarn Count': fabric.yarnCount || fabric.greige?.yarnCount || '',
      Construction: fabric.greige?.construction || '',
      Description: fabric.description || '',
      Notes: fabric.notes || '',
      Suppliers: fabric.suppliers.map((s) => `${s.supplier.code} - ${s.supplier.name}`).join('; '),
      'Is Generic': fabric.isGeneric ? 'TRUE' : 'FALSE',
      'Is Active': fabric.isActive ? 'TRUE' : 'FALSE',
    };
  });

  res.json({
    data: exportData,
    totalRecords: exportData.length,
  });
};

/**
 * Get next auto-generated fabric code based on source type
 * GET /api/fabric-management/fabric/next-code?source={source}&styleCode={styleCode}
 *
 * Source types:
 * - style_linked: FAB-{StyleCode}-{Seq} (e.g., FAB-STY001-001)
 * - stock: FAB-STK-{Seq} (e.g., FAB-STK-0001)
 */
export const getNextFabricCode = async (req: Request, res: Response) => {
  const { source, styleCode } = req.query;

  if (!source) {
    throw new ValidationError('Source type is required');
  }

  // READ-ONLY preview: peek the seeded sequence without consuming it.
  // A concurrent writer may still claim the number first — createFabricMaster
  // re-mints auto-pattern codes inside its transaction to resolve that race.
  let nextCode: string;

  switch (source) {
    case 'style_linked':
      if (!styleCode) {
        throw new ValidationError('Style code is required for style_linked source');
      }
      nextCode = await peekNextStyleLinkedFabricCode(styleCode as string);
      break;
    case 'stock':
      nextCode = await peekNextStyleLinkedFabricCode(null);
      break;
    default:
      throw new ValidationError('Invalid source type. Must be style_linked or stock');
  }

  res.json({ nextCode });
};

/**
 * Get unique Generic Fabric Names for style creation dropdown
 * GET /api/fabrics/generic-names
 *
 * Sources fabric names from:
 * 1. fabric_master.genericGreigeName (if populated)
 * 2. greige_master.greigeName (extracts fabric type from name like "Cambric 40×40 / 92×88 / 48")
 */
export const getGenericFabricNames = async (req: Request, res: Response) => {
  const { isActive = 'true' } = req.query;

  // Build where clause for fabric_master
  const fabricWhere: Record<string, unknown> = {
    genericGreigeName: { not: null },
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
      select: { genericGreigeName: true },
      distinct: ['genericGreigeName'],
    }),
    prisma.greige_master.findMany({
      where: greigeWhere,
      select: { greigeName: true },
      distinct: ['greigeName'],
    }),
  ]);

  // Extract fabric names from fabric_master
  const fabricNames = fabrics
    .map((f) => f.genericGreigeName)
    .filter((name): name is string => name !== null && name.trim().length > 0);

  // Extract generic fabric type from greige names
  // Pattern: "Cambric 40×40 / 92×88 / 48"" → "Cambric"
  // Pattern: "Viscose Shantoon 40×40 / 92×58 / 63"" → "Viscose Shantoon"
  const greigeNames = greiges
    .map((g) => {
      if (!g.greigeName) return null;
      // Extract fabric type: everything before the first digit or "×" character
      const match = g.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
      return match ? match[1].trim() : g.greigeName.split('/')[0].trim();
    })
    .filter((name): name is string => name !== null && name.trim().length > 0);

  // Combine, deduplicate, and sort
  const allNames = [...new Set([...fabricNames, ...greigeNames])].sort();

  logDebug(
    `Found ${allNames.length} unique generic fabric names (${fabricNames.length} from fabric_master, ${greigeNames.length} from greige_master)`
  );

  res.json({
    data: allNames,
    count: allNames.length,
  });
};

// ============================================
// FABRIC STYLE ALLOCATION METHODS
// ============================================

/**
 * Get all styles/components/pattern parts using this fabric
 * GET /api/fabric-management/fabric/:id/style-allocations
 */
export const getStyleAllocations = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Verify fabric exists
  const fabric = await prisma.fabric_master.findUnique({
    where: { id },
    select: { id: true, fabricCode: true, fabricName: true },
  });

  if (!fabric) {
    throw new NotFoundError('Fabric not found');
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
      style: allocation.style_components?.styles
        ? {
            id: allocation.style_components.styles.id,
            styleCode: allocation.style_components.styles.styleCode,
            styleName: allocation.style_components.styles.styleName,
            isActive: allocation.style_components.styles.isActive,
          }
        : null,
    },
    patternParts: allocation.stylePatternParts.map(
      (sp: {
        id: string;
        patternPartId: string;
        quantity: number;
        goesToEmbroidery: boolean;
        patternPart: { id: string; code: string; name: string };
      }) => ({
        id: sp.id,
        patternPartId: sp.patternPartId,
        quantity: sp.quantity,
        goesToEmbroidery: sp.goesToEmbroidery,
        patternPart: sp.patternPart,
      })
    ),
  }));

  res.json({
    fabricId: id,
    fabricCode: fabric.fabricCode,
    fabricName: fabric.fabricName,
    allocations: transformedAllocations,
    totalAllocations: transformedAllocations.length,
  });
};

/**
 * Allocate fabric to one or more style components
 * POST /api/fabric-management/fabric/:id/allocate-to-style
 *
 * Body: {
 *   componentId?: string,         // Single component (legacy)
 *   componentIds?: string[],      // Multiple components (new)
 *   patternPartIds?: string[],    // Optional array of pattern part IDs (applied to all)
 *   hasEmbroidery?: boolean,      // Whether this fabric allocation is for embroidered use
 *   embroideryId?: string,        // Optional embroidery design ID
 *   notes?: string
 * }
 */
export const allocateToStyle = async (req: Request, res: Response) => {
  const { id } = req.params; // fabricId
  const { componentId, componentIds, patternPartIds = [], hasEmbroidery = false, embroideryId, notes } = req.body;

  // Support both single componentId (legacy) and componentIds array (new)
  const targetComponentIds: string[] = componentIds?.length > 0 ? componentIds : componentId ? [componentId] : [];

  // Validate required fields
  if (targetComponentIds.length === 0) {
    throw new ValidationError('componentId or componentIds is required');
  }

  // Verify fabric exists
  const fabric = await prisma.fabric_master.findUnique({
    where: { id },
    select: { id: true, fabricCode: true, fabricName: true, genericGreigeName: true },
  });

  if (!fabric) {
    throw new NotFoundError('Fabric not found');
  }

  // Verify ALL components exist and get style info
  const components = await prisma.style_components.findMany({
    where: { id: { in: targetComponentIds } },
    include: {
      styles: {
        select: { id: true, styleCode: true, styleName: true },
      },
    },
  });

  if (components.length !== targetComponentIds.length) {
    const foundIds = components.map((c) => c.id);
    const missingIds = targetComponentIds.filter((id) => !foundIds.includes(id));
    throw new NotFoundError(`Components not found: ${missingIds.join(', ')}`);
  }

  // Check if this fabric is already allocated to any of these components
  const existingAllocations = await prisma.style_fabrics.findMany({
    where: {
      fabricId: id,
      componentId: { in: targetComponentIds },
    },
    select: { componentId: true },
  });

  if (existingAllocations.length > 0) {
    const alreadyAllocatedIds = existingAllocations.map((a) => a.componentId);
    const alreadyAllocatedNames = components
      .filter((c) => alreadyAllocatedIds.includes(c.id))
      .map((c) => c.componentName);
    throw new ValidationError(`This fabric is already allocated to: ${alreadyAllocatedNames.join(', ')}`);
  }

  // Validate pattern parts if provided
  if (patternPartIds.length > 0) {
    const validPatternParts = await prisma.pattern_part_master.findMany({
      where: { id: { in: patternPartIds } },
      select: { id: true },
    });

    if (validPatternParts.length !== patternPartIds.length) {
      throw new ValidationError('One or more pattern parts not found');
    }
  }

  // Validate embroidery ID if provided
  if (embroideryId) {
    const embroideryExists = await prisma.embroidery_master.findUnique({
      where: { id: embroideryId },
      select: { id: true },
    });
    if (!embroideryExists) {
      throw new ValidationError('Embroidery design not found');
    }
  }

  // Process each component - create/update style_fabrics record
  const allocations: any[] = [];

  for (const component of components) {
    const componentId = component.id;

    // Try to find an existing placeholder row (fabricId=null) in this component
    let placeholder = null;

    // Match by greigeName or fabricName
    if (fabric.genericGreigeName || fabric.fabricName) {
      const orConditions: any[] = [];
      if (fabric.genericGreigeName) {
        orConditions.push({ greigeName: fabric.genericGreigeName });
      }
      if (fabric.fabricName) {
        orConditions.push({ fabricName: { contains: fabric.fabricName, mode: 'insensitive' as const } });
      }
      placeholder = await prisma.style_fabrics.findFirst({
        where: {
          componentId,
          fabricId: null,
          OR: orConditions,
        },
        include: { stylePatternParts: true },
      });
    }

    // Fallback: if no name match but only ONE unlinked placeholder exists, use it
    if (!placeholder) {
      const unlinkedPlaceholders = await prisma.style_fabrics.findMany({
        where: { componentId, fabricId: null },
        include: { stylePatternParts: true },
      });
      if (unlinkedPlaceholders.length === 1) {
        placeholder = unlinkedPlaceholders[0];
      }
    }

    let styleFabric;

    if (placeholder) {
      // UPDATE the existing placeholder — preserves CAD links, pattern parts, etc.
      const updateData: any = {
        fabricId: id,
        fabricName: fabric.fabricName,
        genericGreigeName: fabric.genericGreigeName,
        hasEmbroidery,
        embroideryId: hasEmbroidery && embroideryId ? embroideryId : null,
        notes: notes || placeholder.notes,
      };

      // Replace existing pattern parts with user's new selection
      if (patternPartIds.length > 0) {
        updateData.stylePatternParts = {
          deleteMany: {},
          create: patternPartIds.map((partId: string) => ({
            patternPartId: partId,
            quantity: 1,
            goesToEmbroidery: hasEmbroidery,
          })),
        };
      }

      styleFabric = await prisma.style_fabrics.update({
        where: { id: placeholder.id },
        data: updateData,
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
    } else {
      // No placeholder found — create new row (fallback for styles without placeholders)
      styleFabric = await prisma.style_fabrics.create({
        data: {
          componentId,
          fabricId: id,
          fabricName: fabric.fabricName,
          genericGreigeName: fabric.genericGreigeName,
          hasEmbroidery: hasEmbroidery,
          embroideryId: hasEmbroidery && embroideryId ? embroideryId : null,
          notes: notes || null,
          stylePatternParts:
            patternPartIds.length > 0
              ? {
                  create: patternPartIds.map((partId: string) => ({
                    patternPartId: partId,
                    quantity: 1,
                    goesToEmbroidery: hasEmbroidery,
                  })),
                }
              : undefined,
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
    }

    allocations.push({
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
        style: styleFabric.style_components?.styles,
      },
      patternParts: styleFabric.stylePatternParts?.map((pp: any) => pp.patternPart) || [],
    });

    logInfo(
      `Fabric ${fabric.fabricCode} allocated to style ${component.styles?.styleCode}, component ${component.componentName}`
    );
  }

  // Return single allocation for backward compatibility, or array for multiple
  const isSingleAllocation = allocations.length === 1;

  res.status(201).json({
    message: isSingleAllocation
      ? 'Fabric allocated successfully'
      : `Fabric allocated to ${allocations.length} components successfully`,
    allocation: isSingleAllocation ? allocations[0] : undefined,
    allocations: isSingleAllocation ? undefined : allocations,
  });
};

/**
 * Remove a style allocation
 * DELETE /api/fabric-management/fabric/:id/style-allocations/:styleFabricId
 */
export const removeStyleAllocation = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Style allocation not found');
  }

  if (styleFabric.fabricId !== id) {
    throw new ValidationError('This allocation does not belong to the specified fabric');
  }

  // Delete the style_fabrics record (cascades to style_pattern_parts)
  await prisma.style_fabrics.delete({
    where: { id: styleFabricId },
  });

  logInfo(
    `Fabric allocation removed: styleFabricId=${styleFabricId}, style=${styleFabric.style_components?.styles?.styleCode}`
  );

  res.json({
    message: 'Style allocation removed successfully',
    removedAllocation: {
      id: styleFabricId,
      styleCode: styleFabric.style_components?.styles?.styleCode,
      styleName: styleFabric.style_components?.styles?.styleName,
      componentName: styleFabric.style_components?.componentName,
    },
  });
};

/**
 * Update pattern parts for an existing style allocation
 * PUT /api/fabric-management/fabric/:id/allocations/:allocationId/pattern-parts
 * Body: { patternPartIds: string[] }
 */
export const updateAllocationPatternParts = async (req: Request, res: Response) => {
  const { id, allocationId } = req.params;
  const { patternPartIds = [] } = req.body;

  // Verify the style_fabrics record exists and belongs to this fabric
  const styleFabric = await prisma.style_fabrics.findUnique({
    where: { id: allocationId },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style allocation not found');
  }

  if (styleFabric.fabricId !== id) {
    throw new ValidationError('This allocation does not belong to the specified fabric');
  }

  // Delete existing pattern parts and recreate with new selection
  await prisma.$transaction([
    prisma.style_pattern_parts.deleteMany({
      where: { styleFabricId: allocationId },
    }),
    ...(patternPartIds.length > 0
      ? patternPartIds.map((partId: string) =>
          prisma.style_pattern_parts.create({
            data: {
              styleFabricId: allocationId,
              patternPartId: partId,
              quantity: 1,
              goesToEmbroidery: false,
            },
          })
        )
      : []),
  ]);

  const updated = await prisma.style_fabrics.findUnique({
    where: { id: allocationId },
    include: {
      stylePatternParts: {
        include: {
          patternPart: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });

  logInfo(`Pattern parts updated: allocationId=${allocationId}, count=${patternPartIds.length}`);

  res.json({
    message: 'Pattern parts updated successfully',
    patternParts:
      updated?.stylePatternParts.map((sp) => ({
        id: sp.id,
        patternPartId: sp.patternPartId,
        quantity: sp.quantity,
        goesToEmbroidery: sp.goesToEmbroidery,
        patternPart: sp.patternPart,
      })) || [],
  });
};
