// Style Import Controller
// Handles HTTP requests for bulk style import

import { Request, Response } from 'express';
import StyleImportService from '../services/style-import.service';
import { StyleImportCSVRow } from '../types/style-import.types';
import * as XLSX from 'xlsx';
import { ValidationError } from '../errors';

class StyleImportController {
  /**
   * Import styles from CSV/Excel file
   * POST /api/styles/import
   */
  async importStyles(req: Request, res: Response) {
    const { overwriteExisting, skipDuplicates } = req.body;
    const userId = req.user?.userId || 'system';

    // Check if file was uploaded
    if (!req.file) {
      throw new ValidationError('No file uploaded. Please upload a CSV or Excel file.');
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
      throw new ValidationError('Invalid file format. Please upload a CSV or Excel file.');
    }

    if (csvRows.length === 0) {
      throw new ValidationError('File is empty or has no valid data.');
    }

    // Generate import batch ID
    const importBatchId = `IMP-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Process import
    const result = await StyleImportService.importStylesFromCSV(csvRows, importBatchId, userId, {
      overwriteExisting,
      skipDuplicates,
    });

    return res.status(result.success ? 200 : 207).json(result);
  }

  /**
   * Get import status
   * GET /api/styles/import/:batchId
   */
  async getImportStatus(req: Request, res: Response) {
    const { batchId } = req.params;

    const status = await StyleImportService.getImportStatus(batchId);

    return res.status(200).json({
      success: true,
      data: status,
    });
  }

  /**
   * Retry failed imports
   * POST /api/styles/import/:batchId/retry
   */
  async retryImport(req: Request, res: Response) {
    const { batchId } = req.params;
    const userId = req.user?.userId || 'system';

    const result = await StyleImportService.retryFailedImports(batchId, userId);

    return res.status(200).json(result);
  }

  /**
   * Download sample CSV template
   * GET /api/styles/import/template
   * Updated to use new simplified format with master lookups
   */
  async downloadTemplate(req: Request, res: Response) {
    // Define column headers with their required/optional status
    // New simplified format - one row per size variant
    const columns = [
      // Required fields
      { header: 'StyleCode', required: true },
      { header: 'CustomerName', required: true },
      { header: 'BrandName', required: true },
      { header: 'Size', required: true },
      // Optional fields
      { header: 'StyleName', required: false },
      { header: 'Season', required: false },
      { header: 'Gender', required: false },
      { header: 'BuyerCategory', required: false },
      { header: 'BuyerSubCategory', required: false },
      { header: 'BuyerSubSubCategory', required: false },
      { header: 'InternalCategory', required: false },
    ];

    // Create header row
    const headerRow = columns.map((col) => col.header);

    // Create Required/Optional indicator row
    const requiredRow = columns.map((col) => (col.required ? 'Required' : 'Optional'));

    // Sample data rows - one row per size
    const sampleData = [
      // Style COS009 with 4 sizes
      [
        'COS009',
        'ABC Corp',
        'Fabindia',
        'S',
        'Kurta Set Blue',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009',
        'ABC Corp',
        'Fabindia',
        'M',
        'Kurta Set Blue',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009',
        'ABC Corp',
        'Fabindia',
        'L',
        'Kurta Set Blue',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009',
        'ABC Corp',
        'Fabindia',
        'XL',
        'Kurta Set Blue',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      // Style COS009B (different colorway) with 4 sizes
      [
        'COS009B',
        'ABC Corp',
        'Fabindia',
        'S',
        'Kurta Set Mustard',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009B',
        'ABC Corp',
        'Fabindia',
        'M',
        'Kurta Set Mustard',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009B',
        'ABC Corp',
        'Fabindia',
        'L',
        'Kurta Set Mustard',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
      [
        'COS009B',
        'ABC Corp',
        'Fabindia',
        'XL',
        'Kurta Set Mustard',
        'Summer 2025',
        'WOMEN',
        'Ethnic Wear',
        'Kurta Sets',
        '',
        "Women's Ethnic",
      ],
    ];

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Create sheet data with headers, required/optional row, and sample data
    const sheetData = [headerRow, requiredRow, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths for better readability
    const colWidths = columns.map((col) => ({ wch: Math.max(col.header.length + 2, 20) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Style Import Template');

    // Add instructions sheet
    const instructionsData = [
      ['Style Import Template Instructions'],
      [''],
      ['REQUIRED FIELDS:'],
      ['StyleCode', 'Unique style identifier (colorways are separate styles, e.g., COS009, COS009B)'],
      ['CustomerName', 'Customer/Buyer name - MUST exist in the Customers master'],
      ['BrandName', 'Brand name - will be created if not exists'],
      ['Size', 'Size for this variant (one row per size) - S, M, L, XL, 4Y, etc.'],
      [''],
      ['OPTIONAL FIELDS:'],
      ['StyleName', 'Display name (defaults to StyleCode if not provided)'],
      ['Season', 'Season identifier (e.g., Summer 2025, Winter 2024)'],
      ['Gender', 'MEN, WOMEN, KIDS, or UNISEX (defaults to UNISEX)'],
      ['BuyerCategory', "Buyer's category (e.g., Ethnic Wear)"],
      ['BuyerSubCategory', "Buyer's sub-category (e.g., Kurta Sets)"],
      ['BuyerSubSubCategory', "Buyer's sub-sub-category (e.g., Full Sleeve)"],
      ['InternalCategory', 'Your internal category for organization'],
      [''],
      ['AUTO-GENERATED FIELDS:'],
      ['InternalCode', 'System generates: STYYYMM-XXXX (e.g., STY2607-0001)'],
      ['SKU', 'System generates: {StyleCode}{Size} (e.g., COS009S)'],
      ['Barcode', 'Same as SKU'],
      [''],
      ['NOTES:'],
      ['- Each row represents one size variant'],
      ['- Style-level data (name, season, etc.) is taken from the first row for each StyleCode'],
      ['- Customer MUST exist in the system before import'],
      ["- Brand categories are created automatically if they don't exist"],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 25 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=style_import_template.xlsx');

    return res.send(buffer);
  }

  /**
   * Split one CSV line into fields, honoring double-quoted fields that may contain commas and
   * escaped quotes (""). A naive split(',') corrupted every row with a comma inside a quoted value
   * — e.g. a style name "Kurta Set, Blue With Piping" shifted every column after it (BH-0262).
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"'; // escaped quote inside a quoted field
            i++;
          } else {
            inQuotes = false; // closing quote
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true; // opening quote
      } else if (ch === ',') {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields.map((f) => f.trim());
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
    const headers = this.parseCSVLine(lines[0]);

    // Parse rows - skip the second row if it contains Required/Optional indicators
    const rows: StyleImportCSVRow[] = [];
    let startIndex = 1;

    // Check if second row is a Required/Optional indicator row
    if (lines.length > 1) {
      const secondRowValues = this.parseCSVLine(lines[1]).map((v) => v.toLowerCase());
      const isIndicatorRow = secondRowValues.every((val) => val === '' || val === 'required' || val === 'optional');
      if (isIndicatorRow) {
        startIndex = 2; // Skip the indicator row
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
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
      const isIndicatorRow = secondRow.every((val) => {
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
   * Updated to support new simplified format
   */
  private normalizeHeaderName(header: string): string {
    const mapping: Record<string, string> = {
      // New required fields
      stylecode: 'styleCode',
      customername: 'customerName',
      brandname: 'brandName',
      size: 'size',

      // New optional fields
      stylename: 'styleName',
      season: 'season',
      gender: 'gender',
      buyercategory: 'buyerCategory',
      buyersubcategory: 'buyerSubCategory',
      buyersubsubcategory: 'buyerSubSubCategory',
      internalcategory: 'internalCategory',

      // Legacy field mappings (for backwards compatibility)
      status: 'status',
      sku: 'sku',
      color: 'color',
      category: 'category',
      productname: 'productName',
      itemdescription: 'itemDescription',
      bulletpoints: 'bulletPoints',
      projectgroup: 'projectGroup',
      customer: 'customer', // Legacy alias for customerName
      brand: 'brand', // Legacy alias for brandName
      componentname: 'componentName',
      greigename: 'greigeName',
      fabricdescription: 'fabricDescription',
      cadaverage: 'cadAverage',
      lastproductionaverage: 'lastProductionAverage',
      fabricwidth: 'fabricWidth',
      dyeing: 'dyeing',
      dyeingcolor: 'dyeingColor',
      dyeingvendor: 'dyeingVendor',
      printing: 'printing',
      printingdetails: 'printingDetails',
      printingvendor: 'printingVendor',
      embroidery: 'embroidery',
      embroiderydetails: 'embroideryDetails',
      embroideryvendor: 'embroideryVendor',
      washing: 'washing',
      washtype: 'washType',
      washingvendor: 'washingVendor',
      imageurl: 'imageURL',
      cost: 'cost',
      mrp: 'mrp',
      accountingsku: 'accountingSKU',
      accountingunit: 'accountingUnit',
      producttaxrule: 'productTaxRule',
      hsncode: 'hsnCode',
      createddate: 'createdDate',
      lastupdateddate: 'lastUpdatedDate',
      materialtype: 'materialType',
    };

    const normalized = header.toLowerCase().replace(/\s+/g, '').replace(/-/g, '').replace(/_/g, '');
    return mapping[normalized] || header;
  }
}

export default new StyleImportController();
