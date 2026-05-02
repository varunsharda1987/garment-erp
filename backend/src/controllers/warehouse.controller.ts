// Warehouse Controller - RESTful API endpoints for warehouse management
import { Request, Response } from 'express';
import warehouseService, { CreateWarehouseDTO, UpdateWarehouseDTO } from '../services/warehouse.service';
import { WarehouseType } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

/**
 * @route GET /api/warehouses
 * @desc Get all warehouses with optional filters
 * @access Private
 */
export const getAllWarehouses = async (req: Request, res: Response) => {
  const { warehouseType, isActive, search } = (req.validatedQuery || req.query) as {
    warehouseType?: WarehouseType;
    isActive?: boolean;
    search?: string;
  };

  const filters = {
    warehouseType,
    isActive,
    search,
  };

  const warehouses = await warehouseService.getAllWarehouses(filters);

  res.json({
    success: true,
    data: warehouses,
    count: warehouses.length,
  });
};

/**
 * @route GET /api/warehouses/:id
 * @desc Get warehouse by ID
 * @access Private
 */
export const getWarehouseById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const warehouse = await warehouseService.getWarehouseById(id);

  res.json({
    success: true,
    data: warehouse,
  });
};

/**
 * @route GET /api/warehouses/code/:warehouseCode
 * @desc Get warehouse by code
 * @access Private
 */
export const getWarehouseByCode = async (req: Request, res: Response) => {
  const { warehouseCode } = req.params;

  const warehouse = await warehouseService.getWarehouseByCode(warehouseCode);

  res.json({
    success: true,
    data: warehouse,
  });
};

/**
 * @route POST /api/warehouses
 * @desc Create new warehouse
 * @access Private (Admin/Inventory Manager)
 */
export const createWarehouse = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const warehouseData: CreateWarehouseDTO = {
    ...req.body,
    createdById: userId,
  };

  // Validation
  if (!warehouseData.warehouseCode) {
    throw new ValidationError('Warehouse code is required');
  }

  if (!warehouseData.warehouseName) {
    throw new ValidationError('Warehouse name is required');
  }

  if (!warehouseData.warehouseType) {
    throw new ValidationError('Warehouse type is required');
  }

  const warehouse = await warehouseService.createWarehouse(warehouseData);

  res.status(201).json({
    success: true,
    message: 'Warehouse created successfully',
    data: warehouse,
  });
};

/**
 * @route PUT /api/warehouses/:id
 * @desc Update warehouse
 * @access Private (Admin/Inventory Manager)
 */
export const updateWarehouse = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData: UpdateWarehouseDTO = req.body;

  const warehouse = await warehouseService.updateWarehouse(id, updateData);

  res.json({
    success: true,
    message: 'Warehouse updated successfully',
    data: warehouse,
  });
};

/**
 * @route DELETE /api/warehouses/:id
 * @desc Delete warehouse (soft delete)
 * @access Private (Admin only)
 */
export const deleteWarehouse = async (req: Request, res: Response) => {
  const { id } = req.params;

  const warehouse = await warehouseService.deleteWarehouse(id);

  res.json({
    success: true,
    message: 'Warehouse deleted successfully',
    data: warehouse,
  });
};

/**
 * @route GET /api/warehouses/:id/stock-summary
 * @desc Get warehouse stock summary
 * @access Private
 */
export const getWarehouseStockSummary = async (req: Request, res: Response) => {
  const { id } = req.params;

  const summary = await warehouseService.getWarehouseStockSummary(id);

  res.json({
    success: true,
    data: summary,
  });
};

/**
 * @route GET /api/warehouses/by-type/:warehouseType
 * @desc Get active warehouses by type
 * @access Private
 */
export const getWarehousesByType = async (req: Request, res: Response) => {
  const { warehouseType } = req.params;

  const warehouses = await warehouseService.getWarehousesByType(warehouseType as WarehouseType);

  res.json({
    success: true,
    data: warehouses,
    count: warehouses.length,
  });
};

/**
 * @route GET /api/warehouses/generate-code/:warehouseType
 * @desc Generate next warehouse code for a type
 * @access Private
 */
export const generateWarehouseCode = async (req: Request, res: Response) => {
  const { warehouseType } = req.params;

  const code = await warehouseService.generateWarehouseCode(warehouseType as WarehouseType);

  res.json({
    success: true,
    data: { warehouseCode: code },
  });
};
