import { Request, Response } from 'express';
import { creditNoteService } from '../services/creditNote.service';

export class CreditNoteController {
  /**
   * Get all credit notes with pagination
   */
  async getAll(req: Request, res: Response) {
    try {
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
    } catch (error: any) {
      console.error('Error fetching credit notes:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch credit notes' });
    }
  }

  /**
   * Get credit note by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const creditNote = await creditNoteService.getById(id);

      if (!creditNote) {
        return res.status(404).json({ message: 'Credit note not found' });
      }

      res.json(creditNote);
    } catch (error: any) {
      console.error('Error fetching credit note:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch credit note' });
    }
  }

  /**
   * Create new credit note
   */
  async create(req: Request, res: Response) {
    try {
      const { invoiceId, customerId, creditNoteDate, reason, remarks, items } = req.body;

      if (!invoiceId) {
        return res.status(400).json({ message: 'Invoice ID is required' });
      }

      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID is required' });
      }

      if (!reason) {
        return res.status(400).json({ message: 'Reason is required' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
      }

      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const creditNote = await creditNoteService.create(
        { invoiceId, customerId, creditNoteDate, reason, remarks, items },
        userId
      );

      res.status(201).json(creditNote);
    } catch (error: any) {
      console.error('Error creating credit note:', error);
      res.status(500).json({ message: error.message || 'Failed to create credit note' });
    }
  }

  /**
   * Approve credit note
   */
  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const creditNote = await creditNoteService.approve(id);

      res.json(creditNote);
    } catch (error: any) {
      console.error('Error approving credit note:', error);
      if (error.message === 'Credit note not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only DRAFT credit notes can be approved') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to approve credit note' });
    }
  }

  /**
   * Cancel credit note
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const creditNote = await creditNoteService.cancel(id);

      res.json(creditNote);
    } catch (error: any) {
      console.error('Error cancelling credit note:', error);
      if (error.message === 'Credit note not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only DRAFT credit notes can be cancelled') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to cancel credit note' });
    }
  }

  /**
   * Delete credit note
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await creditNoteService.delete(id);

      res.json({ message: 'Credit note deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting credit note:', error);
      if (error.code === 'P2025' || error.message === 'Credit note not found') {
        return res.status(404).json({ message: 'Credit note not found' });
      }
      if (error.message === 'Only DRAFT credit notes can be deleted') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to delete credit note' });
    }
  }
}

export const creditNoteController = new CreditNoteController();
