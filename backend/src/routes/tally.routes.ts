import { Router } from 'express';
import { tallyController } from '../controllers/tally.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { tallySettingsUpdateSchema, tallyLinkCustomerSchema, tallyLinkSupplierSchema } from '../schemas/tally.schema';

const router = Router();

router.use(authenticateToken);
router.use(authorize('ADMIN'));

// GET /api/tally/settings — Get current Tally settings
router.get('/settings', asyncHandler(tallyController.getSettings.bind(tallyController)));

// PUT /api/tally/settings — Update Tally settings
router.put(
  '/settings',
  validateBody(tallySettingsUpdateSchema),
  asyncHandler(tallyController.updateSettings.bind(tallyController))
);

// POST /api/tally/test — Test connection to Tally (no-body)
router.post('/test', asyncHandler(tallyController.testConnection.bind(tallyController)));

// GET /api/tally/ledgers — Fetch all ledgers from Tally
router.get('/ledgers', asyncHandler(tallyController.getLedgers.bind(tallyController)));

// GET /api/tally/voucher-types — Fetch voucher types from Tally
router.get('/voucher-types', asyncHandler(tallyController.getVoucherTypes.bind(tallyController)));

// GET /api/tally/groups — Fetch party groups from Tally
router.get('/groups', asyncHandler(tallyController.getGroups.bind(tallyController)));

// POST /api/tally/create-ledgers — Create missing configured ledgers in Tally (no-body)
router.post('/create-ledgers', asyncHandler(tallyController.createMissingLedgers.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Customer-Ledger Matching
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/customers — Get customers with Tally match status
router.get('/customers', asyncHandler(tallyController.getCustomers.bind(tallyController)));

// PUT /api/tally/customers/:customerId/link — Link customer to Tally ledger
router.put(
  '/customers/:customerId/link',
  validateBody(tallyLinkCustomerSchema),
  asyncHandler(tallyController.linkCustomer.bind(tallyController))
);

// DELETE /api/tally/customers/:customerId/link — Unlink customer from Tally ledger
router.delete('/customers/:customerId/link', asyncHandler(tallyController.unlinkCustomer.bind(tallyController)));

// POST /api/tally/customers/auto-match — Auto-match customers to Tally ledgers (no-body)
router.post('/customers/auto-match', asyncHandler(tallyController.autoMatchCustomers.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Invoice Push
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/invoices — Get invoices with Tally push status
router.get('/invoices', asyncHandler(tallyController.getInvoices.bind(tallyController)));

// POST /api/tally/invoices/:invoiceId/push — Push invoice to Tally (no-body)
router.post('/invoices/:invoiceId/push', asyncHandler(tallyController.pushInvoice.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Credit Note Push
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/credit-notes — Get credit notes with Tally push status
router.get('/credit-notes', asyncHandler(tallyController.getCreditNotes.bind(tallyController)));

// POST /api/tally/credit-notes/:creditNoteId/push — Push credit note to Tally (no-body)
router.post('/credit-notes/:creditNoteId/push', asyncHandler(tallyController.pushCreditNote.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Supplier-Ledger Matching
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/suppliers — Get suppliers with Tally match status
router.get('/suppliers', asyncHandler(tallyController.getSuppliers.bind(tallyController)));

// PUT /api/tally/suppliers/:supplierId/link — Link supplier to Tally ledger
router.put(
  '/suppliers/:supplierId/link',
  validateBody(tallyLinkSupplierSchema),
  asyncHandler(tallyController.linkSupplier.bind(tallyController))
);

// DELETE /api/tally/suppliers/:supplierId/link — Unlink supplier from Tally ledger
router.delete('/suppliers/:supplierId/link', asyncHandler(tallyController.unlinkSupplier.bind(tallyController)));

// POST /api/tally/suppliers/auto-match — Auto-match suppliers to Tally ledgers (no-body)
router.post('/suppliers/auto-match', asyncHandler(tallyController.autoMatchSuppliers.bind(tallyController)));

// GET /api/tally/suppliers/sync-preview — Preview what supplier details would be updated from Tally
router.get('/suppliers/sync-preview', asyncHandler(tallyController.previewSupplierSync.bind(tallyController)));

// POST /api/tally/suppliers/sync — Apply supplier detail updates from Tally (no-body)
router.post('/suppliers/sync', asyncHandler(tallyController.syncSupplierDetails.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Debit Note Push
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/debit-notes — Get debit notes with Tally push status
router.get('/debit-notes', asyncHandler(tallyController.getDebitNotes.bind(tallyController)));

// POST /api/tally/debit-notes/:debitNoteId/push — Push debit note to Tally (no-body)
router.post('/debit-notes/:debitNoteId/push', asyncHandler(tallyController.pushDebitNote.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Payment (Receipt) Push
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/payments — Get payments with Tally push status
router.get('/payments', asyncHandler(tallyController.getPayments.bind(tallyController)));

// POST /api/tally/payments/:paymentId/push — Push payment to Tally (no-body)
router.post('/payments/:paymentId/push', asyncHandler(tallyController.pushPayment.bind(tallyController)));

// ═══════════════════════════════════════════════════════════════════════════
// Outstanding / Receivables
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/tally/outstanding — Fetch outstanding balances from Tally with ERP reconciliation
router.get('/outstanding', asyncHandler(tallyController.getOutstanding.bind(tallyController)));

export default router;
