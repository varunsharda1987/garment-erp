// Export Controller - Handle data export requests
import { Request, Response } from 'express';
import exportService from '../services/export.service';
import templateService from '../services/template.service';
import prisma from '../config/database';

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
    if (templateId) {
      template = await templateService.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
    } else {
      template = await templateService.getDefaultTemplate(module);
      if (!template) {
        return res.status(400).json({
          error: 'No default template found. Please specify a template ID or create a default template.'
        });
      }
    }

    const columnConfig = template.columnConfig as any[];

    // Fetch data from database based on module
    const data = await fetchModuleData(module, filters);

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No data found to export' });
    }

    const exportOptions = {
      columns: columnConfig,
      data,
      filename: `${module}_export_${new Date().toISOString().split('T')[0]}`,
      title: template.templateName || `${module} Export`
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

  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: error.message
    });
  }
};

/**
 * Fetch data from database based on module
 */
async function fetchModuleData(moduleName: string, filters: any = {}): Promise<any[]> {
  // Build where clause from filters
  const where: any = { isActive: true, ...filters };

  switch (moduleName) {
    case 'customers':
      return await prisma.customers.findMany({ where });

    case 'suppliers':
      return await prisma.suppliers.findMany({ where });

    case 'materials':
      return await prisma.materials.findMany({ where });

    case 'styles':
      return await prisma.styles.findMany({ where });

    case 'orders':
      return await prisma.orders.findMany({
        where,
        include: {
          customers: true,
          users_orders_createdByIdTousers: {
            select: { firstName: true, lastName: true }
          }
        }
      });

    case 'bom':
      return await prisma.bill_of_materials.findMany({
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

    case 'chart_of_accounts':
      return await prisma.chart_of_accounts.findMany({ where });

    case 'tax_masters':
      return await prisma.tax_masters.findMany({ where });

    case 'payment_terms':
      return await prisma.payment_terms.findMany({ where });

    case 'currencies':
      return await prisma.currencies.findMany({ where });

    case 'cost_centers':
      return await prisma.cost_centers.findMany({ where });

    case 'expense_types':
      return await prisma.expense_types.findMany({ where });

    case 'bank_accounts':
      return await prisma.bank_accounts.findMany({ where });

    default:
      throw new Error(`Module '${moduleName}' not supported for export`);
  }
}
