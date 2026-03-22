/**
 * Processor Rate Card V2 Routes
 * Matrix-based rate card management for DYEING and PRINTING processors
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
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
  // Lace rate card functions
  getGreigeLacesForRateCard,
  getLaceProcessorMatrix,
  saveLaceMatrix,
  addLace,
  removeLace,
  lookupLaceRate,
} from '../controllers/processor-rate-card-v2.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get summary dashboard for all processors
router.get('/summary', asyncHandler(getSummary));

// Get all DYEING/PRINTING processors
router.get('/processors', asyncHandler(getProcessors));

// Get rate matrix for a processor (greige fabric)
router.get('/processors/:processorId/matrix', asyncHandler(getProcessorMatrix));

// Get all greiges for row population
router.get('/greiges', asyncHandler(getGreigesForRateCard));

// Update slab definitions
router.post('/processors/:processorId/slabs', asyncHandler(updateSlabs));

// Bulk save rate matrix (greige fabric)
router.put('/processors/:processorId/matrix', asyncHandler(saveMatrix));

// Copy rates between processors
router.post('/copy', asyncHandler(copyRates));

// Add greige row to processor's matrix
router.post('/processors/:processorId/greiges/:greigeId', asyncHandler(addGreige));

// Remove greige row from processor's matrix
router.delete('/processors/:processorId/greiges/:greigeId', asyncHandler(removeGreige));

// Lookup rate for fabric costing
router.post('/lookup', asyncHandler(lookupRate));

// ==========================================
// LACE RATE CARD ROUTES
// ==========================================

// Get all greige laces for row population
router.get('/laces', asyncHandler(getGreigeLacesForRateCard));

// Get lace rate matrix for a processor
router.get('/processors/:processorId/lace-matrix', asyncHandler(getLaceProcessorMatrix));

// Bulk save lace rate matrix
router.put('/processors/:processorId/lace-matrix', asyncHandler(saveLaceMatrix));

// Add greige lace row to processor's matrix
router.post('/processors/:processorId/laces/:laceId', asyncHandler(addLace));

// Remove greige lace row from processor's matrix
router.delete('/processors/:processorId/laces/:laceId', asyncHandler(removeLace));

// Lookup rate for lace costing
router.post('/lookup-lace', asyncHandler(lookupLaceRate));

export default router;
