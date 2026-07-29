// Payment Terms Routes
import express from 'express';
import {
  createPaymentTerm,
  getAllPaymentTerms,
  getPaymentTermById,
  updatePaymentTerm,
  deletePaymentTerm,
} from '../controllers/paymentTerms.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createPaymentTermSchema,
  updatePaymentTermSchema,
  paymentTermQuerySchema,
} from '../schemas/paymentTerms.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new payment term
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createPaymentTermSchema),
  asyncHandler(createPaymentTerm)
);

// Get all payment terms with pagination and filters
router.get('/', validateQuery(paymentTermQuerySchema), asyncHandler(getAllPaymentTerms));

// Get payment term by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getPaymentTermById));

// Update payment term
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  validateBody(updatePaymentTermSchema),
  asyncHandler(updatePaymentTerm)
);

// Delete payment term (soft delete)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(deletePaymentTerm)
);

export default router;
