// Cost Centers Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

export const createCostCenter = async (req: Request, res: Response): Promise<void> => {
  const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;

  const existing = await prisma.cost_centers.findFirst({ where: { costCenterCode, isActive: true } });
  if (existing) {
    throw new ConflictError('Cost center code already exists');
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
      createdById: req.user!.userId,
    },
    include: {
      locations: { select: { id: true, locationCode: true, locationName: true } },
      users: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ data: costCenter, message: 'Cost center created successfully' });
};

export const getAllCostCenters = async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '20', search = '', costCenterType, locationId } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.cost_centersWhereInput = { isActive: true };

  if (search) {
    where.OR = [
      { costCenterCode: { contains: search as string, mode: 'insensitive' } },
      { costCenterName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (costCenterType) where.costCenterType = costCenterType as string;
  if (locationId) where.locationId = locationId as string;

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
};

export const getCostCenterById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const costCenter = await prisma.cost_centers.findUnique({
    where: { id },
    include: {
      locations: true,
      users: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!costCenter) {
    throw new NotFoundError('CostCenter', id);
  }

  res.json({ data: costCenter });
};

export const updateCostCenter = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;

  const existing = await prisma.cost_centers.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('CostCenter', id);
  }

  if (costCenterCode !== existing.costCenterCode) {
    const codeExists = await prisma.cost_centers.findFirst({ where: { costCenterCode, isActive: true } });
    if (codeExists) {
      throw new ConflictError('Cost center code already exists');
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
};

export const deleteCostCenter = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const costCenter = await prisma.cost_centers.findUnique({ where: { id } });

  if (!costCenter) {
    throw new NotFoundError('CostCenter', id);
  }

  await prisma.cost_centers.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Cost center deleted successfully' });
};
