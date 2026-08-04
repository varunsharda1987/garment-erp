/**
 * Report Generator Service
 *
 * Generates various business reports in CSV, Excel, or PDF format.
 * Works with the job queue for async generation and notifies users when complete.
 */

import prisma from '../config/database';
import { getDerivedStockDetailed } from './helpers/derived-stock.helper';
import exportService from './export.service';
import { notificationService } from './notification.service';
import { logInfo, logError } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Report types supported
export type ReportType =
  | 'inventory-summary'
  | 'stock-levels'
  | 'order-summary'
  | 'production-status'
  | 'supplier-performance'
  | 'style-costing'
  | 'sales-report'
  | 'gst-summary';

export interface ReportParams {
  format?: 'csv' | 'xlsx' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  supplierId?: string;
  styleId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ReportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  recordCount?: number;
  error?: string;
}

// Ensure reports directory exists
const REPORTS_DIR = path.join(process.cwd(), 'uploads', 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

class ReportGeneratorService {
  /**
   * Generate a report based on type and parameters
   */
  async generateReport(reportType: ReportType, params: ReportParams, userId: string): Promise<ReportResult> {
    const format = params.format || 'xlsx';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${reportType}_${timestamp}.${format}`;
    const filePath = path.join(REPORTS_DIR, fileName);

    try {
      logInfo(`Generating report: ${reportType}`, { params, userId });

      let result: ReportResult;

      switch (reportType) {
        case 'inventory-summary':
          result = await this.generateInventorySummary(filePath, format, params);
          break;
        case 'stock-levels':
          result = await this.generateStockLevels(filePath, format, params);
          break;
        case 'order-summary':
          result = await this.generateOrderSummary(filePath, format, params);
          break;
        case 'production-status':
          result = await this.generateProductionStatus(filePath, format, params);
          break;
        case 'style-costing':
          result = await this.generateStyleCosting(filePath, format, params);
          break;
        default:
          return { success: false, error: `Unknown report type: ${reportType}` };
      }

      // Notify user that report is ready
      if (result.success) {
        await notificationService.create({
          userId,
          type: 'SUCCESS',
          title: 'Report Ready',
          message: `Your ${reportType.replace(/-/g, ' ')} report is ready for download.`,
          referenceType: 'report',
          referenceId: fileName,
        });
      }

      return result;
    } catch (error) {
      logError(`Report generation failed: ${reportType}`, error);

      // Notify user of failure
      await notificationService.create({
        userId,
        type: 'ALERT',
        title: 'Report Failed',
        message: `Failed to generate ${reportType.replace(/-/g, ' ')} report. Please try again.`,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Inventory Summary Report
   * Shows all materials with current stock levels
   */
  private async generateInventorySummary(
    filePath: string,
    format: string,
    params: ReportParams
  ): Promise<ReportResult> {
    // T2-1: derived on-hand + policy config (per-lot truth, excludes phantom/RAW/zero rows; lastUpdated is
    // the real last movement, not the reconcile-bumped ledger timestamp) instead of stock_levels.
    const stockLevels = (await getDerivedStockDetailed()).sort((a, b) => a.materialId.localeCompare(b.materialId));

    const data = stockLevels.map((sl) => ({
      materialCode: sl.materials?.code || sl.materialId,
      materialName: sl.materials?.name || 'N/A',
      materialType: sl.materials?.materialType || 'N/A',
      quantity: Number(sl.quantity || 0).toString(),
      unit: sl.unit,
      lastUpdated: sl.lastUpdated?.toISOString().split('T')[0] || '',
    }));

    const columns = [
      { fieldName: 'materialCode', displayName: 'Material Code', width: 20 },
      { fieldName: 'materialName', displayName: 'Material Name', width: 30 },
      { fieldName: 'materialType', displayName: 'Type', width: 15 },
      { fieldName: 'quantity', displayName: 'Quantity', width: 15, format: 'number' as const },
      { fieldName: 'unit', displayName: 'Unit', width: 10 },
      { fieldName: 'lastUpdated', displayName: 'Last Updated', width: 15 },
    ];

    return this.writeReport(filePath, format, {
      columns,
      data,
      filename: path.basename(filePath),
      title: 'Inventory Summary Report',
    });
  }

  /**
   * Stock Levels Report
   * Detailed stock levels with reorder points
   */
  private async generateStockLevels(filePath: string, format: string, params: ReportParams): Promise<ReportResult> {
    // T2-1: derived on-hand + policy config (per-lot truth, excludes phantom/RAW/zero rows; lastUpdated is
    // the real last movement, not the reconcile-bumped ledger timestamp) instead of stock_levels.
    const stockLevels = (await getDerivedStockDetailed()).sort((a, b) => a.materialId.localeCompare(b.materialId));

    const data = stockLevels.map((sl) => ({
      materialCode: sl.materials?.code || sl.materialId,
      materialName: sl.materials?.name || 'N/A',
      materialType: sl.materials?.materialType || 'N/A',
      currentQuantity: Number(sl.quantity || 0),
      reorderLevel: Number(sl.reorderLevel || 0),
      minLevel: Number(sl.minLevel || 0),
      maxLevel: Number(sl.maxLevel || 0),
      unit: sl.unit,
      status: Number(sl.quantity || 0) <= Number(sl.reorderLevel || 0) ? 'LOW STOCK' : 'OK',
    }));

    const columns = [
      { fieldName: 'materialCode', displayName: 'Material Code', width: 20 },
      { fieldName: 'materialName', displayName: 'Material Name', width: 30 },
      { fieldName: 'materialType', displayName: 'Type', width: 15 },
      { fieldName: 'currentQuantity', displayName: 'Current Qty', width: 12, format: 'number' as const },
      { fieldName: 'reorderLevel', displayName: 'Reorder Point', width: 12, format: 'number' as const },
      { fieldName: 'minLevel', displayName: 'Min Level', width: 12, format: 'number' as const },
      { fieldName: 'maxLevel', displayName: 'Max Level', width: 12, format: 'number' as const },
      { fieldName: 'unit', displayName: 'Unit', width: 10 },
      { fieldName: 'status', displayName: 'Status', width: 12 },
    ];

    return this.writeReport(filePath, format, {
      columns,
      data,
      filename: path.basename(filePath),
      title: 'Stock Levels Report',
    });
  }

  /**
   * Order Summary Report
   */
  private async generateOrderSummary(filePath: string, format: string, params: ReportParams): Promise<ReportResult> {
    const where: any = {};

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    if (params.status) {
      where.status = params.status;
    }

    const orders = await prisma.orders.findMany({
      where,
      include: {
        customers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customers?.name || 'N/A',
      orderDate: o.createdAt.toISOString().split('T')[0],
      status: o.status,
      totalQuantity: o.totalQuantity,
      totalAmount: Number(o.totalAmount || 0).toFixed(2),
    }));

    const columns = [
      { fieldName: 'orderNumber', displayName: 'Order Number', width: 20 },
      { fieldName: 'customerName', displayName: 'Customer', width: 30 },
      { fieldName: 'orderDate', displayName: 'Order Date', width: 15 },
      { fieldName: 'status', displayName: 'Status', width: 15 },
      { fieldName: 'totalQuantity', displayName: 'Total Qty', width: 12, format: 'number' as const },
      { fieldName: 'totalAmount', displayName: 'Total Amount', width: 15, format: 'currency' as const },
    ];

    return this.writeReport(filePath, format, {
      columns,
      data,
      filename: path.basename(filePath),
      title: 'Order Summary Report',
    });
  }

  /**
   * Production Status Report
   */
  private async generateProductionStatus(
    filePath: string,
    format: string,
    params: ReportParams
  ): Promise<ReportResult> {
    const workOrders = await prisma.work_orders.findMany({
      include: {
        styles: true,
        orders: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit for performance
    });

    const data = workOrders.map((wo) => ({
      workOrderNumber: wo.workOrderNumber,
      styleName: wo.styles?.styleName || 'N/A',
      orderNumber: wo.orders?.orderNumber || 'Stock Production',
      status: wo.status,
      totalQuantity: wo.totalQuantity,
      completedQuantity: wo.completedQuantity || 0,
      plannedStartDate: wo.plannedStartDate?.toISOString().split('T')[0] || '',
      plannedEndDate: wo.plannedEndDate?.toISOString().split('T')[0] || '',
    }));

    const columns = [
      { fieldName: 'workOrderNumber', displayName: 'WO Number', width: 20 },
      { fieldName: 'styleName', displayName: 'Style', width: 25 },
      { fieldName: 'orderNumber', displayName: 'Order', width: 20 },
      { fieldName: 'status', displayName: 'Status', width: 15 },
      { fieldName: 'totalQuantity', displayName: 'Target Qty', width: 12, format: 'number' as const },
      { fieldName: 'completedQuantity', displayName: 'Completed', width: 12, format: 'number' as const },
      { fieldName: 'plannedStartDate', displayName: 'Start Date', width: 15 },
      { fieldName: 'plannedEndDate', displayName: 'Target Date', width: 15 },
    ];

    return this.writeReport(filePath, format, {
      columns,
      data,
      filename: path.basename(filePath),
      title: 'Production Status Report',
    });
  }

  /**
   * Style Costing Report
   */
  private async generateStyleCosting(filePath: string, format: string, params: ReportParams): Promise<ReportResult> {
    const costings = await prisma.style_costing.findMany({
      include: {
        styles: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = costings.map((cs) => ({
      styleCode: cs.styles?.styleCode || 'N/A',
      buyerStyleRef: cs.styles?.buyerStyleRef ?? '-',
      styleName: cs.styles?.styleName || 'N/A',
      status: cs.isApproved ? 'Approved' : 'Draft',
      fabricCost: Number(cs.fabricCost || 0).toFixed(2),
      accessoriesCost: Number(cs.accessoriesCost || 0).toFixed(2),
      cmtCost: Number(cs.cmtCost || 0).toFixed(2),
      totalCost: Number(cs.totalCostPerPiece || 0).toFixed(2),
      sellingPrice: Number(cs.sellingPricePerPiece || 0).toFixed(2),
    }));

    const columns = [
      { fieldName: 'styleCode', displayName: 'Style Code', width: 15 },
      { fieldName: 'buyerStyleRef', displayName: 'Buyer Ref', width: 15 },
      { fieldName: 'styleName', displayName: 'Style Name', width: 25 },
      { fieldName: 'status', displayName: 'Status', width: 12 },
      { fieldName: 'fabricCost', displayName: 'Fabric Cost', width: 12, format: 'currency' as const },
      { fieldName: 'accessoriesCost', displayName: 'Accessories', width: 12, format: 'currency' as const },
      { fieldName: 'cmtCost', displayName: 'CMT Cost', width: 12, format: 'currency' as const },
      { fieldName: 'totalCost', displayName: 'Total Cost', width: 12, format: 'currency' as const },
      { fieldName: 'sellingPrice', displayName: 'Selling Price', width: 12, format: 'currency' as const },
    ];

    return this.writeReport(filePath, format, {
      columns,
      data,
      filename: path.basename(filePath),
      title: 'Style Costing Report',
    });
  }

  /**
   * Write report to file using export service
   */
  private async writeReport(
    filePath: string,
    format: string,
    options: { columns: any[]; data: any[]; filename: string; title: string }
  ): Promise<ReportResult> {
    try {
      if (format === 'csv') {
        const csv = await exportService.exportToCSV(options);
        fs.writeFileSync(filePath, csv);
      } else if (format === 'xlsx') {
        const buffer = await exportService.exportToExcel(options);
        fs.writeFileSync(filePath, buffer);
      } else if (format === 'pdf') {
        const buffer = await exportService.exportToPDF(options);
        fs.writeFileSync(filePath, buffer);
      } else {
        return { success: false, error: `Unsupported format: ${format}` };
      }

      logInfo(`Report generated: ${filePath}`, { recordCount: options.data.length });

      return {
        success: true,
        filePath,
        fileName: options.filename,
        recordCount: options.data.length,
      };
    } catch (error) {
      logError('Failed to write report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write report',
      };
    }
  }

  /**
   * Get list of available reports for download
   */
  async listReports(userId?: string): Promise<{ fileName: string; createdAt: Date; size: number }[]> {
    const files = fs.readdirSync(REPORTS_DIR);

    return files
      .map((fileName) => {
        const filePath = path.join(REPORTS_DIR, fileName);
        const stats = fs.statSync(filePath);
        return {
          fileName,
          createdAt: stats.mtime,
          size: stats.size,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get report file path for download
   */
  getReportPath(fileName: string): string | null {
    const filePath = path.join(REPORTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Clean up old reports
   */
  async cleanupOldReports(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const files = fs.readdirSync(REPORTS_DIR);
    let deletedCount = 0;

    for (const fileName of files) {
      const filePath = path.join(REPORTS_DIR, fileName);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logInfo(`Cleaned up ${deletedCount} old reports`);
    return deletedCount;
  }
}

export const reportGeneratorService = new ReportGeneratorService();
export default reportGeneratorService;
