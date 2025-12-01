// Export Service - Handles CSV, Excel, and PDF exports
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface ExportColumn {
  fieldName: string;
  displayName: string;
  format?: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  width?: number;
}

export interface ExportOptions {
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename: string;
  title?: string;
}

class ExportService {
  /**
   * Export data to CSV format
   */
  async exportToCSV(options: ExportOptions): Promise<string> {
    const { columns, data } = options;

    // Map field names for json2csv parser
    const fields = columns.map(col => ({
      label: col.displayName,
      value: col.fieldName
    }));

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    return csv;
  }

  /**
   * Export data to Excel format (XLSX)
   */
  async exportToExcel(options: ExportOptions): Promise<Buffer> {
    const { columns, data, title, filename } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kashaya Fabs ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(title || 'Data');

    // Add title row if provided
    if (title) {
      worksheet.mergeCells('A1', `${String.fromCharCode(65 + columns.length - 1)}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;
    }

    // Add header row
    const headerRow = worksheet.addRow(columns.map(col => col.displayName));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Set column widths
    worksheet.columns = columns.map(col => ({
      key: col.fieldName,
      width: col.width || 15
    }));

    // Add data rows
    data.forEach(row => {
      const rowData = columns.map(col => {
        const value = this.getNestedValue(row, col.fieldName);
        return this.formatValue(value, col.format);
      });
      worksheet.addRow(rowData);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column) {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, cell => {
          const cellLength = cell.value ? cell.value.toString().length : 10;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50); // Max width 50
      }
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export data to PDF format
   */
  async exportToPDF(options: ExportOptions): Promise<Buffer> {
    const { columns, data, title, filename } = options;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      if (title) {
        doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
        doc.moveDown();
      }

      // Add metadata
      doc.fontSize(10).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown();

      // Calculate column widths (simple equal distribution)
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columnWidth = pageWidth / columns.length;

      // Add table header
      let yPosition = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');

      columns.forEach((col, index) => {
        const xPosition = doc.page.margins.left + (index * columnWidth);
        doc.rect(xPosition, yPosition, columnWidth, 20).fillAndStroke('#4472C4', '#000');
        doc.fillColor('#FFF')
          .text(col.displayName, xPosition + 5, yPosition + 5, {
            width: columnWidth - 10,
            height: 20,
            ellipsis: true
          });
      });

      yPosition += 20;
      doc.fillColor('#000').font('Helvetica');

      // Add data rows (limited to prevent huge PDFs)
      const maxRows = Math.min(data.length, 100); // Limit to 100 rows for PDF
      for (let i = 0; i < maxRows; i++) {
        const row = data[i];

        // Check if we need a new page
        if (yPosition > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          yPosition = doc.page.margins.top;
        }

        columns.forEach((col, index) => {
          const xPosition = doc.page.margins.left + (index * columnWidth);
          const value = this.getNestedValue(row, col.fieldName);
          const formattedValue = this.formatValue(value, col.format);

          doc.rect(xPosition, yPosition, columnWidth, 20).stroke('#CCC');
          doc.fontSize(9).text(
            formattedValue?.toString() || '',
            xPosition + 5,
            yPosition + 5,
            {
              width: columnWidth - 10,
              height: 20,
              ellipsis: true
            }
          );
        });

        yPosition += 20;
      }

      if (data.length > maxRows) {
        doc.moveDown();
        doc.fontSize(10).fillColor('#999')
          .text(`Note: Showing first ${maxRows} of ${data.length} records. Export to Excel/CSV for complete data.`);
      }

      doc.end();
    });
  }

  /**
   * Get nested object value by path (e.g., "user.firstName")
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => (current as Record<string, unknown>)?.[key], obj as unknown);
  }

  /**
   * Format value based on format type
   */
  private formatValue(value: unknown, format?: string): unknown {
    if (value === null || value === undefined) return '';

    switch (format) {
      case 'date':
        return value instanceof Date ? value.toLocaleDateString() : value;
      case 'number':
        return typeof value === 'number' ? value.toFixed(2) : value;
      case 'currency':
        return typeof value === 'number' ? `₹${value.toFixed(2)}` : value;
      case 'percentage':
        return typeof value === 'number' ? `${value}%` : value;
      default:
        return value;
    }
  }

  /**
   * Create a readable stream from CSV data
   */
  createCSVStream(csvData: string): Readable {
    const stream = new Readable();
    stream.push(csvData);
    stream.push(null);
    return stream;
  }

  /**
   * Create a readable stream from Buffer (Excel/PDF)
   */
  createBufferStream(buffer: Buffer): Readable {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }
}

export default new ExportService();
