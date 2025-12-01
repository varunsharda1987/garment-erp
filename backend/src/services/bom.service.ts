/**
 * Bill of Materials (BOM) Service
 * Business logic for BOM management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { bill_of_materials, Unit, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export interface BOMItemInput {
  materialId: string;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent?: number;
  costPerUnit: number;
  notes?: string;
}

export interface CreateBOMDTO {
  styleId: string;
  bomItems: BOMItemInput[];
}

export interface UpdateBOMDTO {
  bomItems: BOMItemInput[];
  isActive?: boolean;
}

export interface BOMQueryOptions extends PaginationOptions {
  styleId?: string;
  isActive?: boolean;
  approved?: boolean;
}

export interface MaterialRequirement {
  material: unknown;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  baseQuantity: number;
  wastageQuantity: number;
  totalQuantity: number;
  totalCost: number;
}

// ============================================
// Service
// ============================================

class BOMServiceClass extends BaseService<bill_of_materials, CreateBOMDTO, UpdateBOMDTO> {
  protected readonly modelName = 'bill_of_materials';
  protected readonly entityName = 'BOM';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.bill_of_materials;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    // Simple search on BOM id - complex searches done in custom methods
    return [];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  protected getListIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create a new BOM with items for a style
   */
  async createWithItems(data: CreateBOMDTO, userId: string): Promise<bill_of_materials> {
    logDebug('Creating BOM with items', { styleId: data.styleId });

    if (!data.bomItems || data.bomItems.length === 0) {
      throw new ValidationError('At least one BOM item is required');
    }

    // Check if style exists
    const style = await this.prisma.styles.findUnique({
      where: { id: data.styleId },
    });

    if (!style) {
      throw new NotFoundError('Style', data.styleId);
    }

    // Get the next version number
    const latestBOM = await this.prisma.bill_of_materials.findFirst({
      where: { styleId: data.styleId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Validate all materials exist
    const materialIds = data.bomItems.map((item) => item.materialId);
    const materials = await this.prisma.materials.findMany({
      where: { id: { in: materialIds } },
    });

    if (materials.length !== materialIds.length) {
      throw new ValidationError('One or more materials not found');
    }

    // Calculate total cost
    const totalCost = this.calculateTotalCost(data.bomItems);

    // Create BOM with items in a transaction
    const bom = await this.prisma.$transaction(async (tx) => {
      // Deactivate previous BOMs for this style
      await tx.bill_of_materials.updateMany({
        where: {
          styleId: data.styleId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new BOM
      const newBOM = await tx.bill_of_materials.create({
        data: {
          id: uuidv4(),
          styleId: data.styleId,
          version: nextVersion,
          totalCost,
          createdById: userId,
          isActive: true,
          bom_items: {
            create: data.bomItems.map((item) => ({
              id: uuidv4(),
              materialId: item.materialId,
              quantityPerUnit: item.quantityPerUnit,
              unit: item.unit,
              wastagePercent: item.wastagePercent || 0,
              costPerUnit: item.costPerUnit,
              notes: item.notes,
            })),
          },
        } as Prisma.bill_of_materialsUncheckedCreateInput,
        include: this.getDefaultIncludes(),
      });

      return newBOM;
    });

    logInfo('BOM created successfully', {
      id: bom.id,
      styleId: data.styleId,
      version: nextVersion,
    });

    return bom;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all BOMs with additional filters
   */
  async findAllWithFilters(options: BOMQueryOptions): Promise<PaginatedResult<bill_of_materials>> {
    const { page = 1, limit = 20, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.bill_of_materialsWhereInput = {};

    if (search) {
      where.OR = this.buildSearchFilter(search);
    }

    if (filters.styleId) {
      where.styleId = filters.styleId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.approved === true) {
      where.approvedById = { not: null };
    } else if (filters.approved === false) {
      where.approvedById = null;
    }

    const [boms, total] = await Promise.all([
      this.prisma.bill_of_materials.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: this.getListIncludes(),
      }),
      this.prisma.bill_of_materials.count({ where }),
    ]);

    // Transform Decimal fields
    const transformedBOMs = boms.map((bom) => this.transformBOM(bom));

    return {
      data: transformedBOMs as unknown as bill_of_materials[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get active BOM for a style
   */
  async getActiveByStyle(styleId: string): Promise<bill_of_materials> {
    const bom = await this.prisma.bill_of_materials.findFirst({
      where: {
        styleId,
        isActive: true,
      },
      include: this.getDefaultIncludes(),
    });

    if (!bom) {
      throw new NotFoundError('Active BOM for style', styleId);
    }

    return this.transformBOM(bom) as unknown as bill_of_materials;
  }

  /**
   * Get all BOM versions for a style
   */
  async getVersionsByStyle(styleId: string): Promise<bill_of_materials[]> {
    const boms = await this.prisma.bill_of_materials.findMany({
      where: { styleId },
      include: this.getListIncludes(),
      orderBy: { version: 'desc' },
    });

    return boms.map((bom) => this.transformBOM(bom)) as unknown as bill_of_materials[];
  }

  /**
   * Get BOM with full details
   */
  async getFullDetails(id: string): Promise<bill_of_materials> {
    const bom = await this.prisma.bill_of_materials.findUnique({
      where: { id },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        users_bill_of_materials_createdByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        users_bill_of_materials_approvedByIdTousers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        styles: true,
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM', id);
    }

    return this.transformBOM(bom) as unknown as bill_of_materials;
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update BOM items (only for unapproved BOMs)
   */
  async updateItems(id: string, data: UpdateBOMDTO): Promise<bill_of_materials> {
    logDebug('Updating BOM items', { id });

    const currentBOM = await this.prisma.bill_of_materials.findUnique({
      where: { id },
    });

    if (!currentBOM) {
      throw new NotFoundError('BOM', id);
    }

    if (currentBOM.approvedById) {
      throw new BusinessError('Cannot update approved BOM. Create a new version instead.');
    }

    // Validate all materials exist
    const materialIds = data.bomItems.map((item) => item.materialId);
    const materials = await this.prisma.materials.findMany({
      where: { id: { in: materialIds } },
    });

    if (materials.length !== materialIds.length) {
      throw new ValidationError('One or more materials not found');
    }

    // Calculate total cost
    const totalCost = this.calculateTotalCost(data.bomItems);

    // Update BOM in a transaction
    const updatedBOM = await this.prisma.$transaction(async (tx) => {
      // Delete existing BOM items
      await tx.bom_items.deleteMany({
        where: { bomId: id },
      });

      // Update BOM
      const bom = await tx.bill_of_materials.update({
        where: { id },
        data: {
          totalCost,
          isActive: data.isActive ?? currentBOM.isActive,
          bom_items: {
            create: data.bomItems.map((item) => ({
              materialId: item.materialId,
              quantityPerUnit: item.quantityPerUnit,
              unit: item.unit,
              wastagePercent: item.wastagePercent || 0,
              costPerUnit: item.costPerUnit,
              notes: item.notes,
            })),
          },
        },
        include: this.getDefaultIncludes(),
      });

      return bom;
    });

    logInfo('BOM updated successfully', { id });
    return this.transformBOM(updatedBOM) as unknown as bill_of_materials;
  }

  /**
   * Approve or reject a BOM
   */
  async approve(id: string, userId: string, approved: boolean): Promise<bill_of_materials> {
    logDebug('Approving BOM', { id, approved });

    const bom = await this.prisma.bill_of_materials.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('BOM', id);
    }

    if (bom.approvedById) {
      throw new BusinessError('BOM is already approved');
    }

    const updatedBOM = await this.prisma.bill_of_materials.update({
      where: { id },
      data: {
        approvedById: approved ? userId : null,
        approvedAt: approved ? new Date() : null,
      },
      include: this.getDefaultIncludes(),
    });

    logInfo(approved ? 'BOM approved' : 'BOM approval revoked', { id });
    return this.transformBOM(updatedBOM) as unknown as bill_of_materials;
  }

  /**
   * Soft delete (deactivate) a BOM
   */
  async deactivate(id: string): Promise<void> {
    logDebug('Deactivating BOM', { id });

    const bom = await this.prisma.bill_of_materials.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('BOM', id);
    }

    if (bom.approvedById) {
      throw new BusinessError('Cannot delete approved BOM. Deactivate it instead.');
    }

    await this.prisma.bill_of_materials.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('BOM deactivated', { id });
  }

  // ============================================
  // Calculation Methods
  // ============================================

  /**
   * Calculate material requirements for an order quantity
   */
  async calculateMaterialRequirements(
    id: string,
    orderQuantity: number
  ): Promise<{
    bom: { id: string; version: number; style: unknown };
    orderQuantity: number;
    requirements: MaterialRequirement[];
    totalMaterialCost: number;
    costPerPiece: number;
  }> {
    if (!orderQuantity || orderQuantity <= 0) {
      throw new ValidationError('Valid order quantity is required');
    }

    const bom = await this.prisma.bill_of_materials.findUnique({
      where: { id },
      include: {
        bom_items: {
          include: {
            materials: true,
          },
        },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('BOM', id);
    }

    // Calculate requirements for each material
    const requirements: MaterialRequirement[] = bom.bom_items.map((item) => {
      const baseQuantity = Number(item.quantityPerUnit) * orderQuantity;
      const wastageQuantity = baseQuantity * (Number(item.wastagePercent) / 100);
      const totalQuantity = baseQuantity + wastageQuantity;
      const totalCost = totalQuantity * Number(item.costPerUnit);

      return {
        material: item.materials,
        quantityPerUnit: Number(item.quantityPerUnit),
        unit: item.unit,
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        baseQuantity,
        wastageQuantity,
        totalQuantity,
        totalCost,
      };
    });

    const totalMaterialCost = requirements.reduce((sum, req) => sum + req.totalCost, 0);

    return {
      bom: {
        id: bom.id,
        version: bom.version,
        style: bom.styles,
      },
      orderQuantity,
      requirements,
      totalMaterialCost,
      costPerPiece: totalMaterialCost / orderQuantity,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private calculateTotalCost(bomItems: BOMItemInput[]): number {
    return bomItems.reduce((sum, item) => {
      const effectiveQuantity = item.quantityPerUnit * (1 + (item.wastagePercent || 0) / 100);
      return sum + effectiveQuantity * item.costPerUnit;
    }, 0);
  }

  private transformBOM(bom: unknown): unknown {
    const bomData = bom as {
      totalCost?: unknown;
      bom_items?: Array<{
        quantityPerUnit?: unknown;
        wastagePercent?: unknown;
        costPerUnit?: unknown;
        materials?: {
          reorderLevel?: unknown;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

    return {
      ...bomData,
      totalCost: bomData.totalCost ? Number(bomData.totalCost) : null,
      bom_items: bomData.bom_items?.map((item) => ({
        ...item,
        quantityPerUnit: Number(item.quantityPerUnit),
        wastagePercent: Number(item.wastagePercent),
        costPerUnit: Number(item.costPerUnit),
        materials: item.materials
          ? {
              ...item.materials,
              reorderLevel: item.materials.reorderLevel
                ? Number(item.materials.reorderLevel)
                : null,
            }
          : null,
      })),
    };
  }
}

// Export singleton instance
export const bomService = new BOMServiceClass();
