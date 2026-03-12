import { Router } from 'express';
import { debitNoteController } from '../controllers/debitNote.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/debit-notes - Get all debit notes with pagination
router.get('/', debitNoteController.getAll.bind(debitNoteController));

// GET /api/debit-notes/:id - Get debit note by ID
router.get('/:id', debitNoteController.getById.bind(debitNoteController));

// POST /api/debit-notes - Create new debit note
router.post('/', debitNoteController.create.bind(debitNoteController));

// PUT /api/debit-notes/:id/approve - Approve debit note
router.put('/:id/approve', debitNoteController.approve.bind(debitNoteController));

// PUT /api/debit-notes/:id/cancel - Cancel debit note
router.put('/:id/cancel', debitNoteController.cancel.bind(debitNoteController));

// DELETE /api/debit-notes/:id - Delete debit note
router.delete('/:id', debitNoteController.delete.bind(debitNoteController));

export default router;
