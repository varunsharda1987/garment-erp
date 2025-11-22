// Warehouse Controller - RESTful API endpoints for warehouse management
import { Request, Response } from 'express';
import warehouseService, { CreateWarehouseDTO, UpdateWarehouseDTO } from '../services/warehouse.service';
import { WarehouseType } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * @route GET /api/warehouses
 * @desc Get all warehouses with optional filters
 * @access Private
 */
export const getAllWarehouses = async (req: Request, res: Response) => {
  try {
    const { warehouseType, isActive, search } = req.query;

    const filters = {
      warehouseType: warehouseType as WarehouseType | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string | undefined,
    };

    const warehouses = await warehouseService.getAllWarehouses(filters);

    res.json({
      success: true,
      data: warehouses,
      count: warehouses.length,
    });
  } catch (error: any) {
    logError('Get all warehouses error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch warehouses',
    });
  }
};

/**
 * @route GET /api/warehouses/:id
 * @desc Get warehouse by ID
 * @access Private
 */
export const getWarehouseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const warehouse = await warehouseService.getWarehouseById(id);

    res.json({
      success: true,
      data: warehouse,
    });
  } catch (error: any) {
    logError('Get warehouse by ID error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch warehouse',
    });
  }
};

/**
 * @route GET /api/warehouses/code/:warehouseCode
 * @desc Get warehouse by code
 * @access Private
 */
export const getWarehouseByCode = async (req: Request, res: Response) => {
  try {
    const { warehouseCode } = req.params;

    const warehouse = await warehouseService.getWarehouseByCode(warehouseCode);

    res.json({
      success: true,
      data: warehouse,
    });
  } catch (error: any) {
    logError('Get warehouse by code error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch warehouse',
    });
  }
};

/**
 * @route POST /api/warehouses
 * @desc Create new warehouse
 * @access Private (Admin/Inventory Manager)
 */
export const createWarehouse = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const warehouseData: CreateWarehouseDTO = {
      ...req.body,
      createdById: userId,
    };

    // Validation
    if (!warehouseData.warehouseCode) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse code is required',
      });
    }

    if (!warehouseData.warehouseName) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse name is required',
      });
    }

    if (!warehouseData.warehouseType) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse type is required',
      });
    }

    const warehouse = await warehouseService.createWarehouse(warehouseData);

    res.status(201).json({
      success: true,
      message: 'Warehouse created successfully',
      data: warehouse,
    });
  } catch (error: any) {
    logError('Create warehouse error:', error);
    const statusCode = error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create warehouse',
    });
  }
};

/**
 * @route PUT /api/warehouses/:id
 * @desc Update warehouse
 * @access Private (Admin/Inventory Manager)
 */
export const updateWarehouse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: UpdateWarehouseDTO = req.body;

    const warehouse = await warehouseService.updateWarehouse(id, updateData);

    res.json({
      success: true,
      message: 'Warehouse updated successfully',
      data: warehouse,
    });
  } catch (error: any) {
    logError('Update warehouse error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update warehouse',
    });
  }
};

/**
 * @route DELETE /api/warehouses/:id
 * @desc Delete warehouse (soft delete)
 * @access Private (Admin only)
 */
export const deleteWarehouse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const warehouse = await warehouseService.deleteWarehouse(id);

    res.json({
      success: true,
      message: 'Warehouse deleted successfully',
      data: warehouse,
    });
  } catch (error: any) {
    logError('Delete warehouse error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete warehouse',
    });
  }
};

/**
 * @route GET /api/warehouses/:id/stock-summary
 * @desc Get warehouse stock summary
 * @access Private
 */
export const getWarehouseStockSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const summary = await warehouseService.getWarehouseStockSummary(id);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logError('Get warehouse stock summary error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch stock summary',
    });
  }
};

/**
 * @route GET /api/warehouses/by-type/:warehouseType
 * @desc Get active warehouses by type
 * @access Private
 */
export const getWarehousesByType = async (req: Request, res: Response) => {
  try {
    const { warehouseType } = req.params;

    const warehouses = await warehouseService.getWarehousesByType(warehouseType as WarehouseType);

    res.json({
      success: true,
      data: warehouses,
      count: warehouses.length,
    });
  } catch (error: any) {
    logError('Get warehouses by type error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch warehouses',
    });
  }
};

/**
 * @route GET /api/warehouses/generate-code/:warehouseType
 * @desc Generate next warehouse code for a type
 * @access Private
 */
export const generateWarehouseCode = async (req: Request, res: Response) => {
  try {
    const { warehouseType } = req.params;

    const code = await warehouseService.generateWarehouseCode(warehouseType as WarehouseType);

    res.json({
      success: true,
      data: { warehouseCode: code },
    });
  } catch (error: any) {
    logError('Generate warehouse code error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate warehouse code',
    });
  }
};
