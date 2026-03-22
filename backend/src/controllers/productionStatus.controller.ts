import { Request, Response } from 'express';
import { productionStatusService } from '../services/productionStatus.service';

/**
 * Get all production status items with pagination and filters
 */
export const getAllProductionStatus = async (req: Request, res: Response): Promise<void> => {
  const {
    page = '1',
    limit = '20',
    search,
    brand,
    customer,
    status,
    stage,
    cadStatus,
    orderDateFrom,
    orderDateTo,
    deliveryDateFrom,
    deliveryDateTo,
    sortBy = 'orderDate',
    sortOrder = 'desc',
  } = req.query;

  const result = await productionStatusService.getAll({
    page: parseInt(page as string, 10),
    limit: parseInt(limit as string, 10),
    search: search as string,
    brand: brand as string,
    customer: customer as string,
    status: status as 'all' | 'running' | 'completed' | 'delayed' | 'attention',
    stage: stage as any,
    cadStatus: cadStatus as any,
    orderDateFrom: orderDateFrom as string,
    orderDateTo: orderDateTo as string,
    deliveryDateFrom: deliveryDateFrom as string,
    deliveryDateTo: deliveryDateTo as string,
    sortBy: sortBy as 'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue',
    sortOrder: sortOrder as 'asc' | 'desc',
  });

  res.json({
    data: result.data,
    pagination: result.pagination,
    summary: result.summary,
  });
};

/**
 * Get production status summary
 */
export const getProductionStatusSummary = async (req: Request, res: Response): Promise<void> => {
  const summary = await productionStatusService.getSummary();

  res.json({
    data: summary,
  });
};
