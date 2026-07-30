import { Request, Response } from 'express';
import { manufacturingAlertsService } from '../services/manufacturing-alerts.service';

class ManufacturingController {
  async getAlerts(_req: Request, res: Response) {
    try {
      const data = await manufacturingAlertsService.getAlerts();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching manufacturing alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch manufacturing alerts',
      });
    }
  }
}

export const manufacturingController = new ManufacturingController();
