"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import Service - Handles CSV and Excel imports with validation
const csv_parser_1 = __importDefault(require("csv-parser"));
const exceljs_1 = __importDefault(require("exceljs"));
const stream_1 = require("stream");
class ImportService {
    /**
     * Import data from CSV file
     */
    async importFromCSV(options) {
        const { columns, file, maxRows = 10000 } = options;
        return new Promise((resolve, reject) => {
            const results = [];
            const errors = [];
            let rowNumber = 0;
            const stream = stream_1.Readable.from(file.buffer);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rowNumber++;
                if (rowNumber > maxRows) {
                    return; // Stop processing after max rows
                }
                const { valid, data, rowErrors } = this.validateRow(row, columns, rowNumber);
                if (valid) {
                    results.push(data);
                }
                else {
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
    async importFromExcel(options) {
        const { columns, file, maxRows = 10000 } = options;
        const workbook = new exceljs_1.default.Workbook();
        await workbook.xlsx.load(file.buffer);
        const worksheet = workbook.worksheets[0]; // Get first sheet
        if (!worksheet) {
            throw new Error('No worksheet found in Excel file');
        }
        const results = [];
        const errors = [];
        // Get header row (assume row 1)
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value?.toString() || '';
        });
        // Process data rows
        let validRowCount = 0;
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return; // Skip header
            if (validRowCount >= maxRows)
                return; // Stop after max rows
            const rowData = {};
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                rowData[header] = cell.value;
            });
            const { valid, data, rowErrors } = this.validateRow(rowData, columns, rowNumber);
            if (valid) {
                results.push(data);
                validRowCount++;
            }
            else {
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
    async previewImport(options) {
        const previewOptions = { ...options, maxRows: 100 };
        const fileExtension = options.file.originalname.split('.').pop()?.toLowerCase();
        if (fileExtension === 'csv') {
            return this.importFromCSV(previewOptions);
        }
        else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            return this.importFromExcel(previewOptions);
        }
        else {
            throw new Error('Unsupported file format. Please use CSV or Excel files.');
        }
    }
    /**
     * Validate a single row of data
     */
    validateRow(row, columns, rowNumber) {
        const errors = [];
        const validatedData = {};
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
                    }
                    catch (error) {
                        errors.push({
                            row: rowNumber,
                            field: column.displayName,
                            message: error.errors?.[0]?.message || 'Validation failed',
                            value
                        });
                        return;
                    }
                }
                else {
                    validatedData[column.fieldName] = this.convertType(value, column.type);
                }
            }
            else {
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
    validateType(value, type) {
        if (!type)
            return null;
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
    convertType(value, type) {
        if (!type || value === null || value === undefined)
            return value;
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
    generateTemplate(columns) {
        const headers = columns.map(col => {
            const suffix = col.required ? ' (Required)' : ' (Optional)';
            return col.displayName + suffix;
        });
        return headers.join(',');
    }
    /**
     * Generate Excel template for a module
     */
    async generateExcelTemplate(columns, moduleName) {
        const workbook = new exceljs_1.default.Workbook();
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
exports.default = new ImportService();
