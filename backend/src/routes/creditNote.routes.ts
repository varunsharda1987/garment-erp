import { Router } from 'express';
import { creditNoteController } from '../controllers/creditNote.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/credit-notes - Get all credit notes with pagination
router.get('/', asyncHandler(creditNoteController.getAll.bind(creditNoteController)));

// GET /api/credit-notes/:id - Get credit note by ID
router.get('/:id', asyncHandler(creditNoteController.getById.bind(creditNoteController)));

// POST /api/credit-notes - Create new credit note
router.post('/', asyncHandler(creditNoteController.create.bind(creditNoteController)));

// PUT /api/credit-notes/:id/approve - Approve credit note
router.put('/:id/approve', asyncHandler(creditNoteController.approve.bind(creditNoteController)));

// PUT /api/credit-notes/:id/cancel - Cancel credit note
router.put('/:id/cancel', asyncHandler(creditNoteController.cancel.bind(creditNoteController)));

// DELETE /api/credit-notes/:id - Delete credit note
router.delete('/:id', asyncHandler(creditNoteController.delete.bind(creditNoteController)));

export default router;
