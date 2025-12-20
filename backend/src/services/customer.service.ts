/**
 * Customer Service
 * Business logic for customer management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { CustomerType, CustomerCategory, BusinessType, MarketType, customers, customer_accessories_presets } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { Prisma } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface CreateCustomerDTO {
  code: string;
  name: string;
  brandNames?: string;
  categories?: string;
  brandCategories?: BrandCategoryInput[];
  gstNumbers?: GstNumberInput[];
  type: CustomerType;
  category: CustomerCategory; // Required field in Prisma schema
  businessType?: BusinessType;
  market?: MarketType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  // Testing Requirements (FPT/GPT)
  requiresFPT?: boolean;
  requiresGPT?: boolean;
  fptBlocksProduction?: boolean;
  gptBlocksShipment?: boolean;
  fptTemplateId?: string | null;
  gptTemplateId?: string | null;
  buyerApprovesGPT?: boolean;
  defaultTestingLabId?: string | null;
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {}

export interface BrandCategoryInput {
  brandName: string;
  categories: string[];
}

export interface GstNumberInput {
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary?: boolean;
}

export interface CustomerQueryOptions extends PaginationOptions {
  type?: CustomerType;
  category?: CustomerCategory;
}

/**
 * Accessory item structure within presets
 */
export interface AccessoryItem {
  materialType: string;
  materialId: string;
  quantity: number;
  usageCategory?: string;
}

export interface CreateAccessoryPresetDTO {
  presetName: string;
  description?: string;
  accessoryItems: AccessoryItem[] | Prisma.JsonValue;
  isDefault?: boolean;
}

export interface UpdateAccessoryPresetDTO extends Partial<CreateAccessoryPresetDTO> {}

// ============================================
// Service
// ============================================

