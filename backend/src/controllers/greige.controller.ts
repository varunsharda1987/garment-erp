import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logDebug } from '../utils/logger';
import {
  RawGreigeData,
  SerializedGreige,
  GreigeSupplierInput,
  GreigeWhereClause,
  GreigeUpdateData,
} from '../types/greige.types';
import { ValidationError, NotFoundError } from '../errors';
import { GreigeQueryInput } from '../schemas/fabricGreige.schema';
import { generateCode } from '../utils/code-generator';
import { materialService } from '../services/material.service';
import { ensureMaterialRecord, syncMasterToMaterials } from '../services/helpers/material-sync.helper';
import { applySearch } from '../utils/search-filter';

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
  // validateQuery(greigeQuerySchema) has already coerced every param onto req.validatedQuery.
  // req.query stays RAW under Express 5, so read the validated copy — that is what turns the
  // facets into string[] and the range bounds into numbers.
  const q = ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? req.query) as GreigeQueryInput;
  const {
    page = 1,
    limit = 50,
    search = '',
    supplierId = '',
    isActive = 'true',
    composition = '',
    greigeQuality,
    weaveType,
    genericGreigeName,
    minWidth,
    maxWidth,
    minShrinkage,
    maxShrinkage,
  } = q;

  // page/limit are already numbers from the Zod transform — no parseInt, no NaN.
  const pageNum = typeof page === 'number' ? page : 1;
  const limitNum = typeof limit === 'number' ? limit : 50;
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: GreigeWhereClause = {};

  // Active filter
  if (isActive !== 'all') {
    where.isActive = isActive === 'true';
  }

  // Search filter (code, name, composition). applySearch appends under where.AND, so every facet
  // set below still narrows the result and can never be OR-ed away.
  if (search) {
    applySearch(where, search, ['greigeCode', 'greigeName', 'composition']);
  }

  // Supplier filter (via junction table)
  if (supplierId) {
    where.suppliers = {
      some: {
        supplierId,
        isActive: true,
      },
    };
  }

  // Composition filter (free text, substring)
  if (composition) {
    where.composition = { contains: composition, mode: 'insensitive' };
  }

  // ---- Multi-select facets --------------------------------------------------------------
  // The schema already normalised scalar -> array, trimmed, dropped blanks and collapsed an
  // empty selection to undefined. So "present" always means "at least one real value", and
  // `{ in: [] }` (which matches nothing) can never be built here.
  if (greigeQuality?.length) {
    where.greigeQuality = { in: greigeQuality };
  }
  if (weaveType?.length) {
    where.weaveType = { in: weaveType };
  }
  if (genericGreigeName?.length) {
    where.genericGreigeName = { in: genericGreigeName };
  }

  // ---- Numeric ranges -------------------------------------------------------------------
  // greigeWidth is Decimal(10,2) and averageShrinkagePercent Decimal(5,2); Prisma's DecimalFilter
  // accepts plain JS numbers for gte/lte, so no Prisma.Decimal wrapping.
  // NOTE: averageShrinkagePercent is NULLABLE — a shrinkage bound excludes rows with no recorded
  // shrinkage. Correct facet behaviour, but it surprises people.
  if (minWidth !== undefined || maxWidth !== undefined) {
    where.greigeWidth = {
      ...(minWidth !== undefined ? { gte: minWidth } : {}),
      ...(maxWidth !== undefined ? { lte: maxWidth } : {}),
    };
  }
  if (minShrinkage !== undefined || maxShrinkage !== undefined) {
    where.averageShrinkagePercent = {
      ...(minShrinkage !== undefined ? { gte: minShrinkage } : {}),
      ...(maxShrinkage !== undefined ? { lte: maxShrinkage } : {}),
    };
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
};

// Get single greige master by ID
export const getGreigeMasterById = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Greige master', id);
  }

  // Serialize Decimal fields to numbers
  const serialized = serializeGreige(greigeMaster);

  res.json(serialized);
};

