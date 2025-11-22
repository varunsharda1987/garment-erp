// Import Controller - Handle data import requests
import { Request, Response } from 'express';
import importService, { ImportColumn } from '../services/import.service';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Preview import data (first 100 rows with validation)
 * POST /api/import/:module/preview
 * Requires file upload (multipart/form-data)
 */
export const previewImport = async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get column configuration for this module
    const columns = getModuleColumns(module);

    const result = await importService.previewImport({
      columns,
      file: file as Express.Multer.File
    });

    res.json({
      success: true,
      preview: result
    });

  } catch (error: any) {
    logError('Import preview error:', error);
    res.status(500).json({
      error: 'Import preview failed',
      message: error.message
    });
  }
};

/**
 * Execute import (bulk insert with transaction)
 * POST /api/import/:module/execute
 * Requires file upload (multipart/form-data)
 */
export const executeImport = async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const file = req.file;
    const userId = (req as any).user?.id; // From auth middleware

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get column configuration for this module
    const columns = getModuleColumns(module);

    // Parse and validate file
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    let result;

    if (fileExtension === 'csv') {
      result = await importService.importFromCSV({ columns, file: file as Express.Multer.File });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      result = await importService.importFromExcel({ columns, file: file as Express.Multer.File });
    } else {
      return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel files.' });
    }

    // If there are errors, return them without importing
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found. Please fix and try again.',
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          invalidRows: result.invalidRows
        }
      });
    }

    // Execute import using transaction
    const importResult = await executeModuleImport(module, result.data!, userId);

    res.json({
      success: true,
      message: `Successfully imported ${importResult.count} records`,
      summary: {
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        importedRows: importResult.count
      }
    });

  } catch (error: any) {
    logError('Import execution error:', error);
    res.status(500).json({
      error: 'Import execution failed',
      message: error.message
    });
  }
};

/**
 * Download import template
 * GET /api/import/:module/template?format=csv|excel
 */
export const downloadTemplate = async (req: Request, res: Response) => {
  try {
    const { module } = req.params;
    const { format = 'excel' } = req.query;

    // Get column configuration for this module
    const columns = getModuleColumns(module);

    let result: string | Buffer;
    let contentType: string;
    let fileExtension: string;

    if (format === 'csv') {
      result = importService.generateTemplate(columns);
      contentType = 'text/csv';
      fileExtension = 'csv';
    } else {
      result = await importService.generateExcelTemplate(columns, module);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
    }

    const filename = `${module}_import_template.${fileExtension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result);

  } catch (error: any) {
    logError('Template download error:', error);
    res.status(500).json({
      error: 'Template download failed',
      message: error.message
    });
  }
};

/**
 * Get column configuration for a module
 */
function getModuleColumns(moduleName: string): ImportColumn[] {
  const moduleColumns: Record<string, ImportColumn[]> = {
    customers: [
      { fieldName: 'code', displayName: 'Customer Code', required: true, type: 'text' },
      { fieldName: 'name', displayName: 'Customer Name', required: true, type: 'text' },
      { fieldName: 'type', displayName: 'Type', required: true, type: 'text' },
      { fieldName: 'category', displayName: 'Category', required: true, type: 'text' },
      { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
      { fieldName: 'email', displayName: 'Email', type: 'email' },
      { fieldName: 'phone', displayName: 'Phone', type: 'text' },
      { fieldName: 'billingAddress', displayName: 'Billing Address', type: 'text' },
      { fieldName: 'shippingAddress', displayName: 'Shipping Address', type: 'text' },
      { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
      { fieldName: 'creditLimit', displayName: 'Credit Limit', type: 'number' },
      { fieldName: 'creditDays', displayName: 'Credit Days', type: 'number' }
    ],
    suppliers: [
      { fieldName: 'code', displayName: 'Supplier Code (Auto-generated if empty)', required: false, type: 'text' },
      { fieldName: 'name', displayName: 'Supplier Name', required: true, type: 'text' },
      { fieldName: 'supplierCategory', displayName: 'Category', required: true, type: 'text' },
      { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
      { fieldName: 'email', displayName: 'Email', type: 'email' },
      { fieldName: 'phone', displayName: 'Phone', type: 'text' },
      { fieldName: 'address', displayName: 'Address', type: 'text' },
      { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
      { fieldName: 'paymentTerms', displayName: 'Payment Terms', type: 'text' },
      { fieldName: 'rating', displayName: 'Rating', type: 'number' }
    ],
    materials: [
      { fieldName: 'code', displayName: 'Material Code', required: true, type: 'text' },
      { fieldName: 'name', displayName: 'Material Name', required: true, type: 'text' },
      { fieldName: 'category', displayName: 'Category', required: true, type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
      { fieldName: 'unit', displayName: 'Unit', required: true, type: 'text' },
      { fieldName: 'costPerUnit', displayName: 'Cost Per Unit', type: 'number' },
      { fieldName: 'reorderLevel', displayName: 'Reorder Level', type: 'number' }
    ]
  };

  const columns = moduleColumns[moduleName];
  if (!columns) {
    throw new Error(`Module '${moduleName}' not supported for import`);
  }

  return columns;
}

/**
 * Execute import for a specific module
 */
async function executeModuleImport(moduleName: string, data: any[], userId: string) {
  // Use transaction to ensure all-or-nothing import
  return await prisma.$transaction(async (tx) => {
    let count = 0;

    switch (moduleName) {
      case 'customers':
        for (const row of data) {
          await tx.customers.create({
            data: {
              ...row,
              id: undefined, // Let Prisma generate UUID
              createdById: userId,
              isActive: true
            }
          });
          count++;
        }
        break;

      case 'suppliers':
        for (const row of data) {
          // Auto-generate code if not provided
          let code = row.code;
          if (!code || code.trim() === '') {
            // Get latest supplier to generate next code
            const latestSupplier = await tx.suppliers.findFirst({
              orderBy: { createdAt: 'desc' },
              select: { code: true }
            });

            let nextNumber = 1;
            if (latestSupplier && latestSupplier.code) {
              const match = latestSupplier.code.match(/SUP(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            code = `SUP${nextNumber.toString().padStart(6, '0')}`;
          }

          await tx.suppliers.create({
            data: {
              ...row,
              code,
              id: undefined,
              createdById: userId,
              isActive: true
            }
          });
          count++;
        }
        break;

      case 'materials':
        for (const row of data) {
          await tx.materials.create({
            data: {
              ...row,
              id: undefined,
              createdById: userId,
              isActive: true
            }
          });
          count++;
        }
        break;

      default:
        throw new Error(`Module '${moduleName}' not supported for import`);
    }

    return { count };
  });
}
