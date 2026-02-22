import { Request, Response } from 'express';
import { agencyService } from '../services/agency.service';

export class AgencyController {
  /**
   * Get all agencies with pagination
   */
  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await agencyService.getAll({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching agencies:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch agencies' });
    }
  }

  /**
   * Search agencies for dropdown
   */
  async search(req: Request, res: Response) {
    try {
      const { search, limit = '50' } = req.query;

      const agencies = await agencyService.search({
        search: search as string | undefined,
        limit: parseInt(limit as string, 10),
      });

      res.json(agencies);
    } catch (error: any) {
      console.error('Error searching agencies:', error);
      res.status(500).json({ message: error.message || 'Failed to search agencies' });
    }
  }

  /**
   * Get agency by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const agency = await agencyService.getById(id);

      if (!agency) {
        return res.status(404).json({ message: 'Agency not found' });
      }

      res.json(agency);
    } catch (error: any) {
      console.error('Error fetching agency:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch agency' });
    }
  }

  /**
   * Create new agency
   */
  async create(req: Request, res: Response) {
    try {
      const { name, phone, email, address, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }

      const agency = await agencyService.create({
        name,
        phone,
        email,
        address,
        isActive,
      });

      res.status(201).json(agency);
    } catch (error: any) {
      console.error('Error creating agency:', error);
      res.status(500).json({ message: error.message || 'Failed to create agency' });
    }
  }

  /**
   * Update agency
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, phone, email, address, isActive } = req.body;

      const agency = await agencyService.update(id, {
        name,
        phone,
        email,
        address,
        isActive,
      });

      res.json(agency);
    } catch (error: any) {
      console.error('Error updating agency:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Agency not found' });
      }
      res.status(500).json({ message: error.message || 'Failed to update agency' });
    }
  }

  /**
   * Delete agency
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await agencyService.delete(id);

      res.json({ message: 'Agency deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting agency:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Agency not found' });
      }
      res.status(400).json({ message: error.message || 'Failed to delete agency' });
    }
  }
}

export const agencyController = new AgencyController();