// Create new greige master
export const createGreigeMaster = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    greigeCode,
    greigeName,
    genericGreigeName,
    yarnCount,
    construction,
    composition,
    weaveType,
    greigeQuality,
    weaver,
    greigeWidth,
    defaultCutableWidth,
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

  // Auto-generate greigeCode if not provided
  let finalGreigeCode = greigeCode;
  if (!greigeCode) {
    finalGreigeCode = await generateCode('GRG', 'greige_master', 'greigeCode');
  }

  // Validate remaining required fields
  if (!greigeName || !composition || !greigeWidth) {
    throw new ValidationError('Missing required fields: greigeName, composition, greigeWidth');
  }

  // Check if greige code already exists
  const existingGreige = await prisma.greige_master.findFirst({
    where: { greigeCode: finalGreigeCode, isActive: true },
  });

  if (existingGreige) {
    throw new ValidationError('Greige code already exists');
  }

  // Check for duplicate name + quality combination
  const duplicateNameQuality = await prisma.greige_master.findFirst({
    where: { greigeName, greigeQuality: greigeQuality || null, isActive: true },
  });
  if (duplicateNameQuality) {
    throw new ValidationError(
      `A greige with name "${greigeName}" and quality "${greigeQuality || 'None'}" already exists (${duplicateNameQuality.greigeCode}). Use a different quality or edit the existing entry.`
    );
  }

  const greigeMaster = await prisma.greige_master.create({
    data: {
      greigeCode: finalGreigeCode,
      greigeName,
      genericGreigeName: genericGreigeName || null,
      yarnCount,
      construction,
      composition,
      weaveType,
      greigeQuality: greigeQuality || null,
      weaver: weaver || null,
      greigeWidth: parseFloat(greigeWidth),
      defaultCutableWidth: defaultCutableWidth ? parseFloat(defaultCutableWidth) : null,
      expectedFinishedWidthMin: expectedFinishedWidthMin ? parseFloat(expectedFinishedWidthMin) : null,
      expectedFinishedWidthMax: expectedFinishedWidthMax ? parseFloat(expectedFinishedWidthMax) : null,
      averageShrinkagePercent: averageShrinkagePercent ? parseFloat(averageShrinkagePercent) : null,
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

  // Material Identity: materials.id === greige_master.id
  await ensureMaterialRecord(greigeMaster.id, 'GREIGE');

  res.status(201).json({ data: greigeMaster, message: 'Greige master created successfully' });
};

// Update greige master
export const updateGreigeMaster = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    greigeCode,
    greigeName,
    genericGreigeName,
    yarnCount,
    construction,
    composition,
    weaveType,
    greigeQuality,
    weaver,
    greigeWidth,
    defaultCutableWidth,
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
    throw new NotFoundError('Greige master', id);
  }

  // If updating code, check for duplicates
  if (greigeCode && greigeCode !== existingGreige.greigeCode) {
    const duplicateCode = await prisma.greige_master.findFirst({
      where: { greigeCode, isActive: true },
    });

    if (duplicateCode) {
      throw new ValidationError('Greige code already exists');
    }
  }

  // Check for duplicate name + quality combination (exclude current record)
  const updatedName = greigeName || existingGreige.greigeName;
  const updatedQuality = greigeQuality !== undefined ? greigeQuality || null : existingGreige.greigeQuality;
  const duplicateNameQuality = await prisma.greige_master.findFirst({
    where: { greigeName: updatedName, greigeQuality: updatedQuality, isActive: true, NOT: { id } },
  });
  if (duplicateNameQuality) {
    throw new ValidationError(
      `A greige with name "${updatedName}" and quality "${updatedQuality || 'None'}" already exists (${duplicateNameQuality.greigeCode}).`
    );
  }

  // Build update data
  const updateData: GreigeUpdateData = {
    greigeCode,
    greigeName,
    genericGreigeName: genericGreigeName !== undefined ? genericGreigeName || null : undefined,
    yarnCount,
    construction,
    composition,
    weaveType,
    greigeQuality: greigeQuality !== undefined ? greigeQuality || null : undefined,
    weaver: weaver !== undefined ? weaver || null : undefined,
    greigeWidth: greigeWidth ? parseFloat(greigeWidth) : undefined,
    defaultCutableWidth:
      defaultCutableWidth !== undefined ? (defaultCutableWidth ? parseFloat(defaultCutableWidth) : null) : undefined,
    expectedFinishedWidthMin: expectedFinishedWidthMin ? parseFloat(expectedFinishedWidthMin) : null,
    expectedFinishedWidthMax: expectedFinishedWidthMax ? parseFloat(expectedFinishedWidthMax) : null,
    averageShrinkagePercent:
      averageShrinkagePercent !== undefined
        ? averageShrinkagePercent
          ? parseFloat(averageShrinkagePercent)
          : null
        : undefined,
    gsmRange,
    costPerMeter: costPerMeter !== undefined ? (costPerMeter ? parseFloat(costPerMeter) : null) : undefined,
    moq: moq !== undefined ? (moq ? parseInt(moq) : null) : undefined,
    leadTimeDays: leadTimeDays !== undefined ? (leadTimeDays ? parseInt(leadTimeDays) : null) : undefined,
    supplierId: supplierId !== undefined ? supplierId || null : undefined,
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

  // BUG-MM13 fix: sync code to materials
  const syncUpdates: { code?: string; name?: string } = {};
  if (greigeCode && greigeCode !== existingGreige.greigeCode) {
    syncUpdates.code = greigeCode;
  }
  if (greigeName && greigeName !== existingGreige.greigeName) {
    syncUpdates.name = greigeName;
  }
  if (syncUpdates.code || syncUpdates.name) {
    await syncMasterToMaterials(id, 'GREIGE', syncUpdates);
  }

  res.json(updatedGreige);
};

// Delete greige master
export const deleteGreigeMaster = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Greige master', id);
  }

  // Check if greige has finished fabrics
  if (existingGreige._count.finishedFabrics > 0) {
    throw new ValidationError(
      `Cannot delete greige master with ${existingGreige._count.finishedFabrics} linked finished fabrics. Please delete or reassign the fabrics first.`
    );
  }

  // BUG-GR12 fix: also guard BOTH BOM tables before delete (same pattern as BUG-OM1).
  // - order_bom_items has a direct greigeId FK (GREIGE_PROCESSED sourcing rows)
  // - style_material_bom has NO greige FK; greige lines reference the centralized
  //   materials record instead (materialId -> materials.id, materials.greigeId -> greige_master.id)
  const materialRecord = await prisma.materials.findFirst({
    where: { greigeId: id },
    select: { id: true },
  });

  const [orderBomUsage, styleBomUsage] = await Promise.all([
    prisma.order_bom_items.count({
      where: materialRecord ? { OR: [{ greigeId: id }, { materialId: materialRecord.id }] } : { greigeId: id },
    }),
    materialRecord ? prisma.style_material_bom.count({ where: { materialId: materialRecord.id } }) : Promise.resolve(0),
  ]);

  if (styleBomUsage > 0 || orderBomUsage > 0) {
    throw new ValidationError(
      `Cannot delete greige master: used in ${styleBomUsage} style BOM(s) and ${orderBomUsage} order BOM(s). Remove those references first.`
    );
  }

  await prisma.greige_master.delete({
    where: { id },
  });

  res.json({ message: 'Greige master deleted successfully' });
};

