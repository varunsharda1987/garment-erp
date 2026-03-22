import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
router.get('/summary', asyncHandler(getSummary));
router.get('/available-cartons', asyncHandler(getAvailableCartons));
router.get('/orders-ready', asyncHandler(getOrdersReadyForDispatch));

// ============================================
// DELIVERY NOTE ROUTES
// ============================================

// List and CRUD
router.get('/delivery-notes', asyncHandler(getAllDeliveryNotes));
router.get('/delivery-notes/:id', asyncHandler(getDeliveryNoteById));
router.post('/delivery-notes', asyncHandler(createDeliveryNote));
router.delete('/delivery-notes/:id', asyncHandler(deleteDeliveryNote));

// Workflow actions
router.post('/delivery-notes/:id/assign-transport', asyncHandler(assignTransport));
router.post('/delivery-notes/:id/dispatch', asyncHandler(dispatchDeliveryNote));
router.post('/delivery-notes/:id/record-pod', asyncHandler(recordPOD));

// ============================================
// ASN ROUTES
// ============================================

// List and CRUD
router.get('/asn', asyncHandler(getAllASN));
router.get('/asn/:id', asyncHandler(getASNById));
router.post('/asn', asyncHandler(createASN));
router.delete('/asn/:id', asyncHandler(deleteASN));

// Workflow actions
router.post('/asn/:id/apply', asyncHandler(applyASN));
router.post('/asn/:id/approve', asyncHandler(approveASN));
router.post('/asn/:id/reject', asyncHandler(rejectASN));
router.post('/asn/:id/reschedule', asyncHandler(rescheduleASN));

export default router;
