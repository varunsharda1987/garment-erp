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
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class DocumentController {
  /**
   * Generate Tax Invoice PDF
   * GET /api/documents/invoices/:id/pdf
   */
  async generateInvoicePDF(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const includeImages = req.query.includeImages === 'true';

      const pdfBuffer = await documentGeneratorService.generateInvoicePDF(id, { includeImages });

      // Get invoice number for filename
      const invoice = await prisma.invoices.findUnique({
        where: { id },
        select: { invoiceNumber: true }
      });

      const filename = `TaxInvoice_${invoice?.invoiceNumber || id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate Tax Invoice Excel
   * GET /api/documents/invoices/:id/excel
   */
  async generateInvoiceExcel(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const excelBuffer = await documentGeneratorService.generateInvoiceExcel(id);

      // Get invoice number for filename
      const invoice = await prisma.invoices.findUnique({
        where: { id },
        select: { invoiceNumber: true }
      });

      const filename = `TaxInvoice_${invoice?.invoiceNumber || id}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error generating invoice Excel:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate Excel'
      });
    }
  }

  /**
   * Get WhatsApp share link for invoice
   * GET /api/documents/invoices/:id/whatsapp-link
   */
  async getInvoiceWhatsAppLink(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { phone } = req.query;

      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      // Get invoice details
      const invoice = await prisma.invoices.findUnique({
        where: { id },
        select: {
          invoiceNumber: true,
          customers: {
            select: { name: true }
          }
        }
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
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
          customerName: invoice.customers?.name
        }
      });
    } catch (error) {
      console.error('Error generating WhatsApp link:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate link'
      });
    }
  }

  /**
   * Generate Proforma Invoice PDF (from quotation)
   * GET /api/documents/quotations/:id/proforma
   */
  async generateProformaPDF(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const includeImages = req.query.includeImages === 'true';

      const pdfBuffer = await documentGeneratorService.generateProformaPDF(id, { includeImages });

      // Get quotation number for filename
      const quotation = await prisma.quotations.findUnique({
        where: { id },
        select: { quotationNumber: true }
      });

      const filename = `ProformaInvoice_${quotation?.quotationNumber || id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating proforma PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate Order Form PDF
   * GET /api/documents/orders/:id/order-form
   */
  async generateOrderFormPDF(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const includeImages = req.query.includeImages === 'true';

      const pdfBuffer = await documentGeneratorService.generateOrderFormPDF(id, { includeImages });

      // Get order number for filename
      const order = await prisma.orders.findUnique({
        where: { id },
        select: { orderNumber: true }
      });

      const filename = `OrderForm_${order?.orderNumber || id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating order form PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate PDF'
      });
    }
  }

  /**
   * Generate Style Catalogue PDF
   * POST /api/documents/catalogue/generate
   */
  async generateCataloguePDF(req: Request, res: Response) {
    try {
      const {
        styleIds,
        categoryIds,
        brandCategoryIds,
        seasons,
        priceRange,
        priceDisplay = 'b2b',
        showFabricDetails = false,
        showSizeRange = true,
        catalogueName = 'Product Catalogue'
      } = req.body;

      // Build filters
      const filters = {
        styleIds,
        categoryIds,
        brandCategoryIds,
        seasons,
        priceRange
      };

      // Build options
      const options = {
        priceDisplay,
        showFabricDetails,
        showSizeRange,
        catalogueName
      };

      const pdfBuffer = await documentGeneratorService.generateCataloguePDF(filters, options);

      const filename = `Catalogue_${catalogueName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating catalogue PDF:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate catalogue'
      });
    }
  }

  /**
   * Get WhatsApp share link for quotation
   * GET /api/documents/quotations/:id/whatsapp-link
   */
  async getQuotationWhatsAppLink(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { phone } = req.query;

      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const quotation = await prisma.quotations.findUnique({
        where: { id },
        select: {
          quotationNumber: true,
          customers: {
            select: { name: true }
          }
        }
      });

      if (!quotation) {
        return res.status(404).json({
          success: false,
          message: 'Quotation not found'
        });
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
          customerName: quotation.customers?.name
        }
      });
    } catch (error) {
      console.error('Error generating WhatsApp link:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate link'
      });
    }
  }
}

export default new DocumentController();
