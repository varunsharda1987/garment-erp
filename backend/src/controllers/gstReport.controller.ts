import { Request, Response } from 'express';
import { gstReportService } from '../services/gstReport.service';
import { ValidationError } from '../errors';

class GSTReportController {
  async generateGSTR1(req: Request, res: Response) {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      throw new ValidationError('fromDate and toDate are required');
    }
    const report = await gstReportService.generateGSTR1({
      fromDate: fromDate as string,
      toDate: toDate as string,
    });
    res.json({ data: report });
  }

  async generateGSTR3B(req: Request, res: Response) {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      throw new ValidationError('fromDate and toDate are required');
    }
    const report = await gstReportService.generateGSTR3B({
      fromDate: fromDate as string,
      toDate: toDate as string,
    });
    res.json({ data: report });
  }
}

export const gstReportController = new GSTReportController();
