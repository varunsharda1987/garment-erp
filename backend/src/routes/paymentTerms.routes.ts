// Payment Terms Routes
import express from 'express';
import {
  createPaymentTerm,
  getAllPaymentTerms,
  getPaymentTermById,
  updatePaymentTerm,
  deletePaymentTerm,
} from '../controllers/paymentTerms.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new payment term
router.post('/', asyncHandler(createPaymentTerm));

// Get all payment terms with pagination and filters
router.get('/', asyncHandler(getAllPaymentTerms));

// Get payment term by ID
router.get('/:id', asyncHandler(getPaymentTermById));

// Update payment term
router.put('/:id', asyncHandler(updatePaymentTerm));

// Delete payment term (soft delete)
router.delete('/:id', asyncHandler(deletePaymentTerm));

export default router;
