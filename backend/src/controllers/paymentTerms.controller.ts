// Payment Terms Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, UnauthorizedError } from '../errors';

/**
 * Create new payment term
 * POST /api/payment-terms
 */
export const createPaymentTerm = async (req: Request, res: Response): Promise<void> => {
  const { termCode, termName, description, daysCount, paymentSchedule, discountPercent } = req.body;

  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Check if term code already exists
  const existingTerm = await prisma.payment_terms.findFirst({
    where: { termCode, isActive: true },
  });

  if (existingTerm) {
    throw new ConflictError('Payment term code already exists');
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
};

/**
 * Get all payment terms
 * GET /api/payment-terms
 */
export const getAllPaymentTerms = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get payment term by ID
 * GET /api/payment-terms/:id
 */
export const getPaymentTermById = async (req: Request, res: Response): Promise<void> => {
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
    throw new NotFoundError('Payment term', id);
  }

  res.json({ data: paymentTerm });
};

/**
 * Update payment term
 * PUT /api/payment-terms/:id
 */
export const updatePaymentTerm = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { termCode, termName, description, daysCount, paymentSchedule, discountPercent } = req.body;

  const existingTerm = await prisma.payment_terms.findUnique({
    where: { id },
  });

  if (!existingTerm) {
    throw new NotFoundError('Payment term', id);
  }

  if (termCode !== existingTerm.termCode) {
    const codeExists = await prisma.payment_terms.findFirst({
      where: { termCode, isActive: true },
    });

    if (codeExists) {
      throw new ConflictError('Payment term code already exists');
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
};

/**
 * Delete payment term (soft delete)
 * DELETE /api/payment-terms/:id
 */
export const deletePaymentTerm = async (req: Request, res: Response): Promise<void> => {
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
    throw new NotFoundError('Payment term', id);
  }

  // Check if in use
  const inUse = paymentTerm._count.customers > 0 || paymentTerm._count.suppliers > 0;
  if (inUse) {
    throw new ConflictError(
      `Cannot delete payment term. It is used by ${paymentTerm._count.customers} customers and ${paymentTerm._count.suppliers} suppliers.`
    );
  }

  await prisma.payment_terms.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    message: 'Payment term deleted successfully',
  });
};
