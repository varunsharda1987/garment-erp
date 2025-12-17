/**
 * Supplier Service
 * Business logic for supplier management
 */

import crypto from 'crypto';
import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { suppliers, Prisma, SupplierCategory } from '@prisma/client';
import { ConflictError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';

// ============================================
// Types
// ============================================

/**
 * Category-specific data for suppliers
 */
export interface SupplierCategoryData {
  [key: string]: unknown;
}

export interface CreateSupplierDTO {
  code: string;
  name: string;
  supplierCategories: SupplierCategory[]; // Required array of categories
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  rating?: number;
  categoryData?: Prisma.InputJsonValue;
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
    };
  }

  protected getListIncludes(): IncludeConfig {
    return {
      ...this.getDefaultIncludes(),
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

  // ============================================
  // Custom Methods
  // ============================================

  /**
   * Create supplier with custom ID generation
   */
  async createSupplier(data: CreateSupplierDTO, userId: string): Promise<suppliers> {
    const { creditLimit, creditDays, rating, ...supplierData } = data;

    // Check if code already exists
    const existing = await this.prisma.suppliers.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictError('Supplier code already exists');
    }

    const supplier = await this.prisma.suppliers.create({
      data: {
        id: crypto.randomUUID(),
        ...supplierData,
        creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null,
        creditDays: creditDays ? parseInt(String(creditDays)) : null,
        rating: rating ? parseInt(String(rating)) : 0,
        createdById: userId,
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Supplier created successfully', { id: supplier.id });
    return supplier;
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: string, data: UpdateSupplierDTO): Promise<suppliers> {
    const { creditLimit, creditDays, rating, code, categoryData, ...supplierData } = data;

    // Check if code is being changed and if it already exists
    if (code) {
      const existing = await this.prisma.suppliers.findFirst({
        where: {
          code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictError('Supplier code already exists');
      }
    }

    const supplier = await this.prisma.suppliers.update({
      where: { id },
      data: {
        ...supplierData,
        ...(code && { code }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ? parseFloat(String(creditLimit)) : null }),
        ...(creditDays !== undefined && { creditDays: creditDays ? parseInt(String(creditDays)) : null }),
        ...(rating !== undefined && { rating: parseInt(String(rating)) }),
        ...(categoryData !== undefined && { categoryData: categoryData as Prisma.InputJsonValue }),
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Supplier updated successfully', { id });
    return supplier;
  }

  /**
   * Find all suppliers with additional filters
   */
  async findAllWithFilters(options: SupplierQueryOptions): Promise<PaginatedResult<suppliers>> {
    const additionalFilters: AdditionalFilters = {};

    if (options.category) {
      // Use 'has' to check if the array contains the specified category
      additionalFilters.supplierCategories = { has: options.category };
    }

    if (options.rating !== undefined && !isNaN(options.rating)) {
      additionalFilters.rating = options.rating;
    }

    return this.findAll(options, additionalFilters);
  }
}

// Export singleton instance
export const supplierService = new SupplierServiceClass();
