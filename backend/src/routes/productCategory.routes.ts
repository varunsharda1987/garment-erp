/**
 * Product Category Routes
 * API routes for product category management
 */

import { Router } from 'express';
import {
  createProductCategory,
  getAllProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
  getProductCategoryHierarchy,
  getProductCategoryChildren,
  getMainCategories,
  getCategoriesByLevel,
  getProductCategoryPath,
  reorderProductCategories,
  toggleProductCategoryActive,
} from '../controllers/productCategory.controller';
import {
  getDefaultComponents,
  getSuggestedComponents,
  setDefaultComponents,
  addDefaultComponent,
  updateDefaultComponent,
  removeDefaultComponent,
} from '../controllers/categoryComponentDefault.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  productCategoryQuerySchema,
  productCategoryIdParamSchema,
  reorderCategoriesSchema,
  levelParamSchema,
  categoryComponentParamSchema,
} from '../schemas/productCategory.schema';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/product-categories/hierarchy
 * @desc    Get full category hierarchy tree
 * @access  Protected - All authenticated users
 */
router.get('/hierarchy', validateQuery(productCategoryQuerySchema), asyncHandler(getProductCategoryHierarchy));

/**
 * @route   GET /api/product-categories/main
 * @desc    Get main categories (Level 1)
 * @access  Protected - All authenticated users
 */
router.get('/main', asyncHandler(getMainCategories));

/**
 * @route   GET /api/product-categories/level/:level
 * @desc    Get categories by level
 * @access  Protected - All authenticated users
 */
router.get('/level/:level', validateParams(levelParamSchema), asyncHandler(getCategoriesByLevel));

/**
 * @route   POST /api/product-categories/reorder
 * @desc    Reorder categories
 * @access  Protected - Admin only
 */
router.post(
  '/reorder',
  authorize(UserRole.ADMIN),
  validateBody(reorderCategoriesSchema),
  asyncHandler(reorderProductCategories)
);

/**
 * @route   POST /api/product-categories
 * @desc    Create new product category
 * @access  Protected - Admin only
 */
router.post(
  '/',
  authorize(UserRole.ADMIN),
  validateBody(createProductCategorySchema),
  asyncHandler(createProductCategory)
);

/**
 * @route   GET /api/product-categories
 * @desc    Get all product categories (paginated, searchable, filterable)
 * @access  Protected - All authenticated users
 */
router.get('/', validateQuery(productCategoryQuerySchema), asyncHandler(getAllProductCategories));

/**
 * @route   GET /api/product-categories/:id
 * @desc    Get product category by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', validateParams(productCategoryIdParamSchema), asyncHandler(getProductCategoryById));

/**
 * @route   GET /api/product-categories/:id/children
 * @desc    Get children of a category
 * @access  Protected - All authenticated users
 */
router.get('/:id/children', validateParams(productCategoryIdParamSchema), asyncHandler(getProductCategoryChildren));

/**
 * @route   GET /api/product-categories/:id/path
 * @desc    Get path from root to category
 * @access  Protected - All authenticated users
 */
router.get('/:id/path', validateParams(productCategoryIdParamSchema), asyncHandler(getProductCategoryPath));

/**
 * @route   GET /api/product-categories/:id/default-components
 * @desc    Get default components for a category
 * @access  Protected - All authenticated users
 */
router.get('/:id/default-components', validateParams(productCategoryIdParamSchema), asyncHandler(getDefaultComponents));

/**
 * @route   GET /api/product-categories/:id/suggested-components
 * @desc    Get suggested components with inheritance for a category
 * @access  Protected - All authenticated users
 */
router.get(
  '/:id/suggested-components',
  validateParams(productCategoryIdParamSchema),
  asyncHandler(getSuggestedComponents)
);

/**
 * @route   POST /api/product-categories/:id/default-components
 * @desc    Set default components for a category (bulk replace)
 * @access  Protected - Admin only
 */
router.post(
  '/:id/default-components',
  authorize(UserRole.ADMIN),
  validateParams(productCategoryIdParamSchema),
  asyncHandler(setDefaultComponents)
);

/**
 * @route   POST /api/product-categories/:id/default-components/add
 * @desc    Add a single default component to a category
 * @access  Protected - Admin only
 */
router.post(
  '/:id/default-components/add',
  authorize(UserRole.ADMIN),
  validateParams(productCategoryIdParamSchema),
  asyncHandler(addDefaultComponent)
);

/**
 * @route   PUT /api/product-categories/:categoryId/default-components/:componentId
 * @desc    Update a default component
 * @access  Protected - Admin only
 */
router.put(
  '/:categoryId/default-components/:componentId',
  authorize(UserRole.ADMIN),
  validateParams(categoryComponentParamSchema),
  asyncHandler(updateDefaultComponent)
);

/**
 * @route   DELETE /api/product-categories/:categoryId/default-components/:componentId
 * @desc    Remove a default component from a category
 * @access  Protected - Admin only
 */
router.delete(
  '/:categoryId/default-components/:componentId',
  authorize(UserRole.ADMIN),
  validateParams(categoryComponentParamSchema),
  asyncHandler(removeDefaultComponent)
);

/**
 * @route   PUT /api/product-categories/:id
 * @desc    Update product category
 * @access  Protected - Admin only
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN),
  validateParams(productCategoryIdParamSchema),
  validateBody(updateProductCategorySchema),
  asyncHandler(updateProductCategory)
);

/**
 * @route   PATCH /api/product-categories/:id/toggle-active
 * @desc    Toggle category active status
 * @access  Protected - Admin only
 */
router.patch(
  '/:id/toggle-active',
  authorize(UserRole.ADMIN),
  validateParams(productCategoryIdParamSchema),
  asyncHandler(toggleProductCategoryActive)
);

/**
 * @route   DELETE /api/product-categories/:id
 * @desc    Delete (deactivate) product category
 * @access  Protected - Admin only
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  validateParams(productCategoryIdParamSchema),
  asyncHandler(deleteProductCategory)
);

export default router;
