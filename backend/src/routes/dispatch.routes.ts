import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createDeliveryNoteSchema,
  deliveryNoteQuerySchema,
  deliveryNoteActionSchema,
  createASNSchema,
  asnQuerySchema,
  asnActionSchema,
  assignTransportSchema,
  recordPODSchema,
  approveASNSchema,
  rejectASNSchema,
  rescheduleASNSchema,
} from '../schemas/dispatch.schema';
import { idParamSchema } from '../schemas/common.schema';
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
router.get('/delivery-notes/:id', validateParams(idParamSchema), asyncHandler(getDeliveryNoteById));
router.post('/delivery-notes', validateBody(createDeliveryNoteSchema), asyncHandler(createDeliveryNote));
router.delete('/delivery-notes/:id', validateParams(idParamSchema), asyncHandler(deleteDeliveryNote));

// Workflow actions
router.post(
  '/delivery-notes/:id/assign-transport',
  validateParams(idParamSchema),
  validateBody(assignTransportSchema),
  asyncHandler(assignTransport)
);
router.post(
  '/delivery-notes/:id/dispatch',
  validateParams(idParamSchema),
  validateBody(deliveryNoteActionSchema),
  asyncHandler(dispatchDeliveryNote)
);
router.post(
  '/delivery-notes/:id/record-pod',
  validateParams(idParamSchema),
  validateBody(recordPODSchema),
  asyncHandler(recordPOD)
);

// ============================================
// ASN ROUTES
// ============================================

// List and CRUD
router.get('/asn', validateQuery(asnQuerySchema), asyncHandler(getAllASN));
router.get('/asn/:id', validateParams(idParamSchema), asyncHandler(getASNById));
router.post('/asn', validateBody(createASNSchema), asyncHandler(createASN));
router.delete('/asn/:id', validateParams(idParamSchema), asyncHandler(deleteASN));

// Workflow actions
// apply reads no body fields — it must not share approveASNSchema, whose appointmentDate is now
// required for the approve action (bug-hunt dispatch-7/dispatch-14).
router.post('/asn/:id/apply', validateParams(idParamSchema), validateBody(asnActionSchema), asyncHandler(applyASN));
router.post(
  '/asn/:id/approve',
  validateParams(idParamSchema),
  validateBody(approveASNSchema),
  asyncHandler(approveASN)
);
router.post('/asn/:id/reject', validateParams(idParamSchema), validateBody(rejectASNSchema), asyncHandler(rejectASN));
router.post(
  '/asn/:id/reschedule',
  validateParams(idParamSchema),
  validateBody(rescheduleASNSchema),
  asyncHandler(rescheduleASN)
);

export default router;
