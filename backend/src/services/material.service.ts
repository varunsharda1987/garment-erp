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
      [key: string]: unknown;
    };

    return {
      ...data,
      reorderLevel: data.reorderLevel ? Number(data.reorderLevel) : null,
    };
  }
}

// Export singleton instance
export const materialService = new MaterialServiceClass();
