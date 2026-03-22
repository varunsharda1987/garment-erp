import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
router.get('/summary/mill/:millId', asyncHandler(getSummaryByMill));

// ============================================
// PROCESS PO ROUTES
// ============================================
router.get('/process-pos', asyncHandler(getProcessPOs));
router.get('/process-pos/:id', asyncHandler(getProcessPOById));
router.post('/process-pos', asyncHandler(createProcessPO));
router.delete('/process-pos/:id', asyncHandler(deleteProcessPO));
router.post('/process-pos/:id/send', asyncHandler(sendProcessPO));
router.post('/process-pos/:id/receive', asyncHandler(receiveProcessPO));
router.post('/process-pos/:id/quality-check', asyncHandler(qualityCheckProcessPO));
router.post('/process-pos/:id/update-stock', asyncHandler(updateStockProcessPO));
router.post('/process-pos/:id/return-unprocessed', asyncHandler(returnUnprocessedProcessPO));

// ============================================
// LAB DIP ROUTES
// ============================================

// Search and list
router.get('/lab-dips/search', asyncHandler(searchLabDips));
router.get('/lab-dips/approved', asyncHandler(getApprovedLabDips));
router.get('/lab-dips', asyncHandler(getAllLabDips));

// CRUD
router.get('/lab-dips/:id', asyncHandler(getLabDipById));
router.post('/lab-dips', asyncHandler(createLabDip));
router.put('/lab-dips/:id', asyncHandler(updateLabDip));
router.delete('/lab-dips/:id', asyncHandler(deleteLabDip));

// Workflow actions
router.post('/lab-dips/:id/approve', asyncHandler(approveLabDip));
router.post('/lab-dips/:id/reject', asyncHandler(rejectLabDip));
router.post('/lab-dips/:id/resubmit', asyncHandler(requestResubmit));

// ============================================
// DYE JOB ROUTES
// ============================================

// List
router.get('/jobs', asyncHandler(getAllDyeJobs));

// CRUD
router.get('/jobs/:id', asyncHandler(getDyeJobById));
router.post('/jobs', asyncHandler(createDyeJob));
router.put('/jobs/:id', asyncHandler(updateDyeJob));
router.delete('/jobs/:id', asyncHandler(deleteDyeJob));

// Workflow actions
router.post('/jobs/:id/send', asyncHandler(sendToMill));
router.post('/jobs/:id/receive', asyncHandler(receiveFromMill));
router.post('/jobs/:id/quality-check', asyncHandler(qualityCheck));
router.post('/jobs/:id/update-stock', asyncHandler(updateStock));

export default router;
