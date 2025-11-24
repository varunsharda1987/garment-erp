// Customer Management Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { CustomerType, CustomerCategory } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

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
      brandCategories, // New format: array of {brandName, categories: []}
      gstNumbers,      // New format: array of {stateName, stateCode, gstNumber, billingAddress?, isPrimary?}
      type,
      category,
      businessType,    // B2B or B2C
      market,          // INTERNATIONAL or DOMESTIC
      contactPerson,
      email,
      phone,
      billingAddress,
      shippingAddress,
      gstNumber,       // Keep for backward compatibility
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
        brandNames,  // Keep for backward compatibility
        categories,  // Keep for backward compatibility
        type: type as CustomerType,
        category: category as CustomerCategory,
        businessType: businessType || 'B2B',
        market: market || 'DOMESTIC',
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

    // Handle brand categories if provided in new format
    if (brandCategories && Array.isArray(brandCategories)) {
      const brandCategoryData = brandCategories.flatMap((bc: any) =>
        bc.categories.map((cat: string) => ({
          customerId: customer.id,
          brandName: bc.brandName,
          category: cat,
        }))
      );

      if (brandCategoryData.length > 0) {
        await prisma.brand_categories.createMany({
          data: brandCategoryData,
          skipDuplicates: true,
        });
      }
    }

    // Handle GST numbers if provided in new format
    if (gstNumbers && Array.isArray(gstNumbers)) {
      const gstNumberData = gstNumbers.map((gst: any) => ({
        customerId: customer.id,
        stateName: gst.stateName,
        stateCode: gst.stateCode,
        gstNumber: gst.gstNumber,
        billingAddress: gst.billingAddress || null,
        isPrimary: gst.isPrimary || false,
      }));

      if (gstNumberData.length > 0) {
        await prisma.customer_gst_numbers.createMany({
          data: gstNumberData,
          skipDuplicates: true,
        });
      }
    }

    // Fetch customer with brand categories and GST numbers
    const customerWithBrands = await prisma.customers.findUnique({
      where: { id: customer.id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        brand_categories: true,
        customer_gst_numbers: true,
      },
    });

    res.status(201).json({
      data: customerWithBrands,
      message: 'Customer created successfully',
    });
  } catch (error) {
    logError('Create customer error', error);
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
        brand_categories: true,
        customer_gst_numbers: true,
        _count: {
          select: {
            orders: true,
            quotations: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        name: 'asc', // Sort alphabetically by name
      },
    });

    // Debug logging
    const kasyaCustomer = customers.find(c => c.name.includes('Kasya'));
    if (kasyaCustomer) {
      console.log('🔍 BACKEND: Kasya customer brand_categories count:', kasyaCustomer.brand_categories?.length);
      console.log('🔍 BACKEND: First brand_category:', kasyaCustomer.brand_categories?.[0]);
    }

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
    logError('Get customers error', error);
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
        brand_categories: true,
        customer_gst_numbers: true,
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
    logError('Get customer by ID error', error);
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
      brandCategories, // New format: array of {brandName, categories: []}
      gstNumbers,      // New format: array of {stateName, stateCode, gstNumber, billingAddress?, isPrimary?}
      type,
      category,
      businessType,    // B2B or B2C
      market,          // INTERNATIONAL or DOMESTIC
      contactPerson,
      email,
      phone,
      billingAddress,
      shippingAddress,
      gstNumber,       // Keep for backward compatibility
      creditLimit,
      creditDays,
    } = req.body;

    // Debug logging
    console.log('🔧 UPDATE CUSTOMER - Received brandCategories:', JSON.stringify(brandCategories, null, 2));

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
        brandNames,  // Keep for backward compatibility
        categories,  // Keep for backward compatibility
        type: type as CustomerType,
        category: category as CustomerCategory,
        businessType: businessType,
        market: market,
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

    // Handle brand categories if provided in new format
    if (brandCategories && Array.isArray(brandCategories)) {
      console.log('🔧 Processing brandCategories:', JSON.stringify(brandCategories, null, 2));

      // Delete existing brand categories for this customer
      await prisma.brand_categories.deleteMany({
        where: { customerId: id },
      });

      // Create new brand categories
      const brandCategoryData = brandCategories.flatMap((bc: any) => {
        console.log('🔧 Processing brand:', bc.brandName, 'with categories:', bc.categories);
        return bc.categories.map((cat: string) => {
          console.log('🔧 Creating record for:', bc.brandName, '/', cat);
          return {
            customerId: id,
            brandName: bc.brandName,
            category: cat,
          };
        });
      });

      console.log('🔧 Total records to create:', brandCategoryData.length);
      console.log('🔧 Records:', JSON.stringify(brandCategoryData, null, 2));

      if (brandCategoryData.length > 0) {
        const result = await prisma.brand_categories.createMany({
          data: brandCategoryData,
          skipDuplicates: true,
        });
        console.log('🔧 Created', result.count, 'brand category records');
      }
    }

    // Handle GST numbers if provided in new format
    if (gstNumbers && Array.isArray(gstNumbers)) {
      // Delete existing GST numbers for this customer
      await prisma.customer_gst_numbers.deleteMany({
        where: { customerId: id },
      });

      // Create new GST numbers
      const gstNumberData = gstNumbers.map((gst: any) => ({
        customerId: id,
        stateName: gst.stateName,
        stateCode: gst.stateCode,
        gstNumber: gst.gstNumber,
        billingAddress: gst.billingAddress || null,
        isPrimary: gst.isPrimary || false,
      }));

      if (gstNumberData.length > 0) {
        await prisma.customer_gst_numbers.createMany({
          data: gstNumberData,
          skipDuplicates: true,
        });
      }
    }

    // Fetch customer with brand categories and GST numbers
    const customerWithBrands = await prisma.customers.findUnique({
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
        brand_categories: true,
        customer_gst_numbers: true,
      },
    });

    res.status(200).json({
      data: customerWithBrands,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    logError('Update customer error', error);
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
    logError('Delete customer error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete customer',
    });
  }
};