// Get greige statistics
export const getGreigeStatistics = async (req: Request, res: Response) => {
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
    byComposition: byComposition.map((item) => ({
      composition: item.composition,
      count: Number(item.count),
    })),
    byWeaveType: byWeaveType.map((item) => ({
      weaveType: item.weaveType,
      count: Number(item.count),
    })),
  });
};

// Get pricing history for a greige from fabric_procurement
export const getGreigePricingHistory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = 5 } = req.query;

  // Check if greige exists
  const greige = await prisma.greige_master.findUnique({
    where: { id },
  });

  if (!greige) {
    throw new NotFoundError('Greige master', id);
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
    greigeId: id,
    greigeName: greige.greigeName,
    greigeCode: greige.greigeCode,
    pricingHistory,
  });
};

// Bulk import greige masters from Excel
export const bulkImportGreigeMasters = async (req: Request, res: Response) => {
  const { greiges } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  if (!greiges || !Array.isArray(greiges)) {
    throw new ValidationError('Invalid data format. Expected array of greiges.');
  }

  const results = {
    created: 0,
    failed: 0,
    errors: [] as Array<{ row: number; error: string }>,
  };

  for (let i = 0; i < greiges.length; i++) {
    try {
      const greige = greiges[i];

      // BUG-GR6 fix: aligned validation with single create
      // Validate required fields (same as createGreigeMaster)
      if (!greige.greigeName || !greige.composition || !greige.greigeWidth) {
        results.failed++;
        results.errors.push({
          row: i + 2, // Excel row (header is row 1)
          error: 'Missing required fields: greigeName, composition, or greigeWidth',
        });
        continue;
      }

      // BUG-GR6 fix: Check for duplicate name + quality combination (same as createGreigeMaster)
      const duplicateNameQuality = await prisma.greige_master.findFirst({
        where: {
          greigeName: greige.greigeName,
          greigeQuality: greige.greigeQuality || null,
          isActive: true,
        },
      });
      if (duplicateNameQuality) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: `A greige with name "${greige.greigeName}" and quality "${greige.greigeQuality || 'None'}" already exists (${duplicateNameQuality.greigeCode}). Use a different quality or edit the existing entry.`,
        });
        continue;
      }

      // Auto-generate greige code from the shared atomic 'GRG' sequence (same series as single
      // create / getNextGreigeCode) — the old count()-based numbering raced and duplicated codes
      const greigeCode = await generateCode('GRG', 'greige_master', 'greigeCode');

      // Create greige master + materials record in transaction (BUG-GR1 fix)
      // BUG-GR6 fix: aligned validation - includes greigeQuality and weaver like single create
      await prisma.$transaction(async (tx) => {
        const created = await tx.greige_master.create({
          data: {
            greigeCode,
            greigeName: greige.greigeName,
            genericGreigeName: greige.genericGreigeName || null,
            yarnCount: greige.yarnCount || null,
            construction: greige.construction || null,
            composition: greige.composition,
            weaveType: greige.weaveType || null,
            // BUG-GR6 fix: greigeQuality and weaver now supported in bulk import
            greigeQuality: greige.greigeQuality || null,
            // weaver: retired 2026-09-25 — it lives on the PO line / GRN / lot, never the master
            greigeWidth: parseFloat(greige.greigeWidth),
            defaultCutableWidth: greige.defaultCutableWidth ? parseFloat(greige.defaultCutableWidth) : null,
            expectedFinishedWidthMin: greige.expectedFinishedWidthMin
              ? parseFloat(greige.expectedFinishedWidthMin)
              : null,
            expectedFinishedWidthMax: greige.expectedFinishedWidthMax
              ? parseFloat(greige.expectedFinishedWidthMax)
              : null,
            averageShrinkagePercent: greige.averageShrinkagePercent ? parseFloat(greige.averageShrinkagePercent) : null,
            gsmRange: greige.gsmRange || null,
            // The bulk-import Zod schema accepts costPerMeter, but this block omitted it —
            // the value was validated and then silently discarded on every import.
            costPerMeter: greige.costPerMeter ? parseFloat(greige.costPerMeter) : null,
            description: greige.description || null,
            notes: greige.notes || null,
            isActive: greige.isActive !== false,
            createdById: userId,
          },
        });

        // Create corresponding materials record (same as greige.service.ts:220)
        await materialService.createFromMaster(
          { id: created.id, code: greigeCode, name: greige.greigeName },
          'GREIGE',
          tx
        );
      });

      results.created++;
    } catch (error: unknown) {
      // allow-swallow — per-row bulk-import reporter: single-table create, the failure is surfaced in errors[]
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
};

