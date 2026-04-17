// Add this function to customer.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

/**
 * Get brand categories for a customer
 * GET /api/customers/:id/brand-categories
 */
export const getCustomerBrandCategories = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { brandName } = req.query;

  const whereClause: Prisma.brand_categoriesWhereInput = { customerId: id };
  if (brandName) {
    whereClause.brandName = brandName as string;
  }

  const brandCategories = await prisma.brand_categories.findMany({
    where: whereClause,
    orderBy: [{ brandName: 'asc' }, { category: 'asc' }, { subCategory: 'asc' }, { subSubCategory: 'asc' }],
  });

  res.status(200).json({
    data: brandCategories,
  });
};
