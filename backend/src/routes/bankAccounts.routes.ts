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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new bank account
router.post('/', asyncHandler(createBankAccount));

// Get all bank accounts with pagination and filters
router.get('/', asyncHandler(getAllBankAccounts));

// Get bank account by ID
router.get('/:id', asyncHandler(getBankAccountById));

// Update bank account
router.put('/:id', asyncHandler(updateBankAccount));

// Delete bank account (soft delete)
router.delete('/:id', asyncHandler(deleteBankAccount));

export default router;
