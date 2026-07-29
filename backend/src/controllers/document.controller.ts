/**
 * Document Controller
 *
 * Handles API requests for document generation:
 * - Tax Invoice PDF/Excel
 * - Proforma Invoice PDF
 * - Order Form PDF
 * - Style Catalogue PDF
 * - WhatsApp sharing
 */

import { Request, Response } from 'express';
import documentGeneratorService from '../services/document-generator.service';
import prisma from '../config/database';
import path from 'path';
import fs from 'fs';
import { ValidationError, NotFoundError } from '../errors';

// Clean up expired temp catalogue files (older than 24 hours) on startup
function cleanupTempCatalogues() {
  const tempDir = path.join(__dirname, '../../uploads/temp-catalogues');
  if (!fs.existsSync(tempDir)) return;

  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    files.forEach((file) => {
      const filepath = path.join(tempDir, file);
      try {
        const stat = fs.statSync(filepath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filepath);
        }
      } catch {
        /* ignore individual file errors */
      }
    });
  } catch {
    /* ignore cleanup errors */
  }
}
cleanupTempCatalogues();

class DocumentController {
  /**
   * Generate Tax Invoice PDF
   * GET /api/documents/invoices/:id/pdf
   */
  async generateInvoicePDF(req: Request, res: Response) {
    const { id } = req.params;
    const includeImages = req.query.includeImages === 'true';

    const pdfBuffer = await documentGeneratorService.generateInvoicePDF(id, { includeImages });

    // Get invoice number for filename
    const invoice = await prisma.invoices.findUnique({
      where: { id },
      select: { invoiceNumber: true },
    });

    const filename = `TaxInvoice_${invoice?.invoiceNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate Tax Invoice Excel
   * GET /api/documents/invoices/:id/excel
   */
  async generateInvoiceExcel(req: Request, res: Response) {
    const { id } = req.params;

    const excelBuffer = await documentGeneratorService.generateInvoiceExcel(id);

    // Get invoice number for filename
    const invoice = await prisma.invoices.findUnique({
      where: { id },
      select: { invoiceNumber: true },
    });

    const filename = `TaxInvoice_${invoice?.invoiceNumber || id}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
  }

