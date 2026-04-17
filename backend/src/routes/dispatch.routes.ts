import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createDeliveryNoteSchema,
  deliveryNoteQuerySchema,
  deliveryNoteActionSchema,
  createASNSchema,
  asnQuerySchema,
  asnActionSchema,
} from '../schemas/dispatch.schema';
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
router.get('/delivery-notes', validateQuery(deliveryNoteQuerySchema), asyncHandler(getAllDeliveryNotes));
router.get('/delivery-notes/:id', asyncHandler(getDeliveryNoteById));
router.post('/delivery-notes', validateBody(createDeliveryNoteSchema), asyncHandler(createDeliveryNote));
router.delete('/delivery-notes/:id', asyncHandler(deleteDeliveryNote));

// Workflow actions
router.post(
  '/delivery-notes/:id/assign-transport',
  validateBody(deliveryNoteActionSchema),
  asyncHandler(assignTransport)
);
router.post('/delivery-notes/:id/dispatch', validateBody(deliveryNoteActionSchema), asyncHandler(dispatchDeliveryNote));
router.post('/delivery-notes/:id/record-pod', validateBody(deliveryNoteActionSchema), asyncHandler(recordPOD));

// ============================================
// ASN ROUTES
// ============================================

// List and CRUD
router.get('/asn', validateQuery(asnQuerySchema), asyncHandler(getAllASN));
router.get('/asn/:id', asyncHandler(getASNById));
router.post('/asn', validateBody(createASNSchema), asyncHandler(createASN));
router.delete('/asn/:id', asyncHandler(deleteASN));

// Workflow actions
router.post('/asn/:id/apply', validateBody(asnActionSchema), asyncHandler(applyASN));
router.post('/asn/:id/approve', validateBody(asnActionSchema), asyncHandler(approveASN));
router.post('/asn/:id/reject', validateBody(asnActionSchema), asyncHandler(rejectASN));
router.post('/asn/:id/reschedule', validateBody(asnActionSchema), asyncHandler(rescheduleASN));

export default router;
