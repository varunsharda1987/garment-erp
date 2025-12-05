// Style Import Controller
// Handles HTTP requests for bulk style import

import { Request, Response } from 'express';
import StyleImportService from '../services/style-import.service';
import { StyleImportCSVRow } from '../types/style-import.types';
import * as XLSX from 'xlsx';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

class StyleImportController {
  /**
   * Import styles from CSV/Excel file
   * POST /api/styles/import
   */
  async importStyles(req: Request, res: Response) {
    try {
      const { overwriteExisting, skipDuplicates } = req.body;
      const userId = req.user?.userId || 'system';

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please upload a CSV or Excel file.',
        });
      }

      // Parse the file
      let csvRows: StyleImportCSVRow[];

      if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
        // Parse CSV
        csvRows = this.parseCSV(req.file.buffer);
      } else if (
        req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        req.file.originalname.endsWith('.xlsx')
      ) {
        // Parse Excel
        csvRows = this.parseExcel(req.file.buffer);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid file format. Please upload a CSV or Excel file.',
        });
      }

      if (csvRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'File is empty or has no valid data.',
        });
      }

      // Generate import batch ID
      const importBatchId = `IMP-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Process import
      const result = await StyleImportService.importStylesFromCSV(
        csvRows,
        importBatchId,
        userId,
        { overwriteExisting, skipDuplicates }
      );

      return res.status(result.success ? 200 : 207).json(result);
    } catch (error: unknown) {
      logError('Style import error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import styles',
      });
    }
  }

  /**
   * Get import status
   * GET /api/styles/import/:batchId
   */
  async getImportStatus(req: Request, res: Response) {
    try {
      const { batchId } = req.params;

      const status = await StyleImportService.getImportStatus(batchId);

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: unknown) {
      logError('Get import status error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get import status',
      });
    }
  }

  /**
   * Retry failed imports
   * POST /api/styles/import/:batchId/retry
   */
  async retryImport(req: Request, res: Response) {
    try {
      const { batchId } = req.params;
      const userId = req.user?.userId || 'system';

      const result = await StyleImportService.retryFailedImports(batchId, userId);

      return res.status(200).json(result);
    } catch (error: unknown) {
      logError('Retry import error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retry import',
      });
    }
  }

  /**
   * Download sample CSV template
   * GET /api/styles/import/template
   */
  async downloadTemplate(req: Request, res: Response) {
    try {
            // Define column headers with their required/optional status
      const columns = [
        { header: 'Status', required: false },
        { header: 'StyleCode', required: true },
        { header: 'SKU', required: false },
        { header: 'Size', required: false },
        { header: 'Color', required: false },
        { header: 'Category', required: false },
        { header: 'ProductName', required: false },
        { header: 'ItemDescription', required: false },
        { header: 'Bullet Points', required: false },
        { header: 'Customer', required: true },
        { header: 'Brand', required: false },
        { header: 'Season', required: false },
        { header: 'Gender', required: false },
        { header: 'ProjectGroup', required: false },
        { header: 'ComponentName', required: false },
        { header: 'GreigeName', required: false },
        { header: 'FabricDescription', required: false },
        { header: 'CADAverage', required: false },
        { header: 'LastProductionAverage', required: false },
        { header: 'FabricWidth', required: false },
        { header: 'Dyeing', required: false },
        { header: 'DyeingColor', required: false },
        { header: 'DyeingVendor', required: false },
        { header: 'Printing', required: false },
        { header: 'PrintingDetails', required: false },
        { header: 'PrintingVendor', required: false },
        { header: 'Embroidery', required: false },
        { header: 'EmbroideryDetails', required: false },
        { header: 'EmbroideryVendor', required: false },
        { header: 'Washing', required: false },
        { header: 'WashType', required: false },
        { header: 'WashingVendor', required: false },
        { header: 'ImageURL', required: false },
        { header: 'COST', required: false },
        { header: 'MRP', required: false },
        { header: 'AccountingSKU', required: false },
        { header: 'AccountingUnit', required: false },
        { header: 'ProductTaxRule', required: false },
        { header: 'HSNCode', required: false },
        { header: 'Created Date', required: false },
        { header: 'Last Updated Date', required: false },
        { header: 'Material Type', required: false },
      ];

      // Create header row
      const headerRow = columns.map(col => col.header);

      // Create Required/Optional indicator row
      const requiredRow = columns.map(col => col.required ? 'Required' : 'Optional');

      // Sample data rows
      const sampleData = [
        ['Active', 'GC-001', 'GC-001-M-NAVY', 'M', 'Navy Blue', 'ETHNIC', "Men's Kurta Set",
          'Premium cotton kurta set for festive occasions', 'Comfortable fabric, Traditional design, Easy to maintain',
          'Fashion Boutique Pvt Ltd', 'Kashaya Fabs', 'Festival 2024', 'MALE', 'Ganesh Chaturthi',
          'Body', 'Cotton Poplin 40x40 Greige', 'Navy Blue Poplin Cotton 40x40', 2.35, 2.4, 58,
          'Yes', 'Navy Blue', 'Premium Dyers Ltd', '', '', '', '', '', '',
          'Yes', 'Enzyme Wash', 'Modern Wash House', 'https://example.com/images/gc-001.jpg',
          450, 899, 'ACC-GC-001', 'PCS', 'GST 18%', '6203', '2025-01-21', '2025-01-21', 'Cotton'],
        ['Active', 'GC-001', 'GC-001-M-NAVY', 'M', 'Navy Blue', 'ETHNIC', "Men's Kurta Set",
          'Premium cotton kurta set for festive occasions', 'Comfortable fabric, Traditional design, Easy to maintain',
          'Fashion Boutique Pvt Ltd', 'Kashaya Fabs', 'Festival 2024', 'MALE', 'Ganesh Chaturthi',
          'Sleeve', 'Cotton Poplin 40x40 Greige', 'Navy Blue Poplin Cotton 40x40', 0.85, 0.82, 58,
          'Yes', 'Navy Blue', 'Premium Dyers Ltd', '', '', '', '', '', '',
          '', '', '', 'https://example.com/images/gc-001.jpg',
          450, 899, 'ACC-GC-001', 'PCS', 'GST 18%', '6203', '2025-01-21', '2025-01-21', 'Cotton'],
      ];

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Create sheet data with headers, required/optional row, and sample data
      const sheetData = [headerRow, requiredRow, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths for better readability
      const colWidths = columns.map(col => ({ wch: Math.max(col.header.length + 2, 15) }));
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Style Import Template');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=style_import_template.xlsx'
      );

      return res.send(buffer);
    } catch (error: unknown) {
      logError('Download template error:', error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to download template',
      });
    }
  }

  /**
   * Parse CSV file
   */
  private parseCSV(buffer: Buffer): StyleImportCSVRow[] {
    const csvText = buffer.toString('utf-8');
    const lines = csvText.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file must have header and at least one data row');
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

    // Parse rows - skip the second row if it contains Required/Optional indicators
    const rows: StyleImportCSVRow[] = [];
    let startIndex = 1;

    // Check if second row is a Required/Optional indicator row
    if (lines.length > 1) {
      const secondRowValues = lines[1].split(',').map((v) => v.trim().replace(/"/g, '').toLowerCase());
      const isIndicatorRow = secondRowValues.every(val =>
        val === '' || val === 'required' || val === 'optional'
      );
      if (isIndicatorRow) {
        startIndex = 2; // Skip the indicator row
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const row: Record<string, string | undefined> = {};

      headers.forEach((header, index) => {
        row[this.normalizeHeaderName(header)] = values[index];
      });

      rows.push(row as unknown as StyleImportCSVRow);
    }

    return rows;
  }

  /**
   * Parse Excel file
   */
  private parseExcel(buffer: Buffer): StyleImportCSVRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get raw data as array of arrays to check for indicator row
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as string[][];

    if (rawData.length < 2) {
      return [];
    }

    const headers = rawData[0];
    let dataStartRow = 1;

    // Check if second row is a Required/Optional indicator row
    if (rawData.length > 1) {
      const secondRow = rawData[1];
      const isIndicatorRow = secondRow.every(val => {
        const normalized = (val || '').toString().toLowerCase().trim();
        return normalized === '' || normalized === 'required' || normalized === 'optional';
      });
      if (isIndicatorRow) {
        dataStartRow = 2; // Skip the indicator row
      }
    }

    // Convert remaining rows to objects
    const rows: StyleImportCSVRow[] = [];
    for (let i = dataStartRow; i < rawData.length; i++) {
      const rowData = rawData[i];
      if (!rowData || rowData.length === 0) continue;

      const normalized: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) {
          normalized[this.normalizeHeaderName(header)] = rowData[index];
        }
      });
      rows.push(normalized as unknown as StyleImportCSVRow);
    }

    return rows;
  }

  /**
   * Normalize header name to match expected field names
   */
  private normalizeHeaderName(header: string): string {
    const mapping: Record<string, string> = {
      // Status and Identification
      status: 'status',
      stylecode: 'styleCode',
      sku: 'sku',
      size: 'size',
      color: 'color',

      // Product Information
      category: 'category',
      productname: 'productName',
      itemdescription: 'itemDescription',
      bulletpoints: 'bulletPoints',
      projectgroup: 'projectGroup',

      // Business Information
      customer: 'customer',
      brand: 'brand',
      season: 'season',
      gender: 'gender',

      // Component and Fabric Details
      componentname: 'componentName',
      fabricdescription: 'fabricDescription',
      cadaverage: 'cadAverage',
      lastproductionaverage: 'lastProductionAverage',
      fabricwidth: 'fabricWidth',

      // Financial Information
      imageurl: 'imageURL',
      cost: 'cost',
      mrp: 'mrp',

      // Accounting Information
      accountingsku: 'accountingSKU',
      accountingunit: 'accountingUnit',
      producttaxrule: 'productTaxRule',
      hsncode: 'hsnCode',

      // Metadata
      createddate: 'createdDate',
      lastupdateddate: 'lastUpdatedDate',
      materialtype: 'materialType',
    };

    const normalized = header.toLowerCase().replace(/\s+/g, '');
    return mapping[normalized] || header;
  }
}

export default new StyleImportController();
