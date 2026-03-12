/**
 * Quotation Service
 * Business logic for quotation management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { QuotationStatus, quotations, quotation_items } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { gstService, GSTCalculation } from './gst.service';

// ============================================
// Types
// ============================================

export interface QuotationItemDTO {
  styleId: string;
  description?: string;
  totalQuantity: number;
  unitPrice: number;
  deliveryDays?: number;
  remarks?: string;
}

export interface CreateQuotationDTO {
  customerId: string;
  quotationDate?: Date;
  validUntil: Date;
  remarks?: string;
  termsAndConditions?: string;
  items: QuotationItemDTO[];
  createdById: string;
  // Tax Estimation Fields (optional)
  placeOfSupplyId?: string; // State for tax calculation
  includeTaxEstimate?: boolean; // Whether to calculate tax breakdown
  taxRate?: number; // Optional tax rate override (defaults to 12%)
}

export interface UpdateQuotationDTO extends Partial<Omit<CreateQuotationDTO, 'customerId' | 'createdById'>> {
  status?: QuotationStatus;
}

export interface QuotationQueryOptions extends PaginationOptions {
  status?: QuotationStatus;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface QuotationSummary {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  totalValue: number;
  acceptedValue: number;
}

// ============================================
// Service
// ============================================

class QuotationServiceClass extends BaseService<quotations, CreateQuotationDTO, UpdateQuotationDTO> {
  protected readonly modelName = 'quotations';
  protected readonly entityName = 'Quotation';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.quotations;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { quotationNumber: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
          billingName: true,
          email: true,
          phone: true,
          billingStateId: true,
        },
      },
      users_quotations_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_quotations_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      placeOfSupply: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
          stateType: true,
        },
      },
      quotation_items: {
        include: {
          styles: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      },
    };
  }

  /**
   * Generate next quotation number
   * Format: QT-YYMM-0001
   */
  async generateQuotationNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `QT-${year}${month}-`;

    // Find the latest quotation for this month
    const latestQuotation = await this.model.findFirst({
      where: {
        quotationNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { createdAt: 'desc' as const },
    });

    let nextNumber = 1;
    if (latestQuotation) {
      // Extract number from QT-YYMM-NNNN
      const match = latestQuotation.quotationNumber.match(/QT-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate total amount from items
   */
  private calculateTotalAmount(items: QuotationItemDTO[]): number {
    return items.reduce((sum, item) => {
      const itemTotal = item.totalQuantity * item.unitPrice;
      return sum + itemTotal;
    }, 0);
  }

  /**
   * Create a new quotation with items
   */
  async createQuotation(data: CreateQuotationDTO): Promise<quotations> {
    try {
      // Validate customer exists and get billing state
      const customer = await this.prisma.customers.findUnique({
        where: { id: data.customerId },
        select: {
          id: true,
          billingStateId: true,
        },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      // Validate at least one item
      if (!data.items || data.items.length === 0) {
        throw new ValidationError('Quotation must have at least one item');
      }

      // Validate all styles exist
      const styleIds = data.items.map((item) => item.styleId);
      const styles = await this.prisma.styles.findMany({
        where: { id: { in: styleIds } },
        select: { id: true },
      });

      if (styles.length !== styleIds.length) {
        throw new NotFoundError('One or more styles not found');
      }

      // Generate quotation number
      const quotationNumber = await this.generateQuotationNumber();

      // Calculate total amount (subtotal)
      const totalAmount = this.calculateTotalAmount(data.items);

      // Calculate tax estimation if requested
      let gstCalc: GSTCalculation | null = null;
      let placeOfSupplyId: string | null = null;
      let taxRate: number | null = null;
      let totalWithTax: number | null = null;

      if (data.includeTaxEstimate) {
        // Get company's state ID from environment variable
        const COMPANY_STATE_ID = process.env.COMPANY_STATE_ID;

        if (!COMPANY_STATE_ID) {
          logDebug('COMPANY_STATE_ID not set, skipping tax estimation');
        } else {
          // Determine place of supply
          placeOfSupplyId = data.placeOfSupplyId || customer.billingStateId || null;

          if (placeOfSupplyId) {
            // Calculate GST breakdown
            taxRate = data.taxRate || 12; // Default to 12% for garments
            gstCalc = await gstService.calculateGST(
              totalAmount,
              taxRate,
              COMPANY_STATE_ID,
              placeOfSupplyId
            );

            totalWithTax = totalAmount + gstCalc.totalTax;

            logDebug('Tax estimation calculated', {
              subtotal: totalAmount,
              isInterstate: gstCalc.isInterstate,
              tax: gstCalc.totalTax,
              totalWithTax,
            });
          }
        }
      }

      // Calculate per-item GST if tax estimation is enabled
      const isInterstate = placeOfSupplyId
        ? (process.env.COMPANY_STATE_ID || '') !== placeOfSupplyId
        : false;

      // Build items with GST (if estimation enabled)
      const itemsForCreate = await Promise.all(
        data.items.map(async (item) => {
          const totalPrice = item.totalQuantity * item.unitPrice;

          // Get HSN code from style
          let hsnCode: string | null = null;
          if (gstCalc && placeOfSupplyId) {
            const style = await this.prisma.styles.findUnique({
              where: { id: item.styleId },
              select: { hsnCode: true },
            });
            hsnCode = style?.hsnCode || null;
          }

          let itemGst: any = {};
          if (gstCalc && placeOfSupplyId) {
            const gstResult = await gstService.calculateLineItemGST({
              lineTotal: totalPrice,
              hsnSacCode: hsnCode,
              isInterstate,
            });
            itemGst = {
              hsnCode: gstResult.hsnCode,
              gstRate: gstResult.gstRate,
              cgstRate: gstResult.cgstRate,
              cgstAmount: gstResult.cgstAmount,
              sgstRate: gstResult.sgstRate,
              sgstAmount: gstResult.sgstAmount,
              igstRate: gstResult.igstRate,
              igstAmount: gstResult.igstAmount,
              taxAmount: gstResult.taxAmount,
            };
          }

          return {
            id: randomUUID(),
            styleId: item.styleId,
            description: item.description,
            totalQuantity: item.totalQuantity,
            unitPrice: item.unitPrice,
            totalPrice,
            deliveryDays: item.deliveryDays,
            remarks: item.remarks,
            ...itemGst,
          };
        })
      );

      // Recalculate header GST from per-item GST (more accurate)
      if (gstCalc && placeOfSupplyId) {
        const itemCgst = itemsForCreate.reduce((s, i) => s + (i.cgstAmount || 0), 0);
        const itemSgst = itemsForCreate.reduce((s, i) => s + (i.sgstAmount || 0), 0);
        const itemIgst = itemsForCreate.reduce((s, i) => s + (i.igstAmount || 0), 0);
        gstCalc.cgst = itemCgst;
        gstCalc.sgst = itemSgst;
        gstCalc.igst = itemIgst;
        gstCalc.totalTax = itemCgst + itemSgst + itemIgst;
        totalWithTax = totalAmount + gstCalc.totalTax;
      }

      // Create quotation with items
      const quotation = await this.model.create({
        data: {
          id: randomUUID(),
          quotationNumber,
          customerId: data.customerId,
          quotationDate: data.quotationDate || new Date(),
          validUntil: data.validUntil,
          status: 'DRAFT',
          totalAmount,
          remarks: data.remarks,
          termsAndConditions: data.termsAndConditions,
          createdById: data.createdById,
          // Tax Estimation Fields (optional)
          ...(placeOfSupplyId && { placeOfSupplyId }),
          ...(gstCalc && {
            estimatedCGST: gstCalc.cgst,
            estimatedSGST: gstCalc.sgst,
            estimatedIGST: gstCalc.igst,
          }),
          ...(taxRate !== null && { taxRate }),
          ...(totalWithTax !== null && { totalWithTax }),
          quotation_items: {
            create: itemsForCreate,
          },
        },
        include: this.getDefaultIncludes(),
      });

      logInfo(`Quotation created: ${quotationNumber}`, {
        subtotal: totalAmount,
        hasTaxEstimate: !!gstCalc,
      });
      return quotation;
    } catch (error) {
      logError('Error creating quotation', { error });
      throw error;
    }
  }

  /**
   * Get all quotations with pagination and filters
   */
  async getQuotations(options: QuotationQueryOptions): Promise<PaginatedResult<quotations>> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        customerId,
        fromDate,
        toDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: AdditionalFilters = {};

      // Search filter
      if (search) {
        where.OR = this.buildSearchFilter(search);
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Customer filter
      if (customerId) {
        where.customerId = customerId;
      }

      // Date range filter
      if (fromDate || toDate) {
        where.quotationDate = {} as { gte?: Date; lte?: Date };
        if (fromDate) {
          (where.quotationDate as { gte?: Date; lte?: Date }).gte = new Date(fromDate);
        }
        if (toDate) {
          (where.quotationDate as { gte?: Date; lte?: Date }).lte = new Date(toDate);
        }
      }

      // Execute queries
      const [quotations, total] = await Promise.all([
        this.model.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: this.getListIncludes(),
        }),
        this.model.count({ where }),
      ]);

      return {
        data: quotations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Error fetching quotations', { error });
      throw error;
    }
  }

  /**
   * Get quotation by ID
   */
  async getQuotationById(id: string): Promise<quotations> {
    try {
      const quotation = await this.model.findUnique({
        where: { id },
        include: this.getDefaultIncludes(),
      });

      if (!quotation) {
        throw new NotFoundError(`${this.entityName} not found`);
      }

      return quotation;
    } catch (error) {
      logError(`Error fetching ${this.modelName} by ID`, { error });
      throw error;
    }
  }

  /**
   * Update quotation
   */
  async updateQuotation(id: string, data: UpdateQuotationDTO): Promise<quotations> {
    try {
      // Check if quotation exists
      const existing = await this.getQuotationById(id);

      // Prevent modification of accepted/rejected quotations
      if (existing.status === 'ACCEPTED' || existing.status === 'REJECTED') {
        throw new ValidationError(
          `Cannot modify quotation with status ${existing.status}`
        );
      }

      // Prepare update data
      const updateData: any = { ...data };

      // If items are updated, recalculate total amount
      if (data.items && data.items.length > 0) {
        updateData.totalAmount = this.calculateTotalAmount(data.items);

        // Delete existing items and create new ones
        await this.prisma.quotation_items.deleteMany({
          where: { quotationId: id },
        });

        updateData.quotation_items = {
          create: data.items.map((item) => ({
            id: randomUUID(),
            styleId: item.styleId,
            description: item.description,
            totalQuantity: item.totalQuantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalQuantity * item.unitPrice,
            deliveryDays: item.deliveryDays,
            remarks: item.remarks,
          })),
        };
      }

      // Remove items from updateData if present (handled above)
      delete updateData.items;

      const quotation = await this.model.update({
        where: { id },
        data: updateData,
        include: this.getDefaultIncludes(),
      });

      logInfo(`Quotation updated: ${quotation.quotationNumber}`);
      return quotation;
    } catch (error) {
      logError('Error updating quotation', { error });
      throw error;
    }
  }

  /**
   * Update quotation status
   */
  async updateQuotationStatus(
    id: string,
    status: QuotationStatus,
    approvedById?: string
  ): Promise<quotations> {
    try {
      const existing = await this.getQuotationById(id);

      // Validate status transitions
      if (existing.status === 'ACCEPTED' && status !== 'ACCEPTED') {
        throw new ValidationError('Cannot change status of accepted quotation');
      }

      if (existing.status === 'REJECTED' && status !== 'REJECTED') {
        throw new ValidationError('Cannot change status of rejected quotation');
      }

      const quotation = await this.model.update({
        where: { id },
        data: {
          status,
          approvedById: status === 'ACCEPTED' ? approvedById : undefined,
        },
        include: this.getDefaultIncludes(),
      });

      logInfo(`Quotation ${quotation.quotationNumber} status updated to ${status}`);
      return quotation;
    } catch (error) {
      logError('Error updating quotation status', { error });
      throw error;
    }
  }

  /**
   * Delete quotation
   */
  async deleteQuotation(id: string): Promise<void> {
    try {
      const quotation = await this.getQuotationById(id);

      // Only allow deletion of DRAFT quotations
      if (quotation.status !== 'DRAFT') {
        throw new ValidationError(
          `Cannot delete quotation with status ${quotation.status}. Only DRAFT quotations can be deleted.`
        );
      }

      await this.model.delete({
        where: { id },
      });

      logInfo(`Quotation deleted: ${quotation.quotationNumber}`);
    } catch (error) {
      logError('Error deleting quotation', { error });
      throw error;
    }
  }

  /**
   * Get quotation summary statistics
   */
  async getQuotationSummary(customerId?: string): Promise<QuotationSummary> {
    try {
      const where: AdditionalFilters = customerId ? { customerId } : {};

      const [total, statusCounts, amounts] = await Promise.all([
        this.model.count({ where }),
        Promise.all([
          this.model.count({ where: { ...where, status: 'DRAFT' } }),
          this.model.count({ where: { ...where, status: 'SENT' } }),
          this.model.count({ where: { ...where, status: 'ACCEPTED' } }),
          this.model.count({ where: { ...where, status: 'REJECTED' } }),
          this.model.count({ where: { ...where, status: 'EXPIRED' } }),
        ]),
        this.model.aggregate({
          where,
          _sum: {
            totalAmount: true,
          },
        }),
      ]);

      // Calculate accepted quotations value
      const acceptedAmounts = await this.model.aggregate({
        where: { ...where, status: 'ACCEPTED' },
        _sum: {
          totalAmount: true,
        },
      });

      return {
        total,
        draft: statusCounts[0],
        sent: statusCounts[1],
        accepted: statusCounts[2],
        rejected: statusCounts[3],
        expired: statusCounts[4],
        totalValue: amounts._sum.totalAmount
          ? parseFloat(amounts._sum.totalAmount.toString())
          : 0,
        acceptedValue: acceptedAmounts._sum.totalAmount
          ? parseFloat(acceptedAmounts._sum.totalAmount.toString())
          : 0,
      };
    } catch (error) {
      logError('Error getting quotation summary', { error });
      throw error;
    }
  }

  /**
   * Mark expired quotations
   * Should be called periodically (e.g., daily cron job)
   */
  async markExpiredQuotations(): Promise<number> {
    try {
      const result = await this.model.updateMany({
        where: {
          status: { in: ['DRAFT', 'SENT'] },
          validUntil: { lt: new Date() },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      logInfo(`Marked ${result.count} quotations as EXPIRED`);
      return result.count;
    } catch (error) {
      logError('Error marking expired quotations', { error });
      throw error;
    }
  }

  /**
   * Estimate GST for an existing quotation
   * Can be called to add/update tax estimation for a quotation
   */
  async estimateGST(
    quotationId: string,
    placeOfSupplyId: string,
    taxRate?: number
  ): Promise<quotations> {
    try {
      // Get existing quotation with items
      const quotation = await this.prisma.quotations.findUnique({
        where: { id: quotationId },
        include: {
          quotation_items: {
            include: {
              styles: { select: { id: true, hsnCode: true } },
            },
          },
        },
      });

      if (!quotation) {
        throw new NotFoundError('Quotation not found');
      }

      // Get company's state ID from environment variable
      const COMPANY_STATE_ID = process.env.COMPANY_STATE_ID;

      if (!COMPANY_STATE_ID) {
        throw new ValidationError('COMPANY_STATE_ID environment variable is not set');
      }

      const isInterstate = COMPANY_STATE_ID !== placeOfSupplyId;
      const items = quotation.quotation_items || [];

      // Calculate per-item GST
      let headerCgst = 0;
      let headerSgst = 0;
      let headerIgst = 0;

      for (const item of items) {
        const totalPrice = parseFloat(item.totalPrice.toString());
        const hsnCode = item.styles?.hsnCode || null;

        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          hsnSacCode: hsnCode,
          isInterstate,
        });

        headerCgst += gst.cgstAmount;
        headerSgst += gst.sgstAmount;
        headerIgst += gst.igstAmount;

        // Update item with GST fields
        await this.prisma.quotation_items.update({
          where: { id: item.id },
          data: {
            hsnCode: gst.hsnCode,
            gstRate: gst.gstRate,
            cgstRate: gst.cgstRate,
            cgstAmount: gst.cgstAmount,
            sgstRate: gst.sgstRate,
            sgstAmount: gst.sgstAmount,
            igstRate: gst.igstRate,
            igstAmount: gst.igstAmount,
            taxAmount: gst.taxAmount,
          },
        });
      }

      const totalTax = headerCgst + headerSgst + headerIgst;
      const subtotal = parseFloat((quotation.totalAmount || 0).toString());
      const totalWithTax = subtotal + totalTax;

      // Update quotation header with tax estimation
      const updated = await this.model.update({
        where: { id: quotationId },
        data: {
          placeOfSupplyId,
          estimatedCGST: headerCgst,
          estimatedSGST: headerSgst,
          estimatedIGST: headerIgst,
          taxRate: taxRate || null,
          totalWithTax,
        },
        include: this.getDefaultIncludes(),
      });

      logInfo(`Tax estimated for quotation ${quotation.quotationNumber}`, {
        subtotal,
        isInterstate,
        tax: totalTax,
        totalWithTax,
      });

      return updated;
    } catch (error) {
      logError('Error estimating GST for quotation', { error });
      throw error;
    }
  }
}

export const quotationService = new QuotationServiceClass();
export default QuotationServiceClass;
