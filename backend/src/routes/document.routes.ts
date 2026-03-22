/**
 * Document Routes
 *
 * API endpoints for document generation and sharing
 */

import { Router } from 'express';
import documentController from '../controllers/document.controller';
import { asyncHandler } from '../middleware/error.middleware';

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
router.get('/invoices/:id/pdf', asyncHandler(documentController.generateInvoicePDF.bind(documentController)));

/**
 * @route   GET /api/documents/invoices/:id/excel
 * @desc    Generate and download Tax Invoice Excel
 * @access  Private
 */
router.get('/invoices/:id/excel', asyncHandler(documentController.generateInvoiceExcel.bind(documentController)));

/**
 * @route   GET /api/documents/invoices/:id/whatsapp-link
 * @desc    Get WhatsApp share link for invoice
 * @query   phone (string) - Customer phone number
 * @access  Private
 */
router.get('/invoices/:id/whatsapp-link', asyncHandler(documentController.getInvoiceWhatsAppLink.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Proforma Invoice / Quotation Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/quotations/:id/proforma
 * @desc    Generate and download Proforma Invoice PDF
 * @query   includeImages (boolean) - Include style images
 * @access  Private
 */
router.get('/quotations/:id/proforma', asyncHandler(documentController.generateProformaPDF.bind(documentController)));

/**
 * @route   GET /api/documents/quotations/:id/whatsapp-link
 * @desc    Get WhatsApp share link for quotation
 * @query   phone (string) - Customer phone number
 * @access  Private
 */
router.get('/quotations/:id/whatsapp-link', asyncHandler(documentController.getQuotationWhatsAppLink.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Order Form Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/orders/:id/order-form
 * @desc    Generate and download Order Form PDF
 * @query   includeImages (boolean) - Include style images
 * @access  Private
 */
router.get('/orders/:id/order-form', asyncHandler(documentController.generateOrderFormPDF.bind(documentController)));

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
router.post('/catalogue/generate', asyncHandler(documentController.generateCataloguePDF.bind(documentController)));

/**
 * @route   POST /api/documents/catalogue/store
 * @desc    Generate and store catalogue for WhatsApp sharing
 * @body    Same as /catalogue/generate
 * @access  Private
 */
router.post('/catalogue/store', asyncHandler(documentController.generateAndStoreCataloguePDF.bind(documentController)));

/**
 * @route   GET /api/documents/catalogue/:id/download
 * @desc    Download a stored catalogue PDF
 * @access  Public (temp link)
 */
router.get('/catalogue/:id/download', asyncHandler(documentController.getTempCataloguePDF.bind(documentController)));

/**
 * @route   GET /api/documents/catalogue/:id/whatsapp-link
 * @desc    Get WhatsApp share link for catalogue
 * @query   phone (string) - Recipient phone number
 * @query   catalogueName (string) - Optional catalogue name for message
 * @access  Private
 */
router.get('/catalogue/:id/whatsapp-link', asyncHandler(documentController.getCatalogueWhatsAppLink.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Tech Pack Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/styles/:styleId/tech-pack-pdf
 * @desc    Generate and download Tech Pack PDF for a style
 * @access  Private
 */
router.get('/styles/:styleId/tech-pack-pdf', asyncHandler(documentController.generateTechPackPDF.bind(documentController)));

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
router.post('/line-sheet/pdf', asyncHandler(documentController.generateLineSheetPDF.bind(documentController)));

/**
 * @route   POST /api/documents/line-sheet/excel
 * @desc    Generate and download Line Sheet Excel
 * @body    Same as /line-sheet/pdf
 * @access  Private
 */
router.post('/line-sheet/excel', asyncHandler(documentController.generateLineSheetExcel.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Purchase Order Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/purchase-orders/:id/pdf
 * @desc    Generate and download Purchase Order PDF
 * @access  Private
 */
router.get('/purchase-orders/:id/pdf', asyncHandler(documentController.generatePurchaseOrderPDF.bind(documentController)));

/**
 * @route   GET /api/documents/purchase-orders/:id/whatsapp-link
 * @desc    Get WhatsApp share link for Purchase Order
 * @query   phone (string) - Supplier phone number
 * @access  Private
 */
router.get('/purchase-orders/:id/whatsapp-link', asyncHandler(documentController.getPurchaseOrderWhatsAppLink.bind(documentController)));

/**
 * @route   GET /api/documents/cutting-chart/:workOrderId/pdf
 * @desc    Generate and download Cutting Chart PDF
 * @query   colorId (string, optional) - Filter by color
 * @query   extraPercent (number, optional) - Extra percentage (default 1)
 * @access  Private
 */
router.get('/cutting-chart/:workOrderId/pdf', asyncHandler(documentController.generateCuttingChartPDF.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Transfer Slip Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/transfer-slips/:id/pdf
 * @desc    Generate and download Transfer Slip PDF
 * @access  Private
 */
router.get('/transfer-slips/:id/pdf', asyncHandler(documentController.generateTransferSlipPDF.bind(documentController)));

// ────────────────────────────────────────────────────────────────
// Challan Endpoints
// ────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/documents/challans/:id/pdf
 * @desc    Generate and download Challan PDF
 * @access  Private
 */
router.get('/challans/:id/pdf', asyncHandler(documentController.generateChallanPDF.bind(documentController)));

export default router;
