// Payment Terms Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create new payment term
 * POST /api/payment-terms
 */
export const createPaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      termCode,
      termName,
      description,
      daysCount,
      paymentSchedule,
      discountPercent,
    } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Check if term code already exists
    const existingTerm = await prisma.payment_terms.findFirst({
      where: { termCode, isActive: true },
    });

    if (existingTerm) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Payment term code already exists',
      });
      return;
    }

    const paymentTerm = await prisma.payment_terms.create({
      data: {
        termCode,
        termName,
        description: description || null,
        daysCount: daysCount ? parseInt(daysCount) : null,
        paymentSchedule: paymentSchedule || null,
        discountPercent: discountPercent ? parseFloat(discountPercent) : null,
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
      data: paymentTerm,
      message: 'Payment term created successfully',
    });
  } catch (error) {
    logError('Create payment term error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create payment term',
    });
  }
};

/**
 * Get all payment terms
 * GET /api/payment-terms
 */
export const getAllPaymentTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '', activeOnly = 'true' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.payment_termsWhereInput = {};

    if (activeOnly === 'true') {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { termCode: { contains: search as string, mode: 'insensitive' } },
        { termName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [terms, total] = await Promise.all([
      prisma.payment_terms.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { termCode: 'asc' },
        include: {
          _count: {
            select: {
              customers: true,
              suppliers: true,
            },
          },
        },
      }),
      prisma.payment_terms.count({ where }),
    ]);

    res.json({
      data: terms,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logError('Get payment terms error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch payment terms',
    });
  }
};

/**
 * Get payment term by ID
 * GET /api/payment-terms/:id
 */
export const getPaymentTermById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const paymentTerm = await prisma.payment_terms.findUnique({
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
        _count: {
          select: {
            customers: true,
            suppliers: true,
          },
        },
      },
    });

    if (!paymentTerm) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Payment term not found',
      });
      return;
    }

    res.json({ data: paymentTerm });
  } catch (error) {
    logError('Get payment term error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch payment term',
    });
  }
};

/**
 * Update payment term
 * PUT /api/payment-terms/:id
 */
export const updatePaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      termCode,
      termName,
      description,
      daysCount,
      paymentSchedule,
      discountPercent,
    } = req.body;

    const existingTerm = await prisma.payment_terms.findUnique({
      where: { id },
    });

    if (!existingTerm) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Payment term not found',
      });
      return;
    }

    if (termCode !== existingTerm.termCode) {
      const codeExists = await prisma.payment_terms.findFirst({
        where: { termCode, isActive: true },
      });

      if (codeExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Payment term code already exists',
        });
        return;
      }
    }

    const paymentTerm = await prisma.payment_terms.update({
      where: { id },
      data: {
        termCode,
        termName,
        description: description || null,
        daysCount: daysCount ? parseInt(daysCount) : null,
        paymentSchedule: paymentSchedule || null,
        discountPercent: discountPercent ? parseFloat(discountPercent) : null,
      },
    });

    res.json({
      data: paymentTerm,
      message: 'Payment term updated successfully',
    });
  } catch (error) {
    logError('Update payment term error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update payment term',
    });
  }
};

/**
 * Delete payment term (soft delete)
 * DELETE /api/payment-terms/:id
 */
export const deletePaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const paymentTerm = await prisma.payment_terms.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            customers: true,
            suppliers: true,
          },
        },
      },
    });

    if (!paymentTerm) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Payment term not found',
      });
      return;
    }

    // Check if in use
    const inUse = paymentTerm._count.customers > 0 || paymentTerm._count.suppliers > 0;
    if (inUse) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Cannot delete payment term. It is used by ${paymentTerm._count.customers} customers and ${paymentTerm._count.suppliers} suppliers.`,
      });
      return;
    }

    await prisma.payment_terms.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Payment term deleted successfully',
    });
  } catch (error) {
    logError('Delete payment term error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete payment term',
    });
  }
};
