import { Request, Response } from 'express';
import { systemSettingsService } from '../services/system-settings.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';

class SystemSettingsController {
  async getAll(req: Request, res: Response) {
    const { category, search, page, limit } = req.query;
    const result = await systemSettingsService.getAll({
      category: category as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  }

  async getDefaults(_req: Request, res: Response) {
    const defaults = await systemSettingsService.getDefaults();
    res.json(defaults);
  }

  async getByKey(req: Request, res: Response) {
    const { key } = req.params;
    const setting = await systemSettingsService.getByKey(key);
    if (!setting) {
      throw new NotFoundError('Setting', key);
    }
    res.json(setting);
  }

  async upsert(req: Request, res: Response) {
    const { key } = req.params;
    const { value, dataType, category, description } = req.body;

    if (value === undefined || value === null) {
      throw new ValidationError('Value is required');
    }

    const setting = await systemSettingsService.upsert(key, {
      value: String(value),
      dataType,
      category,
      description,
    });
    res.json(setting);
  }

  async delete(req: Request, res: Response) {
    const { key } = req.params;
    try {
      await systemSettingsService.delete(key);
      res.json({ message: `Setting '${key}' deleted` });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes('Cannot delete system setting')) {
        throw new ForbiddenError(err.message);
      }
      if (err.message?.includes('not found')) {
        throw new NotFoundError('Setting', key);
      }
      throw error;
    }
  }
}

export const systemSettingsController = new SystemSettingsController();