// Export all greige masters to Excel format (JSON)
export const exportGreigeMasters = async (req: Request, res: Response) => {
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
    // Use stored genericGreigeName, fallback to extraction for legacy data
    let genericName = greige.genericGreigeName;
    if (!genericName) {
      const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
      genericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
    }

    return {
      'Greige Code': greige.greigeCode,
      'Generic Greige Name': genericName,
      'Greige Name': greige.greigeName,
      'Yarn Count': greige.yarnCount || '',
      Construction: greige.construction || '',
      'Greige Width (inches)': Number(greige.greigeWidth),
      'Default Cutable Width (inches)': greige.defaultCutableWidth ? Number(greige.defaultCutableWidth) : '',
      Composition: greige.composition,
      'Weave Type': greige.weaveType || '',
      'GSM Range': greige.gsmRange || '',
      'Expected Finished Width Min': greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : '',
      'Expected Finished Width Max': greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : '',
      'Average Shrinkage %': greige.averageShrinkagePercent ?? '',
      Description: greige.description || '',
      Notes: greige.notes || '',
      Suppliers: greige.suppliers.map((s) => `${s.supplier.code} - ${s.supplier.name}`).join('; '),
      'Is Active': greige.isActive ? 'TRUE' : 'FALSE',
    };
  });

  res.json({
    data: exportData,
    totalRecords: exportData.length,
  });
};

