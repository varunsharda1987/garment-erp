import { Router, Request, Response } from 'express';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createLabDipSchema,
  bulkCreateLabDipSchema,
  updateLabDipSchema,
  labDipQuerySchema,
  labDipActionSchema,
  createDyeJobSchema,
  updateDyeJobSchema,
  dyeJobQuerySchema,
  dyeJobActionSchema,
  createProcessPoSchema,
  processPoQuerySchema,
  processPoActionSchema,
  sendProcessPoSchema,
} from '../schemas/dyeing.schema';
import { idParamSchema, styleIdParamSchema, processorIdParamSchema } from '../schemas/common.schema';
import {
  // Lab Dip endpoints
  getAllLabDips,
  getLabDipById,
  createLabDip,
  bulkCreateLabDips,
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
  // Dye Job endpoints
  getAllDyeJobs,
  getDyeJobById,
  createDyeJob,
  updateDyeJob,
  deleteDyeJob,
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
} from '../controllers/dyeing.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('dyeing'));

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', asyncHandler(getSummary));
router.get('/summary/style/:styleId', validateParams(styleIdParamSchema), asyncHandler(getSummaryByStyle));
router.get('/summary/processor/:processorId', validateParams(processorIdParamSchema), asyncHandler(getSummaryByMill));

// ============================================
// PROCESS PO ROUTES
// ============================================
router.get('/process-pos', validateQuery(processPoQuerySchema), asyncHandler(getProcessPOs));
router.get('/process-pos/:id', validateParams(idParamSchema), asyncHandler(getProcessPOById));
router.post('/process-pos', validateBody(createProcessPoSchema), asyncHandler(createProcessPO));
router.delete('/process-pos/:id', validateParams(idParamSchema), asyncHandler(deleteProcessPO));
router.post(
  '/process-pos/:id/send',
  validateParams(idParamSchema),
  validateBody(sendProcessPoSchema),
  asyncHandler(sendProcessPO)
);
// 2026-09-15: the page's own receipt half is RETIRED — processed fabric is received, quality-checked
// and booked into stock through the GRN (POST /api/grn/jwo, then approve), which records everything
// this path did (received date, shrinkage, than/fold, inward challan) with one cost calculation and
// a ledger sync that cannot be swallowed. Receiving here first would also lock the job out of the
// GRN ("already received"). Reads and Send / Return stay. Tombstones follow fabric-processing.routes.
const receiptRetired = (_req: Request, res: Response) =>
  res.status(410).json({
    success: false,
    message:
      'Processed fabric is received with Receive from processor on the job work order — one action books it into stock',
  });
// The route-validation smart-check reads its `no-body` marker ONLY from a comment line directly above
// each route (comments inside the call are stripped before it looks; a trailing comment is never seen).
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/receive', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/quality-check', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/process-pos/:id/update-stock', receiptRetired);
router.post(
  '/process-pos/:id/return-unprocessed',
  validateParams(idParamSchema),
  validateBody(processPoActionSchema),
  asyncHandler(returnUnprocessedProcessPO)
);

// ============================================
// LAB DIP ROUTES
// ============================================

// Search and list
router.get('/lab-dips/search', asyncHandler(searchLabDips));
router.get('/lab-dips/approved', asyncHandler(getApprovedLabDips));
router.get('/lab-dips', validateQuery(labDipQuerySchema), asyncHandler(getAllLabDips));

// Bulk create (must be before :id routes)
router.post('/lab-dips/bulk', validateBody(bulkCreateLabDipSchema), asyncHandler(bulkCreateLabDips));

// CRUD
router.get('/lab-dips/:id', validateParams(idParamSchema), asyncHandler(getLabDipById));
router.post('/lab-dips', validateBody(createLabDipSchema), asyncHandler(createLabDip));
router.put(
  '/lab-dips/:id',
  validateParams(idParamSchema),
  validateBody(updateLabDipSchema),
  asyncHandler(updateLabDip)
);
router.delete('/lab-dips/:id', validateParams(idParamSchema), asyncHandler(deleteLabDip));

// Workflow actions
router.post(
  '/lab-dips/:id/approve',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(approveLabDip)
);
router.post(
  '/lab-dips/:id/reject',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(rejectLabDip)
);
router.post(
  '/lab-dips/:id/resubmit',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(requestResubmit)
);

// Buyer approval workflow
router.post(
  '/lab-dips/:id/send-to-buyer',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(sendToBuyer)
);
router.post(
  '/lab-dips/:id/buyer-approve',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(buyerApprove)
);
router.post(
  '/lab-dips/:id/buyer-reject',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(buyerReject)
);
router.post(
  '/lab-dips/:id/buyer-resubmit',
  validateParams(idParamSchema),
  validateBody(labDipActionSchema),
  asyncHandler(buyerRequestResubmit)
);

// ============================================
// DYE JOB ROUTES
// ============================================

// List
router.get('/jobs', validateQuery(dyeJobQuerySchema), asyncHandler(getAllDyeJobs));

// CRUD
router.get('/jobs/:id', validateParams(idParamSchema), asyncHandler(getDyeJobById));
router.post('/jobs', validateBody(createDyeJobSchema), asyncHandler(createDyeJob));
router.put('/jobs/:id', validateParams(idParamSchema), validateBody(updateDyeJobSchema), asyncHandler(updateDyeJob));
router.delete('/jobs/:id', validateParams(idParamSchema), asyncHandler(deleteDyeJob));

// Workflow actions
router.post(
  '/jobs/:id/send',
  validateParams(idParamSchema),
  validateBody(dyeJobActionSchema),
  asyncHandler(sendToMill)
);
// Legacy dye-job receipt surface — no frontend caller; same retirement as the process-PO routes above.
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/receive', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/quality-check', receiptRetired);
// no-body — 410 tombstone, nothing read
router.post('/jobs/:id/update-stock', receiptRetired);

export default router;
