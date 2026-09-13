import { Router } from 'express';
import { debitNoteController } from '../controllers/debitNote.controller';
import { authenticateToken, requirePermissionForWrites, requireAdmin } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createDebitNoteSchema, debitNoteQuerySchema } from '../schemas/debitNote.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);
router.use(requirePermissionForWrites('creditDebitNotes'));

// GET /api/debit-notes - Get all debit notes with pagination
router.get(
  '/',
  validateQuery(debitNoteQuerySchema),
  asyncHandler(debitNoteController.getAll.bind(debitNoteController))
);

// GET /api/debit-notes/:id - Get debit note by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(debitNoteController.getById.bind(debitNoteController)));

// POST /api/debit-notes - Create new debit note
router.post(
  '/',
  validateBody(createDebitNoteSchema),
  asyncHandler(debitNoteController.create.bind(debitNoteController))
);

// PUT /api/debit-notes/:id/approve - Approve debit note (ADMIN only - segregation of duties)
router.put(
  '/:id/approve',
  requireAdmin(),
  validateParams(idParamSchema),
  asyncHandler(debitNoteController.approve.bind(debitNoteController))
);

// PUT /api/debit-notes/:id/cancel - Cancel debit note
router.put(
  '/:id/cancel',
  validateParams(idParamSchema),
  asyncHandler(debitNoteController.cancel.bind(debitNoteController))
);

// DELETE /api/debit-notes/:id - Delete debit note
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(debitNoteController.delete.bind(debitNoteController))
);

export default router;
