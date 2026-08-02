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
  // Note: level is NOT accepted from user input - it is ALWAYS computed from parent
  // to maintain hierarchy integrity. See createCategory() and updateCategory().
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
    // BUG-PC3 FIX: Check ALL categories (including inactive) to prevent code reuse confusion
    // This ensures codes are globally unique, not just unique among active categories
    const existing = await this.prisma.product_category_master.findFirst({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictError(
        existing.isActive
          ? 'Product category code already exists'
          : 'Product category code exists in an inactive category. Reactivate it or use a different code.'
      );
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

    // Use auto-calculated level (based on parent) - ignore user-provided level for hierarchy integrity
    return this.prisma.product_category_master.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        parentId: data.parentId || null,
        level: level, // Always use calculated level, not user-provided
        sortOrder: data.sortOrder ?? 0,
        minComponents: data.minComponents ?? 1,
        maxComponents: data.maxComponents ?? 1,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Check if a category is a descendant of another category (circular reference check)
   */
  private async isDescendantOf(categoryId: string, potentialAncestorId: string): Promise<boolean> {
    // Start from categoryId and walk up the tree
    let currentId: string | null = categoryId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === potentialAncestorId) {
        return true;
      }
      if (visited.has(currentId)) {
        // Already visited - prevent infinite loop in case of existing circular data
        return false;
      }
      visited.add(currentId);

      const category: { parentId: string | null } | null = await this.prisma.product_category_master.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = category?.parentId || null;
    }

    return false;
  }

  /**
   * Update a product category
   */
  async updateCategory(id: string, data: UpdateProductCategoryDTO): Promise<product_category_master> {
    // BUG-PC3 FIX: Check ALL categories (including inactive) to prevent code reuse confusion
    // Consistent with createCategory - both check all records for global code uniqueness
    if (data.code) {
      const existing = await this.prisma.product_category_master.findFirst({
        where: {
          code: data.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictError(
          existing.isActive
            ? 'Product category code already exists'
            : 'Product category code exists in an inactive category. Reactivate it or use a different code.'
        );
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

    // Level is ALWAYS computed from parent - never accept user-provided level to maintain hierarchy integrity
    // BUG-PC1 FIX: Remove ability to override level via data.level
    let level: number | undefined;
    if (data.parentId !== undefined) {
      if (data.parentId) {
        // Cannot set self as parent
        if (data.parentId === id) {
          throw new ValidationError('A category cannot be its own parent');
        }

        // Check for circular reference - new parent cannot be a descendant of this category
        const wouldCreateCircle = await this.isDescendantOf(data.parentId, id);
        if (wouldCreateCircle) {
          throw new ValidationError('Cannot set a descendant category as parent (would create circular hierarchy)');
        }

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
    // Note: If parentId is not being changed, level is not updated (stays as-is in DB)

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
   *
   * OPTIMIZATION: Fetch all categories in one query and build tree in memory
   * to avoid N+1 query pattern (each level was previously a separate query).
   * // BUG-PC4 fix - verified: already optimized with single-query + in-memory tree build
   */
  async getHierarchy(parentId: string | null = null): Promise<ProductCategoryHierarchy[]> {
    // Include inactive categories so the management tree can render them greyed-out
    // (with the reactivate toggle). This endpoint is only consumed by ProductCategoryMaster.

    // Fetch ALL categories in a single query (avoids N+1)
    const allCategories = await this.prisma.product_category_master.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Build a map for O(1) child lookup
    const childrenMap = new Map<string | null, product_category_master[]>();
    for (const cat of allCategories) {
      const key = cat.parentId;
      if (!childrenMap.has(key)) {
        childrenMap.set(key, []);
      }
      childrenMap.get(key)!.push(cat);
    }

    // Recursive tree builder using the pre-fetched data
    const buildTree = (pid: string | null): ProductCategoryHierarchy[] => {
      const children = childrenMap.get(pid) || [];
      return children.map((cat) => ({
        ...cat,
        children: buildTree(cat.id),
      }));
    };

    return buildTree(parentId);
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
