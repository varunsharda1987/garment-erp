import { MaterialType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import {
  CreateMaterialMasterDto,
  UpdateMaterialMasterDto,
  MaterialMasterFilterDto,
  MaterialSupplierMappingDto,
} from '../types/material-master.types';

/**
 * Unified Material Master Service
 * Queries the consolidated material_master table
 * All legacy material data should be migrated to this table
 */

export async function findAll(filters: MaterialMasterFilterDto) {
  const where: Prisma.material_masterWhereInput = {};

  // Material type filter
  if (filters.materialType) {
    where.materialType = filters.materialType;
  }

  // Active filter (default to true)
  where.isActive = filters.isActive ?? true;

  // Search filter
  if (filters.searchTerm) {
    where.OR = [
      { code: { contains: filters.searchTerm, mode: 'insensitive' } },
      { name: { contains: filters.searchTerm, mode: 'insensitive' } },
      { description: { contains: filters.searchTerm, mode: 'insensitive' } },
    ];
  }

  return await prisma.material_master.findMany({
    where,
    include: {
      currency: true,
      suppliers: {
        where: { isActive: true },
        include: { supplier: true },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });
}

export async function findById(id: number) {
  return await prisma.material_master.findUnique({
    where: { id },
    include: {
      currency: true,
      suppliers: {
        where: { isActive: true },
        include: {
          supplier: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function create(data: CreateMaterialMasterDto, userId: string) {
  // Validate material type-specific requirements
  validateSpecifications(data.materialType, data.specifications);

  // Generate code if not provided
  if (!data.code) {
    data.code = await generateMaterialCode(data.materialType);
  }

  return await prisma.material_master.create({
    data: {
      materialType: data.materialType,
      code: data.code,
      name: data.name,
      description: data.description,
      pricePerUnit: data.pricePerUnit,
      pricePerMeter: data.pricePerMeter,
      pricePerPiece: data.pricePerPiece,
      pricePerKg: data.pricePerKg,
      pricePerGross: data.pricePerGross,
      unit: data.unit,
      currencyId: data.currencyId,
      specifications: data.specifications as Prisma.InputJsonValue,
      isActive: data.isActive ?? true,
      hsnCode: data.hsnCode,
      gstRate: data.gstRate,
      createdById: userId,
    },
    include: {
      currency: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function update(id: number, data: UpdateMaterialMasterDto) {
  // Validate specifications if provided
  const existing = await findById(id);
  if (!existing) {
    throw new Error('Material not found');
  }

  if (data.specifications) {
    validateSpecifications(existing.materialType, data.specifications);
  }

  return await prisma.material_master.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      pricePerUnit: data.pricePerUnit,
      pricePerMeter: data.pricePerMeter,
      pricePerPiece: data.pricePerPiece,
      pricePerKg: data.pricePerKg,
      pricePerGross: data.pricePerGross,
      unit: data.unit,
      currencyId: data.currencyId,
      specifications: data.specifications as Prisma.InputJsonValue,
      isActive: data.isActive,
      hsnCode: data.hsnCode,
      gstRate: data.gstRate,
    },
    include: {
      currency: true,
      suppliers: {
        where: { isActive: true },
        include: {
          supplier: true,
        },
      },
    },
  });
}

export async function softDelete(id: number) {
  // Check if material exists
  const material = await prisma.material_master.findUnique({
    where: { id },
  });

  if (!material) {
    throw new Error('Material not found');
  }

  // Soft delete by setting isActive to false
  return await prisma.material_master.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getSuppliers(materialId: number) {
  return await prisma.material_supplier_mapping.findMany({
    where: { materialId: materialId, isActive: true },
    include: {
      supplier: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { supplierPrice: 'asc' }],
  });
}

export async function addSupplier(materialId: number, data: MaterialSupplierMappingDto) {
  // If setting as primary, unset other primaries
  if (data.isPrimary) {
    await prisma.material_supplier_mapping.updateMany({
      where: { materialId: materialId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return await prisma.material_supplier_mapping.create({
    data: {
      materialId: materialId,
      supplierId: data.supplierId,
      supplierCode: data.supplierCode,
      supplierName: data.supplierName,
      supplierPrice: data.supplierPrice,
      leadTimeDays: data.leadTimeDays,
      moq: data.moq,
      moqUnit: data.moqUnit,
      isPrimary: data.isPrimary ?? false,
      isActive: data.isActive ?? true,
    },
    include: {
      supplier: true,
    },
  });
}

export async function countByType(materialType: MaterialType) {
  return await prisma.material_master.count({
    where: { materialType: materialType, isActive: true },
  });
}

// Helper: Generate material code
async function generateMaterialCode(materialType: MaterialType): Promise<string> {
  const prefix = getMaterialTypePrefix(materialType);

  const maxCode = await prisma.material_master.findFirst({
    where: {
      materialType: materialType,
      code: { startsWith: prefix },
    },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  if (!maxCode) {
    return `${prefix}001`;
  }

  const currentNumber = parseInt(maxCode.code.replace(prefix, ''));
  const nextNumber = currentNumber + 1;

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

function getMaterialTypePrefix(materialType: MaterialType): string {
  const prefixes: Record<MaterialType, string> = {
    // Generic and fabric types
    GENERIC: 'GEN',
    FABRIC: 'FAB',
    GREIGE: 'GRG',
    // Trim types
    TRIMS: 'TRM',
    LACE: 'LAC',
    BUTTON: 'BTN',
    THREAD: 'THR',
    ZIPPER: 'ZIP',
    ELASTIC: 'ELA',
    LABEL: 'LBL',
    HOOK_EYE: 'HKE',
    SNAP_BUTTON: 'SNP',
    BUCKLE: 'BCK',
    BELT: 'BLT',
    VELCRO: 'VLC',
    DRAWSTRING: 'DRS',
    RIBBON: 'RBN',
    SEQUIN: 'SEQ',
    BEAD: 'BED',
    MOTIF: 'MTF',
    INTERLINING: 'INT',
    PADDING: 'PAD',
    // Other types
    PACKAGING: 'PKG',
    ACCESSORIES: 'ACC',
    SERVICE: 'SVC',
    MACHINE_PART: 'MPN',
    OTHER: 'OTR',
    OTHER_FASTENER: 'OFS',
    OTHER_TAPE: 'OTP',
    OTHER_DECORATIVE: 'ODC',
    OTHER_FUNCTIONAL: 'OFN',
    OTHER_MATERIAL: 'OTH',
  };

  return prefixes[materialType] || 'MAT';
}

// Helper: Validate material type-specific specifications
function validateSpecifications(materialType: MaterialType, specifications: any) {
  if (!specifications) return;

  // Type-specific validation rules
  const validationRules: Partial<Record<MaterialType, (specs: any) => void>> = {
    LACE: (specs) => {
      if (specs.width && (specs.width <= 0 || specs.width > 1000)) {
        throw new Error('Lace width must be between 0 and 1000mm');
      }
    },
    BUTTON: (specs) => {
      if (specs.diameter && specs.diameter <= 0) {
        throw new Error('Button diameter must be positive');
      }
      if (specs.holes && ![0, 2, 4].includes(specs.holes)) {
        throw new Error('Button holes must be 0, 2, or 4');
      }
    },
    THREAD: (specs) => {
      if (specs.count && specs.count <= 0) {
        throw new Error('Thread count must be positive');
      }
    },
    ZIPPER: (specs) => {
      if (specs.length && specs.length <= 0) {
        throw new Error('Zipper length must be positive');
      }
    },
    ELASTIC: (specs) => {
      if (specs.width && specs.width <= 0) {
        throw new Error('Elastic width must be positive');
      }
    },
  };

  const validator = validationRules[materialType];
  if (validator) {
    validator(specifications);
  }
}
