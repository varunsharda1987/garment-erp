/**
 * Invoice Management Controller
 * Handles HTTP requests and delegates business logic to InvoiceService
 */

import { Request, Response } from 'express';
import { InvoiceStatus } from '@prisma/client';
import { invoiceService } from '../services/invoice.service';

/**
 * Create new invoice
 * POST /api/invoices
 */
export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  const invoice = await invoiceService.createInvoice({
    ...req.body,
    createdById: req.user!.userId,
  });

  res.status(201).json({
    data: invoice,
    message: 'Invoice created successfully',
  });
};

/**
 * Get all invoices with pagination and filters
 * GET /api/invoices
 */
export const getAllInvoices = async (req: Request, res: Response): Promise<void> => {
  // BUG-FIN2 fix: Use validatedQuery (Zod-coerced) instead of raw req.query
  const query = (req as any).validatedQuery ?? req.query;
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const search = query.search as string;
  const status = query.status as InvoiceStatus;
  const customerId = query.customerId as string;
  const orderId = query.orderId as string;
  const fromDate = query.fromDate as string;
  const toDate = query.toDate as string;
  const sortBy = query.sortBy as string;
  const sortOrder = query.sortOrder as 'asc' | 'desc';

  const result = await invoiceService.getInvoices({
    page,
    limit,
    search,
    status,
    customerId,
    orderId,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
  });

  res.status(200).json(result);
};

/**
 * Get invoice by ID
 * GET /api/invoices/:id
 */
export const getInvoiceById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const invoice = await invoiceService.getInvoiceById(id);

  res.status(200).json({ data: invoice });
};

/**
 * Update invoice
 * PUT /api/invoices/:id
 */
export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const invoice = await invoiceService.updateInvoice(id, req.body);

  res.status(200).json({
    data: invoice,
    message: 'Invoice updated successfully',
  });
};

/**
 * Delete invoice
 * DELETE /api/invoices/:id
 */
export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await invoiceService.deleteInvoice(id);

  res.status(200).json({
    message: 'Invoice deleted successfully',
  });
};

/**
 * Record payment for invoice
 * POST /api/invoices/:id/payments
 */
export const recordPayment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const payment = await invoiceService.recordPayment({
    invoiceId: id,
    ...req.body,
    receivedById: req.user!.userId,
  });

  res.status(201).json({
    data: payment,
    message: 'Payment recorded successfully',
  });
};

/**
 * Get invoice summary statistics
 * GET /api/invoices/summary
 */
export const getInvoiceSummary = async (req: Request, res: Response): Promise<void> => {
  const customerId = req.query.customerId as string | undefined;
  const summary = await invoiceService.getInvoiceSummary(customerId);

  res.status(200).json({ data: summary });
};

/**
 * Update overdue invoices status
 * POST /api/invoices/update-overdue
 */
export const updateOverdueInvoices = async (req: Request, res: Response): Promise<void> => {
  const count = await invoiceService.updateOverdueInvoices();

  res.status(200).json({
    message: `Updated ${count} invoices to OVERDUE status`,
    data: { count },
  });
};
