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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new payment term
router.post('/', createPaymentTerm);

// Get all payment terms with pagination and filters
router.get('/', getAllPaymentTerms);

// Get payment term by ID
router.get('/:id', getPaymentTermById);

// Update payment term
router.put('/:id', updatePaymentTerm);

// Delete payment term (soft delete)
router.delete('/:id', deletePaymentTerm);

export default router;
