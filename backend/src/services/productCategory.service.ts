/**
 * Product Category Service
 * Business logic for product category master management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { product_category_master } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';

// ============================================
// Types
// ============================================

export interface CreateProductCategoryDTO {
  code: string;
  name: string;
  description?: string;
  parentId?: string | null;
  level?: number;
  sortOrder?: number;
  minComponents?: number;
  maxComponents?: number;
}

export interface UpdateProductCategoryDTO extends Partial<CreateProductCategoryDTO> {}

export interface ProductCategoryQueryOptions extends PaginationOptions {
  parentId?: string | null;
  level?: number;
  isActive?: boolean;
}

// Hierarchical category with children
export interface ProductCategoryHierarchy extends product_category_master {
  children: ProductCategoryHierarchy[];
}

// ============================================
// Service
// ============================================

class ProductCategoryServiceClass extends BaseService<
  product_category_master,
  CreateProductCategoryDTO,
  UpdateProductCategoryDTO
> {
  protected readonly modelName = 'product_category_master';
  protected readonly entityName = 'Product Category';

  protected get model(): any {
    return this.prisma.product_category_master;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { code: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      parent: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      children: {
        select: {
          id: true,
          code: true,
          name: true,
          level: true,
          sortOrder: true,
          isActive: true,
        },
      },
    };
  }

  // ============================================
  // Custom Methods
  // ============================================

  /**
   * Create a new product category
   */
  async createCategory(data: CreateProductCategoryDTO): Promise<product_category_master> {
    // Check if code already exists
    const existing = await this.prisma.product_category_master.findFirst({
      where: { code: data.code, isActive: true },
    });

    if (existing) {
      throw new ConflictError('Product category code already exists');
    }

    // Validate minComponents and maxComponents
    if (data.minComponents !== undefined && data.maxComponents !== undefined) {
      if (data.minComponents > data.maxComponents) {
        throw new ValidationError('minComponents cannot be greater than maxComponents');
      }
      if (data.minComponents < 1) {
        throw new ValidationError('minComponents must be at least 1');
      }
    }

    // Determine level based on parent
    let level = 1;
    if (data.parentId) {
      const parent = await this.prisma.product_category_master.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }
      level = parent.level + 1;
    }

    return this.prisma.product_category_master.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        parentId: data.parentId || null,
        level: data.level ?? level,
        sortOrder: data.sortOrder ?? 0,
        minComponents: data.minComponents ?? 1,
        maxComponents: data.maxComponents ?? 1,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Update a product category
   */
  async updateCategory(id: string, data: UpdateProductCategoryDTO): Promise<product_category_master> {
    // Check if code is being changed and if it already exists
    if (data.code) {
      const existing = await this.prisma.product_category_master.findFirst({
        where: {
          code: data.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictError('Product category code already exists');
      }
    }

    // Validate minComponents and maxComponents
    if (data.minComponents !== undefined || data.maxComponents !== undefined) {
      // Get current values
      const current = await this.prisma.product_category_master.findUnique({
        where: { id },
        select: { minComponents: true, maxComponents: true },
      });

      if (!current) {
        throw new NotFoundError('Product category not found');
      }

      const newMin = data.minComponents !== undefined ? data.minComponents : current.minComponents;
      const newMax = data.maxComponents !== undefined ? data.maxComponents : current.maxComponents;

      if (newMin > newMax) {
        throw new ValidationError('minComponents cannot be greater than maxComponents');
      }
      if (newMin < 1) {
        throw new ValidationError('minComponents must be at least 1');
      }
    }

    // If changing parent, update level
    let level = data.level;
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const parent = await this.prisma.product_category_master.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) {
          throw new NotFoundError('Parent category not found');
        }
        level = parent.level + 1;
      } else {
        level = 1;
      }
    }

    return this.prisma.product_category_master.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(level !== undefined && { level }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.minComponents !== undefined && { minComponents: data.minComponents }),
        ...(data.maxComponents !== undefined && { maxComponents: data.maxComponents }),
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Soft delete a product category
   */
  async deleteCategory(id: string): Promise<void> {
    // Check if category has children
    const children = await this.prisma.product_category_master.count({
      where: { parentId: id, isActive: true },
    });

    if (children > 0) {
      throw new ValidationError('Cannot delete category with active children. Delete or reassign children first.');
    }

    // Check if category is used by styles
    const stylesCount = await this.prisma.styles.count({
      where: { productCategoryId: id },
    });

    if (stylesCount > 0) {
      throw new ValidationError(`Cannot delete category. It is used by ${stylesCount} style(s).`);
    }

    await this.prisma.product_category_master.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Find all categories with optional filters
   */
  async findAllWithFilters(options: ProductCategoryQueryOptions): Promise<PaginatedResult<product_category_master>> {
    const additionalFilters: AdditionalFilters = {};

    if (options.parentId !== undefined) {
      additionalFilters.parentId = options.parentId;
    }

    if (options.level !== undefined) {
      additionalFilters.level = options.level;
    }

    if (options.isActive !== undefined) {
      additionalFilters.isActive = options.isActive;
    }

    return this.findAll(
      {
        ...options,
        sortBy: options.sortBy || 'sortOrder',
        sortOrder: options.sortOrder || 'asc',
      },
      additionalFilters
    );
  }

  /**
   * Get full hierarchy tree
   */
  async getHierarchy(parentId: string | null = null): Promise<ProductCategoryHierarchy[]> {
    // Include inactive categories so the management tree can render them greyed-out
    // (with the reactivate toggle). This endpoint is only consumed by ProductCategoryMaster.
    const categories = await this.prisma.product_category_master.findMany({
      where: {
        parentId,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const result: ProductCategoryHierarchy[] = [];

    for (const category of categories) {
      const children = await this.getHierarchy(category.id);
      result.push({
        ...category,
        children,
      });
    }

    return result;
  }

  /**
   * Get children of a category
   */
  async getChildren(parentId: string): Promise<product_category_master[]> {
    return this.prisma.product_category_master.findMany({
      where: {
        parentId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get categories by level
   */
  async getCategoriesByLevel(level: number): Promise<product_category_master[]> {
    return this.prisma.product_category_master.findMany({
      where: {
        level,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all main categories (Level 1)
   */
  async getMainCategories(): Promise<product_category_master[]> {
    return this.getCategoriesByLevel(1);
  }

  /**
   * Get path from root to a category
   */
  async getCategoryPath(id: string): Promise<product_category_master[]> {
    const path: product_category_master[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const category: product_category_master | null = await this.prisma.product_category_master.findUnique({
        where: { id: currentId },
      });

      if (!category) break;

      path.unshift(category);
      currentId = category.parentId;
    }

    return path;
  }

  /**
   * Reorder categories
   */
  async reorderCategories(orders: { id: string; sortOrder: number }[]): Promise<void> {
    await this.prisma.$transaction(
      orders.map(({ id, sortOrder }) =>
        this.prisma.product_category_master.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );
  }

  /**
   * Toggle category active status
   */
  async toggleActive(id: string): Promise<product_category_master> {
    const category = await this.prisma.product_category_master.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Product category not found');
    }

    return this.prisma.product_category_master.update({
      where: { id },
      data: { isActive: !category.isActive },
      include: this.getDefaultIncludes(),
    });
  }
}

// Export singleton instance
export const productCategoryService = new ProductCategoryServiceClass();
