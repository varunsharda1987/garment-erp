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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new bank account
router.post('/', createBankAccount);

// Get all bank accounts with pagination and filters
router.get('/', getAllBankAccounts);

// Get bank account by ID
router.get('/:id', getBankAccountById);

// Update bank account
router.put('/:id', updateBankAccount);

// Delete bank account (soft delete)
router.delete('/:id', deleteBankAccount);

export default router;
