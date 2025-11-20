// Style Import Controller
// Handles HTTP requests for bulk style import

import { Request, Response } from 'express';
import StyleImportService from '../services/style-import.service';
import { StyleImportCSVRow } from '../types/style-import.types';
import * as XLSX from 'xlsx';

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
    } catch (error: any) {
      console.error('Style import error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to import styles',
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
    } catch (error: any) {
      console.error('Get import status error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get import status',
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
    } catch (error: any) {
      console.error('Retry import error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retry import',
      });
    }
  }

  /**
   * Download sample CSV template
   * GET /api/styles/import/template
   */
  async downloadTemplate(req: Request, res: Response) {
    try {
      const template = [
        {
          StyleCode: 'GC-001',
          ProjectGroup: 'Ganesh Chaturthi',
          ItemDescription: "Men's Kurta Set",
          Customer: 'Fashion Boutique Pvt Ltd',
          Season: 'Festival 2024',
          Gender: 'MALE',
          Category: 'ETHNIC',
          ComponentName: 'Body',
          FabricDescription: 'Navy Blue Poplin Cotton 40x40',
          CADAverage: 2.35,
          LastProductionAverage: 2.4,
          FabricWidth: 58,
        },
        {
          StyleCode: 'GC-001',
          ProjectGroup: 'Ganesh Chaturthi',
          ItemDescription: "Men's Kurta Set",
          Customer: 'Fashion Boutique Pvt Ltd',
          Season: 'Festival 2024',
          Gender: 'MALE',
          Category: 'ETHNIC',
          ComponentName: 'Sleeve',
          FabricDescription: 'Navy Blue Poplin Cotton 40x40',
          CADAverage: 0.85,
          LastProductionAverage: 0.82,
          FabricWidth: 58,
        },
      ];

      // Create Excel workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(template);
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
    } catch (error: any) {
      console.error('Download template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to download template',
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

    // Parse rows
    const rows: StyleImportCSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const row: any = {};

      headers.forEach((header, index) => {
        row[this.normalizeHeaderName(header)] = values[index];
      });

      rows.push(row as StyleImportCSVRow);
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

    const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

    return data.map((row: any) => {
      const normalized: any = {};
      Object.keys(row).forEach((key) => {
        normalized[this.normalizeHeaderName(key)] = row[key];
      });
      return normalized as StyleImportCSVRow;
    });
  }

  /**
   * Normalize header name to match expected field names
   */
  private normalizeHeaderName(header: string): string {
    const mapping: Record<string, string> = {
      stylecode: 'styleCode',
      projectgroup: 'projectGroup',
      itemdescription: 'itemDescription',
      customer: 'customer',
      season: 'season',
      gender: 'gender',
      category: 'category',
      componentname: 'componentName',
      fabricdescription: 'fabricDescription',
      cadaverage: 'cadAverage',
      lastproductionaverage: 'lastProductionAverage',
      fabricwidth: 'fabricWidth',
    };

    const normalized = header.toLowerCase().replace(/\s+/g, '');
    return mapping[normalized] || header;
  }
}

export default new StyleImportController();
