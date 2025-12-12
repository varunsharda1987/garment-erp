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
} from '../controllers/printing.controller';

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
// PRINT JOB ROUTES
// ============================================

// List
router.get('/jobs', getAllPrintJobs);

// CRUD
router.get('/jobs/:id', getPrintJobById);
router.post('/jobs', createPrintJob);
router.put('/jobs/:id', updatePrintJob);
router.delete('/jobs/:id', deletePrintJob);

// Workflow actions
router.post('/jobs/:id/send', sendToMill);
router.post('/jobs/:id/receive', receiveFromMill);
router.post('/jobs/:id/quality-check', qualityCheck);
router.post('/jobs/:id/update-stock', updateStock);

export default router;
