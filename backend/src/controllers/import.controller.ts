// Import Controller - Handle data import requests
import { Request, Response } from 'express';
import importService, { ImportColumn } from '../services/import.service';
import prisma from '../config/database';
import { Prisma, SupplierCategory } from '@prisma/client';
import { logInfo, logDebug } from '../utils/logger';
import { ValidationError, UnauthorizedError } from '../errors';
import { cleanupTempFile } from '../middleware/upload.middleware';

/**
 * Helper: Safely get string value from unknown type
 */
function getStringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

/**
 * Supplier Category mapping: Human-readable name to enum value
 */
const SUPPLIER_CATEGORY_MAP: Record<string, string> = {
  // Human readable names
  'fabric supplier': 'FABRIC_SUPPLIER',
  fabric: 'FABRIC_SUPPLIER',
  'trims supplier': 'TRIMS_SUPPLIER',
  trims: 'TRIMS_SUPPLIER',
  'trims & accessories': 'TRIMS_SUPPLIER',
  'trims accessories': 'TRIMS_SUPPLIER',
  'thread supplier': 'THREAD_SUPPLIER',
  thread: 'THREAD_SUPPLIER',
  'packaging supplier': 'PACKAGING_SUPPLIER',
  packaging: 'PACKAGING_SUPPLIER',
  'lace supplier': 'LACE_SUPPLIER',
  lace: 'LACE_SUPPLIER',
  'dyeing & printing': 'DYEING_PRINTING',
  'dyeing printing': 'DYEING_PRINTING',
  dyeing: 'DYEING_PRINTING',
  printing: 'DYEING_PRINTING',
  embroidery: 'EMBROIDERY',
  'hand work': 'HAND_WORK',
  handwork: 'HAND_WORK',
  smocking: 'SMOCKING',
  'cmt unit': 'CMT_UNIT',
  cmt: 'CMT_UNIT',
  'finishing contractor': 'FINISHING_CONTRACTOR',
  finishing: 'FINISHING_CONTRACTOR',
  'stitching contractor': 'STITCHING_CONTRACTOR',
  stitching: 'STITCHING_CONTRACTOR',
  washing: 'WASHING',
  // Dori/Piping variations (all normalized to 'dori piping' with space)
  'dori piping contractor': 'DORI_PIPING_CONTRACTOR',
  'dori piping': 'DORI_PIPING_CONTRACTOR',
  'dori/piping contractor': 'DORI_PIPING_CONTRACTOR',
  'dori/piping': 'DORI_PIPING_CONTRACTOR',
  'dori/ piping contractor': 'DORI_PIPING_CONTRACTOR',
  'dori /piping contractor': 'DORI_PIPING_CONTRACTOR',
  'dori / piping contractor': 'DORI_PIPING_CONTRACTOR',
  'machine parts supplier': 'MACHINE_PARTS_SUPPLIER',
  'machine parts': 'MACHINE_PARTS_SUPPLIER',
  'other services': 'OTHER_SERVICES',
  other: 'OTHER_SERVICES',
  // Also accept enum values directly (case-insensitive)
  fabric_supplier: 'FABRIC_SUPPLIER',
  trims_supplier: 'TRIMS_SUPPLIER',
  thread_supplier: 'THREAD_SUPPLIER',
  packaging_supplier: 'PACKAGING_SUPPLIER',
  lace_supplier: 'LACE_SUPPLIER',
  dyeing_printing: 'DYEING_PRINTING',
  hand_work: 'HAND_WORK',
  cmt_unit: 'CMT_UNIT',
  finishing_contractor: 'FINISHING_CONTRACTOR',
  stitching_contractor: 'STITCHING_CONTRACTOR',
  dori_piping_contractor: 'DORI_PIPING_CONTRACTOR',
  machine_parts_supplier: 'MACHINE_PARTS_SUPPLIER',
  other_services: 'OTHER_SERVICES',
};

/**
 * Convert supplier category text to enum value
 */
