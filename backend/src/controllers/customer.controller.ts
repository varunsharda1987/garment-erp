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
    console.log('🎯 GET ALL CUSTOMERS CALLED');
    console.log('🎯 Query params:', req.query);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const type = req.query.type as string;
    const category = req.query.category as string;

    const whereClause: any = { isActive: true };
    console.log('🎯 Where clause:', whereClause);

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
    console.log('🎯 Total customers found:', totalCustomers);

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
    console.log('🎯 Customers fetched:', customers.length);
    console.log('🎯 First customer:', customers[0]?.name);

    // Debug logging
    const kasyaCustomer = customers.find(c => c.name.includes('Kasya'));
    if (kasyaCustomer) {
      console.log('🔍 BACKEND: Kasya customer brand_categories count:', kasyaCustomer.brand_categories?.length);
      console.log('🔍 BACKEND: First brand_category:', kasyaCustomer.brand_categories?.[0]);
    }

    const responseData = {
      data: customers,
      pagination: {
        page,
        limit,
        total: totalCustomers,
        totalPages: Math.ceil(totalCustomers / limit),
      },
    };

    console.log('🎯 Sending response with', customers.length, 'customers');
    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Get customers error:', error);
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

/**
 * Get all accessory presets for a customer
 * GET /api/customers/:id/accessory-presets
 */
export const getCustomerAccessoryPresets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const presets = await prisma.customer_accessories_presets.findMany({
      where: { customerId: id, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { presetName: 'asc' }],
    });

    res.status(200).json({
      data: presets,
      message: 'Accessory presets retrieved successfully',
    });
  } catch (error) {
    logError('Get accessory presets error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve accessory presets',
    });
  }
};

/**
 * Create new accessory preset for a customer
 * POST /api/customers/:id/accessory-presets
 */
export const createAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: customerId } = req.params;
    const { presetName, description, accessoryItems, isDefault } = req.body;

    // Validation
    if (!presetName || !accessoryItems) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'presetName and accessoryItems are required',
      });
      return;
    }

    // If this preset is set as default, unset other defaults
    if (isDefault) {
      await prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const preset = await prisma.customer_accessories_presets.create({
      data: {
        customerId,
        presetName,
        description,
        accessoryItems,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json({
      data: preset,
      message: 'Accessory preset created successfully',
    });
  } catch (error) {
    logError('Create accessory preset error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create accessory preset',
    });
  }
};

/**
 * Update accessory preset
 * PUT /api/customers/:id/accessory-presets/:presetId
 */
export const updateAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: customerId, presetId } = req.params;
    const { presetName, description, accessoryItems, isDefault } = req.body;

    // If this preset is set as default, unset other defaults
    if (isDefault) {
      await prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true, id: { not: presetId } },
        data: { isDefault: false },
      });
    }

    const preset = await prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: {
        presetName,
        description,
        accessoryItems,
        isDefault,
      },
    });

    res.status(200).json({
      data: preset,
      message: 'Accessory preset updated successfully',
    });
  } catch (error) {
    logError('Update accessory preset error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update accessory preset',
    });
  }
};

/**
 * Delete accessory preset
 * DELETE /api/customers/:id/accessory-presets/:presetId
 */
export const deleteAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { presetId } = req.params;

    await prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Accessory preset deleted successfully',
    });
  } catch (error) {
    logError('Delete accessory preset error', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete accessory preset',
    });
  }
};
