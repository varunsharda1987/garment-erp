import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode, allocateBatchCodes } from '../utils/code-generator';
import { NotFoundError, ValidationError } from '../errors';
import { trimStockService } from '../services/trim-stock.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';
import { materialService } from '../services/material.service';

// Type for supplier input
interface MachinePartSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
  pricePerUnit?: number | string;
}

/**
 * Create a single machine part item
 * Auto-generates partCode and creates corresponding material entry
 * Supports multiple suppliers via suppliers array
 */
export const createMachinePart = async (req: Request, res: Response) => {
  const {
    partName,
    partNumber,
    category,
    machine,
    brand,
    model,
    specifications,
    pricePerUnit,
    supplierId,
    description,
    suppliers = [],
  } = req.body;

  // Auto-generate part code
  const partCode = await generateCode('PART', 'machine_part_master', 'partCode');

  // Auto-generate partName if not provided
  let finalPartName = partName;
  if (!finalPartName || finalPartName.trim() === '') {
    const parts = [];
    if (partNumber) parts.push(`[${partNumber}]`);
    if (machine) parts.push(machine);
    if (brand) parts.push(brand);
    parts.push('Part');
    finalPartName = parts.join(' ').trim() || `Machine Part ${partCode}`;
  }

  // Create master + its materials record atomically (materials.id === master.id — material-identity invariant)
  const { partRecord, materialEntry } = await prisma.$transaction(async (tx) => {
    const created = await tx.machine_part_master.create({
      data: {
        partCode,
        partName: finalPartName,
        partNumber: partNumber || null,
        category: category || null,
        machine: machine || null,
        brand: brand || null,
        model: model || null,
        specifications: specifications || null,
        pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null,
        supplierId: supplierId || null,
        description: description || null,
        isActive: true,
        // Create supplier relationships
        machinePartSuppliers: {
          create: suppliers.map((s: MachinePartSupplierInput) => ({
            supplierId: s.supplierId,
            isPreferred: s.isPreferred || false,
            isActive: s.isActive !== undefined ? s.isActive : true,
            notes: s.notes || null,
            pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
          })),
        },
      },
      include: {
        machinePartSuppliers: {
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
          orderBy: { isPreferred: 'desc' },
        },
      },
    });

    // Create material (same-id convention, category auto-resolved)
    const material = await materialService.createFromMaster(
      { id: created.id, code: partCode, name: finalPartName },
      'MACHINE_PART',
      tx
    );

    return { partRecord: created, materialEntry: material };
  });

  res.status(201).json({
    machinePart: partRecord,
    material: materialEntry,
    message: 'Machine part created successfully',
  });
};

/**
 * Get all machine parts with pagination and search
 */
