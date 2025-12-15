/**
 * Category Component Default Service
 * Business logic for managing default components per product category
 */

import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { category_component_defaults, component_masters, product_category_master } from '@prisma/client';
import { NotFoundError, ValidationError } from '../errors';

// ============================================
// Types
// ============================================

export interface CreateCategoryComponentDefaultDTO {
  productCategoryId: string;
  componentMasterId: string;
  isRequired?: boolean;
  sortOrder?: number;
  defaultCount?: number;
  notes?: string;
}

export interface UpdateCategoryComponentDefaultDTO {
  isRequired?: boolean;
  sortOrder?: number;
  defaultCount?: number;
  notes?: string;
}

export interface ComponentDefaultInput {
  componentMasterId: string;
  isRequired?: boolean;
  sortOrder?: number;
  defaultCount?: number;
  notes?: string;
}

export interface CategoryComponentDefaultWithRelations extends category_component_defaults {
  componentMaster: component_masters;
  productCategory?: product_category_master;
}

export interface ComponentSuggestion {
  componentMasterId: string;
  componentMaster: component_masters;
  isRequired: boolean;
  sortOrder: number;
  defaultCount: number;
  notes: string | null;
  sourceCategory: {
    id: string;
    name: string;
    code: string;
    isInherited: boolean;
  };
}

// ============================================
// Service
// ============================================

