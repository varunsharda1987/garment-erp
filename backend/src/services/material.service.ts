/**
 * Material Service
 * Business logic for material and material category management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { materials, material_categories, Unit, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter } from '../types/prisma.types';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface SupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface CreateMaterialDTO {
  code: string;
  name: string;
  categoryId?: string;
  description?: string;
  specifications?: string;
  unit?: Unit;
  reorderLevel?: string | number;
  suppliers?: SupplierInput[];
  image?: string;
  categoryData?: Record<string, unknown>;
}

export interface UpdateMaterialDTO {
  code?: string;
  name?: string;
  categoryId?: string;
  description?: string;
  specifications?: string;
  unit?: Unit;
  reorderLevel?: string | number;
  suppliers?: SupplierInput[];
  image?: string;
  categoryData?: Record<string, unknown>;
}

export interface MaterialQueryOptions extends PaginationOptions {
  categoryId?: string;
  supplierId?: string;
  unit?: Unit;
}

export interface CreateCategoryDTO {
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ============================================
// Material Service
// ============================================

class MaterialServiceClass extends BaseService<materials, CreateMaterialDTO, UpdateMaterialDTO> {
  protected readonly modelName = 'materials';
  protected readonly entityName = 'Material';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.materials;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { code: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
    ];
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
   * Create material with suppliers
   */
  async createWithSuppliers(data: CreateMaterialDTO): Promise<materials> {
    logDebug('Creating material with suppliers', { code: data.code });

    // Check if material code already exists (only among active materials)
    const existingMaterial = await this.prisma.materials.findFirst({
      where: {
        code: data.code,
        isActive: true,
      },
    });

    if (existingMaterial) {
      throw new ConflictError(`Material with code '${data.code}' already exists`);
    }

    // Validate category exists if provided
    if (data.categoryId) {
      const category = await this.prisma.material_categories.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundError('Material Category', data.categoryId);
      }
    }

    // Validate suppliers exist
    if (data.suppliers && data.suppliers.length > 0) {
      const supplierIds = data.suppliers.map((s) => s.supplierId);
      const suppliers = await this.prisma.suppliers.findMany({
        where: { id: { in: supplierIds } },
      });

      if (suppliers.length !== supplierIds.length) {
        throw new ValidationError('One or more suppliers not found');
      }
    }

    const material = await this.prisma.materials.create({
      data: {
        id: randomUUID(),
        code: data.code,
        name: data.name,
        categoryId: data.categoryId || null,
        description: data.description || null,
        specifications: data.specifications || null,
        unit: data.unit || 'PIECE',
        reorderLevel: data.reorderLevel ? parseInt(String(data.reorderLevel)) : null,
        image: data.image || null,
        categoryData: data.categoryData ? JSON.parse(JSON.stringify(data.categoryData)) : undefined,
        suppliers: data.suppliers
          ? {
              create: data.suppliers.map((s) => ({
                supplierId: s.supplierId,
                isPreferred: s.isPreferred || false,
                isActive: s.isActive !== undefined ? s.isActive : true,
                notes: s.notes || null,
              })),
            }
          : undefined,
      } as Prisma.materialsUncheckedCreateInput,
      include: {
        material_categories: true,
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
              },
            },
          },
        },
      },
    });

    logInfo('Material created successfully', { id: material.id, code: data.code });
    return this.transformMaterial(material) as materials;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all materials with filters
   */
  async findAllWithFilters(options: MaterialQueryOptions): Promise<PaginatedResult<materials>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.materialsWhereInput = { isActive: true };

    if (search) {
      where.OR = this.buildSearchFilter(search);
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.supplierId) {
      where.suppliers = {
        some: {
          supplierId: filters.supplierId,
          isActive: true,
        },
      };
    }

    if (filters.unit) {
      where.unit = filters.unit;
    }

    const [materials, total] = await Promise.all([
      this.prisma.materials.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: {
          material_categories: {
            include: {
              parent: true,
            },
          },
          suppliers: {
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  supplierCategories: true,
                },
              },
            },
            orderBy: {
              isPreferred: 'desc',
            },
          },
          // Include master tables for costPerUnit computation
          fabric_master: { select: { costPerMeter: true } },
          greige_master: { select: { costPerMeter: true } },
          lace_master: { select: { pricePerMeter: true } },
          button_master: { select: { pricePerPiece: true } },
          thread_master: { select: { pricePerCone: true } },
          zipper_master: { select: { pricePerPiece: true } },
          elastic_master: { select: { pricePerMeter: true } },
          label_master: { select: { pricePerPiece: true } },
          packaging_master: { select: { pricePerPiece: true } },
        },
      }),
      this.prisma.materials.count({ where }),
    ]);

    // Transform Decimal fields
    const transformedMaterials = materials.map((m) => this.transformMaterial(m));

    return {
      data: transformedMaterials as materials[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get material by ID with full details
   */
  async getFullDetails(id: string): Promise<materials> {
    const material = await this.prisma.materials.findUnique({
      where: { id },
      include: {
        material_categories: {
          include: {
            parent: true,
          },
        },
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
                contactPerson: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: {
            isPreferred: 'desc',
          },
        },
        inventory_stock: {
          include: {
            locations: true,
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundError('Material', id);
    }

    return this.transformMaterial(material) as materials;
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update material with suppliers
   */
  async updateWithSuppliers(id: string, data: UpdateMaterialDTO): Promise<materials> {
    logDebug('Updating material', { id });

    const existingMaterial = await this.prisma.materials.findUnique({
      where: { id },
    });

    if (!existingMaterial) {
      throw new NotFoundError('Material', id);
    }

    // Check for duplicate code if updating (only among active materials)
    if (data.code && data.code !== existingMaterial.code) {
      const codeExists = await this.prisma.materials.findFirst({
        where: {
          code: data.code,
          isActive: true,
        },
      });

      if (codeExists) {
        throw new ConflictError(`Material with code '${data.code}' already exists`);
      }
    }

    // Validate category if provided
    if (data.categoryId) {
      const category = await this.prisma.material_categories.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new NotFoundError('Material Category', data.categoryId);
      }
    }

    // Build update data
    const updateData: Prisma.materialsUpdateInput = {
      code: data.code,
      name: data.name,
      material_categories: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
      description: data.description,
      specifications: data.specifications,
      unit: data.unit,
      reorderLevel: data.reorderLevel ? parseInt(String(data.reorderLevel)) : undefined,
      image: data.image,
      categoryData: data.categoryData ? JSON.parse(JSON.stringify(data.categoryData)) : undefined,
    };

    // Update suppliers if provided
    if (data.suppliers !== undefined) {
      // Delete existing supplier relationships
      await this.prisma.material_suppliers.deleteMany({
        where: { materialId: id },
      });

      // Create new supplier relationships
      updateData.suppliers = {
        create: data.suppliers.map((s) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
        })),
      };
    }

    const material = await this.prisma.materials.update({
      where: { id },
      data: updateData,
      include: {
        material_categories: true,
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
              },
            },
          },
        },
      },
    });

    logInfo('Material updated successfully', { id });
    return this.transformMaterial(material) as materials;
  }

  // ============================================
  // Delete Methods
  // ============================================

  /**
   * Soft delete material
   */
  async softDelete(id: string): Promise<void> {
    logDebug('Soft deleting material', { id });

    const material = await this.prisma.materials.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundError('Material', id);
    }

    await this.prisma.materials.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Material deleted successfully', { id });
  }

  // ============================================
  // Category Methods
  // ============================================

  /**
   * Get all categories
   */
  async getAllCategories(parentId?: string): Promise<material_categories[]> {
    const where: Prisma.material_categoriesWhereInput = { isActive: true };

    if (parentId) {
      where.parentCategoryId = parentId;
    }

    const categories = await this.prisma.material_categories.findMany({
      where,
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { materials: true },
        },
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return categories;
  }

  /**
   * Get category hierarchy (parents with children nested)
   */
  async getCategoryHierarchy(): Promise<material_categories[]> {
    const parentCategories = await this.prisma.material_categories.findMany({
      where: {
        level: 1,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { materials: true },
            },
          },
        },
        _count: {
          select: { materials: true },
        },
      },
    });

    return parentCategories;
  }

  /**
   * Create category
   */
  async createCategory(data: CreateCategoryDTO): Promise<material_categories> {
    logDebug('Creating material category', { name: data.name });

    // Check if category already exists (only among active categories)
    const existingCategory = await this.prisma.material_categories.findFirst({
      where: {
        name: data.name,
        isActive: true,
      },
    });

    if (existingCategory) {
      throw new ConflictError(`Material Category with name '${data.name}' already exists`);
    }

    // Determine level based on parent
    let level = 1;
    if (data.parentCategoryId) {
      const parent = await this.prisma.material_categories.findUnique({
        where: { id: data.parentCategoryId },
      });

      if (!parent) {
        throw new NotFoundError('Parent Category', data.parentCategoryId);
      }

      level = parent.level + 1;
    }

    const category = await this.prisma.material_categories.create({
      data: {
        id: randomUUID(),
        name: data.name,
        description: data.description || null,
        parentCategoryId: data.parentCategoryId || null,
        level,
        sortOrder: data.sortOrder || 0,
      },
    });

    logInfo('Material category created successfully', { id: category.id, name: data.name });
    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: UpdateCategoryDTO): Promise<material_categories> {
    logDebug('Updating material category', { id });

    const existingCategory = await this.prisma.material_categories.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundError('Material Category', id);
    }

    // Check for duplicate name if updating (only among active categories)
    if (data.name && data.name !== existingCategory.name) {
      const nameExists = await this.prisma.material_categories.findFirst({
        where: {
          name: data.name,
          isActive: true,
        },
      });

      if (nameExists) {
        throw new ConflictError(`Material Category with name '${data.name}' already exists`);
      }
    }

    // Update level if parent changes
    let level = existingCategory.level;
    if (data.parentCategoryId !== undefined) {
      if (data.parentCategoryId) {
        const parent = await this.prisma.material_categories.findUnique({
          where: { id: data.parentCategoryId },
        });

        if (!parent) {
          throw new NotFoundError('Parent Category', data.parentCategoryId);
        }

        level = parent.level + 1;
      } else {
        level = 1;
      }
    }

    const category = await this.prisma.material_categories.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        parentCategoryId: data.parentCategoryId,
        level,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });

    logInfo('Material category updated successfully', { id });
    return category;
  }

  /**
   * Delete category (soft delete)
   */
  async deleteCategory(id: string): Promise<void> {
    logDebug('Deleting material category', { id });

    const category = await this.prisma.material_categories.findUnique({
      where: { id },
      include: {
        _count: {
          select: { materials: true, children: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Material Category', id);
    }

    if (category._count.materials > 0) {
      throw new ValidationError(
        `Cannot delete category with ${category._count.materials} materials. Reassign materials first.`
      );
    }

    if (category._count.children > 0) {
      throw new ValidationError(
        `Cannot delete category with ${category._count.children} child categories. Delete children first.`
      );
    }

    await this.prisma.material_categories.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Material category deleted successfully', { id });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private transformMaterial(material: unknown): unknown {
    const data = material as {
      reorderLevel?: unknown;
      fabric_master?: { costPerMeter?: unknown } | null;
      greige_master?: { costPerMeter?: unknown } | null;
      lace_master?: { pricePerMeter?: unknown } | null;
      button_master?: { pricePerPiece?: unknown } | null;
      thread_master?: { pricePerCone?: unknown } | null;
      zipper_master?: { pricePerPiece?: unknown } | null;
      elastic_master?: { pricePerMeter?: unknown } | null;
      label_master?: { pricePerPiece?: unknown } | null;
      packaging_master?: { pricePerPiece?: unknown } | null;
      [key: string]: unknown;
    };

    return {
      ...data,
      reorderLevel: data.reorderLevel ? Number(data.reorderLevel) : null,
      costPerUnit: this.computeCostPerUnit(data),
    };
  }

  /**
   * Compute costPerUnit from the relevant master table
   * Returns the price from whichever master table is linked to this material
   */
  private computeCostPerUnit(material: {
    fabric_master?: { costPerMeter?: unknown } | null;
    greige_master?: { costPerMeter?: unknown } | null;
    lace_master?: { pricePerMeter?: unknown } | null;
    button_master?: { pricePerPiece?: unknown } | null;
    thread_master?: { pricePerCone?: unknown } | null;
    zipper_master?: { pricePerPiece?: unknown } | null;
    elastic_master?: { pricePerMeter?: unknown } | null;
    label_master?: { pricePerPiece?: unknown } | null;
    packaging_master?: { pricePerPiece?: unknown } | null;
  }): number | null {
    if (material.fabric_master?.costPerMeter) {
      return Number(material.fabric_master.costPerMeter);
    }
    if (material.greige_master?.costPerMeter) {
      return Number(material.greige_master.costPerMeter);
    }
    if (material.lace_master?.pricePerMeter) {
      return Number(material.lace_master.pricePerMeter);
    }
    if (material.button_master?.pricePerPiece) {
      return Number(material.button_master.pricePerPiece);
    }
    if (material.thread_master?.pricePerCone) {
      return Number(material.thread_master.pricePerCone);
    }
    if (material.zipper_master?.pricePerPiece) {
      return Number(material.zipper_master.pricePerPiece);
    }
    if (material.elastic_master?.pricePerMeter) {
      return Number(material.elastic_master.pricePerMeter);
    }
    if (material.label_master?.pricePerPiece) {
      return Number(material.label_master.pricePerPiece);
    }
    if (material.packaging_master?.pricePerPiece) {
      return Number(material.packaging_master.pricePerPiece);
    }
    return null;
  }

  // ============================================
  // Master-to-Materials Sync Methods
  // ============================================

  /**
   * Get or create a category for fabric/lace/greige materials
   * These categories are auto-created if they don't exist
   */
  async getOrCreateCategory(type: 'FABRIC' | 'LACE' | 'GREIGE'): Promise<string> {
    const categoryMap: Record<string, { id: string; name: string }> = {
      FABRIC: { id: 'CAT-FABRIC', name: 'Fabric' },
      GREIGE: { id: 'CAT-GREIGE', name: 'Greige (Raw Fabric)' },
      LACE: { id: 'CAT-LACE', name: 'Lace' },
    };

    const { id, name } = categoryMap[type];

    // Check if category exists
    const existing = await this.prisma.material_categories.findUnique({
      where: { id },
    });

    if (existing) {
      return existing.id;
    }

    // Create the category
    const category = await this.prisma.material_categories.create({
      data: {
        id,
        name,
        description: `Auto-created category for ${type} materials`,
        level: 1,
        sortOrder: 0,
        isActive: true,
      },
    });

    logInfo(`Auto-created material category for ${type}`, { id: category.id });
    return category.id;
  }

  /**
   * Create a materials record from a master table record (fabric/lace/greige)
   * Uses the SAME ID as the master to keep them in sync
   */
  async createFromMaster(
    master: { id: string; code: string; name: string },
    type: 'FABRIC' | 'LACE' | 'GREIGE'
  ): Promise<materials> {
    logDebug(`Creating materials record from ${type} master`, { id: master.id, code: master.code });

    // Check if materials record already exists with this ID
    const existing = await this.prisma.materials.findUnique({
      where: { id: master.id },
    });

    if (existing) {
      logDebug(`Materials record already exists for ${type}`, { id: master.id });
      return existing;
    }

    // Get or create the category for this type
    const categoryId = await this.getOrCreateCategory(type);

    // Determine unit based on type
    const unit: Unit = type === 'LACE' ? 'METER' : 'METER';

    // Create materials record with SAME ID as master
    const material = await this.prisma.materials.create({
      data: {
        id: master.id,           // Same ID as master
        code: master.code,       // Same code
        name: master.name,       // Same name
        categoryId,
        materialType: type,
        unit,
        isActive: true,
        // Link back to the appropriate master
        fabricId: type === 'FABRIC' ? master.id : null,
        greigeId: type === 'GREIGE' ? master.id : null,
        laceId: type === 'LACE' ? master.id : null,
      },
    });

    logInfo(`Created materials record from ${type} master`, { id: material.id, code: material.code });
    return material;
  }
}

// Export singleton instance
export const materialService = new MaterialServiceClass();
