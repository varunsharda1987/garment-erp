// Cost Centers Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

export const createCostCenter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const existing = await prisma.cost_centers.findUnique({ where: { costCenterCode } });
    if (existing) {
      res.status(400).json({ error: 'Validation Error', message: 'Cost center code already exists' });
      return;
    }

    const costCenter = await prisma.cost_centers.create({
      data: {
        costCenterCode,
        costCenterName,
        costCenterType,
        departmentId: departmentId || null,
        locationId: locationId || null,
        budgetAmount: budgetAmount ? parseFloat(budgetAmount) : null,
        description: description || null,
        isActive: true,
        createdById: userId,
      } as any,
      include: {
        locations: { select: { id: true, locationCode: true, locationName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ data: costCenter, message: 'Cost center created successfully' });
  } catch (error) {
    logError('Create cost center error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create cost center' });
  }
};

export const getAllCostCenters = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '', costCenterType, locationId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { costCenterCode: { contains: search as string, mode: 'insensitive' } },
        { costCenterName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (costCenterType) where.costCenterType = costCenterType;
    if (locationId) where.locationId = locationId;

    const [costCenters, total] = await Promise.all([
      prisma.cost_centers.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { costCenterCode: 'asc' },
        include: {
          locations: { select: { id: true, locationCode: true, locationName: true } },
        },
      }),
      prisma.cost_centers.count({ where }),
    ]);

    res.json({ data: costCenters, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    logError('Get cost centers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch cost centers' });
  }
};

export const getCostCenterById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const costCenter = await prisma.cost_centers.findUnique({
      where: { id },
      include: {
        locations: true,
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!costCenter) {
      res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
      return;
    }

    res.json({ data: costCenter });
  } catch (error) {
    logError('Get cost center error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch cost center' });
  }
};

export const updateCostCenter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;

    const existing = await prisma.cost_centers.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
      return;
    }

    if (costCenterCode !== existing.costCenterCode) {
      const codeExists = await prisma.cost_centers.findUnique({ where: { costCenterCode } });
      if (codeExists) {
        res.status(400).json({ error: 'Validation Error', message: 'Cost center code already exists' });
        return;
      }
    }

    const costCenter = await prisma.cost_centers.update({
      where: { id },
      data: {
        costCenterCode,
        costCenterName,
        costCenterType,
        departmentId: departmentId || null,
        locationId: locationId || null,
        budgetAmount: budgetAmount ? parseFloat(budgetAmount) : null,
        description: description || null,
      },
      include: { locations: true },
    });

    res.json({ data: costCenter, message: 'Cost center updated successfully' });
  } catch (error) {
    logError('Update cost center error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update cost center' });
  }
};

export const deleteCostCenter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const costCenter = await prisma.cost_centers.findUnique({ where: { id } });

    if (!costCenter) {
      res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
      return;
    }

    await prisma.cost_centers.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Cost center deleted successfully' });
  } catch (error) {
    logError('Delete cost center error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete cost center' });
  }
};
