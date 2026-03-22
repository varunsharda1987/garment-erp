import { Request, Response } from 'express';
import { hsnSacMasterService } from '../services/hsnSacMaster.service';
import { HSNSACType } from '@prisma/client';
import { NotFoundError } from '../errors';

export class HSNSACMasterController {
  /**
   * Get all HSN/SAC codes with pagination
   */
  async getAll(req: Request, res: Response) {
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
  }

  /**
   * Search HSN/SAC codes for dropdown/autocomplete
   */
  async search(req: Request, res: Response) {
    const { search, type, limit = '50' } = req.query;

    const results = await hsnSacMasterService.search({
      search: search as string | undefined,
      type: type as HSNSACType | undefined,
      limit: parseInt(limit as string, 10),
    });

    res.json(results);
  }

  /**
   * Get HSN/SAC code by ID
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const record = await hsnSacMasterService.getById(id);

    if (!record) {
      throw new NotFoundError('HSN/SAC code', id);
    }

    res.json({ data: record });
  }

  /**
   * Get HSN/SAC by code string
   */
  async getByCode(req: Request, res: Response) {
    const { code } = req.params;
    const record = await hsnSacMasterService.getByCode(code);

    if (!record) {
      throw new NotFoundError('HSN/SAC code', code);
    }

    res.json({ data: record });
  }

  /**
   * Get default GST rate for a code
   */
  async getDefaultRate(req: Request, res: Response) {
    const { code } = req.params;
    const rate = await hsnSacMasterService.getDefaultRate(code);

    if (rate === null) {
      throw new NotFoundError('GST rate for code', code);
    }

    res.json({ data: { code, defaultGstRate: rate } });
  }

  /**
   * Create new HSN/SAC code
   */
  async create(req: Request, res: Response) {
    const record = await hsnSacMasterService.create(req.body);
    res.status(201).json({ data: record, message: 'HSN/SAC code created successfully' });
  }

  /**
   * Update HSN/SAC code
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const record = await hsnSacMasterService.update(id, req.body);
    res.json({ data: record, message: 'HSN/SAC code updated successfully' });
  }

  /**
   * Delete HSN/SAC code (soft delete)
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await hsnSacMasterService.delete(id);
    res.json({ message: 'HSN/SAC code deleted successfully' });
  }
}

export const hsnSacMasterController = new HSNSACMasterController();
