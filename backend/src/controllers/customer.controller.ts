// Customer Management Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { CustomerType, CustomerCategory } from '@prisma/client';

/**
 * Create new customer
 * POST /api/customers
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      brandNames,
      categories,
      type,
      category,
      contactPerson,
      email,
      phone,
      billingAddress,
      shippingAddress,
      gstNumber,
      creditLimit,
      creditDays,
    } = req.body;

    // Check if customer code already exists
    const existingCustomer = await prisma.customers.findUnique({
      where: { code },
    });

    if (existingCustomer) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Customer code already exists',
      });
      return;
    }

    const customer = await prisma.customers.create({
      data: {
        code,
        name,
        brandNames,
        categories,
        type: type as CustomerType,
        category: category as CustomerCategory,
        contactPerson,
        email,
        phone,
        billingAddress,
        shippingAddress,
        gstNumber,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        creditDays: creditDays ? parseInt(creditDays) : null,
        createdById: req.user!.userId,
      },
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

    res.status(201).json({
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create customer',
    });
  }
};

/**
 * Get all customers with pagination and search
 * GET /api/customers
 */
export const getAllCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const type = req.query.type as string;
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

    // Type filter
    if (type && Object.values(CustomerType).includes(type as CustomerType)) {
      whereClause.type = type as CustomerType;
    }

    // Category filter
    if (category && Object.values(CustomerCategory).includes(category as CustomerCategory)) {
      whereClause.category = category as CustomerCategory;
    }

    const totalCustomers = await prisma.customers.count({ where: whereClause });

    const customers = await prisma.customers.findMany({
      where: whereClause,
      skip,
      take: limit,
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
            orders: true,
            quotations: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      data: customers,
      pagination: {
        page,
        limit,
        total: totalCustomers,
        totalPages: Math.ceil(totalCustomers / limit),
      },
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch customers',
    });
  }
};

/**
 * Get customer by ID
 * GET /api/customers/:id
 */
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await prisma.customers.findUnique({
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
            orders: true,
            quotations: true,
            invoices: true,
          },
        },
      },
    });

    if (!customer) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Customer not found',
      });
      return;
    }

    res.status(200).json({ data: customer });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch customer',
    });
  }
};

/**
 * Update customer
 * PUT /api/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      brandNames,
      categories,
      type,
      category,
      contactPerson,
      email,
      phone,
      billingAddress,
      shippingAddress,
      gstNumber,
      creditLimit,
      creditDays,
    } = req.body;

    // Check if customer code is being changed and if it already exists
    if (code) {
      const existingCustomer = await prisma.customers.findFirst({
        where: {
          code,
          NOT: { id },
        },
      });

      if (existingCustomer) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Customer code already exists',
        });
        return;
      }
    }

    const customer = await prisma.customers.update({
      where: { id },
      data: {
        code,
        name,
        brandNames,
        categories,
        type: type as CustomerType,
        category: category as CustomerCategory,
        contactPerson,
        email,
        phone,
        billingAddress,
        shippingAddress,
        gstNumber,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        creditDays: creditDays ? parseInt(creditDays) : null,
      },
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

    res.status(200).json({
      data: customer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update customer',
    });
  }
};

/**
 * Delete customer (soft delete)
 * DELETE /api/customers/:id
 */
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.customers.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete customer',
    });
  }
};
