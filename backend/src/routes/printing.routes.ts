import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
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
router.get('/summary/style/:styleId', asyncHandler(getSummaryByStyle));
router.get('/summary/processor/:processorId', asyncHandler(getSummaryByMill));

// ============================================
// PROCESS PO ROUTES
// ============================================
router.get('/process-pos', validateQuery(printProcessPoQuerySchema), asyncHandler(getProcessPOs));
router.get('/process-pos/:id', asyncHandler(getProcessPOById));
router.post('/process-pos', validateBody(createPrintProcessPoSchema), asyncHandler(createProcessPO));
router.delete('/process-pos/:id', asyncHandler(deleteProcessPO));
router.post('/process-pos/:id/send', validateBody(printProcessPoActionSchema), asyncHandler(sendProcessPO));
router.post('/process-pos/:id/receive', validateBody(printProcessPoActionSchema), asyncHandler(receiveProcessPO));
router.post(
  '/process-pos/:id/quality-check',
  validateBody(printProcessPoActionSchema),
  asyncHandler(qualityCheckProcessPO)
);
router.post(
  '/process-pos/:id/update-stock',
  validateBody(printProcessPoActionSchema),
  asyncHandler(updateStockProcessPO)
);
router.post(
  '/process-pos/:id/return-unprocessed',
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
router.get('/lab-dips/:id', asyncHandler(getLabDipById));
router.post('/lab-dips', validateBody(createPrintLabDipSchema), asyncHandler(createLabDip));
router.put('/lab-dips/:id', validateBody(updatePrintLabDipSchema), asyncHandler(updateLabDip));
router.delete('/lab-dips/:id', asyncHandler(deleteLabDip));

// Workflow actions
router.post('/lab-dips/:id/approve', validateBody(printLabDipActionSchema), asyncHandler(approveLabDip));
router.post('/lab-dips/:id/reject', validateBody(printLabDipActionSchema), asyncHandler(rejectLabDip));
router.post('/lab-dips/:id/resubmit', validateBody(printLabDipActionSchema), asyncHandler(requestResubmit));

// ============================================
// PRINT JOB ROUTES
// ============================================

// List
router.get('/jobs', validateQuery(printJobQuerySchema), asyncHandler(getAllPrintJobs));

// CRUD
router.get('/jobs/:id', asyncHandler(getPrintJobById));
router.post('/jobs', validateBody(createPrintJobSchema), asyncHandler(createPrintJob));
router.put('/jobs/:id', validateBody(updatePrintJobSchema), asyncHandler(updatePrintJob));
router.delete('/jobs/:id', asyncHandler(deletePrintJob));

// Workflow actions
router.post('/jobs/:id/send', validateBody(printJobActionSchema), asyncHandler(sendToMill));
router.post('/jobs/:id/receive', validateBody(printJobActionSchema), asyncHandler(receiveFromMill));
router.post('/jobs/:id/quality-check', validateBody(printJobActionSchema), asyncHandler(qualityCheck));
router.post('/jobs/:id/update-stock', validateBody(printJobActionSchema), asyncHandler(updateStock));

export default router;
