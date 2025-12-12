import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  // Delivery Note endpoints
  getAllDeliveryNotes,
  getDeliveryNoteById,
  createDeliveryNote,
  deleteDeliveryNote,
  // Delivery Note workflow
  assignTransport,
  dispatchDeliveryNote,
  recordPOD,
  // ASN endpoints
  getAllASN,
  getASNById,
  createASN,
  applyASN,
  approveASN,
  rejectASN,
  rescheduleASN,
  deleteASN,
  // Summary endpoints
  getSummary,
  getAvailableCartons,
  getOrdersReadyForDispatch,
} from '../controllers/dispatch.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// SUMMARY ROUTES (must be before parameterized routes)
// ============================================
router.get('/summary', getSummary);
router.get('/available-cartons', getAvailableCartons);
router.get('/orders-ready', getOrdersReadyForDispatch);

// ============================================
// DELIVERY NOTE ROUTES
// ============================================

// List and CRUD
router.get('/delivery-notes', getAllDeliveryNotes);
router.get('/delivery-notes/:id', getDeliveryNoteById);
router.post('/delivery-notes', createDeliveryNote);
router.delete('/delivery-notes/:id', deleteDeliveryNote);

// Workflow actions
router.post('/delivery-notes/:id/assign-transport', assignTransport);
router.post('/delivery-notes/:id/dispatch', dispatchDeliveryNote);
router.post('/delivery-notes/:id/record-pod', recordPOD);

// ============================================
// ASN ROUTES
// ============================================

// List and CRUD
router.get('/asn', getAllASN);
router.get('/asn/:id', getASNById);
router.post('/asn', createASN);
router.delete('/asn/:id', deleteASN);

// Workflow actions
router.post('/asn/:id/apply', applyASN);
router.post('/asn/:id/approve', approveASN);
router.post('/asn/:id/reject', rejectASN);
router.post('/asn/:id/reschedule', rescheduleASN);

export default router;
