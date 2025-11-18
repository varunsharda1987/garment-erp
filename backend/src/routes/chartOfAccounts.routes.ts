// Chart of Accounts Routes
import express from 'express';
import {
  createAccount,
  getAllAccounts,
  getAccountHierarchy,
  getAccountById,
  updateAccount,
  deleteAccount,
} from '../controllers/chartOfAccounts.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new account
router.post('/', createAccount);

// Get all accounts with pagination and filters
router.get('/', getAllAccounts);

// Get account hierarchy (tree structure)
router.get('/hierarchy', getAccountHierarchy);

// Get account by ID
router.get('/:id', getAccountById);

// Update account
router.put('/:id', updateAccount);

// Delete account (soft delete)
router.delete('/:id', deleteAccount);

export default router;
