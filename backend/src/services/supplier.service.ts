/**
 * Supplier Service
 * Business logic for supplier management
 */

import crypto from 'crypto';
import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { suppliers, Prisma, SupplierCategory } from '@prisma/client';
import { ConflictError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { gstService } from './gst.service';
import warehouseService from './warehouse.service';

// ============================================
// Constants
// ============================================

/**
 * Supplier categories that are processors — they receive materials/garments
 * for processing and need a JOB_WORK warehouse for stock tracking.
 */
const PROCESSOR_CATEGORIES: SupplierCategory[] = [
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
];

// ============================================
// Types
// ============================================

/**
 * Category-specific data for suppliers
 */
export interface SupplierCategoryData {
  [key: string]: unknown;
}

export interface GstNumberInput {
  stateId?: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  billingCityId?: string;
  billingPincode?: string;
  isPrimary: boolean;
}

export interface CreateSupplierDTO {
  code: string;
  name: string;
  supplierCategories: SupplierCategory[]; // Required array of categories
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  // Location fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
  shippingAddress?: string;
  // GST Numbers
  gstNumbers?: GstNumberInput[];
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  rating?: number;
  categoryData?: Prisma.InputJsonValue;
  // Bank details
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
}

export interface UpdateSupplierDTO extends Partial<CreateSupplierDTO> {}

export interface SupplierQueryOptions extends PaginationOptions {
  rating?: number;
  category?: string;
}

// ============================================
// Service
// ============================================

class SupplierServiceClass extends BaseService<suppliers, CreateSupplierDTO, UpdateSupplierDTO> {
  protected readonly modelName = 'suppliers';
  protected readonly entityName = 'Supplier';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.suppliers;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { code: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } },
      { contactPerson: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      gst_numbers: {
        include: {
          state: {
            select: {
              id: true,
              stateName: true,
              stateCode: true,
            },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      billing_state: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
        },
      },
      billing_city: {
        select: {
          id: true,
          cityName: true,
        },
      },
      shipping_state: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
        },
      },
      shipping_city: {
        select: {
          id: true,
          cityName: true,
        },
      },
      // _count included on the default (detail) includes so findById surfaces the
      // PO/Materials/GRN counts the SupplierDetail page renders (B04-07).
      _count: {
        select: {
          materialSuppliers: true,
          greigeSuppliers: true,
          fabricSuppliers: true,
          purchase_orders: true,
          goods_receiving_notes: true,
        },
      },
    };
  }

  protected getListIncludes(): IncludeConfig {
    return this.getDefaultIncludes();
  }

  // ============================================
  // Custom Methods
  // ============================================

  /**
   * Create supplier with custom ID generation and GST validation
   */
  async createSupplier(data: CreateSupplierDTO, userId: string): Promise<suppliers> {
    const { creditLimit, creditDays, rating, gstNumbers, ...supplierData } = data;

    // Check if code already exists (only among active suppliers)
    const existing = await this.prisma.suppliers.findFirst({
      where: {
        code: data.code,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictError('Supplier code already exists');
    }

    // Validate GST numbers if provided
    if (gstNumbers && gstNumbers.length > 0) {
      await this.validateGstNumbers(gstNumbers);
    }

    const supplierId = crypto.randomUUID();

    // Convert empty strings to null for optional foreign key fields
    const sanitizedData = {
      ...supplierData,
      billingStateId: supplierData.billingStateId || null,
      billingCityId: supplierData.billingCityId || null,
      shippingStateId: supplierData.shippingStateId || null,
      shippingCityId: supplierData.shippingCityId || null,
    };

    const supplier = await this.prisma.suppliers.create({
      data: {
        id: supplierId,
        ...sanitizedData,
        creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null,
        creditDays: creditDays ? parseInt(String(creditDays)) : null,
        rating: rating ? parseInt(String(rating)) : 0,
        createdById: userId,
      },
      include: this.getDefaultIncludes(),
    });

    // Create GST numbers if provided
    if (gstNumbers && gstNumbers.length > 0) {
      await this.createGstNumbers(supplierId, gstNumbers);
    }

    // Fetch supplier with GST numbers included
    const supplierWithGst = await this.prisma.suppliers.findUnique({
      where: { id: supplierId },
      include: this.getDefaultIncludes(),
    });

    // Auto-create JOB_WORK warehouse for processor suppliers
    const isProcessor = data.supplierCategories?.some((cat) => PROCESSOR_CATEGORIES.includes(cat));
    if (isProcessor) {
      try {
        const warehouseCode = await warehouseService.generateWarehouseCode('JOB_WORK');
        await warehouseService.createWarehouse({
          warehouseCode,
          warehouseName: `${data.name} - Processing Unit`,
          warehouseType: 'JOB_WORK',
          address: data.address || undefined,
          contactPerson: data.contactPerson || undefined,
          contactPhone: data.phone || undefined,
          isActive: true,
          supplierId: supplierId,
          createdById: userId,
        });
        logInfo('Auto-created JOB_WORK warehouse for processor', { supplierId, warehouseCode });
      } catch (err) {
        logError('Failed to auto-create warehouse for processor', { supplierId, error: err });
      }
    }

    logInfo('Supplier created successfully', { id: supplierId });
    return supplierWithGst!;
  }

  /**
   * Update supplier with GST validation
   */
  async updateSupplier(id: string, data: UpdateSupplierDTO): Promise<suppliers> {
    const { creditLimit, creditDays, rating, code, categoryData, gstNumbers, ...supplierData } = data;

    // Check if code is being changed and if it already exists (only among active suppliers)
    if (code) {
      const existing = await this.prisma.suppliers.findFirst({
        where: {
          code,
          isActive: true,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictError('Supplier code already exists');
      }
    }

    // Validate GST numbers if provided
    if (gstNumbers && gstNumbers.length > 0) {
      await this.validateGstNumbers(gstNumbers);
    }

    // Convert empty strings to null for optional foreign key fields
    const sanitizedData = {
      ...supplierData,
      billingStateId: supplierData.billingStateId || null,
      billingCityId: supplierData.billingCityId || null,
      shippingStateId: supplierData.shippingStateId || null,
      shippingCityId: supplierData.shippingCityId || null,
    };

    const supplier = await this.prisma.suppliers.update({
      where: { id },
      data: {
        ...sanitizedData,
        ...(code && { code }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null }),
        ...(creditDays !== undefined && { creditDays: creditDays ? parseInt(String(creditDays)) : null }),
        ...(rating !== undefined && { rating: rating != null ? parseInt(String(rating)) : 0 }),
        ...(categoryData !== undefined && { categoryData: categoryData as Prisma.InputJsonValue }),
      },
      include: this.getDefaultIncludes(),
    });

    // Update GST numbers if provided
    if (gstNumbers !== undefined) {
      // Delete existing GST numbers
      await this.prisma.supplier_gst_numbers.deleteMany({
        where: { supplierId: id },
      });

      // Create new GST numbers
      if (gstNumbers.length > 0) {
        await this.createGstNumbers(id, gstNumbers);
      }
    }

    // Fetch supplier with updated GST numbers
    const supplierWithGst = await this.prisma.suppliers.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });

    // Auto-create JOB_WORK warehouse if processor category was added and no warehouse exists
    const isProcessor = data.supplierCategories?.some((cat) => PROCESSOR_CATEGORIES.includes(cat));
    if (isProcessor) {
      const existingWarehouse = await this.prisma.warehouses.findFirst({
        where: { supplierId: id },
      });
      if (!existingWarehouse) {
        try {
          const warehouseCode = await warehouseService.generateWarehouseCode('JOB_WORK');
          const supplierName = supplierWithGst?.name || data.name || 'Unknown Processor';
          await warehouseService.createWarehouse({
            warehouseCode,
            warehouseName: `${supplierName} - Processing Unit`,
            warehouseType: 'JOB_WORK',
            isActive: true,
            supplierId: id,
            createdById: supplierWithGst?.createdById || '',
          });
          logInfo('Auto-created JOB_WORK warehouse for updated processor', { supplierId: id, warehouseCode });
        } catch (err) {
          logError('Failed to auto-create warehouse for processor', { supplierId: id, error: err });
        }
      }
    }

    logInfo('Supplier updated successfully', { id });
    return supplierWithGst!;
  }

  /**
   * Find all suppliers with additional filters
   */
  async findAllWithFilters(options: SupplierQueryOptions): Promise<PaginatedResult<suppliers>> {
    const additionalFilters: AdditionalFilters = {};

    if (options.category) {
      // PROCESSOR is a meta-category matching all processing-related suppliers
      if (options.category === 'PROCESSOR') {
        const processorCategories = [
          'DYEING_PRINTING',
          'EMBROIDERY',
          'HAND_WORK',
          'SMOCKING',
          'CMT_UNIT',
          'FINISHING_CONTRACTOR',
          'STITCHING_CONTRACTOR',
          'WASHING',
          'DORI_PIPING_CONTRACTOR',
        ];
        additionalFilters.supplierCategories = { hasSome: processorCategories };
      } else {
        // Use 'has' to check if the array contains the specified category
        additionalFilters.supplierCategories = { has: options.category };
      }
    }

    if (options.rating !== undefined && !isNaN(options.rating)) {
      additionalFilters.rating = options.rating;
    }

    return this.findAll(options, additionalFilters);
  }

  // ============================================
  // Deactivation Validation
  // ============================================

  /**
   * Validate if a supplier can be deactivated
   * Checks for active dependencies that would block deactivation
   */
  async validateDeactivation(supplierId: string): Promise<{
    canDeactivate: boolean;
    blockers: { type: string; count: number }[];
  }> {
    const blockers: { type: string; count: number }[] = [];

    // 1. Open Purchase Orders (not fully received or cancelled)
    const openPOs = await this.prisma.purchase_orders.count({
      where: {
        supplierId,
        isActive: true,
        status: { notIn: ['RECEIVED', 'CANCELLED'] },
      },
    });
    if (openPOs > 0) {
      blockers.push({ type: 'Open Purchase Orders', count: openPOs });
    }

    // 2. Pending GRNs (not accepted or rejected)
    const pendingGRNs = await this.prisma.goods_receiving_notes.count({
      where: {
        supplierId,
        status: { in: ['PENDING_QC', 'PARTIALLY_ACCEPTED'] },
      },
    });
    if (pendingGRNs > 0) {
      blockers.push({ type: 'Pending GRNs', count: pendingGRNs });
    }

    return { canDeactivate: blockers.length === 0, blockers };
  }

  /**
   * Override softDelete to add validation before deactivation
   */
  async softDelete(id: string): Promise<void> {
    // Verify supplier exists
    await this.findByIdOrThrow(id);

    // Validate deactivation
    const validation = await this.validateDeactivation(id);
    if (!validation.canDeactivate) {
      const message = validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ');
      throw new ValidationError(`Cannot deactivate supplier. Active dependencies: ${message}`);
    }

    // Proceed with soft delete
    await this.prisma.suppliers.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Supplier deactivated successfully', { id });
  }

  // ============================================
  // GST Number Management
  // ============================================

  /**
   * Validate GST numbers
   */
  private async validateGstNumbers(gstNumbers: GstNumberInput[]): Promise<void> {
    if (gstNumbers.length === 0) {
      return;
    }

    const errors: string[] = [];

    // Validate each GST number
    for (const gst of gstNumbers) {
      const isValid = gstService.validateGSTNumber(gst.gstNumber, gst.stateCode);
      if (!isValid) {
        errors.push(`Invalid GST number ${gst.gstNumber} for state code ${gst.stateCode}`);
      }
    }

    // Check for multiple primary GST numbers
    const primaryCount = gstNumbers.filter((gst) => gst.isPrimary).length;
    if (primaryCount > 1) {
      errors.push('Only one GST number can be marked as primary');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join('; '));
    }
  }

  /**
   * Create GST numbers for a supplier
   */
  private async createGstNumbers(supplierId: string, gstNumbers: GstNumberInput[]): Promise<void> {
    const gstNumberData = [];

    for (const gst of gstNumbers) {
      // Auto-lookup stateId from stateCode if not provided
      let stateId = gst.stateId;
      if (!stateId) {
        const state = await this.prisma.indian_states.findUnique({
          where: { stateCode: gst.stateCode },
        });
        if (state) {
          stateId = state.id;
        }
      }

      gstNumberData.push({
        id: crypto.randomUUID(),
        supplierId,
        stateId: stateId || null,
        stateName: gst.stateName,
        stateCode: gst.stateCode,
        gstNumber: gst.gstNumber.toUpperCase(),
        billingAddress: gst.billingAddress || null,
        billingCityId: gst.billingCityId || null,
        billingPincode: gst.billingPincode || null,
        isPrimary: gst.isPrimary,
      });
    }

    // Create all GST numbers in batch
    if (gstNumberData.length > 0) {
      await this.prisma.supplier_gst_numbers.createMany({
        data: gstNumberData,
      });
    }
  }
}

// Export singleton instance
export const supplierService = new SupplierServiceClass();
