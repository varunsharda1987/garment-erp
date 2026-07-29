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
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createChartOfAccountSchema,
  updateChartOfAccountSchema,
  chartOfAccountQuerySchema,
} from '../schemas/chartOfAccounts.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new account
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createChartOfAccountSchema),
  asyncHandler(createAccount)
);

// Get all accounts with pagination and filters
router.get('/', validateQuery(chartOfAccountQuerySchema), asyncHandler(getAllAccounts));

// Get account hierarchy (tree structure)
router.get('/hierarchy', asyncHandler(getAccountHierarchy));

// Get account by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getAccountById));

// Update account
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  validateBody(updateChartOfAccountSchema),
  asyncHandler(updateAccount)
);

// Delete account (soft delete)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(deleteAccount)
);

export default router;
