/**
 * Invoice Service
 * Business logic for invoice management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { InvoiceStatus, PaymentMethod, invoices, payments } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { gstService } from './gst.service';
import { roundToCent, multiplyCurrency, addCurrency, toCurrency } from '../utils/currency';
import { generateAtomicInvoiceNumber } from '../utils/atomicCodeGenerator';

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
  taxRate?: number; // Optional tax rate (5% for garments ≤₹2,500/piece, 18% for >₹2,500)
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
    return [{ invoiceNumber: { contains: search, mode: 'insensitive' as const } }];
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
              buyerStyleRef: true,
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
   * Generate next invoice number (INV2607-0001, ...).
   * bug-hunt financial-gst-11: the old read-max-then-create ran outside any lock, so two
   * concurrent month-start invoices minted the same number and one 500'd on the unique
   * index. The atomic sequence UPSERT cannot collide.
   */
  async generateInvoiceNumber(): Promise<string> {
    return generateAtomicInvoiceNumber();
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

      // Determine place of supply (use provided or default to customer's billing state)
      const placeOfSupplyId = data.placeOfSupplyId || customer.billingStateId;

      if (!placeOfSupplyId) {
        throw new ValidationError('Customer must have a billing state or provide place of supply for GST calculation');
      }

      // Determine interstate status via the single gstService authority (COMPANY_CONFIG.stateCode),
      // not the COMPANY_STATE_ID env-var UUID comparison (bug-hunt financial-gst-14: two config
      // sources classified the same counterparty differently across documents)
      const isInterstate = await gstService.isInterstateByStateId(placeOfSupplyId);

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Determine status (new invoice is always PENDING unless already overdue)
      const invoiceDate = data.invoiceDate || new Date();
      const status = new Date() > new Date(data.dueDate) ? 'OVERDUE' : 'PENDING';

      if (data.items && data.items.length > 0) {
        // ===== Per-item GST calculation =====
        // BUG-INV9 fix: all line item calculations use decimal.js via multiplyCurrency/roundToCent
        // to avoid floating point rounding errors (see gst.service.ts calculateLineItemGST)
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
          const totalPrice = roundToCent(multiplyCurrency(item.quantity, item.unitPrice)).toNumber();

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
            unitPrice: item.unitPrice,
          });

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

        // Header totals via the shared decimal.js aggregation of the stored per-line amounts
        // (bug-hunt financial-gst-13: raw float += accumulation drifted paise vs the items)
        const totals = gstService.calculateTotals(
          itemsToCreate.map((item) => ({
            lineTotal: item.totalPrice,
            hsnCode: item.hsnCode,
            gstRate: item.gstRate,
            cgstRate: item.cgstRate,
            cgstAmount: item.cgstAmount,
            sgstRate: item.sgstRate,
            sgstAmount: item.sgstAmount,
            igstRate: item.igstRate,
            igstAmount: item.igstAmount,
            taxAmount: item.taxAmount,
          }))
        );
        const subtotal = totals.subtotal;
        const headerCgst = totals.totalCgst;
        const headerSgst = totals.totalSgst;
        const headerIgst = totals.totalIgst;
        const totalTax = totals.totalTax;
        const totalAmount = roundToCent(addCurrency(subtotal, totalTax)).toNumber();
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
        // Base rate 5% for garments ≤₹2,500; per-item calculation (above) handles price slab properly.
        // Computed through the shared calculateLineItemGST path (single GST + interstate authority).
        const taxRate = data.taxRate || 5;
        const gstCalc = await gstService.calculateLineItemGST({
          lineTotal: data.subtotal,
          gstRateOverride: taxRate,
          isInterstate,
        });

        // bug-hunt financial-gst-9: client-supplied taxAmount/totalAmount are IGNORED — the stored
        // cgst/sgst/igst are always server-computed, so trusting client figures persisted invoices
        // where taxAmount != cgst+sgst+igst and balanceAmount seeded from the inconsistent total.
        const taxAmount = gstCalc.taxAmount;
        const totalAmount = roundToCent(addCurrency(data.subtotal, taxAmount)).toNumber();
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
            cgstAmount: gstCalc.cgstAmount,
            sgstAmount: gstCalc.sgstAmount,
            igstAmount: gstCalc.igstAmount,
            cgstRate: gstCalc.cgstRate,
            sgstRate: gstCalc.sgstRate,
            igstRate: gstCalc.igstRate,
            isInterstate,
            remarks: data.remarks,
            createdById: data.createdById,
          },
          include: this.getDefaultIncludes(),
        });

        logInfo(`Invoice created: ${invoiceNumber}`, {
          isInterstate,
          cgst: gstCalc.cgstAmount,
          sgst: gstCalc.sgstAmount,
          igst: gstCalc.igstAmount,
        });
        return invoice;
      }
    } catch (error) {
      logError('Error creating invoice', { error });
      throw error;
    }
  }

  /**
   * P7.4: Create invoice from a delivered delivery note.
   * Prefills items from DN quantities, links to saleOrderId if present.
   */
  async createFromDeliveryNote(
    deliveryNoteId: string,
    data: {
      dueDate: Date;
      invoiceDate?: Date;
      remarks?: string;
      createdById: string;
    }
  ): Promise<invoices> {
    const dn = await this.prisma.delivery_notes.findUnique({
      where: { id: deliveryNoteId },
      include: {
        delivery_note_items: {
          include: {
            styles: { select: { id: true, styleCode: true, styleName: true, hsnCode: true } },
            color_options: { select: { colorName: true } },
            size_options: { select: { sizeName: true } },
          },
        },
        customers: { select: { id: true, billingStateId: true } },
        sale_orders: { select: { id: true } },
      },
    });

    if (!dn) {
      throw new NotFoundError('Delivery Note', deliveryNoteId);
    }

    if (dn.status !== 'DELIVERED') {
      throw new ValidationError('Can only create invoice from DELIVERED delivery notes');
    }

    // Check if invoice already exists for this DN
    // Note: deliveryNoteId added in migration 20260805100000 — cast until prisma generate runs
    const existingInvoice = await this.prisma.invoices.findFirst({
      where: { deliveryNoteId } as any,
    });
    if (existingInvoice) {
      throw new ConflictError(`Invoice ${existingInvoice.invoiceNumber} already exists for this delivery note`);
    }

    // Build items from DN items (price comes from sale order item or style default)
    const items: InvoiceItemDTO[] = [];
    for (const dnItem of dn.delivery_note_items) {
      // Try to get unit price from sale order item
      let unitPrice = 0;
      if (dnItem.saleOrderItemId) {
        const soItem = await this.prisma.sale_order_items.findUnique({
          where: { id: dnItem.saleOrderItemId },
          select: { unitPrice: true },
        });
        unitPrice = soItem ? parseFloat(soItem.unitPrice.toString()) : 0;
      }

      const description = [
        dnItem.styles?.styleCode || '',
        dnItem.styles?.styleName || '',
        dnItem.color_options?.colorName ? `(${dnItem.color_options.colorName})` : '',
        dnItem.size_options?.sizeName ? `Size: ${dnItem.size_options.sizeName}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      items.push({
        styleId: dnItem.styleId,
        description,
        hsnCode: dnItem.styles?.hsnCode ?? undefined,
        quantity: dnItem.quantity,
        unitPrice,
      });
    }

    // Create invoice via the existing create method, adding deliveryNoteId + saleOrderId
    const invoiceNumber = await this.generateInvoiceNumber();
    const placeOfSupplyId = dn.customers?.billingStateId;

    if (!placeOfSupplyId) {
      throw new ValidationError('Customer must have a billing state for GST calculation');
    }

    const isInterstate = await gstService.isInterstateByStateId(placeOfSupplyId);
    const invoiceDate = data.invoiceDate || new Date();
    const status = new Date() > data.dueDate ? 'OVERDUE' : 'PENDING';

    // Build line items with GST
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

    for (const item of items) {
      const totalPrice = roundToCent(multiplyCurrency(item.quantity, item.unitPrice)).toNumber();
      const gst = await gstService.calculateLineItemGST({
        lineTotal: totalPrice,
        hsnSacCode: item.hsnCode ?? null,
        isInterstate,
        unitPrice: item.unitPrice,
      });

      itemsToCreate.push({
        id: randomUUID(),
        invoiceId: '',
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
        remarks: null,
      });
    }

    const totals = gstService.calculateTotals(
      itemsToCreate.map((item) => ({
        lineTotal: item.totalPrice,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        cgstRate: item.cgstRate,
        cgstAmount: item.cgstAmount,
        sgstRate: item.sgstRate,
        sgstAmount: item.sgstAmount,
        igstRate: item.igstRate,
        igstAmount: item.igstAmount,
        taxAmount: item.taxAmount,
      }))
    );

    const subtotal = totals.subtotal;
    const totalTax = totals.totalTax;
    const totalAmount = roundToCent(addCurrency(subtotal, totalTax)).toNumber();
    const balanceAmount = totalAmount;

    // Note: deliveryNoteId added in migration 20260805100000 — cast until prisma generate runs
    const invoiceData = {
      id: randomUUID(),
      invoiceNumber,
      orderId: dn.orderId,
      saleOrderId: dn.sale_orders?.id ?? dn.saleOrderId ?? null,
      deliveryNoteId,
      customerId: dn.customerId,
      invoiceDate,
      dueDate: data.dueDate,
      status,
      subtotal,
      taxAmount: totalTax,
      totalAmount,
      paidAmount: 0,
      balanceAmount,
      placeOfSupplyId,
      cgstAmount: totals.totalCgst,
      sgstAmount: totals.totalSgst,
      igstAmount: totals.totalIgst,
      cgstRate: itemsToCreate[0]?.cgstRate ?? 0,
      sgstRate: itemsToCreate[0]?.sgstRate ?? 0,
      igstRate: itemsToCreate[0]?.igstRate ?? 0,
      isInterstate,
      remarks: data.remarks ?? null,
      createdById: data.createdById,
      invoice_items: {
        create: itemsToCreate.map((item) => ({
          id: item.id,
          styleId: item.styleId,
          description: item.description,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          gstRate: item.gstRate,
          cgstRate: item.cgstRate,
          cgstAmount: item.cgstAmount,
          sgstRate: item.sgstRate,
          sgstAmount: item.sgstAmount,
          igstRate: item.igstRate,
          igstAmount: item.igstAmount,
          taxAmount: item.taxAmount,
          remarks: item.remarks,
        })),
      },
    };
    const invoice = await this.prisma.invoices.create({
      data: invoiceData as any,
      include: this.getDefaultIncludes(),
    });

    logInfo(`Invoice created from delivery note: ${invoiceNumber}`, {
      deliveryNoteId,
      saleOrderId: dn.saleOrderId,
      itemCount: items.length,
    });

    return invoice;
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
      // One transaction: read + recompute + write, so balance derives from the row read INSIDE the tx
      // (the old pre-read/compute/write raced with concurrent payments — the exact pattern recordPayment
      // was hardened against). All money columns are recomputed SERVER-SIDE from subtotal so the header
      // can no longer diverge from its own tax/total columns (bug-hunt financial-gst-8: the UI edit sends
      // subtotal alone, and the old code accepted each figure independently, never touching cgst/sgst/igst).
      const invoice = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.invoices.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundError(`${this.entityName} not found`);
        }

        const updateData: any = { ...data };
        const moneyTouched =
          data.subtotal !== undefined || data.taxAmount !== undefined || data.totalAmount !== undefined;

        if (moneyTouched) {
          // BUG-FIN7 fix: use decimal.js for all intermediate calculations to avoid floating point precision loss
          // Convert Prisma Decimals to numbers first for type compatibility
          const oldSubtotalNum = Number(existing.subtotal);
          const oldTaxNum = Number(existing.taxAmount);
          const oldCgstNum = Number(existing.cgstAmount);
          const oldIgstNum = Number(existing.igstAmount);
          const paidNum = Number(existing.paidAmount);

          const oldSubtotal = toCurrency(oldSubtotalNum);
          const oldTax = toCurrency(oldTaxNum);
          const newSubtotalDec = data.subtotal !== undefined ? toCurrency(data.subtotal) : oldSubtotal;
          // Preserve the invoice's effective tax rate + intra/inter-state GST split; scale to the new base.
          const effectiveRate = oldSubtotal.isZero() ? toCurrency(0) : oldTax.dividedBy(oldSubtotal);
          const newTaxDec = roundToCent(newSubtotalDec.times(effectiveRate));
          const newTotalDec = roundToCent(newSubtotalDec.plus(newTaxDec));
          const gstScale = oldTax.isZero() ? toCurrency(0) : newTaxDec.dividedBy(oldTax);
          const newCgstDec = roundToCent(toCurrency(oldCgstNum).times(gstScale));
          const newIgstDec = roundToCent(toCurrency(oldIgstNum).times(gstScale));
          // sgst takes the rounding remainder so cgst+sgst+igst always equals taxAmount exactly
          const newSgstDec = roundToCent(newTaxDec.minus(newCgstDec).minus(newIgstDec));

          // Convert to numbers only at the final step for storage
          const newSubtotal = newSubtotalDec.toNumber();
          const newTax = newTaxDec.toNumber();
          const newTotal = newTotalDec.toNumber();
          const newCgst = newCgstDec.toNumber();
          const newIgst = newIgstDec.toNumber();
          const newSgst = newSgstDec.toNumber();

          const paid = toCurrency(paidNum);
          updateData.subtotal = newSubtotal;
          updateData.taxAmount = newTax;
          updateData.totalAmount = newTotal;
          updateData.cgstAmount = newCgst;
          updateData.sgstAmount = newSgst;
          updateData.igstAmount = newIgst;
          updateData.balanceAmount = roundToCent(toCurrency(newTotal).minus(paid)).toNumber();
          updateData.status = this.calculateInvoiceStatus(newTotal, paid.toNumber(), data.dueDate || existing.dueDate);
        } else if (data.dueDate !== undefined) {
          // A due-date-only change can still flip OVERDUE ↔ PENDING/PARTIALLY_PAID
          updateData.status = this.calculateInvoiceStatus(
            Number(existing.totalAmount),
            Number(existing.paidAmount),
            data.dueDate
          );
        }

        return tx.invoices.update({
          where: { id },
          data: updateData,
          include: this.getDefaultIncludes(),
        });
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

      // Check if invoice has credit notes
      const creditNotes = await this.prisma.credit_notes.count({
        where: { invoiceId: id, status: { not: 'CANCELLED' } },
      });
      if (creditNotes > 0) {
        throw new ValidationError(
          `Cannot delete invoice with ${creditNotes} active credit note(s). Cancel them first.`
        );
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

      // BUG-PAY4 fix: use decimal.js for payment allocation precision
      // Validate payment amount using decimal.js to avoid floating point errors
      // Convert Prisma Decimal to string first for toCurrency compatibility
      const currentBalanceDec = toCurrency(invoice.balanceAmount.toString());
      const paymentAmountDec = toCurrency(data.amount);

      if (paymentAmountDec.greaterThan(currentBalanceDec)) {
        throw new ValidationError(`Payment amount (${data.amount}) exceeds balance (${currentBalanceDec.toFixed(2)})`);
      }

      if (paymentAmountDec.lessThanOrEqualTo(0)) {
        throw new ValidationError('Payment amount must be greater than 0');
      }

      // The payment insert and the invoice balance/status update MUST be atomic — otherwise the payment
      // commits while the invoice still reads unpaid (re-paid / wrongly dunned), and the old
      // read-compute-write on paidAmount silently loses concurrent payments. Wrap both in one transaction
      // and apply the balance with atomic increment/decrement so concurrent payments can't clobber each
      // other (bug-hunt T1/F4).
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return await this.prisma.$transaction(async (tx) => {
        // Duplicate guard (inside the tx to shrink the race window).
        // bug-hunt financial-gst-12: key on the natural key (referenceNumber) when present —
        // the same UTR/cheque on this invoice is a duplicate REGARDLESS of when it was keyed in,
        // while two equal-amount payments with different references are legitimate installments.
        // The amount+24h heuristic only applies to payments without any reference.
        if (data.referenceNumber) {
          const sameReference = await tx.payments.findFirst({
            where: { invoiceId: data.invoiceId, referenceNumber: data.referenceNumber },
          });
          if (sameReference) {
            throw new BusinessError(
              `Duplicate payment detected. Reference number "${data.referenceNumber}" was already recorded for this invoice at ${sameReference.createdAt.toISOString()}.`
            );
          }
        } else {
          const recentDuplicate = await tx.payments.findFirst({
            where: {
              invoiceId: data.invoiceId,
              amount: data.amount,
              referenceNumber: null,
              createdAt: { gte: oneDayAgo },
            },
          });
          if (recentDuplicate) {
            throw new BusinessError(
              `Possible duplicate payment detected. A payment of ₹${data.amount} for this invoice was already recorded at ${recentDuplicate.createdAt.toISOString()}. If this is intentional, please add a payment reference number or contact admin.`
            );
          }
        }

        // Create the payment
        const payment = await tx.payments.create({
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
          include: { users: { select: { id: true, firstName: true, lastName: true } } },
        });

        // Apply to the invoice balance ATOMICALLY (race-safe) and read back the resulting totals
        const updated = await tx.invoices.update({
          where: { id: data.invoiceId },
          data: {
            paidAmount: { increment: data.amount },
            balanceAmount: { decrement: data.amount },
          },
        });

        // BUG-PAY4 fix: use decimal.js for balance check precision
        // The atomic decrement is the source of truth: if a concurrent payment slipped past the pre-check
        // and this drove the balance negative, abort — rolling back this payment too.
        // Using decimal.js with small tolerance (0.005) for any residual DB float imprecision
        const updatedBalanceDec = toCurrency(updated.balanceAmount.toString());
        if (updatedBalanceDec.lessThan(-0.005)) {
          throw new ValidationError(`Payment amount (${data.amount}) exceeds the remaining balance for this invoice.`);
        }

        // Recompute status from the atomic result, not the stale pre-tx snapshot
        const newStatus = this.calculateInvoiceStatus(updated.totalAmount, updated.paidAmount, updated.dueDate);
        await tx.invoices.update({ where: { id: data.invoiceId }, data: { status: newStatus } });

        logInfo(`Payment recorded for invoice ${invoice.invoiceNumber}: ${data.amount}`);
        return payment;
      });
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
