import { Request, Response } from 'express';
import { manufacturingAlertsService } from '../services/manufacturing-alerts.service';
import { manufacturingPipelineService } from '../services/manufacturing-pipeline.service';

class ManufacturingController {
  /**
   * The role shapes WHAT IS SHOWN, not what may be read — see control-center-panels.ts. Reads stay
   * open to every signed-in user, per the convention in auth.middleware.ts.
   */
  async getAlerts(req: Request, res: Response) {
    const data = await manufacturingAlertsService.getAlerts(req.user?.role);
    res.json({ success: true, data });
  }

  /**
   * Live pipeline state — kept a SEPARATE endpoint from /alerts on purpose.
   *
   * Alerts polls every 60 s; this runs several validation queries per order and wants a slower
   * cadence. Separate endpoints also fail separately, which is the whole point of the Control
   * Center rework: a heavy pipeline query must never be able to blank the exceptions inbox.
   */
  async getPipeline(_req: Request, res: Response) {
    const data = await manufacturingPipelineService.getPipeline();
    res.json({ success: true, data });
  }
}

export const manufacturingController = new ManufacturingController();
