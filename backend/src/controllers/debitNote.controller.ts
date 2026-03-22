import { Request, Response } from 'express';
import { debitNoteService } from '../services/debitNote.service';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

export class DebitNoteController {
  /**
   * Get all debit notes with pagination
   */
  async getAll(req: Request, res: Response) {
    const { page = '1', limit = '20', search, status, supplierId, fromDate, toDate, sortBy, sortOrder } = req.query;

    const result = await debitNoteService.getAll({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      search: search as string | undefined,
      status: status as string | undefined,
      supplierId: supplierId as string | undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });

    res.json(result);
  }

  /**
   * Get debit note by ID
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const debitNote = await debitNoteService.getById(id);

    if (!debitNote) {
      throw new NotFoundError('Debit note', id);
    }

    res.json(debitNote);
  }

  /**
   * Create new debit note
   */
  async create(req: Request, res: Response) {
    const { poId, supplierId, debitNoteDate, reason, remarks, items } = req.body;
    const userId = req.user?.userId;

    if (!supplierId) {
      throw new ValidationError('Supplier ID is required');
    }

    if (!reason) {
      throw new ValidationError('Reason is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const debitNote = await debitNoteService.create(
      { poId, supplierId, debitNoteDate, reason, remarks, items },
      userId
    );

    res.status(201).json(debitNote);
  }

  /**
   * Approve debit note
   */
  async approve(req: Request, res: Response) {
    const { id } = req.params;

    const debitNote = await debitNoteService.approve(id);

    res.json(debitNote);
  }

  /**
   * Cancel debit note
   */
  async cancel(req: Request, res: Response) {
    const { id } = req.params;

    const debitNote = await debitNoteService.cancel(id);

    res.json(debitNote);
  }

  /**
   * Delete debit note
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    await debitNoteService.delete(id);

    res.json({ message: 'Debit note deleted successfully' });
  }
}

export const debitNoteController = new DebitNoteController();