class CategoryComponentDefaultServiceClass {
  /**
   * Get default components for a specific product category
   */
  async getByProductCategoryId(categoryId: string): Promise<CategoryComponentDefaultWithRelations[]> {
    return prisma.category_component_defaults.findMany({
      where: { productCategoryId: categoryId },
      include: {
        componentMaster: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get a single category component default by ID
   */
  async getById(id: string): Promise<CategoryComponentDefaultWithRelations | null> {
    return prisma.category_component_defaults.findUnique({
      where: { id },
      include: {
        componentMaster: true,
        productCategory: true,
      },
    });
  }

  /**
   * Create a single category component default
   */
  async create(data: CreateCategoryComponentDefaultDTO): Promise<CategoryComponentDefaultWithRelations> {
    // Validate product category exists
    const category = await prisma.product_category_master.findUnique({
      where: { id: data.productCategoryId },
    });
    if (!category) {
      throw new NotFoundError('Product category not found');
    }

    // Validate component master exists
    const component = await prisma.component_masters.findUnique({
      where: { id: data.componentMasterId },
    });
    if (!component) {
      throw new NotFoundError('Component master not found');
    }

    return prisma.category_component_defaults.create({
      data: {
        productCategoryId: data.productCategoryId,
        componentMasterId: data.componentMasterId,
        isRequired: data.isRequired ?? false,
        sortOrder: data.sortOrder ?? 0,
        defaultCount: data.defaultCount ?? 1,
        notes: data.notes,
      },
      include: {
        componentMaster: true,
      },
    });
  }

  /**
   * Update a category component default
   */
  async update(id: string, data: UpdateCategoryComponentDefaultDTO): Promise<CategoryComponentDefaultWithRelations> {
    const existing = await prisma.category_component_defaults.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError('Category component default not found');
    }

    return prisma.category_component_defaults.update({
      where: { id },
      data: {
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.defaultCount !== undefined && { defaultCount: data.defaultCount }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        componentMaster: true,
      },
    });
  }

  /**
   * Delete a category component default
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.category_component_defaults.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundError('Category component default not found');
    }

    await prisma.category_component_defaults.delete({
      where: { id },
    });
  }

  /**
   * Remove a specific component from a category's defaults
   */
  async removeByComponentAndCategory(categoryId: string, componentId: string): Promise<void> {
    const existing = await prisma.category_component_defaults.findUnique({
      where: {
        productCategoryId_componentMasterId: {
          productCategoryId: categoryId,
          componentMasterId: componentId,
        },
      },
    });
    if (!existing) {
      throw new NotFoundError('Component is not a default for this category');
    }

    await prisma.category_component_defaults.delete({
      where: {
        productCategoryId_componentMasterId: {
          productCategoryId: categoryId,
          componentMasterId: componentId,
        },
      },
    });
  }

  /**
   * Bulk set default components for a category
   * Replaces all existing defaults with the new list
   */
  async setDefaultsForCategory(
    categoryId: string,
    components: ComponentDefaultInput[]
  ): Promise<CategoryComponentDefaultWithRelations[]> {
    // Validate product category exists
    const category = await prisma.product_category_master.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundError('Product category not found');
    }

    // Validate all component IDs exist
    if (components.length > 0) {
      const componentIds = components.map((c) => c.componentMasterId);
      const existingComponents = await prisma.component_masters.findMany({
        where: { id: { in: componentIds } },
        select: { id: true },
      });

      const existingIds = new Set(existingComponents.map((c) => c.id));
      const invalidIds = componentIds.filter((id) => !existingIds.has(id));

      if (invalidIds.length > 0) {
        throw new ValidationError(`Invalid component IDs: ${invalidIds.join(', ')}`);
      }
    }

    // Use transaction to delete existing and create new
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete existing defaults for this category
      await tx.category_component_defaults.deleteMany({
        where: { productCategoryId: categoryId },
      });

      // Create new defaults
      if (components.length === 0) {
        return [];
      }

      await tx.category_component_defaults.createMany({
        data: components.map((c, index) => ({
          productCategoryId: categoryId,
          componentMasterId: c.componentMasterId,
          isRequired: c.isRequired ?? false,
          sortOrder: c.sortOrder ?? index,
          defaultCount: c.defaultCount ?? 1,
          notes: c.notes,
        })),
      });

      // Fetch and return the created records
      return tx.category_component_defaults.findMany({
        where: { productCategoryId: categoryId },
        include: {
          componentMaster: true,
        },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  /**
   * Get suggested components for a category with inheritance from parent categories
   * If the category has no defaults defined, it will walk up the hierarchy
   */
  async getSuggestedComponentsWithInheritance(categoryId: string): Promise<ComponentSuggestion[]> {
    // Get the category and its path to root
    const category = await prisma.product_category_master.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundError('Product category not found');
    }

    // Build the path from this category to root
    const categoryPath: product_category_master[] = [];
    let currentCategory: product_category_master | null = category;

    while (currentCategory) {
      categoryPath.push(currentCategory);
      if (currentCategory.parentId) {
        currentCategory = await prisma.product_category_master.findUnique({
          where: { id: currentCategory.parentId },
        });
      } else {
        currentCategory = null;
      }
    }

    // Check each category in the path for defaults (starting with the most specific)
    for (const cat of categoryPath) {
      const defaults = await prisma.category_component_defaults.findMany({
        where: { productCategoryId: cat.id },
        include: {
          componentMaster: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      if (defaults.length > 0) {
        // Found defaults at this level
        return defaults.map((d: CategoryComponentDefaultWithRelations) => ({
          componentMasterId: d.componentMasterId,
          componentMaster: d.componentMaster,
          isRequired: d.isRequired,
          sortOrder: d.sortOrder,
          defaultCount: d.defaultCount,
          notes: d.notes,
          sourceCategory: {
            id: cat.id,
            name: cat.name,
            code: cat.code,
            isInherited: cat.id !== categoryId,
          },
        }));
      }
    }

    // No defaults found anywhere in the hierarchy
    return [];
  }

  /**
   * Get all categories that use a specific component as default
   */
  async getCategoriesUsingComponent(componentId: string): Promise<CategoryComponentDefaultWithRelations[]> {
    return prisma.category_component_defaults.findMany({
      where: { componentMasterId: componentId },
      include: {
        componentMaster: true,
        productCategory: true,
      },
      orderBy: {
        productCategory: {
          name: 'asc',
        },
      },
    });
  }
}

// Export singleton instance
export const categoryComponentDefaultService = new CategoryComponentDefaultServiceClass();
