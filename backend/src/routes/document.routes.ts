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
 *            includeIndex?: boolean,
 *            columnsPerPage?: number,
 *            catalogueName?: string
 *          }
 * @access  Private
 */
router.post('/catalogue/generate', documentController.generateCataloguePDF);

/**
 * @route   POST /api/documents/catalogue/store
 * @desc    Generate and store catalogue for WhatsApp sharing
 * @body    Same as /catalogue/generate
 * @access  Private
 */
router.post('/catalogue/store', documentController.generateAndStoreCataloguePDF);

/**
 * @route   GET /api/documents/catalogue/:id/download
 * @desc    Download a stored catalogue PDF
 * @access  Public (temp link)
 */
router.get('/catalogue/:id/download', documentController.getTempCataloguePDF);

/**
 * @route   GET /api/documents/catalogue/:id/whatsapp-link
 * @desc    Get WhatsApp share link for catalogue
 * @query   phone (string) - Recipient phone number
 * @query   catalogueName (string) - Optional catalogue name for message
 * @access  Private
 */
router.get('/catalogue/:id/whatsapp-link', documentController.getCatalogueWhatsAppLink);

// ────────────────────────────────────────────────────────────────
// Tech Pack Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/styles/:styleId/tech-pack-pdf
 * @desc    Generate and download Tech Pack PDF for a style
 * @access  Private
 */
router.get('/styles/:styleId/tech-pack-pdf', documentController.generateTechPackPDF);

// ────────────────────────────────────────────────────────────────
// Line Sheet Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/documents/line-sheet/pdf
 * @desc    Generate and download Line Sheet PDF
 * @body    {
 *            styleIds: string[],
 *            showWholesalePrice?: boolean,
 *            showRetailPrice?: boolean,
 *            buyerCompany?: string,
 *            buyerContact?: string,
 *            buyerEmail?: string,
 *            title?: string
 *          }
 * @access  Private
 */
router.post('/line-sheet/pdf', documentController.generateLineSheetPDF);

/**
 * @route   POST /api/documents/line-sheet/excel
 * @desc    Generate and download Line Sheet Excel
 * @body    Same as /line-sheet/pdf
 * @access  Private
 */
router.post('/line-sheet/excel', documentController.generateLineSheetExcel);

export default router;
