import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createPrintLabDipSchema,
  updatePrintLabDipSchema,
  printLabDipQuerySchema,
  printLabDipActionSchema,
  createPrintJobSchema,
  updatePrintJobSchema,
  printJobQuerySchema,
  printJobActionSchema,
  createPrintProcessPoSchema,
  printProcessPoQuerySchema,
  printProcessPoActionSchema,
} from '../schemas/printing.schema';
// Shared with dyeing: the consolidated-issuance send payload (optional greigeStockLotId)
import { sendProcessPoSchema } from '../schemas/dyeing.schema';
import { idParamSchema, styleIdParamSchema, processorIdParamSchema } from '../schemas/common.schema';
import {
  // Lab Dip endpoints
  getAllLabDips,
  getLabDipById,
  createLabDip,
  updateLabDip,
  deleteLabDip,
  approveLabDip,
  rejectLabDip,
  requestResubmit,
  getApprovedLabDips,
  searchLabDips,
  // Buyer approval endpoints
  sendToBuyer,
  buyerApprove,
  buyerReject,
  buyerRequestResubmit,
  // Print Job endpoints
  getAllPrintJobs,
  getPrintJobById,
  createPrintJob,
  updatePrintJob,
  deletePrintJob,
  sendToMill,
  // Summary endpoints
  getSummary,
  getSummaryByStyle,
  getSummaryByMill,
  // Process PO endpoints
  getProcessPOs,
  getProcessPOById,
  createProcessPO,
  deleteProcessPO,
  sendProcessPO,
  returnUnprocessedProcessPO,
} from '../controllers/printing.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('printing'));

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', asyncHandler(getSummary));
router.get('/summary/style/:styleId', validateParams(styleIdParamSchema), asyncHandler(getSummaryByStyle));
router.get('/summary/processor/:processorId', validateParams(processorIdParamSchema), asyncHandler(getSummaryByMill));

// ============================================
// PROCESS PO ROUTES
// ============================================
router.get('/process-pos', validateQuery(printProcessPoQuerySchema), asyncHandler(getProcessPOs));
router.get('/process-pos/:id', validateParams(idParamSchema), asyncHandler(getProcessPOById));
router.post('/process-pos', validateBody(createPrintProcessPoSchema), asyncHandler(createProcessPO));
router.delete('/process-pos/:id', validateParams(idParamSchema), asyncHandler(deleteProcessPO));
router.post(
  '/process-pos/:id/send',
  validateParams(idParamSchema),
  validateBody(sendProcessPoSchema),
  asyncHandler(sendProcessPO)
);
// 2026-09-15: the page's own receipt half is RETIRED — processed fabric is received, quality-checked
// and booked into stock through the GRN (POST /api/grn/jwo, then approve). See dyeing.routes.ts.
const receiptRetired = (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message:
      'Processed fabric is received through a GRN (Receive against Job Work Order) — open Procurement → GRN → New and pick the job',
  });
// The route-validation smart-check reads `no-body` only from a comment line directly above each route.
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/receive', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/quality-check', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/update-stock', receiptRetired);
router.post(
  '/process-pos/:id/return-unprocessed',
  validateParams(idParamSchema),
  validateBody(printProcessPoActionSchema),
  asyncHandler(returnUnprocessedProcessPO)
);

// ============================================
// LAB DIP ROUTES
// ============================================

// Search and list
router.get('/lab-dips/search', asyncHandler(searchLabDips));
router.get('/lab-dips/approved', asyncHandler(getApprovedLabDips));
router.get('/lab-dips', validateQuery(printLabDipQuerySchema), asyncHandler(getAllLabDips));

// CRUD
router.get('/lab-dips/:id', validateParams(idParamSchema), asyncHandler(getLabDipById));
router.post('/lab-dips', validateBody(createPrintLabDipSchema), asyncHandler(createLabDip));
router.put(
  '/lab-dips/:id',
  validateParams(idParamSchema),
  validateBody(updatePrintLabDipSchema),
  asyncHandler(updateLabDip)
);
router.delete('/lab-dips/:id', validateParams(idParamSchema), asyncHandler(deleteLabDip));

// Workflow actions
router.post(
  '/lab-dips/:id/approve',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(approveLabDip)
);
router.post(
  '/lab-dips/:id/reject',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(rejectLabDip)
);
router.post(
  '/lab-dips/:id/resubmit',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(requestResubmit)
);

// Buyer approval actions
router.post(
  '/lab-dips/:id/send-to-buyer',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(sendToBuyer)
);
router.post(
  '/lab-dips/:id/buyer-approve',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(buyerApprove)
);
router.post(
  '/lab-dips/:id/buyer-reject',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(buyerReject)
);
router.post(
  '/lab-dips/:id/buyer-resubmit',
  validateParams(idParamSchema),
  validateBody(printLabDipActionSchema),
  asyncHandler(buyerRequestResubmit)
);

// ============================================
// PRINT JOB ROUTES
// ============================================

// List
router.get('/jobs', validateQuery(printJobQuerySchema), asyncHandler(getAllPrintJobs));

// CRUD
router.get('/jobs/:id', validateParams(idParamSchema), asyncHandler(getPrintJobById));
router.post('/jobs', validateBody(createPrintJobSchema), asyncHandler(createPrintJob));
router.put(
  '/jobs/:id',
  validateParams(idParamSchema),
  validateBody(updatePrintJobSchema),
  asyncHandler(updatePrintJob)
);
router.delete('/jobs/:id', validateParams(idParamSchema), asyncHandler(deletePrintJob));

// Workflow actions
router.post(
  '/jobs/:id/send',
  validateParams(idParamSchema),
  validateBody(printJobActionSchema),
  asyncHandler(sendToMill)
);
// Legacy print-job receipt surface — no frontend caller; same retirement as the process-PO routes above.
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/receive', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/quality-check', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/update-stock', receiptRetired);

export default router;
