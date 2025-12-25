/**
 * Processor Rate Card Routes
 * Routes for managing processor rate cards
 */

import { Router } from 'express';
import {
  searchProcessorRateCards,
  createProcessorRateCard,
  updateProcessorRateCard,
  getProcessorsByType,
  getProcessorRatePreview,
  lookupProcessorRate,
} from '../controllers/processor-rate-card.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/processor-rate-cards/search - Search rate cards
router.get('/search', searchProcessorRateCards);

// GET /api/processor-rate-cards/processors/:processingType - Get processors by type
router.get('/processors/:processingType', getProcessorsByType);

// GET /api/processor-rate-cards/preview - Get rate preview
router.get('/preview', getProcessorRatePreview);

// POST /api/processor-rate-cards/lookup - Lookup best rate
router.post('/lookup', lookupProcessorRate);

// POST /api/processor-rate-cards - Create rate card
router.post('/', createProcessorRateCard);

// PUT /api/processor-rate-cards/:id - Update rate card
router.put('/:id', updateProcessorRateCard);

export default router;
