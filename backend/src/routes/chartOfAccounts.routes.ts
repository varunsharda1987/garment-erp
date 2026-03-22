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
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createChartOfAccountSchema,
  updateChartOfAccountSchema,
  chartOfAccountQuerySchema,
} from '../schemas/chartOfAccounts.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new account
router.post('/', validateBody(createChartOfAccountSchema), asyncHandler(createAccount));

// Get all accounts with pagination and filters
router.get('/', validateQuery(chartOfAccountQuerySchema), asyncHandler(getAllAccounts));

// Get account hierarchy (tree structure)
router.get('/hierarchy', asyncHandler(getAccountHierarchy));

// Get account by ID
router.get('/:id', asyncHandler(getAccountById));

// Update account
router.put('/:id', validateBody(updateChartOfAccountSchema), asyncHandler(updateAccount));

// Delete account (soft delete)
router.delete('/:id', asyncHandler(deleteAccount));

export default router;
