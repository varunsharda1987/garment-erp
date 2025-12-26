/**
 * Processor Rate Card V2 Routes
 * Matrix-based rate card management for DYEING and PRINTING processors
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getProcessors,
  getProcessorMatrix,
  getGreigesForRateCard,
  updateSlabs,
  saveMatrix,
  copyRates,
  addGreige,
  removeGreige,
  lookupRate,
  getSummary,
} from '../controllers/processor-rate-card-v2.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get summary dashboard for all processors
router.get('/summary', getSummary);

// Get all DYEING/PRINTING processors
router.get('/processors', getProcessors);

// Get rate matrix for a processor
router.get('/processors/:processorId/matrix', getProcessorMatrix);

// Get all greiges for row population
router.get('/greiges', getGreigesForRateCard);

// Update slab definitions
router.post('/processors/:processorId/slabs', updateSlabs);

// Bulk save rate matrix
router.put('/processors/:processorId/matrix', saveMatrix);

// Copy rates between processors
router.post('/copy', copyRates);

// Add greige row to processor's matrix
router.post('/processors/:processorId/greiges/:greigeId', addGreige);

// Remove greige row from processor's matrix
router.delete('/processors/:processorId/greiges/:greigeId', removeGreige);

// Lookup rate for fabric costing
router.post('/lookup', lookupRate);

export default router;