export const getAllMachineParts = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = '', supplierId = '' } = req.query;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const where: {
    isActive: boolean;
    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    machinePartSuppliers?: { some: { supplierId: string; isActive: boolean } };
  } = { isActive: true };

  if (search) {
    where.OR = [
      { partName: { contains: String(search), mode: 'insensitive' } },
      { partCode: { contains: String(search), mode: 'insensitive' } },
      { partNumber: { contains: String(search), mode: 'insensitive' } },
      { category: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  // Filter by supplier via junction table
  if (supplierId) {
    where.machinePartSuppliers = {
      some: {
        supplierId: String(supplierId),
        isActive: true,
      },
    };
  }

  // Get total count
  const total = await prisma.machine_part_master.count({ where });

  // Get machine parts with relations
  const machineParts = await prisma.machine_part_master.findMany({
    where,
    include: {
      materials: {
        select: { id: true, code: true },
      },
      machinePartSuppliers: {
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
        orderBy: { isPreferred: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limitNum,
  });

  // Transform to match expected format
  const transformedParts = machineParts.map((item: any) => ({
    ...item,
    materialId: item.materials[0]?.id || null,
    materialCode: item.materials[0]?.code || null,
    materials: undefined,
    // Keep machinePartSuppliers - serializer will rename
  }));

  res.json({
    data: transformedParts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get machine part by ID
 */
export const getMachinePartById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const machinePart = await prisma.machine_part_master.findUnique({
    where: { id },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      machinePartSuppliers: {
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
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  if (!machinePart) {
    throw new NotFoundError('Machine part', id);
  }

  // Transform to match expected format
  const transformed = {
    ...machinePart,
    materialId: machinePart.materials[0]?.id || null,
    materialCode: machinePart.materials[0]?.code || null,
    materials: undefined,
  };

  res.json(transformed);
};

/**
 * Update machine part
 */
export const updateMachinePart = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    partName,
    partNumber,
    category,
    machine,
    brand,
    model,
    specifications,
    pricePerUnit,
    supplierId,
    description,
    isActive,
    suppliers,
  } = req.body;

  // Check if machine part exists
  const existing = await prisma.machine_part_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Machine part', id);
  }

  // Update suppliers if provided (delete-and-recreate pattern)
  if (suppliers !== undefined && Array.isArray(suppliers)) {
    await prisma.machine_part_suppliers.deleteMany({
      where: { machinePartId: id },
    });

    if (suppliers.length > 0) {
      await prisma.machine_part_suppliers.createMany({
        data: suppliers.map((s: MachinePartSupplierInput) => ({
          machinePartId: id,
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
          pricePerUnit: s.pricePerUnit ? parseFloat(String(s.pricePerUnit)) : null,
        })),
      });
    }
  }

  // Update machine part
  const updated = await prisma.machine_part_master.update({
    where: { id },
    data: {
      ...(partName !== undefined && { partName }),
      ...(partNumber !== undefined && { partNumber: partNumber || null }),
      ...(category !== undefined && { category: category || null }),
      ...(machine !== undefined && { machine: machine || null }),
      ...(brand !== undefined && { brand: brand || null }),
      ...(model !== undefined && { model: model || null }),
      ...(specifications !== undefined && { specifications: specifications || null }),
      ...(pricePerUnit !== undefined && { pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : null }),
      ...(supplierId !== undefined && { supplierId: supplierId || null }),
      ...(description !== undefined && { description: description || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      materials: {
        select: { id: true, code: true },
      },
      machinePartSuppliers: {
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
        orderBy: { isPreferred: 'desc' },
      },
    },
  });

  // BUG-MM13 fix: sync code to materials
  // Note: partCode is not updated (auto-generated), only sync name changes
  if (partName && partName !== existing.partName) {
    await syncMasterToMaterials(id, 'MACHINE_PART', { name: partName });
  }

  // Transform response
  const transformed = {
    ...updated,
    materialId: updated.materials[0]?.id || null,
    materialCode: updated.materials[0]?.code || null,
    materials: undefined,
  };

  res.json({
    machinePart: transformed,
    message: 'Machine part updated successfully',
  });
};

/**
 * Delete machine part
 */
export const deleteMachinePart = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if machine part exists
  const existing = await prisma.machine_part_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Machine part', id);
  }

  // Check if used in any BOM
  const bomUsage = await prisma.order_bom_items.count({
    where: {
      materialId: id,
    },
  });

  if (bomUsage > 0) {
    throw new ValidationError(
      `Cannot delete machine part. This machine part is used in ${bomUsage} BOM(s). Please remove from BOMs first.`
    );
  }

  // Delete material entry first (FK constraint)
  await prisma.materials.deleteMany({
    where: { machinePartId: id },
  });

  // Delete machine part (cascade will delete machine_part_suppliers)
  await prisma.machine_part_master.delete({
    where: { id },
  });

  res.json({ message: 'Machine part deleted successfully' });
};

/**
 * Bulk import machine parts from Excel
 */
export const bulkImportMachineParts = async (req: Request, res: Response) => {
  const { data, createStock = false } = req.body;
  const userId = (req as any).user?.userId || 'system';

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new ValidationError('No data provided for import');
  }

  // Pre-generate all part codes
  const codes = await allocateBatchCodes('PART', 'machine_part_master', 'partCode', data.length);

  // Get default warehouse if creating stock
  let defaultWarehouse: any = null;
  if (createStock) {
    defaultWarehouse = await prisma.warehouses.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  const results: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const partCode = codes[i];

    try {
      // Validate required field
      if (!row.partName || row.partName.trim() === '') {
        results.push({
          success: false,
          row: i + 1,
          error: 'Part name is required',
        });
        continue;
      }

      // Create machine part + material atomically so a failure cannot leave a master without its materials record
      const partRecord = await prisma.$transaction(async (tx) => {
        const created = await tx.machine_part_master.create({
          data: {
            partCode,
            partName: row.partName,
            partNumber: row.partNumber || null,
            category: row.category || null,
            machine: row.machine || null,
            brand: row.brand || null,
            model: row.model || null,
            specifications: row.specifications || null,
            pricePerUnit: row.pricePerUnit ? parseFloat(row.pricePerUnit) : null,
            description: row.description || null,
            isActive: true,
          },
        });

        // Create material (same-id convention, category auto-resolved)
        await materialService.createFromMaster(
          { id: created.id, code: partCode, name: row.partName },
          'MACHINE_PART',
          tx
        );

        return created;
      });

      // Create stock if requested - using specialized machine_part_stock table
      let stockCreated = false;
      if (createStock && row.stockQuantity && row.stockQuantity > 0 && defaultWarehouse) {
        await trimStockService.createTrimStock(
          {
            trimType: 'MACHINE_PART',
            masterId: partRecord.id,
            quantity: parseFloat(row.stockQuantity),
            unit: 'PIECE',
            purchaseCost: row.purchaseCost ? parseFloat(row.purchaseCost) : 0,
            warehouseId: defaultWarehouse.id,
            sourceType: 'IMPORT',
          },
          userId
        );
        stockCreated = true;
      }

      results.push({
        success: true,
        row: i + 1,
        partCode,
        materialCode: partCode,
        partName: row.partName,
        stockCreated,
      });
    } catch (error: any) {
      // allow-swallow — per-row bulk-import reporter: row writes are atomic ($transaction) and the failure is surfaced in results[]
      results.push({
        success: false,
        row: i + 1,
        partCode,
        error: error.message,
      });
    }
  }

  const summary = {
    total: data.length,
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };

  res.json({
    results,
    summary,
    message: `Bulk import completed: ${summary.success} succeeded, ${summary.failed} failed`,
  });
};

/**
 * Download Excel template for bulk import
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  const template = {
    columns: [
      { field: 'partName', header: 'Part Name', required: true, description: 'Name of the machine part (Required)' },
      {
        field: 'partNumber',
        header: 'Part Number',
        required: false,
        description: 'Manufacturer part number (Optional)',
      },
      { field: 'category', header: 'Category', required: false, description: 'Part category (Optional)' },
      { field: 'machine', header: 'Machine', required: false, description: 'Machine name/type (Optional)' },
      { field: 'brand', header: 'Brand', required: false, description: 'Brand name (Optional)' },
      { field: 'model', header: 'Model', required: false, description: 'Model number (Optional)' },
      {
        field: 'specifications',
        header: 'Specifications',
        required: false,
        description: 'Technical specifications (Optional)',
      },
      { field: 'pricePerUnit', header: 'Price Per Unit', required: false, description: 'Price per unit (Optional)' },
      { field: 'description', header: 'Description', required: false, description: 'Description (Optional)' },
      {
        field: 'stockQuantity',
        header: 'Stock Quantity',
        required: false,
        description: 'Initial stock quantity (Optional)',
      },
      {
        field: 'locationCode',
        header: 'Location Code',
        required: false,
        description: 'Warehouse location code (Optional)',
      },
    ],
    exampleData: [
      {
        partName: 'Needle Set Industrial',
        partNumber: 'DBx1-16',
        category: 'Needle',
        machine: 'Single Needle Lockstitch',
        brand: 'Groz-Beckert',
        model: 'DBx1',
        specifications: 'Size 16, Sharp Point',
        pricePerUnit: 2.5,
        description: 'Industrial sewing machine needle',
        stockQuantity: 500,
        locationCode: 'WH-01-B',
      },
    ],
  };

  res.json(template);
};
