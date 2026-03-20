/**
 * Document Generator Service
 *
 * Generates PDF and Excel documents for:
 * - Tax Invoices (with GST breakdown)
 * - Proforma Invoices
 * - Order Forms
 * - Style Catalogues
 *
 * Uses existing data from invoices, customers, orders, bank_accounts tables
 * No database modifications - purely additive functionality
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { COMPANY_CONFIG, amountToWords, INVOICE_TERMS, DEFAULT_HSN_CODES } from '../config/company.config';
import path from 'path';
import fs from 'fs';

// Types
export interface DocumentOptions {
  includeImages?: boolean;
  includeTerms?: boolean;
  watermark?: string;
}

export interface CatalogueFilters {
  styleIds?: string[];
  categoryIds?: number[];
  brandCategoryIds?: number[];
  seasons?: string[];
  priceRange?: { min?: number; max?: number };
}

export interface CatalogueOptions {
  priceDisplay: 'b2b' | 'b2r' | 'both' | 'none';
  showFabricDetails?: boolean;
  showSizeRange?: boolean;
  catalogueName?: string;
  includeIndex?: boolean;
  columnsPerPage?: number; // 1, 2, 3, or 4 columns per page
}

// Size columns for invoice tables
const SIZE_COLUMNS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL'];

class DocumentGeneratorService {
  /**
   * Get company bank details (primary account)
   */
  private async getCompanyBankDetails() {
    const bankAccount = await prisma.bank_accounts.findFirst({
      where: { isPrimaryAccount: true, isActive: true }
    });

    return bankAccount || {
      bankName: 'ICICI Bank',
      accountHolderName: COMPANY_CONFIG.name,
      accountNumber: '532505000026',
      ifscCode: 'ICIC0005325',
      branchName: 'Mansarovar'
    };
  }

  /**
   * Fetch invoice with all related data
   */
  private async getInvoiceWithDetails(invoiceId: string) {
    return prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        customers: {
          include: {
            billingState: true,
            shippingState: true
          }
        },
        orders: {
          include: {
            order_items: {
              include: {
                styles: true,
                order_item_breakup: {
                  include: {
                    size_options: true,
                    color_options: true
                  }
                }
              }
            }
          }
        },
        placeOfSupply: true,
        invoice_items: {
          include: {
            style: {
              select: { id: true, styleCode: true, styleName: true, hsnCode: true }
            }
          },
          orderBy: { id: 'asc' as const }
        }
      }
    });
  }

  /**
   * Generate Tax Invoice PDF
   */
  async generateInvoicePDF(invoiceId: string, options: DocumentOptions = {}): Promise<Buffer> {
    const invoice = await this.getInvoiceWithDetails(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const bankDetails = await this.getCompanyBankDetails();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawTaxInvoicePage(doc, invoice, bankDetails);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Draw Tax Invoice page content
   */
  private drawTaxInvoicePage(
    doc: PDFKit.PDFDocument,
    invoice: NonNullable<Awaited<ReturnType<typeof this.getInvoiceWithDetails>>>,
    bankDetails: Awaited<ReturnType<typeof this.getCompanyBankDetails>>
  ) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    let y = 30;

    // ── Header: Tax Invoice Title ──
    doc.fontSize(16).font('Helvetica-Bold')
      .text('TAX INVOICE', marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 25;

    // ── Company Details ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    doc.fontSize(9).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`GSTIN: ${COMPANY_CONFIG.gstin}  |  MSME: ${COMPANY_CONFIG.msmeNumber || 'N/A'}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`Ph: ${COMPANY_CONFIG.phone}  |  Email: ${COMPANY_CONFIG.email}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Invoice Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(invoice.invoiceDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica');
    doc.text(`State: ${COMPANY_CONFIG.state} (${COMPANY_CONFIG.stateCode})`, marginLeft, y);
    const placeOfSupply = invoice.placeOfSupply?.stateName || invoice.customers?.billingState?.stateName || '-';
    doc.text(`Place of Supply: ${placeOfSupply}`, marginRight - 200, y, { width: 200, align: 'right' });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Billed To / Shipped To ──
    const midPoint = pageWidth / 2;
    const customer = invoice.customers;

    // Billed To Header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Billed To:', marginLeft, y);
    doc.text('Shipped To:', midPoint + 10, y);
    y += 14;

    // Customer Details
    doc.fontSize(9).font('Helvetica');
    const billingName = customer?.billingName || customer?.name || 'N/A';
    const shippingName = customer?.name || billingName;

    doc.text(billingName, marginLeft, y, { width: midPoint - marginLeft - 10 });
    doc.text(shippingName, midPoint + 10, y, { width: midPoint - 40 });
    y += 12;

    // Address
    const billingAddress = customer?.billingAddress || '-';
    const shippingAddress = customer?.shippingAddress || billingAddress;

    doc.text(billingAddress, marginLeft, y, { width: midPoint - marginLeft - 10 });
    doc.text(shippingAddress, midPoint + 10, y, { width: midPoint - 40 });
    y += 24; // Allow for wrapped text

    // Contact
    doc.text(`Mobile: ${customer?.phone || '-'}`, marginLeft, y);
    doc.text(`Mobile: ${customer?.phone || '-'}`, midPoint + 10, y);
    y += 12;

    // GSTIN
    doc.text(`GSTIN: ${customer?.gstNumber || 'URP'}`, marginLeft, y);
    doc.text(`GSTIN: ${customer?.gstNumber || 'URP'}`, midPoint + 10, y);
    y += 12;

    // State
    const billingState = customer?.billingState;
    const shippingState = customer?.shippingState || billingState;
    doc.text(`State: ${billingState?.stateName || '-'} (${billingState?.stateCode || '-'})`, marginLeft, y);
    doc.text(`State: ${shippingState?.stateName || '-'} (${shippingState?.stateCode || '-'})`, midPoint + 10, y);
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── Items Table ──
    y = this.drawInvoiceItemsTable(doc, invoice, y);

    // ── GST Summary ──
    y = this.drawGSTSummary(doc, invoice, y);

    // ── Bank Details ──
    y = this.drawBankDetails(doc, bankDetails, y);

    // ── Terms & Conditions ──
    if (y < doc.page.height - 120) {
      this.drawTermsAndConditions(doc, y);
    }

    // ── Footer ──
    doc.fontSize(8).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, marginLeft, doc.page.height - 30, { align: 'center', width: pageWidth - 60 });
  }

  /**
   * Draw invoice items table
   */
  private drawInvoiceItemsTable(
    doc: PDFKit.PDFDocument,
    invoice: NonNullable<Awaited<ReturnType<typeof this.getInvoiceWithDetails>>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    let y = startY;

    // Table header
    const columns = [
      { label: '#', width: 20 },
      { label: 'Style', width: 60 },
      { label: 'Description', width: 80 },
      { label: 'HSN', width: 50 },
      { label: 'Qty', width: 35 },
      { label: 'Rate', width: 50 },
      { label: 'Amount', width: 60 }
    ];

    // Adjust for GST columns based on interstate
    if (invoice.isInterstate) {
      columns.push({ label: 'IGST', width: 50 });
    } else {
      columns.push({ label: 'CGST', width: 40 });
      columns.push({ label: 'SGST', width: 40 });
    }
    columns.push({ label: 'Total', width: 60 });

    // Calculate total width and scale if needed
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const availableWidth = pageWidth - 60;
    const scale = totalWidth > availableWidth ? availableWidth / totalWidth : 1;
    columns.forEach(col => col.width = col.width * scale);

    // Draw header row
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');

    let xPos = marginLeft;
    doc.fillColor('#FFF');
    columns.forEach(col => {
      doc.text(col.label, xPos + 2, y + 5, { width: col.width - 4, align: 'center' });
      xPos += col.width;
    });
    y += 18;
    doc.fillColor('#000');

    // Draw data rows
    doc.fontSize(8).font('Helvetica');

    // Use invoice_items if available (new per-item GST), otherwise fallback to order_items (legacy)
    const hasInvoiceItems = invoice.invoice_items && invoice.invoice_items.length > 0;

    let rowIndex = 0;
    let totalQty = 0;

    if (hasInvoiceItems) {
      // New path: Use per-item GST from invoice_items
      invoice.invoice_items!.forEach((item, idx) => {
        const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
        doc.rect(marginLeft, y, availableWidth, 16).fillAndStroke(bgColor, '#CCC');
        doc.fillColor('#000');

        xPos = marginLeft;
        const qty = item.quantity;
        const rate = Number(item.unitPrice);
        const amount = Number(item.totalPrice);
        const itemTax = Number(item.taxAmount || 0);
        const itemTotal = amount + itemTax;
        totalQty += qty;

        const rowData = [
          (idx + 1).toString(),
          item.style?.styleCode || '-',
          item.description || item.style?.styleName || '-',
          item.hsnCode || item.style?.hsnCode || '-',
          qty.toString(),
          `₹${rate.toFixed(0)}`,
          `₹${amount.toFixed(0)}`
        ];

        if (invoice.isInterstate) {
          rowData.push(`₹${Number(item.igstAmount || 0).toFixed(0)}`);
        } else {
          rowData.push(`₹${Number(item.cgstAmount || 0).toFixed(0)}`);
          rowData.push(`₹${Number(item.sgstAmount || 0).toFixed(0)}`);
        }
        rowData.push(`₹${itemTotal.toFixed(0)}`);

        rowData.forEach((text, colIdx) => {
          doc.text(text, xPos + 2, y + 4, {
            width: columns[colIdx].width - 4,
            align: colIdx < 3 ? 'left' : 'center',
            ellipsis: true
          });
          xPos += columns[colIdx].width;
        });

        y += 16;
        rowIndex++;
      });
    } else {
      // Legacy path: Use order_items with header-level GST estimation
      const orderItems = invoice.orders?.order_items || [];

      orderItems.forEach((item, idx) => {
        const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
        doc.rect(marginLeft, y, availableWidth, 16).fillAndStroke(bgColor, '#CCC');
        doc.fillColor('#000');

        xPos = marginLeft;
        const style = item.styles;
        const qty = item.totalQuantity;
        const rate = Number(item.unitPrice);
        const amount = Number(item.totalPrice);
        totalQty += qty;

        const gstRate = invoice.isInterstate ? Number(invoice.igstRate || 0) : Number(invoice.cgstRate || 0) + Number(invoice.sgstRate || 0);
        const itemGst = amount * (gstRate / 100);
        const itemTotal = amount + itemGst;

        const rowData = [
          (idx + 1).toString(),
          style?.styleCode || '-',
          item.itemDescription || style?.styleName || '-',
          style?.hsnCode || DEFAULT_HSN_CODES.GARMENTS,
          qty.toString(),
          `₹${rate.toFixed(0)}`,
          `₹${amount.toFixed(0)}`
        ];

        if (invoice.isInterstate) {
          rowData.push(`₹${(amount * Number(invoice.igstRate || 0) / 100).toFixed(0)}`);
        } else {
          rowData.push(`₹${(amount * Number(invoice.cgstRate || 0) / 100).toFixed(0)}`);
          rowData.push(`₹${(amount * Number(invoice.sgstRate || 0) / 100).toFixed(0)}`);
        }
        rowData.push(`₹${itemTotal.toFixed(0)}`);

        rowData.forEach((text, colIdx) => {
          doc.text(text, xPos + 2, y + 4, {
            width: columns[colIdx].width - 4,
            align: colIdx < 3 ? 'left' : 'center',
            ellipsis: true
          });
          xPos += columns[colIdx].width;
        });

        y += 16;
        rowIndex++;
      });
    }

    // Total row
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF').font('Helvetica-Bold');

    xPos = marginLeft;
    doc.text('TOTAL', xPos + 2, y + 5, { width: columns[0].width + columns[1].width - 4 });
    xPos += columns[0].width + columns[1].width + columns[2].width + columns[3].width;

    doc.text(totalQty.toString(), xPos + 2, y + 5, { width: columns[4].width - 4, align: 'center' });
    xPos += columns[4].width + columns[5].width;

    doc.text(`₹${Number(invoice.subtotal).toFixed(0)}`, xPos + 2, y + 5, { width: columns[6].width - 4, align: 'center' });

    // Skip to total column
    xPos = marginLeft + columns.slice(0, -1).reduce((sum, col) => sum + col.width, 0);
    doc.text(`₹${Number(invoice.totalAmount).toFixed(0)}`, xPos + 2, y + 5, { width: columns[columns.length - 1].width - 4, align: 'center' });

    y += 18;
    doc.fillColor('#000');

    // HSN Summary Table (for invoices with per-item GST)
    if (hasInvoiceItems) {
      y = this.drawHSNSummary(doc, invoice.invoice_items!, invoice.isInterstate, y + 10);
    }

    return y + 10;
  }

  /**
   * Draw HSN-wise tax summary table (GSTR-1 compliance)
   */
  private drawHSNSummary(
    doc: PDFKit.PDFDocument,
    items: NonNullable<NonNullable<Awaited<ReturnType<typeof this.getInvoiceWithDetails>>>['invoice_items']>,
    isInterstate: boolean,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    const availableWidth = pageWidth - 60;
    let y = startY;

    // Group items by HSN code
    const hsnMap = new Map<string, { taxableValue: number; cgst: number; sgst: number; igst: number; totalTax: number }>();
    items.forEach(item => {
      const hsn = item.hsnCode || item.style?.hsnCode || 'N/A';
      const existing = hsnMap.get(hsn) || { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      existing.taxableValue += Number(item.totalPrice);
      existing.cgst += Number(item.cgstAmount || 0);
      existing.sgst += Number(item.sgstAmount || 0);
      existing.igst += Number(item.igstAmount || 0);
      existing.totalTax += Number(item.taxAmount || 0);
      hsnMap.set(hsn, existing);
    });

    if (hsnMap.size === 0) return y;

    // Title
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('HSN/SAC Summary', marginLeft, y);
    y += 14;

    // Header
    const hsnCols = [
      { label: 'HSN/SAC', width: 80 },
      { label: 'Taxable Value', width: 90 },
    ];
    if (isInterstate) {
      hsnCols.push({ label: 'IGST', width: 80 });
    } else {
      hsnCols.push({ label: 'CGST', width: 60 });
      hsnCols.push({ label: 'SGST', width: 60 });
    }
    hsnCols.push({ label: 'Total Tax', width: 80 });

    doc.fontSize(7).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 14).fillAndStroke('#E5E7EB', '#CCC');
    doc.fillColor('#000');

    let xPos = marginLeft;
    hsnCols.forEach(col => {
      doc.text(col.label, xPos + 2, y + 3, { width: col.width - 4, align: 'center' });
      xPos += col.width;
    });
    y += 14;

    // Rows
    doc.font('Helvetica');
    hsnMap.forEach((data, hsn) => {
      doc.rect(marginLeft, y, availableWidth, 12).stroke('#CCC');
      xPos = marginLeft;

      const rowData = [hsn, `₹${data.taxableValue.toFixed(0)}`];
      if (isInterstate) {
        rowData.push(`₹${data.igst.toFixed(0)}`);
      } else {
        rowData.push(`₹${data.cgst.toFixed(0)}`);
        rowData.push(`₹${data.sgst.toFixed(0)}`);
      }
      rowData.push(`₹${data.totalTax.toFixed(0)}`);

      rowData.forEach((text, colIdx) => {
        doc.text(text, xPos + 2, y + 2, { width: hsnCols[colIdx].width - 4, align: colIdx === 0 ? 'left' : 'center' });
        xPos += hsnCols[colIdx].width;
      });
      y += 12;
    });

    return y;
  }

  /**
   * Draw GST summary section
   */
  private drawGSTSummary(
    doc: PDFKit.PDFDocument,
    invoice: NonNullable<Awaited<ReturnType<typeof this.getInvoiceWithDetails>>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    const labelX = pageWidth - 250;
    const valueX = pageWidth - 100;
    let y = startY;

    doc.fontSize(9).font('Helvetica');

    // Subtotal
    doc.text('Subtotal:', labelX, y);
    doc.text(`₹${Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
    y += 14;

    // GST breakdown
    if (invoice.isInterstate) {
      const igstRate = Number(invoice.igstRate || 0);
      doc.text(`IGST @ ${igstRate}%:`, labelX, y);
      doc.text(`₹${Number(invoice.igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    } else {
      const cgstRate = Number(invoice.cgstRate || 0);
      const sgstRate = Number(invoice.sgstRate || 0);

      doc.text(`CGST @ ${cgstRate}%:`, labelX, y);
      doc.text(`₹${Number(invoice.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;

      doc.text(`SGST @ ${sgstRate}%:`, labelX, y);
      doc.text(`₹${Number(invoice.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    }

    // Total line
    doc.moveTo(labelX, y).lineTo(pageWidth - 30, y).stroke();
    y += 8;

    // Grand Total
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Grand Total:', labelX, y);
    doc.text(`₹${Number(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
    y += 18;

    // Amount in words
    doc.fontSize(9).font('Helvetica-Oblique');
    doc.text(`(${amountToWords(Number(invoice.totalAmount))})`, marginLeft, y, { width: pageWidth - 60 });
    y += 20;

    return y;
  }

  /**
   * Draw bank details section
   */
  private drawBankDetails(
    doc: PDFKit.PDFDocument,
    bankDetails: Awaited<ReturnType<typeof this.getCompanyBankDetails>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    let y = startY;

    // Separator line
    doc.moveTo(marginLeft, y).lineTo(pageWidth - 30, y).stroke('#333F50');
    y += 12;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333F50');
    doc.text('PAYMENT DETAILS:', marginLeft, y);
    y += 14;

    doc.fontSize(9).font('Helvetica').fillColor('#000');
    doc.text(`Bank: ${bankDetails.bankName}  |  Branch: ${bankDetails.branchName}`, marginLeft, y);
    y += 12;
    doc.text(`Account Name: ${bankDetails.accountHolderName}`, marginLeft, y);
    y += 12;
    doc.text(`Account No: ${bankDetails.accountNumber}  |  IFSC: ${bankDetails.ifscCode}`, marginLeft, y);
    y += 20;

    return y;
  }

  /**
   * Draw terms and conditions
   */
  private drawTermsAndConditions(doc: PDFKit.PDFDocument, startY: number) {
    const marginLeft = 30;
    let y = startY;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Terms & Conditions:', marginLeft, y);
    y += 12;

    doc.fontSize(8).font('Helvetica');
    INVOICE_TERMS.forEach((term, idx) => {
      doc.text(`${idx + 1}. ${term}`, marginLeft, y);
      y += 10;
    });

    // Signature section
    const pageWidth = doc.page.width;
    y += 20;
    doc.text(`For ${COMPANY_CONFIG.name}`, pageWidth - 180, y);
    y += 30;
    doc.text('Authorised Signatory', pageWidth - 180, y);
  }

  /**
   * Generate Tax Invoice Excel
   */
  async generateInvoiceExcel(invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoiceWithDetails(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const bankDetails = await this.getCompanyBankDetails();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = COMPANY_CONFIG.name;
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Tax Invoice');

    // Column widths
    ws.columns = [
      { key: 'A', width: 5 },
      { key: 'B', width: 12 },
      { key: 'C', width: 15 },
      { key: 'D', width: 12 },
      { key: 'E', width: 8 },
      { key: 'F', width: 10 },
      { key: 'G', width: 12 },
      { key: 'H', width: 10 },
      { key: 'I', width: 10 },
      { key: 'J', width: 12 }
    ];

    // Styles
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 16 },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    const subHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 12 },
      alignment: { horizontal: 'center' }
    };

    const tableHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333F50' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    let row = 1;

    // Title
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = 'TAX INVOICE';
    ws.getCell(`A${row}`).style = headerStyle;
    row += 2;

    // Company Name
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = COMPANY_CONFIG.name;
    ws.getCell(`A${row}`).style = subHeaderStyle;
    row++;

    // Company Address
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = `${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`;
    ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row++;

    // GSTIN
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = `GSTIN: ${COMPANY_CONFIG.gstin}`;
    ws.getCell(`A${row}`).alignment = { horizontal: 'center' };
    row += 2;

    // Invoice details
    ws.getCell(`A${row}`).value = 'Invoice No:';
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`B${row}`).value = invoice.invoiceNumber;
    ws.getCell(`H${row}`).value = 'Date:';
    ws.getCell(`H${row}`).font = { bold: true };
    ws.getCell(`I${row}`).value = this.formatDate(invoice.invoiceDate);
    row += 2;

    // Customer details
    ws.getCell(`A${row}`).value = 'Billed To:';
    ws.getCell(`A${row}`).font = { bold: true };
    ws.mergeCells(`B${row}:E${row}`);
    ws.getCell(`B${row}`).value = invoice.customers?.billingName || invoice.customers?.name || 'N/A';
    row++;

    ws.getCell(`A${row}`).value = 'Address:';
    ws.mergeCells(`B${row}:E${row}`);
    ws.getCell(`B${row}`).value = invoice.customers?.billingAddress || '-';
    row++;

    ws.getCell(`A${row}`).value = 'GSTIN:';
    ws.getCell(`B${row}`).value = invoice.customers?.gstNumber || 'URP';
    row += 2;

    // Items table header
    const headerRow = row;
    const headers = ['#', 'Style', 'Description', 'HSN', 'Qty', 'Rate', 'Amount'];
    if (invoice.isInterstate) {
      headers.push('IGST', 'Total');
    } else {
      headers.push('CGST', 'SGST', 'Total');
    }

    headers.forEach((header, idx) => {
      const cell = ws.getCell(row, idx + 1);
      cell.value = header;
      Object.assign(cell, { style: tableHeaderStyle });
    });
    row++;

    // Items data
    const orderItems = invoice.orders?.order_items || [];
    orderItems.forEach((item, idx) => {
      const style = item.styles;
      const amount = Number(item.totalPrice);

      ws.getCell(row, 1).value = idx + 1;
      ws.getCell(row, 2).value = style?.styleCode || '-';
      ws.getCell(row, 3).value = item.itemDescription || style?.styleName || '-';
      ws.getCell(row, 4).value = style?.hsnCode || DEFAULT_HSN_CODES.GARMENTS;
      ws.getCell(row, 5).value = item.totalQuantity;
      ws.getCell(row, 6).value = Number(item.unitPrice);
      ws.getCell(row, 7).value = amount;

      if (invoice.isInterstate) {
        ws.getCell(row, 8).value = amount * Number(invoice.igstRate || 0) / 100;
        ws.getCell(row, 9).value = amount * (1 + Number(invoice.igstRate || 0) / 100);
      } else {
        ws.getCell(row, 8).value = amount * Number(invoice.cgstRate || 0) / 100;
        ws.getCell(row, 9).value = amount * Number(invoice.sgstRate || 0) / 100;
        ws.getCell(row, 10).value = amount * (1 + Number(invoice.cgstRate || 0) / 100 + Number(invoice.sgstRate || 0) / 100);
      }

      // Add borders
      for (let col = 1; col <= headers.length; col++) {
        ws.getCell(row, col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
      row++;
    });

    // Totals
    row += 2;
    ws.getCell(`G${row}`).value = 'Subtotal:';
    ws.getCell(`G${row}`).font = { bold: true };
    ws.getCell(`H${row}`).value = Number(invoice.subtotal);
    row++;

    if (invoice.isInterstate) {
      ws.getCell(`G${row}`).value = `IGST @ ${invoice.igstRate}%:`;
      ws.getCell(`H${row}`).value = Number(invoice.igstAmount);
    } else {
      ws.getCell(`G${row}`).value = `CGST @ ${invoice.cgstRate}%:`;
      ws.getCell(`H${row}`).value = Number(invoice.cgstAmount);
      row++;
      ws.getCell(`G${row}`).value = `SGST @ ${invoice.sgstRate}%:`;
      ws.getCell(`H${row}`).value = Number(invoice.sgstAmount);
    }
    row++;

    ws.getCell(`G${row}`).value = 'Grand Total:';
    ws.getCell(`G${row}`).font = { bold: true, size: 12 };
    ws.getCell(`H${row}`).value = Number(invoice.totalAmount);
    ws.getCell(`H${row}`).font = { bold: true, size: 12 };
    row += 2;

    // Amount in words
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = amountToWords(Number(invoice.totalAmount));
    ws.getCell(`A${row}`).font = { italic: true };
    row += 2;

    // Bank details
    ws.getCell(`A${row}`).value = 'PAYMENT DETAILS:';
    ws.getCell(`A${row}`).font = { bold: true };
    row++;
    ws.getCell(`A${row}`).value = `Bank: ${bankDetails.bankName} | Account: ${bankDetails.accountNumber} | IFSC: ${bankDetails.ifscCode}`;

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate WhatsApp share link
   */
  generateWhatsAppLink(phone: string, documentType: string, documentName: string, downloadUrl: string): string {
    const message = `Hello,

Please find your ${documentType}:
📄 ${documentName}
🔗 ${downloadUrl}

From ${COMPANY_CONFIG.name}
📞 ${COMPANY_CONFIG.phone}`;

    // Clean phone number (remove spaces, dashes, add country code if missing)
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('91')) {
      cleanPhone = '91' + cleanPhone;
    }
    if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Format date helper
   */
  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFORMA INVOICE PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch quotation with all related data
   */
  private async getQuotationWithDetails(quotationId: string) {
    return prisma.quotations.findUnique({
      where: { id: quotationId },
      include: {
        customers: {
          include: {
            billingState: true,
            shippingState: true
          }
        },
        quotation_items: {
          include: {
            styles: true
          }
        },
        placeOfSupply: true
      }
    });
  }

  /**
   * Generate Proforma Invoice PDF (from quotation)
   */
  async generateProformaPDF(quotationId: string, options: DocumentOptions = {}): Promise<Buffer> {
    const quotation = await this.getQuotationWithDetails(quotationId);
    if (!quotation) {
      throw new Error(`Quotation not found: ${quotationId}`);
    }

    const bankDetails = await this.getCompanyBankDetails();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawProformaPage(doc, quotation, bankDetails);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Draw Proforma Invoice page content
   */
  private drawProformaPage(
    doc: PDFKit.PDFDocument,
    quotation: NonNullable<Awaited<ReturnType<typeof this.getQuotationWithDetails>>>,
    bankDetails: Awaited<ReturnType<typeof this.getCompanyBankDetails>>
  ) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    let y = 30;

    // ── Header: Proforma Invoice Title ──
    doc.fontSize(16).font('Helvetica-Bold')
      .text('PROFORMA INVOICE', marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 25;

    // ── Company Details ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    doc.fontSize(9).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`GSTIN: ${COMPANY_CONFIG.gstin}  |  MSME: ${COMPANY_CONFIG.msmeNumber || 'N/A'}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`Ph: ${COMPANY_CONFIG.phone}  |  Email: ${COMPANY_CONFIG.email}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Quotation Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Quotation No: ${quotation.quotationNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(quotation.quotationDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica');
    doc.text(`Valid Until: ${this.formatDate(quotation.validUntil)}`, marginLeft, y);
    const placeOfSupply = quotation.placeOfSupply?.stateName || quotation.customers?.billingState?.stateName || '-';
    doc.text(`Place of Supply: ${placeOfSupply}`, marginRight - 200, y, { width: 200, align: 'right' });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Customer Details ──
    const customer = quotation.customers;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Bill To:', marginLeft, y);
    y += 14;

    doc.fontSize(9).font('Helvetica');
    doc.text(customer?.billingName || customer?.name || 'N/A', marginLeft, y);
    y += 12;
    doc.text(customer?.billingAddress || '-', marginLeft, y, { width: pageWidth - 60 });
    y += 20;
    doc.text(`Mobile: ${customer?.phone || '-'}  |  GSTIN: ${customer?.gstNumber || 'URP'}`, marginLeft, y);
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── Items Table ──
    y = this.drawQuotationItemsTable(doc, quotation, y);

    // ── GST Summary for Proforma ──
    y = this.drawProformaGSTSummary(doc, quotation, y);

    // ── Bank Details ──
    y = this.drawBankDetails(doc, bankDetails, y);

    // ── Footer Note ──
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666');
    doc.text('This is a quotation and not a tax invoice. Prices are subject to change.', marginLeft, y, { width: pageWidth - 60 });
    y += 20;

    // ── Footer ──
    doc.fontSize(8).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, marginLeft, doc.page.height - 30, { align: 'center', width: pageWidth - 60 });
  }

  /**
   * Draw quotation items table
   */
  private drawQuotationItemsTable(
    doc: PDFKit.PDFDocument,
    quotation: NonNullable<Awaited<ReturnType<typeof this.getQuotationWithDetails>>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    const availableWidth = pageWidth - 60;
    let y = startY;

    // Table header
    const columns = [
      { label: '#', width: 25 },
      { label: 'Style Code', width: 80 },
      { label: 'Description', width: 150 },
      { label: 'HSN', width: 60 },
      { label: 'Qty', width: 50 },
      { label: 'Rate', width: 70 },
      { label: 'Amount', width: availableWidth - 435 }
    ];

    // Draw header row
    doc.fontSize(9).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');

    let xPos = marginLeft;
    doc.fillColor('#FFF');
    columns.forEach(col => {
      doc.text(col.label, xPos + 3, y + 5, { width: col.width - 6, align: 'center' });
      xPos += col.width;
    });
    y += 18;
    doc.fillColor('#000');

    // Draw data rows
    doc.fontSize(9).font('Helvetica');
    const items = quotation.quotation_items || [];

    items.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
      doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke(bgColor, '#CCC');
      doc.fillColor('#000');

      xPos = marginLeft;
      const style = item.styles;
      const qty = item.totalQuantity;
      const rate = Number(item.unitPrice);
      const amount = Number(item.totalPrice);

      const rowData = [
        (idx + 1).toString(),
        style?.styleCode || '-',
        item.description || style?.styleName || '-',
        style?.hsnCode || DEFAULT_HSN_CODES.GARMENTS,
        qty.toString(),
        `₹${rate.toLocaleString('en-IN')}`,
        `₹${amount.toLocaleString('en-IN')}`
      ];

      rowData.forEach((text, colIdx) => {
        doc.text(text, xPos + 3, y + 5, {
          width: columns[colIdx].width - 6,
          align: colIdx < 3 ? 'left' : 'center',
          ellipsis: true
        });
        xPos += columns[colIdx].width;
      });

      y += 18;
    });

    // Total row
    const totalQty = items.reduce((sum, item) => sum + item.totalQuantity, 0);
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF').font('Helvetica-Bold');

    xPos = marginLeft;
    doc.text('TOTAL', xPos + 3, y + 5, { width: columns[0].width + columns[1].width + columns[2].width + columns[3].width - 6 });
    xPos += columns[0].width + columns[1].width + columns[2].width + columns[3].width;

    doc.text(totalQty.toString(), xPos + 3, y + 5, { width: columns[4].width - 6, align: 'center' });
    xPos += columns[4].width + columns[5].width;

    doc.text(`₹${Number(quotation.totalAmount).toLocaleString('en-IN')}`, xPos + 3, y + 5, { width: columns[6].width - 6, align: 'center' });

    y += 18;
    doc.fillColor('#000');

    return y + 10;
  }

  /**
   * Draw Proforma GST summary section
   */
  private drawProformaGSTSummary(
    doc: PDFKit.PDFDocument,
    quotation: NonNullable<Awaited<ReturnType<typeof this.getQuotationWithDetails>>>,
    startY: number
  ): number {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const labelX = pageWidth - 250;
    const valueX = pageWidth - 100;
    let y = startY;

    doc.fontSize(9).font('Helvetica');

    // Subtotal
    doc.text('Subtotal:', labelX, y);
    doc.text(`₹${Number(quotation.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
    y += 14;

    // Determine if interstate based on placeOfSupply
    const isInterstate = quotation.placeOfSupply && quotation.placeOfSupply.stateCode !== COMPANY_CONFIG.stateCode;

    // GST breakdown (estimated)
    if (isInterstate) {
      const igstAmount = Number(quotation.estimatedIGST || 0);
      const igstRate = quotation.taxRate ? Number(quotation.taxRate) : (igstAmount > 0 ? 12 : 0);
      doc.text(`IGST @ ${igstRate}% (Est.):`, labelX, y);
      doc.text(`₹${igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    } else {
      const cgstAmount = Number(quotation.estimatedCGST || 0);
      const sgstAmount = Number(quotation.estimatedSGST || 0);
      const rate = quotation.taxRate ? Number(quotation.taxRate) / 2 : (cgstAmount > 0 ? 6 : 0);

      doc.text(`CGST @ ${rate}% (Est.):`, labelX, y);
      doc.text(`₹${cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;

      doc.text(`SGST @ ${rate}% (Est.):`, labelX, y);
      doc.text(`₹${sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    }

    // Total line
    doc.moveTo(labelX, y).lineTo(pageWidth - 30, y).stroke();
    y += 8;

    // Grand Total
    const totalWithTax = Number(quotation.totalWithTax || quotation.totalAmount || 0);
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Estimated Total:', labelX, y);
    doc.text(`₹${totalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueX, y, { width: 70, align: 'right' });
    y += 18;

    // Amount in words
    doc.fontSize(9).font('Helvetica-Oblique');
    doc.text(`(${amountToWords(totalWithTax)})`, marginLeft, y, { width: pageWidth - 60 });
    y += 20;

    return y;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER FORM PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch order with all related data for order form
   */
  private async getOrderWithDetails(orderId: string) {
    return prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        customers: {
          include: {
            billingState: true,
            shippingState: true
          }
        },
        order_items: {
          include: {
            styles: true,
            order_item_breakup: {
              include: {
                size_options: true,
                color_options: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Generate Order Form PDF
   */
  async generateOrderFormPDF(orderId: string, options: DocumentOptions = {}): Promise<Buffer> {
    const order = await this.getOrderWithDetails(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawOrderFormPage(doc, order);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Draw Order Form page content
   */
  private drawOrderFormPage(
    doc: PDFKit.PDFDocument,
    order: NonNullable<Awaited<ReturnType<typeof this.getOrderWithDetails>>>
  ) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    let y = 30;

    // ── Header: Order Form Title ──
    doc.fontSize(16).font('Helvetica-Bold')
      .text('ORDER FORM', marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 25;

    // ── Company Details ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    doc.fontSize(9).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`Ph: ${COMPANY_CONFIG.phone}  |  Email: ${COMPANY_CONFIG.email}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Order Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Order No: ${order.orderNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(order.orderDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica');
    doc.text(`Status: ${order.status}`, marginLeft, y);
    doc.text(`Delivery: ${this.formatDate(order.expectedDeliveryDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Customer Details ──
    const customer = order.customers;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Customer:', marginLeft, y);
    y += 14;

    doc.fontSize(9).font('Helvetica');
    doc.text(customer?.name || 'N/A', marginLeft, y);
    y += 12;
    if (order.shippingAddress) {
      doc.text(`Ship To: ${order.shippingAddress}`, marginLeft, y, { width: pageWidth - 60 });
      y += 16;
    }
    doc.text(`Phone: ${customer?.phone || '-'}  |  Email: ${customer?.email || '-'}`, marginLeft, y);
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── Order Items with Size Breakdown ──
    y = this.drawOrderFormItemsTable(doc, order, y);

    // ── Summary ──
    const labelX = pageWidth - 200;
    const valueX = pageWidth - 80;

    doc.moveTo(labelX - 20, y).lineTo(marginRight, y).stroke();
    y += 10;

    doc.fontSize(10).font('Helvetica');
    doc.text('Total Quantity:', labelX, y);
    doc.text(order.totalQuantity.toString(), valueX, y, { width: 50, align: 'right' });
    y += 14;

    doc.font('Helvetica-Bold');
    doc.text('Total Amount:', labelX, y);
    doc.text(`₹${Number(order.totalAmount).toLocaleString('en-IN')}`, valueX, y, { width: 50, align: 'right' });
    y += 20;

    // ── Remarks ──
    if (order.remarks) {
      doc.fontSize(9).font('Helvetica');
      doc.text('Remarks:', marginLeft, y);
      y += 12;
      doc.text(order.remarks, marginLeft, y, { width: pageWidth - 60 });
      y += 20;
    }

    // ── Footer ──
    doc.fontSize(8).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, marginLeft, doc.page.height - 30, { align: 'center', width: pageWidth - 60 });
  }

  /**
   * Draw Order Form items table with size breakdown
   */
  private drawOrderFormItemsTable(
    doc: PDFKit.PDFDocument,
    order: NonNullable<Awaited<ReturnType<typeof this.getOrderWithDetails>>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const marginRight = 30;
    const pageWidth = doc.page.width;
    const availableWidth = pageWidth - marginLeft - marginRight;
    let y = startY;

    const items = order.order_items || [];

    items.forEach((item, idx) => {
      const style = item.styles;
      const breakup = item.order_item_breakup || [];

      // Style header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.rect(marginLeft, y, availableWidth, 20).fillAndStroke('#E8E8E8', '#CCC');
      doc.fillColor('#000');
      doc.text(`${idx + 1}. ${style?.styleCode || '-'} - ${style?.styleName || item.itemDescription || '-'}`, marginLeft + 5, y + 6);
      doc.text(`Rate: ₹${Number(item.unitPrice).toLocaleString('en-IN')}`, pageWidth - marginRight - 120, y + 6, { width: 90, align: 'right' });
      y += 20;

      // Size breakdown table
      if (breakup.length > 0) {
        // Group by color
        const colorGroups = new Map<string, { color: string; sizes: Map<string, number> }>();

        breakup.forEach(b => {
          const colorKey = b.colorId || 'default';
          const colorName = b.color_options?.colorName || 'Default';
          const sizeName = b.size_options?.sizeName || '-';

          if (!colorGroups.has(colorKey)) {
            colorGroups.set(colorKey, { color: colorName, sizes: new Map() });
          }
          const existing = colorGroups.get(colorKey)!.sizes.get(sizeName) || 0;
          colorGroups.get(colorKey)!.sizes.set(sizeName, existing + b.quantity);
        });

        // Get all unique sizes
        const allSizes = new Set<string>();
        breakup.forEach(b => allSizes.add(b.size_options?.sizeName || '-'));
        const sizeArray = Array.from(allSizes).sort((a, b) => {
          const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL', '5XL'];
          return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
        });

        // Draw size header
        const colorColWidth = 80;
        const sizeColWidth = Math.min(40, (availableWidth - colorColWidth - 50) / sizeArray.length);
        const totalColWidth = 50;

        doc.fontSize(8).font('Helvetica-Bold');
        doc.rect(marginLeft, y, availableWidth, 14).fillAndStroke('#F0F0F0', '#CCC');
        doc.fillColor('#000');

        let xPos = marginLeft;
        doc.text('Color', xPos + 3, y + 3, { width: colorColWidth - 6 });
        xPos += colorColWidth;

        sizeArray.forEach(size => {
          doc.text(size, xPos + 2, y + 3, { width: sizeColWidth - 4, align: 'center' });
          xPos += sizeColWidth;
        });
        doc.text('Total', xPos + 2, y + 3, { width: totalColWidth - 4, align: 'center' });
        y += 14;

        // Draw color rows
        doc.fontSize(8).font('Helvetica');
        colorGroups.forEach((group, colorKey) => {
          doc.rect(marginLeft, y, availableWidth, 14).stroke('#DDD');

          xPos = marginLeft;
          doc.text(group.color, xPos + 3, y + 3, { width: colorColWidth - 6 });
          xPos += colorColWidth;

          let rowTotal = 0;
          sizeArray.forEach(size => {
            const qty = group.sizes.get(size) || 0;
            rowTotal += qty;
            doc.text(qty > 0 ? qty.toString() : '-', xPos + 2, y + 3, { width: sizeColWidth - 4, align: 'center' });
            xPos += sizeColWidth;
          });
          doc.text(rowTotal.toString(), xPos + 2, y + 3, { width: totalColWidth - 4, align: 'center' });
          y += 14;
        });
      }

      // Item total row
      doc.rect(marginLeft, y, availableWidth, 16).fillAndStroke('#333F50', '#000');
      doc.fillColor('#FFF').font('Helvetica-Bold').fontSize(9);
      doc.text(`Style Total: ${item.totalQuantity} pcs  |  Amount: ₹${Number(item.totalPrice).toLocaleString('en-IN')}`, marginLeft + 5, y + 4);
      y += 20;
      doc.fillColor('#000');
    });

    return y;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLE CATALOGUE PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Style Catalogue PDF
   */
  async generateCataloguePDF(filters: CatalogueFilters, options: CatalogueOptions): Promise<Buffer> {
    // Fetch styles based on filters
    const whereClause: Prisma.stylesWhereInput = {
      isActive: true
    };

    if (filters.styleIds && filters.styleIds.length > 0) {
      whereClause.id = { in: filters.styleIds };
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      whereClause.categoryId = { in: filters.categoryIds.map(String) };
    }
    if (filters.brandCategoryIds && filters.brandCategoryIds.length > 0) {
      whereClause.brandCategoryId = { in: filters.brandCategoryIds.map(String) };
    }
    if (filters.seasons && filters.seasons.length > 0) {
      whereClause.season = { in: filters.seasons };
    }
    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined) {
        whereClause.sellingPrice = { gte: filters.priceRange.min };
      }
      if (filters.priceRange.max !== undefined) {
        whereClause.sellingPrice = {
          ...whereClause.sellingPrice as object,
          lte: filters.priceRange.max
        };
      }
    }

    const styles = await prisma.styles.findMany({
      where: whereClause,
      include: {
        brand_categories: true,
        product_category: true,
        size_options: true,
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
              }
            }
          }
        },
      },
      orderBy: [
        { brandCategoryId: 'asc' },
        { styleCode: 'asc' }
      ]
    });

    if (styles.length === 0) {
      throw new Error('No styles found matching the filters');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawCataloguePages(doc, styles, options);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Draw catalogue pages
   */
  private drawCataloguePages(
    doc: PDFKit.PDFDocument,
    styles: Awaited<ReturnType<typeof prisma.styles.findMany>>,
    options: CatalogueOptions
  ) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginLeft = 30;

    // Cover page
    this.drawCatalogueCover(doc, options.catalogueName || `${COMPANY_CONFIG.name} Style Catalogue`, styles.length);

    // Index page (if requested)
    if (options.includeIndex) {
      this.drawCatalogueIndex(doc, styles, options.columnsPerPage || 2);
    }

    // Dynamic layout based on columnsPerPage
    const columns = Math.min(Math.max(options.columnsPerPage || 2, 1), 4); // Clamp between 1-4
    const rows = columns <= 2 ? 3 : (columns === 3 ? 3 : 4); // Adjust rows based on columns
    const stylesPerPage = columns * rows;
    const gap = 15;
    const colWidth = (pageWidth - 60 - (gap * (columns - 1))) / columns;
    const rowHeight = (pageHeight - 100) / rows;

    for (let i = 0; i < styles.length; i++) {
      if (i % stylesPerPage === 0 && i > 0) {
        doc.addPage();
      }

      const positionOnPage = i % stylesPerPage;
      const col = positionOnPage % columns;
      const row = Math.floor(positionOnPage / columns);

      const x = marginLeft + col * (colWidth + gap);
      const y = 50 + row * rowHeight;

      this.drawStyleCard(doc, styles[i], x, y, colWidth, rowHeight - 10, options);
    }

    // Page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 1; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#999')
        .text(`Page ${i} of ${pages.count - 1}`, marginLeft, pageHeight - 25, { align: 'center', width: pageWidth - 60 });
    }
  }

  /**
   * Draw catalogue index page (table of contents)
   */
  private drawCatalogueIndex(
    doc: PDFKit.PDFDocument,
    styles: any[],
    columnsPerPage: number
  ) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginLeft = 30;
    let y = 50;

    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000')
      .text('INDEX', marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 30;

    // Calculate styles per page for page number calculation
    const columns = Math.min(Math.max(columnsPerPage, 1), 4);
    const rows = columns <= 2 ? 3 : (columns === 3 ? 3 : 4);
    const stylesPerPage = columns * rows;

    // Table header
    doc.fontSize(10).font('Helvetica-Bold')
      .text('#', marginLeft, y, { width: 30 })
      .text('Style Code', marginLeft + 35, y, { width: 100 })
      .text('Style Name', marginLeft + 140, y, { width: 200 })
      .text('Page', marginLeft + 350, y, { width: 40 });
    y += 15;

    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginLeft, y).stroke();
    y += 10;

    // List styles
    doc.font('Helvetica').fontSize(9);
    styles.forEach((style, index) => {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 50;
      }

      // Page number: +2 for cover and index page(s)
      const pageNum = Math.floor(index / stylesPerPage) + 2;
      doc.fillColor('#000')
        .text((index + 1).toString(), marginLeft, y, { width: 30 })
        .text(style.styleCode || '-', marginLeft + 35, y, { width: 100 })
        .text(style.styleName || '-', marginLeft + 140, y, { width: 200, ellipsis: true })
        .text(pageNum.toString(), marginLeft + 350, y, { width: 40 });
      y += 14;
    });

    doc.addPage();
  }

  /**
   * Draw catalogue cover page
   */
  private drawCatalogueCover(doc: PDFKit.PDFDocument, title: string, styleCount: number) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Background color
    doc.rect(0, 0, pageWidth, pageHeight).fill('#333F50');

    // Title
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFF')
      .text(title, 50, pageHeight / 3, { align: 'center', width: pageWidth - 100 });

    // Company name
    doc.fontSize(18).font('Helvetica')
      .text(COMPANY_CONFIG.name, 50, pageHeight / 3 + 50, { align: 'center', width: pageWidth - 100 });

    // Style count
    doc.fontSize(14)
      .text(`${styleCount} Styles`, 50, pageHeight / 3 + 80, { align: 'center', width: pageWidth - 100 });

    // Contact
    doc.fontSize(10)
      .text(`${COMPANY_CONFIG.phone}  |  ${COMPANY_CONFIG.email}`, 50, pageHeight - 60, { align: 'center', width: pageWidth - 100 });

    doc.fontSize(8)
      .text(`Generated: ${this.formatDate(new Date())}`, 50, pageHeight - 40, { align: 'center', width: pageWidth - 100 });

    doc.addPage();
  }

  /**
   * Draw individual style card in catalogue
   */
  private drawStyleCard(
    doc: PDFKit.PDFDocument,
    style: any,
    x: number,
    y: number,
    width: number,
    height: number,
    options: CatalogueOptions
  ) {
    // Card border
    doc.rect(x, y, width, height).stroke('#DDD');

    // Image placeholder (top half)
    const imageHeight = height * 0.6;
    doc.rect(x, y, width, imageHeight).fill('#F5F5F5');

    // Try to load actual image
    const imagePath = style.image || style.imageUrl;
    if (imagePath) {
      try {
        const fullPath = path.join(process.cwd(), 'uploads', imagePath.replace(/^\/uploads\//, ''));
        if (fs.existsSync(fullPath)) {
          doc.image(fullPath, x + 5, y + 5, {
            width: width - 10,
            height: imageHeight - 10,
            fit: [width - 10, imageHeight - 10],
            align: 'center',
            valign: 'center'
          });
        }
      } catch (e) {
        // Image load failed, keep placeholder
      }
    }

    // Style code overlay
    doc.rect(x, y + imageHeight - 25, width, 25).fill('rgba(0,0,0,0.7)');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFF')
      .text(style.styleCode, x + 5, y + imageHeight - 20, { width: width - 10 });

    // Details section
    let detailY = y + imageHeight + 8;
    doc.fillColor('#000');

    // Style name
    doc.fontSize(9).font('Helvetica-Bold')
      .text(style.styleName || '-', x + 5, detailY, { width: width - 10, ellipsis: true });
    detailY += 14;

    // Category
    const category = style.product_category?.name || style.brand_categories?.category || '-';
    doc.fontSize(8).font('Helvetica').fillColor('#666')
      .text(category, x + 5, detailY, { width: width - 10 });
    detailY += 12;

    // Prices based on options
    doc.fillColor('#000');
    if (options.priceDisplay !== 'none') {
      if (options.priceDisplay === 'b2b' || options.priceDisplay === 'both') {
        const b2bPrice = Number(style.costPrice || 0);
        if (b2bPrice > 0) {
          doc.fontSize(9).font('Helvetica')
            .text(`B2B: ₹${b2bPrice.toLocaleString('en-IN')}`, x + 5, detailY);
          detailY += 12;
        }
      }
      if (options.priceDisplay === 'b2r' || options.priceDisplay === 'both') {
        const b2rPrice = Number(style.sellingPrice || 0);
        if (b2rPrice > 0) {
          doc.fontSize(9).font('Helvetica-Bold')
            .text(`MRP: ₹${b2rPrice.toLocaleString('en-IN')}`, x + 5, detailY);
          detailY += 12;
        }
      }
    }

    // Size range
    if (options.showSizeRange && style.size_options?.length > 0) {
      const sizes = style.size_options.map((s: any) => s.sizeName).join(', ');
      doc.fontSize(7).font('Helvetica').fillColor('#888')
        .text(`Sizes: ${sizes}`, x + 5, detailY, { width: width - 10, ellipsis: true });
    }

    // Fabric details (accessed through style_components → style_fabrics)
    const allFabrics = style.style_components?.flatMap((c: any) => c.style_fabrics || []) || [];
    if (options.showFabricDetails && allFabrics.length > 0) {
      const fabrics = allFabrics.slice(0, 2).map((f: any) => f.fabric?.fabricName || '-').join(', ');
      doc.fontSize(7).font('Helvetica').fillColor('#888')
        .text(`Fabric: ${fabrics}`, x + 5, y + height - 15, { width: width - 10, ellipsis: true });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TECH PACK PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Tech Pack PDF for a style
   * Includes: cover page, images, specs, BOM, notes
   */
  async generateTechPackPDF(styleId: string): Promise<Buffer> {
    // Fetch style with all related data
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        styleImages: { orderBy: { sortOrder: 'asc' } },
        techSpecs: true,
        style_material_bom: {
          include: { materials: true }
        },
        style_variants: true,
        style_components: {
          include: { componentMaster: true }
        },
        brand_categories: true,
        style_categories: true,
        season_master: true,
      }
    });

    if (!style) {
      throw new Error(`Style not found: ${styleId}`);
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);

      // ─────────────────────────────────────────────────────────────────────────
      // PAGE 1: COVER PAGE
      // ─────────────────────────────────────────────────────────────────────────

      // Header
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#333')
        .text('TECH PACK', margin, margin, { align: 'center' });

      doc.fontSize(12).font('Helvetica').fillColor('#666')
        .text(COMPANY_CONFIG.name, margin, margin + 35, { align: 'center' });

      doc.moveDown(2);

      // Main image
      const mainImage = style.styleImages?.find((img: any) => img.imageType === 'MAIN') || style.styleImages?.[0];
      const imagePath = mainImage?.imageUrl
        ? path.join(__dirname, '../../', mainImage.imageUrl)
        : style.imageUrl
          ? path.join(__dirname, '../../uploads/styles', path.basename(style.imageUrl))
          : null;

      if (imagePath && fs.existsSync(imagePath)) {
        try {
          doc.image(imagePath, pageWidth / 2 - 150, 120, { width: 300, height: 300, fit: [300, 300] });
          doc.moveDown(15);
        } catch (err) {
          doc.moveDown(2);
        }
      } else {
        doc.moveDown(10);
      }

      // Style info table
      let y = 450;
      const labelWidth = 120;

      const infoRows = [
        ['Style Code:', style.styleCode || '-'],
        ['Style Name:', style.styleName || '-'],
        ['Customer:', style.customerName || '-'],
        ['Brand:', style.brandName || '-'],
        ['Season:', (style as any).season_master?.name || style.season || '-'],
        ['Category:', (style as any).brand_categories?.category || '-'],
        ['Created:', this.formatDate(style.createdAt)],
      ];

      doc.font('Helvetica');
      infoRows.forEach(([label, value]) => {
        doc.fontSize(11).fillColor('#666').text(label, margin, y, { width: labelWidth });
        doc.fontSize(11).fillColor('#333').text(String(value), margin + labelWidth, y, { width: contentWidth - labelWidth });
        y += 20;
      });

      // ─────────────────────────────────────────────────────────────────────────
      // PAGE 2: TECHNICAL SPECIFICATIONS
      // ─────────────────────────────────────────────────────────────────────────

      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#333')
        .text('TECHNICAL SPECIFICATIONS', margin, margin);

      y = margin + 40;

      const specs = (style as any).techSpecs;
      if (specs) {
        const specRows = [
          ['Overall Length:', specs.overallLength ? `${specs.overallLength} ${specs.lengthUnit || 'inches'}` : '-'],
          ['Top Length:', specs.topLength ? `${specs.topLength} ${specs.lengthUnit || 'inches'}` : '-'],
          ['Bottom Length:', specs.bottomLength ? `${specs.bottomLength} ${specs.lengthUnit || 'inches'}` : '-'],
          ['Sleeve Type:', specs.sleeveType?.replace(/_/g, ' ') || '-'],
          ['Collar Type:', specs.collarType?.replace(/_/g, ' ') || '-'],
          ['Fit Type:', specs.fitType?.replace(/_/g, ' ') || '-'],
          ['Closure Type:', specs.closureType?.replace(/_/g, ' ') || '-'],
        ];

        doc.font('Helvetica');
        specRows.forEach(([label, value]) => {
          doc.fontSize(10).fillColor('#666').text(label, margin, y, { width: labelWidth });
          doc.fontSize(10).fillColor('#333').text(String(value), margin + labelWidth, y, { width: contentWidth - labelWidth });
          y += 18;
        });

        // Design notes
        if (specs.designNotes) {
          y += 20;
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#333')
            .text('Design Notes:', margin, y);
          y += 18;
          doc.fontSize(10).font('Helvetica').fillColor('#444')
            .text(specs.designNotes, margin, y, { width: contentWidth });
          y = doc.y + 10;
        }

        // Construction notes
        if (specs.constructionNotes) {
          y += 10;
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#333')
            .text('Construction Notes:', margin, y);
          y += 18;
          doc.fontSize(10).font('Helvetica').fillColor('#444')
            .text(specs.constructionNotes, margin, y, { width: contentWidth });
        }
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#888')
          .text('No technical specifications available.', margin, y);
      }

      // ─────────────────────────────────────────────────────────────────────────
      // PAGE 3: BILL OF MATERIALS
      // ─────────────────────────────────────────────────────────────────────────

      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#333')
        .text('BILL OF MATERIALS', margin, margin);

      y = margin + 40;

      const bomItems = (style as any).style_material_bom || [];
      if (bomItems.length > 0) {
        // Table header
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#666');
        doc.text('Material', margin, y, { width: 200 });
        doc.text('Type', margin + 200, y, { width: 80 });
        doc.text('Qty', margin + 280, y, { width: 50 });
        doc.text('Unit', margin + 330, y, { width: 50 });
        y += 15;

        // Draw header line
        doc.strokeColor('#ddd').lineWidth(0.5)
          .moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
        y += 8;

        // Table rows
        doc.font('Helvetica').fontSize(9).fillColor('#333');
        bomItems.forEach((item: any) => {
          if (y > 750) {
            doc.addPage();
            y = margin;
          }
          const material = item.materials;
          doc.text(material?.name || '-', margin, y, { width: 200 });
          doc.text(item.materialType || '-', margin + 200, y, { width: 80 });
          doc.text(String(item.quantityPerGarment || '-'), margin + 280, y, { width: 50 });
          doc.text(item.unit || '-', margin + 330, y, { width: 50 });
          y += 15;
        });
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#888')
          .text('No BOM items available.', margin, y);
      }

      // ─────────────────────────────────────────────────────────────────────────
      // PAGE 4: IMAGES GALLERY (if multiple images)
      // ─────────────────────────────────────────────────────────────────────────

      const styleImages = (style as any).styleImages || [];
      if (styleImages.length > 1) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#333')
          .text('STYLE IMAGES', margin, margin);

        let imageX = margin;
        let imageY = margin + 40;
        const imageSize = 200;
        const gap = 20;

        styleImages.forEach((img: any, idx: number) => {
          const imgPath = img.imageUrl ? path.join(__dirname, '../../', img.imageUrl) : null;

          if (imgPath && fs.existsSync(imgPath)) {
            try {
              if (imageX + imageSize > pageWidth - margin) {
                imageX = margin;
                imageY += imageSize + gap + 20;
              }

              if (imageY + imageSize > 750) {
                doc.addPage();
                imageY = margin;
                doc.fontSize(16).font('Helvetica-Bold').fillColor('#333')
                  .text('STYLE IMAGES (continued)', margin, margin);
                imageY = margin + 40;
              }

              doc.image(imgPath, imageX, imageY, { width: imageSize, height: imageSize, fit: [imageSize, imageSize] });

              // Image type label
              doc.fontSize(8).font('Helvetica').fillColor('#666')
                .text((img.imageType || 'OTHER').replace(/_/g, ' '), imageX, imageY + imageSize + 5, { width: imageSize, align: 'center' });

              imageX += imageSize + gap;
            } catch (err) {
              // Skip failed images
            }
          }
        });
      }

      // ─────────────────────────────────────────────────────────────────────────
      // COLOR VARIANTS (if available)
      // ─────────────────────────────────────────────────────────────────────────

      const variants = (style as any).style_variants || [];
      if (variants.length > 0) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#333')
          .text('COLOR VARIANTS', margin, margin);

        y = margin + 40;
        doc.fontSize(10).font('Helvetica').fillColor('#333');

        variants.forEach((variant: any, idx: number) => {
          if (y > 750) {
            doc.addPage();
            y = margin;
          }
          doc.text(`${idx + 1}. ${variant.variantCode || '-'} - ${variant.colorName || '-'}`, margin, y);
          y += 18;
        });
      }

      // Footer on all pages
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica').fillColor('#999')
          .text(
            `Generated on ${this.formatDate(new Date())} | Page ${i + 1} of ${pages.count}`,
            margin,
            doc.page.height - 30,
            { align: 'center', width: contentWidth }
          );
      }

      doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LINE SHEET PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Line Sheet PDF for buyer presentations
   * Options: wholesale pricing, buyer info, available sizes/colors
   */
  async generateLineSheetPDF(
    styleIds: string[],
    options: {
      showWholesalePrice?: boolean;
      showRetailPrice?: boolean;
      buyerCompany?: string;
      buyerContact?: string;
      buyerEmail?: string;
      title?: string;
    } = {}
  ): Promise<Buffer> {
    const styles = await prisma.styles.findMany({
      where: { id: { in: styleIds }, isActive: true },
      include: {
        style_variants: true,
        size_options: true,
        brand_categories: true,
        season_master: true,
      },
      orderBy: { styleCode: 'asc' }
    });

    if (styles.length === 0) {
      throw new Error('No styles found');
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;

      // ─────────────────────────────────────────────────────────────────────────
      // HEADER
      // ─────────────────────────────────────────────────────────────────────────

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#333')
        .text(options.title || 'LINE SHEET', margin, margin, { align: 'center' });

      doc.fontSize(10).font('Helvetica').fillColor('#666')
        .text(COMPANY_CONFIG.name, margin, margin + 25, { align: 'center' });

      if (options.buyerCompany) {
        doc.fontSize(9).fillColor('#888')
          .text(`Prepared for: ${options.buyerCompany}`, margin, margin + 40, { align: 'center' });
      }

      // ─────────────────────────────────────────────────────────────────────────
      // STYLES GRID (3 per row)
      // ─────────────────────────────────────────────────────────────────────────

      const stylesPerRow = 3;
      const cardWidth = (pageWidth - (margin * 2) - (20 * (stylesPerRow - 1))) / stylesPerRow;
      const cardHeight = 180;
      let x = margin;
      let y = margin + 70;

      styles.forEach((style, idx) => {
        if (y + cardHeight > pageHeight - 50) {
          doc.addPage();
          y = margin;
        }

        if (idx > 0 && idx % stylesPerRow === 0) {
          x = margin;
          y += cardHeight + 20;
        }

        // Card border
        doc.rect(x, y, cardWidth, cardHeight).stroke('#ddd');

        // Image placeholder
        const imagePath = style.imageUrl ? path.join(__dirname, '../../uploads/styles', path.basename(style.imageUrl)) : null;
        if (imagePath && fs.existsSync(imagePath)) {
          try {
            doc.image(imagePath, x + 5, y + 5, { width: 80, height: 80, fit: [80, 80] });
          } catch (err) {
            doc.rect(x + 5, y + 5, 80, 80).fill('#f5f5f5');
          }
        } else {
          doc.rect(x + 5, y + 5, 80, 80).fill('#f5f5f5');
          doc.fontSize(8).fillColor('#999').text('No Image', x + 25, y + 40);
        }

        // Style info
        const infoX = x + 95;
        let infoY = y + 8;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333')
          .text(style.styleCode || '-', infoX, infoY, { width: cardWidth - 100 });
        infoY += 14;

        doc.fontSize(8).font('Helvetica').fillColor('#666')
          .text(style.styleName || '-', infoX, infoY, { width: cardWidth - 100, ellipsis: true });
        infoY += 14;

        doc.fontSize(7).fillColor('#888')
          .text(`Season: ${(style as any).season_master?.code || style.season || '-'}`, infoX, infoY);
        infoY += 12;

        // Prices
        if (options.showWholesalePrice && style.costPrice) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#2563eb')
            .text(`Wholesale: ₹${Number(style.costPrice).toLocaleString('en-IN')}`, infoX, infoY);
          infoY += 14;
        }
        if (options.showRetailPrice && style.sellingPrice) {
          doc.fontSize(9).fillColor('#666')
            .text(`MRP: ₹${Number(style.sellingPrice).toLocaleString('en-IN')}`, infoX, infoY);
          infoY += 14;
        }

        // Colors available
        const variants = (style as any).style_variants || [];
        if (variants.length > 0) {
          const colors = variants.map((v: any) => v.colorName).filter(Boolean).slice(0, 5).join(', ');
          doc.fontSize(7).font('Helvetica').fillColor('#888')
            .text(`Colors: ${colors}${variants.length > 5 ? '...' : ''}`, x + 5, y + cardHeight - 20, { width: cardWidth - 10 });
        }

        // Sizes available
        const sizes = (style as any).size_options || [];
        if (sizes.length > 0) {
          const sizeList = sizes.map((s: any) => s.sizeName).join(', ');
          doc.fontSize(7).fillColor('#888')
            .text(`Sizes: ${sizeList}`, x + 5, y + cardHeight - 10, { width: cardWidth - 10, ellipsis: true });
        }

        x += cardWidth + 20;
      });

      // ─────────────────────────────────────────────────────────────────────────
      // FOOTER
      // ─────────────────────────────────────────────────────────────────────────

      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        // Company contact
        doc.fontSize(8).font('Helvetica').fillColor('#666')
          .text(
            `${COMPANY_CONFIG.phone} | ${COMPANY_CONFIG.email}`,
            margin,
            pageHeight - 30,
            { align: 'left' }
          );

        // Buyer info
        if (options.buyerContact) {
          doc.text(
            `Contact: ${options.buyerContact}${options.buyerEmail ? ` | ${options.buyerEmail}` : ''}`,
            pageWidth / 2 - 100,
            pageHeight - 30,
            { align: 'center', width: 200 }
          );
        }

        // Page number
        doc.text(
          `Page ${i + 1} of ${pages.count}`,
          pageWidth - margin - 80,
          pageHeight - 30,
          { align: 'right', width: 80 }
          );
      }

      doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate Line Sheet Excel for buyer presentations
   */
  async generateLineSheetExcel(
    styleIds: string[],
    options: {
      showWholesalePrice?: boolean;
      showRetailPrice?: boolean;
      buyerCompany?: string;
      title?: string;
    } = {}
  ): Promise<Buffer> {
    const styles = await prisma.styles.findMany({
      where: { id: { in: styleIds }, isActive: true },
      include: {
        style_variants: true,
        size_options: true,
        brand_categories: true,
        season_master: true,
      },
      orderBy: { styleCode: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Line Sheet');

    // Header row
    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = options.title || 'LINE SHEET';
    ws.getCell('A1').font = { size: 18, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:G2');
    ws.getCell('A2').value = COMPANY_CONFIG.name;
    ws.getCell('A2').alignment = { horizontal: 'center' };

    if (options.buyerCompany) {
      ws.mergeCells('A3:G3');
      ws.getCell('A3').value = `Prepared for: ${options.buyerCompany}`;
      ws.getCell('A3').alignment = { horizontal: 'center' };
    }

    // Column headers
    let row = 5;
    const headers = ['Style Code', 'Style Name', 'Season', 'Category', 'Colors', 'Sizes'];
    if (options.showWholesalePrice) headers.push('Wholesale Price');
    if (options.showRetailPrice) headers.push('MRP');

    headers.forEach((h, idx) => {
      const cell = ws.getCell(row, idx + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Set column widths
    ws.getColumn(1).width = 15;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 30;
    ws.getColumn(6).width = 25;
    ws.getColumn(7).width = 15;
    ws.getColumn(8).width = 15;

    row++;

    // Data rows
    styles.forEach((style) => {
      const variants = (style as any).style_variants || [];
      const sizes = (style as any).size_options || [];
      const colors = variants.map((v: any) => v.colorName).filter(Boolean).join(', ');
      const sizeList = sizes.map((s: any) => s.sizeName).join(', ');

      let col = 1;
      ws.getCell(row, col++).value = style.styleCode || '-';
      ws.getCell(row, col++).value = style.styleName || '-';
      ws.getCell(row, col++).value = (style as any).season_master?.code || style.season || '-';
      ws.getCell(row, col++).value = (style as any).brand_categories?.categoryName || '-';
      ws.getCell(row, col++).value = colors || '-';
      ws.getCell(row, col++).value = sizeList || '-';

      if (options.showWholesalePrice) {
        ws.getCell(row, col++).value = style.costPrice ? Number(style.costPrice) : '-';
      }
      if (options.showRetailPrice) {
        ws.getCell(row, col++).value = style.sellingPrice ? Number(style.sellingPrice) : '-';
      }

      // Add borders
      for (let c = 1; c < col; c++) {
        ws.getCell(row, c).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      row++;
    });

    // Footer
    row += 2;
    ws.mergeCells(`A${row}:G${row}`);
    ws.getCell(`A${row}`).value = `Generated on ${this.formatDate(new Date())} | Total Styles: ${styles.length}`;
    ws.getCell(`A${row}`).font = { italic: true, size: 9 };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDER PDF
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch purchase order with all related data
   */
  private async getPurchaseOrderWithDetails(poId: string) {
    return prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: {
        suppliers: true,
        purchase_order_items: {
          include: {
            materials: true
          }
        }
      }
    });
  }

  /**
   * Generate Purchase Order PDF
   */
  async generatePurchaseOrderPDF(poId: string, options: DocumentOptions = {}): Promise<Buffer> {
    const purchaseOrder = await this.getPurchaseOrderWithDetails(poId);
    if (!purchaseOrder) {
      throw new Error(`Purchase Order not found: ${poId}`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawPurchaseOrderPage(doc, purchaseOrder);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Draw Purchase Order page content
   */
  private drawPurchaseOrderPage(
    doc: PDFKit.PDFDocument,
    po: NonNullable<Awaited<ReturnType<typeof this.getPurchaseOrderWithDetails>>>
  ) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    let y = 30;

    // ── Header: Purchase Order Title ──
    doc.fontSize(16).font('Helvetica-Bold')
      .text('PURCHASE ORDER', marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 25;

    // ── Company Details (Buyer) ──
    doc.fontSize(14).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    doc.fontSize(9).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`GSTIN: ${COMPANY_CONFIG.gstin}  |  Ph: ${COMPANY_CONFIG.phone}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 12;

    doc.text(`Email: ${COMPANY_CONFIG.email}`, marginLeft, y, { align: 'center', width: pageWidth - 60 });
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── PO Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`PO Number: ${po.poNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(po.poDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica');
    doc.text(`Expected Delivery: ${this.formatDate(po.expectedDeliveryDate)}`, marginLeft, y);
    if (po.paymentTerms) {
      doc.text(`Payment Terms: ${po.paymentTerms}`, marginRight - 200, y, { width: 200, align: 'right' });
    }
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Supplier Details (To) ──
    const supplier = po.suppliers;
    const midPoint = pageWidth / 2;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('To:', marginLeft, y);
    doc.text('From:', midPoint + 10, y);
    y += 14;

    // Supplier info (left side)
    doc.fontSize(9).font('Helvetica');
    doc.text(supplier?.name || 'N/A', marginLeft, y, { width: midPoint - marginLeft - 20 });
    doc.text(COMPANY_CONFIG.name, midPoint + 10, y, { width: midPoint - 40 });
    y += 12;

    if (supplier?.address) {
      doc.text(supplier.address, marginLeft, y, { width: midPoint - marginLeft - 20 });
    }
    doc.text(`${COMPANY_CONFIG.city}, ${COMPANY_CONFIG.state}`, midPoint + 10, y, { width: midPoint - 40 });
    y += 12;

    if ((supplier as any)?.gstin) {
      doc.text(`GSTIN: ${(supplier as any).gstin}`, marginLeft, y, { width: midPoint - marginLeft - 20 });
    }
    doc.text(`GSTIN: ${COMPANY_CONFIG.gstin}`, midPoint + 10, y, { width: midPoint - 40 });
    y += 12;

    // Contact details
    const supplierContact = [
      supplier?.contactPerson,
      supplier?.phone,
      supplier?.email
    ].filter(Boolean).join(' | ');
    if (supplierContact) {
      doc.text(supplierContact, marginLeft, y, { width: midPoint - marginLeft - 20 });
    }
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── Items Table ──
    y = this.drawPurchaseOrderItemsTable(doc, po, y);

    // ── Totals Section ──
    const valueWidth = 110;
    const valueX  = marginRight - valueWidth;   // stays inside right margin
    const labelX  = marginRight - 230;

    doc.moveTo(labelX - 10, y).lineTo(marginRight, y).stroke();
    y += 8;

    const poItems = po.purchase_order_items || [];
    const subtotal   = poItems.reduce((s, i) => s + Number(i.totalPrice  || 0), 0);
    const totalTax   = poItems.reduce((s, i) => s + Number(i.taxAmount   || 0), 0);
    const totalCgst  = poItems.reduce((s, i) => s + Number(i.cgstAmount  || 0), 0);
    const totalSgst  = poItems.reduce((s, i) => s + Number(i.sgstAmount  || 0), 0);
    const totalIgst  = poItems.reduce((s, i) => s + Number(i.igstAmount  || 0), 0);
    const grandTotal = subtotal + totalTax;
    const isIgst     = totalIgst > 0;

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    doc.fontSize(9).font('Helvetica');
    doc.text('Subtotal:', labelX, y);
    doc.text(fmt(subtotal), valueX, y, { width: valueWidth, align: 'right' });
    y += 14;

    if (isIgst) {
      doc.text(`IGST:`, labelX, y);
      doc.text(fmt(totalIgst), valueX, y, { width: valueWidth, align: 'right' });
      y += 14;
    } else if (totalCgst > 0 || totalSgst > 0) {
      doc.text('CGST:', labelX, y);
      doc.text(fmt(totalCgst), valueX, y, { width: valueWidth, align: 'right' });
      y += 14;
      doc.text('SGST:', labelX, y);
      doc.text(fmt(totalSgst), valueX, y, { width: valueWidth, align: 'right' });
      y += 14;
    }

    doc.moveTo(labelX - 10, y).lineTo(marginRight, y).stroke();
    y += 6;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Grand Total:', labelX, y);
    doc.text(fmt(grandTotal), valueX, y, { width: valueWidth, align: 'right' });
    y += 22;

    // ── Remarks ──
    if (po.remarks) {
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Remarks:', marginLeft, y);
      y += 12;
      doc.font('Helvetica');
      doc.text(po.remarks, marginLeft, y, { width: pageWidth - 60 });
      y += 20;
    }

    // ── Terms & Conditions ──
    y = Math.max(y, doc.page.height - 200);
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Terms & Conditions:', marginLeft, y);
    y += 12;

    doc.fontSize(8).font('Helvetica');
    const poTerms = [
      '1. Please quote our PO number on all correspondence, delivery challans, and invoices.',
      '2. Invoice must accompany delivery of goods.',
      '3. Goods are subject to quality inspection upon receipt.',
      '4. Delivery must be made as per the expected delivery date.',
      '5. Any deviation from specifications must be communicated prior to delivery.'
    ];
    poTerms.forEach(term => {
      doc.text(term, marginLeft, y, { width: pageWidth - 60 });
      y += 11;
    });
    y += 10;

    // ── Signature Section ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 15;

    doc.fontSize(9).font('Helvetica');
    doc.text('For ' + COMPANY_CONFIG.name, marginLeft, y);
    y += 40;

    doc.text('Authorized Signatory', marginLeft, y);
    doc.text('Date: ________________', marginRight - 150, y);
    y += 20;

    // ── Footer ──
    doc.fontSize(8).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, marginLeft, doc.page.height - 30, { align: 'center', width: pageWidth - 60 });
  }

  /**
   * Draw Purchase Order items table
   */
  private drawPurchaseOrderItemsTable(
    doc: PDFKit.PDFDocument,
    po: NonNullable<Awaited<ReturnType<typeof this.getPurchaseOrderWithDetails>>>,
    startY: number
  ): number {
    const marginLeft = 30;
    const pageWidth = doc.page.width;
    const availableWidth = pageWidth - 60; // 535px for A4
    let y = startY;

    const items = po.purchase_order_items || [];

    // Column widths — total = 535px
    const col = {
      sno:         22,   // -3
      description: 162,  // code (bold) + name below; -3
      qty:          45,  // -5
      unit:         30,  // -5
      hsn:          48,  // -2
      gst:          28,  // -2
      rate:         55,  // -5
      tax:          70,  // +10 — wider for "₹6,263.58"
      amount:       75,  // +15 — wider for "₹1,33,618.83"
    };
    // 22+162+45+30+48+28+55+70+75 = 535 ✓

    // ── Table header ──
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#E8E8E8', '#000');
    doc.fillColor('#000');

    let xPos = marginLeft;
    doc.text('S.No',   xPos + 2, y + 5, { width: col.sno - 4,         align: 'center' }); xPos += col.sno;
    doc.text('Description', xPos + 2, y + 5, { width: col.description - 4 }); xPos += col.description;
    doc.text('Qty',    xPos + 2, y + 5, { width: col.qty - 4,          align: 'right'  }); xPos += col.qty;
    doc.text('Unit',   xPos + 2, y + 5, { width: col.unit - 4,         align: 'center' }); xPos += col.unit;
    doc.text('HSN',    xPos + 2, y + 5, { width: col.hsn - 4,          align: 'center' }); xPos += col.hsn;
    doc.text('GST%',   xPos + 2, y + 5, { width: col.gst - 4,          align: 'center' }); xPos += col.gst;
    doc.text('Rate',   xPos + 2, y + 5, { width: col.rate - 4,         align: 'right'  }); xPos += col.rate;
    doc.text('Tax',    xPos + 2, y + 5, { width: col.tax - 4,          align: 'right'  }); xPos += col.tax;
    doc.text('Amount', xPos + 2, y + 5, { width: col.amount - 4,       align: 'right'  });
    y += 18;

    // ── Table rows ──
    items.forEach((item, idx) => {
      const material = item.materials;
      const code = material?.code || '';
      const name = material?.name || item.serviceDescription || item.remarks || '-';
      const hsnCode = (item.hsnCode || (material as any)?.hsnCode || '-').toString();
      const gstRate = item.gstRate ? `${Number(item.gstRate)}%` : '-';
      const taxAmt = Number(item.taxAmount || 0);
      const lineTotal = Number(item.totalPrice || 0);

      // Dynamic row height based on actual wrapped text height
      doc.fontSize(7);
      const nameWrappedHeight = doc.heightOfString(name, { width: col.description - 4 });
      const rowHeight = Math.max(30, Math.ceil(nameWrappedHeight) + 18);
      // 18 = code line (11px) + top padding (6px) + bottom padding (1px)

      if (idx % 2 === 1) {
        doc.rect(marginLeft, y, availableWidth, rowHeight).fill('#F9F9F9');
      }
      doc.rect(marginLeft, y, availableWidth, rowHeight).stroke('#DDD');
      doc.fillColor('#000');

      const textY = y + 5;
      xPos = marginLeft;

      // S.No
      doc.fontSize(8).font('Helvetica');
      doc.text((idx + 1).toString(), xPos + 2, textY + 5, { width: col.sno - 4, align: 'center', lineBreak: false });
      xPos += col.sno;

      // Description: code bold on top, name below
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text(code, xPos + 2, textY, { width: col.description - 4, lineBreak: false });
      doc.fontSize(7).font('Helvetica');
      doc.text(name, xPos + 2, textY + 11, { width: col.description - 4 });
      xPos += col.description;

      // Qty
      doc.fontSize(8).font('Helvetica');
      doc.text(Number(item.orderedQuantity).toLocaleString('en-IN', { maximumFractionDigits: 3 }), xPos + 2, textY + 5, { width: col.qty - 4, align: 'right', lineBreak: false });
      xPos += col.qty;

      // Unit
      doc.text(item.unit || '-', xPos + 2, textY + 5, { width: col.unit - 4, align: 'center', lineBreak: false });
      xPos += col.unit;

      // HSN
      doc.text(hsnCode, xPos + 2, textY + 5, { width: col.hsn - 4, align: 'center', lineBreak: false });
      xPos += col.hsn;

      // GST%
      doc.text(gstRate, xPos + 2, textY + 5, { width: col.gst - 4, align: 'center', lineBreak: false });
      xPos += col.gst;

      // Rate
      doc.text(`₹${Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, xPos + 2, textY + 5, { width: col.rate - 4, align: 'right', lineBreak: false });
      xPos += col.rate;

      // Tax Amount
      doc.text(`₹${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, xPos + 2, textY + 5, { width: col.tax - 4, align: 'right', lineBreak: false });
      xPos += col.tax;

      // Taxable Amount (base line total, excl. tax)
      doc.text(`₹${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, xPos + 2, textY + 5, { width: col.amount - 4, align: 'right', lineBreak: false });

      y += rowHeight;
    });

    y += 5;
    return y;
  }

  // ============================================
  // Cutting Chart PDF
  // ============================================

  async generateCuttingChartPDF(
    workOrderId: string,
    colorId?: string,
    options: { extraPercent?: number } = {}
  ): Promise<Buffer> {
    const { buildCuttingChartData } = await import('../controllers/cutting.controller');
    const chartData = await buildCuttingChartData(workOrderId, colorId);
    const extraPercent = options.extraPercent ?? 1;

    // Pre-calculate cut quantities
    const sizesWithCut = chartData.sizes.map((s: any) => ({
      ...s,
      cutQty: Math.ceil(s.orderQty * (1 + extraPercent / 100)),
    }));
    const totalCutQty = sizesWithCut.reduce((sum: number, s: any) => sum + s.cutQty, 0);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const mL = 30; // marginLeft
        const cW = pageWidth - 60; // contentWidth
        let y = 30;

        // Helper: draw label-value pair
        const drawField = (label: string, value: string, x: number, yy: number, labelW = 70) => {
          doc.font('Helvetica').fontSize(8).fillColor('#666').text(label, x, yy, { width: labelW });
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text(value, x + labelW, yy, { width: 130 });
        };

        // Helper: section title
        const sectionTitle = (title: string) => {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(title, mL, y);
          y += 16;
        };

        // Helper: check if we need a new page
        const checkPage = (needed: number) => {
          if (y + needed > pageHeight - 50) {
            doc.addPage();
            y = 30;
          }
        };

        // ═══════════════════════════════════════════
        // SECTION A: HEADER + IMAGE + ORDER DETAILS
        // ═══════════════════════════════════════════
        doc.fontSize(14).font('Helvetica-Bold')
          .text('CUTTING CHART', mL, y, { align: 'center', width: cW });
        y += 18;
        doc.fontSize(10).font('Helvetica-Bold')
          .text(COMPANY_CONFIG.name, mL, y, { align: 'center', width: cW });
        y += 14;
        doc.moveTo(mL, y).lineTo(pageWidth - 30, y).lineWidth(1).stroke('#333');
        y += 10;

        const headerY = y;
        const imgW = 120;
        const imgH = 120;

        // Style Image (left side)
        let imageRendered = false;
        if (chartData.styleImage) {
          try {
            const imgPath = path.join(process.cwd(), 'uploads', chartData.styleImage.replace(/^\/uploads\//, ''));
            if (fs.existsSync(imgPath)) {
              doc.rect(mL, headerY, imgW + 10, imgH + 10).stroke('#DDD');
              doc.image(imgPath, mL + 5, headerY + 5, { width: imgW, height: imgH, fit: [imgW, imgH] });
              imageRendered = true;
            }
          } catch (_) { /* ignore image errors */ }
        }
        if (!imageRendered) {
          doc.rect(mL, headerY, imgW + 10, imgH + 10).fill('#F5F5F5').stroke('#DDD');
          doc.fontSize(8).fillColor('#999').text('No Image', mL + 30, headerY + 55);
          doc.fillColor('#000');
        }

        // Order Details (right side of image)
        const detailX = mL + imgW + 25;
        const col2X = detailX + 210;
        const col3X = col2X + 210;

        let dy = headerY + 2;
        drawField('Buyer:', chartData.buyer || '-', detailX, dy);
        drawField('Brand:', chartData.brand || '-', col2X, dy);
        drawField('Style:', chartData.style || '-', col3X, dy);
        dy += 16;
        drawField('Style Name:', chartData.styleName || '-', detailX, dy, 80);
        drawField('Color:', chartData.color || '-', col2X, dy);
        drawField('W/O #:', chartData.workOrderNumber, col3X, dy);
        dy += 16;
        drawField('Order Qty:', chartData.orderQty.toLocaleString(), detailX, dy);
        doc.font('Helvetica').fontSize(8).fillColor('#666').text('Cut Qty:', col2X, dy);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#C2410C')
          .text(`${totalCutQty.toLocaleString()} (${extraPercent}% extra)`, col2X + 70, dy);
        doc.fillColor('#000');
        drawField('Date:', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), col3X, dy);
        dy += 16;

        y = Math.max(headerY + imgH + 15, dy + 10);
        doc.moveTo(mL, y).lineTo(pageWidth - 30, y).lineWidth(0.5).stroke('#CCC');
        y += 10;

        // ═══════════════════════════════════════════
        // SECTION B: SIZE BREAKUP TABLE
        // ═══════════════════════════════════════════
        if (sizesWithCut.length > 0) {
          sectionTitle('SIZE BREAKUP');

          const sizeColW = Math.min(65, (cW - 80) / (sizesWithCut.length + 1));
          const labelW = 80;

          // Header
          doc.fontSize(7).font('Helvetica-Bold');
          doc.rect(mL, y, cW, 15).fillAndStroke('#E8E8E8', '#CCC');
          doc.fillColor('#000');
          doc.text('', mL + 3, y + 4, { width: labelW - 6 });
          let xPos = mL + labelW;
          sizesWithCut.forEach((s: any) => {
            doc.text(s.sizeName, xPos, y + 4, { width: sizeColW, align: 'center' });
            xPos += sizeColW;
          });
          doc.text('TOTAL', xPos, y + 4, { width: sizeColW, align: 'center' });
          y += 15;

          // Ratio row
          doc.fontSize(7).font('Helvetica');
          doc.rect(mL, y, cW, 13).stroke('#DDD');
          doc.text('Ratio', mL + 3, y + 3, { width: labelW - 6 });
          xPos = mL + labelW;
          sizesWithCut.forEach((s: any) => {
            doc.text(`${s.ratio}%`, xPos, y + 3, { width: sizeColW, align: 'center' });
            xPos += sizeColW;
          });
          doc.text('100%', xPos, y + 3, { width: sizeColW, align: 'center' });
          y += 13;

          // Order qty row
          doc.rect(mL, y, cW, 13).stroke('#DDD');
          doc.text('Order Qty', mL + 3, y + 3, { width: labelW - 6 });
          xPos = mL + labelW;
          sizesWithCut.forEach((s: any) => {
            doc.text(s.orderQty.toString(), xPos, y + 3, { width: sizeColW, align: 'center' });
            xPos += sizeColW;
          });
          doc.text(chartData.totalOrderQty.toString(), xPos, y + 3, { width: sizeColW, align: 'center' });
          y += 13;

          // Cut qty row (highlighted)
          doc.font('Helvetica-Bold');
          doc.rect(mL, y, cW, 13).fillAndStroke('#FFF7ED', '#DDD');
          doc.fillColor('#C2410C');
          doc.text('Cut Qty', mL + 3, y + 3, { width: labelW - 6 });
          xPos = mL + labelW;
          sizesWithCut.forEach((s: any) => {
            doc.text(s.cutQty.toString(), xPos, y + 3, { width: sizeColW, align: 'center' });
            xPos += sizeColW;
          });
          doc.text(totalCutQty.toString(), xPos, y + 3, { width: sizeColW, align: 'center' });
          doc.fillColor('#000');
          y += 18;
        }

        // ═══════════════════════════════════════════
        // SECTION C: FABRIC DETAILS TABLE
        // ═══════════════════════════════════════════
        if (chartData.fabricDetails && chartData.fabricDetails.length > 0) {
          checkPage(35);
          sectionTitle('FABRIC DETAILS');

          const fdCols = [90, 210, 85, 85, 85, 85];
          doc.fontSize(7).font('Helvetica-Bold');
          doc.rect(mL, y, cW, 15).fillAndStroke('#E8E8E8', '#CCC');
          doc.fillColor('#000');
          let fdx = mL;
          ['Part', 'Fabric', 'Ordered (m)', 'Received (m)', 'Available (m)', 'Extra / Shortage'].forEach((h, i) => {
            doc.text(h, fdx + 3, y + 4, { width: fdCols[i] - 6, align: i >= 2 ? 'center' : 'left' });
            fdx += fdCols[i];
          });
          y += 15;

          doc.fontSize(7).font('Helvetica');
          chartData.fabricDetails.forEach((fd: any, idx: number) => {
            if (idx % 2 === 1) doc.rect(mL, y, cW, 13).fill('#F9F9F9');
            doc.rect(mL, y, cW, 13).stroke('#DDD');
            doc.fillColor('#000');

            fdx = mL;
            const vals = [
              fd.part,
              fd.fabric || '-',
              fd.fabricOrdered > 0 ? fd.fabricOrdered.toFixed(1) : '0.0',
              fd.fabricReceived > 0 ? fd.fabricReceived.toFixed(1) : '0.0',
              fd.cutableQty > 0 ? fd.cutableQty.toFixed(1) : '0.0',
              fd.extraShortage >= 0 ? `+${fd.extraShortage.toFixed(1)}` : fd.extraShortage.toFixed(1),
            ];
            vals.forEach((v: string, i: number) => {
              if (i === 5) doc.fillColor(fd.extraShortage >= 0 ? '#15803D' : '#DC2626');
              doc.text(v, fdx + 3, y + 3, { width: fdCols[i] - 6, align: i >= 2 ? 'center' : 'left' });
              if (i === 5) doc.fillColor('#000');
              fdx += fdCols[i];
            });
            y += 13;
          });
          y += 8;
        }

        // ═══════════════════════════════════════════
        // SECTION D: FABRICS & CAD TABLE
        // ═══════════════════════════════════════════
        if (chartData.fabrics && chartData.fabrics.length > 0) {
          checkPage(35);
          sectionTitle('FABRICS & CAD');

          const fCols = [80, 140, 90, 55, 55, 55, 55, 55, 55];
          // Two-level header
          doc.fontSize(7).font('Helvetica-Bold');
          // Row 1: group headers
          doc.rect(mL, y, cW, 13).fillAndStroke('#E8E8E8', '#CCC');
          doc.fillColor('#000');
          let fx = mL;
          doc.text('Part', fx + 2, y + 3, { width: fCols[0] - 4 });
          fx += fCols[0];
          doc.text('Fabric', fx + 2, y + 3, { width: fCols[1] - 4 });
          fx += fCols[1];
          doc.text('Color', fx + 2, y + 3, { width: fCols[2] - 4 });
          fx += fCols[2];
          doc.text('Costing', fx, y + 3, { width: fCols[3] + fCols[4], align: 'center' });
          fx += fCols[3] + fCols[4];
          doc.text('Raw Mat Calc', fx, y + 3, { width: fCols[5] + fCols[6], align: 'center' });
          fx += fCols[5] + fCols[6];
          doc.text('Production', fx, y + 3, { width: fCols[7] + fCols[8], align: 'center' });
          y += 13;

          // Row 2: sub-headers
          doc.rect(mL, y, cW, 13).fillAndStroke('#F0F0F0', '#CCC');
          doc.fillColor('#000');
          fx = mL + fCols[0] + fCols[1] + fCols[2]; // skip Part/Fabric/Color
          doc.text('', mL, y + 3, { width: fCols[0] + fCols[1] + fCols[2] });
          for (let g = 0; g < 3; g++) {
            doc.text('Width', fx + 2, y + 3, { width: fCols[3 + g * 2] - 4, align: 'center' });
            fx += fCols[3 + g * 2];
            doc.text('Avg', fx + 2, y + 3, { width: fCols[4 + g * 2] - 4, align: 'center' });
            fx += fCols[4 + g * 2];
          }
          y += 13;

          // Data rows
          doc.fontSize(7).font('Helvetica');
          chartData.fabrics.forEach((f: any, idx: number) => {
            if (idx % 2 === 1) doc.rect(mL, y, cW, 13).fill('#F9F9F9');
            doc.rect(mL, y, cW, 13).stroke('#DDD');
            doc.fillColor('#000');

            fx = mL;
            const vals = [
              f.part,
              f.fabricName || '-',
              f.fabricColor || '-',
              f.costingWidth ? `${f.costingWidth}"` : '-',
              f.costingAverage?.toFixed(2) || '-',
              f.rawMatCalcWidth ? `${f.rawMatCalcWidth}"` : '-',
              f.rawMatCalcAverage?.toFixed(2) || '-',
              f.productionWidth ? `${f.productionWidth}"` : '-',
              f.productionAverage?.toFixed(2) || '-',
            ];
            vals.forEach((v: string, i: number) => {
              const isBold = i >= 7; // Production columns bold
              if (isBold) doc.font('Helvetica-Bold');
              doc.text(v, fx + 2, y + 3, { width: fCols[i] - 4, align: i >= 3 ? 'center' : 'left' });
              if (isBold) doc.font('Helvetica');
              fx += fCols[i];
            });
            y += 13;
          });
          y += 8;
        }

        // ═══════════════════════════════════════════
        // SECTION E: LOT DETAILS
        // ═══════════════════════════════════════════
        const fabricsWithLots = (chartData.fabrics || []).filter((f: any) => f.lots && f.lots.length > 0);
        if (fabricsWithLots.length > 0) {
          checkPage(35);
          sectionTitle('LOT DETAILS');

          const lCols = [80, 140, 80, 100, 80];
          fabricsWithLots.forEach((fabric: any) => {
            // Sub-header per fabric
            if (fabricsWithLots.length > 1) {
              checkPage(30);
              doc.fontSize(8).font('Helvetica-Bold').fillColor('#444')
                .text(`${fabric.part} — ${fabric.fabricName}`, mL, y);
              doc.fillColor('#000');
              y += 14;
            }

            // Table header
            doc.fontSize(7).font('Helvetica-Bold');
            doc.rect(mL, y, cW, 14).fillAndStroke('#E8E8E8', '#CCC');
            doc.fillColor('#000');
            let lx = mL;
            ['Lot #', 'Roll Numbers', 'Prod Width', 'Available (m)', 'Grade'].forEach((h, i) => {
              doc.text(h, lx + 3, y + 3, { width: lCols[i] - 6, align: i >= 2 ? 'center' : 'left' });
              lx += lCols[i];
            });
            y += 14;

            doc.fontSize(7).font('Helvetica');
            fabric.lots.forEach((lot: any, idx: number) => {
              checkPage(14);
              if (idx % 2 === 1) doc.rect(mL, y, cW, 13).fill('#F9F9F9');
              doc.rect(mL, y, cW, 13).stroke('#DDD');
              doc.fillColor('#000');

              lx = mL;
              const lVals = [
                `Lot ${lot.lotNumber}`,
                lot.rollNumbers || '-',
                `${lot.actualWidth}"`,
                lot.quantityAvailable.toFixed(1),
                lot.qualityGrade || '-',
              ];
              lVals.forEach((v: string, i: number) => {
                doc.text(v, lx + 3, y + 3, { width: lCols[i] - 6, align: i >= 2 ? 'center' : 'left' });
                lx += lCols[i];
              });
              y += 13;
            });
            y += 6;
          });
          y += 4;
        }

        // ═══════════════════════════════════════════
        // SECTION F: EXISTING BATCHES
        // ═══════════════════════════════════════════
        if (chartData.existingBatches && chartData.existingBatches.length > 0) {
          checkPage(30);
          sectionTitle('EXISTING BATCHES');

          doc.fontSize(8).font('Helvetica');
          let bx = mL;
          chartData.existingBatches.forEach((batch: any) => {
            const label = `${batch.batchNumber}  [${batch.status}]  ${batch.totalCut} pcs`;
            const bw = doc.widthOfString(label) + 16;
            if (bx + bw > pageWidth - 30) { bx = mL; y += 18; }
            doc.roundedRect(bx, y, bw, 16, 3).stroke('#CCC');
            doc.text(label, bx + 8, y + 4);
            bx += bw + 8;
          });
          y += 24;
        }

        // ═══════════════════════════════════════════
        // FOOTER
        // ═══════════════════════════════════════════
        doc.fontSize(7).font('Helvetica').fillColor('#999');
        doc.text(
          `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | ${COMPANY_CONFIG.name}`,
          mL, pageHeight - 35,
          { align: 'center', width: cW }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER SLIP PDF
  // ═══════════════════════════════════════════════════════════════════════════

  private async getTransferSlipWithDetails(slipId: string) {
    return prisma.transfer_slips.findUnique({
      where: { id: slipId },
      include: {
        workOrder: {
          select: {
            workOrderNumber: true,
            styles: { select: { styleCode: true, styleName: true } },
          },
        },
        skuBreakdown: {
          include: {
            color: { select: { id: true, colorName: true } },
            size: { select: { id: true, sizeName: true, sortOrder: true } },
          },
        },
        issuedTo: { select: { id: true, name: true } },
        preparedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        cuttingBatch: { select: { batchNumber: true } },
      },
    });
  }

  async generateTransferSlipPDF(slipId: string): Promise<Buffer> {
    const slip = await this.getTransferSlipWithDetails(slipId);
    if (!slip) {
      throw new Error(`Transfer Slip not found: ${slipId}`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawTransferSlipPage(doc, slip);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private drawTransferSlipPage(doc: PDFKit.PDFDocument, slip: any) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    const availableWidth = pageWidth - 60;
    let y = 30;

    // ── Header: Title ──
    doc.fontSize(16).font('Helvetica-Bold')
      .text('TRANSFER SLIP', marginLeft, y, { align: 'center', width: availableWidth });
    y += 25;

    // ── Company Details ──
    doc.fontSize(12).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: availableWidth });
    y += 16;

    doc.fontSize(8).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: availableWidth });
    y += 11;

    doc.text(`Ph: ${COMPANY_CONFIG.phone}  |  Email: ${COMPANY_CONFIG.email}`, marginLeft, y, { align: 'center', width: availableWidth });
    y += 16;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Slip Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Slip No: ${slip.slipNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(slip.transferDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Status: ${slip.status}`, marginLeft, y);
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── From / To Details ──
    const midPoint = pageWidth / 2;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('From:', marginLeft, y);
    doc.text('To:', midPoint + 10, y);
    y += 14;

    doc.fontSize(9).font('Helvetica');
    doc.text(slip.fromDepartment || 'N/A', marginLeft, y, { width: midPoint - marginLeft - 20 });
    doc.text(slip.toDepartment || 'N/A', midPoint + 10, y, { width: midPoint - 40 });
    y += 14;

    // Work Order & Style
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Work Order:', marginLeft, y);
    doc.font('Helvetica');
    doc.text(slip.workOrder?.workOrderNumber || 'N/A', marginLeft + 75, y);
    y += 12;

    if (slip.workOrder?.styles) {
      doc.font('Helvetica-Bold').text('Style:', marginLeft, y);
      doc.font('Helvetica').text(`${slip.workOrder.styles.styleCode} - ${slip.workOrder.styles.styleName}`, marginLeft + 75, y);
      y += 12;
    }

    if (slip.cuttingBatch) {
      doc.font('Helvetica-Bold').text('Batch:', marginLeft, y);
      doc.font('Helvetica').text(slip.cuttingBatch.batchNumber, marginLeft + 75, y);
      y += 12;
    }

    if (slip.issuedTo) {
      doc.font('Helvetica-Bold').text('Issued To:', marginLeft, y);
      doc.font('Helvetica').text(slip.issuedTo.name, marginLeft + 75, y);
      y += 12;
    }

    y += 8;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── SKU Table ──
    const hasColors = slip.skuBreakdown.some((s: any) => s.colorId != null);

    const colWidths = hasColors
      ? { sno: 35, color: 120, size: 120, qty: availableWidth - 275 }
      : { sno: 50, size: 200, qty: availableWidth - 250 };

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF');

    let xPos = marginLeft;
    doc.text('#', xPos + 3, y + 5, { width: colWidths.sno - 6, align: 'center' });
    xPos += colWidths.sno;

    if (hasColors) {
      doc.text('Color', xPos + 3, y + 5, { width: (colWidths as any).color - 6 });
      xPos += (colWidths as any).color;
    }

    doc.text('Size', xPos + 3, y + 5, { width: colWidths.size - 6 });
    xPos += colWidths.size;
    doc.text('Quantity', xPos + 3, y + 5, { width: colWidths.qty - 6, align: 'center' });
    y += 18;

    // Table rows - sort by size sortOrder
    const sortedSkus = [...slip.skuBreakdown].sort((a, b) => (a.size?.sortOrder || 0) - (b.size?.sortOrder || 0));

    doc.fontSize(9).font('Helvetica');
    let totalQty = 0;

    sortedSkus.forEach((sku, idx) => {
      const rowHeight = 16;
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
      doc.rect(marginLeft, y, availableWidth, rowHeight).fillAndStroke(bgColor, '#CCC');
      doc.fillColor('#000');

      xPos = marginLeft;
      doc.text((idx + 1).toString(), xPos + 3, y + 4, { width: colWidths.sno - 6, align: 'center' });
      xPos += colWidths.sno;

      if (hasColors) {
        doc.text(sku.color?.colorName || '—', xPos + 3, y + 4, { width: (colWidths as any).color - 6 });
        xPos += (colWidths as any).color;
      }

      doc.text(sku.size?.sizeName || '—', xPos + 3, y + 4, { width: colWidths.size - 6 });
      xPos += colWidths.size;
      doc.text(sku.quantity.toString(), xPos + 3, y + 4, { width: colWidths.qty - 6, align: 'center' });

      totalQty += sku.quantity;
      y += rowHeight;
    });

    // Total row
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF').font('Helvetica-Bold');
    xPos = marginLeft;
    doc.text('TOTAL', xPos + 3, y + 5, { width: availableWidth - colWidths.qty - 6, align: 'right' });
    doc.text(totalQty.toString(), marginLeft + availableWidth - colWidths.qty + 3, y + 5, { width: colWidths.qty - 6, align: 'center' });
    y += 18;

    y += 15;

    // ── Remarks ──
    if (slip.remarks) {
      doc.fillColor('#000').fontSize(9).font('Helvetica-Bold');
      doc.text('Remarks:', marginLeft, y);
      y += 12;
      doc.font('Helvetica');
      doc.text(slip.remarks, marginLeft, y, { width: availableWidth });
      y += 20;
    }

    // ── Signature Section ──
    y = Math.max(y, doc.page.height - 150);
    doc.fillColor('#000');
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 20;

    doc.fontSize(9).font('Helvetica');
    doc.text('Prepared By:', marginLeft, y);
    doc.text('Received By:', midPoint + 10, y);
    y += 12;

    const prepName = slip.preparedBy ? `${slip.preparedBy.firstName} ${slip.preparedBy.lastName}` : '';
    const recvName = slip.receivedBy ? `${slip.receivedBy.firstName} ${slip.receivedBy.lastName}` : '';
    doc.text(prepName, marginLeft, y);
    doc.text(recvName, midPoint + 10, y);
    y += 30;

    doc.text('Signature: ________________', marginLeft, y);
    doc.text('Signature: ________________', midPoint + 10, y);

    // ── Footer ──
    doc.fontSize(7).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')} | ${COMPANY_CONFIG.name}`, marginLeft, doc.page.height - 30, { align: 'center', width: availableWidth });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLAN PDF
  // ═══════════════════════════════════════════════════════════════════════════

  private async getChallanWithDetails(challanId: string) {
    return prisma.challans.findUnique({
      where: { id: challanId },
      include: {
        items: true,
        order: { select: { orderNumber: true } },
        productionRun: { select: { workOrderNumber: true } },
        purchaseOrder: {
          select: {
            poNumber: true,
            suppliers: { select: { name: true } },
          },
        },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async generateChallanPDF(challanId: string): Promise<Buffer> {
    const challan = await this.getChallanWithDetails(challanId);
    if (!challan) {
      throw new Error(`Challan not found: ${challanId}`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.drawChallanPage(doc, challan);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private drawChallanPage(doc: PDFKit.PDFDocument, challan: any) {
    const pageWidth = doc.page.width;
    const marginLeft = 30;
    const marginRight = pageWidth - 30;
    const availableWidth = pageWidth - 60;
    let y = 30;

    // ── Header: Title ──
    const typeLabel = challan.challanType === 'OUTWARD' ? 'OUTWARD'
      : challan.challanType === 'INWARD' ? 'INWARD' : 'INTERNAL';

    doc.fontSize(16).font('Helvetica-Bold')
      .text(`CHALLAN — ${typeLabel}`, marginLeft, y, { align: 'center', width: availableWidth });
    y += 25;

    // ── Company Details ──
    doc.fontSize(12).font('Helvetica-Bold')
      .text(COMPANY_CONFIG.name, marginLeft, y, { align: 'center', width: availableWidth });
    y += 16;

    doc.fontSize(8).font('Helvetica')
      .text(`${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} - ${COMPANY_CONFIG.pincode}`, marginLeft, y, { align: 'center', width: availableWidth });
    y += 11;

    doc.text(`GSTIN: ${COMPANY_CONFIG.gstin}  |  Ph: ${COMPANY_CONFIG.phone}`, marginLeft, y, { align: 'center', width: availableWidth });
    y += 16;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── Challan Details Row ──
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Challan No: ${challan.challanNumber}`, marginLeft, y);
    doc.text(`Date: ${this.formatDate(challan.challanDate)}`, marginRight - 150, y, { width: 150, align: 'right' });
    y += 14;

    doc.font('Helvetica').fontSize(9);
    doc.text(`Status: ${challan.status}`, marginLeft, y);

    // References
    const refs: string[] = [];
    if (challan.order) refs.push(`Order: ${challan.order.orderNumber}`);
    if (challan.productionRun) refs.push(`WO: ${challan.productionRun.workOrderNumber}`);
    if (challan.purchaseOrder) refs.push(`PO: ${challan.purchaseOrder.poNumber}`);
    if (refs.length > 0) {
      doc.text(refs.join('  |  '), marginRight - 300, y, { width: 300, align: 'right' });
    }
    y += 18;

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 12;

    // ── From / To Details ──
    const midPoint = pageWidth / 2;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('FROM:', marginLeft, y);
    doc.text('TO:', midPoint + 10, y);
    y += 14;

    doc.fontSize(9).font('Helvetica');
    doc.text(challan.fromName, marginLeft, y, { width: midPoint - marginLeft - 20 });
    doc.text(challan.toName, midPoint + 10, y, { width: midPoint - 40 });
    y += 12;

    doc.fillColor('#666');
    doc.text(`(${challan.fromType})`, marginLeft, y, { width: midPoint - marginLeft - 20 });
    doc.text(`(${challan.toType})`, midPoint + 10, y, { width: midPoint - 40 });
    doc.fillColor('#000');
    y += 16;

    // ── Transport Details (only if any transport field is set) ──
    const hasTransport = challan.vehicleNumber || challan.driverName || challan.lrNumber;
    if (hasTransport) {
      doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
      y += 10;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Transport Details:', marginLeft, y);
      y += 12;

      doc.font('Helvetica');
      const transportParts: string[] = [];
      if (challan.vehicleNumber) transportParts.push(`Vehicle: ${challan.vehicleNumber}`);
      if (challan.driverName) transportParts.push(`Driver: ${challan.driverName}`);
      if (challan.driverPhone) transportParts.push(`Phone: ${challan.driverPhone}`);
      if (challan.lrNumber) transportParts.push(`LR No: ${challan.lrNumber}`);
      doc.text(transportParts.join('    |    '), marginLeft, y, { width: availableWidth });
      y += 16;
    }

    // ── Horizontal Line ──
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 8;

    // ── Items Table ──
    const colWidths = { sno: 30, type: 65, description: 170, qty: 60, unit: 50, rate: 65, amount: availableWidth - 440 };

    // Table header
    doc.fontSize(8).font('Helvetica-Bold');
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF');

    let xPos = marginLeft;
    doc.text('#', xPos + 3, y + 5, { width: colWidths.sno - 6, align: 'center' });
    xPos += colWidths.sno;
    doc.text('Type', xPos + 3, y + 5, { width: colWidths.type - 6 });
    xPos += colWidths.type;
    doc.text('Description', xPos + 3, y + 5, { width: colWidths.description - 6 });
    xPos += colWidths.description;
    doc.text('Qty', xPos + 3, y + 5, { width: colWidths.qty - 6, align: 'center' });
    xPos += colWidths.qty;
    doc.text('Unit', xPos + 3, y + 5, { width: colWidths.unit - 6, align: 'center' });
    xPos += colWidths.unit;
    doc.text('Rate', xPos + 3, y + 5, { width: colWidths.rate - 6, align: 'right' });
    xPos += colWidths.rate;
    doc.text('Amount', xPos + 3, y + 5, { width: colWidths.amount - 6, align: 'right' });
    y += 18;

    // Table rows
    doc.fontSize(8).font('Helvetica');
    let totalAmount = 0;

    challan.items.forEach((item: any, idx: number) => {
      const rowHeight = 16;
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
      doc.rect(marginLeft, y, availableWidth, rowHeight).fillAndStroke(bgColor, '#CCC');
      doc.fillColor('#000');

      const qty = Number(item.quantity);
      const rate = item.rate ? Number(item.rate) : 0;
      const amt = qty * rate;
      totalAmount += amt;

      xPos = marginLeft;
      doc.text((idx + 1).toString(), xPos + 3, y + 4, { width: colWidths.sno - 6, align: 'center' });
      xPos += colWidths.sno;
      doc.text(item.itemType, xPos + 3, y + 4, { width: colWidths.type - 6 });
      xPos += colWidths.type;
      doc.text(item.description || '—', xPos + 3, y + 4, { width: colWidths.description - 6, ellipsis: true });
      xPos += colWidths.description;
      doc.text(qty.toString(), xPos + 3, y + 4, { width: colWidths.qty - 6, align: 'center' });
      xPos += colWidths.qty;
      doc.text(item.unit || 'PCS', xPos + 3, y + 4, { width: colWidths.unit - 6, align: 'center' });
      xPos += colWidths.unit;
      doc.text(rate > 0 ? `₹${rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—', xPos + 3, y + 4, { width: colWidths.rate - 6, align: 'right' });
      xPos += colWidths.rate;
      doc.text(amt > 0 ? `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—', xPos + 3, y + 4, { width: colWidths.amount - 6, align: 'right' });

      y += rowHeight;
    });

    // Total row
    doc.rect(marginLeft, y, availableWidth, 18).fillAndStroke('#333F50', '#000');
    doc.fillColor('#FFF').font('Helvetica-Bold').fontSize(8);
    xPos = marginLeft;
    const qtyColStart = colWidths.sno + colWidths.type + colWidths.description;
    doc.text('TOTAL', marginLeft + 3, y + 5, { width: qtyColStart - 6, align: 'right' });
    doc.text(Number(challan.totalQuantity).toString(), marginLeft + qtyColStart + 3, y + 5, { width: colWidths.qty - 6, align: 'center' });
    doc.text(challan.unit, marginLeft + qtyColStart + colWidths.qty + 3, y + 5, { width: colWidths.unit - 6, align: 'center' });
    if (totalAmount > 0) {
      doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, marginLeft + availableWidth - colWidths.amount + 3, y + 5, { width: colWidths.amount - 6, align: 'right' });
    }
    y += 18;

    y += 15;

    // ── Remarks ──
    if (challan.remarks) {
      doc.fillColor('#000').fontSize(9).font('Helvetica-Bold');
      doc.text('Remarks:', marginLeft, y);
      y += 12;
      doc.font('Helvetica');
      doc.text(challan.remarks, marginLeft, y, { width: availableWidth });
      y += 20;
    }

    // ── Signature Section ──
    y = Math.max(y, doc.page.height - 150);
    doc.fillColor('#000');
    doc.moveTo(marginLeft, y).lineTo(marginRight, y).stroke();
    y += 20;

    doc.fontSize(9).font('Helvetica');
    doc.text('Issued By:', marginLeft, y);
    doc.text('Received By:', midPoint + 10, y);
    y += 12;

    const issuedName = challan.issuedBy ? `${challan.issuedBy.firstName} ${challan.issuedBy.lastName}` : '';
    const recvName = challan.receivedBy ? `${challan.receivedBy.firstName} ${challan.receivedBy.lastName}` : '';
    doc.text(issuedName, marginLeft, y);
    doc.text(recvName, midPoint + 10, y);
    y += 30;

    doc.text('Signature: ________________', marginLeft, y);
    doc.text('Signature: ________________', midPoint + 10, y);

    // ── Footer ──
    doc.fontSize(7).fillColor('#999')
      .text(`Generated on ${new Date().toLocaleString('en-IN')} | ${COMPANY_CONFIG.name}`, marginLeft, doc.page.height - 30, { align: 'center', width: availableWidth });
  }
}

export default new DocumentGeneratorService();
