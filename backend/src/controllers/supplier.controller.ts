/**
 * Supplier Management Controller
 * Handles HTTP requests and delegates business logic to SupplierService
 * Uses Redis caching for frequently-accessed supplier lists
 */

import { Request, Response } from 'express';
import { supplierService } from '../services/supplier.service';
import { cachedQuery, invalidateByPattern, cacheKeys, cacheTTL } from '../lib/cache';

/**
 * Create new supplier
 * POST /api/suppliers
 */
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  const supplier = await supplierService.createSupplier(req.body, req.user!.userId);

  // Invalidate supplier cache
  await invalidateByPattern('suppliers:*');

  res.status(201).json({
    data: supplier,
    message: 'Supplier created successfully',
  });
};

/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers
 * Cached for 5 minutes when no search/filters applied
 */
export const getAllSuppliers = async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
  const category = req.query.category as string;

  // Use cache for simple queries without search
  const useCache = !search && !rating && page === 1;
  const cacheKey = useCache ? `${cacheKeys.suppliers.all}:${limit}` : null;

  const result = cacheKey
    ? await cachedQuery(
        cacheKey,
        () =>
          supplierService.findAllWithFilters({
            page,
            limit,
            search,
            rating,
            category,
          }),
        cacheTTL.MEDIUM // 5 minutes
      )
    : await supplierService.findAllWithFilters({
        page,
        limit,
        search,
        rating,
        category,
      });

  res.status(200).json(result);
};

/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const supplier = await supplierService.findByIdOrThrow(id);

  res.status(200).json({ data: supplier });
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const supplier = await supplierService.updateSupplier(id, req.body);

  // Invalidate supplier cache
  await invalidateByPattern('suppliers:*');

  res.status(200).json({
    data: supplier,
    message: 'Supplier updated successfully',
  });
};

/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await supplierService.softDelete(id);

  // Invalidate supplier cache
  await invalidateByPattern('suppliers:*');

  res.status(200).json({
    message: 'Supplier deleted successfully',
  });
};

/**
 * Check if supplier can be deactivated
 * GET /api/suppliers/:id/can-deactivate
 */
export const canDeactivateSupplier = async (req: Request, res: Response): Promise<void> => {
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
};
