import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createLabDipSchema,
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
} from '../schemas/dyeing.schema';
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
  // Dye Job endpoints
  getAllDyeJobs,
  getDyeJobById,
  createDyeJob,
  updateDyeJob,
  deleteDyeJob,
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
} from '../controllers/dyeing.controller';

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
router.get('/process-pos', validateQuery(processPoQuerySchema), asyncHandler(getProcessPOs));
router.get('/process-pos/:id', asyncHandler(getProcessPOById));
router.post('/process-pos', validateBody(createProcessPoSchema), asyncHandler(createProcessPO));
router.delete('/process-pos/:id', asyncHandler(deleteProcessPO));
router.post('/process-pos/:id/send', validateBody(processPoActionSchema), asyncHandler(sendProcessPO));
router.post('/process-pos/:id/receive', validateBody(processPoActionSchema), asyncHandler(receiveProcessPO));
router.post('/process-pos/:id/quality-check', validateBody(processPoActionSchema), asyncHandler(qualityCheckProcessPO));
router.post('/process-pos/:id/update-stock', validateBody(processPoActionSchema), asyncHandler(updateStockProcessPO));
router.post(
  '/process-pos/:id/return-unprocessed',
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

// CRUD
router.get('/lab-dips/:id', asyncHandler(getLabDipById));
router.post('/lab-dips', validateBody(createLabDipSchema), asyncHandler(createLabDip));
router.put('/lab-dips/:id', validateBody(updateLabDipSchema), asyncHandler(updateLabDip));
router.delete('/lab-dips/:id', asyncHandler(deleteLabDip));

// Workflow actions
router.post('/lab-dips/:id/approve', validateBody(labDipActionSchema), asyncHandler(approveLabDip));
router.post('/lab-dips/:id/reject', validateBody(labDipActionSchema), asyncHandler(rejectLabDip));
router.post('/lab-dips/:id/resubmit', validateBody(labDipActionSchema), asyncHandler(requestResubmit));

// ============================================
// DYE JOB ROUTES
// ============================================

// List
router.get('/jobs', validateQuery(dyeJobQuerySchema), asyncHandler(getAllDyeJobs));

// CRUD
router.get('/jobs/:id', asyncHandler(getDyeJobById));
router.post('/jobs', validateBody(createDyeJobSchema), asyncHandler(createDyeJob));
router.put('/jobs/:id', validateBody(updateDyeJobSchema), asyncHandler(updateDyeJob));
router.delete('/jobs/:id', asyncHandler(deleteDyeJob));

// Workflow actions
router.post('/jobs/:id/send', validateBody(dyeJobActionSchema), asyncHandler(sendToMill));
router.post('/jobs/:id/receive', validateBody(dyeJobActionSchema), asyncHandler(receiveFromMill));
router.post('/jobs/:id/quality-check', validateBody(dyeJobActionSchema), asyncHandler(qualityCheck));
router.post('/jobs/:id/update-stock', validateBody(dyeJobActionSchema), asyncHandler(updateStock));

export default router;
