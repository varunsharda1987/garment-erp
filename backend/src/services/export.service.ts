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

  /**
   * Generate Invoice PDF
   */
  async generateInvoicePDF(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.moveDown();

      // Customer details (using billing name)
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica');
      doc.text(invoice.customers?.billingName || invoice.customers?.name || 'N/A');
      if (invoice.customers?.code) {
        doc.text(`Customer Code: ${invoice.customers.code}`);
      }
      if (invoice.customers?.email) {
        doc.text(`Email: ${invoice.customers.email}`);
      }
      if (invoice.customers?.phone) {
        doc.text(`Phone: ${invoice.customers.phone}`);
      }
      doc.moveDown(2);

      // Order reference
      if (invoice.orders?.orderNumber) {
        doc.fontSize(10).text(`Order Number: ${invoice.orders.orderNumber}`);
        doc.moveDown();
      }

      // Amount details table
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 400;

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Description', col1, tableTop);
      doc.text('Amount', col2, tableTop, { width: 100, align: 'right' });

      doc.moveTo(col1, tableTop + 15).lineTo(col2 + 100, tableTop + 15).stroke();

      let yPos = tableTop + 25;
      doc.fontSize(10).font('Helvetica');

      // Subtotal
      doc.text('Subtotal', col1, yPos);
      doc.text(`₹${Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2, yPos, { width: 100, align: 'right' });
      yPos += 20;

      // Tax
      doc.text('Tax', col1, yPos);
      doc.text(`₹${Number(invoice.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2, yPos, { width: 100, align: 'right' });
      yPos += 20;

      doc.moveTo(col1, yPos).lineTo(col2 + 100, yPos).stroke();
      yPos += 10;

      // Total
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Total Amount', col1, yPos);
      doc.text(`₹${Number(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2, yPos, { width: 100, align: 'right' });
      yPos += 30;

      // Payment status
      doc.fontSize(10).font('Helvetica');
      doc.text('Payment Status', col1, yPos);
      doc.text(invoice.status, col2, yPos, { width: 100, align: 'right' });
      yPos += 20;

      doc.text('Paid Amount', col1, yPos);
      doc.text(`₹${Number(invoice.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2, yPos, { width: 100, align: 'right' });
      yPos += 20;

      doc.text('Balance Due', col1, yPos);
      doc.font('Helvetica-Bold').text(`₹${Number(invoice.balanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2, yPos, { width: 100, align: 'right' });

      // Remarks
      if (invoice.remarks) {
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Bold').text('Remarks:');
        doc.font('Helvetica').text(invoice.remarks);
      }

      // Footer
      doc.fontSize(8).fillColor('#999')
        .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 50, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Generate Quotation PDF
   */
  async generateQuotationPDF(quotation: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('QUOTATION', { align: 'center' });
      doc.moveDown();

      // Quotation details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Quotation Number: ${quotation.quotationNumber}`, { align: 'right' });
      doc.text(`Quotation Date: ${new Date(quotation.quotationDate).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.text(`Status: ${quotation.status}`, { align: 'right' });
      doc.moveDown();

      // Customer details (using billing name)
      doc.fontSize(12).font('Helvetica-Bold').text('Quotation For:');
      doc.fontSize(10).font('Helvetica');
      doc.text(quotation.customers?.billingName || quotation.customers?.name || 'N/A');
      if (quotation.customers?.code) {
        doc.text(`Customer Code: ${quotation.customers.code}`);
      }
      if (quotation.customers?.email) {
        doc.text(`Email: ${quotation.customers.email}`);
      }
      if (quotation.customers?.phone) {
        doc.text(`Phone: ${quotation.customers.phone}`);
      }
      doc.moveDown(2);

      // Items table
      if (quotation.quotation_items && quotation.quotation_items.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Items:');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const col1 = 50;   // Item
        const col2 = 200;  // Description
        const col3 = 320;  // Qty
        const col4 = 380;  // Unit Price
        const col5 = 460;  // Total

        // Table header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Item', col1, tableTop);
        doc.text('Description', col2, tableTop);
        doc.text('Qty', col3, tableTop);
        doc.text('Unit Price', col4, tableTop);
        doc.text('Total', col5, tableTop);

        doc.moveTo(col1, tableTop + 15).lineTo(col5 + 80, tableTop + 15).stroke();

        let yPos = tableTop + 25;
        doc.fontSize(9).font('Helvetica');

        quotation.quotation_items.forEach((item: any, index: number) => {
          // Check if we need a new page
          if (yPos > doc.page.height - 150) {
            doc.addPage();
            yPos = 50;
          }

          const styleName = item.styles?.styleCode || `Item ${index + 1}`;
          doc.text(styleName, col1, yPos, { width: 140 });
          doc.text(item.description || '', col2, yPos, { width: 110, ellipsis: true });
          doc.text(item.totalQuantity.toLocaleString(), col3, yPos);
          doc.text(`₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col4, yPos);
          doc.text(`₹${Number(item.totalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col5, yPos);

          yPos += 25;
        });

        doc.moveTo(col1, yPos).lineTo(col5 + 80, yPos).stroke();
        yPos += 10;

        // Total
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Total Amount:', col4, yPos);
        doc.text(`₹${Number(quotation.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col5, yPos);
        yPos += 30;
      }

      // Terms and conditions
      if (quotation.termsAndConditions) {
        doc.fontSize(10).font('Helvetica-Bold').text('Terms and Conditions:');
        doc.fontSize(9).font('Helvetica').text(quotation.termsAndConditions, { align: 'left' });
        doc.moveDown();
      }

      // Remarks
      if (quotation.remarks) {
        doc.fontSize(10).font('Helvetica-Bold').text('Remarks:');
        doc.fontSize(9).font('Helvetica').text(quotation.remarks);
      }

      // Footer
      doc.fontSize(8).fillColor('#999')
        .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 50, { align: 'center' });

      doc.end();
    });
  }
}

export default new ExportService();
