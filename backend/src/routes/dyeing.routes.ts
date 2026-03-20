import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
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
router.get('/summary', getSummary);
router.get('/summary/style/:styleId', getSummaryByStyle);
router.get('/summary/mill/:millId', getSummaryByMill);

// ============================================
// PROCESS PO ROUTES
// ============================================
router.get('/process-pos', getProcessPOs);
router.get('/process-pos/:id', getProcessPOById);
router.post('/process-pos', createProcessPO);
router.delete('/process-pos/:id', deleteProcessPO);
router.post('/process-pos/:id/send', sendProcessPO);
router.post('/process-pos/:id/receive', receiveProcessPO);
router.post('/process-pos/:id/quality-check', qualityCheckProcessPO);
router.post('/process-pos/:id/update-stock', updateStockProcessPO);
router.post('/process-pos/:id/return-unprocessed', returnUnprocessedProcessPO);

// ============================================
// LAB DIP ROUTES
// ============================================

// Search and list
router.get('/lab-dips/search', searchLabDips);
router.get('/lab-dips/approved', getApprovedLabDips);
router.get('/lab-dips', getAllLabDips);

// CRUD
router.get('/lab-dips/:id', getLabDipById);
router.post('/lab-dips', createLabDip);
router.put('/lab-dips/:id', updateLabDip);
router.delete('/lab-dips/:id', deleteLabDip);

// Workflow actions
router.post('/lab-dips/:id/approve', approveLabDip);
router.post('/lab-dips/:id/reject', rejectLabDip);
router.post('/lab-dips/:id/resubmit', requestResubmit);

// ============================================
// DYE JOB ROUTES
// ============================================

// List
router.get('/jobs', getAllDyeJobs);

// CRUD
router.get('/jobs/:id', getDyeJobById);
router.post('/jobs', createDyeJob);
router.put('/jobs/:id', updateDyeJob);
router.delete('/jobs/:id', deleteDyeJob);

// Workflow actions
router.post('/jobs/:id/send', sendToMill);
router.post('/jobs/:id/receive', receiveFromMill);
router.post('/jobs/:id/quality-check', qualityCheck);
router.post('/jobs/:id/update-stock', updateStock);

export default router;
