import express from 'express';
import { patternPartController } from '../controllers/patternPart.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new pattern part
router.post('/', patternPartController.createPatternPart.bind(patternPartController));

// Reorder pattern parts (must be before /:id routes to avoid conflict)
router.post('/reorder', patternPartController.reorderPatternParts.bind(patternPartController));

// Get all pattern parts with pagination
router.get('/', patternPartController.getPatternParts.bind(patternPartController));

// Get pattern part by code
router.get('/code/:code', patternPartController.getPatternPartByCode.bind(patternPartController));

// Get pattern part by ID
router.get('/:id', patternPartController.getPatternPartById.bind(patternPartController));

// Update pattern part
router.put('/:id', patternPartController.updatePatternPart.bind(patternPartController));

// Delete pattern part (soft delete)
router.delete('/:id', patternPartController.deletePatternPart.bind(patternPartController));

export default router;