function mapSupplierCategory(value: string): string {
  // Normalize: lowercase, trim, and collapse multiple spaces/slashes
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s\/]+/g, ' ')
    .trim();

  // Check the map first
  if (SUPPLIER_CATEGORY_MAP[normalized]) {
    return SUPPLIER_CATEGORY_MAP[normalized];
  }

  // Also try with slashes preserved for exact match
  const withSlash = value.toLowerCase().trim();
  if (SUPPLIER_CATEGORY_MAP[withSlash]) {
    return SUPPLIER_CATEGORY_MAP[withSlash];
  }

  // Fallback: convert to enum format (uppercase with underscores)
  return value
    .toUpperCase()
    .replace(/[\s\/\-&]+/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Convert comma-separated supplier categories to array of enum values
 */
function mapSupplierCategories(value: string): string[] {
  // Split by comma and map each category
  const categories = value
    .split(',')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0);
  return categories.map((cat) => mapSupplierCategory(cat));
}

/**
 * Preview import data (first 100 rows with validation)
 * POST /api/import/:module/preview
 * Requires file upload (multipart/form-data)
 */
export const previewImport = async (req: Request, res: Response) => {
  const { module } = req.params;
  const file = req.file;

  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  try {
    // Get column configuration for this module
    const columns = getModuleColumns(module);

    const result = await importService.previewImport({
      columns,
      file: file as Express.Multer.File,
    });

    res.json({
      success: true,
      preview: result,
    });
  } finally {
    // Always remove the uploaded spreadsheet (may contain bank/GST/customer PII)
    // from the web-served temp dir, whether the import succeeded or failed.
    cleanupTempFile(file.path);
  }
};

/**
 * Execute import (bulk insert with transaction)
 * POST /api/import/:module/execute
 * Requires file upload (multipart/form-data)
 */
export const executeImport = async (req: Request, res: Response) => {
  const { module } = req.params;
  const file = req.file;
  const userId = req.user?.userId; // From auth middleware

  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  try {
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
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
      throw new ValidationError('Unsupported file format. Use CSV or Excel files.');
    }

    // If there are errors, return them without importing
    if (!result.success) {
      throw new ValidationError('Validation errors found. Please fix and try again.', {
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          invalidRows: result.invalidRows,
        },
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
        importedRows: importResult.count,
      },
    });
  } finally {
    // Always remove the uploaded spreadsheet (may contain bank/GST/customer PII)
    // from the web-served temp dir, whether the import succeeded or failed.
    cleanupTempFile(file.path);
  }
};

/**
 * Download import template
 * GET /api/import/:module/template?format=csv|excel
 */
export const downloadTemplate = async (req: Request, res: Response) => {
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

  // Set proper headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(result));
  res.setHeader('Cache-Control', 'no-cache');

  res.send(result);
};

/**
 * Get column configuration for a module
 */
