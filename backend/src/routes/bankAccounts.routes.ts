// Bank Accounts Routes
import express from 'express';
import {
  createBankAccount,
  getAllBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deleteBankAccount,
} from '../controllers/bankAccounts.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountQuerySchema,
} from '../schemas/bankAccounts.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new bank account
router.post('/', validateBody(createBankAccountSchema), asyncHandler(createBankAccount));

// Get all bank accounts with pagination and filters
router.get('/', validateQuery(bankAccountQuerySchema), asyncHandler(getAllBankAccounts));

// Get bank account by ID
router.get('/:id', asyncHandler(getBankAccountById));

// Update bank account
router.put('/:id', validateBody(updateBankAccountSchema), asyncHandler(updateBankAccount));

// Delete bank account (soft delete)
router.delete('/:id', asyncHandler(deleteBankAccount));

export default router;
