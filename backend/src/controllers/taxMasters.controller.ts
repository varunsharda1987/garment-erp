// Tax Masters Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { TaxType, Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create new tax
 * POST /api/tax-masters
 */
export const createTax = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      taxCode,
      taxName,
      taxType,
      taxRate,
      hsnSacCode,
      description,
      applicableFrom,
      applicableTo,
    } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Check if tax code already exists
    const existingTax = await prisma.tax_masters.findUnique({
      where: { taxCode },
    });

    if (existingTax) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Tax code already exists',
      });
      return;
    }

    const tax = await prisma.tax_masters.create({
      data: {
        taxCode,
        taxName,
        taxType: taxType as TaxType,
        taxRate: parseFloat(taxRate),
        hsnSacCode: hsnSacCode || null,
        description: description || null,
        applicableFrom: new Date(applicableFrom),
        applicableTo: applicableTo ? new Date(applicableTo) : null,
        isActive: true,
        createdById: userId,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({
      data: tax,
      message: 'Tax created successfully',
    });
  } catch (error) {
    logError('Create tax error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create tax',
    });
  }
};

/**
 * Get all taxes with pagination, search, and filters
 * GET /api/tax-masters
 */
export const getAllTaxes = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      taxType,
      activeOnly = 'true',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.tax_mastersWhereInput = {};

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { taxCode: { contains: search as string, mode: 'insensitive' } },
        { taxName: { contains: search as string, mode: 'insensitive' } },
        { hsnSacCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (taxType) {
      where.taxType = taxType as TaxType;
    }

    const [taxes, total] = await Promise.all([
      prisma.tax_masters.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { taxCode: 'asc' },
        include: {
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.tax_masters.count({ where }),
    ]);

    res.json({
      data: taxes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logError('Get taxes error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch taxes',
    });
  }
};

/**
 * Get applicable taxes for a date
 * GET /api/tax-masters/applicable
 */
export const getApplicableTaxes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, taxType } = req.query;

    const checkDate = date ? new Date(date as string) : new Date();

    const where: Prisma.tax_mastersWhereInput = {
      isActive: true,
      applicableFrom: { lte: checkDate },
      OR: [
        { applicableTo: null },
        { applicableTo: { gte: checkDate } },
      ],
    };

    if (taxType) {
      where.taxType = taxType as TaxType;
    }

    const taxes = await prisma.tax_masters.findMany({
      where,
      orderBy: { taxCode: 'asc' },
    });

    res.json({
      data: taxes,
      message: 'Applicable taxes retrieved successfully',
    });
  } catch (error) {
    logError('Get applicable taxes error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch applicable taxes',
    });
  }
};

/**
 * Get tax by ID
 * GET /api/tax-masters/:id
 */
export const getTaxById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tax = await prisma.tax_masters.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!tax) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Tax not found',
      });
      return;
    }

    res.json({ data: tax });
  } catch (error) {
    logError('Get tax error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch tax',
    });
  }
};

/**
 * Update tax
 * PUT /api/tax-masters/:id
 */
export const updateTax = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      taxCode,
      taxName,
      taxType,
      taxRate,
      hsnSacCode,
      description,
      applicableFrom,
      applicableTo,
    } = req.body;

    // Check if tax exists
    const existingTax = await prisma.tax_masters.findUnique({
      where: { id },
    });

    if (!existingTax) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Tax not found',
      });
      return;
    }

    // Check if new tax code already exists
    if (taxCode !== existingTax.taxCode) {
      const codeExists = await prisma.tax_masters.findUnique({
        where: { taxCode },
      });

      if (codeExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Tax code already exists',
        });
        return;
      }
    }

    const tax = await prisma.tax_masters.update({
      where: { id },
      data: {
        taxCode,
        taxName,
        taxType: taxType as TaxType,
        taxRate: parseFloat(taxRate),
        hsnSacCode: hsnSacCode || null,
        description: description || null,
        applicableFrom: new Date(applicableFrom),
        applicableTo: applicableTo ? new Date(applicableTo) : null,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({
      data: tax,
      message: 'Tax updated successfully',
    });
  } catch (error) {
    logError('Update tax error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update tax',
    });
  }
};

/**
 * Delete tax (soft delete)
 * DELETE /api/tax-masters/:id
 */
export const deleteTax = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tax = await prisma.tax_masters.findUnique({
      where: { id },
    });

    if (!tax) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Tax not found',
      });
      return;
    }

    await prisma.tax_masters.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Tax deleted successfully',
    });
  } catch (error) {
    logError('Delete tax error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete tax',
    });
  }
};
