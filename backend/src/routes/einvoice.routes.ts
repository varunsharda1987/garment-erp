import { Router } from 'express';
import { einvoiceController } from '../controllers/einvoice.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { einvoiceSettingsUpdateSchema, einvoiceCancelSchema } from '../schemas/einvoice.schema';

const router = Router();

router.use(authenticateToken);
router.use(authorize('ADMIN'));

// GET /api/einvoice/settings — Get current e-Invoice settings (secrets masked)
router.get('/settings', asyncHandler(einvoiceController.getSettings.bind(einvoiceController)));

// PUT /api/einvoice/settings — Update e-Invoice settings
router.put(
  '/settings',
  validateBody(einvoiceSettingsUpdateSchema),
  asyncHandler(einvoiceController.updateSettings.bind(einvoiceController))
);

// POST /api/einvoice/test — Test IRP authentication round-trip (no-body)
router.post('/test', asyncHandler(einvoiceController.testConnection.bind(einvoiceController)));

// ═══════════════════════════════════════════════════════════════════════════
// IRN Generation
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/einvoice/invoices — List invoices with IRN status
router.get('/invoices', asyncHandler(einvoiceController.getInvoices.bind(einvoiceController)));

// GET /api/einvoice/invoices/:invoiceId/preflight — Validate invoice data + payload preview
router.get('/invoices/:invoiceId/preflight', asyncHandler(einvoiceController.preflight.bind(einvoiceController)));

// POST /api/einvoice/invoices/:invoiceId/generate — Generate IRN for invoice (no-body)
router.post('/invoices/:invoiceId/generate', asyncHandler(einvoiceController.generateIrn.bind(einvoiceController)));

// POST /api/einvoice/invoices/:invoiceId/cancel — Cancel IRN (within 24h of Ack)
router.post(
  '/invoices/:invoiceId/cancel',
  validateBody(einvoiceCancelSchema),
  asyncHandler(einvoiceController.cancelIrn.bind(einvoiceController))
);

export default router;