/**
 * Get unique Generic Greige Names for dropdowns
 * GET /api/fabric-management/greige/generic-names
 */
export const getGenericGreigeNames = async (req: Request, res: Response) => {
  const { isActive = 'true' } = req.query;

  // Build where clause
  const where: Record<string, unknown> = {
    genericGreigeName: { not: null },
  };
  if (isActive !== 'all') {
    where.isActive = isActive === 'true';
  }

  // Get unique genericGreigeName values from greige_master
  const greiges = await prisma.greige_master.findMany({
    where,
    select: { genericGreigeName: true },
    distinct: ['genericGreigeName'],
    orderBy: { genericGreigeName: 'asc' },
  });

  // Extract unique names and filter out nulls
  const names = greiges
    .map((g) => g.genericGreigeName)
    .filter((name): name is string => name !== null && name.trim() !== '');

  res.json({ names });
};

/**
 * Distinct values + numeric bounds for the Greige list's facet filters.
 * GET /api/fabric-management/greige/filter-options
 *
 * ONE call for the whole filter bar. Returns `{ value, count }` per option so the UI can show
 * "Printing (42)". /greige/generic-names above is left alone — GenericGreigeSelector and the
 * style form read it — but it covers one facet only and returns a different envelope.
 *
 * Counts are scoped by isActive ONLY, not by the other facets currently ticked: these are static
 * option counts, not drill-down counts. Making them dynamic means threading the live `where` in
 * here, which is a separate change.
 */
export const getGreigeFilterOptions = async (req: Request, res: Response) => {
  const { isActive = 'true' } = req.query;

  const base: Prisma.greige_masterWhereInput = {};
  if (isActive !== 'all') {
    base.isActive = isActive === 'true';
  }

  // Non-generic on purpose: Prisma's groupBy types fight a dynamically-chosen `by` field.
  const clean = (rows: Array<{ value: string | null; count: number }>) =>
    rows
      .filter((r): r is { value: string; count: number } => typeof r.value === 'string' && r.value.trim() !== '')
      .sort((a, b) => a.value.localeCompare(b.value));

  const [weave, generic, quality, bounds] = await Promise.all([
    prisma.greige_master.groupBy({
      by: ['weaveType'],
      where: { ...base, weaveType: { not: null } },
      _count: { _all: true },
    }),
    prisma.greige_master.groupBy({
      by: ['genericGreigeName'],
      where: { ...base, genericGreigeName: { not: null } },
      _count: { _all: true },
    }),
    prisma.greige_master.groupBy({
      by: ['greigeQuality'],
      where: { ...base, greigeQuality: { not: null } },
      _count: { _all: true },
    }),
    prisma.greige_master.aggregate({
      where: base,
      _min: { greigeWidth: true, averageShrinkagePercent: true },
      _max: { greigeWidth: true, averageShrinkagePercent: true },
    }),
  ]);

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  res.json({
    data: {
      weaveType: clean(weave.map((r) => ({ value: r.weaveType, count: r._count._all }))),
      genericGreigeName: clean(generic.map((r) => ({ value: r.genericGreigeName, count: r._count._all }))),
      greigeQuality: clean(quality.map((r) => ({ value: r.greigeQuality, count: r._count._all }))),
      width: { min: num(bounds._min.greigeWidth), max: num(bounds._max.greigeWidth) },
      shrinkage: {
        min: num(bounds._min.averageShrinkagePercent),
        max: num(bounds._max.averageShrinkagePercent),
      },
    },
  });
};

// Get next auto-generated greige code
export const getNextGreigeCode = async (req: Request, res: Response) => {
  const nextCode = await generateCode('GRG', 'greige_master', 'greigeCode');
  return res.json({ code: nextCode });
};
