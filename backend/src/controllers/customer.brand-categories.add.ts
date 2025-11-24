// Add this function to customer.controller.ts

/**
 * Get brand categories for a customer
 * GET /api/customers/:id/brand-categories
 */
export const getCustomerBrandCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { brandName } = req.query;

    const whereClause: any = { customerId: id };
    if (brandName) {
      whereClause.brandName = brandName as string;
    }

    const brandCategories = await prisma.brand_categories.findMany({
      where: whereClause,
      orderBy: [
        { brandName: 'asc' },
        { category: 'asc' },
        { subCategory: 'asc' },
        { subSubCategory: 'asc' },
      ],
    });

    res.status(200).json({
      data: brandCategories,
    });
  } catch (error) {
    logError('Get customer brand categories error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch brand categories',
    });
  }
};
