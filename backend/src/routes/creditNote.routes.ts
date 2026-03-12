import { Router } from 'express';
import { creditNoteController } from '../controllers/creditNote.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/credit-notes - Get all credit notes with pagination
router.get('/', creditNoteController.getAll.bind(creditNoteController));

// GET /api/credit-notes/:id - Get credit note by ID
router.get('/:id', creditNoteController.getById.bind(creditNoteController));

// POST /api/credit-notes - Create new credit note
router.post('/', creditNoteController.create.bind(creditNoteController));

// PUT /api/credit-notes/:id/approve - Approve credit note
router.put('/:id/approve', creditNoteController.approve.bind(creditNoteController));

// PUT /api/credit-notes/:id/cancel - Cancel credit note
router.put('/:id/cancel', creditNoteController.cancel.bind(creditNoteController));

// DELETE /api/credit-notes/:id - Delete credit note
router.delete('/:id', creditNoteController.delete.bind(creditNoteController));

export default router;
