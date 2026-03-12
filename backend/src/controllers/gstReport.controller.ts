import { Request, Response } from 'express';
import { gstReportService } from '../services/gstReport.service';

class GSTReportController {
  async generateGSTR1(req: Request, res: Response) {
    try {
      const { fromDate, toDate } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: 'fromDate and toDate are required' });
      }
      const report = await gstReportService.generateGSTR1({
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      res.json({ data: report });
    } catch (error: any) {
      console.error('GSTR-1 generation error:', error);
      res.status(500).json({ message: error.message || 'Failed to generate GSTR-1' });
    }
  }

  async generateGSTR3B(req: Request, res: Response) {
    try {
      const { fromDate, toDate } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ message: 'fromDate and toDate are required' });
      }
      const report = await gstReportService.generateGSTR3B({
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      res.json({ data: report });
    } catch (error: any) {
      console.error('GSTR-3B generation error:', error);
      res.status(500).json({ message: error.message || 'Failed to generate GSTR-3B' });
    }
  }
}

export const gstReportController = new GSTReportController();
