import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
  receiveFromMill,
  qualityCheck,
  updateStock,
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
  receiveProcessPO,
  qualityCheckProcessPO,
  updateStockProcessPO,
  returnUnprocessedProcessPO,
} from '../controllers/printing.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

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
router.post(
  '/process-pos/:id/receive',
  validateParams(idParamSchema),
  validateBody(printProcessPoActionSchema),
  asyncHandler(receiveProcessPO)
);
router.post(
  '/process-pos/:id/quality-check',
  validateParams(idParamSchema),
  validateBody(printProcessPoActionSchema),
  asyncHandler(qualityCheckProcessPO)
);
router.post(
  '/process-pos/:id/update-stock',
  validateParams(idParamSchema),
  validateBody(printProcessPoActionSchema),
  asyncHandler(updateStockProcessPO)
);
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
router.post(
  '/jobs/:id/receive',
  validateParams(idParamSchema),
  validateBody(printJobActionSchema),
  asyncHandler(receiveFromMill)
);
router.post(
  '/jobs/:id/quality-check',
  validateParams(idParamSchema),
  validateBody(printJobActionSchema),
  asyncHandler(qualityCheck)
);
router.post(
  '/jobs/:id/update-stock',
  validateParams(idParamSchema),
  validateBody(printJobActionSchema),
  asyncHandler(updateStock)
);

export default router;
