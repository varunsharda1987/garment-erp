// Export Controller - Handle data export requests
import { Request, Response } from 'express';
import exportService from '../services/export.service';
import templateService from '../services/template.service';
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../errors';

/**
 * Export data from a module
 * POST /api/export/:module
 * Body: { format: 'csv' | 'excel' | 'pdf', templateId?: string, filters?: object }
 */
export const exportData = async (req: Request, res: Response) => {
  const { module } = req.params;
  const { format = 'csv', templateId, filters = {} } = req.body;

  // Get template (either provided or default)
  let template;
  let columnConfig: { fieldName: string; displayName: string }[];

  if (templateId) {
    template = await templateService.getTemplateById(templateId);
    if (!template) {
      throw new NotFoundError('Template', templateId);
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
        throw new ValidationError(
          `No default columns configured for module '${module}'. Please create an export template.`
        );
      }
      columnConfig = availableColumns.map((col) => ({
        fieldName: col.fieldName,
        displayName: col.displayName,
      }));
    }
  }

  // Fetch data from database based on module
  const data = await fetchModuleData(module, filters);

  if (!data || data.length === 0) {
    throw new NotFoundError('No data found to export');
  }

  const exportOptions = {
    columns: columnConfig,
    data,
    filename: `${module}_export_${new Date().toISOString().split('T')[0]}`,
    title: template?.templateName || `${module} Export`,
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
      throw new ValidationError('Invalid format. Use csv, excel, or pdf.');
  }

  // Set response headers for download
  const filename = `${exportOptions.filename}.${fileExtension}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Send file
  res.send(result);
};

/**
 * Per-module allowlist of SCALAR filter fields that may be forwarded into the
 * Prisma `where` clause. Anything not listed here is dropped, so a caller can
 * never override `isActive` or inject nested relation-operator objects (which
 * validateBody(exportBodySchema) also rejects up front). Keep in sync with the
 * filters the frontend ExportButton actually sends.
 */
const EXPORT_FILTER_ALLOWLIST: Record<string, string[]> = {
  customers: ['category'],
  suppliers: ['category', 'rating'],
  materials: ['categoryId', 'unit'],
  styles: ['stage', 'cadStatus'],
  orders: ['customerId', 'status', 'priority'],
  bom: [],
  chart_of_accounts: [],
  tax_masters: [],
  payment_terms: [],
  currencies: [],
  cost_centers: [],
  expense_types: [],
  bank_accounts: [],
  // cost_sheets / style_costing handle their own `approved` filter below.
};

/**
 * Reduce a raw filters object down to the per-module scalar allowlist.
 */
function sanitizeFilters(moduleName: string, filters: Record<string, unknown>): Record<string, unknown> {
  const allowed = EXPORT_FILTER_ALLOWLIST[moduleName] ?? [];
  const safe: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Fetch data from database based on module
 */
async function fetchModuleData(
  moduleName: string,
  filters: Record<string, unknown> = {}
): Promise<Record<string, unknown>[]> {
  // Build where clause from an allowlisted, scalar-only subset of filters.
  // Never spread the raw request filters (would allow isActive override / DoS).
  const safeFilters = sanitizeFilters(moduleName, filters);
  const where: Record<string, unknown> = { isActive: true, ...safeFilters };

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
            select: { firstName: true, lastName: true },
          },
        },
      });
      break;

    case 'bom':
      result = await prisma.order_bom.findMany({
        where,
        include: {
          style: true,
          items: {
            include: {
              material: true,
            },
          },
        },
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

    case 'cost_sheets':
    case 'style_costing': {
      // style_costing has no `isActive` column, so the default where ({ isActive: true, ... })
      // cannot be used. The ExportButton (CostSheetList.tsx) passes
      // { approved: 'all' | 'approved' | 'pending' | 'rejected' } -> map to approvalStatus.
      const approvedFilter = typeof filters.approved === 'string' ? (filters.approved as string).toLowerCase() : 'all';
      const costingWhere: Record<string, unknown> = {};
      if (approvedFilter === 'approved') costingWhere.approvalStatus = 'APPROVED';
      else if (approvedFilter === 'pending') costingWhere.approvalStatus = 'PENDING';
      else if (approvedFilter === 'rejected') costingWhere.approvalStatus = 'REJECTED';
      result = await prisma.style_costing.findMany({
        where: costingWhere,
        include: { styles: { select: { styleCode: true, styleName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      break;
    }

    default:
      throw new Error(`Module '${moduleName}' not supported for export`);
  }

  return result as Record<string, unknown>[];
}