class CustomerServiceClass extends BaseService<customers, CreateCustomerDTO, UpdateCustomerDTO> {
  protected readonly modelName = 'customers';
  protected readonly entityName = 'Customer';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.customers;
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
      brand_categories: true,
      customer_gst_numbers: true,
      fptTemplate: {
        select: {
          id: true,
          templateCode: true,
          templateName: true,
        },
      },
      gptTemplate: {
        select: {
          id: true,
          templateCode: true,
          templateName: true,
        },
      },
      defaultLab: {
        select: {
          id: true,
          labCode: true,
          labName: true,
        },
      },
    };
  }

  protected getListIncludes(): IncludeConfig {
    return {
      ...this.getDefaultIncludes(),
      _count: {
        select: {
          orders: true,
          quotations: true,
          invoices: true,
        },
      },
    };
  }

  // ============================================
  // Custom Methods
  // ============================================

  /**
   * Create customer with brand categories and GST numbers
   */
  async createWithRelations(data: CreateCustomerDTO, userId: string): Promise<customers> {
    const { brandCategories, gstNumbers, creditLimit, creditDays, ...customerData } = data;

    // Check if code already exists (only among active customers)
    const existing = await this.prisma.customers.findFirst({
      where: {
        code: data.code,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictError('Customer code already exists');
    }

    // Create customer
    const customer = await this.prisma.customers.create({
      data: {
        ...customerData,
        creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null,
        creditDays: creditDays ? parseInt(String(creditDays)) : null,
        createdById: userId,
      },
      include: this.getDefaultIncludes(),
    });

    // Create brand categories
    if (brandCategories?.length) {
      await this.createBrandCategories(customer.id, brandCategories);
    }

    // Create GST numbers
    if (gstNumbers?.length) {
      await this.createGstNumbers(customer.id, gstNumbers);
    }

    // Fetch complete customer
    return this.findByIdOrThrow(customer.id);
  }

  /**
   * Update customer with brand categories and GST numbers
   */
  async updateWithRelations(id: string, data: UpdateCustomerDTO): Promise<customers> {
    const { brandCategories, gstNumbers, creditLimit, creditDays, code, ...customerData } = data;

    // Check if code is being changed and if it already exists (only among active customers)
    if (code) {
      const existing = await this.prisma.customers.findFirst({
        where: {
          code,
          isActive: true,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictError('Customer code already exists');
      }
    }

    // Update customer
    await this.prisma.customers.update({
      where: { id },
      data: {
        ...customerData,
        ...(code && { code }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null }),
        ...(creditDays !== undefined && { creditDays: creditDays ? parseInt(String(creditDays)) : null }),
      },
    });

    // Update brand categories if provided
    if (brandCategories !== undefined) {
      await this.prisma.brand_categories.deleteMany({
        where: { customerId: id },
      });

      if (brandCategories?.length) {
        await this.createBrandCategories(id, brandCategories);
      }
    }

    // Update GST numbers if provided
    if (gstNumbers !== undefined) {
      await this.prisma.customer_gst_numbers.deleteMany({
        where: { customerId: id },
      });

      if (gstNumbers?.length) {
        await this.createGstNumbers(id, gstNumbers);
      }
    }

    // Fetch complete customer
    return this.findByIdOrThrow(id);
  }

  /**
   * Find all customers with additional filters
   */
  async findAllWithFilters(options: CustomerQueryOptions): Promise<PaginatedResult<customers>> {
    const additionalFilters: AdditionalFilters = {};

    if (options.type && Object.values(CustomerType).includes(options.type)) {
      additionalFilters.type = options.type;
    }

    if (options.category && Object.values(CustomerCategory).includes(options.category)) {
      additionalFilters.category = options.category;
    }

    return this.findAll(
      {
        ...options,
        sortBy: options.sortBy || 'name',
        sortOrder: options.sortOrder || 'asc',
      },
      additionalFilters
    );
  }

  // ============================================
  // Accessory Presets
  // ============================================

  /**
   * Get all accessory presets for a customer
   */
  async getAccessoryPresets(customerId: string): Promise<customer_accessories_presets[]> {
    return this.prisma.customer_accessories_presets.findMany({
      where: { customerId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { presetName: 'asc' }],
    });
  }

  /**
   * Create accessory preset for a customer
   */
  async createAccessoryPreset(customerId: string, data: CreateAccessoryPresetDTO): Promise<customer_accessories_presets> {
    // Validate required fields
    if (!data.presetName || !data.accessoryItems) {
      throw new ValidationError('presetName and accessoryItems are required');
    }

    // If this preset is default, unset other defaults
    if (data.isDefault) {
      await this.prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.customer_accessories_presets.create({
      data: {
        customerId,
        presetName: data.presetName,
        description: data.description,
        accessoryItems: data.accessoryItems as Prisma.InputJsonValue,
        isDefault: data.isDefault || false,
      },
    });
  }

  /**
   * Update accessory preset
   */
  async updateAccessoryPreset(customerId: string, presetId: string, data: UpdateAccessoryPresetDTO): Promise<customer_accessories_presets> {
    // If this preset is being set as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true, id: { not: presetId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: {
        presetName: data.presetName,
        description: data.description,
        accessoryItems: data.accessoryItems !== undefined ? (data.accessoryItems as Prisma.InputJsonValue) : undefined,
        isDefault: data.isDefault,
      },
    });
  }

  /**
   * Delete accessory preset (soft delete)
   */
  async deleteAccessoryPreset(presetId: string): Promise<void> {
    await this.prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: { isActive: false },
    });
  }

  // ============================================
  // Deactivation Validation
  // ============================================

  /**
   * Validate if a customer can be deactivated
   * Checks for active dependencies that would block deactivation
   */
  async validateDeactivation(customerId: string): Promise<{
    canDeactivate: boolean;
    blockers: { type: string; count: number }[];
  }> {
    const blockers: { type: string; count: number }[] = [];

    // 1. Active Orders (not completed/cancelled/dispatched)
    const activeOrders = await this.prisma.orders.count({
      where: {
        customerId,
        isActive: true,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DISPATCHED'] },
      },
    });
    if (activeOrders > 0) {
      blockers.push({ type: 'Active Orders', count: activeOrders });
    }

    // 2. Unpaid Invoices (not fully paid)
    const unpaidInvoices = await this.prisma.invoices.count({
      where: {
        customerId,
        status: { not: 'PAID' },
      },
    });
    if (unpaidInvoices > 0) {
      blockers.push({ type: 'Unpaid Invoices', count: unpaidInvoices });
    }

    // 3. Pending Samples (not approved or rejected)
    const pendingSamples = await this.prisma.samples.count({
      where: {
        customerId,
        isActive: true,
        status: { notIn: ['APPROVED', 'REJECTED'] },
      },
    });
    if (pendingSamples > 0) {
      blockers.push({ type: 'Pending Samples', count: pendingSamples });
    }

    // 4. Active Quotations (draft or sent, not accepted/rejected)
    const activeQuotations = await this.prisma.quotations.count({
      where: {
        customerId,
        isActive: true,
        status: { in: ['DRAFT', 'SENT'] },
      },
    });
    if (activeQuotations > 0) {
      blockers.push({ type: 'Active Quotations', count: activeQuotations });
    }

    return { canDeactivate: blockers.length === 0, blockers };
  }

  /**
   * Override softDelete to add validation before deactivation
   */
  async softDelete(id: string): Promise<void> {
    // Verify customer exists
    await this.findByIdOrThrow(id);

    // Validate deactivation
    const validation = await this.validateDeactivation(id);
    if (!validation.canDeactivate) {
      const message = validation.blockers
        .map((b) => `${b.count} ${b.type}`)
        .join(', ');
      throw new ValidationError(`Cannot deactivate customer. Active dependencies: ${message}`);
    }

    // Proceed with soft delete
    await this.prisma.customers.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Customer deactivated successfully', { id });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async createBrandCategories(customerId: string, brandCategories: BrandCategoryInput[]): Promise<void> {
    const brandCategoryData = brandCategories.flatMap((bc) =>
      bc.categories.map((cat) => ({
        customerId,
        brandName: bc.brandName,
        category: cat,
      }))
    );

    if (brandCategoryData.length > 0) {
      await this.prisma.brand_categories.createMany({
        data: brandCategoryData,
        skipDuplicates: true,
      });
    }
  }

  private async createGstNumbers(customerId: string, gstNumbers: GstNumberInput[]): Promise<void> {
    const gstNumberData = gstNumbers.map((gst) => ({
      customerId,
      stateName: gst.stateName,
      stateCode: gst.stateCode,
      gstNumber: gst.gstNumber,
      billingAddress: gst.billingAddress || null,
      isPrimary: gst.isPrimary || false,
    }));

    if (gstNumberData.length > 0) {
      await this.prisma.customer_gst_numbers.createMany({
        data: gstNumberData,
        skipDuplicates: true,
      });
    }
  }
}

// Export singleton instance
export const customerService = new CustomerServiceClass();
