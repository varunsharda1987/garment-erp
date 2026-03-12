import { Request, Response } from 'express';
import { debitNoteService } from '../services/debitNote.service';

export class DebitNoteController {
  /**
   * Get all debit notes with pagination
   */
  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        status,
        supplierId,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
      } = req.query;

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
    } catch (error: any) {
      console.error('Error fetching debit notes:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch debit notes' });
    }
  }

  /**
   * Get debit note by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const debitNote = await debitNoteService.getById(id);

      if (!debitNote) {
        return res.status(404).json({ message: 'Debit note not found' });
      }

      res.json(debitNote);
    } catch (error: any) {
      console.error('Error fetching debit note:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch debit note' });
    }
  }

  /**
   * Create new debit note
   */
  async create(req: Request, res: Response) {
    try {
      const { poId, supplierId, debitNoteDate, reason, remarks, items } = req.body;
      const userId = req.user?.userId;

      if (!supplierId) {
        return res.status(400).json({ message: 'Supplier ID is required' });
      }

      if (!reason) {
        return res.status(400).json({ message: 'Reason is required' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
      }

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const debitNote = await debitNoteService.create(
        { poId, supplierId, debitNoteDate, reason, remarks, items },
        userId
      );

      res.status(201).json(debitNote);
    } catch (error: any) {
      console.error('Error creating debit note:', error);
      res.status(500).json({ message: error.message || 'Failed to create debit note' });
    }
  }

  /**
   * Approve debit note
   */
  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const debitNote = await debitNoteService.approve(id);

      res.json(debitNote);
    } catch (error: any) {
      console.error('Error approving debit note:', error);
      if (error.message === 'Debit note not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only DRAFT debit notes can be approved') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to approve debit note' });
    }
  }

  /**
   * Cancel debit note
   */
  async cancel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const debitNote = await debitNoteService.cancel(id);

      res.json(debitNote);
    } catch (error: any) {
      console.error('Error cancelling debit note:', error);
      if (error.message === 'Debit note not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only DRAFT debit notes can be cancelled') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to cancel debit note' });
    }
  }

  /**
   * Delete debit note
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await debitNoteService.delete(id);

      res.json({ message: 'Debit note deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting debit note:', error);
      if (error.message === 'Debit note not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'Only DRAFT debit notes can be deleted') {
        return res.status(400).json({ message: error.message });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Debit note not found' });
      }
      res.status(500).json({ message: error.message || 'Failed to delete debit note' });
    }
  }
}

export const debitNoteController = new DebitNoteController();
