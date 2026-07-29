// Bank Accounts Routes
import express from 'express';
import {
  createBankAccount,
  getAllBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
} from '../controllers/bankAccounts.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountQuerySchema,
} from '../schemas/bankAccounts.schema';
import { idParamSchema } from '../schemas/common.schema';
import { UserRole } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new bank account
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createBankAccountSchema),
  asyncHandler(createBankAccount)
);

// Get all bank accounts with pagination and filters
router.get('/', validateQuery(bankAccountQuerySchema), asyncHandler(getAllBankAccounts));

// Get bank account by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getBankAccountById));

// Update bank account
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  validateBody(updateBankAccountSchema),
  asyncHandler(updateBankAccount)
);

// Delete bank account (soft delete)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(deleteBankAccount)
);

export default router;
