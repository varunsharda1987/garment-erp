import { Request, Response } from 'express';
import { hsnSacMasterService } from '../services/hsnSacMaster.service';
import { HSNSACType } from '@prisma/client';

export class HSNSACMasterController {
  /**
   * Get all HSN/SAC codes with pagination
   */
  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        type,
        chapter,
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await hsnSacMasterService.getAll({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string | undefined,
        type: type as HSNSACType | undefined,
        chapter: chapter as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching HSN/SAC codes:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch HSN/SAC codes' });
    }
  }

  /**
   * Search HSN/SAC codes for dropdown/autocomplete
   */
  async search(req: Request, res: Response) {
    try {
      const { search, type, limit = '50' } = req.query;

      const results = await hsnSacMasterService.search({
        search: search as string | undefined,
        type: type as HSNSACType | undefined,
        limit: parseInt(limit as string, 10),
      });

      res.json(results);
    } catch (error: any) {
      console.error('Error searching HSN/SAC codes:', error);
      res.status(500).json({ message: error.message || 'Failed to search HSN/SAC codes' });
    }
  }

  /**
   * Get HSN/SAC code by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const record = await hsnSacMasterService.getById(id);

      if (!record) {
        res.status(404).json({ message: 'HSN/SAC code not found' });
        return;
      }

      res.json({ data: record });
    } catch (error: any) {
      console.error('Error fetching HSN/SAC code:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch HSN/SAC code' });
    }
  }

  /**
   * Get HSN/SAC by code string
   */
  async getByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const record = await hsnSacMasterService.getByCode(code);

      if (!record) {
        res.status(404).json({ message: 'HSN/SAC code not found' });
        return;
      }

      res.json({ data: record });
    } catch (error: any) {
      console.error('Error fetching HSN/SAC code:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch HSN/SAC code' });
    }
  }

  /**
   * Get default GST rate for a code
   */
  async getDefaultRate(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const rate = await hsnSacMasterService.getDefaultRate(code);

      if (rate === null) {
        res.status(404).json({ message: 'No GST rate found for this code' });
        return;
      }

      res.json({ data: { code, defaultGstRate: rate } });
    } catch (error: any) {
      console.error('Error fetching default rate:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch default rate' });
    }
  }

  /**
   * Create new HSN/SAC code
   */
  async create(req: Request, res: Response) {
    try {
      const record = await hsnSacMasterService.create(req.body);
      res.status(201).json({ data: record, message: 'HSN/SAC code created successfully' });
    } catch (error: any) {
      if (error.code === 'P2002') {
        res.status(400).json({ message: 'HSN/SAC code already exists' });
        return;
      }
      console.error('Error creating HSN/SAC code:', error);
      res.status(500).json({ message: error.message || 'Failed to create HSN/SAC code' });
    }
  }

  /**
   * Update HSN/SAC code
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const record = await hsnSacMasterService.update(id, req.body);
      res.json({ data: record, message: 'HSN/SAC code updated successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ message: 'HSN/SAC code not found' });
        return;
      }
      if (error.code === 'P2002') {
        res.status(400).json({ message: 'HSN/SAC code already exists' });
        return;
      }
      console.error('Error updating HSN/SAC code:', error);
      res.status(500).json({ message: error.message || 'Failed to update HSN/SAC code' });
    }
  }

  /**
   * Delete HSN/SAC code (soft delete)
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await hsnSacMasterService.delete(id);
      res.json({ message: 'HSN/SAC code deleted successfully' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        res.status(404).json({ message: 'HSN/SAC code not found' });
        return;
      }
      console.error('Error deleting HSN/SAC code:', error);
      res.status(500).json({ message: error.message || 'Failed to delete HSN/SAC code' });
    }
  }
}

export const hsnSacMasterController = new HSNSACMasterController();
