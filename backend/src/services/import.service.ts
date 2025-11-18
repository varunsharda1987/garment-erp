// Import Service - Handles CSV and Excel imports with validation
import csv from 'csv-parser';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { z } from 'zod';

export interface ImportColumn {
  fieldName: string;
  displayName: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'email';
  validator?: z.ZodType<any>;
}

export interface ImportOptions {
  columns: ImportColumn[];
  file: Express.Multer.File;
  maxRows?: number;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportError[];
  data?: any[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: any;
}

class ImportService {
  /**
   * Import data from CSV file
   */
  async importFromCSV(options: ImportOptions): Promise<ImportResult> {
    const { columns, file, maxRows = 10000 } = options;

    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: ImportError[] = [];
      let rowNumber = 0;

      const stream = Readable.from(file.buffer);

      stream
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;

          if (rowNumber > maxRows) {
            return; // Stop processing after max rows
          }

          const { valid, data, rowErrors } = this.validateRow(row, columns, rowNumber);

          if (valid) {
            results.push(data);
          } else {
            errors.push(...rowErrors);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            totalRows: rowNumber,
            validRows: results.length,
            invalidRows: errors.length,
            errors,
            data: results
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Import data from Excel file
   */
  async importFromExcel(options: ImportOptions): Promise<ImportResult> {
    const { columns, file, maxRows = 10000 } = options;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.worksheets[0]; // Get first sheet
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const results: any[] = [];
    const errors: ImportError[] = [];

    // Get header row (assume row 1)
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value?.toString() || '';
    });

    // Process data rows
    let validRowCount = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      if (validRowCount >= maxRows) return; // Stop after max rows

      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        rowData[header] = cell.value;
      });

      const { valid, data, rowErrors } = this.validateRow(rowData, columns, rowNumber);

      if (valid) {
        results.push(data);
        validRowCount++;
      } else {
        errors.push(...rowErrors);
      }
    });

    return {
      success: errors.length === 0,
      totalRows: worksheet.rowCount - 1, // Exclude header
      validRows: results.length,
      invalidRows: errors.length,
      errors,
      data: results
    };
  }

  /**
   * Preview import data (first 100 rows)
   */
  async previewImport(options: ImportOptions): Promise<ImportResult> {
    const previewOptions = { ...options, maxRows: 100 };

    const fileExtension = options.file.originalname.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      return this.importFromCSV(previewOptions);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return this.importFromExcel(previewOptions);
    } else {
      throw new Error('Unsupported file format. Please use CSV or Excel files.');
    }
  }

  /**
   * Validate a single row of data
   */
  private validateRow(
    row: any,
    columns: ImportColumn[],
    rowNumber: number
  ): { valid: boolean; data: any; rowErrors: ImportError[] } {
    const errors: ImportError[] = [];
    const validatedData: any = {};

    columns.forEach(column => {
      // Try matching with and without (Required)/(Optional) suffix
      const headerWithSuffix = column.displayName + (column.required ? ' (Required)' : ' (Optional)');
      let value = row[headerWithSuffix] !== undefined ? row[headerWithSuffix] : row[column.displayName];

      // Check required fields
      if (column.required && (value === null || value === undefined || value === '')) {
        errors.push({
          row: rowNumber,
          field: column.displayName,
          message: `${column.displayName} is required`,
          value
        });
        return;
      }

      // Type validation
      if (value !== null && value !== undefined && value !== '') {
        const typeError = this.validateType(value, column.type);
        if (typeError) {
          errors.push({
            row: rowNumber,
            field: column.displayName,
            message: typeError,
            value
          });
          return;
        }

        // Custom validator (Zod schema)
        if (column.validator) {
          try {
            const parsedValue = column.validator.parse(value);
            validatedData[column.fieldName] = parsedValue;
          } catch (error: any) {
            errors.push({
              row: rowNumber,
              field: column.displayName,
              message: error.errors?.[0]?.message || 'Validation failed',
              value
            });
            return;
          }
        } else {
          validatedData[column.fieldName] = this.convertType(value, column.type);
        }
      } else {
        validatedData[column.fieldName] = null;
      }
    });

    return {
      valid: errors.length === 0,
      data: validatedData,
      rowErrors: errors
    };
  }

  /**
   * Validate value type
   */
  private validateType(value: any, type?: string): string | null {
    if (!type) return null;

    switch (type) {
      case 'number':
        if (isNaN(Number(value))) {
          return `Must be a valid number`;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.toString())) {
          return `Must be a valid email address`;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          return `Must be a valid date`;
        }
        break;
      case 'boolean':
        const boolValue = value.toString().toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(boolValue)) {
          return `Must be a boolean value (true/false, yes/no, 1/0)`;
        }
        break;
    }

    return null;
  }

  /**
   * Convert value to appropriate type
   */
  private convertType(value: any, type?: string): any {
    if (!type || value === null || value === undefined) return value;

    switch (type) {
      case 'number':
        return Number(value);
      case 'date':
        return new Date(value);
      case 'boolean':
        const boolValue = value.toString().toLowerCase();
        return ['true', '1', 'yes'].includes(boolValue);
      default:
        return value;
    }
  }

  /**
   * Generate CSV template for a module
   */
  generateTemplate(columns: ImportColumn[]): string {
    const headers = columns.map(col => {
      const suffix = col.required ? ' (Required)' : ' (Optional)';
      return col.displayName + suffix;
    });

    return headers.join(',');
  }

  /**
   * Generate Excel template for a module
   */
  async generateExcelTemplate(columns: ImportColumn[], moduleName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import Template');

    // Add header row with Required/Optional indicators
    const headerRow = worksheet.addRow(columns.map(col => {
      const suffix = col.required ? ' (Required)' : ' (Optional)';
      return col.displayName + suffix;
    }));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // No sample row - users start fresh from row 2

    // Set column widths
    worksheet.columns = columns.map((col, index) => ({
      key: col.fieldName,
      width: 20
    }));

    // Add instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.addRow(['Import Template Instructions']);
    instructionsSheet.getRow(1).font = { size: 14, bold: true };
    instructionsSheet.addRow([]);
    instructionsSheet.addRow(['1. Fill in your data starting from row 2']);
    instructionsSheet.addRow(['2. Do not modify the header row (row 1)']);
    instructionsSheet.addRow(['3. Fill in all required fields']);
    instructionsSheet.addRow(['4. Save the file and upload for import']);
    instructionsSheet.addRow([]);
    instructionsSheet.addRow(['Column Definitions:']);
    instructionsSheet.getRow(7).font = { bold: true };

    columns.forEach((col, index) => {
      instructionsSheet.addRow([
        col.displayName,
        col.required ? 'Required' : 'Optional',
        col.type || 'text'
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export default new ImportService();
