/**
 * Quotation Controller
 * HTTP handlers for quotation management endpoints
 */

import { Request, Response } from 'express';
import { quotationService } from '../services/quotation.service';
import {
  CreateQuotationInput,
  UpdateQuotationInput,
  QuotationQueryInput,
  UpdateQuotationStatusInput,
} from '../schemas/quotation.schema';

/**
 * Create a new quotation
 * POST /api/quotations
 */
export const createQuotation = async (req: Request, res: Response): Promise<void> => {
  const data: CreateQuotationInput = req.body;

  const quotation = await quotationService.createQuotation({
    ...data,
    createdById: req.user!.userId,
  });

  res.status(201).json({
    data: quotation,
    message: 'Quotation created successfully',
  });
};

/**
 * Get all quotations with pagination and filters
 * GET /api/quotations
 */
export const getAllQuotations = async (req: Request, res: Response): Promise<void> => {
  const options: QuotationQueryInput = req.query as any;

  const result = await quotationService.getQuotations(options);

  res.status(200).json(result);
};

/**
 * Get quotation by ID
 * GET /api/quotations/:id
 */
export const getQuotationById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const quotation = await quotationService.getQuotationById(id);

  res.status(200).json({ data: quotation });
};

/**
 * Update quotation
 * PUT /api/quotations/:id
 */
export const updateQuotation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data: UpdateQuotationInput = req.body;

  const quotation = await quotationService.updateQuotation(id, data);

  res.status(200).json({
    data: quotation,
    message: 'Quotation updated successfully',
  });
};

/**
 * Update quotation status
 * PUT /api/quotations/:id/status
 */
export const updateQuotationStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status }: UpdateQuotationStatusInput = req.body;

  const quotation = await quotationService.updateQuotationStatus(id, status, req.user!.userId);

  res.status(200).json({
    data: quotation,
    message: `Quotation status updated to ${status}`,
  });
};

/**
 * Delete quotation
 * DELETE /api/quotations/:id
 */
export const deleteQuotation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await quotationService.deleteQuotation(id);

  res.status(200).json({
    message: 'Quotation deleted successfully',
  });
};

/**
 * Get quotation summary statistics
 * GET /api/quotations/summary
 */
export const getQuotationSummary = async (req: Request, res: Response): Promise<void> => {
  const customerId = req.query.customerId as string | undefined;

  const summary = await quotationService.getQuotationSummary(customerId);

  res.status(200).json({ data: summary });
};

/**
 * Mark expired quotations
 * POST /api/quotations/mark-expired
 */
export const markExpiredQuotations = async (req: Request, res: Response): Promise<void> => {
  const count = await quotationService.markExpiredQuotations();

  res.status(200).json({
    message: `Marked ${count} quotation(s) as expired`,
    data: { count },
  });
};
