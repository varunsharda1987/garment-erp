/**
 * Invoice Service
 * Business logic for invoice management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { InvoiceStatus, PaymentMethod, invoices, payments } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { gstService } from './gst.service';

// ============================================
// Types
// ============================================

export interface InvoiceItemDTO {
  styleId?: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  remarks?: string;
}

export interface CreateInvoiceDTO {
  orderId: string;
  customerId: string;
  invoiceDate?: Date;
  dueDate: Date;
  subtotal: number;
  taxAmount?: number; // Now optional - will be auto-calculated if not provided
  taxRate?: number; // Optional tax rate (defaults to 12% for garments)
  totalAmount?: number; // Now optional - will be calculated
  placeOfSupplyId?: string; // Optional place of supply override
  remarks?: string;
  createdById: string;
  items?: InvoiceItemDTO[]; // Optional line items for per-item GST
}

export interface UpdateInvoiceDTO extends Partial<Omit<CreateInvoiceDTO, 'orderId' | 'customerId' | 'createdById'>> {}

export interface RecordPaymentDTO {
  invoiceId: string;
  amount: number;
  paymentDate?: Date;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  remarks?: string;
  receivedById: string;
}

export interface InvoiceQueryOptions extends PaginationOptions {
  status?: InvoiceStatus;
  customerId?: string;
  orderId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface InvoiceSummary {
  total: number;
  pending: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

// ============================================
// Service
// ============================================

class InvoiceServiceClass extends BaseService<invoices, CreateInvoiceDTO, UpdateInvoiceDTO> {
  protected readonly modelName = 'invoices';
  protected readonly entityName = 'Invoice';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.invoices;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
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
      orders: {
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
        },
      },
      users: {
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
      payments: {
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          referenceNumber: true,
          remarks: true,
          receivedById: true,
          createdAt: true,
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' as const },
      },
      invoice_items: {
        include: {
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              hsnCode: true,
            },
          },
        },
        orderBy: { id: 'asc' as const },
      },
    };
  }

  /**
   * Generate next invoice number
   * Format: INV-YYMM-0001
   */
  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Find the latest invoice for this month
    const latestInvoice = await this.model.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: { createdAt: 'desc' as const },
    });

    let nextNumber = 1;
    if (latestInvoice) {
      // Extract number from INV-YYMM-NNNN
      const match = latestInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate invoice status based on payments
   */
  private calculateInvoiceStatus(
    totalAmount: Prisma.Decimal | number,
    paidAmount: Prisma.Decimal | number,
    dueDate: Date
  ): InvoiceStatus {
    const total = typeof totalAmount === 'number' ? totalAmount : parseFloat(totalAmount.toString());
    const paid = typeof paidAmount === 'number' ? paidAmount : parseFloat(paidAmount.toString());

    if (paid >= total) {
      return 'PAID';
    }

    if (paid > 0) {
      // Check if overdue
      if (new Date() > new Date(dueDate)) {
        return 'OVERDUE';
      }
      return 'PARTIALLY_PAID';
    }

    // No payments yet
    if (new Date() > new Date(dueDate)) {
      return 'OVERDUE';
    }

    return 'PENDING';
  }

  /**
   * Create a new invoice with optional line items
   * If items are provided, GST is calculated per-item and aggregated to header.
   * If no items, falls back to header-level GST calculation.
   */
  async createInvoice(data: CreateInvoiceDTO): Promise<invoices> {
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

      // Validate order exists
      const order = await this.prisma.orders.findUnique({
        where: { id: data.orderId },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Get company's state ID from environment variable
      const COMPANY_STATE_ID = process.env.COMPANY_STATE_ID;

      if (!COMPANY_STATE_ID) {
        throw new ValidationError('COMPANY_STATE_ID environment variable is not set');
      }

      // Determine place of supply (use provided or default to customer's billing state)
      const placeOfSupplyId = data.placeOfSupplyId || customer.billingStateId;

      if (!placeOfSupplyId) {
        throw new ValidationError('Customer must have a billing state or provide place of supply for GST calculation');
      }

      // Determine interstate status
      const isInterstate = COMPANY_STATE_ID !== placeOfSupplyId;

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Determine status (new invoice is always PENDING unless already overdue)
      const invoiceDate = data.invoiceDate || new Date();
      const status = new Date() > new Date(data.dueDate) ? 'OVERDUE' : 'PENDING';

      if (data.items && data.items.length > 0) {
        // ===== Per-item GST calculation =====
        let subtotal = 0;
        let headerCgst = 0;
        let headerSgst = 0;
        let headerIgst = 0;

        const itemsToCreate: Array<{
          id: string;
          invoiceId: string;
          styleId: string | null;
          description: string;
          hsnCode: string | null;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          gstRate: number;
          cgstRate: number;
          cgstAmount: number;
          sgstRate: number;
          sgstAmount: number;
          igstRate: number;
          igstAmount: number;
          taxAmount: number;
          remarks: string | null;
        }> = [];

        for (const item of data.items) {
          const totalPrice = item.quantity * item.unitPrice;
          subtotal += totalPrice;

          // Get HSN code: from item, or from style's hsnCode
          let hsnCode = item.hsnCode || null;
          if (!hsnCode && item.styleId) {
            const style = await this.prisma.styles.findUnique({
              where: { id: item.styleId },
              select: { hsnCode: true },
            });
            hsnCode = style?.hsnCode || null;
          }

          const gst = await gstService.calculateLineItemGST({
            lineTotal: totalPrice,
            hsnSacCode: hsnCode,
            isInterstate,
          });

          headerCgst += gst.cgstAmount;
          headerSgst += gst.sgstAmount;
          headerIgst += gst.igstAmount;

          itemsToCreate.push({
            id: randomUUID(),
            invoiceId: '', // set after invoice creation
            styleId: item.styleId || null,
            description: item.description,
            hsnCode: gst.hsnCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
            gstRate: gst.gstRate,
            cgstRate: gst.cgstRate,
            cgstAmount: gst.cgstAmount,
            sgstRate: gst.sgstRate,
            sgstAmount: gst.sgstAmount,
            igstRate: gst.igstRate,
            igstAmount: gst.igstAmount,
            taxAmount: gst.taxAmount,
            remarks: item.remarks || null,
          });
        }

        const totalTax = headerCgst + headerSgst + headerIgst;
        const totalAmount = subtotal + totalTax;
        const invoiceId = randomUUID();

        // Create invoice + items in transaction
        const invoice = await this.prisma.$transaction(async (tx) => {
          const inv = await tx.invoices.create({
            data: {
              id: invoiceId,
              invoiceNumber,
              orderId: data.orderId,
              customerId: data.customerId,
              invoiceDate,
              dueDate: data.dueDate,
              status,
              subtotal,
              taxAmount: totalTax,
              totalAmount,
              paidAmount: 0,
              balanceAmount: totalAmount,
              placeOfSupplyId,
              cgstAmount: headerCgst,
              sgstAmount: headerSgst,
              igstAmount: headerIgst,
              isInterstate,
              remarks: data.remarks,
              createdById: data.createdById,
            },
          });

          // Create line items
          await tx.invoice_items.createMany({
            data: itemsToCreate.map((item) => ({
              ...item,
              invoiceId: inv.id,
            })),
          });

          return tx.invoices.findUnique({
            where: { id: inv.id },
            include: this.getDefaultIncludes(),
          });
        });

        logInfo(`Invoice created with ${itemsToCreate.length} items: ${invoiceNumber}`, {
          isInterstate,
          cgst: headerCgst,
          sgst: headerSgst,
          igst: headerIgst,
        });
        return invoice!;
      } else {
        // ===== Header-level GST calculation (backward compatible) =====
        const taxRate = data.taxRate || 12;
        const gstCalc = await gstService.calculateGST(
          data.subtotal,
          taxRate,
          COMPANY_STATE_ID,
          placeOfSupplyId
        );

        const taxAmount = data.taxAmount !== undefined ? data.taxAmount : gstCalc.totalTax;
        const totalAmount = data.totalAmount !== undefined ? data.totalAmount : (data.subtotal + taxAmount);
        const balanceAmount = totalAmount;

        const invoice = await this.model.create({
          data: {
            id: randomUUID(),
            invoiceNumber,
            orderId: data.orderId,
            customerId: data.customerId,
            invoiceDate,
            dueDate: data.dueDate,
            status,
            subtotal: data.subtotal,
            taxAmount,
            totalAmount,
            paidAmount: 0,
            balanceAmount,
            placeOfSupplyId,
            cgstAmount: gstCalc.cgst,
            sgstAmount: gstCalc.sgst,
            igstAmount: gstCalc.igst,
            cgstRate: gstCalc.cgstRate,
            sgstRate: gstCalc.sgstRate,
            igstRate: gstCalc.igstRate,
            isInterstate: gstCalc.isInterstate,
            remarks: data.remarks,
            createdById: data.createdById,
          },
          include: this.getDefaultIncludes(),
        });

        logInfo(`Invoice created: ${invoiceNumber}`, {
          isInterstate: gstCalc.isInterstate,
          cgst: gstCalc.cgst,
          sgst: gstCalc.sgst,
          igst: gstCalc.igst,
        });
        return invoice;
      }
    } catch (error) {
      logError('Error creating invoice', { error });
      throw error;
    }
  }

  /**
   * Get all invoices with pagination and filters
   */
  async getInvoices(options: InvoiceQueryOptions): Promise<PaginatedResult<invoices>> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        customerId,
        orderId,
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

      // Order filter
      if (orderId) {
        where.orderId = orderId;
      }

      // Date range filter
      if (fromDate || toDate) {
        const invoiceDateFilter: { gte?: Date; lte?: Date } = {};
        if (fromDate) {
          invoiceDateFilter.gte = new Date(fromDate);
        }
        if (toDate) {
          invoiceDateFilter.lte = new Date(toDate);
        }
        where.invoiceDate = invoiceDateFilter;
      }

      // Execute queries
      const [invoices, total] = await Promise.all([
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
        data: invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Error fetching invoices', { error });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<invoices> {
    try {
      const invoice = await this.model.findUnique({
        where: { id },
        include: this.getDefaultIncludes(),
      });

      if (!invoice) {
        throw new NotFoundError(`${this.entityName} not found`);
      }

      return invoice;
    } catch (error) {
      logError(`Error fetching ${this.modelName} by ID`, { error });
      throw error;
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(id: string, data: UpdateInvoiceDTO): Promise<invoices> {
    try {
      // Check if invoice exists
      const existing = await this.getInvoiceById(id);

      // Recalculate balance if amounts changed
      let updateData: any = { ...data };

      if (data.totalAmount !== undefined) {
        const paidAmount = parseFloat(existing.paidAmount.toString());
        updateData.balanceAmount = data.totalAmount - paidAmount;

        // Recalculate status
        updateData.status = this.calculateInvoiceStatus(
          data.totalAmount,
          paidAmount,
          data.dueDate || existing.dueDate
        );
      }

      const invoice = await this.model.update({
        where: { id },
        data: updateData,
        include: this.getDefaultIncludes(),
      });

      logInfo(`Invoice updated: ${invoice.invoiceNumber}`);
      return invoice;
    } catch (error) {
      logError('Error updating invoice', { error });
      throw error;
    }
  }

  /**
   * Delete invoice (soft delete by setting status)
   */
  async deleteInvoice(id: string): Promise<void> {
    try {
      const invoice = await this.getInvoiceById(id);

      // Check if invoice has payments
      if (parseFloat(invoice.paidAmount.toString()) > 0) {
        throw new ValidationError('Cannot delete invoice with recorded payments');
      }

      await this.model.delete({
        where: { id },
      });

      logInfo(`Invoice deleted: ${invoice.invoiceNumber}`);
    } catch (error) {
      logError('Error deleting invoice', { error });
      throw error;
    }
  }

  /**
   * Record a payment for an invoice
   */
  async recordPayment(data: RecordPaymentDTO): Promise<payments> {
    try {
      // Get invoice
      const invoice = await this.getInvoiceById(data.invoiceId);

      // Validate payment amount
      const currentBalance = parseFloat(invoice.balanceAmount.toString());
      if (data.amount > currentBalance) {
        throw new ValidationError(
          `Payment amount (${data.amount}) exceeds balance (${currentBalance})`
        );
      }

      if (data.amount <= 0) {
        throw new ValidationError('Payment amount must be greater than 0');
      }

      // Create payment record
      const payment = await this.prisma.payments.create({
        data: {
          id: randomUUID(),
          invoiceId: data.invoiceId,
          paymentDate: data.paymentDate || new Date(),
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber,
          remarks: data.remarks,
          receivedById: data.receivedById,
        },
        include: {
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Update invoice paid amount and balance
      const newPaidAmount = parseFloat(invoice.paidAmount.toString()) + data.amount;
      const newBalanceAmount = parseFloat(invoice.totalAmount.toString()) - newPaidAmount;

      // Update invoice status
      const newStatus = this.calculateInvoiceStatus(
        invoice.totalAmount,
        newPaidAmount,
        invoice.dueDate
      );

      await this.model.update({
        where: { id: data.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
        },
      });

      logInfo(`Payment recorded for invoice ${invoice.invoiceNumber}: ${data.amount}`);
      return payment;
    } catch (error) {
      logError('Error recording payment', { error });
      throw error;
    }
  }

  /**
   * Get invoice summary statistics
   */
  async getInvoiceSummary(customerId?: string): Promise<InvoiceSummary> {
    try {
      const where: AdditionalFilters = customerId ? { customerId } : {};

      const [total, statusCounts, amounts] = await Promise.all([
        this.model.count({ where }),
        Promise.all([
          this.model.count({ where: { ...where, status: 'PENDING' } }),
          this.model.count({ where: { ...where, status: 'PARTIALLY_PAID' } }),
          this.model.count({ where: { ...where, status: 'PAID' } }),
          this.model.count({ where: { ...where, status: 'OVERDUE' } }),
        ]),
        this.model.aggregate({
          where,
          _sum: {
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
          },
        }),
      ]);

      return {
        total,
        pending: statusCounts[0],
        partiallyPaid: statusCounts[1],
        paid: statusCounts[2],
        overdue: statusCounts[3],
        totalAmount: amounts._sum.totalAmount ? parseFloat(amounts._sum.totalAmount.toString()) : 0,
        paidAmount: amounts._sum.paidAmount ? parseFloat(amounts._sum.paidAmount.toString()) : 0,
        balanceAmount: amounts._sum.balanceAmount ? parseFloat(amounts._sum.balanceAmount.toString()) : 0,
      };
    } catch (error) {
      logError('Error getting invoice summary', { error });
      throw error;
    }
  }

  /**
   * Update overdue invoices status
   * Should be called periodically (e.g., daily cron job)
   */
  async updateOverdueInvoices(): Promise<number> {
    try {
      const result = await this.model.updateMany({
        where: {
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
        },
        data: {
          status: 'OVERDUE',
        },
      });

      logInfo(`Updated ${result.count} invoices to OVERDUE status`);
      return result.count;
    } catch (error) {
      logError('Error updating overdue invoices', { error });
      throw error;
    }
  }
}

export const invoiceService = new InvoiceServiceClass();
export default InvoiceServiceClass;
