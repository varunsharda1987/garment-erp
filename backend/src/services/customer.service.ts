/**
 * Customer Service
 * Business logic for customer management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import {
  CustomerType,
  CustomerCategory,
  BusinessType,
  MarketType,
  MaterialType,
  customers,
  customer_accessories_presets,
} from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { Prisma } from '@prisma/client';
import { gstService } from './gst.service';

// ============================================
// Types
// ============================================

export interface CreateCustomerDTO {
  code: string;
  name: string;
  billingName?: string;
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
  // Structured Address Fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
  // Testing Requirements (FPT/GPT)
  requiresFPT?: boolean;
  requiresGPT?: boolean;
  fptBlocksProduction?: boolean;
  gptBlocksShipment?: boolean;
  fptTemplateId?: string | null;
  gptTemplateId?: string | null;
  buyerApprovesFPT?: boolean;
  buyerApprovesGPT?: boolean;
  defaultTestingLabId?: string | null;
  // Agent fields (for WHOLESALER/RETAILER categories)
  agentId?: string | null;
  agentCommissionPercent?: number | null;
}

export interface UpdateCustomerDTO extends Partial<CreateCustomerDTO> {}

export interface BrandCategoryInput {
  brandName: string;
  categories: string[];
  productCategoryIds?: string[];
}

export interface GstNumberInput {
  stateId?: string; // Optional - will be looked up from stateCode if not provided
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  billingCityId?: string;
  billingPincode?: string;
  isPrimary?: boolean;
}

export interface CustomerQueryOptions extends PaginationOptions {
  type?: CustomerType;
  category?: CustomerCategory;
}

/**
 * Accessory item structure within presets
 * Supports both PACKAGING (materialId + quantity) and LABEL (labelId + componentName + extraPercentage)
 */
export interface AccessoryItem {
  materialType: string; // 'LABEL' | 'PACKAGING'
  // For PACKAGING type
  materialId?: string | null;
  quantity?: number | null;
  usageCategory?: string;
  // For LABEL type
  labelId?: string | null;
  componentName?: string | null; // "Back Neck", "Side Seam"
  extraPercentage?: number | null; // Buffer % (default 5)
  sortOrder?: number;
}

export interface CreateAccessoryPresetDTO {
  presetName: string;
  description?: string;
  items: AccessoryItem[]; // Changed from accessoryItems to items
  isDefault?: boolean;
}

