/**
 * Document Routes
 *
 * API endpoints for document generation and sharing
 */

import { Router } from 'express';
import documentController from '../controllers/document.controller';

const router = Router();

// ────────────────────────────────────────────────────────────────
// Tax Invoice Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/invoices/:id/pdf
 * @desc    Generate and download Tax Invoice PDF
 * @query   includeImages (boolean) - Include style images as subsequent pages
 * @access  Private
 */
router.get('/invoices/:id/pdf', documentController.generateInvoicePDF);

/**
 * @route   GET /api/documents/invoices/:id/excel
 * @desc    Generate and download Tax Invoice Excel
 * @access  Private
 */
router.get('/invoices/:id/excel', documentController.generateInvoiceExcel);

/**
 * @route   GET /api/documents/invoices/:id/whatsapp-link
 * @desc    Get WhatsApp share link for invoice
 * @query   phone (string) - Customer phone number
 * @access  Private
 */
router.get('/invoices/:id/whatsapp-link', documentController.getInvoiceWhatsAppLink);

// ────────────────────────────────────────────────────────────────
// Proforma Invoice / Quotation Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/quotations/:id/proforma
 * @desc    Generate and download Proforma Invoice PDF
 * @query   includeImages (boolean) - Include style images
 * @access  Private
 */
router.get('/quotations/:id/proforma', documentController.generateProformaPDF);

/**
 * @route   GET /api/documents/quotations/:id/whatsapp-link
 * @desc    Get WhatsApp share link for quotation
 * @query   phone (string) - Customer phone number
 * @access  Private
 */
router.get('/quotations/:id/whatsapp-link', documentController.getQuotationWhatsAppLink);

// ────────────────────────────────────────────────────────────────
// Order Form Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/orders/:id/order-form
 * @desc    Generate and download Order Form PDF
 * @query   includeImages (boolean) - Include style images
 * @access  Private
 */
router.get('/orders/:id/order-form', documentController.generateOrderFormPDF);

// ────────────────────────────────────────────────────────────────
// Style Catalogue Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/catalogue/generate
 * @desc    Generate Style Catalogue PDF
 * @body    {
 *            styleIds?: string[],
 *            categoryIds?: number[],
 *            brandCategoryIds?: number[],
 *            priceRange?: { min?: number, max?: number },
 *            priceDisplay: 'b2b' | 'b2r' | 'both' | 'none',
 *            showFabricDetails?: boolean,
 *            showSizeRange?: boolean,
 *            catalogueName?: string
 *          }
 * @access  Private
 */
router.post('/catalogue/generate', documentController.generateCataloguePDF);

export default router;
