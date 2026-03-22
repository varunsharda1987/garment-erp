/**
 * Category Component Default Controller
 * Handles HTTP requests for managing default components per product category
 */

import { Request, Response, NextFunction } from 'express';
import { categoryComponentDefaultService } from '../services/categoryComponentDefault.service';

/**
 * Get default components for a product category
 * GET /api/product-categories/:id/default-components
 */
export const getDefaultComponents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const defaults = await categoryComponentDefaultService.getByProductCategoryId(id);

    res.status(200).json({ data: defaults });
  } catch (error) {
    next(error);
  }
};

/**
 * Get suggested components with inheritance for a product category
 * GET /api/product-categories/:id/suggested-components
 */
export const getSuggestedComponents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const suggestions = await categoryComponentDefaultService.getSuggestedComponentsWithInheritance(id);

    res.status(200).json({ data: suggestions });
  } catch (error) {
    next(error);
  }
};

/**
 * Set default components for a product category (bulk replace)
 * POST /api/product-categories/:id/default-components
 */
export const setDefaultComponents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { components } = req.body;

    const defaults = await categoryComponentDefaultService.setDefaultsForCategory(id, components || []);

    res.status(200).json({
      data: defaults,
      message: 'Default components updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a single default component to a product category
 * POST /api/product-categories/:id/default-components/add
 */
export const addDefaultComponent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const defaultComponent = await categoryComponentDefaultService.create({
      productCategoryId: id,
      componentMasterId: data.componentMasterId,
      isRequired: data.isRequired,
      sortOrder: data.sortOrder,
      defaultCount: data.defaultCount,
      notes: data.notes,
    });

    res.status(201).json({
      data: defaultComponent,
      message: 'Default component added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a default component
 * PUT /api/product-categories/:categoryId/default-components/:componentId
 */
export const updateDefaultComponent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { categoryId, componentId } = req.params;

    // First find the record by category and component
    const defaults = await categoryComponentDefaultService.getByProductCategoryId(categoryId);
    const existing = defaults.find((d) => d.componentMasterId === componentId);

    if (!existing) {
      res.status(404).json({ message: 'Default component not found for this category' });
      return;
    }

    const updated = await categoryComponentDefaultService.update(existing.id, req.body);

    res.status(200).json({
      data: updated,
      message: 'Default component updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a default component from a product category
 * DELETE /api/product-categories/:categoryId/default-components/:componentId
 */
export const removeDefaultComponent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { categoryId, componentId } = req.params;
    await categoryComponentDefaultService.removeByComponentAndCategory(categoryId, componentId);

    res.status(200).json({
      message: 'Default component removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all categories using a specific component
 * GET /api/component-masters/:id/categories
 */
export const getCategoriesUsingComponent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const categories = await categoryComponentDefaultService.getCategoriesUsingComponent(id);

    res.status(200).json({ data: categories });
  } catch (error) {
    next(error);
  }
};
