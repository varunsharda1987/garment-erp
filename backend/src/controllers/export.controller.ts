// Export Controller - Handle data export requests
import { Request, Response } from 'express';
import exportService from '../services/export.service';
import templateService from '../services/template.service';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Export data from a module
 * POST /api/export/:module
 * Body: { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 */
export const exportData = async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const { format = 'csv', templateId, filters = {} } = req.body;

    // Get template (either provided or default)
    let template;
    let columnConfig: { fieldName: string; displayName: string }[];

    if (templateId) {
      template = await templateService.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      columnConfig = template.columnConfig as { fieldName: string; displayName: string }[];
    } else {
      template = await templateService.getDefaultTemplate(module);
      if (template) {
        columnConfig = template.columnConfig as { fieldName: string; displayName: string }[];
      } else {
        // Use default columns from template service if no template exists
        const availableColumns = templateService.getAvailableColumns(module);
        if (availableColumns.length === 0) {
          return res.status(400).json({
            error: `No default columns configured for module '${module}'. Please create an export template.`
          });
        }
        columnConfig = availableColumns.map(col => ({
          fieldName: col.fieldName,
          displayName: col.displayName
        }));
      }
    }

    // Fetch data from database based on module
    const data = await fetchModuleData(module, filters);

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No data found to export' });
    }

    const exportOptions = {
      columns: columnConfig,
      data,
      filename: `${module}_export_${new Date().toISOString().split('T')[0]}`,
      title: template?.templateName || `${module} Export`
    };

    // Generate export based on format
    let result: string | Buffer;
    let contentType: string;
    let fileExtension: string;

    switch (format.toLowerCase()) {
      case 'csv':
        result = await exportService.exportToCSV(exportOptions);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'excel':
      case 'xlsx':
        result = await exportService.exportToExcel(exportOptions);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;

      case 'pdf':
        result = await exportService.exportToPDF(exportOptions);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;

      default:
        return res.status(400).json({ error: 'Invalid format. Use csv, excel, or pdf.' });
    }

    // Set response headers for download
    const filename = `${exportOptions.filename}.${fileExtension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send file
    if (typeof result === 'string') {
      res.send(result);
    } else {
      res.send(result);
    }

  } catch (error: unknown) {
    logError('Export error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Fetch data from database based on module
 */
async function fetchModuleData(moduleName: string, filters: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  // Build where clause from filters
  const where: Record<string, unknown> = { isActive: true, ...filters };

  let result: unknown[];

  switch (moduleName) {
    case 'customers':
      result = await prisma.customers.findMany({ where });
      break;

    case 'suppliers':
      result = await prisma.suppliers.findMany({ where });
      break;

    case 'materials':
      result = await prisma.materials.findMany({ where });
      break;

    case 'styles':
      result = await prisma.styles.findMany({ where });
      break;

    case 'orders':
      result = await prisma.orders.findMany({
        where,
        include: {
          customers: true,
          users_orders_createdByIdTousers: {
            select: { firstName: true, lastName: true }
          }
        }
      });
      break;

    case 'bom':
      result = await prisma.bill_of_materials.findMany({
        where,
        include: {
          styles: true,
          bom_items: {
            include: {
              materials: true
            }
          }
        }
      });
      break;

    case 'chart_of_accounts':
      result = await prisma.chart_of_accounts.findMany({ where });
      break;

    case 'tax_masters':
      result = await prisma.tax_masters.findMany({ where });
      break;

    case 'payment_terms':
      result = await prisma.payment_terms.findMany({ where });
      break;

    case 'currencies':
      result = await prisma.currencies.findMany({ where });
      break;

    case 'cost_centers':
      result = await prisma.cost_centers.findMany({ where });
      break;

    case 'expense_types':
      result = await prisma.expense_types.findMany({ where });
      break;

    case 'bank_accounts':
      result = await prisma.bank_accounts.findMany({ where });
      break;

    default:
      throw new Error(`Module '${moduleName}' not supported for export`);
  }

  return result as Record<string, unknown>[];
}
