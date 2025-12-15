/**
 * Product Category Controller
 * Handles HTTP requests for product category management
 */

import { Request, Response, NextFunction } from 'express';
import { productCategoryService } from '../services/productCategory.service';

/**
 * Create new product category
 * POST /api/product-categories
 */
export const createProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await productCategoryService.createCategory(req.body);

    res.status(201).json({
      data: category,
      message: 'Product category created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all product categories with pagination and filters
 * GET /api/product-categories
 */
export const getAllProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const search = req.query.search as string;
    const parentId = req.query.parentId === 'null' ? null : (req.query.parentId as string | undefined);
    const level = req.query.level ? parseInt(req.query.level as string) : undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await productCategoryService.findAllWithFilters({
      page,
      limit,
      search,
      parentId,
      level,
      isActive,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get product category by ID
 * GET /api/product-categories/:id
 */
export const getProductCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await productCategoryService.findByIdOrThrow(id);

    res.status(200).json({ data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product category
 * PUT /api/product-categories/:id
 */
export const updateProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await productCategoryService.updateCategory(id, req.body);

    res.status(200).json({
      data: category,
      message: 'Product category updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product category (soft delete)
 * DELETE /api/product-categories/:id
 */
export const deleteProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await productCategoryService.deleteCategory(id);

    res.status(200).json({
      message: 'Product category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get full category hierarchy
 * GET /api/product-categories/hierarchy
 */
export const getProductCategoryHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parentId = req.query.parentId === 'null' ? null : (req.query.parentId as string | undefined) || null;
    const hierarchy = await productCategoryService.getHierarchy(parentId);

    res.status(200).json({ data: hierarchy });
  } catch (error) {
    next(error);
  }
};

/**
 * Get children of a category
 * GET /api/product-categories/:id/children
 */
export const getProductCategoryChildren = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const children = await productCategoryService.getChildren(id);

    res.status(200).json({ data: children });
  } catch (error) {
    next(error);
  }
};

/**
 * Get main categories (Level 1)
 * GET /api/product-categories/main
 */
export const getMainCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await productCategoryService.getMainCategories();

    res.status(200).json({ data: categories });
  } catch (error) {
    next(error);
  }
};

/**
 * Get categories by level
 * GET /api/product-categories/level/:level
 */
export const getCategoriesByLevel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const level = parseInt(req.params.level);
    const categories = await productCategoryService.getCategoriesByLevel(level);

    res.status(200).json({ data: categories });
  } catch (error) {
    next(error);
  }
};

/**
 * Get path from root to a category
 * GET /api/product-categories/:id/path
 */
export const getProductCategoryPath = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const path = await productCategoryService.getCategoryPath(id);

    res.status(200).json({ data: path });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder categories
 * POST /api/product-categories/reorder
 */
export const reorderProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orders } = req.body;
    await productCategoryService.reorderCategories(orders);

    res.status(200).json({
      message: 'Categories reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle category active status
 * PATCH /api/product-categories/:id/toggle-active
 */
export const toggleProductCategoryActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await productCategoryService.toggleActive(id);

    res.status(200).json({
      data: category,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};