export interface UpdateAccessoryPresetDTO {
  presetName?: string;
  description?: string;
  items?: AccessoryItem[]; // Changed from accessoryItems to items
  isDefault?: boolean;
}

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
      { billingName: { contains: search, mode: 'insensitive' as const } },
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
      customer_gst_numbers: {
        include: {
          state: {
            select: {
              id: true,
              stateName: true,
              stateCode: true,
              stateType: true,
            },
          },
        },
      },
      billingState: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
          stateType: true,
        },
      },
      billingCity: {
        select: {
          id: true,
          cityName: true,
          tier: true,
        },
      },
      shippingState: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
          stateType: true,
        },
      },
      shippingCity: {
        select: {
          id: true,
          cityName: true,
          tier: true,
        },
      },
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
      agent: {
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
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
    const { brandCategories, gstNumbers, creditLimit, creditDays, agentCommissionPercent, ...customerData } = data;

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

    // Clean up optional foreign key fields - convert empty strings to null
    const cleanedData: any = { ...customerData };
    const foreignKeyFields = [
      'billingStateId',
      'billingCityId',
      'shippingStateId',
      'shippingCityId',
      'fptTemplateId',
      'gptTemplateId',
      'defaultTestingLabId',
      'paymentTermsId',
      'agentId',
    ];

    foreignKeyFields.forEach((field) => {
      if (field in cleanedData) {
        if (!cleanedData[field] || cleanedData[field] === '') {
          cleanedData[field] = null;
        }
      }
    });

    // Create customer
    const customer = await this.prisma.customers.create({
      data: {
        ...cleanedData,
        creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null,
        creditDays: creditDays ? parseInt(String(creditDays)) : null,
        agentCommissionPercent: agentCommissionPercent != null ? parseFloat(String(agentCommissionPercent)) : null,
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
    const { brandCategories, gstNumbers, creditLimit, creditDays, agentCommissionPercent, code, ...customerData } =
      data;

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

    // Clean up optional foreign key fields - convert empty strings to null
    const cleanedData: any = { ...customerData };
    const foreignKeyFields = [
      'billingStateId',
      'billingCityId',
      'shippingStateId',
      'shippingCityId',
      'fptTemplateId',
      'gptTemplateId',
      'defaultTestingLabId',
      'paymentTermsId',
      'agentId',
    ];

    foreignKeyFields.forEach((field) => {
      if (field in cleanedData) {
        if (!cleanedData[field] || cleanedData[field] === '') {
          cleanedData[field] = null;
        }
      }
    });

    // Update customer
    await this.prisma.customers.update({
      where: { id },
      data: {
        ...cleanedData,
        ...(code && { code }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null }),
        ...(creditDays !== undefined && { creditDays: creditDays ? parseInt(String(creditDays)) : null }),
        ...(agentCommissionPercent !== undefined && {
          agentCommissionPercent: agentCommissionPercent != null ? parseFloat(String(agentCommissionPercent)) : null,
        }),
      },
    });

    // Update brand categories if provided
    if (brandCategories !== undefined) {
      await this.updateBrandCategories(id, brandCategories || []);
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
  async getAccessoryPresets(customerId: string) {
    const result = await this.prisma.customer_accessories_presets.findMany({
      where: { customerId, isActive: true },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
            material: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                materialType: true,
              },
            },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { presetName: 'asc' }],
    });

    console.log(
      '[getAccessoryPresets] Packaging items with material:',
      result
        .flatMap((p) => p.items)
        .filter((i) => i.materialType === 'PACKAGING')
        .map((i) => ({
          id: i.id,
          materialId: i.materialId,
          material: i.material,
        }))
    );
    return result;
  }

  /**
   * Create accessory preset for a customer
   */
  async createAccessoryPreset(customerId: string, data: CreateAccessoryPresetDTO) {
    // Validate required fields
    if (!data.presetName || !data.items) {
      throw new ValidationError('presetName and items are required');
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
        isDefault: data.isDefault || false,
        items: {
          create: data.items.map((item, index) => ({
            materialType: item.materialType as MaterialType,
            // For PACKAGING type
            materialId: item.materialType === 'LABEL' ? null : item.materialId || null,
            quantity: item.materialType === 'LABEL' ? null : item.quantity || 1,
            usageCategory: item.usageCategory,
            // For LABEL type
            labelId: item.materialType === 'LABEL' ? item.labelId || null : null,
            componentName: item.materialType === 'LABEL' ? item.componentName || null : null,
            extraPercentage: item.materialType === 'LABEL' ? (item.extraPercentage ?? 5) : null,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update accessory preset
   */
  async updateAccessoryPreset(customerId: string, presetId: string, data: UpdateAccessoryPresetDTO) {
    // If this preset is being set as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.customer_accessories_presets.updateMany({
        where: { customerId, isDefault: true, id: { not: presetId } },
        data: { isDefault: false },
      });
    }

    // Build update data
    const updateData: any = {
      presetName: data.presetName,
      description: data.description,
      isDefault: data.isDefault,
    };

    // If items are provided, replace all items
    if (data.items !== undefined) {
      // Delete existing items and create new ones
      await this.prisma.customer_accessories_preset_items.deleteMany({
        where: { presetId },
      });

      updateData.items = {
        create: data.items.map((item, index) => ({
          materialType: item.materialType as MaterialType,
          // For PACKAGING type
          materialId: item.materialType === 'LABEL' ? null : item.materialId || null,
          quantity: item.materialType === 'LABEL' ? null : item.quantity || 1,
          usageCategory: item.usageCategory,
          // For LABEL type
          labelId: item.materialType === 'LABEL' ? item.labelId || null : null,
          componentName: item.materialType === 'LABEL' ? item.componentName || null : null,
          extraPercentage: item.materialType === 'LABEL' ? (item.extraPercentage ?? 5) : null,
          sortOrder: item.sortOrder ?? index,
        })),
      };
    }

    return this.prisma.customer_accessories_presets.update({
      where: { id: presetId },
      data: updateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get accessory preset by ID
   */
  async getAccessoryPresetById(presetId: string, customerId?: string) {
    const where: any = { id: presetId };
    if (customerId) {
      where.customerId = customerId;
    }

    return this.prisma.customer_accessories_presets.findFirst({
      where,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get default accessory preset for a customer
   */
  async getDefaultAccessoryPreset(customerId: string) {
    return this.prisma.customer_accessories_presets.findFirst({
      where: {
        customerId,
        isDefault: true,
        isActive: true,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
          },
        },
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

  /**
   * Clone accessory preset
   */
  async cloneAccessoryPreset(customerId: string, presetId: string, newPresetName: string) {
    // Get the source preset with items
    const source = await this.prisma.customer_accessories_presets.findFirst({
      where: { id: presetId, customerId },
      include: { items: true },
    });

    if (!source) {
      throw new NotFoundError('Source preset not found');
    }

    // Create clone with new name
    return this.prisma.customer_accessories_presets.create({
      data: {
        customerId,
        presetName: newPresetName,
        description: source.description ? `Copy of: ${source.description}` : `Copy of ${source.presetName}`,
        isDefault: false, // Clones are never default
        items: {
          create: source.items.map((item, index) => ({
            materialType: item.materialType,
            // For PACKAGING type
            materialId: item.materialId,
            quantity: item.quantity,
            usageCategory: item.usageCategory,
            // For LABEL type
            labelId: item.labelId,
            componentName: item.componentName,
            extraPercentage: item.extraPercentage,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            label: {
              select: {
                id: true,
                labelCode: true,
                labelName: true,
                labelCategory: true,
                labelType: true,
              },
            },
          },
        },
      },
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
      const message = validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ');
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

  /**
   * Update brand categories for a customer
   * This method handles the case where brand categories may be referenced by other entities
   * (labels, packaging, styles) and cannot be simply deleted and recreated.
   */
  private async updateBrandCategories(customerId: string, brandCategories: BrandCategoryInput[]): Promise<void> {
    // Get existing brand categories
    const existingBrandCategories = await this.prisma.brand_categories.findMany({
      where: { customerId },
      include: {
        _count: {
          select: {
            labels: true,
            packaging: true,
            styles: true,
          },
        },
      },
    });

    // Build the new brand category data
    const newBrandCategoryData = brandCategories.flatMap((bc) => {
      const productCategoryIds = bc.productCategoryIds || [];
      return bc.categories.map((cat, index) => ({
        brandName: bc.brandName,
        category: cat,
        productCategoryId: productCategoryIds[index] || null,
      }));
    });

    // Create a map of existing categories by brandName+category for quick lookup
    const existingMap = new Map<string, (typeof existingBrandCategories)[0]>();
    for (const existing of existingBrandCategories) {
      const key = `${existing.brandName}|${existing.category}`;
      existingMap.set(key, existing);
    }

    // Create a set of new category keys
    const newCategoryKeys = new Set(newBrandCategoryData.map((bc) => `${bc.brandName}|${bc.category}`));

    // Find categories to delete (not in new list and not referenced)
    const toDelete: string[] = [];
    for (const existing of existingBrandCategories) {
      const key = `${existing.brandName}|${existing.category}`;
      if (!newCategoryKeys.has(key)) {
        // Check if it's referenced
        const isReferenced = existing._count.labels > 0 || existing._count.packaging > 0 || existing._count.styles > 0;

        if (!isReferenced) {
          toDelete.push(existing.id);
        }
        // If it's referenced but not in the new list, we keep it (don't delete)
      }
    }

    // Delete unreferenced categories that are not in the new list
    if (toDelete.length > 0) {
      await this.prisma.brand_categories.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Create new categories that don't exist yet
    const toCreate = newBrandCategoryData.filter((bc) => {
      const key = `${bc.brandName}|${bc.category}`;
      return !existingMap.has(key);
    });

    if (toCreate.length > 0) {
      await this.prisma.brand_categories.createMany({
        data: toCreate.map((bc) => ({
          customerId,
          brandName: bc.brandName,
          category: bc.category,
          productCategoryId: bc.productCategoryId,
        })),
        skipDuplicates: true,
      });
    }

    // Update existing categories if productCategoryId changed
    for (const bc of newBrandCategoryData) {
      const key = `${bc.brandName}|${bc.category}`;
      const existing = existingMap.get(key);
      if (existing && existing.productCategoryId !== bc.productCategoryId) {
        await this.prisma.brand_categories.update({
          where: { id: existing.id },
          data: { productCategoryId: bc.productCategoryId },
        });
      }
    }
  }

  private async createBrandCategories(customerId: string, brandCategories: BrandCategoryInput[]): Promise<void> {
    const brandCategoryData = brandCategories.flatMap((bc) => {
      const productCategoryIds = bc.productCategoryIds || [];

      return bc.categories.map((cat, index) => ({
        customerId,
        brandName: bc.brandName,
        category: cat,
        productCategoryId: productCategoryIds[index] || null, // Link to product category if available
      }));
    });

    if (brandCategoryData.length > 0) {
      await this.prisma.brand_categories.createMany({
        data: brandCategoryData,
        skipDuplicates: true,
      });
    }
  }

  private async createGstNumbers(customerId: string, gstNumbers: GstNumberInput[]): Promise<void> {
    // Validate and prepare GST numbers
    const gstNumberData = [];

    for (const gst of gstNumbers) {
      // Validate GST number format and state code match
      const isValid = gstService.validateGSTNumber(gst.gstNumber, gst.stateCode);

      if (!isValid) {
        throw new ValidationError(
          `Invalid GST number ${gst.gstNumber}. Format is incorrect or does not match state code ${gst.stateCode}.`
        );
      }

      // Lookup stateId from stateCode if not provided
      let stateId = gst.stateId;

      if (!stateId) {
        const state = await this.prisma.indian_states.findUnique({
          where: { stateCode: gst.stateCode },
        });

        if (!state) {
          throw new ValidationError(`Invalid state code: ${gst.stateCode}`);
        }

        stateId = state.id;
      } else {
        // Validate provided stateId exists
        const state = await this.prisma.indian_states.findUnique({
          where: { id: stateId },
        });

        if (!state) {
          throw new ValidationError(`Invalid state ID: ${stateId}`);
        }

        // Verify stateId matches stateCode
        if (state.stateCode !== gst.stateCode) {
          throw new ValidationError(`State ID ${stateId} does not match state code ${gst.stateCode}`);
        }
      }

      gstNumberData.push({
        customerId,
        stateId,
        stateName: gst.stateName,
        stateCode: gst.stateCode,
        gstNumber: gst.gstNumber.toUpperCase(), // Ensure uppercase
        billingAddress: gst.billingAddress || null,
        billingCityId: gst.billingCityId || null,
        billingPincode: gst.billingPincode || null,
        isPrimary: gst.isPrimary || false,
      });
    }

    if (gstNumberData.length > 0) {
      await this.prisma.customer_gst_numbers.createMany({
        data: gstNumberData,
        skipDuplicates: true,
      });

      logDebug(`Created ${gstNumberData.length} GST numbers for customer ${customerId}`);
    }
  }
}

// Export singleton instance
export const customerService = new CustomerServiceClass();