function getModuleColumns(moduleName: string): ImportColumn[] {
  const moduleColumns: Record<string, ImportColumn[]> = {
    customers: [
      { fieldName: 'code', displayName: 'Customer Code (Auto-generated if empty)', required: false, type: 'text' },
      { fieldName: 'name', displayName: 'Customer Name', required: true, type: 'text' },
      { fieldName: 'type', displayName: 'Type (BUYER if empty)', required: false, type: 'text' },
      { fieldName: 'category', displayName: 'Category (DOMESTIC if empty)', required: false, type: 'text' },
      { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
      { fieldName: 'email', displayName: 'Email', type: 'email' },
      { fieldName: 'phone', displayName: 'Phone', type: 'text' },
      { fieldName: 'billingAddress', displayName: 'Billing Address', type: 'text' },
      { fieldName: 'shippingAddress', displayName: 'Shipping Address', type: 'text' },
      { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
      { fieldName: 'creditLimit', displayName: 'Credit Limit', type: 'number' },
      { fieldName: 'creditDays', displayName: 'Credit Days', type: 'number' },
    ],
    suppliers: [
      { fieldName: 'code', displayName: 'Supplier Code (Auto-generated if empty)', required: false, type: 'text' },
      { fieldName: 'name', displayName: 'Supplier Name', required: true, type: 'text' },
      { fieldName: 'supplierCategories', displayName: 'Categories (comma-separated)', required: true, type: 'text' },
      { fieldName: 'contactPerson', displayName: 'Contact Person', type: 'text' },
      { fieldName: 'email', displayName: 'Email', type: 'email' },
      { fieldName: 'phone', displayName: 'Phone', type: 'text' },
      { fieldName: 'address', displayName: 'Address', type: 'text' },
      { fieldName: 'gstNumber', displayName: 'GST Number', type: 'text' },
      { fieldName: 'paymentTerms', displayName: 'Payment Terms', type: 'text' },
      { fieldName: 'rating', displayName: 'Rating', type: 'number' },
      { fieldName: 'bankName', displayName: 'Bank Name', type: 'text' },
      { fieldName: 'bankAccountNumber', displayName: 'Bank Account Number', type: 'text' },
      { fieldName: 'ifscCode', displayName: 'IFSC Code', type: 'text' },
    ],
    materials: [
      { fieldName: 'code', displayName: 'Material Code', required: true, type: 'text' },
      { fieldName: 'name', displayName: 'Material Name', required: true, type: 'text' },
      { fieldName: 'category', displayName: 'Category', required: true, type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
      { fieldName: 'unit', displayName: 'Unit', required: true, type: 'text' },
      { fieldName: 'costPerUnit', displayName: 'Cost Per Unit', type: 'number' },
      { fieldName: 'reorderLevel', displayName: 'Reorder Level', type: 'number' },
    ],
    lace: [
      {
        fieldName: 'laceCode',
        displayName: 'Lace Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'laceName',
        displayName: 'Lace Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'width', displayName: 'Width (cm)', type: 'number' },
      { fieldName: 'design', displayName: 'Design', type: 'text' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'composition', displayName: 'Composition', type: 'text' },
      { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    buttons: [
      {
        fieldName: 'buttonCode',
        displayName: 'Button Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'buttonName',
        displayName: 'Button Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'size', displayName: 'Size', type: 'text' },
      { fieldName: 'holes', displayName: 'Holes', type: 'number' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'material', displayName: 'Material', type: 'text' },
      { fieldName: 'shape', displayName: 'Shape', type: 'text' },
      { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
      { fieldName: 'pricePerGross', displayName: 'Price Per Gross', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    threads: [
      {
        fieldName: 'threadCode',
        displayName: 'Thread Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'threadName',
        displayName: 'Thread Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'threadCount', displayName: 'Thread Count', type: 'text' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'colorCode', displayName: 'Color Code', type: 'text' },
      { fieldName: 'composition', displayName: 'Composition', type: 'text' },
      { fieldName: 'threadType', displayName: 'Thread Type', type: 'text' },
      { fieldName: 'coneSize', displayName: 'Cone Size', type: 'text' },
      { fieldName: 'pricePerCone', displayName: 'Price Per Cone', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    zippers: [
      {
        fieldName: 'zipperCode',
        displayName: 'Zipper Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'zipperName',
        displayName: 'Zipper Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'length', displayName: 'Length (inches)', type: 'number' },
      { fieldName: 'teethType', displayName: 'Teeth Type (Metal/Plastic/Nylon/Invisible)', type: 'text' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'brand', displayName: 'Brand', type: 'text' },
      { fieldName: 'sliderType', displayName: 'Slider Type', type: 'text' },
      { fieldName: 'tapeWidth', displayName: 'Tape Width (mm)', type: 'number' },
      { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    elastic: [
      {
        fieldName: 'elasticCode',
        displayName: 'Elastic Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'elasticName',
        displayName: 'Elastic Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'width', displayName: 'Width (mm)', type: 'number' },
      { fieldName: 'stretchPercent', displayName: 'Stretch Percentage', type: 'number' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'composition', displayName: 'Composition', type: 'text' },
      { fieldName: 'elasticType', displayName: 'Elastic Type (Woven/Knitted/Braided)', type: 'text' },
      { fieldName: 'pricePerMeter', displayName: 'Price Per Meter', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    labels: [
      {
        fieldName: 'labelCode',
        displayName: 'Label Code (Auto-generated if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      {
        fieldName: 'labelName',
        displayName: 'Label Name (Auto-generated from attributes if empty)',
        required: false,
        type: 'text',
        autoGenerated: true,
      },
      { fieldName: 'supplierCode', displayName: 'Supplier Code', type: 'text' },
      { fieldName: 'buyerCode', displayName: 'Buyer Code', type: 'text' },
      { fieldName: 'labelType', displayName: 'Label Type (Woven/Printed/Care/Size/Hangtag)', type: 'text' },
      { fieldName: 'size', displayName: 'Size/Dimensions', type: 'text' },
      { fieldName: 'content', displayName: 'Content/Text', type: 'text' },
      { fieldName: 'printMethod', displayName: 'Print Method (Screen/Digital/Woven/Embossed)', type: 'text' },
      { fieldName: 'material', displayName: 'Material (Satin/Taffeta/Paper)', type: 'text' },
      { fieldName: 'color', displayName: 'Color', type: 'text' },
      { fieldName: 'pricePerPiece', displayName: 'Price Per Piece', type: 'number' },
      { fieldName: 'pricePerHundred', displayName: 'Price Per Hundred', type: 'number' },
      { fieldName: 'supplierId', displayName: 'Supplier ID (Optional)', type: 'text' },
      { fieldName: 'description', displayName: 'Description', type: 'text' },
    ],
    // NOTE: Greige, Fabric, and Style have dedicated bulk import endpoints:
    // - Greige: Use /fabric-greige/bulk-import pages (GreigeBulkImport.tsx)
    // - Fabric: Use /fabric-greige/bulk-import pages (FabricBulkImport.tsx)
    // - Style: Use /api/styles/import (StyleBulkImport.tsx) - comprehensive template with fabrics
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
async function executeModuleImport(moduleName: string, data: Record<string, unknown>[], userId: string) {
  // Use transaction to ensure all-or-nothing import
  return await prisma.$transaction(async (tx) => {
    let count = 0;

    switch (moduleName) {
      case 'customers':
        for (const row of data) {
          // Auto-generate code if not provided
          let code = getStringValue(row.code);
          if (!code) {
            // Get latest customer to generate next code
            const latestCustomer = await tx.customers.findFirst({
              where: {
                code: {
                  startsWith: 'CUST-',
                },
              },
              orderBy: { code: 'desc' },
              select: { code: true },
            });

            let nextNumber = 1;
            if (latestCustomer && latestCustomer.code) {
              const match = latestCustomer.code.match(/CUST-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            code = `CUST-${nextNumber.toString().padStart(4, '0')}`;
          }

          // Set defaults for type and category if not provided
          const type = getStringValue(row.type) || 'BUYER';
          const category = getStringValue(row.category) || 'DOMESTIC';

          // Remove id from row to let Prisma auto-generate it
          const { id, ...rowData } = row;

          await tx.customers.create({
            data: {
              ...rowData,
              name: getStringValue(row.name),
              code,
              type,
              category,
              businessType: getStringValue(row.businessType) || 'B2B',
              market: getStringValue(row.market) || 'DOMESTIC',
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.customersCreateInput,
          });
          count++;
        }
        break;

      case 'suppliers':
        for (const row of data) {
          // Auto-generate code if not provided
          let code = getStringValue(row.code);
          if (!code) {
            // Get latest supplier to generate next code
            const latestSupplier = await tx.suppliers.findFirst({
              orderBy: { createdAt: 'desc' },
              select: { code: true },
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

          // Remove id and supplierCategories from row to handle them separately
          const { id, supplierCategory: rawCategory, supplierCategories: rawCategories, ...rowData } = row;

          // Map supplier categories from human-readable to enum values (comma-separated)
          const categoryInput = getStringValue(rawCategories || rawCategory);
          const supplierCategories = mapSupplierCategories(categoryInput);

          await tx.suppliers.create({
            data: {
              ...rowData,
              name: getStringValue(row.name),
              supplierCategories: supplierCategories as SupplierCategory[],
              code,
              // Bank details
              bankName: getStringValue(row.bankName) || null,
              bankAccountNumber: getStringValue(row.bankAccountNumber) || null,
              ifscCode: getStringValue(row.ifscCode)?.toUpperCase() || null,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.suppliersCreateInput,
          });
          count++;
        }
        break;

      case 'materials':
        for (const row of data) {
          // Remove id from row to let Prisma auto-generate it
          const { id, ...rowData } = row;

          await tx.materials.create({
            data: {
              ...rowData,
              code: getStringValue(row.code),
              name: getStringValue(row.name),
              unit: getStringValue(row.unit),
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.materialsCreateInput,
          });
          count++;
        }
        break;

      case 'lace':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate laceCode if not provided
          let laceCode = getStringValue(rowData.laceCode);
          if (!laceCode) {
            const latestLace = await tx.lace_master.findFirst({
              where: {
                laceCode: {
                  startsWith: 'LACE-',
                },
              },
              orderBy: { laceCode: 'desc' },
              select: { laceCode: true },
            });

            let nextNumber = 1;
            if (latestLace && latestLace.laceCode) {
              const match = latestLace.laceCode.match(/LACE-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            laceCode = `LACE-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate laceName from attributes if not provided
          let laceName = getStringValue(rowData.laceName);
          if (!laceName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const color = getStringValue(rowData.color);
            const design = getStringValue(rowData.design);
            const composition = getStringValue(rowData.composition);
            const width = rowData.width;
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (color) parts.push(color);
            if (design) parts.push(design);
            if (composition) parts.push(composition);
            parts.push('Lace');
            if (width) parts.push(`${width}cm`);
            laceName = parts.join(' ').trim() || `Lace ${laceCode}`;
          }

          await tx.lace_master.create({
            data: {
              ...rowData,
              laceCode,
              laceName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.lace_masterCreateInput,
          });
          count++;
        }
        break;

      case 'buttons':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate buttonCode if not provided
          let buttonCode = getStringValue(rowData.buttonCode);
          if (!buttonCode) {
            const latestButton = await tx.button_master.findFirst({
              where: {
                buttonCode: {
                  startsWith: 'BTN-',
                },
              },
              orderBy: { buttonCode: 'desc' },
              select: { buttonCode: true },
            });

            let nextNumber = 1;
            if (latestButton && latestButton.buttonCode) {
              const match = latestButton.buttonCode.match(/BTN-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            buttonCode = `BTN-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate buttonName from attributes if not provided
          let buttonName = getStringValue(rowData.buttonName);
          if (!buttonName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const color = getStringValue(rowData.color);
            const material = getStringValue(rowData.material);
            const holes = rowData.holes;
            const size = getStringValue(rowData.size);
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (color) parts.push(color);
            if (material) parts.push(material);
            if (holes) parts.push(`${holes}-Hole`);
            parts.push('Button');
            if (size) parts.push(size);
            buttonName = parts.join(' ').trim() || `Button ${buttonCode}`;
          }

          await tx.button_master.create({
            data: {
              ...rowData,
              buttonCode,
              buttonName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.button_masterCreateInput,
          });
          count++;
        }
        break;

      case 'threads':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate threadCode if not provided
          let threadCode = getStringValue(rowData.threadCode);
          if (!threadCode) {
            const latestThread = await tx.thread_master.findFirst({
              where: {
                threadCode: {
                  startsWith: 'THD-',
                },
              },
              orderBy: { threadCode: 'desc' },
              select: { threadCode: true },
            });

            let nextNumber = 1;
            if (latestThread && latestThread.threadCode) {
              const match = latestThread.threadCode.match(/THD-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            threadCode = `THD-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate threadName from attributes if not provided
          let threadName = getStringValue(rowData.threadName);
          if (!threadName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const color = getStringValue(rowData.color);
            const threadType = getStringValue(rowData.threadType);
            const threadCount = getStringValue(rowData.threadCount);
            const composition = getStringValue(rowData.composition);
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (color) parts.push(color);
            if (threadType) parts.push(threadType);
            parts.push('Thread');
            if (threadCount) parts.push(threadCount);
            if (composition) parts.push(composition);
            threadName = parts.join(' ').trim() || `Thread ${threadCode}`;
          }

          await tx.thread_master.create({
            data: {
              ...rowData,
              threadCode,
              threadName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.thread_masterCreateInput,
          });
          count++;
        }
        break;

      case 'zippers':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate zipperCode if not provided
          let zipperCode = getStringValue(rowData.zipperCode);
          if (!zipperCode) {
            const latestZipper = await tx.zipper_master.findFirst({
              where: {
                zipperCode: {
                  startsWith: 'ZIP-',
                },
              },
              orderBy: { zipperCode: 'desc' },
              select: { zipperCode: true },
            });

            let nextNumber = 1;
            if (latestZipper && latestZipper.zipperCode) {
              const match = latestZipper.zipperCode.match(/ZIP-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            zipperCode = `ZIP-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate zipperName from attributes if not provided
          let zipperName = getStringValue(rowData.zipperName);
          if (!zipperName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const color = getStringValue(rowData.color);
            const teethType = getStringValue(rowData.teethType);
            const length = rowData.length;
            const brand = getStringValue(rowData.brand);
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (color) parts.push(color);
            if (teethType) parts.push(teethType);
            parts.push('Zipper');
            if (length) parts.push(`${length}"`);
            if (brand) parts.push(brand);
            zipperName = parts.join(' ').trim() || `Zipper ${zipperCode}`;
          }

          await tx.zipper_master.create({
            data: {
              ...rowData,
              zipperCode,
              zipperName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.zipper_masterCreateInput,
          });
          count++;
        }
        break;

      case 'elastic':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate elasticCode if not provided
          let elasticCode = getStringValue(rowData.elasticCode);
          if (!elasticCode) {
            const latestElastic = await tx.elastic_master.findFirst({
              where: {
                elasticCode: {
                  startsWith: 'ELS-',
                },
              },
              orderBy: { elasticCode: 'desc' },
              select: { elasticCode: true },
            });

            let nextNumber = 1;
            if (latestElastic && latestElastic.elasticCode) {
              const match = latestElastic.elasticCode.match(/ELS-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            elasticCode = `ELS-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate elasticName from attributes if not provided
          let elasticName = getStringValue(rowData.elasticName);
          if (!elasticName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const color = getStringValue(rowData.color);
            const elasticType = getStringValue(rowData.elasticType);
            const width = rowData.width;
            const composition = getStringValue(rowData.composition);
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (color) parts.push(color);
            if (elasticType) parts.push(elasticType);
            parts.push('Elastic');
            if (width) parts.push(`${width}mm`);
            if (composition) parts.push(composition);
            elasticName = parts.join(' ').trim() || `Elastic ${elasticCode}`;
          }

          await tx.elastic_master.create({
            data: {
              ...rowData,
              elasticCode,
              elasticName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.elastic_masterCreateInput,
          });
          count++;
        }
        break;

      case 'labels':
        for (const row of data) {
          const { id, ...rowData } = row;

          // Auto-generate labelCode if not provided
          let labelCode = getStringValue(rowData.labelCode);
          if (!labelCode) {
            const latestLabel = await tx.label_master.findFirst({
              where: {
                labelCode: {
                  startsWith: 'LBL-',
                },
              },
              orderBy: { labelCode: 'desc' },
              select: { labelCode: true },
            });

            let nextNumber = 1;
            if (latestLabel && latestLabel.labelCode) {
              const match = latestLabel.labelCode.match(/LBL-(\d+)/);
              if (match) {
                nextNumber = parseInt(match[1]) + 1;
              }
            }
            labelCode = `LBL-${nextNumber.toString().padStart(6, '0')}`;
          }

          // Auto-generate labelName from attributes if not provided
          let labelName = getStringValue(rowData.labelName);
          if (!labelName) {
            const parts: string[] = [];
            // Add buyer/style code first if present
            const buyerCode = getStringValue(rowData.buyerCode);
            const labelType = getStringValue(rowData.labelType);
            const color = getStringValue(rowData.color);
            const material = getStringValue(rowData.material);
            const size = getStringValue(rowData.size);
            if (buyerCode) parts.push(`[${buyerCode}]`);
            if (labelType) parts.push(labelType);
            if (color) parts.push(color);
            parts.push('Label');
            if (material) parts.push(material);
            if (size) parts.push(size);
            labelName = parts.join(' ').trim() || `Label ${labelCode}`;
          }

          await tx.label_master.create({
            data: {
              ...rowData,
              labelCode,
              labelName,
              createdById: userId,
              isActive: true,
            } as unknown as Prisma.label_masterCreateInput,
          });
          count++;
        }
        break;

      default:
        throw new Error(
          `Module '${moduleName}' not supported for import. Use dedicated endpoints for Greige/Fabric/Style imports.`
        );
    }

    return { count };
  });
}
