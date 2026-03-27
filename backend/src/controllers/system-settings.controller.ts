import { Request, Response } from 'express';
import { systemSettingsService } from '../services/system-settings.service';
import { logError } from '../utils/logger';

class SystemSettingsController {
  async getAll(req: Request, res: Response) {
    try {
      const { category, search, page, limit } = req.query;
      const result = await systemSettingsService.getAll({
        category: category as string,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      logError('Failed to get system settings', error);
      res.status(500).json({ message: 'Failed to get system settings' });
    }
  }

  async getDefaults(_req: Request, res: Response) {
    try {
      const defaults = await systemSettingsService.getDefaults();
      res.json(defaults);
    } catch (error) {
      logError('Failed to get default settings', error);
      res.status(500).json({ message: 'Failed to get default settings' });
    }
  }

  async getByKey(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const setting = await systemSettingsService.getByKey(key);
      if (!setting) {
        return res.status(404).json({ message: `Setting '${key}' not found` });
      }
      res.json(setting);
    } catch (error) {
      logError('Failed to get setting', error);
      res.status(500).json({ message: 'Failed to get setting' });
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value, dataType, category, description } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ message: 'Value is required' });
      }

      const setting = await systemSettingsService.upsert(key, {
        value: String(value),
        dataType,
        category,
        description,
      });
      res.json(setting);
    } catch (error) {
      logError('Failed to upsert setting', error);
      res.status(500).json({ message: 'Failed to update setting' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { key } = req.params;
      await systemSettingsService.delete(key);
      res.json({ message: `Setting '${key}' deleted` });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes('Cannot delete system setting')) {
        return res.status(403).json({ message: err.message });
      }
      if (err.message?.includes('not found')) {
        return res.status(404).json({ message: err.message });
      }
      logError('Failed to delete setting', error);
      res.status(500).json({ message: 'Failed to delete setting' });
    }
  }
}

export const systemSettingsController = new SystemSettingsController();
