/**
 * Job Work Statutory Reports Controller
 * Phase 5 of Job Work Consolidation
 *
 * Endpoints for GST compliance reports:
 * - GET /section-143-ageing - Section 143 ageing report
 * - GET /itc-04 - ITC-04 extract for filing
 * - GET /vendor-performance - Processor loss analysis
 */

import { Request, Response } from 'express';
import { jobWorkStatutoryService } from '../services/job-work-statutory.service';

class JobWorkStatutoryController {
  /**
   * GET /api/job-work-statutory/section-143-ageing
   * Section 143 Ageing Report - Material outstanding with processors
   *
   * Query params:
   * - asOfDate: Date to calculate ageing from (default: today)
   */
  async getSection143Ageing(req: Request, res: Response) {
    try {
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;

      const report = await jobWorkStatutoryService.getSection143Ageing(asOfDate);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Section 143 Ageing error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  }

  /**
   * GET /api/job-work-statutory/itc-04
   * ITC-04 Extract - Goods sent to/received from job workers
   *
   * Query params:
   * - periodStart: Start date of period (required)
   * - periodEnd: End date of period (required)
   */
  async getITC04Extract(req: Request, res: Response) {
    try {
      const { periodStart, periodEnd } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          message: 'periodStart and periodEnd are required',
        });
      }

      const report = await jobWorkStatutoryService.getITC04Extract(
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('ITC-04 Extract error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  }

  /**
   * GET /api/job-work-statutory/vendor-performance
   * Vendor Performance Report - Processor loss against tolerance
   *
   * Query params:
   * - periodStart: Start date of period (required)
   * - periodEnd: End date of period (required)
   */
  async getVendorPerformance(req: Request, res: Response) {
    try {
      const { periodStart, periodEnd } = req.query;

      if (!periodStart || !periodEnd) {
        return res.status(400).json({
          success: false,
          message: 'periodStart and periodEnd are required',
        });
      }

      const report = await jobWorkStatutoryService.getVendorPerformance(
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Vendor Performance error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  }

  /**
   * GET /api/job-work-statutory/summary
   * Quick summary of all statutory metrics
   */
  async getSummary(req: Request, res: Response) {
    try {
      const today = new Date();
      const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      const quarterEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);

      const [ageing, itc04, vendorPerf] = await Promise.all([
        jobWorkStatutoryService.getSection143Ageing(today),
        jobWorkStatutoryService.getITC04Extract(quarterStart, quarterEnd),
        jobWorkStatutoryService.getVendorPerformance(quarterStart, quarterEnd),
      ]);

      res.json({
        success: true,
        data: {
          section143: {
            totalOutstanding: ageing.totalOrdersOutstanding,
            valueAtProcessors: ageing.totalValueAtProcessors,
            critical: ageing.ordersCritical,
            breached: ageing.ordersBreached,
          },
          itc04: {
            currentQuarter: `Q${Math.floor(today.getMonth() / 3) + 1} ${today.getFullYear()}`,
            challansSent: itc04.tableA.totalChallans,
            challansReceived: itc04.tableB.totalChallans,
            jobWorkers: itc04.jobWorkerCount,
          },
          vendorPerformance: {
            processorsOverTolerance: vendorPerf.processorsOverTolerance,
            totalRecovered: vendorPerf.totalRecovered,
          },
        },
      });
    } catch (error) {
      console.error('Summary error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate summary',
      });
    }
  }
}

export const jobWorkStatutoryController = new JobWorkStatutoryController();
export default jobWorkStatutoryController;
