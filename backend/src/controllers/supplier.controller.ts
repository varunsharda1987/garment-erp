/**
 * Supplier Management Controller
 * Handles HTTP requests and delegates business logic to SupplierService
 */

import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplier.service';

/**
 * Create new supplier
 * POST /api/suppliers
 */
export const createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supplier = await supplierService.createSupplier(req.body, req.user!.userId);

    res.status(201).json({
      data: supplier,
      message: 'Supplier created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers
 */
export const getAllSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
    const category = req.query.category as string;

    const result = await supplierService.findAllWithFilters({
      page,
      limit,
      search,
      rating,
      category,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
export const getSupplierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await supplierService.findByIdOrThrow(id);

    res.status(200).json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
export const updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await supplierService.updateSupplier(id, req.body);

    res.status(200).json({
      data: supplier,
      message: 'Supplier updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
export const deleteSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await supplierService.softDelete(id);

    res.status(200).json({
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if supplier can be deactivated
 * GET /api/suppliers/:id/can-deactivate
 */
export const canDeactivateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validation = await supplierService.validateDeactivation(id);

    const message = validation.canDeactivate
      ? 'Supplier can be deactivated'
      : `Cannot deactivate. Please resolve: ${validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ')}`;

    res.status(200).json({
      canDeactivate: validation.canDeactivate,
      blockers: validation.blockers,
      message,
    });
  } catch (error) {
    next(error);
  }
};