  /**
   * Get WhatsApp share link for invoice
   * GET /api/documents/invoices/:id/whatsapp-link
   */
  async getInvoiceWhatsAppLink(req: Request, res: Response) {
    const { id } = req.params;
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    // Get invoice details
    const invoice = await prisma.invoices.findUnique({
      where: { id },
      select: {
        invoiceNumber: true,
        customers: {
          select: { name: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', id);
    }

    // Generate download URL (adjust based on your deployment)
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/documents/invoices/${id}/pdf`;

    const whatsappUrl = documentGeneratorService.generateWhatsAppLink(
      phone,
      'Tax Invoice',
      `Invoice ${invoice.invoiceNumber}`,
      downloadUrl
    );

    res.json({
      success: true,
      data: {
        whatsappUrl,
        downloadUrl,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customers?.name,
      },
    });
  }

  /**
   * Generate Proforma Invoice PDF (from quotation)
   * GET /api/documents/quotations/:id/proforma
   */
  async generateProformaPDF(req: Request, res: Response) {
    const { id } = req.params;
    const includeImages = req.query.includeImages === 'true';

    const pdfBuffer = await documentGeneratorService.generateProformaPDF(id, { includeImages });

    // Get quotation number for filename
    const quotation = await prisma.quotations.findUnique({
      where: { id },
      select: { quotationNumber: true },
    });

    const filename = `ProformaInvoice_${quotation?.quotationNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate Order Form PDF
   * GET /api/documents/orders/:id/order-form
   */
  async generateOrderFormPDF(req: Request, res: Response) {
    const { id } = req.params;
    const includeImages = req.query.includeImages === 'true';

    const pdfBuffer = await documentGeneratorService.generateOrderFormPDF(id, { includeImages });

    // Get order number for filename
    const order = await prisma.orders.findUnique({
      where: { id },
      select: { orderNumber: true },
    });

    const filename = `OrderForm_${order?.orderNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate Style Catalogue PDF
   * POST /api/documents/catalogue/generate
   */
  async generateCataloguePDF(req: Request, res: Response) {
    const {
      styleIds,
      categoryIds,
      brandCategoryIds,
      seasons,
      priceRange,
      priceDisplay = 'b2b',
      showFabricDetails = false,
      showSizeRange = true,
      includeIndex = false,
      columnsPerPage = 2,
      catalogueName = 'Product Catalogue',
    } = req.body;

    // Build filters
    const filters = {
      styleIds,
      categoryIds,
      brandCategoryIds,
      seasons,
      priceRange,
    };

    // Build options
    const options = {
      priceDisplay,
      showFabricDetails,
      showSizeRange,
      includeIndex,
      columnsPerPage,
      catalogueName,
    };

    const pdfBuffer = await documentGeneratorService.generateCataloguePDF(filters, options);

    const filename = `Catalogue_${catalogueName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate and store catalogue for WhatsApp sharing
   * POST /api/documents/catalogue/store
   */
  async generateAndStoreCataloguePDF(req: Request, res: Response) {
    const {
      styleIds,
      categoryIds,
      brandCategoryIds,
      seasons,
      priceRange,
      priceDisplay = 'b2b',
      showFabricDetails = false,
      showSizeRange = true,
      includeIndex = false,
      columnsPerPage = 2,
      catalogueName = 'Product Catalogue',
    } = req.body;

    // Build filters and options
    const filters = { styleIds, categoryIds, brandCategoryIds, seasons, priceRange };
    const options = { priceDisplay, showFabricDetails, showSizeRange, includeIndex, columnsPerPage, catalogueName };

    const pdfBuffer = await documentGeneratorService.generateCataloguePDF(filters, options);

    // Generate unique ID and save to temp directory
    const { v4: uuidv4 } = await import('uuid');
    const catalogueId = uuidv4();
    const tempDir = path.join(__dirname, '../../uploads/temp-catalogues');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `catalogue_${catalogueId}.pdf`;
    fs.writeFileSync(path.join(tempDir, filename), pdfBuffer);

    res.json({
      success: true,
      data: {
        catalogueId,
        expiresIn: '24 hours',
      },
    });
  }

  /**
   * Download stored catalogue
   * GET /api/documents/catalogue/:id/download
   */
  async getTempCataloguePDF(req: Request, res: Response) {
    const { id } = req.params;
    const filepath = path.join(__dirname, '../../uploads/temp-catalogues', `catalogue_${id}.pdf`);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundError('Catalogue');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Catalogue.pdf"');
    res.sendFile(filepath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({
          success: false,
          message: 'Catalogue file could not be read',
        });
      }
    });
  }

  /**
   * Get WhatsApp share link for catalogue
   * GET /api/documents/catalogue/:id/whatsapp-link
   */
  async getCatalogueWhatsAppLink(req: Request, res: Response) {
    const { id } = req.params;
    const { phone, catalogueName } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    // Verify catalogue exists
    const filepath = path.join(__dirname, '../../uploads/temp-catalogues', `catalogue_${id}.pdf`);
    if (!fs.existsSync(filepath)) {
      throw new NotFoundError('Catalogue');
    }

    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/documents/catalogue/${id}/download`;

    const whatsappUrl = documentGeneratorService.generateWhatsAppLink(
      phone,
      'Style Catalogue',
      (catalogueName as string) || 'Product Catalogue',
      downloadUrl
    );

    res.json({
      success: true,
      data: {
        whatsappUrl,
        downloadUrl,
      },
    });
  }

  /**
   * Get WhatsApp share link for quotation
   * GET /api/documents/quotations/:id/whatsapp-link
   */
  async getQuotationWhatsAppLink(req: Request, res: Response) {
    const { id } = req.params;
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    const quotation = await prisma.quotations.findUnique({
      where: { id },
      select: {
        quotationNumber: true,
        customers: {
          select: { name: true },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundError('Quotation', id);
    }

    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/documents/quotations/${id}/proforma`;

    const whatsappUrl = documentGeneratorService.generateWhatsAppLink(
      phone,
      'Proforma Invoice',
      `Quotation ${quotation.quotationNumber}`,
      downloadUrl
    );

    res.json({
      success: true,
      data: {
        whatsappUrl,
        downloadUrl,
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customers?.name,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TECH PACK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Tech Pack PDF for a style
   * GET /api/documents/styles/:styleId/tech-pack-pdf
   */
  async generateTechPackPDF(req: Request, res: Response) {
    const { styleId } = req.params;

    const pdfBuffer = await documentGeneratorService.generateTechPackPDF(styleId);

    // Get style code for filename
    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { styleCode: true },
    });

    const filename = `TechPack_${style?.styleCode || styleId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LINE SHEET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Line Sheet PDF
   * POST /api/documents/line-sheet/pdf
   * Body: { styleIds: string[], options: LineSheetOptions }
   */
  async generateLineSheetPDF(req: Request, res: Response) {
    // The client (and generateLineSheetSchema) send these FLAT, not nested under `options`.
    // Reading a nested `options` key meant it was always undefined, so every line-sheet option
    // (price toggles, buyer details, title) was silently ignored.
    const { styleIds, ...options } = req.body;

    if (!styleIds || !Array.isArray(styleIds) || styleIds.length === 0) {
      throw new ValidationError('styleIds array is required');
    }

    const pdfBuffer = await documentGeneratorService.generateLineSheetPDF(styleIds, options);

    const filename = `LineSheet_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate Line Sheet Excel
   * POST /api/documents/line-sheet/excel
   * Body: { styleIds: string[], options: LineSheetOptions }
   */
  async generateLineSheetExcel(req: Request, res: Response) {
    // Flat, not nested under `options` — same fix as generateLineSheetPDF above.
    const { styleIds, ...options } = req.body;

    if (!styleIds || !Array.isArray(styleIds) || styleIds.length === 0) {
      throw new ValidationError('styleIds array is required');
    }

    const excelBuffer = await documentGeneratorService.generateLineSheetExcel(styleIds, options);

    const filename = `LineSheet_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate Purchase Order PDF
   * GET /api/documents/purchase-orders/:id/pdf
   */
  async generatePurchaseOrderPDF(req: Request, res: Response) {
    const { id } = req.params;

    const pdfBuffer = await documentGeneratorService.generatePurchaseOrderPDF(id);

    // Get PO number for filename
    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id },
      select: { poNumber: true },
    });

    const filename = `PurchaseOrder_${purchaseOrder?.poNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Get WhatsApp share link for Purchase Order
   * GET /api/documents/purchase-orders/:id/whatsapp-link
   */
  async getPurchaseOrderWhatsAppLink(req: Request, res: Response) {
    const { id } = req.params;
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      throw new ValidationError('Phone number is required');
    }

    // Get PO details
    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id },
      select: {
        poNumber: true,
        suppliers: {
          select: { name: true },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundError('PurchaseOrder', id);
    }

    // Generate download URL
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/documents/purchase-orders/${id}/pdf`;

    const whatsappUrl = documentGeneratorService.generateWhatsAppLink(
      phone,
      'Purchase Order',
      `PO ${purchaseOrder.poNumber}`,
      downloadUrl
    );

    res.json({
      success: true,
      data: {
        whatsappUrl,
        downloadUrl,
        poNumber: purchaseOrder.poNumber,
        supplierName: purchaseOrder.suppliers?.name,
      },
    });
  }
  /**
   * Generate Cutting Chart PDF
   * GET /api/documents/cutting-chart/:workOrderId/pdf
   */
  async generateCuttingChartPDF(req: Request, res: Response) {
    const { workOrderId } = req.params;
    const { colorId, extraPercent } = req.query;

    const pdfBuffer = await documentGeneratorService.generateCuttingChartPDF(
      workOrderId,
      colorId as string | undefined,
      {
        extraPercent: extraPercent ? parseFloat(extraPercent as string) : 1,
      }
    );

    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: { workOrderNumber: true },
    });

    const filename = `CuttingChart_${workOrder?.workOrderNumber || workOrderId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
  /**
   * Generate Transfer Slip PDF
   * GET /api/documents/transfer-slips/:id/pdf
   */
  async generateTransferSlipPDF(req: Request, res: Response) {
    const { id } = req.params;

    const pdfBuffer = await documentGeneratorService.generateTransferSlipPDF(id);

    const slip = await prisma.transfer_slips.findUnique({
      where: { id },
      select: { slipNumber: true },
    });

    const filename = `TransferSlip_${slip?.slipNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  /**
   * Generate Challan PDF
   * GET /api/documents/challans/:id/pdf
   */
  async generateChallanPDF(req: Request, res: Response) {
    const { id } = req.params;

    const pdfBuffer = await documentGeneratorService.generateChallanPDF(id);

    const challan = await prisma.challans.findUnique({
      where: { id },
      select: { challanNumber: true },
    });

    const filename = `Challan_${challan?.challanNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }
}

export default new DocumentController();
