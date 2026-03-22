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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createPaymentTermSchema, updatePaymentTermSchema, paymentTermQuerySchema } from '../schemas/paymentTerms.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new payment term
router.post('/', validateBody(createPaymentTermSchema), asyncHandler(createPaymentTerm));

// Get all payment terms with pagination and filters
router.get('/', validateQuery(paymentTermQuerySchema), asyncHandler(getAllPaymentTerms));

// Get payment term by ID
router.get('/:id', asyncHandler(getPaymentTermById));

// Update payment term
router.put('/:id', validateBody(updatePaymentTermSchema), asyncHandler(updatePaymentTerm));

// Delete payment term (soft delete)
router.delete('/:id', asyncHandler(deletePaymentTerm));

export default router;
