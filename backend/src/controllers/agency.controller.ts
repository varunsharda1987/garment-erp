import { Request, Response } from 'express';
import { agencyService } from '../services/agency.service';
import { NotFoundError, ValidationError } from '../errors';

export class AgencyController {
  /**
   * Get all agencies with pagination
   */
  async getAll(req: Request, res: Response) {
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
  }

  /**
   * Search agencies for dropdown
   */
  async search(req: Request, res: Response) {
    const { search, limit = '50' } = req.query;

    const agencies = await agencyService.search({
      search: search as string | undefined,
      limit: parseInt(limit as string, 10),
    });

    res.json(agencies);
  }

  /**
   * Get agency by ID
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const agency = await agencyService.getById(id);

    if (!agency) {
      throw new NotFoundError('Agency', id);
    }

    res.json(agency);
  }

  /**
   * Create new agency
   */
  async create(req: Request, res: Response) {
    const { name, phone, email, address, isActive } = req.body;

    if (!name) {
      throw new ValidationError('Name is required');
    }

    const agency = await agencyService.create({
      name,
      phone,
      email,
      address,
      isActive,
    });

    res.status(201).json(agency);
  }

  /**
   * Update agency
   */
  async update(req: Request, res: Response) {
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
  }

  /**
   * Delete agency
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    await agencyService.delete(id);

    res.json({ message: 'Agency deleted successfully' });
  }
}

export const agencyController = new AgencyController();
