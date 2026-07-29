import { Router } from 'express';
import { creditNoteController } from '../controllers/creditNote.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createCreditNoteSchema, creditNoteQuerySchema } from '../schemas/creditNote.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/credit-notes - Get all credit notes with pagination
router.get(
  '/',
  validateQuery(creditNoteQuerySchema),
  asyncHandler(creditNoteController.getAll.bind(creditNoteController))
);

// GET /api/credit-notes/:id - Get credit note by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(creditNoteController.getById.bind(creditNoteController))
);

// POST /api/credit-notes - Create new credit note
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createCreditNoteSchema),
  asyncHandler(creditNoteController.create.bind(creditNoteController))
);

// PUT /api/credit-notes/:id/approve - Approve credit note (ADMIN only - segregation of duties)
router.put(
  '/:id/approve',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  asyncHandler(creditNoteController.approve.bind(creditNoteController))
);

// PUT /api/credit-notes/:id/cancel - Cancel credit note
router.put(
  '/:id/cancel',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(creditNoteController.cancel.bind(creditNoteController))
);

// DELETE /api/credit-notes/:id - Delete credit note
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(creditNoteController.delete.bind(creditNoteController))
);

export default router;
