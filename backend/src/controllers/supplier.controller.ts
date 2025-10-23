// Supplier Management Controller
import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Create new supplier
 * POST /api/suppliers
 */
export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      supplierCategory,
      contactPerson,
      email,
      phone,
      address,
      gstNumber,
      paymentTerms,
      creditLimit,
      creditDays,
      rating,
      categoryData,
    } = req.body;

    // Check if supplier code already exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { code },
    });

    if (existingSupplier) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Supplier code already exists',
      });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name,
        supplierCategory,
        contactPerson,
        email,
        phone,
        address,
        gstNumber,
        paymentTerms,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        creditDays: creditDays ? parseInt(creditDays) : null,
        rating: rating ? parseInt(rating) : 0,
        categoryData: categoryData || null,
        createdById: req.user!.userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      data: supplier,
      message: 'Supplier created successfully',
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create supplier',
    });
  }
};

/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers
 */
export const getAllSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const rating = req.query.rating as string;
    const category = req.query.category as string;

    const whereClause: any = { isActive: true };

    // Search filter
    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      whereClause.supplierCategory = category;
    }

    // Rating filter
    if (rating) {
      const ratingValue = parseInt(rating);
      if (!isNaN(ratingValue)) {
        whereClause.rating = ratingValue;
      }
    }

    const totalSuppliers = await prisma.supplier.count({ where: whereClause });

    const suppliers = await prisma.supplier.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            materials: true,
            purchaseOrders: true,
            goodsReceivingNotes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      data: suppliers,
      pagination: {
        page,
        limit,
        total: totalSuppliers,
        totalPages: Math.ceil(totalSuppliers / limit),
      },
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch suppliers',
    });
  }
};

/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            materials: true,
            purchaseOrders: true,
            goodsReceivingNotes: true,
          },
        },
      },
    });

    if (!supplier) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Supplier not found',
      });
      return;
    }

    res.status(200).json({ data: supplier });
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch supplier',
    });
  }
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      supplierCategory,
      contactPerson,
      email,
      phone,
      address,
      gstNumber,
      paymentTerms,
      creditLimit,
      creditDays,
      rating,
      categoryData,
    } = req.body;

    // Check if supplier code is being changed and if it already exists
    if (code) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          code,
          NOT: { id },
        },
      });

      if (existingSupplier) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Supplier code already exists',
        });
        return;
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        code,
        name,
        supplierCategory,
        contactPerson,
        email,
        phone,
        address,
        gstNumber,
        paymentTerms,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        creditDays: creditDays ? parseInt(creditDays) : null,
        rating: rating !== undefined ? parseInt(rating) : undefined,
        categoryData: categoryData !== undefined ? categoryData : undefined,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      data: supplier,
      message: 'Supplier updated successfully',
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update supplier',
    });
  }
};

/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete supplier',
    });
  }
};
