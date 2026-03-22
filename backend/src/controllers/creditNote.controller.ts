import { Request, Response } from 'express';
import { creditNoteService } from '../services/creditNote.service';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

export class CreditNoteController {
  /**
   * Get all credit notes with pagination
   */
  async getAll(req: Request, res: Response) {
    const {
      page = '1',
      limit = '20',
      search,
      status,
      customerId,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await creditNoteService.getAll({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      search: search as string | undefined,
      status: status as string | undefined,
      customerId: customerId as string | undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });

    res.json(result);
  }

  /**
   * Get credit note by ID
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const creditNote = await creditNoteService.getById(id);

    if (!creditNote) {
      throw new NotFoundError('Credit note', id);
    }

    res.json(creditNote);
  }

  /**
   * Create new credit note
   */
  async create(req: Request, res: Response) {
    const { invoiceId, customerId, creditNoteDate, reason, remarks, items } = req.body;

    if (!invoiceId) {
      throw new ValidationError('Invoice ID is required');
    }

    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    if (!reason) {
      throw new ValidationError('Reason is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const creditNote = await creditNoteService.create(
      { invoiceId, customerId, creditNoteDate, reason, remarks, items },
      userId
    );

    res.status(201).json(creditNote);
  }

  /**
   * Approve credit note
   */
  async approve(req: Request, res: Response) {
    const { id } = req.params;

    const creditNote = await creditNoteService.approve(id);

    res.json(creditNote);
  }

  /**
   * Cancel credit note
   */
  async cancel(req: Request, res: Response) {
    const { id } = req.params;

    const creditNote = await creditNoteService.cancel(id);

    res.json(creditNote);
  }

  /**
   * Delete credit note
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    await creditNoteService.delete(id);

    res.json({ message: 'Credit note deleted successfully' });
  }
}

export const creditNoteController = new CreditNoteController();
